# app/schemas/cliente.py
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# Esquema Base
class ClienteBase(BaseModel):
    nombre: str
    direccion: Optional[str] = None
    contacto: Optional[str] = None

# Esquema para Creación
class ClienteCreate(ClienteBase):
    pass

# Esquema para Respuesta (incluye ID y fecha de registro)
class ClienteResponse(ClienteBase):
    id: int
    fecha_registro: datetime

    class Config:
        from_attributes = True