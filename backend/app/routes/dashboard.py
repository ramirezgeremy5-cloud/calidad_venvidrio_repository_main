from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import func, desc, inspect
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
from pathlib import Path
import io

# 👇 LIBRERÍA PARA WORD
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH

from app.database.connection import SessionLocal

from app.models.produccion import Produccion
from app.models.defecto import Defecto
# 👇 CORRECCIÓN: Importación estandarizada
from app.models.auditoria_interna import AuditoriaInterna


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
    total_lotes = db.query(func.count(Produccion.id)).scalar()
    unidades = db.query(func.sum(Produccion.cantidad)).scalar()
    unidades = unidades or 0
    total_defectos = db.query(func.count(Defecto.id)).scalar()
    total_defectos = total_defectos or 0

    if unidades > 0:
        eficiencia = ((unidades - total_defectos) / unidades) * 100
    else:
        eficiencia = 100

    return {
        "lotes": total_lotes or 0,
        "unidades": unidades,
        "defectos": total_defectos,
        "eficiencia": f"{round(eficiencia,2)}%"
    }


# ==========================================
# TENDENCIAS (vs 7 DÍAS ATRÁS)
# ==========================================

@router.get("/tendencias")
def dashboard_tendencias(
    db: Session = Depends(get_db)
):
    hoy = datetime.now().date()
    fecha_inicio_periodo_actual = hoy - timedelta(days=7)
    fecha_inicio_periodo_anterior = hoy - timedelta(days=14)
    fecha_fin_periodo_anterior = hoy - timedelta(days=8)
    
    actual_lotes = db.query(func.count(Produccion.id)).filter(
        Produccion.fecha_registro >= fecha_inicio_periodo_actual
    ).scalar() or 0
    
    actual_unidades = db.query(func.sum(Produccion.cantidad)).filter(
        Produccion.fecha_registro >= fecha_inicio_periodo_actual
    ).scalar() or 0
    
    actual_defectos = db.query(func.count(Defecto.id)).filter(
        Defecto.fecha_registro >= fecha_inicio_periodo_actual
    ).scalar() or 0
    
    anterior_lotes = db.query(func.count(Produccion.id)).filter(
        Produccion.fecha_registro >= fecha_inicio_periodo_anterior,
        Produccion.fecha_registro <= fecha_fin_periodo_anterior
    ).scalar() or 0
    
    anterior_unidades = db.query(func.sum(Produccion.cantidad)).filter(
        Produccion.fecha_registro >= fecha_inicio_periodo_anterior,
        Produccion.fecha_registro <= fecha_fin_periodo_anterior
    ).scalar() or 0
    
    anterior_defectos = db.query(func.count(Defecto.id)).filter(
        Defecto.fecha_registro >= fecha_inicio_periodo_anterior,
        Defecto.fecha_registro <= fecha_fin_periodo_anterior
    ).scalar() or 0
    
    def calcular_tendencia(actual, anterior, invertir=False):
        if anterior == 0:
            return 0 if actual == 0 else 100
        cambio = ((actual - anterior) / anterior) * 100
        return round(-cambio if invertir else cambio, 1)
    
    eficiencia_actual = ((actual_unidades - actual_defectos) / actual_unidades * 100) if actual_unidades > 0 else 100
    eficiencia_anterior = ((anterior_unidades - anterior_defectos) / anterior_unidades * 100) if anterior_unidades > 0 else 100
    tendencia_eficiencia = calcular_tendencia(eficiencia_actual, eficiencia_anterior)
    
    return {
        "periodo": {
            "actual": {
                "desde": fecha_inicio_periodo_actual.strftime("%d/%m/%Y"),
                "hasta": hoy.strftime("%d/%m/%Y")
            },
            "anterior": {
                "desde": fecha_inicio_periodo_anterior.strftime("%d/%m/%Y"),
                "hasta": fecha_fin_periodo_anterior.strftime("%d/%m/%Y")
            }
        },
        "actual": {
            "lotes": actual_lotes,
            "unidades": actual_unidades,
            "defectos": actual_defectos,
            "eficiencia": round(eficiencia_actual, 1)
        },
        "tendencia": {
            "lotes": calcular_tendencia(actual_lotes, anterior_lotes),
            "unidades": calcular_tendencia(actual_unidades, anterior_unidades),
            "defectos": calcular_tendencia(actual_defectos, anterior_defectos, invertir=True),
            "eficiencia": tendencia_eficiencia
        }
    }


