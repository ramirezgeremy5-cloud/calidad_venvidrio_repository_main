from sqlalchemy import Column, Integer, String, Text, DateTime, Float
from sqlalchemy.sql import func
from app.database.connection import Base


class Produccion(Base):
    __tablename__ = "produccion"

    id = Column(Integer, primary_key=True, index=True)

    codigo_lote = Column(
        String(30),
        unique=True,
        nullable=False
    )

    linea_produccion = Column(
        String(50),
        nullable=False
    )

    tipo_producto = Column(
        String(50),
        nullable=False
    )

    cantidad = Column(
        Integer,
        nullable=False
    )

    operador = Column(
        String(100),
        nullable=False
    )

    turno = Column(
        String(50),
        nullable=False
    )

    observaciones = Column(Text)

    # ========================================================
    # CAMBIOS: CLIENTE COMO TEXTO LIBRE (Ya no es ForeignKey)
    # ========================================================
    cliente = Column(
        String(100),
        nullable=True
    )
    # ========================================================

    molde = Column(
        String(100),
        nullable=True
    )
    
    item = Column(
        String(50),
        nullable=True
    )

    # ========================================================
    # NUEVOS CAMPOS PARA LA SÁBANA
    # ========================================================
    paletas = Column(
        Integer,
        nullable=True
    )

    gruesas = Column(
        Float,
        nullable=True
    )
    # ========================================================

    # ========================================================
    # NUEVO CAMPO PARA AUDITORÍA ALINEADA
    # ========================================================
    estado_auditoria = Column(
        String(20),
        nullable=False,
        server_default="Pendiente"
    )  # Valores: "Pendiente", "Auditado", "Rechazado"
    # ========================================================

    fecha_produccion = Column(
        DateTime(timezone=True),
        nullable=True
    )

    fecha_registro = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    fecha_actualizacion = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )