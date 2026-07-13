from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func

from app.database.connection import Base


class Etiqueta(Base):
    __tablename__ = "etiquetas"

    id = Column(Integer, primary_key=True, index=True)

    codigo_etiqueta = Column(
        String(30),
        nullable=False,
        unique=True
    )

    codigo_lote = Column(
        String(30),
        nullable=False
    )

    cliente = Column(
        String(100),
        nullable=False
    )

    producto = Column(
        String(100),
        nullable=False
    )

    cantidad = Column(
        Integer,
        nullable=False
    )

    estado = Column(
        String(30),
        nullable=False
    )

    observaciones = Column(Text)

    fecha_registro = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    fecha_actualizacion = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )