# app/schemas/inspeccion.py
from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class InspeccionBase(BaseModel):
    fecha: datetime
    maquina: Optional[str] = None
    linea: Optional[str] = None
    cliente: Optional[str] = None
    molde: Optional[str] = None
    acabado: Optional[str] = None
    item: Optional[str] = None
    numero: Optional[str] = None
    ticket: Optional[str] = None
    lote: Optional[str] = None
    turno_grupo: Optional[str] = None
    ok: int = 0
    ret: int = 0
    defectos: Optional[str] = None
    cavidad: Optional[str] = None
    cantidad: int = 0
    paletas_inspeccionadas: int = 0
    paletas_buenas: int = 0
    paletas_retenidas: int = 0
    porcentaje_rechazo: float = 0
    criticos_a: int = 0
    criticos_r: int = 0
    mayores_b_plus_a: int = 0
    mayores_b_plus_r: int = 0
    mayores_b_minus_a: int = 0
    mayores_b_minus_r: int = 0
    menores_a: int = 0
    menores_r: int = 0
    tamano_muestra: Optional[int] = None
    tamano_poblacion: Optional[int] = None
    bot_por_camada: Optional[int] = None
    bot_por_paleta: Optional[int] = None
    gruesas_por_paleta: Optional[int] = None
    observaciones: Optional[str] = None
    responsable_nombre: Optional[str] = None
    responsable_grupo: Optional[str] = None
    firma: Optional[str] = None
    auditoria_id: Optional[int] = None


class InspeccionCreate(InspeccionBase):
    pass


class InspeccionUpdate(BaseModel):
    fecha: Optional[datetime] = None
    maquina: Optional[str] = None
    linea: Optional[str] = None
    cliente: Optional[str] = None
    molde: Optional[str] = None
    acabado: Optional[str] = None
    item: Optional[str] = None
    numero: Optional[str] = None
    ticket: Optional[str] = None
    lote: Optional[str] = None
    turno_grupo: Optional[str] = None
    ok: Optional[int] = None
    ret: Optional[int] = None
    defectos: Optional[str] = None
    cavidad: Optional[str] = None
    cantidad: Optional[int] = None
    paletas_inspeccionadas: Optional[int] = None
    paletas_buenas: Optional[int] = None
    paletas_retenidas: Optional[int] = None
    porcentaje_rechazo: Optional[float] = None
    criticos_a: Optional[int] = None
    criticos_r: Optional[int] = None
    mayores_b_plus_a: Optional[int] = None
    mayores_b_plus_r: Optional[int] = None
    mayores_b_minus_a: Optional[int] = None
    mayores_b_minus_r: Optional[int] = None
    menores_a: Optional[int] = None
    menores_r: Optional[int] = None
    tamano_muestra: Optional[int] = None
    tamano_poblacion: Optional[int] = None
    bot_por_camada: Optional[int] = None
    bot_por_paleta: Optional[int] = None
    gruesas_por_paleta: Optional[int] = None
    observaciones: Optional[str] = None
    responsable_nombre: Optional[str] = None
    responsable_grupo: Optional[str] = None
    firma: Optional[str] = None
    auditoria_id: Optional[int] = None


class InspeccionResponse(InspeccionBase):
    id: int
    fecha_registro: datetime
    fecha_actualizacion: datetime

    class Config:
        from_attributes = True