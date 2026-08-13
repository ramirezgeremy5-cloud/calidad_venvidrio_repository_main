# app/routes/defecto.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, desc  # <-- IMPORTANTE: Agregar estas importaciones
from sqlalchemy.orm import Session

from app.database.connection import SessionLocal

from app.models.defecto import Defecto

from app.schemas.defecto import (
    DefectoCreate,
    DefectoResponse,
    DefectoUpdate
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


@router.get("/", response_model=list[DefectoResponse])
def listar_defectos(
    db: Session = Depends(get_db)
):
    return db.query(Defecto).order_by(Defecto.id.desc()).all()


# ==========================================
# OBTENER DEFECTO POR ID
# ==========================================


@router.get("/{defecto_id}", response_model=DefectoResponse)
def obtener_defecto(
    defecto_id: int,
    db: Session = Depends(get_db)
):
    defecto = db.query(Defecto).filter(Defecto.id == defecto_id).first()
    if not defecto:
        raise HTTPException(
            status_code=404,
            detail="Defecto no encontrado"
        )
    return defecto


# ==========================================
# CREAR DEFECTO
# ==========================================


@router.post("/", response_model=DefectoResponse)
def crear_defecto(
    defecto: DefectoCreate,
    db: Session = Depends(get_db)
):
    nuevo_defecto = Defecto(
        codigo_lote=defecto.codigo_lote,
        tipo_producto=defecto.tipo_producto,
        tipo_defecto=defecto.tipo_defecto,
        clasificacion=defecto.clasificacion,
        cantidad_piezas=defecto.cantidad_piezas,
        zona_deteccion=defecto.zona_deteccion,
        inspector=defecto.inspector,
        descripcion=defecto.descripcion,
        ubicacion_pieza=defecto.ubicacion_pieza
    )

    db.add(nuevo_defecto)
    db.commit()
    db.refresh(nuevo_defecto)

    return nuevo_defecto


# ==========================================
# ACTUALIZAR DEFECTO
# ==========================================


@router.put("/{defecto_id}", response_model=DefectoResponse)
def actualizar_defecto(
    defecto_id: int,
    datos: DefectoUpdate,
    db: Session = Depends(get_db)
):
    defecto = db.query(Defecto).filter(Defecto.id == defecto_id).first()
    if not defecto:
        raise HTTPException(
            status_code=404,
            detail="Defecto no encontrado"
        )

    # Actualizar solo los campos que vienen en la petición
    if datos.codigo_lote is not None:
        defecto.codigo_lote = datos.codigo_lote

    if datos.tipo_producto is not None:
        defecto.tipo_producto = datos.tipo_producto

    if datos.tipo_defecto is not None:
        defecto.tipo_defecto = datos.tipo_defecto

    if datos.clasificacion is not None:
        defecto.clasificacion = datos.clasificacion

    if datos.cantidad_piezas is not None:
        defecto.cantidad_piezas = datos.cantidad_piezas

    if datos.zona_deteccion is not None:
        defecto.zona_deteccion = datos.zona_deteccion

    if datos.inspector is not None:
        defecto.inspector = datos.inspector

    if datos.descripcion is not None:
        defecto.descripcion = datos.descripcion

    if datos.ubicacion_pieza is not None:
        defecto.ubicacion_pieza = datos.ubicacion_pieza

    db.commit()
    db.refresh(defecto)

    return defecto


# ==========================================
# ELIMINAR DEFECTO
# ==========================================


@router.delete("/{defecto_id}")
def eliminar_defecto(
    defecto_id: int,
    db: Session = Depends(get_db)
):
    defecto = db.query(Defecto).filter(Defecto.id == defecto_id).first()
    if not defecto:
        raise HTTPException(
            status_code=404,
            detail="Defecto no encontrado"
        )

    db.delete(defecto)
    db.commit()

    return {
        "mensaje": "Defecto eliminado correctamente",
        "id_eliminado": defecto_id
    }


# ==========================================
# ESTADÍSTICAS DE DEFECTOS (para Dashboard)
# ==========================================


@router.get("/estadisticas")
def estadisticas_defectos(
    db: Session = Depends(get_db)
):
    """Devuelve estadísticas de defectos para el dashboard"""

    # Total de defectos
    total = db.query(func.count(Defecto.id)).scalar() or 0

    # Defectos por clasificación
    criticos = db.query(func.count(Defecto.id)).filter(
        Defecto.clasificacion == "Crítico"
    ).scalar() or 0

    mayores = db.query(func.count(Defecto.id)).filter(
        Defecto.clasificacion == "Mayor"
    ).scalar() or 0

    menores = db.query(func.count(Defecto.id)).filter(
        Defecto.clasificacion == "Menor"
    ).scalar() or 0

    # Top 5 productos con más defectos
    top_productos = db.query(
        Defecto.tipo_producto,
        func.count(Defecto.id).label('total')
    ).group_by(
        Defecto.tipo_producto
    ).order_by(
        desc('total')
    ).limit(5).all()

    return {
        "total": total,
        "criticos": criticos,
        "mayores": mayores,
        "menores": menores,
        "top_productos": [
            {
                "producto": p[0] or "Sin especificar",
                "defectos": p[1]
            }
            for p in top_productos
        ]
    }