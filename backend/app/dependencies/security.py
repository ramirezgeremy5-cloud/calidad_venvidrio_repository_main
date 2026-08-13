from datetime import datetime, timedelta
from typing import Optional, Tuple
import re
import secrets
import string

from jose import jwt, JWTError
import bcrypt

from app.core.config import settings


# =========================
# FUNCIONES DE CONTRASEÑA (BCRYPT DIRECTO - DEFINITIVO)
# =========================

def hash_password(password: str) -> str:
    """
    Hashear contraseña con bcrypt
    
    Args:
        password: Contraseña en texto plano
        
    Returns:
        str: Hash de la contraseña
        
    Raises:
        ValueError: Si la contraseña está vacía
    """
    if not password:
        raise ValueError("La contraseña no puede estar vacía")
    
    # Limpiar y normalizar
    password = str(password).strip()
    password_bytes = password.encode('utf-8')
    
    # Truncar a 72 bytes (bcrypt limit)
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    
    # Generar hash
    salt = bcrypt.gensalt()
    hash_bytes = bcrypt.hashpw(password_bytes, salt)
    
    return hash_bytes.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verificar contraseña contra su hash
    
    Args:
        plain_password: Contraseña en texto plano
        hashed_password: Hash de la contraseña
        
    Returns:
        bool: True si coincide, False si no
    """
    if not plain_password or not hashed_password:
        return False
    
    # Limpiar y normalizar
    plain_password = str(plain_password).strip()
    password_bytes = plain_password.encode('utf-8')
    
    # Truncar a 72 bytes (bcrypt limit)
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    
    try:
        return bcrypt.checkpw(password_bytes, hashed_password.encode('utf-8'))
    except ValueError:
        return False
    except Exception:
        return False


# =========================
# FUNCIONES JWT
# =========================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Crear token JWT de acceso
    
    Args:
        data: Datos a incluir en el token (debe contener 'sub')
        expires_delta: Tiempo de expiración (opcional)
        
    Returns:
        str: Token JWT
    """
    to_encode = data.copy()
    
    # Limpiar strings en los datos
    for key, value in to_encode.items():
        if isinstance(value, str):
            to_encode[key] = value.strip()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow()
    })

    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decodificar y validar token JWT
    
    Args:
        token: Token JWT a decodificar
        
    Returns:
        Optional[dict]: Payload del token si es válido, None si no
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError:
        return None


def verify_token(token: str) -> Tuple[bool, Optional[dict]]:
    """
    Verificar token JWT
    
    Args:
        token: Token JWT a verificar
        
    Returns:
        Tuple[bool, Optional[dict]]: (es_válido, payload)
    """
    payload = decode_access_token(token)
    if not payload:
        return False, None
    
    # Verificar expiración
    exp = payload.get("exp")
    if exp and datetime.utcnow() > datetime.utcfromtimestamp(exp):
        return False, None
    
    return True, payload


def refresh_access_token(refresh_token: str) -> Optional[str]:
    """
    Refrescar token de acceso usando refresh token
    
    Args:
        refresh_token: Token de refresco
        
    Returns:
        Optional[str]: Nuevo token de acceso
    """
    payload = decode_access_token(refresh_token)
    if not payload:
        return None
    
    # Verificar que sea un refresh token
    if payload.get("type") != "refresh":
        return None
    
    user_id = payload.get("sub")
    if not user_id:
        return None
    
    # Crear nuevo token de acceso
    new_token = create_access_token(
        data={
            "sub": user_id,
            "correo": payload.get("correo"),
            "rol": payload.get("rol")
        }
    )
    
    return new_token


# =========================
# FUNCIONES DE VALIDACIÓN
# =========================

