from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import SessionLocal
from app.models.produccion import Produccion
from app.schemas.produccion import (
    ProduccionCreate,
    ProduccionUpdate,
    ProduccionResponse
)

router = APIRouter(
    prefix="/produccion",
    tags=["Producción"]
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
# LISTAR TODAS LAS PRODUCCIONES
# =========================
@router.get(
    "/",
    response_model=list[ProduccionResponse]
)
def listar_produccion(
    db: Session = Depends(get_db)
):
    return db.query(Produccion).all()


# =========================
# OBTENER UNA PRODUCCIÓN
# =========================
@router.get(
    "/{produccion_id}",
    response_model=ProduccionResponse
)
def obtener_produccion(
    produccion_id: int,
    db: Session = Depends(get_db)
):
    produccion = db.query(Produccion).filter(
        Produccion.id == produccion_id
    ).first()

    if not produccion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producción no encontrada."
        )

    return produccion


# =========================
# CREAR PRODUCCIÓN
# =========================
@router.post(
    "/",
    response_model=ProduccionResponse,
    status_code=status.HTTP_201_CREATED
)
def crear_produccion(
    datos: ProduccionCreate,
    db: Session = Depends(get_db)
):

    existe = db.query(Produccion).filter(
        Produccion.codigo_lote == datos.codigo_lote
    ).first()

    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código de lote ya existe."
        )

    nueva = Produccion(
        codigo_lote=datos.codigo_lote,
        linea_produccion=datos.linea_produccion,
        tipo_producto=datos.tipo_producto,
        cantidad=datos.cantidad,
        operador=datos.operador,
        turno=datos.turno,
        observaciones=datos.observaciones
    )

    db.add(nueva)
    db.commit()
    db.refresh(nueva)

    return nueva


# =========================
# ACTUALIZAR PRODUCCIÓN
# =========================
@router.put(
    "/{produccion_id}",
    response_model=ProduccionResponse
)
def actualizar_produccion(
    produccion_id: int,
    datos: ProduccionUpdate,
    db: Session = Depends(get_db)
):

    produccion = db.query(Produccion).filter(
        Produccion.id == produccion_id
    ).first()

    if not produccion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producción no encontrada."
        )

    existe = db.query(Produccion).filter(
        Produccion.codigo_lote == datos.codigo_lote,
        Produccion.id != produccion_id
    ).first()

    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código de lote ya existe."
        )

    produccion.codigo_lote = datos.codigo_lote
    produccion.linea_produccion = datos.linea_produccion
    produccion.tipo_producto = datos.tipo_producto
    produccion.cantidad = datos.cantidad
    produccion.operador = datos.operador
    produccion.turno = datos.turno
    produccion.observaciones = datos.observaciones

    db.commit()
    db.refresh(produccion)

    return produccion


# =========================
# ELIMINAR PRODUCCIÓN
# =========================
@router.delete(
    "/{produccion_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def eliminar_produccion(
    produccion_id: int,
    db: Session = Depends(get_db)
):

    produccion = db.query(Produccion).filter(
        Produccion.id == produccion_id
    ).first()

    if not produccion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producción no encontrada."
        )

    db.delete(produccion)
    db.commit()

    return None