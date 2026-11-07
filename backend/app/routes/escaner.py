from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database.connection import SessionLocal
from app.models.produccion import Produccion
from app.schemas.produccion import ProduccionResponse

router = APIRouter(
    prefix="/escaner",
    tags=["Escáner Global"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/buscar/{codigo_escaneado}", response_model=ProduccionResponse)
def buscar_lote_por_codigo(codigo_escaneado: str, db: Session = Depends(get_db)):
    """
    Endpoint centralizado para el escáner.
    Puede buscar por código de lote (ej. 20261027A1002) o por ticket (ej. 05-003104461).
    """
    codigo_limpio = codigo_escaneado.strip()
    
    # Buscamos en la tabla de Producción
    produccion = db.query(Produccion).filter(
        or_(
            Produccion.codigo_lote == codigo_limpio,
            Produccion.ticket_carga == codigo_limpio
        )
    ).first()

    if not produccion:
        raise HTTPException(
            status_code=404, 
            detail=f"No se encontró ningún lote o ticket con el código: {codigo_limpio}"
        )
    
    return produccion