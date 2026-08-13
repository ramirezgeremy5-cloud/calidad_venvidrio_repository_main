# app/models/inspeccion.py
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey
from sqlalchemy.sql import func
from app.database.connection import Base


class Inspeccion(Base):
    __tablename__ = "inspecciones"

    id = Column(Integer, primary_key=True, index=True)
    
    # Datos del encabezado
    fecha = Column(DateTime, nullable=False)
    maquina = Column(String(50))
    linea = Column(String(50))
    cliente = Column(String(100))
    molde = Column(String(50))
    acabado = Column(String(50))
    item = Column(String(50))
    numero = Column(String(50))
    
    # Datos de producción
    ticket = Column(String(50))
    lote = Column(String(50))
    turno_grupo = Column(String(50))
    ok = Column(Integer, default=0)
    ret = Column(Integer, default=0)
    defectos = Column(Text)
    cavidad = Column(String(20))
    cantidad = Column(Integer)
    
    # Estadísticas
    paletas_inspeccionadas = Column(Integer, default=0)
    paletas_buenas = Column(Integer, default=0)
    paletas_retenidas = Column(Integer, default=0)
    porcentaje_rechazo = Column(Float, default=0)
    
    # Defectos por categoría
    criticos_a = Column(Integer, default=0)
    criticos_r = Column(Integer, default=0)
    mayores_b_plus_a = Column(Integer, default=0)
    mayores_b_plus_r = Column(Integer, default=0)
    mayores_b_minus_a = Column(Integer, default=0)
    mayores_b_minus_r = Column(Integer, default=0)
    menores_a = Column(Integer, default=0)
    menores_r = Column(Integer, default=0)
    
    # Tamaños
    tamano_muestra = Column(Integer)
    tamano_poblacion = Column(Integer)
    bot_por_camada = Column(Integer)
    bot_por_paleta = Column(Integer)
    gruesas_por_paleta = Column(Integer)
    
    # Observaciones
    observaciones = Column(Text)
    
    # Responsable
    responsable_nombre = Column(String(100))
    responsable_grupo = Column(String(50))
    firma = Column(Text)  # Base64 de la firma
    
    fecha_registro = Column(DateTime(timezone=True), server_default=func.now())
    fecha_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relación con auditoría
    auditoria_id = Column(Integer, ForeignKey("auditorias.id"), nullable=True)