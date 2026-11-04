from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Date, CheckConstraint
from sqlalchemy.orm import relationship
from app.database.connection import Base
from datetime import datetime


class Usuario(Base):
    __tablename__ = "usuarios"

    # Campos básicos
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    cedula = Column(String(20), unique=True, nullable=True, index=True)
    correo = Column(String(100), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)  # Hash de la contraseña
    rol_id = Column(Integer, nullable=False, default=1)  # 1=usuario, 2=supervisor, 3=admin

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

    # ✅ Control de sesión única y expiración por inactividad
    session_id = Column(String(36), nullable=True)
    ultima_actividad = Column(DateTime, nullable=True)

    # (Opcional) Token de sesión antigua
    token_activo = Column(String(500), nullable=True)

    # ============================
    # Relación con Cargo
    # ============================
    cargo_id = Column(
        Integer,
        ForeignKey("cargos.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    
    cargo = relationship(
        "Cargo",
        back_populates="usuarios"
    )

    # ============================
    # 👇 CAMPOS DE PERFIL ACTUALIZADOS
    # ============================
    
    # 👇 CAMBIO: Ahora es Integer y solo permite del 1 al 4
    turno = Column(Integer, nullable=True)
    
    fecha_ingreso = Column(Date, nullable=True)
    fecha_nacimiento = Column(Date, nullable=True)
    foto_url = Column(String(255), nullable=True)

    # Restricción a nivel de base de datos para asegurar que solo se guarden números del 1 al 4
    __table_args__ = (
        CheckConstraint('turno >= 1 AND turno <= 4', name='check_turno_rango'),
    )