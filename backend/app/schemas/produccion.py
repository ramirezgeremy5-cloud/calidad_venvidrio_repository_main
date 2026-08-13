# app/schemas/produccion.py
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# --- Clase auxiliar para serializar el cliente ---
class ClienteSchema(BaseModel):
    id: int
    nombre: str

    class Config:
        from_attributes = True

# --- Base de Producción ---
class ProduccionBase(BaseModel):
    codigo_lote: str
    linea_produccion: str
    tipo_producto: str
    cantidad: int
    operador: str
    turno: str
    observaciones: Optional[str] = None
    fecha_produccion: Optional[datetime] = None
    cliente_id: Optional[int] = None
    molde: Optional[str] = None
    item: Optional[str] = None

# --- Creación ---
class ProduccionCreate(ProduccionBase):
    pass

# --- Actualización ---
class ProduccionUpdate(ProduccionBase):
    codigo_lote: Optional[str] = None
    linea_produccion: Optional[str] = None
    tipo_producto: Optional[str] = None
    cantidad: Optional[int] = None
    operador: Optional[str] = None
    turno: Optional[str] = None
    observaciones: Optional[str] = None
    fecha_produccion: Optional[datetime] = None
    cliente_id: Optional[int] = None
    molde: Optional[str] = None
    item: Optional[str] = None

# --- Respuesta (¡Aquí está la clave!) ---
class ProduccionResponse(ProduccionBase):
    id: int
    fecha_registro: datetime
    fecha_actualizacion: datetime
    
    # Esto permite que el JSON incluya { "cliente": { "id": 1, "nombre": "MOLDEABAG" } }
    # Cuando el Frontend reciba la respuesta, verá el objeto cliente completo.
    cliente: Optional[ClienteSchema] = None 

    class Config:
        from_attributes = True