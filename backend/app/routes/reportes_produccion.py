# app/routes/reportes_produccion.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from datetime import datetime
import io
from pathlib import Path

from app.database.connection import SessionLocal
from app.models.produccion import Produccion
from app.models.defecto import Defecto

router = APIRouter(
    prefix="/reportes/produccion",
    tags=["Reportes Producción"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def formatear_fecha(fecha):
    if fecha:
        return fecha.strftime("%d/%m/%Y")
    return ""

# ==========================================
# RUTA DEL LOGO
# ==========================================
LOGO_PATH = Path(__file__).parent.parent / "static" / "logo.png"


# ==============================================================================
# 1. EXCEL: REPORTE INDIVIDUAL (ESTRUCTURADO Y CENTRADO)
# ==============================================================================
@router.get("/excel/individual/{lote_id}")
@router.get("/excel/{lote_id}")  # Ruta comodín
def descargar_excel_individual(
    lote_id: int,
    db: Session = Depends(get_db)
):
    lote = db.query(Produccion).filter(Produccion.id == lote_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    defectos = db.query(Defecto).filter(Defecto.codigo_lote == lote.codigo_lote).all()
    
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Inspección Individual"
        
        # --- ESTILOS ---
        titulo_font = Font(name='Arial', size=16, bold=True, color='1a237e')
        subtitulo_font = Font(name='Arial', size=10, italic=True, color='666666')
        header_font = Font(name='Arial', size=10, bold=True)
        normal_font = Font(name='Arial', size=10)
        footer_font = Font(name='Arial', size=8, color='888888')
        
        center_align = Alignment(horizontal='center', vertical='center')
        left_align = Alignment(horizontal='left', vertical='center')
        
        thin_border = Border(
            left=Side(style='thin'), right=Side(style='thin'),
            top=Side(style='thin'), bottom=Side(style='thin')
        )
        header_fill = PatternFill(start_color='e3f2fd', end_color='e3f2fd', fill_type='solid')
        
        # --- ANCHOS ---
        col_widths = [18, 18, 18, 18, 18, 25, 18, 18]
        for i, width in enumerate(col_widths, 1):
            ws.column_dimensions[chr(64 + i)].width = width
            
        row = 1
        
        # --- LOGO Y TÍTULO ---
        if LOGO_PATH.exists():
            try:
                from openpyxl.drawing.image import Image
                img = Image(str(LOGO_PATH.absolute()))
                img.width = 120
                img.height = 60
                ws.add_image(img, 'A1')
                row = 5
            except Exception:
                pass
                
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
        ws.cell(row=row, column=1, value="REGISTRO DE INSPECCIÓN DE CALIDAD").font = titulo_font
        ws.cell(row=row, column=1).alignment = center_align
        row += 1
        
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
        ws.cell(row=row, column=1, value="Venvidrio CQ - Sistema de Gestión de Calidad").font = subtitulo_font
        ws.cell(row=row, column=1).alignment = center_align
        row += 2
        
        # --- CABECERA DE DATOS ---
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=3)
        ws.cell(row=row, column=1, value="PROD. TERMINADO").font = header_font
        ws.cell(row=row, column=1).alignment = center_align
        ws.cell(row=row, column=1).fill = header_fill
        ws.cell(row=row, column=1).border = thin_border
        
        ws.merge_cells(start_row=row, start_column=4, end_row=row, end_column=6)
        ws.cell(row=row, column=4, value="RESELECCIÓN").font = header_font
        ws.cell(row=row, column=4).alignment = center_align
        ws.cell(row=row, column=4).fill = header_fill
        ws.cell(row=row, column=4).border = thin_border
        
        ws.merge_cells(start_row=row, start_column=7, end_row=row, end_column=8)
        ws.cell(row=row, column=7, value="EMPAQUE FINAL").font = header_font
        ws.cell(row=row, column=7).alignment = center_align
        ws.cell(row=row, column=7).fill = header_fill
        ws.cell(row=row, column=7).border = thin_border
        row += 1
        
        # Fila de Valores
        ws.cell(row=row, column=1, value=f"FECHA: {formatear_fecha(lote.fecha_registro)}").border = thin_border
        ws.cell(row=row, column=2, value=" ").border = thin_border
        ws.cell(row=row, column=3, value=f"MAQ: {lote.linea_produccion or ''}").border = thin_border
        ws.cell(row=row, column=4, value=f"LÍNEA: {lote.linea_produccion or ''}").border = thin_border
        ws.cell(row=row, column=5, value=" ").border = thin_border
        ws.cell(row=row, column=6, value=f"CLIENTE:").border = thin_border
        ws.cell(row=row, column=7, value=f"MOLDE:").border = thin_border
        ws.cell(row=row, column=8, value=f"ACABADO: {lote.tipo_producto or ''}").border = thin_border
        
        for c in range(1, 9):
            ws.cell(row=row, column=c).alignment = center_align
            ws.cell(row=row, column=c).font = normal_font
        row += 2

        # --- TABLA PRINCIPAL ---
        headers = ['N° Ticket', 'N° Lote', 'Turno/Grupo', 'Ok', 'Ret', 'Defectos Encontrados', 'Cav. N°', 'Cant.']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=row, column=col, value=header)
            cell.font = header_font
            cell.alignment = center_align
            cell.fill = header_fill
            cell.border = thin_border
        row += 1
        
        ws.cell(row=row, column=1, value="").border = thin_border
        ws.cell(row=row, column=2, value=lote.codigo_lote).border = thin_border
        ws.cell(row=row, column=3, value=lote.turno).border = thin_border
        ws.cell(row=row, column=4, value=lote.cantidad).border = thin_border
        ws.cell(row=row, column=5, value=0).border = thin_border
        ws.cell(row=row, column=6, value="").border = thin_border
        ws.cell(row=row, column=7, value="").border = thin_border
        ws.cell(row=row, column=8, value=lote.cantidad).border = thin_border
        
        for _ in range(15):
            row += 1
            for c in range(1, 9):
                ws.cell(row=row, column=c).border = thin_border
        row += 2
        
        # --- ESTADÍSTICAS ---
        criticos = len([d for d in defectos if d.clasificacion == 'Crítico'])
        mayores = len([d for d in defectos if d.clasificacion == 'Mayor'])
        menores = len([d for d in defectos if d.clasificacion == 'Menor'])
        total = len(defectos)
        porcentaje = round((total / (lote.cantidad or 1)) * 100, 2) if lote.cantidad else 0
        
        stats = [
            ["Paletas Inspeccionadas:", "", f"A={criticos} R=0 (Críticos)", "Tamaño de Muestra:", lote.cantidad],
            ["Paletas Buenas:", "", f"A={mayores} R=0 (Mayores)", "Tamaño Población:", lote.cantidad],
            ["Paletas Retenidas:", "", "A=0 R=0 (Mayores B-)","Bot. por Camadas:", ""],
            ["Porcentaje Rechazo:", f"{porcentaje}%", f"A={menores} R=0 (Menores)", "Bot. por Paleta:", ""],
            ["", "", "", "Gruesas por Paleta:", ""]
        ]
        
        for s_row in stats:
            ws.cell(row=row, column=1, value=s_row[0]).border = thin_border
            ws.cell(row=row, column=2, value=s_row[1]).border = thin_border
            ws.merge_cells(start_row=row, start_column=3, end_row=row, end_column=4)
            ws.cell(row=row, column=3, value=s_row[2]).border = thin_border
            ws.cell(row=row, column=5, value=s_row[3]).border = thin_border
            ws.cell(row=row, column=6, value=s_row[4]).border = thin_border
            for c in range(1, 7):
                ws.cell(row=row, column=c).alignment = center_align
                ws.cell(row=row, column=c).font = normal_font
            row += 1
        row += 2
        
        # --- OBSERVACIONES Y FIRMAS ---
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
        ws.cell(row=row, column=1, value="OBSERVACIONES").font = header_font
        ws.cell(row=row, column=1).alignment = center_align
        ws.cell(row=row, column=1).fill = header_fill
        ws.cell(row=row, column=1).border = thin_border
        row += 1
        
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
        ws.cell(row=row, column=1, value=lote.observaciones or "Sin observaciones").font = normal_font
        ws.cell(row=row, column=1).alignment = left_align
        ws.cell(row=row, column=1).border = thin_border
        row += 2
        
        ws.cell(row=row, column=1, value="RESPONSABLE:").font = header_font
        ws.cell(row=row, column=1).alignment = left_align
        ws.cell(row=row, column=1).border = thin_border
        ws.merge_cells(start_row=row, start_column=2, end_row=row, end_column=4)
        ws.cell(row=row, column=2, value=lote.operador or "").font = normal_font
        ws.cell(row=row, column=2).alignment = left_align
        ws.cell(row=row, column=2).border = thin_border
        
        ws.cell(row=row, column=5, value="FIRMA:").font = header_font
        ws.cell(row=row, column=5).alignment = left_align
        ws.cell(row=row, column=5).border = thin_border
        ws.merge_cells(start_row=row, start_column=6, end_row=row, end_column=8)
        ws.cell(row=row, column=6, value="________________________").font = normal_font
        ws.cell(row=row, column=6).alignment = center_align
        ws.cell(row=row, column=6).border = thin_border
        
        row += 2
        
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
        ws.cell(row=row, column=1, value=f"Documento generado: {datetime.now().strftime('%d/%m/%Y %H:%M')} - Venvidrio CQ").font = footer_font
        ws.cell(row=row, column=1).alignment = center_align
        
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="Individual_{lote.codigo_lote}.xlsx"'
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando Excel Individual: {str(e)}")


# ==============================================================================
# 2. EXCEL: REPORTE GENERAL / SÁBANA (Compacto)
# ==============================================================================
@router.get("/excel/general/{lote_id}")
def descargar_excel_general(
    lote_id: int,
    db: Session = Depends(get_db)
):
    lote = db.query(Produccion).filter(Produccion.id == lote_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    defectos = db.query(Defecto).filter(Defecto.codigo_lote == lote.codigo_lote).all()
    
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, Border, Side
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Registro General"
        
        # --- ESTILOS ---
        titulo_font = Font(name='Arial', size=12, bold=True, color='1a237e')
        subtitulo_font = Font(name='Arial', size=8, italic=True, color='666666')
        header_font = Font(name='Arial', size=8, bold=True)
        normal_font = Font(name='Arial', size=8)
        footer_font = Font(name='Arial', size=7, color='888888')
        
        center_align = Alignment(horizontal='center', vertical='center')
        left_align = Alignment(horizontal='left', vertical='center')
        
        thin_border = Border(
            left=Side(style='thin'), right=Side(style='thin'),
            top=Side(style='thin'), bottom=Side(style='thin')
        )
        
        # --- ANCHOS ---
        col_widths = [12, 12, 10, 10, 8, 10, 10, 8, 8, 12, 12, 12]
        for i, width in enumerate(col_widths, 1):
            ws.column_dimensions[chr(64 + i)].width = width
            
        row = 1
        
        # --- LOGO Y TÍTULO ---
        if LOGO_PATH.exists():
            try:
                from openpyxl.drawing.image import Image
                img = Image(str(LOGO_PATH.absolute()))
                img.width = 90
                img.height = 45
                ws.add_image(img, 'A1')
                row = 4
            except Exception:
                pass
                
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=12)
        ws.cell(row=row, column=1, value="REGISTRO DE INSPECCIÓN DE CALIDAD").font = titulo_font
        ws.cell(row=row, column=1).alignment = center_align
        row += 1
        
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=12)
        ws.cell(row=row, column=1, value="Venvidrio CQ - Sistema de Gestión de Calidad").font = subtitulo_font
        ws.cell(row=row, column=1).alignment = center_align
        row += 2
        
        # --- CABECERA ---
        for c in range(1, 13): ws.cell(row=row, column=c).border = thin_border
        ws.cell(row=row, column=1, value="PROD. TERMINADO:").font = header_font
        ws.cell(row=row, column=2, value=" ").border = thin_border
        ws.cell(row=row, column=3, value="RESELECCIÓN:").font = header_font
        ws.cell(row=row, column=4, value=" ").border = thin_border
        ws.cell(row=row, column=5, value="EMPAQUE FINAL:").font = header_font
        for c in range(6, 13): ws.cell(row=row, column=c).border = thin_border
        row += 1
        
        # --- DATOS CABECERA ---
        ws.cell(row=row, column=1, value=f"FECHA:{formatear_fecha(lote.fecha_registro)}").font = normal_font
        ws.cell(row=row, column=2, value=" ").border = thin_border
        ws.cell(row=row, column=3, value=f"MÁQUINA:{lote.linea_produccion or ''}").font = normal_font
        ws.cell(row=row, column=4, value=" ").border = thin_border
        ws.cell(row=row, column=5, value=f"LÍNEA:{lote.linea_produccion or ''}").font = normal_font
        ws.cell(row=row, column=6, value="CLIENTE:").font = normal_font
        ws.cell(row=row, column=7, value="MOLDE:").font = normal_font
        ws.cell(row=row, column=8, value=f"ACABADO:{lote.tipo_producto or ''}").font = normal_font
        ws.cell(row=row, column=9, value="ITEM:").font = normal_font
        ws.cell(row=row, column=10, value="NÚMERO:").font = normal_font
        
        for c in range(1, 13):
            ws.cell(row=row, column=c).border = thin_border
            ws.cell(row=row, column=c).alignment = left_align
        row += 2
        
        # --- TABLA ---
        headers = ['N° Ticket', 'N° Lote', 'Turno/Grupo', 'Ok', 'Ret', 'Defectos Encontrados', 'Cav. N°', 'Cant.']
        for col, h in enumerate(headers, 1):
            cell = ws.cell(row=row, column=col, value=h)
            cell.font = header_font
            cell.alignment = center_align
            cell.border = thin_border
        for col in range(9, 13):
            ws.cell(row=row, column=col).border = thin_border
        row += 1
        
        # Datos
        ws.cell(row=row, column=1, value=lote.codigo_lote).border = thin_border
        ws.cell(row=row, column=2, value=lote.codigo_lote).border = thin_border
        ws.cell(row=row, column=3, value=lote.turno).border = thin_border
        ws.cell(row=row, column=4, value=lote.cantidad).border = thin_border
        ws.cell(row=row, column=5, value=0).border = thin_border
        ws.cell(row=row, column=6, value="").border = thin_border
        ws.cell(row=row, column=7, value="").border = thin_border
        ws.cell(row=row, column=8, value=lote.cantidad).border = thin_border
        for col in range(9, 13): ws.cell(row=row, column=col).border = thin_border
        
        for _ in range(12):
            row += 1
            for c in range(1, 13): ws.cell(row=row, column=c).border = thin_border
        row += 2
        
        # --- ESTADÍSTICAS ---
        criticos = len([d for d in defectos if d.clasificacion == 'Crítico'])
        mayores = len([d for d in defectos if d.clasificacion == 'Mayor'])
        menores = len([d for d in defectos if d.clasificacion == 'Menor'])
        porcentaje = round((len(defectos) / (lote.cantidad or 1)) * 100, 2) if lote.cantidad else 0
        
        # Fila 1
        ws.cell(row=row, column=1, value="Paletas Inspeccionadas:").font = normal_font
        ws.cell(row=row, column=2, value="").border = thin_border
        ws.cell(row=row, column=3, value="Críticos").font = normal_font
        ws.cell(row=row, column=4, value=f"A={criticos} R=0").font = normal_font
        ws.cell(row=row, column=5, value="Tamaño de Muestra:").font = normal_font
        ws.cell(row=row, column=6, value="").font = normal_font
        for c in range(1, 7): ws.cell(row=row, column=c).border = thin_border
        row += 1
        
        # Fila 2
        ws.cell(row=row, column=1, value="Paletas Buenas:").font = normal_font
        ws.cell(row=row, column=2, value="").border = thin_border
        ws.cell(row=row, column=3, value="Mayores B+").font = normal_font
        ws.cell(row=row, column=4, value=f"A={mayores} R=0").font = normal_font
        ws.cell(row=row, column=5, value="Tamaño Población:").font = normal_font
        ws.cell(row=row, column=6, value=lote.cantidad).font = normal_font
        for c in range(1, 7): ws.cell(row=row, column=c).border = thin_border
        row += 1
        
        # Fila 3
        ws.cell(row=row, column=1, value="Paletas Retenidas:").font = normal_font
        ws.cell(row=row, column=2, value="").border = thin_border
        ws.cell(row=row, column=3, value="Mayores B-").font = normal_font
        ws.cell(row=row, column=4, value="A=0 R=0").font = normal_font
        ws.cell(row=row, column=5, value="Bot. por Camadas:").font = normal_font
        ws.cell(row=row, column=6, value="").font = normal_font
        for c in range(1, 7): ws.cell(row=row, column=c).border = thin_border
        row += 1
        
        # Fila 4
        ws.cell(row=row, column=1, value="Porcentaje Rechazo:").font = normal_font
        ws.cell(row=row, column=2, value=f"{porcentaje}%").font = normal_font
        ws.cell(row=row, column=3, value="Menores").font = normal_font
        ws.cell(row=row, column=4, value=f"A={menores} R=0").font = normal_font
        ws.cell(row=row, column=5, value="Bot. por Paleta:").font = normal_font
        ws.cell(row=row, column=6, value="").font = normal_font
        for c in range(1, 7): ws.cell(row=row, column=c).border = thin_border
        row += 1
        
        # Fila 5
        ws.cell(row=row, column=3, value="A=0 R=0").font = normal_font
        ws.cell(row=row, column=5, value="Gruesas por Paleta:").font = normal_font
        ws.cell(row=row, column=6, value="").font = normal_font
        for c in range(1, 7): ws.cell(row=row, column=c).border = thin_border
        row += 2
        
        # --- OBSERVACIONES ---
        ws.cell(row=row, column=1, value="OBSERVACIONES:").font = header_font
        ws.merge_cells(start_row=row, start_column=2, end_row=row, end_column=12)
        ws.cell(row=row, column=2, value=lote.observaciones or "Sin observaciones").font = normal_font
        ws.cell(row=row, column=2).alignment = left_align
        for c in range(1, 13): ws.cell(row=row, column=c).border = thin_border
        row += 2
        
        # --- RESPONSABLE ---
        ws.cell(row=row, column=1, value="RESPONSABLE:").font = header_font
        ws.merge_cells(start_row=row, start_column=2, end_row=row, end_column=4)
        ws.cell(row=row, column=2, value=lote.operador or "").font = normal_font
        ws.cell(row=row, column=2).alignment = left_align
        
        ws.cell(row=row, column=5, value="FIRMA:").font = header_font
        ws.merge_cells(start_row=row, start_column=6, end_row=row, end_column=8)
        ws.cell(row=row, column=6, value="________________________").font = normal_font
        ws.cell(row=row, column=6).alignment = left_align
        
        ws.cell(row=row, column=9, value="GRUPO:").font = header_font
        ws.merge_cells(start_row=row, start_column=10, end_row=row, end_column=12)
        ws.cell(row=row, column=10, value="").font = normal_font
        ws.cell(row=row, column=10).alignment = left_align
        
        for c in range(1, 13): ws.cell(row=row, column=c).border = thin_border
        row += 2
        
        # --- PIE ---
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=12)
        ws.cell(row=row, column=1, value=f"Documento generado: {datetime.now().strftime('%d/%m/%Y %H:%M')} - Venvidrio CQ").font = footer_font
        ws.cell(row=row, column=1).alignment = center_align
        
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="General_{lote.codigo_lote}.xlsx"'
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando Excel General: {str(e)}")


