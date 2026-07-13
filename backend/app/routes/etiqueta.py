from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import SessionLocal
from app.models.etiqueta import Etiqueta
from app.schemas.etiqueta import (
    EtiquetaCreate,
    EtiquetaResponse
)

router = APIRouter(
    prefix="/etiquetas",
    tags=["Etiquetas"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=list[EtiquetaResponse])
def listar_etiquetas(db: Session = Depends(get_db)):
    return db.query(Etiqueta).all()


@router.post("/", response_model=EtiquetaResponse)
def crear_etiqueta(
    etiqueta: EtiquetaCreate,
    db: Session = Depends(get_db)
):
    nueva = Etiqueta(**etiqueta.model_dump())

    db.add(nueva)
    db.commit()
    db.refresh(nueva)

    return nueva