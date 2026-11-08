from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from app.database.connection import Base
from datetime import datetime


class AuditoriaInterna(Base):
    __tablename__ = "auditorias_internas"  # 👈 Cambiado (o deja "auditorias_calidad" si ya tienes datos)

    id = Column(Integer, primary_key=True, index=True)
    
    evaluado_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    evaluador_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    
    periodo = Column(String(50), nullable=False)
    puntaje = Column(Float, nullable=False)  # Porcentaje (ej: 85.5)
    categoria = Column(String(50), nullable=False)  # Excelente, Bueno, Regular, Deficiente
    
    # Guardamos las respuestas del checklist en formato JSON
    detalles = Column(String(1000), nullable=True) 
    observaciones = Column(String(500), nullable=True)
    
    fecha = Column(DateTime, default=datetime.utcnow)

    # Relaciones para poder traer el nombre del evaluado y del evaluador
    evaluado = relationship("Usuario", foreign_keys=[evaluado_id])
    evaluador = relationship("Usuario", foreign_keys=[evaluador_id])