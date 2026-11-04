from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from datetime import datetime
import os
import uuid
import requests # 👈 Importamos requests para la subida directa

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
# CONFIGURACIÓN DE SUPABASE STORAGE (DIRECTA)
# =========================
SUPABASE_URL = os.getenv("SUPABASE_URL")  # Debe ser: https://rxoiedlrtoumeflqkbzb.supabase.co
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

print("==========================================")
print("🔍 DIAGNÓSTICO DE SUPABASE STORAGE (HTTP DIRECTO)")
print(f"URL configurada: {SUPABASE_URL}")
print(f"KEY configurada: {'SÍ' if SUPABASE_KEY else 'NO'}")
print("==========================================")


# =========================
# SUBIR FOTO DE PERFIL (HTTP DIRECTO)
# =========================
@router.post("/upload-foto")
def subir_foto(
    file: UploadFile = File(...),
    current_user: Usuario = Depends(get_current_active_user)
):
    print("📤 [UPLOAD] Iniciando subida de foto (HTTP directo)...")
    
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "El archivo debe ser una imagen")
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(500, "Servicio de almacenamiento no configurado en el servidor.")
    
    ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    print(f"📤 [UPLOAD] Archivo: {filename}, Tipo: {file.content_type}")
    
    try:
        file_content = file.file.read()
        print(f"📤 [UPLOAD] Tamaño del archivo: {len(file_content)} bytes")
        
        # Construimos la URL de la API de Storage de Supabase
        bucket_name = "avatars"
        upload_url = f"{SUPABASE_URL}/storage/v1/object/{bucket_name}/{filename}"
        
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": file.content_type
        }
        
        # Hacemos la petición POST con requests (fuerza IPv4)
        response = requests.post(upload_url, headers=headers, data=file_content, timeout=30)
        
        if response.status_code not in [200, 201]:
            print(f"❌ ERROR SUPABASE API: {response.status_code} - {response.text}")
            raise HTTPException(500, f"Error de Supabase: {response.text}")
            
        print(f"📤 [UPLOAD] Respuesta de Supabase: {response.status_code}")
        
        # Construimos la URL pública
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket_name}/{filename}"
        print(f"📤 [UPLOAD] URL pública generada: {public_url}")
        
        return {"url": public_url}
        
    except requests.exceptions.RequestException as e:
        print(f"❌ ERROR DE RED (requests): {type(e).__name__} - {str(e)}")
        raise HTTPException(500, f"Error de conexión con Supabase: {str(e)}")
    except Exception as e:
        print(f"❌ ERROR CRÍTICO SUPABASE UPLOAD: {type(e).__name__} - {str(e)}")
        raise HTTPException(500, f"Error al subir a Supabase: {str(e)}")


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
    current_user: Usuario = Depends(get_current_active_user)
):
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