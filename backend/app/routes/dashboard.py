from fastapi import APIRouter, Depends
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from app.database.connection import SessionLocal

from app.models.produccion import Produccion
from app.models.defecto import Defecto



router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
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
# DASHBOARD GENERAL
# ==========================================


@router.get("/stats")
def dashboard_stats(
    db: Session = Depends(get_db)
):


    # ==========================
    # TOTAL LOTES
    # ==========================


    total_lotes = db.query(
        func.count(Produccion.id)
    ).scalar()



    # ==========================
    # TOTAL UNIDADES
    # ==========================


    unidades = db.query(
        func.sum(Produccion.cantidad)
    ).scalar()



    unidades = unidades or 0




    # ==========================
    # TOTAL DEFECTOS
    # ==========================


    total_defectos = db.query(
        func.count(Defecto.id)
    ).scalar()



    total_defectos = total_defectos or 0





    # ==========================
    # EFICIENCIA
    # ==========================


    if unidades > 0:


        eficiencia = (
            (unidades - total_defectos)
            /
            unidades
        ) * 100


    else:


        eficiencia = 100





    return {


        "lotes":
            total_lotes or 0,


        "unidades":
            unidades,


        "defectos":
            total_defectos,


        "eficiencia":
            f"{round(eficiencia,2)}%"

    }








# ==========================================
# ÚLTIMOS REGISTROS PRODUCCIÓN
# ==========================================


@router.get("/ultimos")
def ultimos_registros(
    db: Session = Depends(get_db)
):


    registros = db.query(
        Produccion
    ).order_by(
        desc(Produccion.id)
    ).limit(5).all()



    return [


        {


            "fecha":

                r.fecha_registro.strftime("%d/%m/%Y")
                if r.fecha_registro
                else "--",




            "linea":

                r.linea_produccion
                if r.linea_produccion
                else "--",




            "producto":

                r.tipo_producto
                if r.tipo_producto
                else "--",




            "estado":

                "OK"


        }



        for r in registros


    ]










# ==========================================
# ALERTAS DEL DASHBOARD
# ==========================================


@router.get("/alerts")
def dashboard_alerts(
    db: Session = Depends(get_db)
):


    alertas = []





    # ==========================
    # DEFECTOS CRÍTICOS
    # ==========================


    defectos_criticos = db.query(
        Defecto
    ).filter(
        Defecto.clasificacion == "Crítico"
    ).all()




    for defecto in defectos_criticos:


        alertas.append({


            "tipo":

                "danger",



            "mensaje":

                f"Defecto crítico detectado: {defecto.tipo_defecto}"


        })








    # ==========================
    # DEFECTOS MAYORES
    # ==========================


    defectos_mayores = db.query(
        Defecto
    ).filter(
        Defecto.clasificacion == "Mayor"
    ).all()




    for defecto in defectos_mayores:


        alertas.append({


            "tipo":

                "warning",



            "mensaje":

                f"Defecto mayor detectado: {defecto.tipo_defecto}"


        })









    # ==========================
    # BAJA PRODUCCIÓN
    # ==========================


    lotes = db.query(
        Produccion
    ).all()



    for lote in lotes:


        if lote.cantidad and lote.cantidad < 50:



            alertas.append({


                "tipo":

                    "warning",



                "mensaje":

                    f"Lote {lote.codigo_lote} con baja producción"


            })









    # ==========================
    # SIN ALERTAS
    # ==========================


    if not alertas:


        alertas.append({


            "tipo":

                "success",



            "mensaje":

                "Sistema operando correctamente"


        })






    return alertas