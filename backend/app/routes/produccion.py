from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import SessionLocal
from app.models.produccion import Produccion
from app.schemas.produccion import ProduccionCreate, ProduccionResponse


router = APIRouter(
    prefix="/produccion",
    tags=["Producción"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=ProduccionResponse)
def crear_produccion(
    datos: ProduccionCreate,
    db: Session = Depends(get_db)
):
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