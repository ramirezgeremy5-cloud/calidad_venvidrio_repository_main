from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from app.database.connection import Base



class Etiqueta(Base):

    __tablename__ = "etiquetas"


    id = Column(
        Integer,
        primary_key=True,
        index=True
    )


    codigo_lote = Column(
        String(50),
        nullable=False
    )


    producto = Column(
        String(100),
        nullable=False
    )


    dimensiones = Column(
        String(50),
        nullable=False
    )


    espesor = Column(
        String(20),
        nullable=False
    )


    cantidad = Column(
        Integer,
        nullable=False
    )


    cliente = Column(
        String(100),
        nullable=False
    )


    norma = Column(
        String(100)
    )


    estado = Column(
        String(30),
        default="aprobado"
    )


    qr_codigo = Column(
        String(255)
    )


    fecha_registro = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )