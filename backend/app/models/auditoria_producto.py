from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.connection import Base

# =====================================================
# TABLA INTERMEDIA (Muchos a Muchos)
# ÚNICA definición de 'auditorias_defectos' en todo el proyecto
# =====================================================
auditorias_defectos = Table(
    "auditorias_defectos",
    Base.metadata,
    Column("auditoria_id", Integer, ForeignKey("auditorias_producto.id", ondelete="CASCADE"), primary_key=True),
    Column("defecto_id", Integer, ForeignKey("defectos.id", ondelete="CASCADE"), primary_key=True),
)


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

    # Relación con los defectos (muchos a muchos) usando la Table intermedia
    defectos = relationship(
        "Defecto",
        secondary=auditorias_defectos,
        back_populates="auditorias"
    )

    # Registro automático
    fecha_registro = Column(DateTime(timezone=True), server_default=func.now())
    fecha_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())