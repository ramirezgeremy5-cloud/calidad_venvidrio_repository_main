from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.connection import SessionLocal

# IMPORTACIONES CORREGIDAS (Rutas relativas a 'app')
from app.models.cliente import Cliente
from app.schemas.cliente import ClienteCreate, ClienteResponse

router = APIRouter(prefix="/clientes", tags=["Clientes"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/", response_model=list[ClienteResponse])
def listar_clientes(db: Session = Depends(get_db)):
    # Usamos un try-except por si la tabla no existe al inicio
    try:
        return db.query(Cliente).all()
    except Exception:
        return []

@router.post("/", response_model=ClienteResponse, status_code=201)
def crear_cliente(cliente: ClienteCreate, db: Session = Depends(get_db)):
    existe = db.query(Cliente).filter(Cliente.nombre == cliente.nombre).first()
    if existe:
        raise HTTPException(status_code=400, detail="El cliente ya existe")
    nuevo = Cliente(nombre=cliente.nombre, direccion=cliente.direccion, contacto=cliente.contacto)
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo