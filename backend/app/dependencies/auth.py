from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional

from app.database.connection import SessionLocal
from app.models.usuario import Usuario
from app.dependencies.security import decode_access_token, verify_token

security = HTTPBearer()

# Tiempo de inactividad permitido antes de expirar la sesión (debe coincidir con auth.py)
TIEMPO_INACTIVIDAD_MINUTOS = 4


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
# HELPERS INTERNOS
# =========================

def _validar_sesion_y_actividad(usuario: Usuario, sid: Optional[str], db: Session) -> None:
    """
    Valida que:
      1. El sid del token coincida con el session_id en BD
      2. No hayan pasado más de TIEMPO_INACTIVIDAD_MINUTOS desde ultima_actividad
      3. Renueva ultima_actividad (sliding window)

    Lanza HTTPException 401 si algo falla.
    """
    # 1) Validar sid contra session_id en BD
    if not sid or usuario.session_id != sid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión cerrada o reemplazada. Inicie sesión nuevamente.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2) Validar expiración por inactividad
    ultima = usuario.ultima_actividad
    if ultima:
        try:
            ultima_dt = datetime.fromisoformat(ultima) if isinstance(ultima, str) else ultima
            if datetime.utcnow() - ultima_dt > timedelta(minutes=TIEMPO_INACTIVIDAD_MINUTOS):
                # Liberar sesión expirada
                usuario.session_id = None
                usuario.ultima_actividad = None
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Sesión expirada por inactividad. Inicie sesión nuevamente.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        except (ValueError, TypeError):
            # Si el campo no se puede parsear, no bloqueamos al usuario
            pass

    # 3) Renovar ultima_actividad (sliding window)
    usuario.ultima_actividad = datetime.utcnow().isoformat()
    db.commit()


# =========================
# DEPENDENCIAS DE AUTENTICACIÓN
# =========================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Usuario:
    """
    Obtener usuario actual desde el token JWT

    Valida:
      - Firma y expiración del JWT
      - Que el usuario exista y esté activo
      - Que el sid del token coincida con el session_id en BD
      - Que no haya expirado por inactividad (>4 min)
      - Renueva ultima_actividad en cada request (sliding window)
    """
    token = credentials.credentials

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Decodificar token
    payload = decode_access_token(token)

    if payload is None:
        raise credentials_exception

    # Obtener ID y sid del usuario desde el token
    user_id = payload.get("sub")
    sid = payload.get("sid")

    if user_id is None:
        raise credentials_exception

    # Buscar usuario en la base de datos
    try:
        user_id_int = int(user_id)
    except ValueError:
        raise credentials_exception

    usuario = db.query(Usuario).filter(
        Usuario.id == user_id_int
    ).first()

    if usuario is None:
        raise credentials_exception

    # Verificar si el usuario está activo
    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario desactivado. Contacte al administrador"
        )

    # Validar sesión (sid + inactividad + renovar ultima_actividad)
    _validar_sesion_y_actividad(usuario, sid, db)

    return usuario


def get_current_active_user(
    current_user: Usuario = Depends(get_current_user)
) -> Usuario:
    """
    Obtener usuario activo actual

    Esta dependencia verifica que el usuario esté activo.
    """
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
    """
    Obtener usuario actual opcionalmente (sin requerir autenticación)

    Retorna None si no hay token válido, si la sesión expiró,
    o si el sid no coincide con la BD.
    """
    if not credentials:
        return None

    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload:
        return None

    user_id = payload.get("sub")
    sid = payload.get("sid")

    if not user_id:
        return None

    try:
        user_id_int = int(user_id)
    except ValueError:
        return None

    usuario = db.query(Usuario).filter(
        Usuario.id == user_id_int
    ).first()

    if not usuario or not usuario.activo:
        return None

    # Validar sesión e inactividad (silencioso: si falla, devolvemos None)
    try:
        _validar_sesion_y_actividad(usuario, sid, db)
    except HTTPException:
        return None

    return usuario


# =========================
# DEPENDENCIAS DE ROLES
# =========================

def check_role(allowed_roles: list):
    """
    Dependencia para verificar roles de usuario

    Args:
        allowed_roles: Lista de roles permitidos (ej: [1, 2])

    Returns:
        Función que verifica el rol del usuario autenticado

    Uso:
        @router.get("/admin")
        def admin_only(current_user: Usuario = Depends(check_role([1, 2]))):
            return {"message": "Solo admin"}
    """
    async def role_checker(
        current_user: Usuario = Depends(get_current_active_user)
    ) -> Usuario:
        if current_user.rol_id not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No tienes permisos para esta acción. Roles permitidos: {allowed_roles}"
            )
        return current_user
    return role_checker


def check_admin():
    """
    Dependencia para verificar que el usuario sea administrador (rol 3)

    Uso:
        @router.get("/admin")
        def admin_only(current_user: Usuario = Depends(check_admin())):
            return {"message": "Solo admin"}
    """
    return check_role([3])


def check_supervisor():
    """
    Dependencia para verificar que el usuario sea supervisor o admin (rol 2 o 3)

    Uso:
        @router.get("/super-admin")
        def super_admin_only(current_user: Usuario = Depends(check_supervisor())):
            return {"message": "Solo supervisor/admin"}
    """
    return check_role([2, 3])


def check_roles(roles: list):
    """
    Dependencia para verificar roles específicos

    Args:
        roles: Lista de roles permitidos

    Uso:
        @router.get("/moderator")
        def moderator_only(current_user: Usuario = Depends(check_roles([1, 2, 3]))):
            return {"message": "Solo moderadores"}
    """
    return check_role(roles)


# =========================
# DEPENDENCIAS DE PERMISOS
# =========================

def check_user_ownership(user_id_param: str = "usuario_id"):
    """
    Dependencia para verificar que el usuario sea propietario del recurso

    Args:
        user_id_param: Nombre del parámetro en la ruta que contiene el ID del usuario

    Uso:
        @router.get("/usuario/{usuario_id}")
        def get_usuario(
            usuario_id: int,
            current_user: Usuario = Depends(check_user_ownership("usuario_id"))
        ):
            return {"message": "Tu propio perfil"}
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

        # Si es admin o supervisor, puede acceder a cualquier usuario
        if current_user.rol_id in [2, 3]:
            return current_user

        # Si no es admin, solo puede acceder a su propio perfil
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
    """
    Obtener datos del token JWT sin verificar usuario en BD

    Útil para validar tokens sin hacer consultas a la base de datos.
    OJO: No valida session_id ni inactividad. Solo firma y expiración del JWT.
    """
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
    """Constantes para roles de usuario"""
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