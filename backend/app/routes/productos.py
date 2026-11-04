from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database.connection import SessionLocal
from app.models.producto import Producto
from app.schemas.producto import (
    ProductoCreate,
    ProductoUpdate,
    ProductoResponse
)

router = APIRouter(
    prefix="/productos",
    tags=["Productos"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================
# LISTAR PRODUCTOS
# =========================
@router.get("/", response_model=list[ProductoResponse])
@router.get("", response_model=list[ProductoResponse])
def listar_productos(
    buscar: Optional[str] = Query(None),
    activo: Optional[bool] = Query(None),
    skip: int = Query(0),
    limit: int = Query(500),
    db: Session = Depends(get_db)
):
    """Lista productos con filtros opcionales"""
    query = db.query(Producto)

    if buscar:
        query = query.filter(Producto.nombre.ilike(f"%{buscar}%"))
    if activo is not None:
        query = query.filter(Producto.activo == activo)

    query = query.order_by(Producto.nombre.asc())
    return query.offset(skip).limit(limit).all()


# =========================
# CREAR PRODUCTO
# =========================
@router.post("/", response_model=ProductoResponse, status_code=201)
@router.post("", response_model=ProductoResponse, status_code=201)
def crear_producto(datos: ProductoCreate, db: Session = Depends(get_db)):
    """
    Crea un producto. Si ya existe (mismo nombre), lo devuelve con la ficha actualizada.
    """
    nombre = (datos.nombre or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")

    existe = db.query(Producto).filter(Producto.nombre.ilike(nombre)).first()

    if existe:
        # Actualizar ficha técnica si llega info nueva
        if datos.item is not None: existe.item = datos.item
        if datos.acabado is not None: existe.acabado = datos.acabado
        if datos.capacidad_ml is not None: existe.capacidad_ml = datos.capacidad_ml
        if datos.bpp is not None: existe.bpp = datos.bpp
        if datos.bpc is not None: existe.bpc = datos.bpc  # 👈 FALTABA ESTO
        if datos.juego_envases is not None: existe.juego_envases = datos.juego_envases
        if datos.material is not None: existe.material = datos.material
        if datos.tipo_boca is not None: existe.tipo_boca = datos.tipo_boca
        if datos.dimensiones is not None: existe.dimensiones = datos.dimensiones
        db.commit()
        db.refresh(existe)
        return existe

    nuevo = Producto(
        nombre=nombre,
        item=datos.item,
        acabado=datos.acabado,
        capacidad_ml=datos.capacidad_ml,
        bpp=datos.bpp,
        bpc=datos.bpc,  # 👈 FALTABA ESTO
        juego_envases=datos.juego_envases,
        material=datos.material,
        tipo_boca=datos.tipo_boca,
        dimensiones=datos.dimensiones,
        activo=True
    )

    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


# =========================
# OBTENER UN PRODUCTO
# =========================
@router.get("/{producto_id}", response_model=ProductoResponse)
def obtener_producto(producto_id: int, db: Session = Depends(get_db)):
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    return producto


# =========================
# ACTUALIZAR PRODUCTO
# =========================
@router.put("/{producto_id}", response_model=ProductoResponse)
def actualizar_producto(producto_id: int, datos: ProductoUpdate, db: Session = Depends(get_db)):
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")

    # exclude_unset=True solo actualiza los campos que se enviaron en el JSON
    update_data = datos.dict(exclude_unset=True)

    nuevo_nombre = update_data.get('nombre')
    if nuevo_nombre and nuevo_nombre != producto.nombre:
        existe = db.query(Producto).filter(
            Producto.nombre.ilike(nuevo_nombre),
            Producto.id != producto_id
        ).first()
        if existe:
            raise HTTPException(
                status_code=400,
                detail=f"Ya existe un producto con el nombre '{nuevo_nombre}'."
            )

    # Actualizamos todos los campos enviados
    for campo, valor in update_data.items():
        setattr(producto, campo, valor)

    db.commit()
    db.refresh(producto)
    return producto


# =========================
# ELIMINAR PRODUCTO
# =========================
@router.delete("/{producto_id}", status_code=204)
def eliminar_producto(producto_id: int, db: Session = Depends(get_db)):
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    db.delete(producto)
    db.commit()
    return None