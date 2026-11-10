from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_
from datetime import datetime, date
from typing import Optional

from app.database.connection import SessionLocal
from app.models.produccion import Produccion
from app.schemas.produccion import (
    ProduccionCreate,
    ProduccionUpdate,
    ProduccionResponse
)

router = APIRouter(
    prefix="/produccion",
    tags=["Producción"]
)

# 🔒 FIX: estatus que SOLO puede asignar el módulo de Defectos
ESTATUS_SOLO_DEFECTOS = {"200", "300"}
# 🔒 FIX: estatus válidos al crear un lote desde Producción
ESTATUS_PERMITIDOS_ALTA = {"100"}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================
# GENERADOR DE CÓDIGO DE LOTE (FORMATO AAAAMMDD)
# =========================
def _generar_codigo_lote(
    db: Session,
    fecha: Optional[date] = None,
    maquina: Optional[str] = None
) -> str:
    if fecha is None:
        fecha = date.today()

    fecha_str = fecha.strftime("%Y%m%d")
    maquina_limpia = (maquina or "XX").replace(" ", "").upper()
    prefijo = f"{fecha_str}{maquina_limpia}"

    ultimo = (
        db.query(Produccion.codigo_lote)
        .filter(Produccion.codigo_lote.like(f"{prefijo}%"))
        .order_by(Produccion.codigo_lote.desc())
        .first()
    )

    if ultimo and ultimo[0]:
        try:
            consecutivo = int(ultimo[0][-3:]) + 1
        except (ValueError, IndexError):
            consecutivo = 1
    else:
        consecutivo = 1

    return f"{prefijo}{consecutivo:03d}"


# =========================
# LISTAR PRODUCCIÓN (CON FILTROS)
# =========================
@router.get("/", response_model=list[ProduccionResponse])
@router.get("", response_model=list[ProduccionResponse])
def listar_produccion(
    codigo: Optional[str] = Query(None),
    ticket: Optional[str] = Query(None),
    producto: Optional[str] = Query(None),
    linea: Optional[str] = Query(None),
    maquina: Optional[str] = Query(None),
    operador: Optional[str] = Query(None),
    turno: Optional[int] = Query(None),
    planta: Optional[str] = Query(None),
    molde: Optional[str] = Query(None),
    cliente: Optional[str] = Query(None),
    estatus: Optional[str] = Query(None),
    estado_auditoria: Optional[str] = Query(None),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    skip: int = Query(0),
    limit: int = Query(2000), # 👈 SUBIDO A 2000 (lo que pide el front)
    db: Session = Depends(get_db)
):
    """Lista producción con filtros opcionales"""
    query = db.query(Produccion)

    # Filtros
    if codigo:
        query = query.filter(Produccion.codigo_lote.ilike(f"%{codigo}%"))
    if ticket:
        query = query.filter(Produccion.ticket_carga.ilike(f"%{ticket}%"))
    if producto:
        query = query.filter(Produccion.tipo_producto.ilike(f"%{producto}%"))
    if linea:
        query = query.filter(Produccion.linea_produccion.ilike(f"%{linea}%"))
    if maquina:
        query = query.filter(Produccion.maquina.ilike(f"%{maquina}%"))
    if operador:
        query = query.filter(Produccion.operador.ilike(f"%{operador}%"))
    if turno:
        query = query.filter(Produccion.turno == turno)
    if planta:
        query = query.filter(Produccion.planta.ilike(f"%{planta}%"))
    if molde:
        query = query.filter(Produccion.molde.ilike(f"%{molde}%"))
    if cliente:
        query = query.filter(Produccion.cliente.ilike(f"%{cliente}%"))
    if estatus:
        query = query.filter(Produccion.estatus == estatus)
    if estado_auditoria:
        query = query.filter(Produccion.estado_auditoria == estado_auditoria)
    if fecha_desde:
        query = query.filter(Produccion.fecha_registro >= datetime.combine(fecha_desde, datetime.min.time()))
    if fecha_hasta:
        query = query.filter(Produccion.fecha_registro <= datetime.combine(fecha_hasta, datetime.max.time()))

    query = query.order_by(Produccion.fecha_registro.desc())
    
    # Usamos .all() con el limit. Si sigue dando timeout,
    # en el futuro se debería implementar paginación en el frontend.
    return query.offset(skip).limit(limit).all()


# =========================
# RUTAS FIJAS (Deben ir ANTES de /{produccion_id})
# =========================

