from pydantic import BaseModel, EmailStr, validator, Field
from typing import Optional
import re


class LoginRequest(BaseModel):
    """Esquema para iniciar sesión"""
    correo: EmailStr = Field(..., description="Correo electrónico del usuario")
    password: str = Field(..., min_length=1, description="Contraseña del usuario")
    
    @validator('correo')
    def validar_correo(cls, v):
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError('Formato de email inválido')
        return v


class RegisterRequest(BaseModel):
    """Esquema para registrar un nuevo usuario"""
    nombre: str = Field(..., min_length=3, max_length=100)
    correo: EmailStr
    password: str = Field(..., min_length=8)
    rol_id: Optional[int] = Field(1, ge=1, le=3)
    
    @validator('nombre')
    def validar_nombre(cls, v):
        if not v or len(v.strip()) < 3:
            raise ValueError('El nombre debe tener al menos 3 caracteres')
        if not re.match(r"^[a-zA-ZáéíóúñÑ\s]+$", v):
            raise ValueError('El nombre solo debe contener letras y espacios')
        return v.strip()
    
    @validator('password')
    def validar_password(cls, v):
        if len(v) < 8:
            raise ValueError('La contraseña debe tener al menos 8 caracteres')
        if not re.search(r"[A-Z]", v):
            raise ValueError('Debe tener al menos una mayúscula')
        if not re.search(r"[a-z]", v):
            raise ValueError('Debe tener al menos una minúscula')
        if not re.search(r"[0-9]", v):
            raise ValueError('Debe tener al menos un número')
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError('Debe tener al menos un carácter especial (!@#$%^&*(),.?":{}|<>)')
        return v


class PasswordChangeRequest(BaseModel):
    """Esquema para cambiar contraseña"""
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)
    
    @validator('new_password')
    def validar_password(cls, v):
        if len(v) < 8:
            raise ValueError('La contraseña debe tener al menos 8 caracteres')
        if not re.search(r"[A-Z]", v):
            raise ValueError('Debe tener al menos una mayúscula')
        if not re.search(r"[a-z]", v):
            raise ValueError('Debe tener al menos una minúscula')
        if not re.search(r"[0-9]", v):
            raise ValueError('Debe tener al menos un número')
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError('Debe tener al menos un carácter especial (!@#$%^&*(),.?":{}|<>)')
        return v


class PasswordResetRequest(BaseModel):
    """Esquema para restablecer contraseña"""
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)
    
    @validator('new_password')
    def validar_password(cls, v):
        if len(v) < 8:
            raise ValueError('La contraseña debe tener al menos 8 caracteres')
        if not re.search(r"[A-Z]", v):
            raise ValueError('Debe tener al menos una mayúscula')
        if not re.search(r"[a-z]", v):
            raise ValueError('Debe tener al menos una minúscula')
        if not re.search(r"[0-9]", v):
            raise ValueError('Debe tener al menos un número')
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError('Debe tener al menos un carácter especial (!@#$%^&*(),.?":{}|<>)')
        return v


class TokenResponse(BaseModel):
    """Esquema de respuesta con token JWT"""
    access_token: str
    token_type: str = "bearer"
    role: int
    user: dict


class UserResponse(BaseModel):
    """Esquema de respuesta con datos del usuario"""
    id: int
    nombre: str
    correo: str
    rol_id: int
    activo: Optional[bool] = True