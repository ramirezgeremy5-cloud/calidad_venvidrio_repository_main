from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProduccionCreate(BaseModel):
    codigo_lote: str
    linea_produccion: str
    tipo_producto: str
    cantidad: int
    operador: str
    turno: str
    observaciones: Optional[str] = None


class ProduccionResponse(BaseModel):
    id: int
    codigo_lote: str
    linea_produccion: str
    tipo_producto: str
    cantidad: int
    operador: str
    turno: str
    observaciones: Optional[str]
    fecha_registro: datetime

    class Config:
        from_attributes = True