@router.get("/opciones", response_model=dict)
def obtener_opciones_filtros(db: Session = Depends(get_db)):
    """Devuelve los valores únicos ya registrados para llenar los datalists"""
    def unicos(columna):
        rows = db.query(columna).distinct().all()
        return sorted([r[0] for r in rows if r[0]])

    # 👈 NUEVO: valores únicos de camadas por paleta (para datalist)
    try:
        camadas_rows = db.query(Produccion.camadas_por_paleta).filter(
            Produccion.camadas_por_paleta.isnot(None)
        ).distinct().all()
        camadas_unicas = sorted([r[0] for r in camadas_rows if r[0]])
    except Exception:
        camadas_unicas = []

    return {
        "productos": unicos(Produccion.tipo_producto),
        "lineas": unicos(Produccion.linea_produccion),
        "maquinas": unicos(Produccion.maquina),
        "operadores": unicos(Produccion.operador),
        "clientes": unicos(Produccion.cliente),
        "items": unicos(Produccion.item),
        "moldes": unicos(Produccion.molde),
        "acabados": unicos(Produccion.acabado),
        "grupos": unicos(Produccion.grupo),
        "ordenes": unicos(Produccion.orden),
        "camadas_paleta": camadas_unicas,  # 👈 NUEVO
        "turnos": [1, 2, 3, 4]
    }

@router.get("/estadisticas", response_model=dict)
def obtener_estadisticas(db: Session = Depends(get_db)):
    total_lotes = db.query(func.count(Produccion.id)).scalar() or 0
    total_unidades = db.query(func.sum(Produccion.cantidad)).scalar() or 0
    pendientes = db.query(func.count(Produccion.id)).filter(Produccion.estatus == "100").scalar() or 0

    lotes_por_linea = db.query(
        Produccion.linea_produccion,
        func.count(Produccion.id).label('total')
    ).group_by(Produccion.linea_produccion).all()

    return {
        "total_lotes": total_lotes,
        "total_unidades": total_unidades,
        "pendientes": pendientes,
        "lotes_por_linea": [
            {"linea": l[0] or "Sin especificar", "total": l[1]}
            for l in lotes_por_linea
        ]
    }

