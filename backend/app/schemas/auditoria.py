from pydantic import BaseModel
from datetime import datetime


class AuditoriaBase(BaseModel):
    tipo_auditoria: str
    area: str
    auditor: str
    norma: str
    observaciones: str | None = None
    cumplimiento: int = 0
    no_conformidades: int = 0
    estado: str = "En proceso"


class AuditoriaCreate(AuditoriaBase):
    pass


class AuditoriaResponse(AuditoriaBase):
    id: int
    fecha_registro: datetime
    fecha_actualizacion: datetime

    class Config:
        from_attributes = True