from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from datetime import datetime
import os
import uuid

from app.models.usuario import Usuario
from app.models.cargo import Cargo
from app.schemas.usuario import (
    UsuarioCreate,
    UsuarioResponse,
    UsuarioUpdate,
    UsuarioLogin,
    CambioPassword,
    Token
)
from app.dependencies.security import hash_password, verify_password
from app.dependencies.auth import (
    get_db,
    get_current_user,
    get_current_active_user,
    check_role
)

router = APIRouter(
    prefix="/usuarios",
    tags=["Usuarios"]
)

# =========================
# SUBIR FOTO DE PERFIL
# =========================
@router.post("/upload-foto")
def subir_foto(
    file: UploadFile = File(...),
    current_user: Usuario = Depends(get_current_active_user)  # 👈 Cualquier usuario logueado
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "El archivo debe ser una imagen")
    
    # Crear la carpeta si no existe
    os.makedirs("app/static/uploads", exist_ok=True)
    
    ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = f"app/static/uploads/{filename}"
    
    with open(filepath, "wb") as buffer:
        buffer.write(file.file.read())
        
    return {"url": f"/static/uploads/{filename}"}


# =========================
# LISTAR USUARIOS (Supervisor y Admin)
# =========================
@router.get("/", response_model=list[UsuarioResponse])
def listar_usuarios(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_role([2, 3]))
):
    usuarios = db.query(Usuario).offset(skip).limit(limit).all()
    return usuarios


# =========================
# OBTENER USUARIO ACTUAL
# =========================
@router.get("/me", response_model=UsuarioResponse)
def obtener_usuario_actual(
    current_user: Usuario = Depends(get_current_active_user)
):
    return current_user


# =========================
# OBTENER USUARIO POR ID
# =========================
@router.get("/{usuario_id}", response_model=UsuarioResponse)
def obtener_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    if current_user.id != usuario_id and current_user.rol_id not in [2, 3]:
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
# CREAR USUARIO (Supervisor y Admin)
# =========================
@router.post("/", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
def crear_usuario(
    usuario: UsuarioCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_role([2, 3]))
):
    existe = db.query(Usuario).filter(Usuario.correo == usuario.correo).first()
    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo ya está registrado"
        )
        
    if usuario.cedula:
        existe_cedula = db.query(Usuario).filter(Usuario.cedula == usuario.cedula).first()
        if existe_cedula:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La cédula ya está registrada"
            )

    if current_user.rol_id == 2 and usuario.rol_id == 3:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un Administrador puede crear otros Administradores"
        )

    cargo_id_final = getattr(usuario, "cargo_id", None)
    if cargo_id_final:
        cargo = db.query(Cargo).filter(Cargo.id == cargo_id_final).first()
        if not cargo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El cargo indicado no existe"
            )

    turno_final = getattr(usuario, "turno", None)
    if turno_final == "": turno_final = None

    nuevo = Usuario(
        nombre=usuario.nombre,
        cedula=usuario.cedula,
        correo=usuario.correo,
        password=hash_password(usuario.password),
        rol_id=usuario.rol_id,
        activo=True,
        creado_en=datetime.utcnow(),
        cargo_id=cargo_id_final,
        turno=turno_final,
        fecha_ingreso=usuario.fecha_ingreso,
        fecha_nacimiento=usuario.fecha_nacimiento,
        foto_url=usuario.foto_url
    )

    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    return nuevo


# =========================
# ACTUALIZAR USUARIO
# =========================
@router.put("/{usuario_id}", response_model=UsuarioResponse)
def actualizar_usuario(
    usuario_id: int,
    usuario_data: UsuarioUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)  # 👈 Cualquier usuario logueado
):
    # 👇 VALIDACIÓN CLAVE: Solo el mismo usuario o un admin/supervisor puede editar
    if current_user.id != usuario_id and current_user.rol_id not in [2, 3]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para editar este usuario"
        )

    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    if current_user.rol_id == 2 and usuario.rol_id == 3:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un Administrador puede editar a otro Administrador"
        )

    if usuario_data.nombre is not None:
        usuario.nombre = usuario_data.nombre

    if usuario_data.correo is not None:
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

    if usuario_data.cedula is not None:
        if usuario_data.cedula != usuario.cedula:
            existe_cedula = db.query(Usuario).filter(
                Usuario.cedula == usuario_data.cedula,
                Usuario.id != usuario_id
            ).first()
            if existe_cedula:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La cédula ya está registrada por otro usuario"
                )
        usuario.cedula = usuario_data.cedula

    if current_user.rol_id == 3:
        if usuario_data.rol_id is not None:
            usuario.rol_id = usuario_data.rol_id
        if usuario_data.activo is not None:
            usuario.activo = usuario_data.activo
            if usuario_data.activo is False:
                usuario.session_id = None
                usuario.ultima_actividad = None
    else:
        if usuario_data.rol_id is not None and usuario_data.rol_id != usuario.rol_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo un Administrador puede cambiar el rol de un usuario"
            )

    cargo_id_actual = getattr(usuario_data, "cargo_id", None)
    if cargo_id_actual is not None:
        if cargo_id_actual == 0:
            usuario.cargo_id = None
        else:
            cargo = db.query(Cargo).filter(Cargo.id == cargo_id_actual).first()
            if not cargo:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El cargo indicado no existe"
                )
            usuario.cargo_id = cargo_id_actual

    if usuario_data.turno is not None:
        usuario.turno = usuario_data.turno
        
    if usuario_data.fecha_ingreso is not None:
        usuario.fecha_ingreso = usuario_data.fecha_ingreso
    if usuario_data.fecha_nacimiento is not None:
        usuario.fecha_nacimiento = usuario_data.fecha_nacimiento
    if usuario_data.foto_url is not None:
        usuario.foto_url = usuario_data.foto_url

    db.commit()
    db.refresh(usuario)

    return usuario


# =========================
# CAMBIAR CONTRASEÑA
# =========================
@router.post("/cambiar-password")
def cambiar_password(
    cambio: CambioPassword,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    if not verify_password(cambio.password_actual, current_user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña actual incorrecta"
        )

    current_user.password = hash_password(cambio.password_nueva)
    db.commit()

    return {
        "success": True,
        "message": "Contraseña actualizada exitosamente"
    }


# =========================
# DESACTIVAR USUARIO (Supervisor y Admin)
# =========================
@router.patch("/{usuario_id}/desactivar")
def desactivar_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_role([2, 3]))
):
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

    if current_user.rol_id == 2 and usuario.rol_id == 3:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un Administrador puede desactivar a otro Administrador"
        )

    usuario.activo = False
    usuario.session_id = None
    usuario.ultima_actividad = None
    db.commit()

    return {
        "success": True,
        "message": f"Usuario {usuario.nombre} desactivado"
    }


# =========================
# ACTIVAR USUARIO (Supervisor y Admin)
# =========================
@router.patch("/{usuario_id}/activar")
def activar_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_role([2, 3]))
):
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
# ELIMINAR USUARIO (SOLO ADMIN)
# =========================
@router.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_role([3]))
):
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