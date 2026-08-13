from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, date
from typing import Optional
import logging

from app.database.connection import SessionLocal

from app.models.auditoria import Auditoria

from app.schemas.auditoria import (
    AuditoriaCreate,
    AuditoriaResponse,
    AuditoriaUpdate
)

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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


def generar_codigo_auditoria(db: Session) -> str:
    """Genera un código de auditoría con formato AUD-YYYY-NNNN"""
    año = datetime.now().year
    
    # Contar auditorías del año actual
    count = db.query(Auditoria).filter(
        Auditoria.fecha_registro >= datetime(año, 1, 1)
    ).count()
    
    # Generar código: AUD-2026-0001
    codigo = f"AUD-{año}-{str(count + 1).zfill(4)}"
    return codigo


# ==========================================
# LISTAR AUDITORÍAS (CON FILTROS)
# ==========================================

@router.get(
    "/",
    response_model=list[AuditoriaResponse]
)
def listar_auditorias(
    codigo: Optional[str] = Query(None, description="Filtrar por código de auditoría"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo de auditoría"),
    area: Optional[str] = Query(None, description="Filtrar por área/línea"),
    auditor: Optional[str] = Query(None, description="Filtrar por auditor responsable"),
    estado: Optional[str] = Query(None, description="Filtrar por estado (En proceso, Cerrada)"),
    fecha_desde: Optional[date] = Query(None, description="Filtrar desde fecha (YYYY-MM-DD)"),
    fecha_hasta: Optional[date] = Query(None, description="Filtrar hasta fecha (YYYY-MM-DD)"),
    skip: int = Query(0, description="Número de registros a saltar (paginación)"),
    limit: int = Query(100, description="Límite de registros por página"),
    db: Session = Depends(get_db)
):
    """Lista auditorías con filtros opcionales"""
    
    query = db.query(Auditoria)
    
    # Aplicar filtros
    filtros_aplicados = []
    
    if codigo:
        query = query.filter(Auditoria.codigo.ilike(f"%{codigo}%"))
        filtros_aplicados.append(f"código: {codigo}")
    
    if tipo:
        query = query.filter(Auditoria.tipo_auditoria.ilike(f"%{tipo}%"))
        filtros_aplicados.append(f"tipo: {tipo}")
    
    if area:
        query = query.filter(Auditoria.area.ilike(f"%{area}%"))
        filtros_aplicados.append(f"área: {area}")
    
    if auditor:
        query = query.filter(Auditoria.auditor.ilike(f"%{auditor}%"))
        filtros_aplicados.append(f"auditor: {auditor}")
    
    if estado:
        query = query.filter(Auditoria.estado.ilike(f"%{estado}%"))
        filtros_aplicados.append(f"estado: {estado}")
    
    if fecha_desde:
        fecha_desde_dt = datetime.combine(fecha_desde, datetime.min.time())
        query = query.filter(Auditoria.fecha_registro >= fecha_desde_dt)
        filtros_aplicados.append(f"fecha desde: {fecha_desde}")
    
    if fecha_hasta:
        fecha_hasta_dt = datetime.combine(fecha_hasta, datetime.max.time())
        query = query.filter(Auditoria.fecha_registro <= fecha_hasta_dt)
        filtros_aplicados.append(f"fecha hasta: {fecha_hasta}")
    
    # Ordenar por fecha (más reciente primero)
    query = query.order_by(Auditoria.fecha_registro.desc())
    
    # Aplicar paginación
    total = query.count()
    resultados = query.offset(skip).limit(limit).all()
    
    if filtros_aplicados:
        logger.info(f"📋 Filtros aplicados: {filtros_aplicados}")
    logger.info(f"📊 Total: {total} | Mostrando: {len(resultados)}")
    
    return resultados


# ==========================================
# OBTENER OPCIONES DE FILTROS
# ==========================================

@router.get(
    "/opciones",
    response_model=dict
)
def obtener_opciones_filtros(
    db: Session = Depends(get_db)
):
    """Obtiene las opciones disponibles para los filtros"""
    
    # Obtener valores únicos
    tipos = db.query(Auditoria.tipo_auditoria).distinct().all()
    areas = db.query(Auditoria.area).distinct().all()
    auditores = db.query(Auditoria.auditor).distinct().all()
    estados = db.query(Auditoria.estado).distinct().all()
    
    return {
        "tipos": [t[0] for t in tipos if t[0]],
        "areas": [a[0] for a in areas if a[0]],
        "auditores": [a[0] for a in auditores if a[0]],
        "estados": [e[0] for e in estados if e[0]]
    }


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

    # Generar código automáticamente
    codigo = generar_codigo_auditoria(db)
    logger.info(f"📝 Generando código de auditoría: {codigo}")

    nueva = Auditoria(
        codigo=codigo,  # <-- Código generado automáticamente
        tipo_auditoria=auditoria.tipo_auditoria,
        area=auditoria.area,
        auditor=auditoria.auditor,
        norma=auditoria.norma,
        observaciones=auditoria.observaciones,
        cumplimiento=auditoria.cumplimiento,
        no_conformidades=auditoria.no_conformidades,
        estado=auditoria.estado
    )

    db.add(nueva)
    db.commit()
    db.refresh(nueva)

    logger.info(f"✅ Auditoría creada: {codigo} (ID: {nueva.id})")

    return nueva


# ==========================================
# BUSCAR POR ID
# ==========================================

@router.get(
    "/{auditoria_id}",
    response_model=AuditoriaResponse
)
def obtener_auditoria(
    auditoria_id: int,
    db: Session = Depends(get_db)
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
# BUSCAR POR CÓDIGO
# ==========================================

@router.get(
    "/codigo/{codigo}",
    response_model=AuditoriaResponse
)
def obtener_auditoria_por_codigo(
    codigo: str,
    db: Session = Depends(get_db)
):

    auditoria = db.query(
        Auditoria
    ).filter(
        Auditoria.codigo == codigo
    ).first()

    if not auditoria:

        raise HTTPException(
            status_code=404,
            detail=f"Auditoría con código {codigo} no encontrada"
        )

    return auditoria


# ==========================================
# ACTUALIZAR AUDITORÍA (PUT)
# ==========================================

@router.put(
    "/{auditoria_id}",
    response_model=AuditoriaResponse
)
def actualizar_auditoria(
    auditoria_id: int,
    datos: AuditoriaUpdate,
    db: Session = Depends(get_db)
):

    logger.info(f"🔵 Recibiendo PUT para auditoría ID: {auditoria_id}")

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

    # Actualizar solo los campos que vienen en la petición
    if datos.codigo is not None:
        auditoria.codigo = datos.codigo

    if datos.tipo_auditoria is not None:
        auditoria.tipo_auditoria = datos.tipo_auditoria

    if datos.area is not None:
        auditoria.area = datos.area

    if datos.auditor is not None:
        auditoria.auditor = datos.auditor

    if datos.norma is not None:
        auditoria.norma = datos.norma

    if datos.observaciones is not None:
        auditoria.observaciones = datos.observaciones

    if datos.cumplimiento is not None:
        auditoria.cumplimiento = datos.cumplimiento
        logger.info(f"📊 Cumplimiento actualizado a: {datos.cumplimiento}%")

    if datos.no_conformidades is not None:
        auditoria.no_conformidades = datos.no_conformidades
        logger.info(f"⚠️ No conformidades actualizadas a: {datos.no_conformidades}")

    if datos.estado is not None:
        auditoria.estado = datos.estado
        logger.info(f"📌 Estado actualizado a: {datos.estado}")

    db.commit()
    db.refresh(auditoria)

    logger.info(f"✅ Auditoría {auditoria.codigo} actualizada correctamente")

    return auditoria


# ==========================================
# ACTUALIZAR AUDITORÍA PARCIAL (PATCH)
# ==========================================

@router.patch(
    "/{auditoria_id}",
    response_model=AuditoriaResponse
)
def actualizar_auditoria_parcial(
    auditoria_id: int,
    datos: AuditoriaUpdate,
    db: Session = Depends(get_db)
):

    logger.info(f"🟣 Recibiendo PATCH para auditoría ID: {auditoria_id}")

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

    # Actualizar solo los campos que vienen en la petición
    if datos.codigo is not None:
        auditoria.codigo = datos.codigo

    if datos.tipo_auditoria is not None:
        auditoria.tipo_auditoria = datos.tipo_auditoria

    if datos.area is not None:
        auditoria.area = datos.area

    if datos.auditor is not None:
        auditoria.auditor = datos.auditor

    if datos.norma is not None:
        auditoria.norma = datos.norma

    if datos.observaciones is not None:
        auditoria.observaciones = datos.observaciones

    if datos.cumplimiento is not None:
        auditoria.cumplimiento = datos.cumplimiento
        logger.info(f"📊 Cumplimiento actualizado a: {datos.cumplimiento}%")

    if datos.no_conformidades is not None:
        auditoria.no_conformidades = datos.no_conformidades
        logger.info(f"⚠️ No conformidades actualizadas a: {datos.no_conformidades}")

    if datos.estado is not None:
        auditoria.estado = datos.estado
        logger.info(f"📌 Estado actualizado a: {datos.estado}")

    db.commit()
    db.refresh(auditoria)

    logger.info(f"✅ Auditoría {auditoria.codigo} actualizada via PATCH")

    return auditoria


# ==========================================
# ELIMINAR AUDITORÍA
# ==========================================

@router.delete(
    "/{auditoria_id}"
)
def eliminar_auditoria(
    auditoria_id: int,
    db: Session = Depends(get_db)
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

    logger.info(f"🗑️ Eliminando auditoría: {auditoria.codigo} (ID: {auditoria_id})")

    db.delete(auditoria)
    db.commit()

    return {
        "mensaje": "Auditoría eliminada correctamente"
    }