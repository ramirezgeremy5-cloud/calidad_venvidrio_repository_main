from pydantic import BaseModel, ConfigDict, validator, EmailStr, Field, field_validator
from datetime import datetime, date
from typing import Optional
import re

# ==========================================
# ESQUEMAS BASE
# ==========================================

class UsuarioBase(BaseModel):
    """Base de usuario con campos comunes"""
    nombre: str = Field(..., min_length=3, max_length=100, description="Nombre completo del usuario")
    correo: EmailStr = Field(..., description="Correo electrónico del usuario")
    rol_id: int = Field(default=1, ge=1, le=3, description="1=Usuario, 2=Supervisor, 3=Admin")

    @validator('nombre')
    def validar_nombre(cls, v):
        """Validar que el nombre solo contenga letras y espacios"""
        if not v or len(v.strip()) < 3:
            raise ValueError('El nombre debe tener al menos 3 caracteres')
        if not re.match(r"^[a-zA-ZáéíóúñÑ\s]+$", v):
            raise ValueError('El nombre solo debe contener letras y espacios')
        return v.strip()

# ==========================================
# CREACIÓN DE USUARIO
# ==========================================

class UsuarioCreate(UsuarioBase):
    """Esquema para crear un nuevo usuario"""
    password: str = Field(..., min_length=8, description="Contraseña del usuario")
    cargo_id: Optional[int] = Field(
        None,
        ge=1,
        description="ID del cargo asignado (opcional). Debe existir en la tabla cargos."
    )
    
    cedula: Optional[str] = Field(None, max_length=20, description="Cédula de identidad (opcional)")
    
    # 👇 CAMBIO: Turno ahora es un entero
    turno: int = Field(..., ge=1, le=4, description="Turno del usuario (1, 2, 3 o 4)")
    
    fecha_ingreso: Optional[date] = Field(None, description="Fecha de ingreso (opcional)")
    fecha_nacimiento: Optional[date] = Field(None, description="Fecha de nacimiento (opcional)")
    foto_url: Optional[str] = Field(None, max_length=255, description="URL de la foto de perfil (opcional)")

    @validator('password')
    def validar_password(cls, v):
        """Validar fortaleza de la contraseña"""
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

# ==========================================
# LOGIN
# ==========================================

class UsuarioLogin(BaseModel):
    """Esquema para iniciar sesión"""
    correo: EmailStr = Field(..., description="Correo electrónico")
    password: str = Field(..., min_length=1, description="Contraseña")

    @validator('correo')
    def validar_correo(cls, v):
        """Validar formato de correo"""
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError('Formato de email inválido')
        return v

# ==========================================
# RESPUESTA
# ==========================================

class UsuarioResponse(UsuarioBase):
    """Esquema de respuesta con todos los campos del usuario"""
    id: int = Field(..., description="ID del usuario")
    activo: bool = Field(default=True, description="Estado del usuario")
    creado_en: Optional[datetime] = Field(None, description="Fecha de creación")
    ultimo_login: Optional[datetime] = Field(None, description="Último inicio de sesión")
    intentos_fallidos: Optional[int] = Field(0, description="Intentos fallidos de login")
    bloqueado_hasta: Optional[datetime] = Field(None, description="Fecha de bloqueo")

    cargo_id: Optional[int] = Field(None, description="ID del cargo asignado")
    cargo: Optional[str] = Field(None, description="Nombre del cargo (resuelto)")

    cedula: Optional[str] = Field(None, description="Cédula de identidad")
    turno: Optional[int] = Field(None, description="Turno del usuario")
    fecha_ingreso: Optional[date] = Field(None, description="Fecha de ingreso")
    fecha_nacimiento: Optional[date] = Field(None, description="Fecha de nacimiento")
    foto_url: Optional[str] = Field(None, description="URL de la foto de perfil")

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: lambda dt: dt.isoformat() if dt else None,
            date: lambda d: d.isoformat() if d else None
        }
    )

    @field_validator('cargo', mode='before')
    @classmethod
    def resolver_cargo(cls, v):
        """Extrae el string si SQLAlchemy devuelve el objeto"""
        if v is not None and hasattr(v, 'nombre'):
            return v.nombre
        return v

# ==========================================
# ACTUALIZACIÓN
# ==========================================

class UsuarioUpdate(BaseModel):
    """Esquema para actualizar usuario"""
    nombre: Optional[str] = Field(None, min_length=3, max_length=100)
    correo: Optional[EmailStr] = None
    rol_id: Optional[int] = Field(None, ge=1, le=3)
    activo: Optional[bool] = None

    cargo_id: Optional[int] = Field(
        None,
        ge=0,
        description="ID del cargo. Use 0 para quitar el cargo, omitir para no tocarlo."
    )
    
    cedula: Optional[str] = Field(None, max_length=20)
    # 👇 CAMBIO: Turno ahora es un entero
    turno: Optional[int] = Field(None, ge=1, le=4)
    fecha_ingreso: Optional[date] = None
    fecha_nacimiento: Optional[date] = None
    foto_url: Optional[str] = Field(None, max_length=255)

    @validator('nombre')
    def validar_nombre(cls, v):
        if v is not None:
            if len(v.strip()) < 3:
                raise ValueError('El nombre debe tener al menos 3 caracteres')
            if not re.match(r"^[a-zA-ZáéíóúñÑ\s]+$", v):
                raise ValueError('El nombre solo debe contener letras y espacios')
            return v.strip()
        return v

