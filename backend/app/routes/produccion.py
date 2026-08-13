from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import datetime, date
from typing import Optional

from app.database.connection import SessionLocal
from app.models.produccion import Produccion
from app.models.cliente import Cliente
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
# LISTAR PRODUCCIÓN (CON JOINLOAD CLIENTE)
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
    codigo: Optional[str] = Query(None, description="Filtrar por código de lote"),
    producto: Optional[str] = Query(None, description="Filtrar por tipo de producto"),
    linea: Optional[str] = Query(None, description="Filtrar por línea de producción"),
    operador: Optional[str] = Query(None, description="Filtrar por operador"),
    turno: Optional[str] = Query(None, description="Filtrar por turno"),
    fecha_desde: Optional[date] = Query(None, description="Filtrar desde fecha (YYYY-MM-DD)"),
    fecha_hasta: Optional[date] = Query(None, description="Filtrar hasta fecha (YYYY-MM-DD)"),
    skip: int = Query(0, description="Número de registros a saltar (paginación)"),
    limit: int = Query(100, description="Límite de registros por página"),
    db: Session = Depends(get_db)
):
    """Lista producción con filtros opcionales"""
    
    # JOIN para traer el cliente
    query = db.query(Produccion).options(joinedload(Produccion.cliente))
    
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
# OBTENER OPCIONES DE FILTROS
# =========================
@router.get("/opciones", response_model=dict)
def obtener_opciones_filtros(db: Session = Depends(get_db)):
    """Obtiene las opciones disponibles para los filtros"""
    
    productos = db.query(Produccion.tipo_producto).distinct().all()
    lineas = db.query(Produccion.linea_produccion).distinct().all()
    operadores = db.query(Produccion.operador).distinct().all()
    turnos = db.query(Produccion.turno).distinct().all()
    
    # Traemos los clientes para el filtro
    try:
        clientes = db.query(Cliente.nombre).distinct().all()
        lista_clientes = [c[0] for c in clientes if c[0]]
    except Exception:
        lista_clientes = []
    
    return {
        "productos": [p[0] for p in productos if p[0]],
        "lineas": [l[0] for l in lineas if l[0]],
        "operadores": [o[0] for o in operadores if o[0]],
        "turnos": [t[0] for t in turnos if t[0]],
        "clientes": lista_clientes
    }


# =========================
# OBTENER ESTADÍSTICAS DE PRODUCCIÓN
# =========================
@router.get("/estadisticas", response_model=dict)
def obtener_estadisticas(db: Session = Depends(get_db)):
    """Obtiene estadísticas de producción para el dashboard"""
    
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
    produccion = db.query(Produccion).options(joinedload(Produccion.cliente)).filter(
        Produccion.id == produccion_id
    ).first()

    if not produccion:
        raise HTTPException(status_code=404, detail="Producción no encontrada.")
    return produccion


# =========================
# CREAR PRODUCCIÓN (CON CLIENTE_ID)
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
        cliente_id=datos.cliente_id,
        molde=datos.molde,
        item=datos.item
    )

    db.add(nueva)
    db.commit()
    db.refresh(nueva)

    # Devolvemos el objeto con el cliente cargado
    return db.query(Produccion).options(joinedload(Produccion.cliente)).filter(Produccion.id == nueva.id).first()


# =========================
# ACTUALIZAR PRODUCCIÓN (CON CLIENTE_ID)
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

    # Actualizar campos
    if datos.codigo_lote is not None:
        produccion.codigo_lote = datos.codigo_lote
    
    if datos.linea_produccion is not None:
        produccion.linea_produccion = datos.linea_produccion
    
    if datos.tipo_producto is not None:
        produccion.tipo_producto = datos.tipo_producto
    
    if datos.cantidad is not None:
        produccion.cantidad = datos.cantidad
    
    if datos.operador is not None:
        produccion.operador = datos.operador
    
    if datos.turno is not None:
        produccion.turno = datos.turno
    
    if datos.observaciones is not None:
        produccion.observaciones = datos.observaciones
    
    if datos.fecha_produccion is not None:
        produccion.fecha_produccion = datos.fecha_produccion

    if datos.cliente_id is not None:
        produccion.cliente_id = datos.cliente_id
    if datos.molde is not None:
        produccion.molde = datos.molde
    if datos.item is not None:
        produccion.item = datos.item

    db.commit()
    db.refresh(produccion)

    return db.query(Produccion).options(joinedload(Produccion.cliente)).filter(Produccion.id == produccion.id).first()


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