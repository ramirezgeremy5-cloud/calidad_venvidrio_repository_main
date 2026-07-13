from pydantic import BaseModel


class LoginRequest(BaseModel):
    correo: str
    password: str


class UsuarioResponse(BaseModel):
    id: int
    nombre: str
    correo: str
    rol_id: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: int
    user: UsuarioResponse