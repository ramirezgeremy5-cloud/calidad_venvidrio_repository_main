from sqlalchemy import Column, Integer, ForeignKey
from app.database.connection import Base

class AuditoriaDefecto(Base):
    __tablename__ = "auditorias_defectos"

    id = Column(Integer, primary_key=True, index=True)
    auditoria_id = Column(Integer, ForeignKey("auditorias_producto.id"), nullable=False)
    defecto_id = Column(Integer, ForeignKey("defectos.id"), nullable=False)