# ==============================================================================
# 3. PDF: REPORTE INDIVIDUAL (ESTRUCTURADO Y CENTRADO)
# ==============================================================================
@router.get("/pdf/individual/{lote_id}")
@router.get("/pdf/{lote_id}")  # Ruta comodín
def descargar_pdf_individual(
    lote_id: int,
    db: Session = Depends(get_db)
):
    lote = db.query(Produccion).filter(Produccion.id == lote_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    defectos = db.query(Defecto).filter(Defecto.codigo_lote == lote.codigo_lote).all()
    
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
        
        # --- LOGO ---
        if LOGO_PATH.exists():
            try:
                logo = Image(str(LOGO_PATH.absolute()), width=2.5*cm, height=1.2*cm)
                logo.hAlign = 'CENTER'
                elements.append(logo)
                elements.append(Spacer(1, 0.2*cm))
            except Exception:
                pass
        
        # --- TÍTULOS ---
        titulo_style = ParagraphStyle(
            'Titulo',
            parent=styles['Heading1'],
            fontSize=16,
            alignment=TA_CENTER,
            spaceAfter=5,
            textColor=colors.HexColor('#1a237e')
        )
        elements.append(Paragraph('REGISTRO DE INSPECCIÓN DE CALIDAD', titulo_style))
        
        subtitulo_style = ParagraphStyle(
            'Subtitulo',
            parent=styles['Normal'],
            fontSize=10,
            alignment=TA_CENTER,
            spaceAfter=10,
            textColor=colors.HexColor('#666666'),
            fontStyle='italic'
        )
        elements.append(Paragraph('Venvidrio CQ - Sistema de Gestión de Calidad (Individual)', subtitulo_style))
        elements.append(Spacer(1, 0.3*cm))
        
        # --- CABECERA ---
        header_data = [
            ['PROD. TERMINADO', 'RESELECCIÓN', 'EMPAQUE FINAL'],
            [
                f'FECHA: {formatear_fecha(lote.fecha_registro)}',
                f'LÍNEA: {lote.linea_produccion or ""}',
                f'ACABADO: {lote.tipo_producto or ""}'
            ]
        ]
        
        header_table = Table(header_data, colWidths=[6*cm, 6*cm, 6*cm])
        header_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, 1), 9),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e3f2fd')),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 0.2*cm))
        
        # --- TABLA ---
        inspeccion_data = [
            ['N° Ticket', 'N° Lote', 'Turno/Grupo', 'Ok', 'Ret', 'Defectos Encontrados', 'Cav. N°', 'Cant.']
        ]
        inspeccion_data.append([
            '',
            lote.codigo_lote or '',
            lote.turno or '',
            str(lote.cantidad or 0),
            '0',
            '',
            '',
            str(lote.cantidad or 0)
        ])
        for _ in range(15):
            inspeccion_data.append(['', '', '', '', '', '', '', ''])
        
        inspeccion_table = Table(inspeccion_data, colWidths=[2*cm, 2*cm, 2.2*cm, 1.2*cm, 1.2*cm, 3*cm, 1.5*cm, 1.5*cm])
        inspeccion_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e3f2fd')),
        ]))
        elements.append(inspeccion_table)
        elements.append(Spacer(1, 0.2*cm))
        
        # --- ESTADÍSTICAS ---
        criticos = len([d for d in defectos if d.clasificacion == 'Crítico'])
        mayores = len([d for d in defectos if d.clasificacion == 'Mayor'])
        menores = len([d for d in defectos if d.clasificacion == 'Menor'])
        porcentaje = round((len(defectos) / (lote.cantidad or 1)) * 100, 2) if lote.cantidad else 0
        
        stats_data = [
            ['Paletas Inspeccionadas:', '', 'Críticos', f'A={criticos} R=0', 'Tamaño de Muestra:', str(lote.cantidad)],
            ['Paletas Buenas:', '', 'Mayores B+', f'A={mayores} R=0', 'Tamaño de la Población:', str(lote.cantidad)],
            ['Paletas Retenidas:', '', 'Mayores B-', 'A=0 R=0', 'Bot. por Camadas/Caja:', ''],
            ['Porcentaje de Rechazo:', f'{porcentaje}%', 'Menores', f'A={menores} R=0', 'Bot. por Paleta:', ''],
            ['', '', '', '', 'Gruesas por Paleta:', '']
        ]
        
        stats_table = Table(stats_data, colWidths=[3*cm, 1.5*cm, 2.5*cm, 3*cm, 3*cm, 1.5*cm])
        stats_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e3f2fd')),
        ]))
        elements.append(stats_table)
        elements.append(Spacer(1, 0.3*cm))
        
        # --- OBSERVACIONES ---
        obs_style = ParagraphStyle('Obs', parent=styles['Normal'], fontSize=9, alignment=TA_LEFT)
        elements.append(Paragraph('<b>OBSERVACIONES:</b>', obs_style))
        elements.append(Paragraph(lote.observaciones or 'Sin observaciones', obs_style))
        elements.append(Spacer(1, 0.4*cm))
        
        # --- FIRMAS ---
        resp_style = ParagraphStyle('Resp', parent=styles['Normal'], fontSize=9, alignment=TA_LEFT)
        elements.append(Paragraph(f'<b>RESPONSABLE:</b> {lote.operador or ""}', resp_style))
        elements.append(Paragraph(f'<b>FIRMA:</b> _____________________________', resp_style))
        elements.append(Spacer(1, 0.3*cm))
        
        # --- PIE ---
        pie_style = ParagraphStyle('Pie', parent=styles['Normal'], fontSize=7, alignment=TA_CENTER, textColor=colors.grey)
        elements.append(Paragraph(f'Documento generado: {datetime.now().strftime("%d/%m/%Y %H:%M")} - Venvidrio CQ', pie_style))
        
        doc.build(elements)
        buffer.seek(0)
        
        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="Individual_{lote.codigo_lote}.pdf"'
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDF Individual: {str(e)}")


