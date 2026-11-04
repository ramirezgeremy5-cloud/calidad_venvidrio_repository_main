from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.connection import SessionLocal
from app.models.defecto_tipo import DefectoTipo
from app.schemas.defecto_tipo import DefectoTipoCreate

router = APIRouter(
    prefix="/defectos/tipos",
    tags=["Defectos - Catalogo de tipos"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Las cuatro clasificaciones oficiales.
CLASIFICACIONES = ["Crítico", "Mayor B+", "Mayor B-", "Menor"]
_CLASE_CANON = {c.lower(): c for c in CLASIFICACIONES}


def _clasificacion_canonica(valor: str) -> str:
    clase = _CLASE_CANON.get((valor or "").strip().lower())
    if clase is None:
        raise HTTPException(
            status_code=400,
            detail=f"Clasificación inválida. Valores permitidos: {', '.join(CLASIFICACIONES)}"
        )
    return clase


def _normalizar_texto(valor: str) -> str:
    return " ".join((valor or "").split())


@router.get("", response_model=dict)
@router.get("/", response_model=dict)
def obtener_tipos(
    clasificacion: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    ?clasificacion=Crítico  -> { "clasificacion": "...", "tipos": ["..."] }
    sin parámetro            -> catálogo completo agrupado + lista plana
    """
    consulta = db.query(DefectoTipo)

    if clasificacion:
        consulta = consulta.filter(
            func.lower(DefectoTipo.clasificacion) == clasificacion.strip().lower()
        )

    filas = consulta.order_by(
        DefectoTipo.clasificacion,
        DefectoTipo.nombre
    ).all()

    if clasificacion:
        return {
            "clasificacion": filas[0].clasificacion if filas else clasificacion.strip(),
            "tipos": [f.nombre for f in filas]
        }

    agrupado = {}
    for fila in filas:
        agrupado.setdefault(fila.clasificacion, []).append(fila.nombre)

    return {
        "clasificaciones": agrupado,
        "tipos": sorted({f.nombre for f in filas}, key=str.lower)
    }


@router.post("", response_model=dict)
@router.post("/", response_model=dict)
def crear_tipo(
    datos: DefectoTipoCreate,
    db: Session = Depends(get_db)
):
    """Idempotente: si el tipo ya existe en la clasificación, devuelve el existente."""
    clase = _clasificacion_canonica(datos.clasificacion)
    tipo = _normalizar_texto(datos.tipo_defecto)

    if not tipo:
        raise HTTPException(status_code=400, detail="El tipo de defecto no puede quedar vacío.")

    existente = (
        db.query(DefectoTipo)
        .filter(
            DefectoTipo.clasificacion == clase,
            func.lower(DefectoTipo.nombre) == tipo.lower()
        )
        .first()
    )

    if existente:
        return {
            "creado": False,
            "id": existente.id,
            "clasificacion": existente.clasificacion,
            "tipo_defecto": existente.nombre
        }

    nuevo = DefectoTipo(clasificacion=clase, nombre=tipo)
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    return {
        "creado": True,
        "id": nuevo.id,
        "clasificacion": nuevo.clasificacion,
        "tipo_defecto": nuevo.nombre
    }