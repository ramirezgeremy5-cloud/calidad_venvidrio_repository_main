from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.database.connection import Base

class DefectoTipo(Base):
    __tablename__ = "tipos_defecto"

    id = Column(Integer, primary_key=True, index=True)
    clasificacion = Column(String(50), nullable=False, index=True) # Crítico, Mayor B+, etc.
    nombre = Column(String(150), nullable=False, index=True)
    activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<DefectoTipo(clase='{self.clasificacion}', nombre='{self.nombre}')>"