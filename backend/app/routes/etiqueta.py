# app/routes/etiqueta.py


from fastapi import APIRouter, Depends, HTTPException
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



# =====================================
# DATABASE
# =====================================

def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()





# =====================================
# LISTAR
# =====================================

@router.get(
    "/",
    response_model=list[EtiquetaResponse]
)
def listar_etiquetas(
    db: Session = Depends(get_db)
):

    try:

        etiquetas = db.query(
            Etiqueta
        ).order_by(
            Etiqueta.id.desc()
        ).all()


        return etiquetas


    except Exception as e:

        print("ERROR ETIQUETAS:", e)

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )






# =====================================
# CREAR
# =====================================

@router.post(
    "/",
    response_model=EtiquetaResponse
)
def crear_etiqueta(
    etiqueta:EtiquetaCreate,
    db:Session=Depends(get_db)
):


    nueva = Etiqueta(
        **etiqueta.model_dump()
    )


    db.add(nueva)

    db.commit()

    db.refresh(nueva)


    return nueva






# =====================================
# BUSCAR
# =====================================

@router.get(
    "/{etiqueta_id}",
    response_model=EtiquetaResponse
)
def obtener_etiqueta(
    etiqueta_id:int,
    db:Session=Depends(get_db)
):


    etiqueta = db.query(
        Etiqueta
    ).filter(
        Etiqueta.id == etiqueta_id
    ).first()



    if not etiqueta:

        raise HTTPException(
            status_code=404,
            detail="Etiqueta no encontrada"
        )



    return etiqueta






# =====================================
# ELIMINAR
# =====================================

@router.delete(
    "/{etiqueta_id}"
)
def eliminar_etiqueta(
    etiqueta_id:int,
    db:Session=Depends(get_db)
):


    etiqueta = db.query(
        Etiqueta
    ).filter(
        Etiqueta.id == etiqueta_id
    ).first()



    if not etiqueta:

        raise HTTPException(
            status_code=404,
            detail="Etiqueta no encontrada"
        )



    db.delete(etiqueta)

    db.commit()



    return {

        "mensaje":
        "Etiqueta eliminada correctamente"

    }