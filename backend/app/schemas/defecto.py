from pydantic import BaseModel
from datetime import datetime


class DefectoBase(BaseModel):
    codigo_lote: str
    tipo_defecto: str
    clasificacion: str
    cantidad_piezas: int
    zona_deteccion: str
    inspector: str
    descripcion: str | None = None
    ubicacion_pieza: str | None = None


class DefectoCreate(DefectoBase):
    pass


class DefectoResponse(DefectoBase):
    id: int
    fecha_registro: datetime
    fecha_actualizacion: datetime

    class Config:
        from_attributes = True