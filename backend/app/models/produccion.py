from sqlalchemy import Column, Integer, String, Text, DateTime
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