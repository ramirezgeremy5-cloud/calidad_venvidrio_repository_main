# app/routes/reportes.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from datetime import datetime
import io
import os
from pathlib import Path

from app.database.connection import SessionLocal
from app.models.auditoria_calidad import AuditoriaCalidad

router = APIRouter(
    prefix="/reportes",
    tags=["Reportes"]
)

# ============================================
# RUTA DEL LOGO
# ============================================

BASE_DIR = Path(__file__).resolve().parent.parent
LOGO_PATH = BASE_DIR / "static" / "logo.png"
LOGO_PATH_ABS = str(LOGO_PATH.absolute())

print(f"🔍 Buscando logo en: {LOGO_PATH_ABS}")

if LOGO_PATH.exists():
    print(f"✅ Logo encontrado en: {LOGO_PATH_ABS}")
else:
    print(f"❌ Logo NO encontrado en: {LOGO_PATH_ABS}")
    for ext in ['.jpg', '.jpeg', '.gif', '.bmp', '.webp']:
        temp_path = BASE_DIR / "static" / f"logo{ext}"
        if temp_path.exists():
            LOGO_PATH = temp_path
            LOGO_PATH_ABS = str(LOGO_PATH.absolute())
            print(f"✅ Logo encontrado como: {LOGO_PATH_ABS}")
            break


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def formatear_fecha(fecha):
    if fecha:
        return fecha.strftime("%d/%m/%Y %H:%M")
    return ""


def formatear_fecha_corta(fecha):
    if fecha:
        return fecha.strftime("%d/%m/%Y")
    return ""


