from pydantic import BaseModel, field_validator
from datetime import datetime, date
from typing import Optional


class ProduccionBase(BaseModel):
    # Identificación
    ticket_carga: Optional[str] = None
    planta: Optional[str] = None
    maquina: Optional[str] = None
    linea_produccion: Optional[str] = None
    grupo: Optional[str] = None
    
    # 👇 CAMBIO: Ahora es un entero, no un string
    turno: Optional[int] = None 
    
    operador: Optional[str] = None
    orden: Optional[str] = None

    # Producto
    tipo_producto: Optional[str] = None
    acabado: Optional[str] = None
    material: Optional[str] = None
    tipo_boca: Optional[str] = None
    molde: Optional[str] = None
    item: Optional[str] = None
    bpp: Optional[float] = None
    capacidad: Optional[int] = None
    unidad_capacidad: Optional[str] = "ml"
    cliente: Optional[str] = None

    # Cantidades
    cantidad: Optional[int] = 0
    paletas: Optional[float] = None
    cajas_producidas: Optional[float] = None
    gruesas: Optional[float] = None
    juego_envases: Optional[str] = None

    # Datos para reporte de inspección
    tamano_muestra: Optional[str] = None
    bot_por_canada: Optional[int] = None  # Envases por Camada
    
    # 👈 NUEVO: Camadas por Paleta
    camadas_por_paleta: Optional[int] = None
    
    bot_por_paleta: Optional[float] = None
    gruesas_por_paleta: Optional[float] = None

    # Estatus
    estatus: Optional[str] = "100"
    estado_auditoria: Optional[str] = "pendiente"
    observaciones: Optional[str] = None

    # Fechas
    fecha_produccion: Optional[date] = None

    # 👇 VALIDADOR PARA EL TURNO (Solo permite 1, 2, 3, 4)
    @field_validator('turno')
    @classmethod
    def validar_turno(cls, v):
        if v is not None and v not in [1, 2, 3, 4]:
            raise ValueError('El turno debe ser un número entre 1 y 4')
        return v


class ProduccionCreate(ProduccionBase):
    codigo_lote: Optional[str] = None


class ProduccionUpdate(ProduccionBase):
    codigo_lote: Optional[str] = None


class ProduccionResponse(ProduccionBase):
    id: int
    codigo_lote: str
    fecha_registro: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==========================================
# SCHEMA EXCLUSIVO PARA ETIQUETAS
# ==========================================
class EtiquetaResponse(BaseModel):
    planta: Optional[str] = None
    ticket_carga: Optional[str] = None
    cliente: Optional[str] = None
    orden: Optional[str] = None
    obs_produccion: Optional[str] = None
    maquina: Optional[str] = None
    
    # 👇 CAMBIO: También debe ser entero en la respuesta de la etiqueta
    turno: Optional[int] = None 
    
    grupo: Optional[str] = None
    fecha_produccion: Optional[str] = None 
    tipo_producto: Optional[str] = None
    acabado: Optional[str] = None
    item: Optional[str] = None
    bpp: Optional[float] = None
    capacidad: Optional[int] = None
    molde: Optional[str] = None
    codigo_lote: str

    class Config:
        from_attributes = True