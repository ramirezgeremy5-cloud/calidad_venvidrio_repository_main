from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class ClienteBase(BaseModel):
    nombre: str = Field(..., max_length=150, description="Nombre o razón social del cliente")
    rif: Optional[str] = Field(None, max_length=50)
    direccion: Optional[str] = Field(None, description="Dirección física del cliente")
    telefono: Optional[str] = Field(None, max_length=50)
    correo: Optional[str] = Field(None, max_length=100)
    activo: Optional[bool] = True


class ClienteCreate(ClienteBase):
    """
    Esquema para crear un cliente. 
    Hereda todos los campos de ClienteBase y sus validaciones.
    """
    pass


class ClienteUpdate(BaseModel):
    """
    Esquema para actualizar un cliente. 
    Todos los campos son opcionales para permitir actualizaciones parciales (PUT/PATCH).
    """
    nombre: Optional[str] = Field(None, max_length=150)
    rif: Optional[str] = Field(None, max_length=50)
    direccion: Optional[str] = None
    telefono: Optional[str] = Field(None, max_length=50)
    correo: Optional[str] = Field(None, max_length=100)
    activo: Optional[bool] = None


class ClienteResponse(ClienteBase):
    """
    Esquema de respuesta que FastAPI enviará al frontend.
    """
    id: int
    fecha_creacion: Optional[datetime] = None

    class Config:
        from_attributes = True