@router.get("/excel/{auditoria_id}")
def descargar_excel(
    auditoria_id: int,
    db: Session = Depends(get_db)
):
    """Genera un reporte Excel profesional de una evaluación de calidad específica"""
    
    auditoria = db.query(AuditoriaCalidad).filter(AuditoriaCalidad.id == auditoria_id).first()
    if not auditoria:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada")
    
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Evaluación de Calidad"
        
        # ============================================
        # ESTILOS
        # ============================================
        
        titulo_font = Font(name='Arial', size=16, bold=True, color='1a237e')
        subtitulo_font = Font(name='Arial', size=11, bold=True, color='1a237e')
        normal_font = Font(name='Arial', size=10)
        bold_font = Font(name='Arial', size=10, bold=True)
        small_font = Font(name='Arial', size=8)
        
        center_align = Alignment(horizontal='center', vertical='center')
        left_align = Alignment(horizontal='left', vertical='center')
        right_align = Alignment(horizontal='right', vertical='center')
        
        thin_border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        header_fill_light = PatternFill(start_color='e3f2fd', end_color='e3f2fd', fill_type='solid')
        success_fill = PatternFill(start_color='e8f5e9', end_color='e8f5e9', fill_type='solid')
        danger_fill = PatternFill(start_color='ffebee', end_color='ffebee', fill_type='solid')
        
        # ============================================
        # ENCABEZADO CON LOGO
        # ============================================
        
        row = 1
        
        if LOGO_PATH.exists():
            try:
                from openpyxl.drawing.image import Image
                img = Image(str(LOGO_PATH.absolute()))
                img.width = 250
                img.height = 120
                ws.add_image(img, 'A1')
                row = 7
                print(f"✅ Logo insertado en Excel desde: {LOGO_PATH}")
            except Exception as e:
                print(f"⚠️ Error cargando logo para Excel: {e}")
                row = 2
        else:
            print(f"⚠️ Logo no encontrado en: {LOGO_PATH}")
            row = 2
        
        # Título principal
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=10)
        ws.cell(row=row, column=1, value="REGISTRO DE EVALUACIÓN DE CALIDAD").font = titulo_font
        ws.cell(row=row, column=1).alignment = center_align
        row += 1
        
        # Subtítulo
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=10)
        ws.cell(row=row, column=1, value="Sistema de Gestión de Calidad - Venezolana del Vidrio, C.A").font = Font(name='Arial', size=10, italic=True, color='666666')
        ws.cell(row=row, column=1).alignment = center_align
        row += 2
        
        # Línea separadora
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=10)
        ws.cell(row=row, column=1, value="-" * 80).font = Font(name='Arial', size=8, color='cccccc')
        ws.cell(row=row, column=1).alignment = center_align
        row += 1
        
        # ============================================
        # DATOS GENERALES
        # ============================================
        
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=10)
        ws.cell(row=row, column=1, value="DATOS GENERALES").font = subtitulo_font
        ws.cell(row=row, column=1).alignment = center_align
        ws.cell(row=row, column=1).fill = header_fill_light
        ws.cell(row=row, column=1).border = thin_border
        row += 1
        
        # Adaptado a los campos de AuditoriaCalidad
        datos = [
            ("ID Evaluación", auditoria.id),
            ("Periodo", auditoria.periodo),
            ("Evaluado (ID)", auditoria.evaluado_id),
            ("Evaluador (ID)", auditoria.evaluador_id),
            ("Puntaje", f"{auditoria.puntaje}%"),
            ("Categoría", auditoria.categoria),
            ("Fecha de Registro", formatear_fecha(auditoria.fecha)),
        ]
        
        for label, value in datos:
            ws.cell(row=row, column=1, value=label).font = bold_font
            ws.cell(row=row, column=1).alignment = left_align
            ws.cell(row=row, column=1).border = thin_border
            ws.cell(row=row, column=1).fill = header_fill_light
            
            ws.cell(row=row, column=2, value=str(value)).font = normal_font
            ws.cell(row=row, column=2).alignment = left_align
            ws.cell(row=row, column=2).border = thin_border
            
            if label == "Puntaje":
                if auditoria.puntaje >= 90:
                    ws.cell(row=row, column=2).fill = success_fill
                elif auditoria.puntaje < 75:
                    ws.cell(row=row, column=2).fill = danger_fill
            
            row += 1
        
        row += 1
        
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=10)
        ws.cell(row=row, column=1, value="-" * 80).font = Font(name='Arial', size=8, color='cccccc')
        ws.cell(row=row, column=1).alignment = center_align
        row += 1
        
        # ============================================
        # OBSERVACIONES
        # ============================================
        
        if auditoria.observaciones:
            ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=10)
            ws.cell(row=row, column=1, value="OBSERVACIONES").font = subtitulo_font
            ws.cell(row=row, column=1).alignment = center_align
            ws.cell(row=row, column=1).fill = header_fill_light
            ws.cell(row=row, column=1).border = thin_border
            row += 1
            
            ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=10)
            ws.cell(row=row, column=1, value=auditoria.observaciones).font = normal_font
            ws.cell(row=row, column=1).alignment = left_align
            ws.cell(row=row, column=1).border = thin_border
            row += 2
            
            ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=10)
            ws.cell(row=row, column=1, value="-" * 80).font = Font(name='Arial', size=8, color='cccccc')
            ws.cell(row=row, column=1).alignment = center_align
            row += 1
        
        # ============================================
        # VALIDACIÓN
        # ============================================
        
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=10)
        ws.cell(row=row, column=1, value="VALIDACIÓN").font = subtitulo_font
        ws.cell(row=row, column=1).alignment = center_align
        ws.cell(row=row, column=1).fill = header_fill_light
        ws.cell(row=row, column=1).border = thin_border
        row += 1
        
        ws.cell(row=row, column=1, value="Responsable:").font = bold_font
        ws.cell(row=row, column=1).alignment = right_align
        ws.cell(row=row, column=1).border = thin_border
        
        ws.merge_cells(start_row=row, start_column=2, end_row=row, end_column=5)
        ws.cell(row=row, column=2, value=f"Evaluador ID {auditoria.evaluador_id}").font = normal_font
        ws.cell(row=row, column=2).alignment = left_align
        ws.cell(row=row, column=2).border = thin_border
        
        ws.cell(row=row, column=6, value="Fecha:").font = bold_font
        ws.cell(row=row, column=6).alignment = right_align
        ws.cell(row=row, column=6).border = thin_border
        
        ws.merge_cells(start_row=row, start_column=7, end_row=row, end_column=10)
        ws.cell(row=row, column=7, value=datetime.now().strftime("%d/%m/%Y")).font = normal_font
        ws.cell(row=row, column=7).alignment = left_align
        ws.cell(row=row, column=7).border = thin_border
        row += 1
        
        ws.cell(row=row, column=1, value="Firma:").font = bold_font
        ws.cell(row=row, column=1).alignment = right_align
        ws.cell(row=row, column=1).border = thin_border
        
        ws.merge_cells(start_row=row, start_column=2, end_row=row, end_column=10)
        ws.cell(row=row, column=2, value="_____________________________").font = Font(name='Arial', size=10, italic=True)
        ws.cell(row=row, column=2).alignment = center_align
        ws.cell(row=row, column=2).border = thin_border
        row += 2
        
        # ============================================
        # PIE DE PÁGINA
        # ============================================
        
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=10)
        ws.cell(row=row, column=1, value=f"Documento generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}").font = small_font
        ws.cell(row=row, column=1).alignment = center_align
        ws.cell(row=row, column=1).font = Font(name='Arial', size=8, color='888888')
        
        # ============================================
        # AJUSTAR ANCHOS
        # ============================================
        
        ws.column_dimensions['A'].width = 25
        ws.column_dimensions['B'].width = 40
        
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="Evaluacion_{auditoria.id}_{datetime.now().strftime("%Y%m%d_%H%M")}.xlsx"'
            }
        )
        
    except ImportError as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Librería no instalada: {str(e)}. Ejecuta: pip install openpyxl"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando Excel: {str(e)}")


