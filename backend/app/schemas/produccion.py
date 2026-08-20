# app/schemas/produccion.py
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# --- Base de Producción ---
class ProduccionBase(BaseModel):
    codigo_lote: str
    linea_produccion: str
    tipo_producto: str
    cantidad: int
    operador: str
    turno: str
    observaciones: Optional[str] = None
    fecha_produccion: Optional[datetime] = None
    
    # CAMBIOS: 
    # - cliente_id eliminado, ahora es cliente (texto libre)
    cliente: Optional[str] = None
    molde: Optional[str] = None
    item: Optional[str] = None

    # NUEVOS CAMPOS:
    paletas: Optional[int] = None
    gruesas: Optional[float] = None

# --- Creación ---
class ProduccionCreate(ProduccionBase):
    pass

# --- Actualización ---
class ProduccionUpdate(ProduccionBase):
    codigo_lote: Optional[str] = None
    linea_produccion: Optional[str] = None
    tipo_producto: Optional[str] = None
    cantidad: Optional[int] = None
    operador: Optional[str] = None
    turno: Optional[str] = None
    observaciones: Optional[str] = None
    fecha_produccion: Optional[datetime] = None
    cliente: Optional[str] = None
    molde: Optional[str] = None
    item: Optional[str] = None
    paletas: Optional[int] = None
    gruesas: Optional[float] = None

# --- Respuesta ---
class ProduccionResponse(ProduccionBase):
    id: int
    fecha_registro: datetime
    fecha_actualizacion: datetime

    class Config:
        from_attributes = True