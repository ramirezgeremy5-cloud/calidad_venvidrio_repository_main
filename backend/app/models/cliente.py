from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.database.connection import Base

class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False, unique=True)
    direccion = Column(String(200), nullable=True)
    contacto = Column(String(100), nullable=True)
    
    fecha_registro = Column(DateTime(timezone=True), server_default=func.now())

    # Método opcional para que se vea bonito si lo imprimes en consola
    def __repr__(self):
        return f"<Cliente(nombre='{self.nombre}', id={self.id})>"