@router.get("/pdf/{auditoria_id}")
def descargar_pdf(
    auditoria_id: int,
    db: Session = Depends(get_db)
):
    """Genera un reporte PDF profesional de una evaluación de calidad específica"""
    
    auditoria = db.query(AuditoriaCalidad).filter(AuditoriaCalidad.id == auditoria_id).first()
    if not auditoria:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada")
    
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=1.5*cm,
            leftMargin=1.5*cm,
            topMargin=1.5*cm,
            bottomMargin=1.5*cm
        )
        
        elements = []
        styles = getSampleStyleSheet()
        
        # ============================================
        # LOGO
        # ============================================
        
        if LOGO_PATH.exists():
            try:
                logo = Image(str(LOGO_PATH.absolute()), width=5*cm, height=2.5*cm)
                logo.hAlign = 'CENTER'
                elements.append(logo)
                elements.append(Spacer(1, 0.8*cm))
                print(f"✅ Logo insertado en PDF desde: {LOGO_PATH}")
            except Exception as e:
                print(f"⚠️ Error cargando logo para PDF: {e}")
        
        # ============================================
        # TÍTULOS
        # ============================================
        
        titulo_style = ParagraphStyle(
            'Titulo',
            parent=styles['Heading1'],
            fontSize=16,
            alignment=TA_CENTER,
            spaceAfter=5,
            textColor=colors.HexColor('#1a237e')
        )
        elements.append(Paragraph('REGISTRO DE EVALUACIÓN DE CALIDAD', titulo_style))
        
        subtitulo_style = ParagraphStyle(
            'Subtitulo',
            parent=styles['Normal'],
            fontSize=10,
            alignment=TA_CENTER,
            spaceAfter=15,
            textColor=colors.HexColor('#666666'),
            fontStyle='italic'
        )
        elements.append(Paragraph('Sistema de Gestión de Calidad - Venezolana del Vidrio, C.A', subtitulo_style))
        
        elements.append(Paragraph('_' * 80, styles['Normal']))
        elements.append(Spacer(1, 0.3*cm))
        
        # ============================================
        # DATOS GENERALES
        # ============================================
        
        sec_style = ParagraphStyle(
            'SecTitulo',
            parent=styles['Heading4'],
            fontSize=11,
            alignment=TA_CENTER,
            spaceAfter=5,
            textColor=colors.HexColor('#1a237e'),
            backColor=colors.HexColor('#e3f2fd')
        )
        elements.append(Paragraph('DATOS GENERALES', sec_style))
        elements.append(Spacer(1, 0.2*cm))
        
        data = [
            ['ID Evaluación', str(auditoria.id)],
            ['Periodo', auditoria.periodo or ''],
            ['Evaluado (ID)', str(auditoria.evaluado_id)],
            ['Evaluador (ID)', str(auditoria.evaluador_id)],
            ['Puntaje', f"{auditoria.puntaje}%"],
            ['Categoría', auditoria.categoria or ''],
            ['Fecha de Registro', formatear_fecha(auditoria.fecha)],
        ]
        
        table = Table(data, colWidths=[4.5*cm, 9.5*cm])
        table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e3f2fd')),
            ('BACKGROUND', (1, 4), (1, 4), colors.HexColor('#e8f5e9') if auditoria.puntaje >= 90 else colors.HexColor('#ffebee') if auditoria.puntaje < 75 else colors.white),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 0.5*cm))
        
        elements.append(Paragraph('_' * 80, styles['Normal']))
        elements.append(Spacer(1, 0.3*cm))
        
        # ============================================
        # OBSERVACIONES
        # ============================================
        
        if auditoria.observaciones:
            elements.append(Paragraph('OBSERVACIONES', sec_style))
            obs_style = ParagraphStyle('Obs', parent=styles['Normal'], fontSize=9, spaceAfter=5, alignment=TA_LEFT)
            elements.append(Paragraph(auditoria.observaciones, obs_style))
            elements.append(Spacer(1, 0.3*cm))
            elements.append(Paragraph('_' * 80, styles['Normal']))
            elements.append(Spacer(1, 0.3*cm))
        
        # ============================================
        # VALIDACIÓN
        # ============================================
        
        elements.append(Paragraph('VALIDACIÓN', sec_style))
        elements.append(Spacer(1, 0.3*cm))
        
        val_data = [
            ['Responsable:', f"Evaluador ID {auditoria.evaluador_id}", 'Fecha:', datetime.now().strftime("%d/%m/%Y")]
        ]
        
        val_table = Table(val_data, colWidths=[2.5*cm, 6*cm, 2.5*cm, 4*cm])
        val_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('ALIGN', (3, 0), (3, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#e3f2fd')),
        ]))
        elements.append(val_table)
        elements.append(Spacer(1, 0.3*cm))
        
        firma_style = ParagraphStyle('Firma', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER)
        elements.append(Paragraph('_____________________________', firma_style))
        elements.append(Paragraph('<b>FIRMA</b>', firma_style))
        elements.append(Spacer(1, 0.2*cm))
        
        # ============================================
        # PIE DE PÁGINA
        # ============================================
        
        elements.append(Spacer(1, 0.5*cm))
        pie_style = ParagraphStyle('Pie', parent=styles['Normal'], fontSize=7, alignment=TA_CENTER, textColor=colors.grey)
        elements.append(Paragraph(f'Documento generado: {datetime.now().strftime("%d/%m/%Y %H:%M")}', pie_style))
        elements.append(Paragraph('Venezolana del Vidrio, C.A - Sistema de Gestión de Calidad', pie_style))
        
        doc.build(elements)
        buffer.seek(0)
        
        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="Evaluacion_{auditoria.id}_{datetime.now().strftime("%Y%m%d_%H%M")}.pdf"'
            }
        )
        
    except ImportError as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Librería no instalada: {str(e)}. Ejecuta: pip install reportlab"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {str(e)}")


