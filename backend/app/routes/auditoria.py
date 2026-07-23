# app/routes/auditoria.py

from fastapi import APIRouter, Depends, HTTPException
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




# ==========================================
# CONEXIÓN DATABASE
# ==========================================

def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()





# ==========================================
# LISTAR AUDITORÍAS
# ==========================================


@router.get(
    "/",
    response_model=list[AuditoriaResponse]
)
def listar_auditorias(
    db: Session = Depends(get_db)
):

    auditorias = db.query(
        Auditoria
    ).order_by(
        Auditoria.id.desc()
    ).all()


    return auditorias








# ==========================================
# CREAR AUDITORÍA
# ==========================================


@router.post(
    "/",
    response_model=AuditoriaResponse
)
def crear_auditoria(
    auditoria: AuditoriaCreate,
    db: Session = Depends(get_db)
):


    nueva = Auditoria(

        tipo_auditoria =
            auditoria.tipo_auditoria,


        area =
            auditoria.area,


        auditor =
            auditoria.auditor,


        norma =
            auditoria.norma,


        observaciones =
            auditoria.observaciones,


        cumplimiento =
            auditoria.cumplimiento,


        no_conformidades =
            auditoria.no_conformidades,


        estado =
            auditoria.estado

    )



    db.add(nueva)

    db.commit()

    db.refresh(nueva)



    return nueva








# ==========================================
# BUSCAR POR ID
# ==========================================


@router.get(
    "/{auditoria_id}",
    response_model=AuditoriaResponse
)
def obtener_auditoria(
    auditoria_id:int,
    db:Session = Depends(get_db)
):


    auditoria = db.query(
        Auditoria
    ).filter(
        Auditoria.id == auditoria_id
    ).first()



    if not auditoria:

        raise HTTPException(
            status_code=404,
            detail="Auditoría no encontrada"
        )



    return auditoria







# ==========================================
# ELIMINAR AUDITORÍA
# ==========================================


@router.delete(
    "/{auditoria_id}"
)
def eliminar_auditoria(
    auditoria_id:int,
    db:Session = Depends(get_db)
):


    auditoria = db.query(
        Auditoria
    ).filter(
        Auditoria.id == auditoria_id
    ).first()



    if not auditoria:

        raise HTTPException(
            status_code=404,
            detail="Auditoría no encontrada"
        )



    db.delete(
        auditoria
    )

    db.commit()



    return {

        "mensaje":
            "Auditoría eliminada correctamente"

    }