from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.connection import Base

class AuditoriaProducto(Base):
    __tablename__ = "auditorias_producto"

    id = Column(Integer, primary_key=True, index=True)

    # Vínculo con la tabla Produccion
    produccion_id = Column(Integer, ForeignKey("produccion.id"), nullable=False)
    produccion = relationship("Produccion", backref="auditorias")

    # Datos de la auditoría
    fecha_auditoria = Column(Date, nullable=False)
    paletas_inspeccionadas = Column(Integer, nullable=False)
    paletas_aprobadas = Column(Integer, nullable=False)
    paletas_rechazadas = Column(Integer, nullable=False)
    observaciones = Column(Text, nullable=True)

    # ✅ NUEVOS CAMPOS
    auditor_id = Column(Integer, nullable=True)
    auditor_nombre = Column(String(100), nullable=True)

    # Relación con los defectos (muchos a muchos)
    defectos = relationship(
        "Defecto",
        secondary="auditorias_defectos",
        back_populates="auditorias"
    )

    # Registro automático
    fecha_registro = Column(DateTime(timezone=True), server_default=func.now())
    fecha_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())