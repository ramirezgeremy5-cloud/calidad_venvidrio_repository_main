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
    # 👇 QUITAMOS defectos_ids porque no existe en el modelo
    # defectos_ids: Optional[List[int]] = None


class AuditoriaProductoCreate(AuditoriaProductoBase):
    """Esquema para crear una auditoría de producto."""
    pass


class AuditoriaProductoResponse(AuditoriaProductoBase):
    """Esquema para devolver una auditoría de producto con sus IDs."""
    id: int
    fecha_registro: datetime
    # fecha_actualizacion: Optional[datetime] = None  # Omitido si no existe en el modelo
    auditor_id: Optional[int] = None
    auditor_nombre: Optional[str] = None

    class Config:
        from_attributes = True