# ==========================================
# ÚLTIMOS REGISTROS PRODUCCIÓN
# ==========================================

@router.get("/ultimos")
def ultimos_registros(
    db: Session = Depends(get_db)
):
    registros = db.query(Produccion).order_by(desc(Produccion.id)).limit(5).all()

    return [
        {
            "fecha": r.fecha_registro.strftime("%d/%m/%Y") if r.fecha_registro else "--",
            "linea": r.linea_produccion if r.linea_produccion else "--",
            "producto": r.tipo_producto if r.tipo_producto else "--",
            "estado": "OK"
        }
        for r in registros
    ]


# ==========================================
# GRÁFICO: PRODUCCIÓN POR DÍA 
# ==========================================

@router.get("/grafico/produccion")
def grafico_produccion(
    dias: int = Query(7, description="Número de días a mostrar"),
    db: Session = Depends(get_db)
):
    hoy = datetime.now().date()
    labels = []
    unidades_data = []
    lotes_data = []
    
    for i in range(dias - 1, -1, -1):
        fecha = hoy - timedelta(days=i)
        fecha_inicio = datetime.combine(fecha, datetime.min.time())
        fecha_fin = datetime.combine(fecha, datetime.max.time())
        
        unidades = db.query(func.sum(Produccion.cantidad)).filter(
            Produccion.fecha_registro >= fecha_inicio,
            Produccion.fecha_registro <= fecha_fin
        ).scalar() or 0
        
        lotes = db.query(func.count(Produccion.id)).filter(
            Produccion.fecha_registro >= fecha_inicio,
            Produccion.fecha_registro <= fecha_fin
        ).scalar() or 0
        
        labels.append(fecha.strftime("%d/%m"))
        unidades_data.append(unidades)
        lotes_data.append(lotes)
    
    return {
        "labels": labels,
        "unidades": unidades_data,
        "lotes": lotes_data
    }


# ==========================================
# GRÁFICO: DEFECTOS POR TIPO
# ==========================================

@router.get("/grafico/defectos")
def grafico_defectos(
    db: Session = Depends(get_db)
):
    criticos = db.query(func.count(Defecto.id)).filter(Defecto.clasificacion == "Crítico").scalar() or 0
    mayores = db.query(func.count(Defecto.id)).filter(Defecto.clasificacion == "Mayor").scalar() or 0
    menores = db.query(func.count(Defecto.id)).filter(Defecto.clasificacion == "Menor").scalar() or 0
    
    return {
        "labels": ["Críticos", "Mayores", "Menores"],
        "values": [criticos, mayores, menores],
        "colors": ["#dc3545", "#ffc107", "#17a2b8"]
    }


# ==========================================
# GRÁFICO: PRODUCCIÓN POR LÍNEA
# ==========================================

@router.get("/grafico/lineas")
def grafico_lineas(
    db: Session = Depends(get_db)
):
    lineas = db.query(Produccion.linea_produccion).distinct().all()
    lineas = [l[0] for l in lineas if l[0]]
    
    resultados = []
    total = 0
    
    for linea in lineas:
        unidades = db.query(func.sum(Produccion.cantidad)).filter(
            Produccion.linea_produccion == linea
        ).scalar() or 0
        resultados.append({
            "linea": linea,
            "unidades": unidades
        })
        total += unidades
    
    for r in resultados:
        r["porcentaje"] = round((r["unidades"] / total * 100), 1) if total > 0 else 0
    
    resultados.sort(key=lambda x: x["unidades"], reverse=True)
    
    return {"lineas": resultados}


# ==========================================
# GRÁFICO: EFICIENCIA MENSUAL
# ==========================================

