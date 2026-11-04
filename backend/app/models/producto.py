from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from datetime import datetime

from app.database.connection import Base


class Producto(Base):
    __tablename__ = "producto"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False, unique=True, index=True)

    # Ficha técnica
    item = Column(String, nullable=True, index=True)           # ← NUEVO: código V-XXXXXX
    acabado = Column(String, nullable=True)                    # ← NUEVO: acabado del envase
    capacidad_ml = Column(Integer, nullable=True)              # volumen nominal en ml
    bpp = Column(Float, nullable=True)                         # ← NUEVO: botellas por paleta
    bpc = Column(Integer, nullable=True)                       # ← NUEVO: botellas por caja/canasta
    juego_envases = Column(String, nullable=True)              # ← NUEVO: "12x4"
    material = Column(String, nullable=True)                   # ✅ NUEVO: vidrio transparente, ámbar, etc.
    tipo_boca = Column(String, nullable=True)                  # ✅ NUEVO: Rosca 28mm, Corona 26mm, etc.
    dimensiones = Column(String, nullable=True)                # ✅ NUEVO: "8cm x 8cm x 90cm"

    # Control
    activo = Column(Boolean, default=True, index=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow, index=True)

    def __repr__(self):
        return f"<Producto(id={self.id}, nombre='{self.nombre}', cap={self.capacidad_ml}ml)>"