@router.get("/auditorias/excel")
def descargar_excel_todas(
    db: Session = Depends(get_db)
):
    """Genera un reporte Excel con todas las evaluaciones de calidad"""
    
    auditorias = db.query(AuditoriaCalidad).order_by(AuditoriaCalidad.id.desc()).all()
    
    if not auditorias:
        raise HTTPException(status_code=404, detail="No hay evaluaciones registradas")
    
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Evaluaciones"
        
        # ============================================
        # ESTILOS
        # ============================================
        
        titulo_font = Font(name='Arial', size=16, bold=True, color='1a237e')
        header_font = Font(name='Arial', size=10, bold=True, color='FFFFFF')
        center_align = Alignment(horizontal='center', vertical='center')
        left_align = Alignment(horizontal='left', vertical='center')
        thin_border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))
        header_fill = PatternFill(start_color='1a237e', end_color='1a237e', fill_type='solid')
        
        row = 1
        
        # Logo
        if LOGO_PATH.exists():
            try:
                from openpyxl.drawing.image import Image
                img = Image(str(LOGO_PATH.absolute()))
                img.width = 250
                img.height = 120
                ws.add_image(img, 'A1')
                row = 7
            except Exception as e:
                print(f"⚠️ Error cargando logo para Excel: {e}")
                row = 2
        else:
            row = 2
        
        # Título
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=9)
        ws.cell(row=row, column=1, value="REPORTE DE EVALUACIONES DE CALIDAD").font = titulo_font
        ws.cell(row=row, column=1).alignment = center_align
        row += 1
        
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=9)
        ws.cell(row=row, column=1, value=f"Total: {len(auditorias)} evaluaciones").font = Font(name='Arial', size=10, italic=True, color='666666')
        ws.cell(row=row, column=1).alignment = center_align
        row += 2
        
        # Encabezados
        headers = ['ID', 'Periodo', 'Evaluado (ID)', 'Evaluador (ID)', 'Puntaje', 'Categoría', 'Fecha']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=row, column=col, value=header)
            cell.font = header_font
            cell.alignment = center_align
            cell.fill = header_fill
            cell.border = thin_border
        
        row += 1
        
        # Datos
        for aud in auditorias:
            ws.cell(row=row, column=1, value=aud.id).alignment = center_align
            ws.cell(row=row, column=2, value=aud.periodo or '').alignment = left_align
            ws.cell(row=row, column=3, value=aud.evaluado_id).alignment = center_align
            ws.cell(row=row, column=4, value=aud.evaluador_id).alignment = center_align
            
            puntaje_cell = ws.cell(row=row, column=5, value=aud.puntaje)
            puntaje_cell.alignment = center_align
            if aud.puntaje >= 90:
                puntaje_cell.fill = PatternFill(start_color='e8f5e9', end_color='e8f5e9', fill_type='solid')
            elif aud.puntaje < 75:
                puntaje_cell.fill = PatternFill(start_color='ffebee', end_color='ffebee', fill_type='solid')
            
            ws.cell(row=row, column=6, value=aud.categoria or '').alignment = center_align
            ws.cell(row=row, column=7, value=formatear_fecha_corta(aud.fecha)).alignment = center_align
            
            for col in range(1, 8):
                ws.cell(row=row, column=col).border = thin_border
            
            row += 1
        
        # Pie de página
        row += 1
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=7)
        ws.cell(row=row, column=1, value=f"Documento generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}").font = Font(name='Arial', size=8, color='888888')
        ws.cell(row=row, column=1).alignment = center_align
        
        # Ajustar anchos
        ws.column_dimensions['A'].width = 10
        ws.column_dimensions['B'].width = 16
        ws.column_dimensions['C'].width = 16
        ws.column_dimensions['D'].width = 16
        ws.column_dimensions['E'].width = 12
        ws.column_dimensions['F'].width = 16
        ws.column_dimensions['G'].width = 18
        
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="Evaluaciones_{datetime.now().strftime("%Y%m%d_%H%M")}.xlsx"'
            }
        )
        
    except ImportError as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Librería no instalada: {str(e)}. Ejecuta: pip install openpyxl"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando Excel: {str(e)}")