@router.get("/grafico/eficiencia")
def grafico_eficiencia(
    meses: int = Query(6, description="Número de meses a mostrar"),
    db: Session = Depends(get_db)
):
    hoy = datetime.now().date()
    labels = []
    valores = []
    
    for i in range(meses - 1, -1, -1):
        mes = hoy.month - i
        año = hoy.year
        if mes <= 0:
            mes += 12
            año -= 1
        
        fecha_inicio = datetime(año, mes, 1)
        
        if mes == 12:
            fecha_fin = datetime(año + 1, 1, 1) - timedelta(days=1)
        else:
            fecha_fin = datetime(año, mes + 1, 1) - timedelta(days=1)
        
        unidades = db.query(func.sum(Produccion.cantidad)).filter(
            Produccion.fecha_registro >= fecha_inicio,
            Produccion.fecha_registro <= fecha_fin
        ).scalar() or 0
        
        defectos = db.query(func.count(Defecto.id)).filter(
            Defecto.fecha_registro >= fecha_inicio,
            Defecto.fecha_registro <= fecha_fin
        ).scalar() or 0
        
        eficiencia = ((unidades - defectos) / unidades * 100) if unidades > 0 else 0
        
        labels.append(fecha_inicio.strftime("%b"))
        valores.append(round(eficiencia, 1))
    
    return {
        "labels": labels,
        "valores": valores
    }


# ==========================================
# TOP 5 PRODUCTOS CON MÁS DEFECTOS
# ==========================================

@router.get("/top/defectos")
def top_defectos(
    db: Session = Depends(get_db)
):
    try:
        inspector = inspect(Defecto)
        columnas = [c.name for c in inspector.columns]
        
        if 'tipo_producto' not in columnas:
            total_defectos = db.query(func.count(Defecto.id)).scalar() or 0
            return [{
                "producto": "Total defectos",
                "defectos": total_defectos,
                "tasa": 100.0 if total_defectos > 0 else 0
            }]
        
        resultados = db.query(
            Defecto.tipo_producto,
            func.count(Defecto.id).label('total_defectos')
        ).group_by(
            Defecto.tipo_producto
        ).order_by(
            desc('total_defectos')
        ).limit(5).all()
        
        if not resultados or all(r[0] is None for r in resultados):
            total_defectos = db.query(func.count(Defecto.id)).scalar() or 0
            return [{
                "producto": "Todos los productos",
                "defectos": total_defectos,
                "tasa": 100.0 if total_defectos > 0 else 0
            }]
        
        top = []
        for r in resultados:
            producto = r[0] or "Sin especificar"
            total_defectos = r[1] or 0
            
            total_unidades = db.query(func.sum(Produccion.cantidad)).filter(
                Produccion.tipo_producto == producto
            ).scalar() or 0
            
            if total_unidades == 0:
                total_unidades = db.query(func.sum(Produccion.cantidad)).scalar() or 1
            
            tasa = round((total_defectos / total_unidades * 100), 2) if total_unidades > 0 else 0
            
            top.append({
                "producto": producto,
                "defectos": total_defectos,
                "tasa": tasa
            })
        
        return top
        
    except Exception as e:
        print(f"❌ Error en top/defectos: {e}")
        total_defectos = db.query(func.count(Defecto.id)).scalar() or 0
        return [{
            "producto": "Total defectos",
            "defectos": total_defectos,
            "tasa": 100.0 if total_defectos > 0 else 0
        }]


# ==========================================
# AUDITORÍAS PENDIENTES (SOLO PERSONAL)
# ==========================================

@router.get("/auditorias/pendientes")
def auditorias_pendientes(
    db: Session = Depends(get_db)
):
    """Devuelve resumen de evaluaciones al personal de calidad"""
    
    total = db.query(func.count(AuditoriaInterna.id)).scalar() or 0
    
    excelentes = db.query(func.count(AuditoriaInterna.id)).filter(
        AuditoriaInterna.categoria == "Excelente"
    ).scalar() or 0
    
    deficientes = db.query(func.count(AuditoriaInterna.id)).filter(
        AuditoriaInterna.categoria == "Deficiente"
    ).scalar() or 0
    
    return {
        "total": total,
        "excelentes": excelentes,
        "deficientes": deficientes
    }


# ==========================================
# ALERTAS DEL DASHBOARD
# ==========================================

