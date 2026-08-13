from sqlalchemy import Column, Integer, String, Boolean, DateTime
from app.database.connection import Base
from datetime import datetime

class Usuario(Base):
    __tablename__ = "usuarios"

    # Campos básicos
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    correo = Column(String(100), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)  # Hash de la contraseña
    rol_id = Column(Integer, nullable=False, default=1)  # 1=usuario, 2=admin, etc.
    
    # Campos de seguridad
    activo = Column(Boolean, default=True)
    creado_en = Column(DateTime, default=datetime.utcnow)
    ultimo_login = Column(DateTime, nullable=True)
    
    # Campos para protección contra fuerza bruta
    intentos_fallidos = Column(Integer, default=0)
    bloqueado_hasta = Column(DateTime, nullable=True)
    
    # Campos para recuperación de contraseña
    token_recuperacion = Column(String(255), nullable=True)
    token_expiracion = Column(DateTime, nullable=True)