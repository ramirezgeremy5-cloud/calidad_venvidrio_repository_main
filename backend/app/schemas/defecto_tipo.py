from pydantic import BaseModel, Field, field_validator
from typing import Literal

# Aseguramos que las clasificaciones sean exactamente las oficiales
ClasificacionOficial = Literal["Crítico", "Mayor B+", "Mayor B-", "Menor"]


class DefectoTipoBase(BaseModel):
    clasificacion: ClasificacionOficial = Field(
        ...,
        description="Clasificación oficial del defecto"
    )
    tipo_defecto: str = Field(
        ...,
        min_length=1,
        max_length=150,
        description="Nombre o descripción corta del tipo de defecto"
    )

    @field_validator("tipo_defecto", mode="before")
    @classmethod
    def limpiar_espacios(cls, v: str) -> str:
        """Elimina espacios extra al inicio y al final."""
        if isinstance(v, str):
            return " ".join(v.split())
        return v


class DefectoTipoCreate(DefectoTipoBase):
    """Payload que envía el frontend para registrar un tipo nuevo."""
    pass


class DefectoTipoResponse(DefectoTipoBase):
    """Respuesta que devuelve el backend con los datos de la BD."""
    id: int
    activo: bool
    # Si tu modelo SQLAlchemy tiene fecha_creacion, agrégala aquí:
    # fecha_creacion: datetime

    class Config:
        from_attributes = True