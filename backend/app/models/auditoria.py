from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func

from app.database.connection import Base


class Auditoria(Base):
    __tablename__ = "auditorias"

    id = Column(Integer, primary_key=True, index=True)

    tipo_auditoria = Column(String(100), nullable=False)

    area = Column(String(100), nullable=False)

    auditor = Column(String(100), nullable=False)

    norma = Column(String(100), nullable=False)

    observaciones = Column(Text)

    cumplimiento = Column(Integer, default=0)

    no_conformidades = Column(Integer, default=0)

    estado = Column(String(50), default="En proceso")

    fecha_registro = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    fecha_actualizacion = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )