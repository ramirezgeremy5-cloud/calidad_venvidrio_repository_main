from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Float,
    ForeignKey, Boolean, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.connection import Base


class Defecto(Base):
    __tablename__ = "defectos"

    id = Column(Integer, primary_key=True, index=True)

    # ==========================================
    # VÍNCULO CON EL LOTE DE PRODUCCIÓN
    # ==========================================
    lote_id = Column(
        Integer,
        ForeignKey("produccion.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    codigo_lote = Column(
        String(30),
        nullable=False,
        index=True
    )

    lote = relationship(
        "Produccion",
        backref="defectos",
        foreign_keys=[lote_id],
        lazy="joined"
    )

    # ==========================================
    # IDENTIFICADOR DE GRUPO
    # ==========================================
    # Agrupa varios defectos que le ocurren a la MISMA cantidad de piezas
    grupo_id = Column(
        String(100),
        nullable=True,
        index=True
    )

    # ==========================================
    # DATOS DEL DEFECTO
    # ==========================================
    tipo_defecto = Column(
        String(100),
        nullable=False
    )

    clasificacion = Column(
        String(20),
        nullable=False,
        index=True
    )

    cantidad_piezas = Column(
        Integer,
        nullable=False,
        default=0
    )

    zona_deteccion = Column(
        String(100),
        nullable=True
    )

    inspector = Column(
        String(100),
        nullable=False
    )

    descripcion = Column(
        Text,
        nullable=True
    )

    observaciones = Column(
        Text,
        nullable=True
    )

    # ==========================================
    # CONTEXTO DE EVALUACIÓN
    # ==========================================
    resultado_lote = Column(
        String(20),
        nullable=True,
        index=True
    )

    origen = Column(
        String(20),
        nullable=False,
        default="manual"
    )

    validado = Column(
        Boolean,
        nullable=False,
        default=True
    )

    notas_internas = Column(
        Text,
        nullable=True
    )

    # ==========================================
    # DATOS DE INSPECCIÓN (Muestra)
    # ==========================================
    tamano_muestra = Column(Integer, nullable=True)
    canastas_inspeccionadas = Column(Integer, nullable=True)
    
    # 👇 NUEVOS CAMPOS DE MUESTRA enviados desde el JS
    tamano_poblacion = Column(Integer, nullable=True)
    botellas_por_caja = Column(Integer, nullable=True)
    botellas_por_paleta = Column(Integer, nullable=True)
    gruesas_por_paleta = Column(Integer, nullable=True)

    # ==========================================
    # FECHAS
    # ==========================================
    fecha_registro = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True
    )

    fecha_actualizacion = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # ==========================================
    # ÍNDICES COMPUESTOS (rendimiento)
    # ==========================================
    __table_args__ = (
        Index("ix_defectos_lote_clasificacion", "codigo_lote", "clasificacion"),
        Index("ix_defectos_lote_resultado", "codigo_lote", "resultado_lote"),
        Index("ix_defectos_fecha_clasificacion", "fecha_registro", "clasificacion"),
        Index("ix_defectos_lote_grupo", "codigo_lote", "grupo_id"), # 👈 Nuevo índice para agrupar rápido
    )

    # ==========================================
    # REPRESENTACIÓN (debug)
    # ==========================================
    def __repr__(self):
        return (
            f"<Defecto(id={self.id}, lote='{self.codigo_lote}', "
            f"tipo='{self.tipo_defecto}', clase='{self.clasificacion}', "
            f"piezas={self.cantidad_piezas}, grupo='{self.grupo_id}')>"
        )