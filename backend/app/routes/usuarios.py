from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.database.connection import SessionLocal
from app.models.usuario import Usuario
from app.schemas.usuario import (
    UsuarioCreate, 
    UsuarioResponse, 
    UsuarioUpdate,
    UsuarioLogin,
    CambioPassword,
    Token
)
from app.dependencies.security import hash_password, verify_password, create_access_token, decode_access_token
from app.dependencies.auth import get_current_user, get_current_active_user, check_role

router = APIRouter(
    prefix="/usuarios",
    tags=["Usuarios"]
)

# =========================
# CONEXIÓN A LA BASE DE DATOS
# =========================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# =========================
# LISTAR USUARIOS
# =========================
@router.get(
    "/",
    response_model=list[UsuarioResponse]
)
def listar_usuarios(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_role([1, 2]))  # Solo admin y super admin
):
    """
    Listar todos los usuarios (requiere rol admin o super admin)
    """
    usuarios = db.query(Usuario).offset(skip).limit(limit).all()
    return usuarios

# =========================
# OBTENER USUARIO POR ID
# =========================
@router.get(
    "/{usuario_id}",
    response_model=UsuarioResponse
)
def obtener_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    """
    Obtener usuario por ID
    """
    # Solo admin puede ver otros usuarios
    if current_user.id != usuario_id and current_user.rol_id not in [1, 2]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para ver este usuario"
        )
    
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    return usuario

# =========================
# OBTENER USUARIO ACTUAL
# =========================
@router.get(
    "/me",
    response_model=UsuarioResponse
)
def obtener_usuario_actual(
    current_user: Usuario = Depends(get_current_active_user)
):
    """
    Obtener información del usuario autenticado
    """
    return current_user

# =========================
# CREAR USUARIO
# =========================
@router.post(
    "/",
    response_model=UsuarioResponse,
    status_code=status.HTTP_201_CREATED
)
def crear_usuario(
    usuario: UsuarioCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_role([1, 2]))  # Solo admin
):
    """
    Crear nuevo usuario (requiere rol admin)
    """
    # Verificar si el correo ya existe
    existe = db.query(Usuario).filter(
        Usuario.correo == usuario.correo
    ).first()

    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo ya está registrado"
        )

    # Crear nuevo usuario
    nuevo = Usuario(
        nombre=usuario.nombre,
        correo=usuario.correo,
        password=hash_password(usuario.password),
        rol_id=usuario.rol_id,
        creado_en=datetime.utcnow()
    )

    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    return nuevo

# =========================
# REGISTRO PÚBLICO (Self-register)
# =========================
@router.post(
    "/registro",
    response_model=UsuarioResponse,
    status_code=status.HTTP_201_CREATED
)
def registro_publico(
    usuario: UsuarioCreate,
    db: Session = Depends(get_db)
):
    """
    Registro público de usuarios (sin autenticación)
    """
    # Verificar si el correo ya existe
    existe = db.query(Usuario).filter(
        Usuario.correo == usuario.correo
    ).first()

    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo ya está registrado"
        )

    # Crear usuario con rol por defecto (1 = usuario normal)
    nuevo = Usuario(
        nombre=usuario.nombre,
        correo=usuario.correo,
        password=hash_password(usuario.password),
        rol_id=1,  # Rol de usuario normal
        creado_en=datetime.utcnow()
    )

    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    return nuevo

# =========================
# ACTUALIZAR USUARIO
# =========================
@router.put(
    "/{usuario_id}",
    response_model=UsuarioResponse
)
def actualizar_usuario(
    usuario_id: int,
    usuario_data: UsuarioUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    """
    Actualizar usuario (solo el propio usuario o admin)
    """
    # Verificar permisos
    if current_user.id != usuario_id and current_user.rol_id not in [1, 2]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para editar este usuario"
        )

    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    # Actualizar campos
    if usuario_data.nombre is not None:
        usuario.nombre = usuario_data.nombre
    
    if usuario_data.correo is not None:
        # Verificar que el nuevo correo no esté en uso
        existe = db.query(Usuario).filter(
            Usuario.correo == usuario_data.correo,
            Usuario.id != usuario_id
        ).first()
        if existe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El correo ya está registrado por otro usuario"
            )
        usuario.correo = usuario_data.correo
    
    # Solo admin puede cambiar rol y activo
    if current_user.rol_id in [1, 2]:
        if usuario_data.rol_id is not None:
            usuario.rol_id = usuario_data.rol_id
        if usuario_data.activo is not None:
            usuario.activo = usuario_data.activo

    db.commit()
    db.refresh(usuario)

    return usuario

# =========================
# CAMBIAR CONTRASEÑA
# =========================
@router.post(
    "/cambiar-password"
)
def cambiar_password(
    cambio: CambioPassword,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    """
    Cambiar contraseña del usuario autenticado
    """
    # Verificar contraseña actual
    if not verify_password(cambio.password_actual, current_user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña actual incorrecta"
        )

    # Actualizar contraseña
    current_user.password = hash_password(cambio.password_nueva)
    db.commit()

    return {
        "success": True,
        "message": "Contraseña actualizada exitosamente"
    }

# =========================
# DESACTIVAR USUARIO (Admin)
# =========================
@router.patch(
    "/{usuario_id}/desactivar"
)
def desactivar_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_role([1, 2]))  # Solo admin
):
    """
    Desactivar usuario (requiere rol admin)
    """
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    if usuario.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes desactivarte a ti mismo"
        )

    usuario.activo = False
    db.commit()

    return {
        "success": True,
        "message": f"Usuario {usuario.nombre} desactivado"
    }

