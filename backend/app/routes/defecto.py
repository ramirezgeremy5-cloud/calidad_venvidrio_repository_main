from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import SessionLocal
from app.models.defecto import Defecto
from app.schemas.defecto import (
    DefectoCreate,
    DefectoResponse
)

router = APIRouter(
    prefix="/defectos",
    tags=["Defectos"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=list[DefectoResponse])
def listar_defectos(db: Session = Depends(get_db)):
    return db.query(Defecto).all()


@router.post("/", response_model=DefectoResponse)
def crear_defecto(
    defecto: DefectoCreate,
    db: Session = Depends(get_db)
):
    nuevo = Defecto(**defecto.model_dump())

    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    return nuevo