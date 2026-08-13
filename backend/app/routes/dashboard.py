from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import Response
from sqlalchemy import func, desc
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
from pathlib import Path
import io

from app.database.connection import SessionLocal

from app.models.produccion import Produccion
from app.models.defecto import Defecto
from app.models.auditoria import Auditoria


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


    # ==========================
    # TOTAL LOTES
    # ==========================


    total_lotes = db.query(
        func.count(Produccion.id)
    ).scalar()



    # ==========================
    # TOTAL UNIDADES
    # ==========================


    unidades = db.query(
        func.sum(Produccion.cantidad)
    ).scalar()



    unidades = unidades or 0




    # ==========================
    # TOTAL DEFECTOS
    # ==========================


    total_defectos = db.query(
        func.count(Defecto.id)
    ).scalar()



    total_defectos = total_defectos or 0





    # ==========================
    # EFICIENCIA
    # ==========================


    if unidades > 0:


        eficiencia = (
            (unidades - total_defectos)
            /
            unidades
        ) * 100


    else:


        eficiencia = 100





    return {


        "lotes":
            total_lotes or 0,


        "unidades":
            unidades,


        "defectos":
            total_defectos,


        "eficiencia":
            f"{round(eficiencia,2)}%"

    }


# ==========================================
# TENDENCIAS (vs 7 DÍAS ATRÁS)
# ==========================================