# =========================
# ACTIVAR USUARIO (Admin)
# =========================
@router.patch(
    "/{usuario_id}/activar"
)
def activar_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_role([1, 2]))  # Solo admin
):
    """
    Activar usuario (requiere rol admin)
    """
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    usuario.activo = True
    db.commit()

    return {
        "success": True,
        "message": f"Usuario {usuario.nombre} activado"
    }

# =========================
# ELIMINAR USUARIO (Admin)
# =========================
@router.delete(
    "/{usuario_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def eliminar_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_role([1]))  # Solo super admin
):
    """
    Eliminar usuario permanentemente (requiere super admin)
    """
    if current_user.id == usuario_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes eliminarte a ti mismo"
        )

    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    db.delete(usuario)
    db.commit()

    return None

# =========================
# ENDPOINTS DE AUTENTICACIÓN (Login/Logout)
# =========================

# Login
@router.post("/login", response_model=Token)
def login(
    login_data: UsuarioLogin,
    db: Session = Depends(get_db)
):
    """
    Iniciar sesión con correo y contraseña
    """
    # Buscar usuario por correo
    usuario = db.query(Usuario).filter(
        Usuario.correo == login_data.correo
    ).first()
    
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas"
        )
    
    # Verificar si usuario está bloqueado
    if usuario.bloqueado_hasta and usuario.bloqueado_hasta > datetime.utcnow():
        minutos = int((usuario.bloqueado_hasta - datetime.utcnow()).seconds / 60)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Usuario bloqueado. Intente en {minutos} minutos"
        )
    
    # Verificar si usuario está activo
    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario desactivado. Contacte al administrador"
        )
    
    # Verificar contraseña
    if not verify_password(login_data.password, usuario.password):
        # Incrementar intentos fallidos
        usuario.intentos_fallidos += 1
        
        # Bloquear después de 5 intentos fallidos
        if usuario.intentos_fallidos >= 5:
            usuario.bloqueado_hasta = datetime.utcnow() + timedelta(minutes=30)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Demasiados intentos. Usuario bloqueado por 30 minutos"
            )
        
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas"
        )
    
    # Login exitoso - Resetear intentos fallidos
    usuario.intentos_fallidos = 0
    usuario.bloqueado_hasta = None
    usuario.ultimo_login = datetime.utcnow()
    db.commit()
    
    # Crear token JWT
    token_data = {
        "sub": str(usuario.id),
        "correo": usuario.correo,
        "rol": usuario.rol_id
    }
    access_token = create_access_token(token_data)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "usuario": usuario
    }

# Logout
@router.post("/logout")
def logout(
    current_user: Usuario = Depends(get_current_active_user)
):
    """
    Cerrar sesión (el cliente debe eliminar el token)
    """
    return {
        "success": True,
        "message": "Sesión cerrada exitosamente"
    }

# =========================
# RECUPERAR CONTRASEÑA (Opcional)
# =========================

@router.post("/recuperar-password")
def solicitar_recuperacion(
    correo: str,
    db: Session = Depends(get_db)
):
    """
    Solicitar recuperación de contraseña
    """
    usuario = db.query(Usuario).filter(Usuario.correo == correo).first()
    if not usuario:
        # No revelar si el correo existe o no (seguridad)
        return {
            "success": True,
            "message": "Si el correo existe, recibirás instrucciones para recuperar tu contraseña"
        }
    
    # Generar token de recuperación
    token = create_access_token(
        data={"sub": str(usuario.id), "type": "password_reset"},
        expires_delta=timedelta(hours=24)
    )
    
    # Guardar token en la base de datos
    usuario.token_recuperacion = token
    usuario.token_expiracion = datetime.utcnow() + timedelta(hours=24)
    db.commit()
    
    # Enviar email con el token (implementar después)
    # send_password_reset_email(usuario.correo, token)
    
    return {
        "success": True,
        "message": "Se han enviado instrucciones a tu correo electrónico"
    }

@router.post("/restablecer-password")
def restablecer_password(
    token: str,
    nueva_password: str,
    db: Session = Depends(get_db)
):
    """
    Restablecer contraseña con token de recuperación
    """
    # Validar token
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido o expirado"
        )
    
    usuario_id = payload.get("sub")
    if not usuario_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido"
        )
    
    usuario = db.query(Usuario).filter(Usuario.id == int(usuario_id)).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # Verificar que el token coincida y no haya expirado
    if usuario.token_recuperacion != token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido"
        )
    
    if usuario.token_expiracion and usuario.token_expiracion < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token expirado"
        )
    
    # Actualizar contraseña
    usuario.password = hash_password(nueva_password)
    usuario.token_recuperacion = None
    usuario.token_expiracion = None
    db.commit()
    
    return {
        "success": True,
        "message": "Contraseña actualizada exitosamente"
    }