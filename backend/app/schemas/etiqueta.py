from pydantic import BaseModel
from datetime import datetime


class EtiquetaBase(BaseModel):
    codigo_etiqueta: str
    codigo_lote: str
    cliente: str
    producto: str
    cantidad: int
    estado: str
    observaciones: str | None = None


class EtiquetaCreate(EtiquetaBase):
    pass


class EtiquetaResponse(EtiquetaBase):
    id: int
    fecha_registro: datetime
    fecha_actualizacion: datetime

    class Config:
        from_attributes = True