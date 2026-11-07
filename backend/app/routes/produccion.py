from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================
# GENERADOR DE CÓDIGO DE LOTE (FORMATO AAAAMMDD)
# Formato: AAAAMMDD + Máquina + XXX
# Ejemplo: 20261106A1001
# =========================
def _generar_codigo_lote(
    db: Session,
    fecha: Optional[date] = None,
    maquina: Optional[str] = None
) -> str:
    """
    Genera un código de lote con formato AAAAMMDD + Máquina + XXX.
    - AAAAMMDD  = fecha de producción (ej: 20261106 para 6 de Noviembre de 2026)
    - Máquina   = código de máquina en mayúsculas (ej: A1)
    - XXX       = consecutivo de 3 dígitos (001, 002, ...)
    Ejemplo: 20261106A1001
    """
    if fecha is None:
        fecha = date.today()

    # 👇 CORRECCIÓN DE FECHA: Año, Mes, Día
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
    limit: int = Query(500),
    db: Session = Depends(get_db)
):
    """Lista producción con filtros opcionales"""
    query = db.query(Produccion)

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
    return query.offset(skip).limit(limit).all()


# =========================
# BUSCAR POR CÓDIGO ESCANEADO (CON AUTH)
# =========================
@router.get("/buscar/{codigo_escaneado}", response_model=ProduccionResponse)
def buscar_lote_por_codigo(codigo_escaneado: str, db: Session = Depends(get_db)):
    """
    Endpoint para el escáner de la cámara interna.
    Busca un lote comparando el código escaneado con el 'codigo_lote' o con el 'ticket_carga'.
    """
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
# BUSCAR POR CÓDIGO PÚBLICO (SIN AUTH)
# =========================
@router.get("/publico/{codigo_escaneado}", response_model=ProduccionResponse)
def buscar_lote_publico(codigo_escaneado: str, db: Session = Depends(get_db)):
    """
    Endpoint público (sin autenticación) para que los operarios puedan
    consultar un lote escaneando el QR desde su móvil.
    """
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
# OBTENER OPCIONES REGISTRADAS (Datalists)
# =========================
@router.get("/opciones", response_model=dict)
def obtener_opciones_filtros(db: Session = Depends(get_db)):
    """Devuelve los valores únicos ya registrados para llenar los datalists"""
    def unicos(columna):
        rows = db.query(columna).distinct().all()
        return sorted([r[0] for r in rows if r[0]])

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
        "turnos": [1, 2, 3, 4] 
    }


# =========================
# ESTADÍSTICAS
# =========================
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


