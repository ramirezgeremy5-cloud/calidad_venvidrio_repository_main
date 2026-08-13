from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# ==========================================
# BASE
# ==========================================

class AuditoriaBase(BaseModel):
    tipo_auditoria: str
    area: str
    auditor: str
    norma: str
    observaciones: str | None = None
    cumplimiento: int = 0
    no_conformidades: int = 0
    estado: str = "En proceso"


# ==========================================
# CREAR (el código se genera automáticamente en el backend)
# ==========================================

class AuditoriaCreate(AuditoriaBase):
    codigo: Optional[str] = None  # <-- OPCIONAL, el backend lo genera


# ==========================================
# ACTUALIZAR
# ==========================================

class AuditoriaUpdate(BaseModel):
    codigo: Optional[str] = None
    tipo_auditoria: Optional[str] = None
    area: Optional[str] = None
    auditor: Optional[str] = None
    norma: Optional[str] = None
    observaciones: Optional[str] = None
    cumplimiento: Optional[int] = None
    no_conformidades: Optional[int] = None
    estado: Optional[str] = None


# ==========================================
# RESPUESTA (siempre incluye el código generado)
# ==========================================

class AuditoriaResponse(BaseModel):
    id: int
    codigo: str  # <-- OBLIGATORIO, siempre viene en la respuesta
    tipo_auditoria: str
    area: str
    auditor: str
    norma: str
    observaciones: str | None = None
    cumplimiento: int = 0
    no_conformidades: int = 0
    estado: str = "En proceso"
    fecha_registro: datetime
    fecha_actualizacion: datetime

    class Config:
        from_attributes = True