# ==============================================================================
# 4. PDF: REPORTE GENERAL / SÁBANA (Compacto)
# ==============================================================================
@router.get("/pdf/general/{lote_id}")
def descargar_pdf_general(
    lote_id: int,
    db: Session = Depends(get_db)
):
    lote = db.query(Produccion).filter(Produccion.id == lote_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    defectos = db.query(Defecto).filter(Defecto.codigo_lote == lote.codigo_lote).all()
    
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
            rightMargin=0.8*cm,
            leftMargin=0.8*cm,
            topMargin=0.8*cm,
            bottomMargin=0.8*cm
        )
        
        elements = []
        styles = getSampleStyleSheet()
        
        if LOGO_PATH.exists():
            try:
                logo = Image(str(LOGO_PATH.absolute()), width=2*cm, height=1*cm)
                logo.hAlign = 'CENTER'
                elements.append(logo)
                elements.append(Spacer(1, 0.2*cm))
            except Exception:
                pass
        
        titulo_style = ParagraphStyle(
            'Titulo',
            parent=styles['Heading1'],
            fontSize=12,
            alignment=TA_CENTER,
            spaceAfter=2,
            textColor=colors.HexColor('#1a237e')
        )
        elements.append(Paragraph('REGISTRO DE INSPECCIÓN DE CALIDAD', titulo_style))
        
        subtitulo_style = ParagraphStyle(
            'Subtitulo',
            parent=styles['Normal'],
            fontSize=8,
            alignment=TA_CENTER,
            spaceAfter=5,
            textColor=colors.HexColor('#666666'),
            fontStyle='italic'
        )
        elements.append(Paragraph('Venvidrio CQ - Sistema de Gestión de Calidad (General)', subtitulo_style))
        elements.append(Spacer(1, 0.2*cm))
        
        # --- CABECERA COMPACTA ---
        header_data = [
            ['PROD. TERMINADO:', 'RESELECCIÓN:', 'EMPAQUE FINAL:'],
            [
                f'FECHA:{formatear_fecha(lote.fecha_registro)}',
                f'MÁQUINA:{lote.linea_produccion or ""}',
                f'LÍNEA:{lote.linea_produccion or ""}'
            ]
        ]
        
        header_table = Table(header_data, colWidths=[5.5*cm, 5.5*cm, 5.5*cm])
        header_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 0.2*cm))
        
        # --- TABLA ---
        inspeccion_data = [
            ['N° Ticket', 'N° Lote', 'Turno/Grupo', 'Ok', 'Ret', 'Defectos Encontrados', 'Cav. N°', 'Cant.']
        ]
        inspeccion_data.append([
            '',
            lote.codigo_lote or '',
            lote.turno or '',
            str(lote.cantidad or 0),
            '0',
            '',
            '',
            str(lote.cantidad or 0)
        ])
        for _ in range(12):
            inspeccion_data.append(['', '', '', '', '', '', '', ''])
        
        inspeccion_table = Table(inspeccion_data, colWidths=[1.8*cm, 2*cm, 2.2*cm, 1.2*cm, 1.2*cm, 3.5*cm, 1.5*cm, 1.5*cm])
        inspeccion_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(inspeccion_table)
        elements.append(Spacer(1, 0.2*cm))
        
        # --- ESTADÍSTICAS COMPACTAS ---
        criticos = len([d for d in defectos if d.clasificacion == 'Crítico'])
        mayores = len([d for d in defectos if d.clasificacion == 'Mayor'])
        menores = len([d for d in defectos if d.clasificacion == 'Menor'])
        porcentaje = round((len(defectos) / (lote.cantidad or 1)) * 100, 2) if lote.cantidad else 0
        
        stats_data = [
            ['Paletas Inspeccionadas:', '', 'Críticos', f'A={criticos} R=0', 'Tamaño de Muestra:', str(lote.cantidad)],
            ['Paletas Buenas:', '', 'Mayores B+', f'A={mayores} R=0', 'Tamaño de la Población:', str(lote.cantidad)],
            ['Paletas Retenidas:', '', 'Mayores B-', 'A=0 R=0', 'Bot. por Camadas/Caja:', ''],
            ['Porcentaje de Rechazo:', f'{porcentaje}%', 'Menores', f'A={menores} R=0', 'Bot. por Paleta:', ''],
            ['', '', '', '', 'Gruesas por Paleta:', '']
        ]
        
        stats_table = Table(stats_data, colWidths=[3.5*cm, 2*cm, 2*cm, 3*cm, 3*cm, 2*cm])
        stats_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(stats_table)
        elements.append(Spacer(1, 0.3*cm))
        
        # --- OBSERVACIONES Y FIRMAS (Compacto) ---
        obs_style = ParagraphStyle('Obs', parent=styles['Normal'], fontSize=7, alignment=TA_LEFT)
        elements.append(Paragraph('<b>OBSERVACIONES:</b>', obs_style))
        elements.append(Paragraph(lote.observaciones or 'Sin observaciones', obs_style))
        elements.append(Spacer(1, 0.2*cm))
        
        resp_style = ParagraphStyle('Resp', parent=styles['Normal'], fontSize=7, alignment=TA_LEFT)
        elements.append(Paragraph(f'<b>RESPONSABLE:</b> {lote.operador or ""} | <b>FIRMA:</b> _____________________________ | <b>GRUPO:</b>', resp_style))
        elements.append(Spacer(1, 0.2*cm))
        
        pie_style = ParagraphStyle('Pie', parent=styles['Normal'], fontSize=6, alignment=TA_CENTER, textColor=colors.grey)
        elements.append(Paragraph(f'Documento generado: {datetime.now().strftime("%d/%m/%Y %H:%M")} - Venvidrio CQ', pie_style))
        
        doc.build(elements)
        buffer.seek(0)
        
        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="General_{lote.codigo_lote}.pdf"'
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDF General: {str(e)}")