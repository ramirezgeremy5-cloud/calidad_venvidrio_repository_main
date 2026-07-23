# app/routes/defecto.py


from fastapi import APIRouter, Depends, HTTPException
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
# LISTAR TODOS LOS DEFECTOS
# ==========================================


@router.get(
    "/",
    response_model=list[DefectoResponse]
)
def listar_defectos(

    db: Session = Depends(get_db)

):


    return db.query(

        Defecto

    ).order_by(

        Defecto.id.desc()

    ).all()







# ==========================================
# OBTENER DEFECTO POR ID
# ==========================================


@router.get(
    "/{defecto_id}",
    response_model=DefectoResponse
)
def obtener_defecto(

    defecto_id: int,

    db: Session = Depends(get_db)

):


    defecto = db.query(

        Defecto

    ).filter(

        Defecto.id == defecto_id

    ).first()



    if not defecto:


        raise HTTPException(

            status_code=404,

            detail="Defecto no encontrado"

        )



    return defecto







# ==========================================
# CREAR DEFECTO
# ==========================================


@router.post(
    "/",
    response_model=DefectoResponse
)
def crear_defecto(

    defecto: DefectoCreate,

    db: Session = Depends(get_db)

):


    nuevo_defecto = Defecto(

        codigo_lote =
            defecto.codigo_lote,


        tipo_defecto =
            defecto.tipo_defecto,


        clasificacion =
            defecto.clasificacion,


        cantidad_piezas =
            defecto.cantidad_piezas,


        zona_deteccion =
            defecto.zona_deteccion,


        inspector =
            defecto.inspector,


        descripcion =
            defecto.descripcion,


        ubicacion_pieza =
            defecto.ubicacion_pieza

    )



    db.add(nuevo_defecto)


    db.commit()


    db.refresh(nuevo_defecto)



    return nuevo_defecto







# ==========================================
# ACTUALIZAR DEFECTO
# ==========================================


@router.put(
    "/{defecto_id}",
    response_model=DefectoResponse
)
def actualizar_defecto(

    defecto_id: int,

    datos: DefectoCreate,

    db: Session = Depends(get_db)

):


    defecto = db.query(

        Defecto

    ).filter(

        Defecto.id == defecto_id

    ).first()



    if not defecto:


        raise HTTPException(

            status_code=404,

            detail="Defecto no encontrado"

        )



    defecto.codigo_lote = datos.codigo_lote

    defecto.tipo_defecto = datos.tipo_defecto

    defecto.clasificacion = datos.clasificacion

    defecto.cantidad_piezas = datos.cantidad_piezas

    defecto.zona_deteccion = datos.zona_deteccion

    defecto.inspector = datos.inspector

    defecto.descripcion = datos.descripcion

    defecto.ubicacion_pieza = datos.ubicacion_pieza



    db.commit()


    db.refresh(defecto)



    return defecto







# ==========================================
# ELIMINAR DEFECTO
# ==========================================


@router.delete(
    "/{defecto_id}"
)
def eliminar_defecto(

    defecto_id: int,

    db: Session = Depends(get_db)

):


    defecto = db.query(

        Defecto

    ).filter(

        Defecto.id == defecto_id

    ).first()



    if not defecto:


        raise HTTPException(

            status_code=404,

            detail="Defecto no encontrado"

        )



    db.delete(defecto)


    db.commit()



    return {


        "mensaje":

            "Defecto eliminado correctamente",


        "id_eliminado":

            defecto_id

    }