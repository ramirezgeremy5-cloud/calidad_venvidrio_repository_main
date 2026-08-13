from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# ==========================================
# BASE
# ==========================================

class DefectoBase(BaseModel):
    codigo_lote: str
    tipo_producto: Optional[str] = None
    tipo_defecto: str
    clasificacion: str = "Menor"
    cantidad_piezas: int = 1
    zona_deteccion: Optional[str] = None
    inspector: Optional[str] = None
    descripcion: Optional[str] = None
    ubicacion_pieza: Optional[str] = None


# ==========================================
# CREAR
# ==========================================

class DefectoCreate(DefectoBase):
    pass


# ==========================================
# ACTUALIZAR
# ==========================================

class DefectoUpdate(BaseModel):
    codigo_lote: Optional[str] = None
    tipo_producto: Optional[str] = None
    tipo_defecto: Optional[str] = None
    clasificacion: Optional[str] = None
    cantidad_piezas: Optional[int] = None
    zona_deteccion: Optional[str] = None
    inspector: Optional[str] = None
    descripcion: Optional[str] = None
    ubicacion_pieza: Optional[str] = None


# ==========================================
# RESPONSE
# ==========================================

class DefectoResponse(DefectoBase):
    id: int
    fecha_registro: datetime
    fecha_actualizacion: datetime

    class Config:
        from_attributes = True