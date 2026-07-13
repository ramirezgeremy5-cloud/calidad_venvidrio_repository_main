from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import SessionLocal
from app.models.auditoria import Auditoria
from app.schemas.auditoria import (
    AuditoriaCreate,
    AuditoriaResponse
)

router = APIRouter(
    prefix="/auditorias",
    tags=["Auditorias"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=list[AuditoriaResponse])
def listar_auditorias(db: Session = Depends(get_db)):
    return db.query(Auditoria).all()


@router.post("/", response_model=AuditoriaResponse)
def crear_auditoria(
    auditoria: AuditoriaCreate,
    db: Session = Depends(get_db)
):
    nueva = Auditoria(**auditoria.model_dump())

    db.add(nueva)
    db.commit()
    db.refresh(nueva)

    return nueva