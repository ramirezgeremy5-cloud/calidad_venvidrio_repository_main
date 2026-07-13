from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import SessionLocal
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioCreate, UsuarioResponse
from app.core.security import hash_password
from app.dependencies.auth import get_current_user

router = APIRouter(
    prefix="",
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
    "/usuarios",
    response_model=list[UsuarioResponse]
)
def listar_usuarios(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    return db.query(Usuario).all()


# =========================
# CREAR USUARIO
# =========================
@router.post(
    "/usuarios",
    response_model=UsuarioResponse,
    status_code=status.HTTP_201_CREATED
)
def crear_usuario(
    usuario: UsuarioCreate,
    db: Session = Depends(get_db)
):

    existe = db.query(Usuario).filter(
        Usuario.correo == usuario.correo
    ).first()

    if existe:
        raise HTTPException(
            status_code=400,
            detail="El correo ya está registrado."
        )

    nuevo = Usuario(
        nombre=usuario.nombre,
        correo=usuario.correo,
        password=hash_password(usuario.password),
        rol_id=usuario.rol_id
    )

    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    return nuevo