from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from datetime import datetime

from app.database.connection import Base


class Cliente(Base):
    __tablename__ = "cliente"

    id = Column(Integer, primary_key=True, index=True)
    
    # ===== Datos Principales =====
    nombre = Column(String, nullable=False, unique=True, index=True)
    rif = Column(String, nullable=True, index=True)
    direccion = Column(Text, nullable=True)  # Text permite direcciones largas
    telefono = Column(String, nullable=True)
    correo = Column(String, nullable=True)
    
    # ===== Control =====
    activo = Column(Boolean, default=True, index=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow, index=True)

    def __repr__(self):
        return (
            f"<Cliente(id={self.id}, nombre='{self.nombre}', "
            f"rif='{self.rif}', activo={self.activo})>"
        )