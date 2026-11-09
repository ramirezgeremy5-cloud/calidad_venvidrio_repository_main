from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional

from app.database.connection import SessionLocal
from app.models.usuario import Usuario
from app.models.cargo import Cargo
from app.dependencies.security import decode_access_token, verify_token

security = HTTPBearer()

# =========================
# DEPENDENCIA DE BASE DE DATOS
# =========================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================
# DEPENDENCIAS DE AUTENTICACIÓN
# =========================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Usuario:
    """
    Obtener usuario actual desde el token JWT.
    Ya no valida session_id en BD para permitir múltiples sesiones simultáneas.
    """
    token = credentials.credentials

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id = payload.get("sub")

    if user_id is None:
        raise credentials_exception

    try:
        user_id_int = int(user_id)
    except ValueError:
        raise credentials_exception

    usuario = db.query(Usuario).filter(Usuario.id == user_id_int).first()

    if usuario is None:
        raise credentials_exception

    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario desactivado. Contacte al administrador"
        )

    # ✅ NOTA: Ya NO validamos el session_id.
    # El JWT es la única prueba de autenticación.
    # La inactividad se controla desde el frontend (login_app.js).

    return usuario


def get_current_active_user(
    current_user: Usuario = Depends(get_current_user)
) -> Usuario:
    if not current_user.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario desactivado. Contacte al administrador"
        )
    return current_user


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[Usuario]:
    if not credentials:
        return None

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    try:
        user_id_int = int(user_id)
    except ValueError:
        return None

    usuario = db.query(Usuario).filter(Usuario.id == user_id_int).first()

    if not usuario or not usuario.activo:
        return None

    return usuario


# =========================
# DEPENDENCIAS DE ROLES Y CARGOS
# =========================

def check_role(allowed_roles: list, required_permission: Optional[str] = None):
    """
    Dependencia general para verificar roles.
    Si se especifica 'required_permission', también permite el paso si el cargo del usuario tiene ese permiso.
    """
    async def role_checker(
        current_user: Usuario = Depends(get_current_active_user),
        db: Session = Depends(get_db)
    ) -> Usuario:
        
        # 1. Validar por Rol permitido
        if current_user.rol_id in allowed_roles:
            return current_user

        # 2. Validar por Permiso del Cargo
        if required_permission and current_user.cargo_id:
            cargo = db.query(Cargo).filter(Cargo.id == current_user.cargo_id).first()
            
            if cargo and cargo.permisos:
                permisos = [p.strip().lower() for p in cargo.permisos.split(',')]
                if required_permission.lower() in permisos:
                    return current_user

        # 3. Si no cumple ninguna, bloqueamos
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos suficientes para acceder a este módulo."
        )
    return role_checker


def check_admin():
    """Exclusivo para Administradores (Rol 3)"""
    return check_role([3])


def check_supervisor():
    """Exclusivo para Supervisores y Administradores (Rol 2 y 3)"""
    return check_role([2, 3])


def check_roles(roles: list):
    return check_role(roles)


# =========================
# DEPENDENCIAS ESPECÍFICAS DE MÓDULOS
# =========================

def check_auditoria_interna():
    """
    Auditoría Interna: Exclusivo Admin (3) y Supervisor (2).
    Ningún cargo puede acceder a este módulo.
    """
    return check_role([2, 3])


def check_auditoria_producto():
    """
    Auditoría Producto: Admin (3), Supervisor (2), o cargos con permiso explícito "auditoria_producto"
    """
    return check_role([2, 3], required_permission="auditoria_producto")


# =========================
# DEPENDENCIAS DE PERMISOS
# =========================

def check_user_ownership(user_id_param: str = "usuario_id"):
    """
    Dependencia para verificar que el usuario sea propietario del recurso
    """
    async def ownership_checker(
        current_user: Usuario = Depends(get_current_active_user),
        **kwargs
    ) -> Usuario:
        target_user_id = kwargs.get(user_id_param)

        if not target_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Parámetro '{user_id_param}' no encontrado"
            )

        if current_user.rol_id in [2, 3]:
            return current_user

        if current_user.id != target_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para acceder a este recurso"
            )

        return current_user
    return ownership_checker


# =========================
# DEPENDENCIA DE TOKEN
# =========================

def get_token_data(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


# =========================
# CONSTANTES DE ROLES
# =========================

class Roles:
    USUARIO = 1
    SUPERVISOR = 2
    ADMIN = 3

    @classmethod
    def get_all(cls) -> list:
        return [cls.USUARIO, cls.SUPERVISOR, cls.ADMIN]

    @classmethod
    def get_admin_roles(cls) -> list:
        return [cls.ADMIN]

    @classmethod
    def get_supervisor_roles(cls) -> list:
        return [cls.SUPERVISOR, cls.ADMIN]

    @classmethod
    def get_name(cls, role_id: int) -> str:
        names = {
            cls.USUARIO: "Usuario",
            cls.SUPERVISOR: "Supervisor",
            cls.ADMIN: "Administrador"
        }
        return names.get(role_id, "Desconocido")