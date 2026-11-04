from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional

from app.database.connection import SessionLocal
from app.models.cliente import Cliente
from app.schemas.cliente import (
    ClienteCreate,
    ClienteUpdate,
    ClienteResponse
)

router = APIRouter(
    prefix="/clientes",
    tags=["Clientes"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================
# LISTAR CLIENTES
# =========================
@router.get("/", response_model=list[ClienteResponse])
@router.get("", response_model=list[ClienteResponse])
def listar_clientes(
    buscar: Optional[str] = Query(None),
    activo: Optional[bool] = Query(None),
    skip: int = Query(0),
    limit: int = Query(500),
    db: Session = Depends(get_db)
):
    """Lista clientes con filtros opcionales"""
    query = db.query(Cliente)

    if buscar:
        query = query.filter(Cliente.nombre.ilike(f"%{buscar}%"))
    if activo is not None:
        query = query.filter(Cliente.activo == activo)

    query = query.order_by(Cliente.nombre.asc())
    return query.offset(skip).limit(limit).all()


# =========================
# CREAR CLIENTE
# =========================
@router.post("/", response_model=ClienteResponse, status_code=201)
@router.post("", response_model=ClienteResponse, status_code=201)
def crear_cliente(datos: ClienteCreate, db: Session = Depends(get_db)):
    """
    Crea un nuevo cliente. 
    Si ya existe un cliente con el mismo nombre, lo devuelve (evita errores en Producción).
    """
    nombre = (datos.nombre or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")

    # Buscar si ya existe
    existe = db.query(Cliente).filter(Cliente.nombre.ilike(nombre)).first()
    if existe:
        # 🔄 Si existe, devolvemos el cliente con un código 200 para que el JS 
        # entienda que la operación fue exitosa y continúe guardando el lote.
        # (Pydantic usará el response_model para serializarlo correctamente).
        return existe

    nuevo = Cliente(
        nombre=nombre,
        rif=datos.rif,
        direccion=datos.direccion,
        telefono=datos.telefono,
        correo=datos.correo,
        activo=True
    )

    try:
        db.add(nuevo)
        db.commit()
        db.refresh(nuevo)
        return nuevo
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, 
            detail=f"Error al guardar el cliente en la base de datos: {str(e)}"
        )


# =========================
# OBTENER UN CLIENTE
# =========================
@router.get("/{cliente_id}", response_model=ClienteResponse)
def obtener_cliente(cliente_id: int, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    return cliente


# =========================
# ACTUALIZAR CLIENTE
# =========================
@router.put("/{cliente_id}", response_model=ClienteResponse)
def actualizar_cliente(cliente_id: int, datos: ClienteUpdate, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")

    # exclude_unset=True es la forma correcta en Pydantic para actualizaciones parciales
    update_data = datos.dict(exclude_unset=True)

    # Verificar duplicado de nombre (si se está cambiando)
    nuevo_nombre = update_data.get('nombre')
    if nuevo_nombre and nuevo_nombre != cliente.nombre:
        existe = db.query(Cliente).filter(
            Cliente.nombre.ilike(nuevo_nombre),
            Cliente.id != cliente_id
        ).first()
        if existe:
            raise HTTPException(
                status_code=400,
                detail=f"Ya existe un cliente con el nombre '{nuevo_nombre}'."
            )

    # Actualizamos todos los campos enviados (incluso si se envían como None o "")
    for campo, valor in update_data.items():
        setattr(cliente, campo, valor)

    db.commit()
    db.refresh(cliente)
    return cliente


# =========================
# ELIMINAR CLIENTE
# =========================
@router.delete("/{cliente_id}", status_code=204)
def eliminar_cliente(cliente_id: int, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    
    db.delete(cliente)
    db.commit()
    return None