@router.get("/tendencias")
def dashboard_tendencias(
    db: Session = Depends(get_db)
):
    """Calcula tendencias comparando los últimos 7 días vs los 7 días anteriores"""
    
    hoy = datetime.now().date()
    fecha_inicio_periodo_actual = hoy - timedelta(days=7)
    fecha_inicio_periodo_anterior = hoy - timedelta(days=14)
    fecha_fin_periodo_anterior = hoy - timedelta(days=8)
    
    # ==========================
    # PERÍODO ACTUAL (últimos 7 días)
    # ==========================
    
    actual_lotes = db.query(
        func.count(Produccion.id)
    ).filter(
        Produccion.fecha_registro >= fecha_inicio_periodo_actual
    ).scalar() or 0
    
    actual_unidades = db.query(
        func.sum(Produccion.cantidad)
    ).filter(
        Produccion.fecha_registro >= fecha_inicio_periodo_actual
    ).scalar() or 0
    
    actual_defectos = db.query(
        func.count(Defecto.id)
    ).filter(
        Defecto.fecha_registro >= fecha_inicio_periodo_actual
    ).scalar() or 0
    
    # ==========================
    # PERÍODO ANTERIOR (7 días previos)
    # ==========================
    
    anterior_lotes = db.query(
        func.count(Produccion.id)
    ).filter(
        Produccion.fecha_registro >= fecha_inicio_periodo_anterior,
        Produccion.fecha_registro <= fecha_fin_periodo_anterior
    ).scalar() or 0
    
    anterior_unidades = db.query(
        func.sum(Produccion.cantidad)
    ).filter(
        Produccion.fecha_registro >= fecha_inicio_periodo_anterior,
        Produccion.fecha_registro <= fecha_fin_periodo_anterior
    ).scalar() or 0
    
    anterior_defectos = db.query(
        func.count(Defecto.id)
    ).filter(
        Defecto.fecha_registro >= fecha_inicio_periodo_anterior,
        Defecto.fecha_registro <= fecha_fin_periodo_anterior
    ).scalar() or 0
    
    # ==========================
    # CÁLCULO DE TENDENCIAS
    # ==========================
    
    def calcular_tendencia(actual, anterior, invertir=False):
        """Calcula porcentaje de cambio. Si invertir=True, el cambio se invierte (para defectos)"""
        if anterior == 0:
            return 0 if actual == 0 else 100
        cambio = ((actual - anterior) / anterior) * 100
        return round(-cambio if invertir else cambio, 1)
    
    # Eficiencia
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


    registros = db.query(
        Produccion
    ).order_by(
        desc(Produccion.id)
    ).limit(5).all()



    return [


        {


            "fecha":

                r.fecha_registro.strftime("%d/%m/%Y")
                if r.fecha_registro
                else "--",




            "linea":

                r.linea_produccion
                if r.linea_produccion
                else "--",




            "producto":

                r.tipo_producto
                if r.tipo_producto
                else "--",




            "estado":

                "OK"


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
    """Devuelve datos para gráfico de producción de los últimos N días"""
    
    hoy = datetime.now().date()
    labels = []
    unidades_data = []
    lotes_data = []
    
    for i in range(dias - 1, -1, -1):
        fecha = hoy - timedelta(days=i)
        fecha_inicio = datetime.combine(fecha, datetime.min.time())
        fecha_fin = datetime.combine(fecha, datetime.max.time())
        
        unidades = db.query(
            func.sum(Produccion.cantidad)
        ).filter(
            Produccion.fecha_registro >= fecha_inicio,
            Produccion.fecha_registro <= fecha_fin
        ).scalar() or 0
        
        lotes = db.query(
            func.count(Produccion.id)
        ).filter(
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
    """Devuelve datos para gráfico de defectos por tipo"""
    
    criticos = db.query(
        func.count(Defecto.id)
    ).filter(
        Defecto.clasificacion == "Crítico"
    ).scalar() or 0
    
    mayores = db.query(
        func.count(Defecto.id)
    ).filter(
        Defecto.clasificacion == "Mayor"
    ).scalar() or 0
    
    menores = db.query(
        func.count(Defecto.id)
    ).filter(
        Defecto.clasificacion == "Menor"
    ).scalar() or 0
    
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
    """Devuelve datos para gráfico de producción por línea"""
    
    # Obtener todas las líneas distintas
    lineas = db.query(Produccion.linea_produccion).distinct().all()
    lineas = [l[0] for l in lineas if l[0]]
    
    resultados = []
    total = 0
    
    for linea in lineas:
        unidades = db.query(
            func.sum(Produccion.cantidad)
        ).filter(
            Produccion.linea_produccion == linea
        ).scalar() or 0
        resultados.append({
            "linea": linea,
            "unidades": unidades
        })
        total += unidades
    
    # Calcular porcentaje
    for r in resultados:
        r["porcentaje"] = round((r["unidades"] / total * 100), 1) if total > 0 else 0
    
    # Ordenar por unidades (mayor a menor)
    resultados.sort(key=lambda x: x["unidades"], reverse=True)
    
    return {
        "lineas": resultados
    }


# ==========================================
# GRÁFICO: EFICIENCIA MENSUAL
# ==========================================


@router.get("/grafico/eficiencia")
def grafico_eficiencia(
    meses: int = Query(6, description="Número de meses a mostrar"),
    db: Session = Depends(get_db)
):
    """Devuelve datos para gráfico de eficiencia mensual"""
    
    hoy = datetime.now().date()
    labels = []
    valores = []
    
    for i in range(meses - 1, -1, -1):
        # Primer día del mes
        mes = hoy.month - i
        año = hoy.year
        if mes <= 0:
            mes += 12
            año -= 1
        
        fecha_inicio = datetime(año, mes, 1)
        
        # Último día del mes
        if mes == 12:
            fecha_fin = datetime(año + 1, 1, 1) - timedelta(days=1)
        else:
            fecha_fin = datetime(año, mes + 1, 1) - timedelta(days=1)
        
        # Unidades del mes
        unidades = db.query(
            func.sum(Produccion.cantidad)
        ).filter(
            Produccion.fecha_registro >= fecha_inicio,
            Produccion.fecha_registro <= fecha_fin
        ).scalar() or 0
        
        # Defectos del mes
        defectos = db.query(
            func.count(Defecto.id)
        ).filter(
            Defecto.fecha_registro >= fecha_inicio,
            Defecto.fecha_registro <= fecha_fin
        ).scalar() or 0
        
        # Eficiencia del mes
        eficiencia = ((unidades - defectos) / unidades * 100) if unidades > 0 else 0
        
        labels.append(fecha_inicio.strftime("%b"))
        valores.append(round(eficiencia, 1))
    
    return {
        "labels": labels,
        "valores": valores
    }


# ==========================================
# TOP 5 PRODUCTOS CON MÁS DEFECTOS (CORREGIDO)
# ==========================================


@router.get("/top/defectos")
def top_defectos(
    db: Session = Depends(get_db)
):
    """Devuelve el top 5 de productos con más defectos"""
    
    try:
        # Verificar si el campo tipo_producto existe en la tabla
        from sqlalchemy import inspect
        inspector = inspect(Defecto)
        columnas = [c.name for c in inspector.columns]
        
        if 'tipo_producto' not in columnas:
            # Si no existe, devolver total general
            total_defectos = db.query(func.count(Defecto.id)).scalar() or 0
            return [{
                "producto": "Total defectos",
                "defectos": total_defectos,
                "tasa": 100.0 if total_defectos > 0 else 0
            }]
        
        # Agrupar defectos por tipo_producto
        resultados = db.query(
            Defecto.tipo_producto,
            func.count(Defecto.id).label('total_defectos')
        ).group_by(
            Defecto.tipo_producto
        ).order_by(
            desc('total_defectos')
        ).limit(5).all()
        
        # Si no hay resultados o todos son NULL, obtener total general
        if not resultados or all(r[0] is None for r in resultados):
            total_defectos = db.query(func.count(Defecto.id)).scalar() or 0
            return [{
                "producto": "Todos los productos",
                "defectos": total_defectos,
                "tasa": 100.0 if total_defectos > 0 else 0
            }]
        
        # Calcular tasa de defectos por producto
        top = []
        for r in resultados:
            producto = r[0] or "Sin especificar"
            total_defectos = r[1] or 0
            
            # Obtener total de unidades producidas de ese producto
            total_unidades = db.query(
                func.sum(Produccion.cantidad)
            ).filter(
                Produccion.tipo_producto == producto
            ).scalar() or 0
            
            # Si no hay unidades para ese producto, usar total general
            if total_unidades == 0:
                total_unidades = db.query(
                    func.sum(Produccion.cantidad)
                ).scalar() or 1
            
            tasa = round((total_defectos / total_unidades * 100), 2) if total_unidades > 0 else 0
            
            top.append({
                "producto": producto,
                "defectos": total_defectos,
                "tasa": tasa
            })
        
        return top
        
    except Exception as e:
        print(f"❌ Error en top/defectos: {e}")
        # Fallback: devolver total de defectos
        total_defectos = db.query(func.count(Defecto.id)).scalar() or 0
        return [{
            "producto": "Total defectos",
            "defectos": total_defectos,
            "tasa": 100.0 if total_defectos > 0 else 0
        }]


# ==========================================
# AUDITORÍAS PENDIENTES
# ==========================================


@router.get("/auditorias/pendientes")
def auditorias_pendientes(
    db: Session = Depends(get_db)
):
    """Devuelve resumen de auditorías pendientes"""
    
    total = db.query(func.count(Auditoria.id)).scalar() or 0
    
    en_proceso = db.query(func.count(Auditoria.id)).filter(
        Auditoria.estado == "En proceso"
    ).scalar() or 0
    
    cerradas = db.query(func.count(Auditoria.id)).filter(
        Auditoria.estado == "Cerrada"
    ).scalar() or 0
    
    con_nc = db.query(func.count(Auditoria.id)).filter(
        Auditoria.no_conformidades > 0,
        Auditoria.estado == "En proceso"
    ).scalar() or 0
    
    criticas = db.query(func.count(Auditoria.id)).filter(
        Auditoria.no_conformidades >= 3,
        Auditoria.estado == "En proceso"
    ).scalar() or 0
    
    return {
        "total": total,
        "en_proceso": en_proceso,
        "cerradas": cerradas,
        "con_nc": con_nc,
        "criticas": criticas
    }


# ==========================================
# ALERTAS DEL DASHBOARD
# ==========================================


@router.get("/alerts")
def dashboard_alerts(
    db: Session = Depends(get_db)
):


    alertas = []


    # ==========================
    # DEFECTOS CRÍTICOS
    # ==========================


    defectos_criticos = db.query(
        Defecto
    ).filter(
        Defecto.clasificacion == "Crítico"
    ).all()




    for defecto in defectos_criticos:


        alertas.append({


            "tipo":

                "danger",



            "mensaje":

                f"Defecto crítico detectado: {defecto.tipo_defecto}"


        })


    # ==========================
    # DEFECTOS MAYORES
    # ==========================


    defectos_mayores = db.query(
        Defecto
    ).filter(
        Defecto.clasificacion == "Mayor"
    ).all()




    for defecto in defectos_mayores:


        alertas.append({


            "tipo":

                "warning",



            "mensaje":

                f"Defecto mayor detectado: {defecto.tipo_defecto}"


        })


    # ==========================
    # BAJA PRODUCCIÓN
    # ==========================


    lotes = db.query(
        Produccion
    ).all()



    for lote in lotes:


        if lote.cantidad and lote.cantidad < 50:



            alertas.append({


                "tipo":

                    "warning",



                "mensaje":

                    f"Lote {lote.codigo_lote} con baja producción"


            })


    # ==========================
    # AUDITORÍAS CON NC CRÍTICAS
    # ==========================


    auditorias_criticas = db.query(
        Auditoria
    ).filter(
        Auditoria.no_conformidades >= 3,
        Auditoria.estado == "En proceso"
    ).all()


    for auditoria in auditorias_criticas:


        alertas.append({


            "tipo":

                "danger",



            "mensaje":

                f"Auditoría {auditoria.codigo} tiene {auditoria.no_conformidades} NC críticas"


        })


    # ==========================
    # SIN ALERTAS
    # ==========================


    if not alertas:


        alertas.append({


            "tipo":

                "success",



            "mensaje":

                "Sistema operando correctamente"


        })


    return alertas


# ==========================================
# EXPORTAR DASHBOARD A PDF (MEJORADO)
# ==========================================

@router.get("/exportar/pdf")
def exportar_dashboard_pdf(
    db: Session = Depends(get_db)
):
    """Genera un reporte PDF profesional del dashboard completo"""
    
    try:
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.lib.units import cm, inch
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
        from reportlab.pdfgen import canvas
        
        # Ruta del logo
        LOGO_PATH = Path(__file__).parent.parent / "static" / "logo.png"
        
        # ==========================================
        # OBTENER DATOS DEL DASHBOARD
        # ==========================================
        
        # Estadísticas generales
        total_lotes = db.query(func.count(Produccion.id)).scalar() or 0
        unidades = db.query(func.sum(Produccion.cantidad)).scalar() or 0
        total_defectos = db.query(func.count(Defecto.id)).scalar() or 0
        eficiencia = round(((unidades - total_defectos) / unidades * 100), 2) if unidades > 0 else 100
        
        # Defectos por tipo
        criticos = db.query(func.count(Defecto.id)).filter(Defecto.clasificacion == "Crítico").scalar() or 0
        mayores = db.query(func.count(Defecto.id)).filter(Defecto.clasificacion == "Mayor").scalar() or 0
        menores = db.query(func.count(Defecto.id)).filter(Defecto.clasificacion == "Menor").scalar() or 0
        
        # Auditorías pendientes
        total_auditorias = db.query(func.count(Auditoria.id)).scalar() or 0
        en_proceso = db.query(func.count(Auditoria.id)).filter(Auditoria.estado == "En proceso").scalar() or 0
        cerradas = db.query(func.count(Auditoria.id)).filter(Auditoria.estado == "Cerrada").scalar() or 0
        con_nc = db.query(func.count(Auditoria.id)).filter(Auditoria.no_conformidades > 0, Auditoria.estado == "En proceso").scalar() or 0
        
        # Top 5 productos con defectos
        top_productos = db.query(
            Defecto.tipo_producto,
            func.count(Defecto.id).label('total')
        ).group_by(Defecto.tipo_producto).order_by(desc('total')).limit(5).all()
        
        # Últimos 5 registros
        ultimos = db.query(Produccion).order_by(desc(Produccion.id)).limit(5).all()
        
        # ==========================================
        # CONSTRUIR PDF
        # ==========================================
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            rightMargin=1.5*cm,
            leftMargin=1.5*cm,
            topMargin=1.5*cm,
            bottomMargin=1.5*cm
        )
        
        elements = []
        styles = getSampleStyleSheet()
        
        # ---- Estilo de sección ----
        sec_style = ParagraphStyle(
            'SecTitulo',
            parent=styles['Heading4'],
            fontSize=11,
            alignment=TA_CENTER,
            spaceAfter=5,
            textColor=colors.HexColor('#1a237e'),
            backColor=colors.HexColor('#e3f2fd')
        )
        
        # ---- Estilo de subtítulo ----
        sub_style = ParagraphStyle(
            'SubTitulo',
            parent=styles['Normal'],
            fontSize=9,
            alignment=TA_LEFT,
            spaceAfter=3,
            textColor=colors.HexColor('#333333')
        )
        
        # ---- LOGO ----
        if LOGO_PATH.exists():
            try:
                logo = Image(str(LOGO_PATH.absolute()), width=3*cm, height=1.5*cm)
                logo.hAlign = 'CENTER'
                elements.append(logo)
                elements.append(Spacer(1, 0.3*cm))
            except Exception:
                pass
        
        # ---- TÍTULO ----
        titulo_style = ParagraphStyle(
            'Titulo',
            parent=styles['Heading1'],
            fontSize=18,
            alignment=TA_CENTER,
            spaceAfter=5,
            textColor=colors.HexColor('#1a237e')
        )
        elements.append(Paragraph('ESTADÍSTICA DE CONTROL DE CALIDAD', titulo_style))
        
        subtitulo_style = ParagraphStyle(
            'Subtitulo',
            parent=styles['Normal'],
            fontSize=10,
            alignment=TA_CENTER,
            spaceAfter=5,
            textColor=colors.HexColor('#666666'),
            fontStyle='italic'
        )
        elements.append(Paragraph('Venezolana del Vidrio - Sistema de Gestión de Calidad', subtitulo_style))
        
        # ---- INFORMACIÓN DEL DOCUMENTO ----
        info_style = ParagraphStyle(
            'Info',
            parent=styles['Normal'],
            fontSize=8,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#888888'),
            spaceAfter=10
        )
        elements.append(Paragraph(f'Reporte generado: {datetime.now().strftime("%d/%m/%Y %H:%M")}', info_style))
        
        elements.append(Paragraph('_' * 100, styles['Normal']))
        elements.append(Spacer(1, 0.5*cm))
        
        # ---- INDICADORES PRINCIPALES (KPIs) ----
        elements.append(Paragraph('INDICADORES PRINCIPALES', sec_style))
        elements.append(Spacer(1, 0.2*cm))
        
        kpi_data = [
            ['📦 Producción', '📋 Lotes', '⚠️ Defectos', '🎯 Eficiencia'],
            [f"{unidades:,.0f}", f"{total_lotes}", f"{total_defectos}", f"{eficiencia}%"]
        ]
        
        kpi_table = Table(kpi_data, colWidths=[4.5*cm, 4.5*cm, 4.5*cm, 4.5*cm])
        kpi_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, 1), 16),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e3f2fd')),
            ('TEXTCOLOR', (0, 1), (-1, 1), colors.HexColor('#1a237e')),
        ]))
        elements.append(kpi_table)
        elements.append(Spacer(1, 0.5*cm))
        
        # ---- DEFECTOS POR TIPO ----
        elements.append(Paragraph('DEFECTOS POR TIPO', sec_style))
        elements.append(Spacer(1, 0.2*cm))
        
        def_data = [
            ['Críticos', 'Mayores', 'Menores', 'Total'],
            [str(criticos), str(mayores), str(menores), str(total_defectos)]
        ]
        
        def_table = Table(def_data, colWidths=[3.5*cm, 3.5*cm, 3.5*cm, 3.5*cm])
        def_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ffebee')),
            ('BACKGROUND', (0, 1), (0, 1), colors.HexColor('#dc3545')),
            ('TEXTCOLOR', (0, 1), (0, 1), colors.white),
            ('BACKGROUND', (1, 1), (1, 1), colors.HexColor('#ffc107')),
            ('BACKGROUND', (2, 1), (2, 1), colors.HexColor('#17a2b8')),
            ('TEXTCOLOR', (2, 1), (2, 1), colors.white),
        ]))
        elements.append(def_table)
        elements.append(Spacer(1, 0.5*cm))
        
        # ---- AUDITORÍAS ----
        elements.append(Paragraph('AUDITORÍAS', sec_style))
        elements.append(Spacer(1, 0.2*cm))
        
        aud_data = [
            ['Total', 'En proceso', 'Cerradas', 'Con NC'],
            [str(total_auditorias), str(en_proceso), str(cerradas), str(con_nc)]
        ]
        
        aud_table = Table(aud_data, colWidths=[3.5*cm, 3.5*cm, 3.5*cm, 3.5*cm])
        aud_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e3f2fd')),
        ]))
        elements.append(aud_table)
        elements.append(Spacer(1, 0.5*cm))
        
        # ---- TOP 5 PRODUCTOS CON DEFECTOS ----
        elements.append(Paragraph('TOP 5 PRODUCTOS CON DEFECTOS', sec_style))
        elements.append(Spacer(1, 0.2*cm))
        
        top_data = [['#', 'Producto', 'Defectos', 'Tasa']]
        for i, (producto, total) in enumerate(top_productos, 1):
            top_data.append([
                str(i),
                producto or 'Sin especificar',
                str(total),
                f"{round(total / (unidades or 1) * 100, 2)}%"
            ])
        
        if len(top_data) == 1:
            top_data.append(['-', 'Sin datos', '-', '-'])
        
        top_table = Table(top_data, colWidths=[1*cm, 7*cm, 2.5*cm, 2.5*cm])
        top_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a237e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ]))
        elements.append(top_table)
        elements.append(Spacer(1, 0.5*cm))
        
        # ---- ÚLTIMOS REGISTROS ----
        elements.append(Paragraph('ÚLTIMOS REGISTROS DE PRODUCCIÓN', sec_style))
        elements.append(Spacer(1, 0.2*cm))
        
        reg_data = [['Fecha', 'Línea', 'Producto', 'Estado']]
        for r in ultimos:
            reg_data.append([
                r.fecha_registro.strftime("%d/%m/%Y") if r.fecha_registro else '--',
                r.linea_produccion or '--',
                r.tipo_producto or '--',
                'OK'
            ])
        
        if len(reg_data) == 1:
            reg_data.append(['--', '--', '--', '--'])
        
        reg_table = Table(reg_data, colWidths=[3*cm, 4*cm, 4*cm, 3*cm])
        reg_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e3f2fd')),
        ]))
        elements.append(reg_table)
        elements.append(Spacer(1, 0.5*cm))
        
        # ---- LÍNEA SEPARADORA ----
        elements.append(Paragraph('_' * 100, styles['Normal']))
        elements.append(Spacer(1, 0.5*cm))
        
        # ---- VALIDACIÓN (Encargado y Firma) ----
        elements.append(Paragraph('VALIDACIÓN DEL REPORTE', sec_style))
        elements.append(Spacer(1, 0.3*cm))
        
        # Tabla de validación
        val_data = [
            ['ENCARGADO:', '_____________________________', 'FECHA:', datetime.now().strftime("%d/%m/%Y")],
            ['', '', '', ''],
            ['FIRMA:', '_____________________________', '', ''],
        ]
        
        val_table = Table(val_data, colWidths=[3*cm, 6*cm, 3*cm, 4*cm])
        val_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (0, 0), (0, 2), 'RIGHT'),
            ('ALIGN', (2, 0), (2, 0), 'RIGHT'),
            ('ALIGN', (1, 0), (1, 0), 'CENTER'),
            ('ALIGN', (3, 0), (3, 0), 'LEFT'),
            ('ALIGN', (1, 2), (1, 2), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e3f2fd')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ]))
        elements.append(val_table)
        elements.append(Spacer(1, 0.3*cm))
        
        # ---- PIE DE PÁGINA ----
        pie_style = ParagraphStyle('Pie', parent=styles['Normal'], fontSize=7, alignment=TA_CENTER, textColor=colors.grey)
        elements.append(Paragraph('Venezolana del Vidrio, C.A - Sistema de Control de Calidad', pie_style))
        elements.append(Paragraph(f'Documento generado: {datetime.now().strftime("%d/%m/%Y %H:%M")}', pie_style))
        elements.append(Paragraph('Este documento es propiedad de Venezolana del Vidrio, C.A.', pie_style))
        
        doc.build(elements)
        buffer.seek(0)
        
        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="Dashboard_{datetime.now().strftime("%Y%m%d_%H%M")}.pdf"'
            }
        )
        
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Librería no instalada: {str(e)}. Ejecuta: pip install reportlab"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {str(e)}")