@router.get("/alerts")
def dashboard_alerts(
    db: Session = Depends(get_db)
):
    alertas = []

    defectos_criticos = db.query(Defecto).filter(Defecto.clasificacion == "Crítico").all()
    for defecto in defectos_criticos:
        alertas.append({
            "tipo": "danger",
            "mensaje": f"Defecto crítico detectado: {defecto.tipo_defecto}"
        })

    defectos_mayores = db.query(Defecto).filter(Defecto.clasificacion == "Mayor").all()
    for defecto in defectos_mayores:
        alertas.append({
            "tipo": "warning",
            "mensaje": f"Defecto mayor detectado: {defecto.tipo_defecto}"
        })

    lotes = db.query(Produccion).all()
    for lote in lotes:
        if lote.cantidad and lote.cantidad < 50:
            alertas.append({
                "tipo": "warning",
                "mensaje": f"Lote {lote.codigo_lote} con baja producción"
            })

    evaluaciones_deficientes = db.query(AuditoriaInterna).filter(
        AuditoriaInterna.categoria == "Deficiente"
    ).all()
    
    for eval in evaluaciones_deficientes:
        alertas.append({
            "tipo": "warning",
            "mensaje": f"Evaluación de calidad deficiente detectada (Puntaje: {eval.puntaje}%)"
        })

    if not alertas:
        alertas.append({
            "tipo": "success",
            "mensaje": "Sistema operando correctamente"
        })

    return alertas


# ==========================================
# EXPORTAR DASHBOARD A WORD
# ==========================================