def validate_password_strength(password: str) -> Tuple[bool, str]:
    """
    Validar fortaleza de la contraseña
    
    Args:
        password: Contraseña a validar
        
    Returns:
        Tuple[bool, str]: (es_válida, mensaje)
    """
    if not password:
        return False, "La contraseña es requerida"
    
    password = password.strip()
    
    if len(password) < 8:
        return False, "La contraseña debe tener al menos 8 caracteres"
    
    if not re.search(r"[A-Z]", password):
        return False, "Debe tener al menos una mayúscula"
    
    if not re.search(r"[a-z]", password):
        return False, "Debe tener al menos una minúscula"
    
    if not re.search(r"[0-9]", password):
        return False, "Debe tener al menos un número"
    
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Debe tener al menos un carácter especial (!@#$%^&*(),.?\":{}|<>)"
    
    return True, "Contraseña válida"


def validate_email(email: str) -> Tuple[bool, str]:
    """
    Validar formato de email
    
    Args:
        email: Email a validar
        
    Returns:
        Tuple[bool, str]: (es_válido, mensaje)
    """
    if not email:
        return False, "El email es requerido"
    
    email = email.strip().lower()
    
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    if not re.match(pattern, email):
        return False, "Formato de email inválido"
    
    return True, "Email válido"


def validate_username(username: str) -> Tuple[bool, str]:
    """
    Validar formato de nombre de usuario
    
    Args:
        username: Nombre de usuario a validar
        
    Returns:
        Tuple[bool, str]: (es_válido, mensaje)
    """
    if not username or len(username) < 3:
        return False, "El usuario debe tener al menos 3 caracteres"
    
    username = username.strip()
    
    if len(username) > 50:
        return False, "El usuario no puede tener más de 50 caracteres"
    
    if not re.match(r"^[a-zA-Z0-9._-]+$", username):
        return False, "El usuario solo puede contener letras, números, puntos, guiones bajos y guiones"
    
    return True, "Usuario válido"


def validate_name(name: str) -> Tuple[bool, str]:
    """
    Validar formato de nombre completo
    
    Args:
        name: Nombre a validar
        
    Returns:
        Tuple[bool, str]: (es_válido, mensaje)
    """
    if not name or len(name.strip()) < 3:
        return False, "El nombre debe tener al menos 3 caracteres"
    
    name = name.strip()
    
    if len(name) > 100:
        return False, "El nombre no puede tener más de 100 caracteres"
    
    if not re.match(r"^[a-zA-ZáéíóúñÑ\s]+$", name):
        return False, "El nombre solo debe contener letras y espacios"
    
    return True, "Nombre válido"


# =========================
# FUNCIONES DE SEGURIDAD ADICIONALES
# =========================

def generate_password_reset_token(user_id: int, email: str) -> str:
    """
    Generar token para recuperación de contraseña
    
    Args:
        user_id: ID del usuario
        email: Email del usuario
        
    Returns:
        str: Token de recuperación
    """
    token_data = {
        "sub": str(user_id),
        "email": email.strip().lower(),
        "type": "password_reset",
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    
    return jwt.encode(
        token_data,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )


def verify_password_reset_token(token: str) -> Optional[dict]:
    """
    Verificar token de recuperación de contraseña
    
    Args:
        token: Token de recuperación
        
    Returns:
        Optional[dict]: Datos del token si es válido
    """
    payload = decode_access_token(token)
    if not payload:
        return None
    
    # Verificar que sea un token de recuperación
    if payload.get("type") != "password_reset":
        return None
    
    # Verificar expiración
    exp = payload.get("exp")
    if exp and datetime.utcnow() > datetime.utcfromtimestamp(exp):
        return None
    
    return payload


def mask_email(email: str) -> str:
    """
    Ocultar parcialmente un email para mostrar en interfaces
    
    Args:
        email: Email a ocultar
        
    Returns:
        str: Email oculto
    """
    if not email:
        return ""
    
    email = email.strip()
    parts = email.split("@")
    if len(parts) != 2:
        return email
    
    username, domain = parts
    if len(username) <= 2:
        masked_username = username[0] + "*" * len(username[1:])
    else:
        masked_username = username[0] + "*" * (len(username) - 2) + username[-1]
    
    return f"{masked_username}@{domain}"


def is_token_expired(token: str) -> bool:
    """
    Verificar si un token ha expirado
    
    Args:
        token: Token JWT
        
    Returns:
        bool: True si expiró, False si es válido
    """
    payload = decode_access_token(token)
    if not payload:
        return True
    
    exp = payload.get("exp")
    if not exp:
        return True
    
    return datetime.utcnow() > datetime.utcfromtimestamp(exp)


def clean_string(value: str) -> str:
    """
    Limpiar string: eliminar espacios, BOM y caracteres invisibles
    
    Args:
        value: String a limpiar
        
    Returns:
        str: String limpio
    """
    if not value:
        return ""
    
    # Eliminar BOM
    if value.startswith('\ufeff'):
        value = value[1:]
    
    # Eliminar espacios y normalizar
    value = value.strip()
    value = value.encode('utf-8', 'ignore').decode('utf-8')
    
    return value


# =========================
# CONFIGURACIÓN DE SEGURIDAD
# =========================

def get_password_policy() -> dict:
    """
    Obtener políticas de contraseña para el frontend
    
    Returns:
        dict: Políticas de contraseña
    """
    return {
        "min_length": 8,
        "require_uppercase": True,
        "require_lowercase": True,
        "require_numbers": True,
        "require_special_chars": True,
        "special_chars": "!@#$%^&*(),.?\":{}|<>"
    }


def generate_secure_random_password(length: int = 12) -> str:
    """
    Generar contraseña segura aleatoria
    
    Args:
        length: Longitud de la contraseña
        
    Returns:
        str: Contraseña generada
    """
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    
    # Asegurar al menos un carácter de cada tipo
    password = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%^&*")
    ]
    
    # Completar el resto de la longitud
    for _ in range(length - 4):
        password.append(secrets.choice(alphabet))
    
    # Mezclar la contraseña
    secrets.SystemRandom().shuffle(password)
    
    return "".join(password)


# =========================
# VALIDACIÓN DE ROLES
# =========================

ROLES = {
    1: "usuario",
    2: "admin",
    3: "super_admin"
}

def get_role_name(role_id: int) -> str:
    """
    Obtener nombre del rol
    
    Args:
        role_id: ID del rol
        
    Returns:
        str: Nombre del rol
    """
    return ROLES.get(role_id, "desconocido")


def is_admin(role_id: int) -> bool:
    """
    Verificar si el rol es administrador
    
    Args:
        role_id: ID del rol
        
    Returns:
        bool: True si es admin o super admin
    """
    return role_id in [2, 3]


def is_super_admin(role_id: int) -> bool:
    """
    Verificar si el rol es super administrador
    
    Args:
        role_id: ID del rol
        
    Returns:
        bool: True si es super admin
    """
    return role_id == 3