@router.get("/preview-codigo", response_model=dict)
def preview_codigo_lote(
    fecha: Optional[date] = Query(None),
    maquina: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    codigo = _generar_codigo_lote(db, fecha, maquina)
    return {"codigo_lote": codigo}

@router.get("/debug-schema", response_model=dict)
def debug_schema(db: Session = Depends(get_db)):
    from sqlalchemy import inspect
    inspector = inspect(db.bind)
    columnas = inspector.get_columns("produccion")
    tipos = {c["name"]: str(c["type"]) for c in columnas}
    ultimo = db.query(Produccion).order_by(Produccion.id.desc()).first()
    
    ultimo_data = None
    if ultimo:
        ultimo_data = {
            "codigo_lote": ultimo.codigo_lote,
            "cantidad": ultimo.cantidad,
            "bpp": ultimo.bpp,
            "paletas": ultimo.paletas,
            "cajas_producidas": getattr(ultimo, 'cajas_producidas', None),
            "gruesas": ultimo.gruesas,
            "juego_envases": ultimo.juego_envases,
            "tamano_muestra": ultimo.tamano_muestra,
            "bot_por_canada": ultimo.bot_por_canada,
            "camadas_por_paleta": getattr(ultimo, 'camadas_por_paleta', None),  # 👈 NUEVO
            "bot_por_paleta": ultimo.bot_por_paleta,
            "gruesas_por_paleta": ultimo.gruesas_por_paleta,
            "turno": ultimo.turno
        }
    return {"tipos_columnas": tipos, "ultimo_registro": ultimo_data}

# =========================
# BUSCAR POR CÓDIGO
# =========================
@router.get("/buscar/{codigo_escaneado}", response_model=ProduccionResponse)
def buscar_lote_por_codigo(codigo_escaneado: str, db: Session = Depends(get_db)):
    codigo_limpio = codigo_escaneado.strip()
    produccion = db.query(Produccion).filter(
        or_(
            Produccion.codigo_lote == codigo_limpio,
            Produccion.ticket_carga == codigo_limpio
        )
    ).first()

    if not produccion:
        raise HTTPException(status_code=404, detail="No se encontró ningún lote con ese código o ticket.")
    return produccion

@router.get("/publico/{codigo_escaneado}", response_model=ProduccionResponse)
def buscar_lote_publico(codigo_escaneado: str, db: Session = Depends(get_db)):
    codigo_limpio = codigo_escaneado.strip()
    produccion = db.query(Produccion).filter(
        or_(
            Produccion.codigo_lote == codigo_limpio,
            Produccion.ticket_carga == codigo_limpio
        )
    ).first()

    if not produccion:
        raise HTTPException(status_code=404, detail="No se encontró ningún lote con ese código o ticket.")
    return produccion


# =========================
# PRODUCTOS
# =========================
@router.get("/productos", response_model=list[dict])
def listar_productos(db: Session = Depends(get_db)):
    try:
        from app.models.producto import Producto
        productos = (
            db.query(Producto)
            .filter(Producto.activo == True)
            .order_by(Producto.nombre)
            .all()
        )
        return [
            {
                "id": p.id, 
                "nombre": p.nombre, 
                "capacidad_ml": p.capacidad_ml, 
                "bpp": p.bpp, 
                "bpc": p.bpc,
                "camadas_por_paleta": getattr(p, 'camadas_por_paleta', None),  # 👈 NUEVO
                "item": getattr(p, 'item', None),
                "acabado": getattr(p, 'acabado', None),
                "material": getattr(p, 'material', None),
                "tipo_boca": getattr(p, 'tipo_boca', None),
                "juego_envases": getattr(p, 'juego_envases', None),
                "dimensiones": getattr(p, 'dimensiones', None)
            }
            for p in productos
        ]
    except ImportError:
        rows = db.query(
            Produccion.tipo_producto,
            Produccion.capacidad
        ).filter(Produccion.tipo_producto.isnot(None)).distinct().all()

        return [
            {"id": i, "nombre": r[0], "capacidad_ml": r[1]}
            for i, r in enumerate(rows, 1)
        ]

@router.post("/productos", response_model=dict)
def crear_producto(
    nombre: str = Query(..., min_length=1),
    capacidad_ml: Optional[int] = Query(None),
    bpp: Optional[float] = Query(None),
    bpc: Optional[int] = Query(None),
    camadas_por_paleta: Optional[int] = Query(None),  # 👈 NUEVO
    item: Optional[str] = Query(None),
    acabado: Optional[str] = Query(None),
    material: Optional[str] = Query(None),
    tipo_boca: Optional[str] = Query(None),
    juego_envases: Optional[str] = Query(None),
    dimensiones: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    nombre = nombre.strip()
    try:
        from app.models.producto import Producto
        existe = db.query(Producto).filter(Producto.nombre.ilike(nombre)).first()
        if existe:
            return {
                "id": existe.id, "nombre": existe.nombre, "capacidad_ml": existe.capacidad_ml,
                "bpp": existe.bpp, "bpc": existe.bpc, 
                "camadas_por_paleta": getattr(existe, 'camadas_por_paleta', None),
                "nuevo": False
            }

        nuevo = Producto(
            nombre=nombre, capacidad_ml=capacidad_ml, bpp=bpp, bpc=bpc, 
            camadas_por_paleta=camadas_por_paleta,  # 👈 NUEVO
            item=item, acabado=acabado, material=material, tipo_boca=tipo_boca,
            juego_envases=juego_envases, dimensiones=dimensiones
        )
        db.add(nuevo)
        db.commit()
        db.refresh(nuevo)
        return {
            "id": nuevo.id, "nombre": nuevo.nombre, "capacidad_ml": nuevo.capacidad_ml,
            "bpp": nuevo.bpp, "bpc": nuevo.bpc,
            "camadas_por_paleta": getattr(nuevo, 'camadas_por_paleta', None),
            "nuevo": True
        }
    except ImportError:
        return {
            "id": None, "nombre": nombre, "capacidad_ml": capacidad_ml, 
            "bpp": bpp, "bpc": bpc, "camadas_por_paleta": camadas_por_paleta, 
            "nuevo": True
        }


# =========================
# RUTAS DINÁMICAS (AL FINAL)
# =========================
@router.get("/{produccion_id}", response_model=ProduccionResponse)
def obtener_produccion(produccion_id: int, db: Session = Depends(get_db)):
    produccion = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not produccion:
        raise HTTPException(status_code=404, detail="Producción no encontrada.")
    return produccion


@router.post("/", response_model=ProduccionResponse, status_code=201)
@router.post("", response_model=ProduccionResponse, status_code=201)
def crear_produccion(datos: ProduccionCreate, db: Session = Depends(get_db)):
    fecha_ref = datos.fecha_produccion if datos.fecha_produccion else date.today()
    if isinstance(fecha_ref, datetime):
        fecha_ref = fecha_ref.date()

    codigo_generado = _generar_codigo_lote(db, fecha_ref, datos.maquina)

    if datos.ticket_carga:
        existe_ticket = db.query(Produccion).filter(
            Produccion.ticket_carga == datos.ticket_carga
        ).first()
        if existe_ticket:
            raise HTTPException(
                status_code=400,
                detail=f"El ticket {datos.ticket_carga} ya está registrado en el lote {existe_ticket.codigo_lote}."
            )

    estatus_inicial = str(getattr(datos, "estatus", None) or "100").strip()
    if estatus_inicial not in ESTATUS_PERMITIDOS_ALTA:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Estatus inicial inválido: '{estatus_inicial}'. "
                "Producción solo puede crear lotes en estatus '100' (pendiente). "
                "Los estatus '200' (Apto) y '300' (Retenido) los asigna únicamente el módulo de Defectos."
            )
        )

    nueva = Produccion(
        codigo_lote=codigo_generado, ticket_carga=datos.ticket_carga, planta=datos.planta,
        maquina=datos.maquina, linea_produccion=datos.linea_produccion, grupo=datos.grupo,
        turno=datos.turno, operador=datos.operador, orden=datos.orden, tipo_producto=datos.tipo_producto,
        acabado=datos.acabado, material=datos.material, tipo_boca=datos.tipo_boca, molde=datos.molde,
        item=datos.item, bpp=datos.bpp, capacidad=datos.capacidad,
        unidad_capacidad=getattr(datos, 'unidad_capacidad', 'ml'), cliente=datos.cliente,
        cantidad=datos.cantidad, paletas=datos.paletas, cajas_producidas=getattr(datos, 'cajas_producidas', None),
        gruesas=datos.gruesas, juego_envases=datos.juego_envases, tamano_muestra=datos.tamano_muestra,
        bot_por_canada=datos.bot_por_canada, 
        camadas_por_paleta=getattr(datos, 'camadas_por_paleta', None),  # 👈 NUEVO
        bot_por_paleta=datos.bot_por_paleta,
        gruesas_por_paleta=datos.gruesas_por_paleta, estatus="100",
        observaciones=datos.observaciones, fecha_produccion=datos.fecha_produccion
    )

    try:
        db.add(nueva)
        db.commit()
        db.refresh(nueva)
        return nueva
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error al guardar el lote en la base de datos: {str(e)}"
        )


