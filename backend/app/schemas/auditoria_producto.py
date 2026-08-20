from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional, List


# ==========================================
# ESQUEMA PARA LISTAR LOTES PENDIENTES
# ==========================================
class LotePendienteResponse(BaseModel):
    id: int
    codigo_lote: str
    linea_produccion: str
    tipo_producto: str
    item: Optional[str] = None
    fecha_registro: datetime

    class Config:
        from_attributes = True


# ==========================================
# ESQUEMAS DE AUDITORÍA DE PRODUCTO
# ==========================================
class AuditoriaProductoBase(BaseModel):
    produccion_id: int
    fecha_auditoria: date
    paletas_inspeccionadas: int
    paletas_aprobadas: int
    paletas_rechazadas: int
    observaciones: Optional[str] = None
    defectos_ids: Optional[List[int]] = None


class AuditoriaProductoCreate(AuditoriaProductoBase):
    pass


class AuditoriaProductoResponse(AuditoriaProductoBase):
    id: int
    fecha_registro: datetime
    # ✅ Si no existe fecha_actualizacion, lo comentamos o eliminamos
    # fecha_actualizacion: Optional[datetime] = None

    class Config:
        from_attributes = True