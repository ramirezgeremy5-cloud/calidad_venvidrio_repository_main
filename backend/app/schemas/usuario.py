from pydantic import BaseModel, ConfigDict


class UsuarioCreate(BaseModel):
    nombre: str
    correo: str
    password: str
    rol_id: int


class UsuarioResponse(BaseModel):
    id: int
    nombre: str
    correo: str
    rol_id: int

    model_config = ConfigDict(from_attributes=True)