@router.get("/auditorias/pdf")
def descargar_pdf_todas(
    db: Session = Depends(get_db)
):
    """Genera un reporte PDF con todas las evaluaciones de calidad"""
    
    auditorias = db.query(AuditoriaCalidad).order_by(AuditoriaCalidad.id.desc()).all()
    
    if not auditorias:
        raise HTTPException(status_code=404, detail="No hay evaluaciones registradas")
    
    try:
        from reportlab.lib.pagesizes import landscape, A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            rightMargin=1*cm,
            leftMargin=1*cm,
            topMargin=1*cm,
            bottomMargin=1*cm
        )
        
        elements = []
        styles = getSampleStyleSheet()
        
        # Logo
        if LOGO_PATH.exists():
            try:
                logo = Image(str(LOGO_PATH.absolute()), width=3.5*cm, height=1.8*cm)
                logo.hAlign = 'CENTER'
                elements.append(logo)
                elements.append(Spacer(1, 0.4*cm))
            except Exception as e:
                print(f"⚠️ Error cargando logo para PDF: {e}")
        
        # Título
        titulo_style = ParagraphStyle(
            'Titulo',
            parent=styles['Heading1'],
            fontSize=14,
            alignment=TA_CENTER,
            spaceAfter=5,
            textColor=colors.HexColor('#1a237e')
        )
        elements.append(Paragraph('REPORTE DE EVALUACIONES DE CALIDAD', titulo_style))
        
        total_style = ParagraphStyle(
            'Total',
            parent=styles['Normal'],
            fontSize=9,
            alignment=TA_CENTER,
            spaceAfter=10,
            textColor=colors.HexColor('#666666')
        )
        elements.append(Paragraph(f'Total: {len(auditorias)} evaluaciones', total_style))
        
        # Tabla de datos
        data = [['ID', 'Periodo', 'Evaluado (ID)', 'Evaluador (ID)', 'Puntaje', 'Categoría', 'Fecha']]
        
        for aud in auditorias:
            data.append([
                str(aud.id),
                aud.periodo or '',
                str(aud.evaluado_id),
                str(aud.evaluador_id),
                f"{aud.puntaje}%",
                aud.categoria or '',
                formatear_fecha_corta(aud.fecha)
            ])
        
        table = Table(data, colWidths=[2*cm, 3*cm, 3*cm, 3*cm, 2.5*cm, 3*cm, 3*cm])
        table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a237e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ]))
        elements.append(table)
        
        # Pie de página
        elements.append(Spacer(1, 0.3*cm))
        pie_style = ParagraphStyle('Pie', parent=styles['Normal'], fontSize=7, alignment=TA_CENTER, textColor=colors.grey)
        elements.append(Paragraph(f'Documento generado: {datetime.now().strftime("%d/%m/%Y %H:%M")}', pie_style))
        elements.append(Paragraph('Venezolana del Vidrio, C.A - Sistema de Gestión de Calidad', pie_style))
        
        doc.build(elements)
        buffer.seek(0)
        
        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="Evaluaciones_{datetime.now().strftime("%Y%m%d_%H%M")}.pdf"'
            }
        )
        
    except ImportError as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Librería no instalada: {str(e)}. Ejecuta: pip install reportlab"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {str(e)}")