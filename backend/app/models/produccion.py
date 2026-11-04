from sqlalchemy import Column, Integer, String, Float, DateTime, Date, Text
from datetime import datetime
from app.database.connection import Base


class Produccion(Base):
    __tablename__ = "produccion"

    id = Column(Integer, primary_key=True, index=True)
    codigo_lote = Column(String, unique=True, index=True, nullable=False)
    ticket_carga = Column(String, index=True, nullable=True)

    # Identificación
    planta = Column(String, nullable=True)
    maquina = Column(String, nullable=True)
    linea_produccion = Column(String, nullable=True)
    grupo = Column(String, nullable=True)
    
    # 👇 CAMBIO: Ahora es Integer en lugar de String
    turno = Column(Integer, nullable=True)
    
    operador = Column(String, nullable=True)
    orden = Column(String, nullable=True)

    # Producto
    tipo_producto = Column(String, nullable=True)
    acabado = Column(String, nullable=True)
    material = Column(String, nullable=True)
    tipo_boca = Column(String, nullable=True)
    molde = Column(String, nullable=True)
    item = Column(String, nullable=True)
    bpp = Column(Float, nullable=True)
    capacidad = Column(Integer, nullable=True)
    unidad_capacidad = Column(String, nullable=True, default="ml")
    cliente = Column(String, nullable=True)

    # Cantidades
    cantidad = Column(Integer, nullable=True, default=0)
    paletas = Column(Float, nullable=True)
    cajas_producidas = Column(Float, nullable=True)
    gruesas = Column(Float, nullable=True)
    juego_envases = Column(String, nullable=True)

    # Datos para reporte de inspección
    tamano_muestra = Column(String, nullable=True)
    bot_por_canada = Column(Integer, nullable=True)
    bot_por_paleta = Column(Float, nullable=True)
    gruesas_por_paleta = Column(Float, nullable=True)

    # Estatus
    estatus = Column(String, default="100", index=True)
    estado_auditoria = Column(String, default="pendiente", index=True)
    observaciones = Column(Text, nullable=True)

    # Fechas
    fecha_produccion = Column(Date, nullable=True)
    fecha_registro = Column(DateTime, default=datetime.utcnow, index=True)