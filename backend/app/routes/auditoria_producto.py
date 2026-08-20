from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from typing import Optional, List

from app.database.connection import SessionLocal
from app.models.produccion import Produccion
from app.models.defecto import Defecto
from app.models.auditoria_producto import AuditoriaProducto
from app.models.auditoria_defecto import AuditoriaDefecto
from app.schemas.auditoria_producto import (
    AuditoriaProductoCreate,
    AuditoriaProductoResponse,
    LotePendienteResponse
)
from app.dependencies.auth import get_current_user
from app.models.usuario import Usuario

router = APIRouter(
    prefix="/auditoria-producto",
    tags=["Auditoría de Producto Terminado"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================
# LISTAR LOTES PENDIENTES DE AUDITAR
# =========================
@router.get("/lotes-pendientes", response_model=List[LotePendienteResponse])
def listar_lotes_pendientes(
    skip: int = Query(0),
    limit: int = Query(100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Listar lotes pendientes de auditoría (requiere autenticación)
    """
    lotes = db.query(Produccion).filter(Produccion.estado_auditoria == "Pendiente").offset(skip).limit(limit).all()
    return lotes


# =========================
# OBTENER DEFECTOS (PARA EL SELECT)
# =========================
@router.get("/defectos")
def obtener_defectos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Obtener lista de defectos para el formulario de auditoría
    """
    defectos = db.query(Defecto).all()
    return defectos


# =========================
# OBTENER DATOS DE UN LOTE ESPECÍFICO
# =========================
@router.get("/lote/{lote_id}")
def obtener_lote(
    lote_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Obtener datos de un lote específico (para autocompletar)
    """
    lote = db.query(Produccion).filter(Produccion.id == lote_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    return lote


# =========================
# CREAR AUDITORÍA
# =========================
@router.post("/", response_model=AuditoriaProductoResponse, status_code=201)
def crear_auditoria(
    datos: AuditoriaProductoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Crear una nueva auditoría de producto (requiere autenticación)
    """
    # 1. Verificar que el lote exista
    lote = db.query(Produccion).filter(Produccion.id == datos.produccion_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote de producción no encontrado.")
    
    # 2. Verificar que el lote no esté ya auditado
    if lote.estado_auditoria == "Auditado":
        raise HTTPException(status_code=400, detail="Este lote ya ha sido auditado.")

    # 3. Crear la auditoría
    nueva = AuditoriaProducto(
        produccion_id=datos.produccion_id,
        fecha_auditoria=datos.fecha_auditoria,
        paletas_inspeccionadas=datos.paletas_inspeccionadas,
        paletas_aprobadas=datos.paletas_aprobadas,
        paletas_rechazadas=datos.paletas_rechazadas,
        observaciones=datos.observaciones,
        auditor_id=current_user.id,
        auditor_nombre=current_user.nombre
    )
    db.add(nueva)
    db.flush()

    # 4. Guardar los defectos si se enviaron
    if datos.defectos_ids:
        for defecto_id in datos.defectos_ids:
            defecto = db.query(Defecto).filter(Defecto.id == defecto_id).first()
            if defecto:
                vinculo = AuditoriaDefecto(
                    auditoria_id=nueva.id,
                    defecto_id=defecto_id
                )
                db.add(vinculo)

    # 5. Actualizar el estado del lote en Produccion
    lote.estado_auditoria = "Auditado"

    db.commit()
    db.refresh(nueva)
    return nueva