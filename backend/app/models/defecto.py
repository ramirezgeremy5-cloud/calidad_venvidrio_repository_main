from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func

from app.database.connection import Base


class Defecto(Base):
    __tablename__ = "defectos"

    id = Column(Integer, primary_key=True, index=True)

    codigo_lote = Column(String(30), nullable=False)

    tipo_producto = Column(String(100), nullable=True)

    tipo_defecto = Column(String(100), nullable=False)

    clasificacion = Column(String(30), nullable=False, default="Menor")

    cantidad_piezas = Column(Integer, nullable=False, default=1)

    zona_deteccion = Column(String(100), nullable=True)

    inspector = Column(String(100), nullable=True)

    descripcion = Column(Text, nullable=True)

    ubicacion_pieza = Column(String(50), nullable=True)

    fecha_registro = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    fecha_actualizacion = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )