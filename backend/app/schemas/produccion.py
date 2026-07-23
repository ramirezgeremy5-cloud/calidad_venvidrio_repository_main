from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ==============================
# Schema para crear producción
# ==============================

class ProduccionCreate(BaseModel):
    codigo_lote: str
    linea_produccion: str
    tipo_producto: str
    cantidad: int
    operador: str
    turno: str
    observaciones: Optional[str] = None


# ==============================
# Schema para actualizar producción
# ==============================

class ProduccionUpdate(BaseModel):
    codigo_lote: Optional[str] = None
    linea_produccion: Optional[str] = None
    tipo_producto: Optional[str] = None
    cantidad: Optional[int] = None
    operador: Optional[str] = None
    turno: Optional[str] = None
    observaciones: Optional[str] = None


# ==============================
# Schema de respuesta
# ==============================

class ProduccionResponse(BaseModel):
    id: int
    codigo_lote: str
    linea_produccion: str
    tipo_producto: str
    cantidad: int
    operador: str
    turno: str
    observaciones: Optional[str] = None
    fecha_registro: datetime

    class Config:
        from_attributes = True