# ==========================================
# CAMBIO DE CONTRASEÑA
# ==========================================

class CambioPassword(BaseModel):
    """Esquema para cambiar contraseña"""
    password_actual: str = Field(..., min_length=1, description="Contraseña actual")
    password_nueva: str = Field(..., min_length=8, description="Nueva contraseña")

    @validator('password_nueva')
    def validar_password_nueva(cls, v):
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

# ==========================================
# TOKEN JWT
# ==========================================

class Token(BaseModel):
    access_token: str = Field(..., description="Token de acceso JWT")
    token_type: str = Field(default="bearer", description="Tipo de token")
    role: int = Field(..., description="Rol del usuario autenticado")
    user: UsuarioResponse = Field(..., description="Datos del usuario autenticado")

class TokenData(BaseModel):
    sub: Optional[str] = Field(None, description="ID del usuario")
    correo: Optional[str] = Field(None, description="Correo del usuario")
    rol: Optional[int] = Field(None, description="Rol del usuario")
    sid: Optional[str] = Field(None, description="Session ID para control de sesión única")
    exp: Optional[int] = Field(None, description="Expiración del token")

# ==========================================
# RECUPERACIÓN DE CONTRASEÑA
# ==========================================

class SolicitarRecuperacion(BaseModel):
    correo: EmailStr = Field(..., description="Correo del usuario")

class RestablecerPassword(BaseModel):
    token: str = Field(..., description="Token de recuperación")
    nueva_password: str = Field(..., min_length=8, description="Nueva contraseña")

    @validator('nueva_password')
    def validar_nueva_password(cls, v):
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

# ==========================================
# FILTROS Y PAGINACIÓN
# ==========================================

class UsuarioFiltros(BaseModel):
    nombre: Optional[str] = Field(None, description="Filtrar por nombre")
    correo: Optional[str] = Field(None, description="Filtrar por correo")
    rol_id: Optional[int] = Field(None, ge=1, le=3, description="Filtrar por rol")
    activo: Optional[bool] = Field(None, description="Filtrar por estado")
    cargo_id: Optional[int] = Field(None, description="Filtrar por cargo")
    creado_desde: Optional[datetime] = Field(None, description="Fecha de creación desde")
    creado_hasta: Optional[datetime] = Field(None, description="Fecha de creación hasta")

class Paginacion(BaseModel):
    skip: int = Field(default=0, ge=0, description="Número de registros a saltar")
    limit: int = Field(default=100, ge=1, le=1000, description="Límite de registros")

# ==========================================
# RESPUESTA CON PAGINACIÓN
# ==========================================

class UsuarioListaResponse(BaseModel):
    total: int = Field(..., description="Total de registros")
    items: list[UsuarioResponse] = Field(..., description="Lista de usuarios")
    skip: int = Field(..., description="Registros saltados")
    limit: int = Field(..., description="Límite de registros")

# ==========================================
# MENSAJES DE RESPUESTA
# ==========================================

class MensajeResponse(BaseModel):
    success: bool = Field(..., description="Éxito de la operación")
    message: str = Field(..., description="Mensaje descriptivo")
    data: Optional[dict] = Field(None, description="Datos adicionales")

# ==========================================
# EJEMPLOS DE USO (Documentación)
# ==========================================

class Ejemplos:
    usuario_create = {
        "nombre": "Juan Pérez",
        "cedula": "V-12345678",
        "correo": "juan@empresa.com",
        "password": "Password123!",
        "rol_id": 1,
        "cargo_id": 3,
        "turno": 1,
        "fecha_ingreso": "2024-01-01",
        "fecha_nacimiento": "1990-05-15",
        "foto_url": "https://ejemplo.com/foto.jpg"
    }

    usuario_login = {
        "correo": "juan@empresa.com",
        "password": "Password123!"
    }

    usuario_response = {
        "id": 1,
        "nombre": "Juan Pérez",
        "cedula": "V-12345678",
        "correo": "juan@empresa.com",
        "rol_id": 1,
        "activo": True,
        "creado_en": "2024-01-01T10:00:00",
        "ultimo_login": "2024-01-15T14:30:00",
        "cargo_id": 3,
        "cargo": "Inspector de Calidad",
        "turno": 1,
        "fecha_ingreso": "2024-01-01",
        "fecha_nacimiento": "1990-05-15",
        "foto_url": "https://ejemplo.com/foto.jpg"
    }