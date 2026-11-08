from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime

class AuditoriaCalidadCreate(BaseModel):
    evaluado_id: int
    periodo: str
    puntaje: float
    categoria: str
    detalles: Optional[str] = None
    observaciones: Optional[str] = None

class AuditoriaCalidadResponse(BaseModel):
    id: int
    evaluado_id: int
    evaluador_id: int
    periodo: str
    puntaje: float
    categoria: str
    observaciones: Optional[str] = None
    fecha: datetime

    # Campos extra para el frontend
    evaluado_nombre: Optional[str] = None
    evaluador_nombre: Optional[str] = None

    class Config:
        from_attributes = True