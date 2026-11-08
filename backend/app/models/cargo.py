from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from app.database.connection import Base
from datetime import datetime


class Cargo(Base):
    __tablename__ = "cargos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(60), unique=True, nullable=False, index=True)
    
    # 👇 NUEVA COLUMNA: Guarda los permisos como texto (ej: "auditoria_producto,produccion")
    permisos = Column(String(255), nullable=True, default="")
    
    creado_en = Column(DateTime, default=datetime.utcnow, nullable=False)

    # ==========================================
    # Relación inversa con Usuario
    # ==========================================
    # NOTA: Usamos el string "Usuario" para evitar importación circular.
    # SQLAlchemy resolverá la clase automáticamente al mapear la Base.
    usuarios = relationship(
        "Usuario", 
        back_populates="cargo", 
        passive_deletes=True
    )

    def __repr__(self):
        return f"<Cargo(id={self.id}, nombre='{self.nombre}', permisos='{self.permisos}')>"