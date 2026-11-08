from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func

from app.models.cargo import Cargo
from app.models.usuario import Usuario
from app.schemas.cargo import CargoCreate, CargoResponse, CargoConUso
from app.dependencies.auth import get_db, check_role, check_admin


router = APIRouter(prefix="/cargos", tags=["Cargos"])


# =========================
# LISTAR CARGOS
# =========================
@router.get("/", response_model=list[CargoConUso])
def listar_cargos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_admin()) # 👈 Solo Admin
):
    """
    Lista todos los cargos con su conteo de uso (usuarios asignados).
    """
    cargos = db.query(Cargo).order_by(Cargo.nombre.asc()).all()
    conteo = dict(
        db.query(Usuario.cargo_id, func.count(Usuario.id))
        .filter(Usuario.cargo_id.isnot(None))
        .group_by(Usuario.cargo_id)
        .all()
    )
    return [
        CargoConUso(
            id=c.id,
            nombre=c.nombre,
            permisos=c.permisos or "", # 👈 Incluimos los permisos
            creado_en=c.creado_en,
            uso=conteo.get(c.id, 0)
        )
        for c in cargos
    ]


# =========================
# CREAR CARGO
# =========================
@router.post("/", response_model=CargoResponse, status_code=status.HTTP_201_CREATED)
def crear_cargo(
    payload: CargoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_admin()) # 👈 Solo Admin
):
    nombre = payload.nombre.strip()
    if not nombre:
        raise HTTPException(400, "El nombre del cargo no puede estar vacío")

    existe = db.query(Cargo).filter(func.lower(Cargo.nombre) == nombre.lower()).first()
    if existe:
        raise HTTPException(400, "Ya existe un cargo con ese nombre")

    nuevo = Cargo(
        nombre=nombre,
        permisos=payload.permisos or "" # 👈 Guardamos los permisos
    )
    db.add(nuevo)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, "El cargo ya existe")
    db.refresh(nuevo)
    return nuevo


# =========================
# ACTUALIZAR CARGO (NUEVO)
# =========================
@router.put("/{cargo_id}", response_model=CargoResponse)
def actualizar_cargo(
    cargo_id: int,
    payload: CargoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_admin())
):
    cargo = db.query(Cargo).filter(Cargo.id == cargo_id).first()
    if not cargo:
        raise HTTPException(404, "Cargo no encontrado")

    nombre = payload.nombre.strip()
    if not nombre:
        raise HTTPException(400, "El nombre del cargo no puede estar vacío")

    # Validar que no exista otro cargo con ese nombre
    existe = db.query(Cargo).filter(
        func.lower(Cargo.nombre) == nombre.lower(),
        Cargo.id != cargo_id
    ).first()
    if existe:
        raise HTTPException(400, "Ya existe otro cargo con ese nombre")

    cargo.nombre = nombre
    cargo.permisos = payload.permisos or "" # 👈 Actualizamos los permisos
    db.commit()
    db.refresh(cargo)
    return cargo


# =========================
# ELIMINAR CARGO
# =========================
@router.delete("/{cargo_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_cargo(
    cargo_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_admin()) # 👈 Solo Admin
):
    cargo = db.query(Cargo).filter(Cargo.id == cargo_id).first()
    if not cargo:
        raise HTTPException(404, "Cargo no encontrado")

    asignados = db.query(Usuario).filter(Usuario.cargo_id == cargo_id).count()
    if asignados > 0:
        raise HTTPException(
            400,
            f"No se puede eliminar: {asignados} usuario(s) tienen este cargo asignado. "
            f"Reasígnalos primero."
        )

    db.delete(cargo)
    db.commit()
    return None