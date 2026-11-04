from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ProductoBase(BaseModel):
    nombre: str
    item: Optional[str] = None
    acabado: Optional[str] = None
    capacidad_ml: Optional[int] = None
    bpp: Optional[float] = None
    bpc: Optional[int] = None  # 👈 ¡AQUÍ ESTABA EL ERROR! Faltaba declararlo.
    juego_envases: Optional[str] = None
    material: Optional[str] = None
    tipo_boca: Optional[str] = None
    dimensiones: Optional[str] = None
    activo: Optional[bool] = True


class ProductoCreate(ProductoBase):
    pass


class ProductoUpdate(BaseModel):
    nombre: Optional[str] = None
    item: Optional[str] = None
    acabado: Optional[str] = None
    capacidad_ml: Optional[int] = None
    bpp: Optional[float] = None
    bpc: Optional[int] = None  # 👈 También debe ir aquí para poder actualizarlo
    juego_envases: Optional[str] = None
    material: Optional[str] = None
    tipo_boca: Optional[str] = None
    dimensiones: Optional[str] = None
    activo: Optional[bool] = None


class ProductoResponse(ProductoBase):
    id: int
    fecha_creacion: Optional[datetime] = None

    class Config:
        from_attributes = True