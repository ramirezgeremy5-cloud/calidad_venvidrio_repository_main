from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class CargoBase(BaseModel):
    nombre: str = Field(..., min_length=3, max_length=60)


class CargoCreate(CargoBase):
    pass


class CargoResponse(CargoBase):
    id: int
    creado_en: Optional[datetime] = None

    class Config:
        from_attributes = True


class CargoConUso(CargoResponse):
    """Variante para devolver también cuántos usuarios lo tienen asignado."""
    uso: int = 0