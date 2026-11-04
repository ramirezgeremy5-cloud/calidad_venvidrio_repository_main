from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.connection import SessionLocal
from app.models.produccion import Produccion
from app.schemas.produccion import EtiquetaResponse

router = APIRouter(
    prefix="/produccion",
    tags=["Etiquetas"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/lote/{codigo_lote}", response_model=EtiquetaResponse)
def obtener_lote_para_etiqueta(codigo_lote: str, db: Session = Depends(get_db)):
    """
    Busca un lote específico por su código para generar la etiqueta.
    """
    codigo_buscar = codigo_lote.strip().upper()
    
    lote = db.query(Produccion).filter(Produccion.codigo_lote == codigo_buscar).first()
    
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado en la base de datos")
    
    return {
        "planta": lote.planta,
        "ticket_carga": lote.ticket_carga,
        "cliente": lote.cliente,
        "orden": lote.orden,
        "obs_produccion": lote.observaciones,
        "maquina": lote.maquina,
        "turno": lote.turno,
        "grupo": lote.grupo,
        "fecha_produccion": str(lote.fecha_produccion) if lote.fecha_produccion else None,
        "tipo_producto": lote.tipo_producto,
        "acabado": lote.acabado,
        "item": lote.item,
        "bpp": lote.bpp,
        "capacidad": lote.capacidad,
        "molde": lote.molde,
        "codigo_lote": lote.codigo_lote
    }