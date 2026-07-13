from sqlalchemy import Column, Integer, String
from app.database.connection import Base

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String)
    correo = Column(String)
    password = Column(String)
    rol_id = Column(Integer)