# =========================
# PREVISUALIZAR CÓDIGO DE LOTE
# =========================
@router.get("/preview-codigo", response_model=dict)
def preview_codigo_lote(
    fecha: Optional[date] = Query(None),
    maquina: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Devuelve el próximo código de lote que se generaría."""
    codigo = _generar_codigo_lote(db, fecha, maquina)
    return {"codigo_lote": codigo}


# =========================
# PRODUCTOS: LISTAR
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
            {"id": p.id, "nombre": p.nombre, "capacidad_ml": p.capacidad_ml, "bpp": p.bpp, "bpc": p.bpc}
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


# =========================
# PRODUCTOS: CREAR
# =========================
@router.post("/productos", response_model=dict)
def crear_producto(
    nombre: str = Query(..., min_length=1),
    capacidad_ml: Optional[int] = Query(None),
    bpp: Optional[float] = Query(None),
    bpc: Optional[int] = Query(None),
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
                "id": existe.id,
                "nombre": existe.nombre,
                "capacidad_ml": existe.capacidad_ml,
                "bpp": existe.bpp,
                "bpc": existe.bpc,
                "nuevo": False
            }

        nuevo = Producto(
            nombre=nombre,
            capacidad_ml=capacidad_ml,
            bpp=bpp,
            bpc=bpc,
            item=item,
            acabado=acabado,
            material=material,
            tipo_boca=tipo_boca,
            juego_envases=juego_envases,
            dimensiones=dimensiones
        )
        db.add(nuevo)
        db.commit()
        db.refresh(nuevo)
        return {
            "id": nuevo.id,
            "nombre": nuevo.nombre,
            "capacidad_ml": nuevo.capacidad_ml,
            "bpp": nuevo.bpp,
            "bpc": nuevo.bpc,
            "nuevo": True
        }

    except ImportError:
        return {"id": None, "nombre": nombre, "capacidad_ml": capacidad_ml, "bpp": bpp, "bpc": bpc, "nuevo": True}


# =========================
# DEBUG: VERIFICAR TIPOS DE CAMPOS
# =========================
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
            "bot_por_paleta": ultimo.bot_por_paleta,
            "gruesas_por_paleta": ultimo.gruesas_por_paleta,
            "turno": ultimo.turno
        }

    return {
        "tipos_columnas": tipos,
        "ultimo_registro": ultimo_data,
    }


# =========================
# OBTENER UNA PRODUCCIÓN POR ID
# ⚠️ IMPORTANTE: Esta ruta dinámica debe ir al final de todas las rutas GET
# para no interceptar rutas como /publico, /buscar, /opciones, etc.
# =========================
@router.get("/{produccion_id}", response_model=ProduccionResponse)
def obtener_produccion(produccion_id: int, db: Session = Depends(get_db)):
    produccion = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not produccion:
        raise HTTPException(status_code=404, detail="Producción no encontrada.")
    return produccion


# =========================
# CREAR PRODUCCIÓN
# =========================
@router.post("/", response_model=ProduccionResponse, status_code=201)
@router.post("", response_model=ProduccionResponse, status_code=201)
def crear_produccion(datos: ProduccionCreate, db: Session = Depends(get_db)):
    """
    Crea un nuevo lote.
    El código se genera como AAAAMMDD + Máquina + XXX (ej: 20261106A1001).
    """
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

    nueva = Produccion(
        codigo_lote=codigo_generado,
        ticket_carga=datos.ticket_carga,
        planta=datos.planta,
        maquina=datos.maquina,
        linea_produccion=datos.linea_produccion,
        grupo=datos.grupo,
        turno=datos.turno,
        operador=datos.operador,
        orden=datos.orden,
        tipo_producto=datos.tipo_producto,
        acabado=datos.acabado,
        material=datos.material,
        tipo_boca=datos.tipo_boca,
        molde=datos.molde,
        item=datos.item,
        bpp=datos.bpp,
        capacidad=datos.capacidad,
        unidad_capacidad=getattr(datos, 'unidad_capacidad', 'ml'),
        cliente=datos.cliente,
        cantidad=datos.cantidad,
        paletas=datos.paletas,
        cajas_producidas=getattr(datos, 'cajas_producidas', None),
        gruesas=datos.gruesas,
        juego_envases=datos.juego_envases,
        tamano_muestra=datos.tamano_muestra,
        bot_por_canada=datos.bot_por_canada,
        bot_por_paleta=datos.bot_por_paleta,
        gruesas_por_paleta=datos.gruesas_por_paleta,
        estatus=datos.estatus,
        observaciones=datos.observaciones,
        fecha_produccion=datos.fecha_produccion
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


# =========================
# ACTUALIZAR PRODUCCIÓN
# =========================
@router.put("/{produccion_id}", response_model=ProduccionResponse)
def actualizar_produccion(produccion_id: int, datos: ProduccionUpdate, db: Session = Depends(get_db)):
    produccion = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not produccion:
        raise HTTPException(status_code=404, detail="Producción no encontrada.")

    update_data = datos.dict(exclude_unset=True)
    update_data.pop('codigo_lote', None)

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


# =========================
# ELIMINAR PRODUCCIÓN
# =========================
@router.delete("/{produccion_id}", status_code=204)
def eliminar_produccion(produccion_id: int, db: Session = Depends(get_db)):
    produccion = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not produccion:
        raise HTTPException(status_code=404, detail="Producción no encontrada.")
    db.delete(produccion)
    db.commit()
    return None