@router.get("/exportar/word")
def exportar_dashboard_word(
    db: Session = Depends(get_db)
):
    """
    Genera un reporte profesional en Word con las tablas del dashboard.
    """
    try:
        # 1. OBTENER DATOS BÁSICOS
        total_lotes = db.query(func.count(Produccion.id)).scalar() or 0
        unidades = db.query(func.sum(Produccion.cantidad)).scalar() or 0
        total_defectos = db.query(func.count(Defecto.id)).scalar() or 0
        eficiencia = round(((unidades - total_defectos) / unidades * 100), 2) if unidades > 0 else 100
        
        criticos = db.query(func.count(Defecto.id)).filter(Defecto.clasificacion == "Crítico").scalar() or 0
        mayores = db.query(func.count(Defecto.id)).filter(Defecto.clasificacion == "Mayor").scalar() or 0
        menores = db.query(func.count(Defecto.id)).filter(Defecto.clasificacion == "Menor").scalar() or 0
        
        total_auditorias = db.query(func.count(AuditoriaInterna.id)).scalar() or 0
        excelentes = db.query(func.count(AuditoriaInterna.id)).filter(AuditoriaInterna.categoria == "Excelente").scalar() or 0
        deficientes = db.query(func.count(AuditoriaInterna.id)).filter(AuditoriaInterna.categoria == "Deficiente").scalar() or 0
        
        ultimos = db.query(Produccion).order_by(desc(Produccion.id)).limit(5).all()

        # 2. VERIFICAR SI EXISTE LA COLUMNA 'tipo_producto' EN DEFECTOS
        inspector = inspect(Defecto)
        columnas_defecto = [c.name for c in inspector.columns]
        tiene_tipo_producto = 'tipo_producto' in columnas_defecto

        top_productos = []
        if tiene_tipo_producto:
            top_productos = db.query(
                Defecto.tipo_producto,
                func.count(Defecto.id).label('total')
            ).group_by(Defecto.tipo_producto).order_by(desc('total')).limit(5).all()

        # 3. CREAR DOCUMENTO
        doc = Document()
        
        # Título
        title = doc.add_heading('Reporte de Control de Calidad — Venvidrio', 0)
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        p_date = doc.add_paragraph(f'Fecha de generación: {datetime.now().strftime("%d/%m/%Y %H:%M")}')
        p_date.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        doc.add_paragraph('_' * 80)

        # 1. INDICADORES
        doc.add_heading('1. Indicadores Principales', level=1)
        
        tabla_kpi = doc.add_table(rows=2, cols=4)
        tabla_kpi.style = 'Table Grid'
        
        hdr_kpi = tabla_kpi.rows[0].cells
        hdr_kpi[0].text = 'Producción'
        hdr_kpi[1].text = 'Lotes'
        hdr_kpi[2].text = 'Defectos'
        hdr_kpi[3].text = 'Eficiencia'
        
        val_kpi = tabla_kpi.rows[1].cells
        val_kpi[0].text = f"{unidades:,.0f}"
        val_kpi[1].text = str(total_lotes)
        val_kpi[2].text = str(total_defectos)
        val_kpi[3].text = f"{eficiencia}%"
        
        doc.add_paragraph()

        # 2. DEFECTOS POR TIPO
        doc.add_heading('2. Defectos por Tipo', level=1)
        
        tabla_def = doc.add_table(rows=2, cols=4)
        tabla_def.style = 'Table Grid'
        
        hdr_def = tabla_def.rows[0].cells
        hdr_def[0].text = 'Críticos'
        hdr_def[1].text = 'Mayores'
        hdr_def[2].text = 'Menores'
        hdr_def[3].text = 'Total'
        
        val_def = tabla_def.rows[1].cells
        val_def[0].text = str(criticos)
        val_def[1].text = str(mayores)
        val_def[2].text = str(menores)
        val_def[3].text = str(total_defectos)
        
        doc.add_paragraph()

        # 3. AUDITORÍAS
        doc.add_heading('3. Evaluaciones de Calidad', level=1)
        
        tabla_aud = doc.add_table(rows=2, cols=3)
        tabla_aud.style = 'Table Grid'
        
        hdr_aud = tabla_aud.rows[0].cells
        hdr_aud[0].text = 'Total'
        hdr_aud[1].text = 'Excelentes'
        hdr_aud[2].text = 'Deficientes'
        
        val_aud = tabla_aud.rows[1].cells
        val_aud[0].text = str(total_auditorias)
        val_aud[1].text = str(excelentes)
        val_aud[2].text = str(deficientes)
        
        doc.add_paragraph()

        # 4. TOP 5 PRODUCTOS
        doc.add_heading('4. Top 5 Productos con Defectos', level=1)
        
        if tiene_tipo_producto and top_productos:
            tabla_top = doc.add_table(rows=1, cols=4)
            tabla_top.style = 'Table Grid'
            
            hdr_top = tabla_top.rows[0].cells
            hdr_top[0].text = '#'
            hdr_top[1].text = 'Producto'
            hdr_top[2].text = 'Defectos'
            hdr_top[3].text = 'Tasa'
            
            for i, (prod, total) in enumerate(top_productos, 1):
                row = tabla_top.add_row().cells
                row[0].text = str(i)
                row[1].text = prod or 'Sin especificar'
                row[2].text = str(total)
                row[3].text = f"{round(total / (unidades or 1) * 100, 2)}%"
        else:
            doc.add_paragraph('La base de datos no tiene registrada la columna "tipo_producto" para agrupar los defectos.')
            
        doc.add_paragraph()

        # 5. ÚLTIMOS REGISTROS
        doc.add_heading('5. Últimos Registros de Producción', level=1)
        
        tabla_reg = doc.add_table(rows=1, cols=4)
        tabla_reg.style = 'Table Grid'
        
        hdr_reg = tabla_reg.rows[0].cells
        hdr_reg[0].text = 'Fecha'
        hdr_reg[1].text = 'Línea'
        hdr_reg[2].text = 'Producto'
        hdr_reg[3].text = 'Estado'
        
        for r in ultimos:
            row = tabla_reg.add_row().cells
            row[0].text = r.fecha_registro.strftime("%d/%m/%Y") if r.fecha_registro else '--'
            row[1].text = r.linea_produccion or '--'
            row[2].text = r.tipo_producto or '--'
            row[3].text = 'OK'

        doc.add_paragraph()
        doc.add_paragraph('_' * 80)
        
        # Pie de página
        p_footer = doc.add_paragraph('Venezolana del Vidrio, C.A - Sistema de Control de Calidad')
        p_footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_footer.runs[0].font.size = Pt(8)

        # GUARDAR EN MEMORIA
        buffer = io.BytesIO()
        doc.save(buffer)
        buffer.seek(0)

        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="Dashboard_{datetime.now().strftime("%Y%m%d_%H%M")}.docx"'
            }
        )

    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="Librería python-docx no instalada. Ejecuta: pip install python-docx"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando Word: {str(e)}")


# ==========================================
# EXPORTAR DASHBOARD A PDF
# ==========================================

@router.get("/exportar/pdf")
def exportar_dashboard_pdf(
    db: Session = Depends(get_db)
):
    pass