from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload # 👈 IMPORTANTE AÑADIR joinedload
from sqlalchemy import func
from datetime import datetime, date
from typing import Optional, List

from app.database.connection import SessionLocal
from app.models.defecto import Defecto
from app.models.produccion import Produccion
from app.models.defecto_tipo import DefectoTipo
from app.schemas.defecto import (
    DefectoCreate,
    DefectoUpdate,
    DefectoResponse,
    TipoDefectoCreate,
    MarcarLoteAptoRequest,
    MarcarLoteRetenidoRequest,
    DefectoTipoResponse,
)

from app.dependencies.auth import get_current_active_user, check_admin
from app.models.usuario import Usuario

router = APIRouter(
    prefix="/defectos",
    tags=["Defectos"]
)

CLASIFICACIONES_OFICIALES = ["Crítico", "Mayor B+", "Mayor B-", "Menor"]

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# =========================
# LISTAR DEFECTOS (CON FILTROS)
# =========================
@router.get("/", response_model=list[DefectoResponse])
@router.get("", response_model=list[DefectoResponse])
def listar_defectos(
    lote: Optional[str] = Query(None, description="Filtrar por código de lote"),
    lote_id: Optional[int] = Query(None, description="Filtrar por ID del lote"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo de defecto"),
    clase: Optional[str] = Query(None, description="Filtrar por clasificación"),
    inspector: Optional[str] = Query(None, description="Filtrar por inspector"),
    fecha_desde: Optional[date] = Query(None, description="Filtrar desde fecha"),
    fecha_hasta: Optional[date] = Query(None, description="Filtrar hasta fecha"),
    incluir_semillas: bool = Query(False, description="Incluir registros semilla del catálogo"),
    skip: int = Query(0),
    limit: int = Query(2000), # 👈 SUBIDO A 2000 PORQUE TU FRONTEND LO PIDE ASÍ
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    """Lista defectos con filtros opcionales. Excluye registros semilla por defecto."""
    # 👇 USAMOS joinedload PARA EVITAR ERRORES DE LECTURA SI HAY RELACIONES
    query = db.query(Defecto).options(joinedload(Defecto.lote)) 

    if not incluir_semillas:
        query = query.filter(Defecto.origen != "seed")

    if lote:
        query = query.filter(Defecto.codigo_lote.ilike(f"%{lote}%"))
    if lote_id:
        query = query.filter(Defecto.lote_id == lote_id)
    if tipo:
        query = query.filter(Defecto.tipo_defecto.ilike(f"%{tipo}%"))
    if clase:
        query = query.filter(Defecto.clasificacion == clase)
    if inspector:
        query = query.filter(Defecto.inspector.ilike(f"%{inspector}%"))
    if fecha_desde:
        query = query.filter(Defecto.fecha_registro >= datetime.combine(fecha_desde, datetime.min.time()))
    if fecha_hasta:
        query = query.filter(Defecto.fecha_registro <= datetime.combine(fecha_hasta, datetime.max.time()))

    query = query.order_by(Defecto.fecha_registro.desc())
    return query.offset(skip).limit(limit).all()


# =========================
# OPCIONES REGISTRADAS (para Datalists)
# =========================
@router.get("/opciones", response_model=dict)
def obtener_opciones_registradas(db: Session = Depends(get_db)):
    tipos_maestros = db.query(DefectoTipo.nombre).filter(DefectoTipo.activo == True).all()
    base = db.query(Defecto).filter(Defecto.origen != "seed")
    
    zonas = base.with_entities(
        Defecto.zona_deteccion,
        func.count(Defecto.zona_deteccion).label('total')
    ).filter(Defecto.zona_deteccion.isnot(None)).group_by(Defecto.zona_deteccion).order_by(func.count(Defecto.zona_deteccion).desc()).limit(30).all()

    inspectores = base.with_entities(
        Defecto.inspector,
        func.count(Defecto.inspector).label('total')
    ).group_by(Defecto.inspector).order_by(func.count(Defecto.inspector).desc()).limit(30).all()

    return {
        "tipos": [t[0] for t in tipos_maestros if t[0]],
        "zonas": [z[0] for z in zonas if z[0]],
        "inspectores": [i[0] for i in inspectores if i[0]],
        "clasificaciones": CLASIFICACIONES_OFICIALES
    }


# =========================
# TIPOS DE DEFECTO POR CLASIFICACIÓN
# =========================
@router.get("/tipos", response_model=list[str])
def obtener_tipos_por_clasificacion(
    clasificacion: Optional[str] = Query(None, description="Clasificación para filtrar"),
    db: Session = Depends(get_db)
):
    query = db.query(DefectoTipo.nombre).filter(DefectoTipo.activo == True)

    if clasificacion:
        if clasificacion not in CLASIFICACIONES_OFICIALES:
            raise HTTPException(
                status_code=400,
                detail=f"Clasificación inválida. Debe ser una de: {', '.join(CLASIFICACIONES_OFICIALES)}"
            )
        query = query.filter(DefectoTipo.clasificacion == clasificacion)

    tipos = [t[0] for t in query.order_by(DefectoTipo.nombre).distinct().all() if t[0]]
    return tipos


@router.post("/tipos", response_model=DefectoTipoResponse, status_code=201)
def registrar_tipo_defecto(
    datos: TipoDefectoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_admin())
):
    if datos.clasificacion not in CLASIFICACIONES_OFICIALES:
        raise HTTPException(status_code=400, detail="Clasificación inválida.")

    existente = db.query(DefectoTipo).filter(
        DefectoTipo.nombre.ilike(datos.tipo_defecto),
        DefectoTipo.clasificacion == datos.clasificacion
    ).first()

    if existente:
        return existente

    nuevo_tipo = DefectoTipo(
        clasificacion=datos.clasificacion,
        nombre=datos.tipo_defecto.strip(),
        activo=True
    )
    db.add(nuevo_tipo)
    db.commit()
    db.refresh(nuevo_tipo)
    
    return nuevo_tipo


# =========================
# ESTADÍSTICAS
# =========================
@router.get("/estadisticas", response_model=dict)
def obtener_estadisticas(db: Session = Depends(get_db)):
    base = db.query(Defecto).filter(Defecto.origen != "seed")

    total = base.with_entities(func.count(Defecto.id)).scalar() or 0
    criticos = base.with_entities(func.count(Defecto.id)).filter(Defecto.clasificacion == "Crítico").scalar() or 0
    mayores_bplus = base.with_entities(func.count(Defecto.id)).filter(Defecto.clasificacion == "Mayor B+").scalar() or 0
    mayores_bminus = base.with_entities(func.count(Defecto.id)).filter(Defecto.clasificacion == "Mayor B-").scalar() or 0
    menores = base.with_entities(func.count(Defecto.id)).filter(Defecto.clasificacion == "Menor").scalar() or 0

    return {
        "total": total,
        "criticos": criticos,
        "mayores_bplus": mayores_bplus,
        "mayores_bminus": mayores_bminus,
        "menores": menores
    }


# =========================
# OBTENER UN DEFECTO
# =========================
@router.get("/{defecto_id}", response_model=DefectoResponse)
def obtener_defecto(
    defecto_id: int, 
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    defecto = db.query(Defecto).filter(Defecto.id == defecto_id).first()
    if not defecto:
        raise HTTPException(status_code=404, detail="Defecto no encontrado.")
    return defecto


# ========================================================
# CREAR DEFECTOS (MÚLTIPLES)
# ========================================================
@router.post("/", response_model=List[DefectoResponse], status_code=201)
@router.post("", response_model=List[DefectoResponse], status_code=201)
def crear_defectos(
    datos: List[DefectoCreate],
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    if not datos:
        raise HTTPException(status_code=400, detail="No se enviaron defectos.")

    lote_id = datos[0].lote_id
    if not lote_id:
        raise HTTPException(status_code=400, detail="El lote_id es obligatorio.")

    lote = db.query(Produccion).filter(Produccion.id == lote_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail=f"El lote ID {lote_id} no existe.")

    for d in datos:
        if d.clasificacion not in CLASIFICACIONES_OFICIALES:
            raise HTTPException(status_code=400, detail="Clasificación inválida.")

    nuevos_defectos = []
    for d in datos:
        nuevo = Defecto(
            lote_id=lote_id,
            codigo_lote=lote.codigo_lote,
            grupo_id=d.grupo_id,
            tipo_defecto=d.tipo_defecto,
            clasificacion=d.clasificacion,
            cantidad_piezas=d.cantidad_piezas,
            zona_deteccion=d.zona_deteccion,
            inspector=d.inspector,
            descripcion=d.descripcion,
            observaciones=d.observaciones,
            resultado_lote=d.resultado_lote or "RETENIDO",
            origen="manual",
            validado=True,
            tamano_muestra=d.tamano_muestra,
            canastas_inspeccionadas=d.canastas_inspeccionadas,
            tamano_poblacion=d.tamano_poblacion,
            botellas_por_caja=d.botellas_por_caja,
            botellas_por_paleta=d.botellas_por_paleta,
            gruesas_por_paleta=d.gruesas_por_paleta
        )
        nuevos_defectos.append(nuevo)

    try:
        db.add_all(nuevos_defectos)
        lote.estatus = '300'
        
        if datos[0].observaciones:
            lote.observaciones = datos[0].observaciones.strip()
        elif not lote.observaciones:
            lote.observaciones = f"Lote con {len(datos)} defecto(s) registrado(s)."

        if datos[0].tamano_muestra is not None:
            lote.tamano_muestra = str(datos[0].tamano_muestra)
        if datos[0].canastas_inspeccionadas is not None:
            lote.paletas = datos[0].canastas_inspeccionadas

        db.commit()
        
        for nd in nuevos_defectos:
            db.refresh(nd)
            
        return nuevos_defectos

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar los defectos: {str(e)}")


# ========================================================
# ELIMINAR DEFECTOS DE UN LOTE
# ========================================================
@router.delete("/lote/{lote_id}", status_code=204)
def eliminar_defectos_por_lote(
    lote_id: int, 
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    lote = db.query(Produccion).filter(Produccion.id == lote_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado.")

    db.query(Defecto).filter(Defecto.lote_id == lote_id).delete()
    
    lote.estatus = "100"
    lote.estado_auditoria = "pendiente"
    lote.observaciones = ""
    
    db.commit()
    return None


# =========================
# ACTUALIZAR DEFECTO
# =========================
@router.put("/{defecto_id}", response_model=DefectoResponse)
def actualizar_defecto(
    defecto_id: int,
    datos: DefectoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    defecto = db.query(Defecto).filter(Defecto.id == defecto_id).first()
    if not defecto:
        raise HTTPException(status_code=404, detail="Defecto no encontrado.")

    if datos.clasificacion is not None and datos.clasificacion not in CLASIFICACIONES_OFICIALES:
        raise HTTPException(status_code=400, detail="Clasificación inválida.")

    for campo, valor in datos.dict(exclude_unset=True).items():
        if valor is not None:
            setattr(defecto, campo, valor)

    db.commit()
    db.refresh(defecto)
    return defecto


# =========================
# ELIMINAR UN DEFECTO INDIVIDUAL
# =========================
@router.delete("/{defecto_id}", status_code=204)
def eliminar_defecto(
    defecto_id: int, 
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    defecto = db.query(Defecto).filter(Defecto.id == defecto_id).first()
    if not defecto:
        raise HTTPException(status_code=404, detail="Defecto no encontrado.")
    db.delete(defecto)
    db.commit()
    return None


# =========================
# MARCAR LOTE COMO APTO
# =========================
@router.post("/lote/{lote_id}/apto", status_code=200)
def marcar_lote_apto(
    lote_id: int,
    datos: MarcarLoteAptoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    lote = db.query(Produccion).filter(Produccion.id == lote_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado.")

    lote.estatus = '200'

    if datos.observaciones:
        lote.observaciones = datos.observaciones.strip()

    if datos.tamano_muestra is not None:
        lote.tamano_muestra = str(datos.tamano_muestra)
        
    if datos.canastas_inspeccionadas is not None:
        lote.paletas = datos.canastas_inspeccionadas

    db.commit()
    db.refresh(lote)

    return {
        "mensaje": f"Lote {lote.codigo_lote} marcado como APTO",
        "lote_id": lote.id,
        "codigo_lote": lote.codigo_lote,
        "estatus": lote.estatus,
        "observaciones": lote.observaciones
    }


# =========================
# MARCAR LOTE COMO RETENIDO
# =========================
@router.post("/lote/{lote_id}/retenido", status_code=200)
def marcar_lote_retenido(
    lote_id: int,
    datos: MarcarLoteRetenidoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    lote = db.query(Produccion).filter(Produccion.id == lote_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado.")

    if not datos.observaciones or not datos.observaciones.strip():
        raise HTTPException(status_code=400, detail="Debe proporcionar observaciones.")

    lote.estatus = '300'
    lote.observaciones = datos.observaciones.strip()

    db.commit()
    db.refresh(lote)

    return {
        "mensaje": f"Lote {lote.codigo_lote} marcado como RETENIDO",
        "lote_id": lote.id,
        "codigo_lote": lote.codigo_lote,
        "estatus": lote.estatus,
        "observaciones": lote.observaciones
    }