from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from typing import Optional

from app.database.connection import SessionLocal
from app.models.produccion import Produccion
# from app.models.cliente import Cliente  <-- Ya no necesitamos tabla maestra
from app.schemas.produccion import (
    ProduccionCreate,
    ProduccionUpdate,
    ProduccionResponse
)

router = APIRouter(
    prefix="/produccion",
    tags=["Producción"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================
# LISTAR PRODUCCIÓN (SIN JOINS, 100% ESTABLE)
# =========================
@router.get(
    "/",
    response_model=list[ProduccionResponse]
)
@router.get(
    "",
    response_model=list[ProduccionResponse]
)
def listar_produccion(
    codigo: Optional[str] = Query(None),
    producto: Optional[str] = Query(None),
    linea: Optional[str] = Query(None),
    operador: Optional[str] = Query(None),
    turno: Optional[str] = Query(None),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    skip: int = Query(0),
    limit: int = Query(100),
    db: Session = Depends(get_db)
):
    query = db.query(Produccion)
    
    if codigo:
        query = query.filter(Produccion.codigo_lote.ilike(f"%{codigo}%"))
    if producto:
        query = query.filter(Produccion.tipo_producto.ilike(f"%{producto}%"))
    if linea:
        query = query.filter(Produccion.linea_produccion.ilike(f"%{linea}%"))
    if operador:
        query = query.filter(Produccion.operador.ilike(f"%{operador}%"))
    if turno:
        query = query.filter(Produccion.turno.ilike(f"%{turno}%"))
    if fecha_desde:
        query = query.filter(Produccion.fecha_registro >= datetime.combine(fecha_desde, datetime.min.time()))
    if fecha_hasta:
        query = query.filter(Produccion.fecha_registro <= datetime.combine(fecha_hasta, datetime.max.time()))
    
    query = query.order_by(Produccion.fecha_registro.desc())
    return query.offset(skip).limit(limit).all()


# =========================
# OBTENER OPCIONES DE FILTROS (Para los filtros)
# =========================
@router.get("/opciones", response_model=dict)
def obtener_opciones_filtros(db: Session = Depends(get_db)):
    productos = db.query(Produccion.tipo_producto).distinct().all()
    lineas = db.query(Produccion.linea_produccion).distinct().all()
    operadores = db.query(Produccion.operador).distinct().all()
    turnos = db.query(Produccion.turno).distinct().all()
    clientes = db.query(Produccion.cliente).distinct().all()
    
    return {
        "productos": [p[0] for p in productos if p[0]],
        "lineas": [l[0] for l in lineas if l[0]],
        "operadores": [o[0] for o in operadores if o[0]],
        "turnos": [t[0] for t in turnos if t[0]],
        "clientes": [c[0] for c in clientes if c[0]]
    }


# =========================
# OBTENER OPCIONES REGISTRADAS (Para los DATALIST del Frontend)
# =========================
@router.get("/opciones-registradas", response_model=dict)
def obtener_opciones_registradas(db: Session = Depends(get_db)):
    """
    Devuelve listas únicas de todos los valores que los usuarios 
    han escrito en los campos de texto. Sirve para llenar los datalists.
    """
    productos = db.query(Produccion.tipo_producto).distinct().all()
    lineas = db.query(Produccion.linea_produccion).distinct().all()
    operadores = db.query(Produccion.operador).distinct().all()
    turnos = db.query(Produccion.turno).distinct().all()
    clientes = db.query(Produccion.cliente).distinct().all()
    
    return {
        "productos": [p[0] for p in productos if p[0]],
        "lineas": [l[0] for l in lineas if l[0]],
        "operadores": [o[0] for o in operadores if o[0]],
        "turnos": [t[0] for t in turnos if t[0]],
        "clientes": [c[0] for c in clientes if c[0]]
    }


# =========================
# OBTENER ESTADÍSTICAS DE PRODUCCIÓN
# =========================
@router.get("/estadisticas", response_model=dict)
def obtener_estadisticas(db: Session = Depends(get_db)):
    total_lotes = db.query(func.count(Produccion.id)).scalar() or 0
    total_unidades = db.query(func.sum(Produccion.cantidad)).scalar() or 0
    
    lotes_por_linea = db.query(
        Produccion.linea_produccion,
        func.count(Produccion.id).label('total')
    ).group_by(Produccion.linea_produccion).all()
    
    unidades_por_producto = db.query(
        Produccion.tipo_producto,
        func.sum(Produccion.cantidad).label('total')
    ).group_by(Produccion.tipo_producto).all()
    
    return {
        "total_lotes": total_lotes,
        "total_unidades": total_unidades,
        "lotes_por_linea": [
            {"linea": l[0] or "Sin especificar", "total": l[1]}
            for l in lotes_por_linea
        ],
        "unidades_por_producto": [
            {"producto": p[0] or "Sin especificar", "total": p[1] or 0}
            for p in unidades_por_producto
        ]
    }


# =========================
# OBTENER UNA PRODUCCIÓN
# =========================
@router.get("/{produccion_id}", response_model=ProduccionResponse)
def obtener_produccion(produccion_id: int, db: Session = Depends(get_db)):
    produccion = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not produccion:
        raise HTTPException(status_code=404, detail="Producción no encontrada.")
    return produccion


# =========================
# CREAR PRODUCCIÓN (CON CAMPOS DE TEXTO Y NUEVOS CAMPOS)
# =========================
@router.post(
    "/",
    response_model=ProduccionResponse,
    status_code=201
)
@router.post(
    "",
    response_model=ProduccionResponse,
    status_code=201
)
def crear_produccion(
    datos: ProduccionCreate,
    db: Session = Depends(get_db)
):
    existe = db.query(Produccion).filter(
        Produccion.codigo_lote == datos.codigo_lote
    ).first()

    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código de lote ya existe."
        )

    nueva = Produccion(
        codigo_lote=datos.codigo_lote,
        linea_produccion=datos.linea_produccion,
        tipo_producto=datos.tipo_producto,
        cantidad=datos.cantidad,
        operador=datos.operador,
        turno=datos.turno,
        observaciones=datos.observaciones,
        fecha_produccion=datos.fecha_produccion,
        # NUEVOS CAMPOS REGISTRABLES
        cliente=datos.cliente,        # <-- Ahora es texto libre
        molde=datos.molde,
        item=datos.item,
        # NUEVOS CAMPOS NUMÉRICOS
        paletas=datos.paletas,
        gruesas=datos.gruesas
    )

    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


# =========================
# ACTUALIZAR PRODUCCIÓN (CON CAMPOS DE TEXTO Y NUEVOS CAMPOS)
# =========================
@router.put("/{produccion_id}", response_model=ProduccionResponse)
def actualizar_produccion(
    produccion_id: int,
    datos: ProduccionUpdate,
    db: Session = Depends(get_db)
):
    produccion = db.query(Produccion).filter(
        Produccion.id == produccion_id
    ).first()

    if not produccion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producción no encontrada."
        )

    existe = db.query(Produccion).filter(
        Produccion.codigo_lote == datos.codigo_lote,
        Produccion.id != produccion_id
    ).first()

    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código de lote ya existe."
        )

    # Actualizar campos de texto
    if datos.codigo_lote is not None: produccion.codigo_lote = datos.codigo_lote
    if datos.linea_produccion is not None: produccion.linea_produccion = datos.linea_produccion
    if datos.tipo_producto is not None: produccion.tipo_producto = datos.tipo_producto
    if datos.cantidad is not None: produccion.cantidad = datos.cantidad
    if datos.operador is not None: produccion.operador = datos.operador
    if datos.turno is not None: produccion.turno = datos.turno
    if datos.observaciones is not None: produccion.observaciones = datos.observaciones
    if datos.fecha_produccion is not None: produccion.fecha_produccion = datos.fecha_produccion

    # NUEVOS CAMPOS REGISTRABLES (Texto)
    if datos.cliente is not None: produccion.cliente = datos.cliente
    if datos.molde is not None: produccion.molde = datos.molde
    if datos.item is not None: produccion.item = datos.item

    # NUEVOS CAMPOS NUMÉRICOS
    if datos.paletas is not None: produccion.paletas = datos.paletas
    if datos.gruesas is not None: produccion.gruesas = datos.gruesas

    db.commit()
    db.refresh(produccion)
    return produccion


# =========================
# ELIMINAR PRODUCCIÓN
# =========================
@router.delete("/{produccion_id}", status_code=204)
def eliminar_produccion(produccion_id: int, db: Session = Depends(get_db)):
    produccion = db.query(Produccion).filter(
        Produccion.id == produccion_id
    ).first()

    if not produccion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producción no encontrada."
        )

    db.delete(produccion)
    db.commit()
    return None