@router.put("/{produccion_id}", response_model=ProduccionResponse)
def actualizar_produccion(produccion_id: int, datos: ProduccionUpdate, db: Session = Depends(get_db)):
    produccion = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not produccion:
        raise HTTPException(status_code=404, detail="Producción no encontrada.")

    update_data = datos.dict(exclude_unset=True)
    update_data.pop('codigo_lote', None)

    nuevo_estatus = update_data.get("estatus")
    if nuevo_estatus is not None:
        nuevo_estatus = str(nuevo_estatus).strip()
        if nuevo_estatus in ESTATUS_SOLO_DEFECTOS:
            raise HTTPException(
                status_code=403,
                detail=(
                    f"El estatus '{nuevo_estatus}' solo puede asignarse desde el módulo de Defectos. "
                    "Producción no puede marcar un lote como Apto (200) ni Retenido (300)."
                )
            )
        update_data["estatus"] = nuevo_estatus

    nuevo_ticket = update_data.get('ticket_carga')
    if nuevo_ticket and nuevo_ticket != produccion.ticket_carga:
        existe = db.query(Produccion).filter(
            Produccion.ticket_carga == nuevo_ticket,
            Produccion.id != produccion_id
        ).first()
        if existe:
            raise HTTPException(
                status_code=400,
                detail=f"El ticket {nuevo_ticket} ya está registrado en el lote {existe.codigo_lote}."
            )

    for campo, valor in update_data.items():
        if valor is not None:
            setattr(produccion, campo, valor)

    db.commit()
    db.refresh(produccion)
    return produccion


@router.delete("/{produccion_id}", status_code=204)
def eliminar_produccion(produccion_id: int, db: Session = Depends(get_db)):
    produccion = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not produccion:
        raise HTTPException(status_code=404, detail="Producción no encontrada.")
    db.delete(produccion)
    db.commit()
    return None