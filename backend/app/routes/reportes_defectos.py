from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from datetime import datetime, date
from typing import Optional
import io
from pathlib import Path

from app.database.connection import SessionLocal
from app.models.defecto import Defecto

router = APIRouter(
    prefix="/reportes/defectos",
    tags=["Reportes Defectos"]
)

LOGO_PATH = Path(__file__).parent.parent / "static" / "logo.png"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==========================================================
# FUNCIÓN AUXILIAR: Obtener defectos con filtros
# ==========================================================
def _obtener_defectos_filtrados(db: Session, lote, tipo, clase, inspector, fecha_desde, fecha_hasta):
    query = db.query(Defecto)
    if lote:
        query = query.filter(Defecto.codigo_lote.ilike(f"%{lote}%"))
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
    return query.order_by(Defecto.fecha_registro.desc()).all()


# ==========================================================
# FUNCIÓN AUXILIAR: Obtener lotes agrupados por cliente
# ==========================================================
def _obtener_lotes_agrupados_por_cliente(db: Session, mes: Optional[str] = None, cliente: Optional[str] = None):
    """Retorna un diccionario {cliente: [lotes]} con los lotes evaluados (APTO/RETENIDO)"""
    from app.models.produccion import Produccion

    query = db.query(Produccion).filter(Produccion.estatus.in_(['200', '300']))

    if mes:
        try:
            anio, mes_num = mes.split('-')
            query = query.filter(
                db.extract('year', Produccion.fecha_produccion) == int(anio),
                db.extract('month', Produccion.fecha_produccion) == int(mes_num)
            )
        except (ValueError, AttributeError):
            pass  # Si el formato es inválido, ignorar filtro

    if cliente:
        query = query.filter(Produccion.cliente.ilike(f"%{cliente}%"))

    lotes = query.order_by(Produccion.cliente, Produccion.ticket_carga, Produccion.codigo_lote).all()

    # Agrupar por cliente
    agrupados = {}
    for lote in lotes:
        nombre_cliente = lote.cliente or 'SIN CLIENTE'
        if nombre_cliente not in agrupados:
            agrupados[nombre_cliente] = []
        agrupados[nombre_cliente].append(lote)

    return agrupados


# ==========================================================
# 1. EXCEL GENERAL
# ==========================================================
@router.get("/excel")
def exportar_defectos_excel(
    lote: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    clase: Optional[str] = Query(None),
    inspector: Optional[str] = Query(None),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    """Genera un Excel con el historial de defectos"""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
        from openpyxl.drawing.image import Image as XLImage

        defectos = _obtener_defectos_filtrados(db, lote, tipo, clase, inspector, fecha_desde, fecha_hasta)

        wb = Workbook()
        ws = wb.active
        ws.title = "Historial de Defectos"

        titulo_font = Font(name='Arial', size=16, bold=True, color='1a237e')
        subtitulo_font = Font(name='Arial', size=10, italic=True, color='666666')
        header_font = Font(name='Arial', size=10, bold=True, color='FFFFFF')
        normal_font = Font(name='Arial', size=10)
        center_align = Alignment(horizontal='center', vertical='center')

        thin_border = Border(
            left=Side(style='thin'), right=Side(style='thin'),
            top=Side(style='thin'), bottom=Side(style='thin')
        )

        header_fill = PatternFill(start_color='1a237e', end_color='1a237e', fill_type='solid')
        total_fill = PatternFill(start_color='e3f2fd', end_color='e3f2fd', fill_type='solid')

        col_widths = [18, 30, 18, 12, 20, 20, 18, 12]
        for i, width in enumerate(col_widths, 1):
            ws.column_dimensions[chr(64 + i)].width = width

        row = 1

        if LOGO_PATH.exists():
            try:
                img = XLImage(str(LOGO_PATH.absolute()))
                img.width = 100
                img.height = 50
                ws.add_image(img, 'A1')
                row = 4
            except Exception:
                pass

        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
        ws.cell(row=row, column=1, value="REPORTE DE DEFECTOS").font = titulo_font
        ws.cell(row=row, column=1).alignment = center_align
        row += 1

        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
        ws.cell(row=row, column=1, value=f"Venvidrio CQ - Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}").font = subtitulo_font
        ws.cell(row=row, column=1).alignment = center_align
        row += 2

        headers = ['Lote', 'Tipo de Defecto', 'Clasificación', 'Piezas', 'Zona', 'Inspector', 'Fecha', 'Hora']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=row, column=col, value=header)
            cell.font = header_font
            cell.alignment = center_align
            cell.fill = header_fill
            cell.border = thin_border
        row += 1

        for d in defectos:
            f = d.fecha_registro
            ws.cell(row=row, column=1, value=d.codigo_lote).border = thin_border
            ws.cell(row=row, column=2, value=d.tipo_defecto).border = thin_border
            ws.cell(row=row, column=3, value=d.clasificacion).border = thin_border
            ws.cell(row=row, column=4, value=d.cantidad_piezas).border = thin_border
            ws.cell(row=row, column=5, value=d.zona_deteccion or '—').border = thin_border
            ws.cell(row=row, column=6, value=d.inspector).border = thin_border
            ws.cell(row=row, column=7, value=f.strftime('%d/%m/%Y')).border = thin_border
            ws.cell(row=row, column=8, value=f.strftime('%H:%M')).border = thin_border
            for c in range(1, 9):
                ws.cell(row=row, column=c).font = normal_font
                ws.cell(row=row, column=c).alignment = center_align
            row += 1

        if defectos:
            total_piezas = sum(d.cantidad_piezas for d in defectos)
            ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=3)
            c = ws.cell(row=row, column=1, value=f"TOTAL: {len(defectos)} defectos")
            c.font = Font(name='Arial', size=10, bold=True)
            c.alignment = center_align
            c.fill = total_fill
            c.border = thin_border
            ws.cell(row=row, column=4, value=total_piezas).font = Font(name='Arial', size=10, bold=True)
            ws.cell(row=row, column=4).alignment = center_align
            ws.cell(row=row, column=4).fill = total_fill
            ws.cell(row=row, column=4).border = thin_border
            for c in range(5, 9):
                ws.cell(row=row, column=c).fill = total_fill
                ws.cell(row=row, column=c).border = thin_border

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="Defectos_{datetime.now().strftime("%Y%m%d_%H%M")}.xlsx"'}
        )

    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Librería no instalada: {str(e)}. Ejecuta: pip install openpyxl")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando Excel: {str(e)}")


# ==========================================================
# 2. PDF GENERAL
# ==========================================================
@router.get("/pdf")
def exportar_defectos_pdf(
    lote: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    clase: Optional[str] = Query(None),
    inspector: Optional[str] = Query(None),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    """Genera un PDF con el historial de defectos"""
    try:
        from reportlab.lib.pagesizes import landscape, A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        from reportlab.lib.enums import TA_CENTER

        defectos = _obtener_defectos_filtrados(db, lote, tipo, clase, inspector, fecha_desde, fecha_hasta)

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            rightMargin=1*cm, leftMargin=1*cm,
            topMargin=1*cm, bottomMargin=1*cm
        )

        elements = []
        styles = getSampleStyleSheet()

        if LOGO_PATH.exists():
            try:
                logo = RLImage(str(LOGO_PATH.absolute()), width=2.5*cm, height=1.2*cm)
                logo.hAlign = 'CENTER'
                elements.append(logo)
                elements.append(Spacer(1, 0.2*cm))
            except Exception:
                pass

        titulo_style = ParagraphStyle(
            'Titulo', parent=styles['Heading1'], fontSize=16,
            alignment=TA_CENTER, spaceAfter=5,
            textColor=colors.HexColor('#1a237e')
        )
        elements.append(Paragraph('REPORTE DE DEFECTOS', titulo_style))

        subtitulo_style = ParagraphStyle(
            'Subtitulo', parent=styles['Normal'], fontSize=9,
            alignment=TA_CENTER, spaceAfter=10,
            textColor=colors.HexColor('#666666'), fontStyle='italic'
        )
        elements.append(Paragraph(
            f'Venvidrio CQ - Generado el {datetime.now().strftime("%d/%m/%Y %H:%M")}',
            subtitulo_style
        ))
        elements.append(Spacer(1, 0.3*cm))

        data = [['Lote', 'Tipo', 'Clasificación', 'Piezas', 'Zona', 'Inspector', 'Fecha', 'Hora']]
        for d in defectos:
            f = d.fecha_registro
            data.append([
                d.codigo_lote,
                d.tipo_defecto,
                d.clasificacion,
                str(d.cantidad_piezas),
                d.zona_deteccion or '—',
                d.inspector,
                f.strftime('%d/%m/%Y'),
                f.strftime('%H:%M')
            ])

        tabla = Table(data, colWidths=[2.5*cm, 4*cm, 2.5*cm, 1.5*cm, 2.5*cm, 3*cm, 2*cm, 1.5*cm])
        tabla.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e3f2fd')),
        ]))
        elements.append(tabla)
        elements.append(Spacer(1, 0.3*cm))

        pie_style = ParagraphStyle(
            'Pie', parent=styles['Normal'], fontSize=7,
            alignment=TA_CENTER, textColor=colors.grey
        )
        elements.append(Paragraph(f'Total: {len(defectos)} defectos - Venvidrio CQ', pie_style))

        doc.build(elements)
        buffer.seek(0)

        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="Defectos_{datetime.now().strftime("%Y%m%d_%H%M")}.pdf"'}
        )

    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Librería no instalada: {str(e)}. Ejecuta: pip install reportlab")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {str(e)}")


# ==========================================================
# 3. WORD GENERAL
# ==========================================================
@router.get("/word")
def exportar_defectos_word(
    lote: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    clase: Optional[str] = Query(None),
    inspector: Optional[str] = Query(None),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    """Genera un documento Word con el historial de defectos"""
    try:
        from docx import Document
        from docx.shared import Pt, Cm, RGBColor
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        from docx.enum.table import WD_TABLE_ALIGNMENT

        defectos = _obtener_defectos_filtrados(db, lote, tipo, clase, inspector, fecha_desde, fecha_hasta)

        doc = Document()

        for section in doc.sections:
            section.top_margin = Cm(1)
            section.bottom_margin = Cm(1)
            section.left_margin = Cm(1)
            section.right_margin = Cm(1)

        if LOGO_PATH.exists():
            try:
                p = doc.add_paragraph()
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = p.add_run()
                run.add_picture(str(LOGO_PATH.absolute()), width=Cm(3))
            except Exception:
                pass

        titulo = doc.add_paragraph()
        titulo.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = titulo.add_run("REPORTE DE DEFECTOS")
        run.bold = True
        run.font.size = Pt(16)
        run.font.name = 'Arial'
        run.font.color.rgb = RGBColor(0x1a, 0x23, 0x7e)

        sub = doc.add_paragraph()
        sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run_sub = sub.add_run(f"Venvidrio CQ - Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}")
        run_sub.italic = True
        run_sub.font.size = Pt(9)
        run_sub.font.color.rgb = RGBColor(0x66, 0x66, 0x66)

        headers = ['Lote', 'Tipo', 'Clasificación', 'Piezas', 'Zona', 'Inspector', 'Fecha', 'Hora']
        table = doc.add_table(rows=1, cols=len(headers))
        table.style = 'Light Grid Accent 1'
        table.alignment = WD_TABLE_ALIGNMENT.CENTER

        hdr_cells = table.rows[0].cells
        for i, h in enumerate(headers):
            hdr_cells[i].text = h
            for paragraph in hdr_cells[i].paragraphs:
                for run in paragraph.runs:
                    run.bold = True
                    run.font.size = Pt(9)

        for d in defectos:
            f = d.fecha_registro
            row_cells = table.add_row().cells
            row_cells[0].text = d.codigo_lote
            row_cells[1].text = d.tipo_defecto
            row_cells[2].text = d.clasificacion
            row_cells[3].text = str(d.cantidad_piezas)
            row_cells[4].text = d.zona_deteccion or '—'
            row_cells[5].text = d.inspector
            row_cells[6].text = f.strftime('%d/%m/%Y')
            row_cells[7].text = f.strftime('%H:%M')

        if defectos:
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            run_t = p.add_run(f"TOTAL: {len(defectos)} defectos")
            run_t.bold = True
            run_t.font.size = Pt(10)

        output = io.BytesIO()
        doc.save(output)
        output.seek(0)

        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="Defectos_{datetime.now().strftime("%Y%m%d_%H%M")}.docx"'}
        )

    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Librería no instalada: {str(e)}. Ejecuta: pip install python-docx")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando Word: {str(e)}")


# ==========================================================
# 4. WORD INDIVIDUAL (Formato Sábana - Registro de Inspección)
# ==========================================================
@router.get("/individual/word/{defecto_id}")
def reporte_defecto_individual_word(defecto_id: int, db: Session = Depends(get_db)):
    """Genera un Word individual con el formato exacto del Registro de Inspección"""
    try:
        from docx import Document
        from docx.shared import Pt, Cm, RGBColor
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        from docx.enum.table import WD_TABLE_ALIGNMENT
        from docx.oxml.ns import qn
        from docx.oxml import OxmlElement

        d = db.query(Defecto).filter(Defecto.id == defecto_id).first()
        if not d:
            raise HTTPException(status_code=404, detail="Defecto no encontrado.")

        from app.models.produccion import Produccion
        lote = db.query(Produccion).filter(Produccion.codigo_lote == d.codigo_lote).first()

        doc = Document()
        for section in doc.sections:
            section.top_margin = Cm(0.8)
            section.bottom_margin = Cm(0.8)
            section.left_margin = Cm(1.2)
            section.right_margin = Cm(1.2)

        # --- LOGO Y TÍTULO ---
        header_layout = doc.add_table(rows=1, cols=2)
        header_layout.autofit = False
        header_layout.columns[0].width = Cm(12)
        header_layout.columns[1].width = Cm(5)

        cell_titulo = header_layout.cell(0, 0)
        p_titulo = cell_titulo.paragraphs[0]
        run_titulo = p_titulo.add_run("Registro de Inspección")
        run_titulo.bold = True
        run_titulo.font.size = Pt(16)
        run_titulo.font.name = 'Arial'
        run_titulo.font.color.rgb = RGBColor(0x33, 0x33, 0x33)

        p_sub = cell_titulo.add_paragraph()
        run_sub = p_sub.add_run(f"L-{d.codigo_lote}")
        run_sub.bold = True
        run_sub.font.size = Pt(12)
        run_sub.font.name = 'Arial'

        cell_logo = header_layout.cell(0, 1)
        if LOGO_PATH.exists():
            try:
                p_logo = cell_logo.paragraphs[0]
                p_logo.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                run_logo = p_logo.add_run()
                run_logo.add_picture(str(LOGO_PATH.absolute()), width=Cm(3.5))
            except Exception:
                pass

        doc.add_paragraph()

        tabla = doc.add_table(rows=0, cols=8)
        tabla.style = 'Table Grid'
        tabla.alignment = WD_TABLE_ALIGNMENT.CENTER

        col_widths = [Cm(2.5), Cm(2.5), Cm(3.0), Cm(1.5), Cm(1.5), Cm(6.0), Cm(2.0), Cm(2.0)]
        for i, width in enumerate(col_widths):
            tabla.columns[i].width = width

        def set_cell_bg(cell, color_hex):
            tcPr = cell._tc.get_or_add_tcPr()
            shd = OxmlElement('w:shd')
            shd.set(qn('w:val'), 'clear')
            shd.set(qn('w:color'), 'auto')
            shd.set(qn('w:fill'), color_hex)
            tcPr.append(shd)

        def style_cell(cell, text, bold=False, size=8, align=WD_ALIGN_PARAGRAPH.CENTER, bg=None):
            cell.text = text
            if bg:
                set_cell_bg(cell, bg)
            for p in cell.paragraphs:
                p.alignment = align
                for r in p.runs:
                    r.bold = bold
                    r.font.size = Pt(size)
                    r.font.name = 'Arial'

        row1 = tabla.add_row()
        row1.cells[0].merge(row1.cells[1])
        style_cell(row1.cells[0], "PROD.\nTERMINADO:", bold=True, bg='e3f2fd')
        row1.cells[2].text = ""
        row1.cells[3].merge(row1.cells[4])
        style_cell(row1.cells[3], "RESELECCIÓN:", bold=True, bg='e3f2fd')
        row1.cells[5].text = ""
        row1.cells[6].merge(row1.cells[7])
        style_cell(row1.cells[6], "EMPAQUE\nFINAL:", bold=True, bg='e3f2fd')

        row2 = tabla.add_row()
        style_cell(row2.cells[0], "FECHA:", bold=True, bg='e3f2fd')
        style_cell(row2.cells[1], (lote.fecha_registro.strftime('%d/%m/%Y') if lote and lote.fecha_registro else '—'))
        style_cell(row2.cells[2], "MÁQUINA:", bold=True, bg='e3f2fd')
        style_cell(row2.cells[3], (lote.maquina if lote and hasattr(lote, 'maquina') else (lote.linea_produccion if lote else '—')))
        style_cell(row2.cells[4], "LÍNEA:", bold=True, bg='e3f2fd')
        style_cell(row2.cells[5], (lote.linea_produccion if lote else '—'))
        style_cell(row2.cells[6], "CLIENTE:", bold=True, bg='e3f2fd')
        style_cell(row2.cells[7], (lote.cliente if lote else '—'))

        row3 = tabla.add_row()
        style_cell(row3.cells[0], "MOLDE:", bold=True, bg='e3f2fd')
        style_cell(row3.cells[1], (lote.molde if lote else '—'))
        style_cell(row3.cells[2], "ACABADO:", bold=True, bg='e3f2fd')
        style_cell(row3.cells[3], (lote.tipo_producto if lote else '—'))
        style_cell(row3.cells[4], "ITEM:", bold=True, bg='e3f2fd')
        style_cell(row3.cells[5], (lote.item if lote and hasattr(lote, 'item') else '—'))
        style_cell(row3.cells[6], "NÚMERO:", bold=True, bg='e3f2fd')
        style_cell(row3.cells[7], (d.codigo_lote or '—'))

        row4 = tabla.add_row()
        headers_insp = ['Nº de Ticket', 'Nº Lote', 'Turno/\nGrupo', 'Ok', 'Ret', 'Defectos Encontrados', 'Cav. Nº', 'Cant.']
        for i, h in enumerate(headers_insp):
            style_cell(row4.cells[i], h, bold=True, bg='e3f2fd')

        row5 = tabla.add_row()
        vals_insp = [
            (lote.ticket_carga if lote and hasattr(lote, 'ticket_carga') and lote.ticket_carga else '—'),
            (d.codigo_lote or '—'),
            (lote.turno if lote and hasattr(lote, 'turno') else '—'),
            str(lote.cantidad if lote and hasattr(lote, 'cantidad') else 0),
            '0',
            f"{d.tipo_defecto} ({d.clasificacion})",
            str(lote.juego_envases if lote and hasattr(lote, 'juego_envases') and lote.juego_envases else '—'),
            str(d.cantidad_piezas or 0)
        ]
        for i, val in enumerate(vals_insp):
            style_cell(row5.cells[i], val)

        for _ in range(15):
            row_empty = tabla.add_row()
            for cell in row_empty.cells:
                cell.text = ''

        r_inf1 = tabla.add_row()
        r_inf1.cells[0].merge(r_inf1.cells[3])
        style_cell(r_inf1.cells[0], "Paletas Inspeccionadas:", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)
        style_cell(r_inf1.cells[4], "Críticos", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)
        style_cell(r_inf1.cells[5], "A=", bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT, size=7)
        style_cell(r_inf1.cells[6], "R=", bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT, size=7)
        style_cell(r_inf1.cells[7], "Tamaño de Muestra:", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)

        r_inf2 = tabla.add_row()
        r_inf2.cells[0].merge(r_inf2.cells[3])
        style_cell(r_inf2.cells[0], "Paletas Buenas:", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)
        style_cell(r_inf2.cells[4], "Mayores B+", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)
        style_cell(r_inf2.cells[5], "A=", bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT, size=7)
        style_cell(r_inf2.cells[6], "R=", bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT, size=7)
        style_cell(r_inf2.cells[7], "Tamaño de la Población:", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)

        r_inf3 = tabla.add_row()
        r_inf3.cells[0].merge(r_inf3.cells[3])
        style_cell(r_inf3.cells[0], "Paletas Retenidas:", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)
        style_cell(r_inf3.cells[4], "Mayores B-", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)
        style_cell(r_inf3.cells[5], "A=", bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT, size=7)
        style_cell(r_inf3.cells[6], "R=", bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT, size=7)
        style_cell(r_inf3.cells[7], "Bot. por Canadas/Caja:", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)

        r_inf4 = tabla.add_row()
        r_inf4.cells[0].merge(r_inf4.cells[3])
        style_cell(r_inf4.cells[0], "Porcentaje de Rechazo:", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)
        style_cell(r_inf4.cells[4], "Menores", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)
        style_cell(r_inf4.cells[5], "A=", bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT, size=7)
        style_cell(r_inf4.cells[6], "R=", bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT, size=7)
        style_cell(r_inf4.cells[7], "Bot. por Paleta:", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)

        r_inf5 = tabla.add_row()
        r_inf5.cells[0].merge(r_inf5.cells[6])
        r_inf5.cells[0].text = ""
        style_cell(r_inf5.cells[7], "Gruesas por Paleta", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)

        r_obs_tit = tabla.add_row()
        r_obs_tit.cells[0].merge(r_obs_tit.cells[7])
        style_cell(r_obs_tit.cells[0], "OBSERVACIONES", bold=True, size=9)

        r_obs1 = tabla.add_row()
        r_obs1.cells[0].merge(r_obs1.cells[7])
        # Usar observaciones del lote (que ya contiene las de producción o las de calidad)
        obs_text = lote.observaciones if lote and lote.observaciones else (d.descripcion or '')
        style_cell(r_obs1.cells[0], obs_text, align=WD_ALIGN_PARAGRAPH.LEFT, size=8)

        for _ in range(2):
            r_obs_empty = tabla.add_row()
            r_obs_empty.cells[0].merge(r_obs_empty.cells[7])
            r_obs_empty.cells[0].text = ""

        r_resp = tabla.add_row()
        r_resp.cells[0].merge(r_resp.cells[1])
        style_cell(r_resp.cells[0], "RESPONSABLE", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=8)
        r_resp.cells[2].merge(r_resp.cells[7])
        r_resp.cells[2].text = ""

        r_nombre = tabla.add_row()
        r_nombre.cells[0].merge(r_nombre.cells[1])
        style_cell(r_nombre.cells[0], "Nombre", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=8)
        r_nombre.cells[2].merge(r_nombre.cells[7])
        style_cell(r_nombre.cells[2], d.inspector or '', align=WD_ALIGN_PARAGRAPH.LEFT, size=8)

        r_firma = tabla.add_row()
        r_firma.cells[0].merge(r_firma.cells[1])
        style_cell(r_firma.cells[0], "Firma", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=8)
        r_firma.cells[2].merge(r_firma.cells[7])
        r_firma.cells[2].text = ""

        r_grupo = tabla.add_row()
        r_grupo.cells[0].merge(r_grupo.cells[1])
        style_cell(r_grupo.cells[0], "Grupo", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=8)
        r_grupo.cells[2].merge(r_grupo.cells[7])
        r_grupo.cells[2].text = ""

        doc.add_paragraph()
        pie = doc.add_paragraph()
        pie.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        run_pie = pie.add_run(
            f"Información del Formulario\n"
            f"Fecha de Revisión: {datetime.now().strftime('%d/%m/%Y')}\n"
            f"Número de Revisión: 17"
        )
        run_pie.font.size = Pt(7)
        run_pie.font.color.rgb = RGBColor(0x88, 0x88, 0x88)

        output = io.BytesIO()
        doc.save(output)
        output.seek(0)

        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="Inspeccion_{d.codigo_lote}_{d.id}.docx"'}
        )

    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Librería no instalada: {str(e)}. Ejecuta: pip install python-docx")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando Word: {str(e)}")


# ==========================================================
# 5. PDF INDIVIDUAL (Formato Sábana - Registro de Inspección)
# ==========================================================
@router.get("/individual/pdf/{defecto_id}")
def reporte_defecto_individual_pdf(defecto_id: int, db: Session = Depends(get_db)):
    """Genera un PDF individual con el formato exacto del Registro de Inspección"""
    try:
        from reportlab.lib.pagesizes import landscape, A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

        d = db.query(Defecto).filter(Defecto.id == defecto_id).first()
        if not d:
            raise HTTPException(status_code=404, detail="Defecto no encontrado.")

        from app.models.produccion import Produccion
        lote = db.query(Produccion).filter(Produccion.codigo_lote == d.codigo_lote).first()

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            rightMargin=1*cm, leftMargin=1*cm,
            topMargin=0.8*cm, bottomMargin=0.8*cm
        )

        elements = []
        styles = getSampleStyleSheet()

        titulo_p = Paragraph(
            "<b>Registro de Inspección</b><br/>L-" + (d.codigo_lote or ''),
            ParagraphStyle('Titulo', parent=styles['Normal'], fontSize=16, leading=18,
                           textColor=colors.HexColor('#333333'))
        )

        logo_img = ""
        if LOGO_PATH.exists():
            try:
                logo_img = RLImage(str(LOGO_PATH.absolute()), width=3.5*cm, height=1.5*cm)
            except Exception:
                pass

        header_data = [[titulo_p, logo_img]]
        header_table = Table(header_data, colWidths=[18*cm, 5*cm])
        header_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 0.2*cm))

        col_widths = [2.5*cm, 2.5*cm, 3.0*cm, 1.5*cm, 1.5*cm, 6.0*cm, 2.0*cm, 2.0*cm]

        base_style = [
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 2),
            ('RIGHTPADDING', (0, 0), (-1, -1), 2),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]

        data = []
        data.append(['PROD.\nTERMINADO:', '', '', 'RESELECCIÓN:', '', '', 'EMPAQUE\nFINAL:', ''])
        data.append([
            'FECHA:',
            (lote.fecha_registro.strftime('%d/%m/%Y') if lote and lote.fecha_registro else '—'),
            'MÁQUINA:',
            (getattr(lote, 'maquina', None) or (lote.linea_produccion if lote else '—')) if lote else '—',
            'LÍNEA:',
            (lote.linea_produccion if lote else '—'),
            'CLIENTE:',
            (lote.cliente if lote else '—')
        ])
        data.append([
            'MOLDE:',
            (lote.molde if lote else '—'),
            'ACABADO:',
            (lote.tipo_producto if lote else '—'),
            'ITEM:',
            (getattr(lote, 'item', '—') if lote else '—'),
            'NÚMERO:',
            (d.codigo_lote or '—')
        ])
        data.append(['Nº de Ticket', 'Nº Lote', 'Turno/\nGrupo', 'Ok', 'Ret', 'Defectos Encontrados', 'Cav. Nº', 'Cant.'])
        data.append([
            (getattr(lote, 'ticket_carga', '—') if lote and getattr(lote, 'ticket_carga', None) else '—'),
            (d.codigo_lote or '—'),
            (getattr(lote, 'turno', '—') if lote else '—'),
            str(getattr(lote, 'cantidad', 0) if lote else 0),
            '0',
            f"{d.tipo_defecto} ({d.clasificacion})",
            str(getattr(lote, 'juego_envases', '—') if lote and getattr(lote, 'juego_envases', None) else '—'),
            str(d.cantidad_piezas or 0)
        ])

        for _ in range(15):
            data.append(['', '', '', '', '', '', '', ''])

        base_row = len(data)
        data.append(['Paletas Inspeccionadas:', '', '', '', 'Críticos', 'A=', 'R=', 'Tamaño de Muestra:'])
        data.append(['Paletas Buenas:', '', '', '', 'Mayores B+', 'A=', 'R=', 'Tamaño de la Población:'])
        data.append(['Paletas Retenidas:', '', '', '', 'Mayores B-', 'A=', 'R=', 'Bot. por Canadas/Caja:'])
        data.append(['Porcentaje de Rechazo:', '', '', '', 'Menores', 'A=', 'R=', 'Bot. por Paleta:'])
        data.append(['', '', '', '', '', '', '', 'Gruesas por Paleta'])

        obs_row = len(data)
        data.append(['OBSERVACIONES', '', '', '', '', '', '', ''])
        obs_text = lote.observaciones if lote and lote.observaciones else (d.descripcion or '')
        data.append([obs_text, '', '', '', '', '', '', ''])
        data.append(['', '', '', '', '', '', '', ''])
        data.append(['', '', '', '', '', '', '', ''])

        resp_row = len(data)
        data.append(['RESPONSABLE', '', '', '', '', '', '', ''])
        data.append(['Nombre', '', d.inspector or '', '', '', '', '', ''])
        data.append(['Firma', '', '', '', '', '', '', ''])
        data.append(['Grupo', '', '', '', '', '', '', ''])

        tabla = Table(data, colWidths=col_widths, repeatRows=0)
        style = base_style.copy()

        style.append(('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e3f2fd')))
        style.append(('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'))

        for r in [1, 2]:
            for c in [0, 2, 4, 6]:
                style.append(('BACKGROUND', (c, r), (c, r), colors.HexColor('#e3f2fd')))
                style.append(('FONTNAME', (c, r), (c, r), 'Helvetica-Bold'))

        style.append(('BACKGROUND', (0, 3), (-1, 3), colors.HexColor('#e3f2fd')))
        style.append(('FONTNAME', (0, 3), (-1, 3), 'Helvetica-Bold'))

        for i in range(base_row, base_row + 5):
            style.append(('BACKGROUND', (0, i), (0, i), colors.HexColor('#e3f2fd')))
            style.append(('FONTNAME', (0, i), (0, i), 'Helvetica-Bold'))
            style.append(('ALIGN', (0, i), (0, i), 'LEFT'))
            if i < base_row + 4:
                style.append(('FONTNAME', (4, i), (4, i), 'Helvetica-Bold'))
                style.append(('ALIGN', (4, i), (4, i), 'LEFT'))
                style.append(('ALIGN', (5, i), (5, i), 'RIGHT'))
                style.append(('ALIGN', (6, i), (6, i), 'RIGHT'))
                style.append(('FONTNAME', (7, i), (7, i), 'Helvetica-Bold'))
                style.append(('ALIGN', (7, i), (7, i), 'LEFT'))

        style.append(('BACKGROUND', (0, obs_row), (-1, obs_row), colors.HexColor('#e3f2fd')))
        style.append(('FONTNAME', (0, obs_row), (-1, obs_row), 'Helvetica-Bold'))

        for i in range(resp_row, resp_row + 4):
            style.append(('FONTNAME', (0, i), (0, i), 'Helvetica-Bold'))
            style.append(('ALIGN', (0, i), (0, i), 'LEFT'))

        style.append(('SPAN', (0, 0), (2, 0)))
        style.append(('SPAN', (3, 0), (5, 0)))
        style.append(('SPAN', (6, 0), (7, 0)))

        for i in range(base_row, base_row + 5):
            style.append(('SPAN', (0, i), (3, i)))

        style.append(('SPAN', (0, base_row + 4), (6, base_row + 4)))

        for i in range(obs_row, obs_row + 4):
            style.append(('SPAN', (0, i), (7, i)))

        for i in range(resp_row, resp_row + 4):
            style.append(('SPAN', (0, i), (1, i)))
            style.append(('SPAN', (2, i), (7, i)))

        tabla.setStyle(TableStyle(style))
        elements.append(tabla)

        elements.append(Spacer(1, 0.3*cm))
        pie_style = ParagraphStyle('Pie', parent=styles['Normal'], fontSize=7,
                                   alignment=TA_RIGHT, textColor=colors.grey)
        elements.append(Paragraph(
            f"Información del Formulario<br/>"
            f"Fecha de Revisión: {datetime.now().strftime('%d/%m/%Y')}<br/>"
            f"Número de Revisión: 17",
            pie_style
        ))

        doc.build(elements)
        buffer.seek(0)

        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="Inspeccion_{d.codigo_lote}_{d.id}.pdf"'}
        )

    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Librería no instalada: {str(e)}. Ejecuta: pip install reportlab")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {str(e)}")


# ==========================================================
# 6. SÁBANA EXCEL (Formato Registro de Inspección - Agrupado por Cliente)
# ==========================================================
@router.get("/sabana/excel")
def exportar_sabana_excel(
    mes: Optional[str] = Query(None, description="Mes en formato YYYY-MM"),
    cliente: Optional[str] = Query(None, description="Nombre del cliente"),
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Genera un Excel con la sábana de lotes evaluados, agrupados por cliente"""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, Border, Side, PatternFill

        agrupados = _obtener_lotes_agrupados_por_cliente(db, mes, cliente)

        if not agrupados:
            raise HTTPException(status_code=404, detail="No hay lotes evaluados con los filtros seleccionados.")

        wb = Workbook()
        ws = wb.active
        ws.title = "Sábana de Inspección"

        titulo_font = Font(name='Arial', size=14, bold=True, color='1a237e')
        header_font = Font(name='Arial', size=9, bold=True, color='FFFFFF')
        label_font = Font(name='Arial', size=8, bold=True)
        normal_font = Font(name='Arial', size=8)
        center_align = Alignment(horizontal='center', vertical='center', wrap_text=True)
        left_align = Alignment(horizontal='left', vertical='center', wrap_text=True)

        thin_border = Border(
            left=Side(style='thin'), right=Side(style='thin'),
            top=Side(style='thin'), bottom=Side(style='thin')
        )

        header_fill = PatternFill(start_color='1a237e', end_color='1a237e', fill_type='solid')
        label_fill = PatternFill(start_color='e3f2fd', end_color='e3f2fd', fill_type='solid')
        cliente_fill = PatternFill(start_color='0d47a1', end_color='0d47a1', fill_type='solid')

        col_widths = [15, 15, 18, 15, 12, 25, 12, 10]
        for i, width in enumerate(col_widths, 1):
            ws.column_dimensions[chr(64 + i)].width = width

        row = 1

        # Título general
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
        ws.cell(row=row, column=1, value="SÁBANA DE INSPECCIÓN - LOTES EVALUADOS POR CLIENTE").font = titulo_font
        ws.cell(row=row, column=1).alignment = center_align
        row += 1

        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
        filtro_text = f"Período: {mes or 'Todos'} | Cliente: {cliente or 'Todos'}"
        ws.cell(row=row, column=1, value=f"Venvidrio CQ - {filtro_text} - Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}").font = Font(name='Arial', size=9, italic=True, color='666666')
        ws.cell(row=row, column=1).alignment = center_align
        row += 2

        # Iterar por cada cliente
        for nombre_cliente, lotes in agrupados.items():
            # Encabezado del cliente
            ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
            c = ws.cell(row=row, column=1, value=f"CLIENTE: {nombre_cliente} ({len(lotes)} lote(s))")
            c.font = Font(name='Arial', size=11, bold=True, color='FFFFFF')
            c.fill = cliente_fill
            c.alignment = left_align
            c.border = thin_border
            row += 1

            # Procesar cada lote del cliente
            for lote in lotes:
                defectos_lote = db.query(Defecto).filter(Defecto.codigo_lote == lote.codigo_lote).all()

                # Encabezado del lote
                ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
                c = ws.cell(row=row, column=1, value=f"LOTE: {lote.codigo_lote} | TICKET: {lote.ticket_carga or '—'} | ESTATUS: {'APTO' if lote.estatus == '200' else 'RETENIDO'}")
                c.font = Font(name='Arial', size=10, bold=True, color='FFFFFF')
                c.fill = header_fill
                c.alignment = left_align
                c.border = thin_border
                row += 1

                # Información del lote (2 filas)
                ws.cell(row=row, column=1, value="FECHA:").font = label_font
                ws.cell(row=row, column=1).fill = label_fill
                ws.cell(row=row, column=1).border = thin_border
                ws.cell(row=row, column=2, value=lote.fecha_produccion.strftime('%d/%m/%Y') if lote.fecha_produccion else '—').font = normal_font
                ws.cell(row=row, column=2).border = thin_border

                ws.cell(row=row, column=3, value="PRODUCTO:").font = label_font
                ws.cell(row=row, column=3).fill = label_fill
                ws.cell(row=row, column=3).border = thin_border
                ws.cell(row=row, column=4, value=lote.tipo_producto or '—').font = normal_font
                ws.cell(row=row, column=4).border = thin_border

                ws.cell(row=row, column=5, value="TURNO:").font = label_font
                ws.cell(row=row, column=5).fill = label_fill
                ws.cell(row=row, column=5).border = thin_border
                ws.cell(row=row, column=6, value=lote.turno or '—').font = normal_font
                ws.cell(row=row, column=6).border = thin_border

                ws.cell(row=row, column=7, value="CANT:").font = label_font
                ws.cell(row=row, column=7).fill = label_fill
                ws.cell(row=row, column=7).border = thin_border
                ws.cell(row=row, column=8, value=lote.cantidad or 0).font = normal_font
                ws.cell(row=row, column=8).border = thin_border
                row += 1

                ws.cell(row=row, column=1, value="MOLDE:").font = label_font
                ws.cell(row=row, column=1).fill = label_fill
                ws.cell(row=row, column=1).border = thin_border
                ws.cell(row=row, column=2, value=lote.molde or '—').font = normal_font
                ws.cell(row=row, column=2).border = thin_border

                ws.cell(row=row, column=3, value="LÍNEA:").font = label_font
                ws.cell(row=row, column=3).fill = label_fill
                ws.cell(row=row, column=3).border = thin_border
                ws.cell(row=row, column=4, value=lote.linea_produccion or '—').font = normal_font
                ws.cell(row=row, column=4).border = thin_border

                ws.cell(row=row, column=5, value="OBSERVACIONES:").font = label_font
                ws.cell(row=row, column=5).fill = label_fill
                ws.cell(row=row, column=5).border = thin_border
                obs_text = lote.observaciones or '—'
                ws.merge_cells(start_row=row, start_column=6, end_row=row, end_column=8)
                ws.cell(row=row, column=6, value=obs_text).font = normal_font
                ws.cell(row=row, column=6).border = thin_border
                row += 1

                # Si hay defectos, mostrarlos
                if defectos_lote:
                    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
                    ws.cell(row=row, column=1, value="DEFECTOS ENCONTRADOS:").font = Font(name='Arial', size=8, bold=True, color='DC3545')
                    ws.cell(row=row, column=1).fill = PatternFill(start_color='FFF5F5', end_color='FFF5F5', fill_type='solid')
                    ws.cell(row=row, column=1).border = thin_border
                    row += 1

                    # Cabecera de defectos
                    headers_def = ['Clasificación', 'Tipo', 'Piezas', 'Zona', 'Inspector', 'Descripción', '', '']
                    for col, h in enumerate(headers_def[:6], 1):
                        c = ws.cell(row=row, column=col, value=h)
                        c.font = Font(name='Arial', size=8, bold=True)
                        c.fill = PatternFill(start_color='FFEBEE', end_color='FFEBEE', fill_type='solid')
                        c.border = thin_border
                        c.alignment = center_align
                    row += 1

                    # Defectos
                    for d in defectos_lote:
                        ws.cell(row=row, column=1, value=d.clasificacion).font = normal_font
                        ws.cell(row=row, column=1).border = thin_border
                        ws.cell(row=row, column=2, value=d.tipo_defecto).font = normal_font
                        ws.cell(row=row, column=2).border = thin_border
                        ws.cell(row=row, column=3, value=d.cantidad_piezas or 0).font = normal_font
                        ws.cell(row=row, column=3).border = thin_border
                        ws.cell(row=row, column=4, value=d.zona_deteccion or '—').font = normal_font
                        ws.cell(row=row, column=4).border = thin_border
                        ws.cell(row=row, column=5, value=d.inspector or '—').font = normal_font
                        ws.cell(row=row, column=5).border = thin_border
                        ws.cell(row=row, column=6, value=d.descripcion or '').font = normal_font
                        ws.cell(row=row, column=6).border = thin_border
                        row += 1

                # Espacio entre lotes
                row += 1

            # Espacio entre clientes
            row += 2

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="Sabana_PorCliente_{datetime.now().strftime("%Y%m%d_%H%M")}.xlsx"'}
        )

    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Librería no instalada: {str(e)}. Ejecuta: pip install openpyxl")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando Excel: {str(e)}")


# ==========================================================
# 7. SÁBANA WORD (Formato Registro de Inspección - Agrupado por Cliente)
# ==========================================================
@router.get("/sabana/word")
def exportar_sabana_word(
    mes: Optional[str] = Query(None, description="Mes en formato YYYY-MM"),
    cliente: Optional[str] = Query(None, description="Nombre del cliente"),
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Genera un Word con la sábana de lotes evaluados, agrupados por cliente (un formulario por cliente)"""
    try:
        from docx import Document
        from docx.shared import Pt, Cm, RGBColor
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        from docx.enum.table import WD_TABLE_ALIGNMENT
        from docx.oxml.ns import qn
        from docx.oxml import OxmlElement
        from docx.enum.section import WD_ORIENT

        agrupados = _obtener_lotes_agrupados_por_cliente(db, mes, cliente)

        if not agrupados:
            raise HTTPException(status_code=404, detail="No hay lotes evaluados con los filtros seleccionados.")

        doc = Document()

        # Orientación horizontal
        for section in doc.sections:
            section.orientation = WD_ORIENT.LANDSCAPE
            section.page_width = Cm(29.7)
            section.page_height = Cm(21.0)
            section.top_margin = Cm(0.8)
            section.bottom_margin = Cm(0.8)
            section.left_margin = Cm(1.2)
            section.right_margin = Cm(1.2)

        def set_cell_bg(cell, color_hex):
            tcPr = cell._tc.get_or_add_tcPr()
            shd = OxmlElement('w:shd')
            shd.set(qn('w:val'), 'clear')
            shd.set(qn('w:color'), 'auto')
            shd.set(qn('w:fill'), color_hex)
            tcPr.append(shd)

        def style_cell(cell, text, bold=False, size=8, align=WD_ALIGN_PARAGRAPH.CENTER, bg=None):
            cell.text = text
            if bg:
                set_cell_bg(cell, bg)
            for p in cell.paragraphs:
                p.alignment = align
                for r in p.runs:
                    r.bold = bold
                    r.font.size = Pt(size)
                    r.font.name = 'Arial'

        # Generar un formulario por cada cliente
        for idx_cliente, (nombre_cliente, lotes) in enumerate(agrupados.items()):
            if idx_cliente > 0:
                doc.add_page_break()

            # Título del cliente
            p_cliente = doc.add_paragraph()
            p_cliente.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run_cliente = p_cliente.add_run(f"CLIENTE: {nombre_cliente}")
            run_cliente.bold = True
            run_cliente.font.size = Pt(14)
            run_cliente.font.name = 'Arial'
            run_cliente.font.color.rgb = RGBColor(0x0d, 0x47, 0xa1)

            p_sub = doc.add_paragraph()
            p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run_sub = p_sub.add_run(f"Lotes evaluados: {len(lotes)} | Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
            run_sub.italic = True
            run_sub.font.size = Pt(9)
            run_sub.font.color.rgb = RGBColor(0x66, 0x66, 0x66)

            doc.add_paragraph()

            # Generar un formulario por cada lote del cliente
            for idx_lote, lote in enumerate(lotes):
                if idx_lote > 0:
                    doc.add_page_break()

                defectos_lote = db.query(Defecto).filter(Defecto.codigo_lote == lote.codigo_lote).all()

                # Título del lote
                header_layout = doc.add_table(rows=1, cols=2)
                header_layout.autofit = False
                header_layout.columns[0].width = Cm(12)
                header_layout.columns[1].width = Cm(5)

                cell_titulo = header_layout.cell(0, 0)
                p_titulo = cell_titulo.paragraphs[0]
                run_titulo = p_titulo.add_run("Registro de Inspección")
                run_titulo.bold = True
                run_titulo.font.size = Pt(14)
                run_titulo.font.name = 'Arial'
                run_titulo.font.color.rgb = RGBColor(0x33, 0x33, 0x33)

                p_sub2 = cell_titulo.add_paragraph()
                run_sub2 = p_sub2.add_run(f"L-{lote.codigo_lote}")
                run_sub2.bold = True
                run_sub2.font.size = Pt(11)
                run_sub2.font.name = 'Arial'

                cell_logo = header_layout.cell(0, 1)
                if LOGO_PATH.exists():
                    try:
                        p_logo = cell_logo.paragraphs[0]
                        p_logo.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                        run_logo = p_logo.add_run()
                        run_logo.add_picture(str(LOGO_PATH.absolute()), width=Cm(3.5))
                    except Exception:
                        pass

                doc.add_paragraph()

                # Tabla principal
                tabla = doc.add_table(rows=0, cols=8)
                tabla.style = 'Table Grid'
                tabla.alignment = WD_TABLE_ALIGNMENT.CENTER

                col_widths = [Cm(2.5), Cm(2.5), Cm(3.0), Cm(1.5), Cm(1.5), Cm(6.0), Cm(2.0), Cm(2.0)]
                for i, width in enumerate(col_widths):
                    tabla.columns[i].width = width

                # Fila 1: PROD. TERMINADO / RESELECCIÓN / EMPAQUE FINAL
                row1 = tabla.add_row()
                row1.cells[0].merge(row1.cells[1])
                style_cell(row1.cells[0], "PROD.\nTERMINADO:", bold=True, bg='e3f2fd')
                row1.cells[2].text = ""
                row1.cells[3].merge(row1.cells[4])
                style_cell(row1.cells[3], "RESELECCIÓN:", bold=True, bg='e3f2fd')
                row1.cells[5].text = ""
                row1.cells[6].merge(row1.cells[7])
                style_cell(row1.cells[6], "EMPAQUE\nFINAL:", bold=True, bg='e3f2fd')

                # Fila 2: FECHA / MÁQUINA / LÍNEA / CLIENTE
                row2 = tabla.add_row()
                style_cell(row2.cells[0], "FECHA:", bold=True, bg='e3f2fd')
                style_cell(row2.cells[1], lote.fecha_produccion.strftime('%d/%m/%Y') if lote.fecha_produccion else '—')
                style_cell(row2.cells[2], "MÁQUINA:", bold=True, bg='e3f2fd')
                style_cell(row2.cells[3], getattr(lote, 'maquina', None) or (lote.linea_produccion or '—'))
                style_cell(row2.cells[4], "LÍNEA:", bold=True, bg='e3f2fd')
                style_cell(row2.cells[5], lote.linea_produccion or '—')
                style_cell(row2.cells[6], "CLIENTE:", bold=True, bg='e3f2fd')
                style_cell(row2.cells[7], lote.cliente or '—')

                # Fila 3: MOLDE / ACABADO / ITEM / NÚMERO
                row3 = tabla.add_row()
                style_cell(row3.cells[0], "MOLDE:", bold=True, bg='e3f2fd')
                style_cell(row3.cells[1], lote.molde or '—')
                style_cell(row3.cells[2], "ACABADO:", bold=True, bg='e3f2fd')
                style_cell(row3.cells[3], lote.tipo_producto or '—')
                style_cell(row3.cells[4], "ITEM:", bold=True, bg='e3f2fd')
                style_cell(row3.cells[5], getattr(lote, 'item', '—') or '—')
                style_cell(row3.cells[6], "NÚMERO:", bold=True, bg='e3f2fd')
                style_cell(row3.cells[7], lote.codigo_lote or '—')

                # Fila 4: CABECERA DE INSPECCIÓN
                row4 = tabla.add_row()
                headers_insp = ['Nº de Ticket', 'Nº Lote', 'Turno/\nGrupo', 'Ok', 'Ret', 'Defectos Encontrados', 'Cav. Nº', 'Cant.']
                for i, h in enumerate(headers_insp):
                    style_cell(row4.cells[i], h, bold=True, bg='e3f2fd')

                # Fila 5: DATOS DE INSPECCIÓN
                row5 = tabla.add_row()
                ok_qty = lote.cantidad if lote.estatus == '200' else 0
                ret_qty = sum(d.cantidad_piezas or 0 for d in defectos_lote) if defectos_lote else 0
                defectos_text = ", ".join([f"{d.tipo_defecto} ({d.clasificacion})" for d in defectos_lote]) if defectos_lote else "Sin defectos"

                vals_insp = [
                    lote.ticket_carga or '—',
                    lote.codigo_lote or '—',
                    lote.turno or '—',
                    str(ok_qty),
                    str(ret_qty),
                    defectos_text,
                    str(getattr(lote, 'juego_envases', '—') or '—'),
                    str(lote.cantidad or 0)
                ]
                for i, val in enumerate(vals_insp):
                    style_cell(row5.cells[i], val)

                # Filas vacías (10 filas para completar el formulario)
                for _ in range(10):
                    row_empty = tabla.add_row()
                    for cell in row_empty.cells:
                        cell.text = ''

                # Sección inferior
                r_inf1 = tabla.add_row()
                r_inf1.cells[0].merge(r_inf1.cells[3])
                style_cell(r_inf1.cells[0], "Paletas Inspeccionadas:", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)
                style_cell(r_inf1.cells[4], "Críticos", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)
                style_cell(r_inf1.cells[5], "A=", bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT, size=7)
                style_cell(r_inf1.cells[6], "R=", bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT, size=7)
                style_cell(r_inf1.cells[7], "Tamaño de Muestra:", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)

                r_inf2 = tabla.add_row()
                r_inf2.cells[0].merge(r_inf2.cells[3])
                style_cell(r_inf2.cells[0], "Paletas Buenas:", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)
                style_cell(r_inf2.cells[4], "Mayores B+", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)
                style_cell(r_inf2.cells[5], "A=", bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT, size=7)
                style_cell(r_inf2.cells[6], "R=", bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT, size=7)
                style_cell(r_inf2.cells[7], "Tamaño de la Población:", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)

                r_inf3 = tabla.add_row()
                r_inf3.cells[0].merge(r_inf3.cells[3])
                style_cell(r_inf3.cells[0], "Paletas Retenidas:", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)
                style_cell(r_inf3.cells[4], "Mayores B-", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)
                style_cell(r_inf3.cells[5], "A=", bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT, size=7)
                style_cell(r_inf3.cells[6], "R=", bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT, size=7)
                style_cell(r_inf3.cells[7], "Bot. por Canadas/Caja:", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)

                r_inf4 = tabla.add_row()
                r_inf4.cells[0].merge(r_inf4.cells[3])
                style_cell(r_inf4.cells[0], "Porcentaje de Rechazo:", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)
                style_cell(r_inf4.cells[4], "Menores", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)
                style_cell(r_inf4.cells[5], "A=", bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT, size=7)
                style_cell(r_inf4.cells[6], "R=", bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT, size=7)
                style_cell(r_inf4.cells[7], "Bot. por Paleta:", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)

                r_inf5 = tabla.add_row()
                r_inf5.cells[0].merge(r_inf5.cells[6])
                r_inf5.cells[0].text = ""
                style_cell(r_inf5.cells[7], "Gruesas por Paleta", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=7)

                # Observaciones (usar lote.observaciones)
                r_obs_tit = tabla.add_row()
                r_obs_tit.cells[0].merge(r_obs_tit.cells[7])
                style_cell(r_obs_tit.cells[0], "OBSERVACIONES", bold=True, size=9)

                r_obs1 = tabla.add_row()
                r_obs1.cells[0].merge(r_obs1.cells[7])
                obs_text = lote.observaciones if lote.observaciones else (defectos_text if defectos_lote else "Lote APTO - Sin observaciones")
                style_cell(r_obs1.cells[0], obs_text, align=WD_ALIGN_PARAGRAPH.LEFT, size=8)

                for _ in range(2):
                    r_obs_empty = tabla.add_row()
                    r_obs_empty.cells[0].merge(r_obs_empty.cells[7])
                    r_obs_empty.cells[0].text = ""

                # Responsable
                r_resp = tabla.add_row()
                r_resp.cells[0].merge(r_resp.cells[1])
                style_cell(r_resp.cells[0], "RESPONSABLE", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=8)
                r_resp.cells[2].merge(r_resp.cells[7])
                r_resp.cells[2].text = ""

                r_nombre = tabla.add_row()
                r_nombre.cells[0].merge(r_nombre.cells[1])
                style_cell(r_nombre.cells[0], "Nombre", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=8)
                inspector_name = defectos_lote[0].inspector if defectos_lote else (lote.operador or '—')
                style_cell(r_nombre.cells[2], inspector_name, align=WD_ALIGN_PARAGRAPH.LEFT, size=8)

                r_firma = tabla.add_row()
                r_firma.cells[0].merge(r_firma.cells[1])
                style_cell(r_firma.cells[0], "Firma", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=8)
                r_firma.cells[2].merge(r_firma.cells[7])
                r_firma.cells[2].text = ""

                r_grupo = tabla.add_row()
                r_grupo.cells[0].merge(r_grupo.cells[1])
                style_cell(r_grupo.cells[0], "Grupo", bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, size=8)
                r_grupo.cells[2].merge(r_grupo.cells[7])
                r_grupo.cells[2].text = ""

        output = io.BytesIO()
        doc.save(output)
        output.seek(0)

        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="Sabana_PorCliente_{datetime.now().strftime("%Y%m%d_%H%M")}.docx"'}
        )

    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Librería no instalada: {str(e)}. Ejecuta: pip install python-docx")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando Word: {str(e)}")


# ==========================================================
# 8. SÁBANA PDF (Formato Registro de Inspección - Agrupado por Cliente)
# ==========================================================
@router.get("/sabana/pdf")
def exportar_sabana_pdf(
    mes: Optional[str] = Query(None, description="Mes en formato YYYY-MM"),
    cliente: Optional[str] = Query(None, description="Nombre del cliente"),
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Genera un PDF con la sábana de lotes evaluados, agrupados por cliente (un formulario por cliente)"""
    try:
        from reportlab.lib.pagesizes import landscape, A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, PageBreak
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

        agrupados = _obtener_lotes_agrupados_por_cliente(db, mes, cliente)

        if not agrupados:
            raise HTTPException(status_code=404, detail="No hay lotes evaluados con los filtros seleccionados.")

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            rightMargin=1*cm, leftMargin=1*cm,
            topMargin=0.8*cm, bottomMargin=0.8*cm
        )

        elements = []
        styles = getSampleStyleSheet()
        col_widths = [2.5*cm, 2.5*cm, 3.0*cm, 1.5*cm, 1.5*cm, 6.0*cm, 2.0*cm, 2.0*cm]

        for idx_cliente, (nombre_cliente, lotes) in enumerate(agrupados.items()):
            if idx_cliente > 0:
                elements.append(PageBreak())

            # Título del cliente
            cliente_style = ParagraphStyle(
                'Cliente', parent=styles['Normal'], fontSize=14, leading=16,
                alignment=TA_CENTER, textColor=colors.HexColor('#0d47a1')
            )
            elements.append(Paragraph(f"<b>CLIENTE: {nombre_cliente}</b>", cliente_style))

            sub_style = ParagraphStyle(
                'SubCliente', parent=styles['Normal'], fontSize=9, leading=11,
                alignment=TA_CENTER, textColor=colors.HexColor('#666666'), fontStyle='italic'
            )
            elements.append(Paragraph(
                f"Lotes evaluados: {len(lotes)} | Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}",
                sub_style
            ))
            elements.append(Spacer(1, 0.3*cm))

            # Generar un formulario por cada lote del cliente
            for idx_lote, lote in enumerate(lotes):
                if idx_lote > 0:
                    elements.append(PageBreak())

                defectos_lote = db.query(Defecto).filter(Defecto.codigo_lote == lote.codigo_lote).all()

                # Título del lote
                titulo_p = Paragraph(
                    f"<b>Registro de Inspección</b><br/>L-{lote.codigo_lote}",
                    ParagraphStyle('Titulo', parent=styles['Normal'], fontSize=14, leading=16,
                                   textColor=colors.HexColor('#333333'))
                )

                logo_img = ""
                if LOGO_PATH.exists():
                    try:
                        logo_img = RLImage(str(LOGO_PATH.absolute()), width=3.5*cm, height=1.5*cm)
                    except Exception:
                        pass

                header_data = [[titulo_p, logo_img]]
                header_table = Table(header_data, colWidths=[18*cm, 5*cm])
                header_table.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (0, 0), 'LEFT'),
                    ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ]))
                elements.append(header_table)
                elements.append(Spacer(1, 0.2*cm))

                # Datos
                base_style = [
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
                    ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 0), (-1, -1), 7),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 2),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 2),
                    ('TOPPADDING', (0, 0), (-1, -1), 2),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
                ]

                data = []
                data.append(['PROD.\nTERMINADO:', '', '', 'RESELECCIÓN:', '', '', 'EMPAQUE\nFINAL:', ''])
                data.append([
                    'FECHA:',
                    lote.fecha_produccion.strftime('%d/%m/%Y') if lote.fecha_produccion else '—',
                    'MÁQUINA:',
                    getattr(lote, 'maquina', None) or (lote.linea_produccion or '—'),
                    'LÍNEA:',
                    lote.linea_produccion or '—',
                    'CLIENTE:',
                    lote.cliente or '—'
                ])
                data.append([
                    'MOLDE:',
                    lote.molde or '—',
                    'ACABADO:',
                    lote.tipo_producto or '—',
                    'ITEM:',
                    getattr(lote, 'item', '—') or '—',
                    'NÚMERO:',
                    lote.codigo_lote or '—'
                ])

                data.append(['Nº de Ticket', 'Nº Lote', 'Turno/\nGrupo', 'Ok', 'Ret', 'Defectos Encontrados', 'Cav. Nº', 'Cant.'])

                ok_qty = lote.cantidad if lote.estatus == '200' else 0
                ret_qty = sum(d.cantidad_piezas or 0 for d in defectos_lote) if defectos_lote else 0
                defectos_text = ", ".join([f"{d.tipo_defecto} ({d.clasificacion})" for d in defectos_lote]) if defectos_lote else "Sin defectos"

                data.append([
                    lote.ticket_carga or '—',
                    lote.codigo_lote or '—',
                    lote.turno or '—',
                    str(ok_qty),
                    str(ret_qty),
                    defectos_text,
                    str(getattr(lote, 'juego_envases', '—') or '—'),
                    str(lote.cantidad or 0)
                ])

                for _ in range(10):
                    data.append(['', '', '', '', '', '', '', ''])

                base_row = len(data)
                data.append(['Paletas Inspeccionadas:', '', '', '', 'Críticos', 'A=', 'R=', 'Tamaño de Muestra:'])
                data.append(['Paletas Buenas:', '', '', '', 'Mayores B+', 'A=', 'R=', 'Tamaño de la Población:'])
                data.append(['Paletas Retenidas:', '', '', '', 'Mayores B-', 'A=', 'R=', 'Bot. por Canadas/Caja:'])
                data.append(['Porcentaje de Rechazo:', '', '', '', 'Menores', 'A=', 'R=', 'Bot. por Paleta:'])
                data.append(['', '', '', '', '', '', '', 'Gruesas por Paleta'])

                obs_row = len(data)
                data.append(['OBSERVACIONES', '', '', '', '', '', '', ''])
                obs_text = lote.observaciones if lote.observaciones else (defectos_text if defectos_lote else "Lote APTO - Sin observaciones")
                data.append([obs_text, '', '', '', '', '', '', ''])
                data.append(['', '', '', '', '', '', '', ''])
                data.append(['', '', '', '', '', '', '', ''])

                resp_row = len(data)
                data.append(['RESPONSABLE', '', '', '', '', '', '', ''])
                inspector_name = defectos_lote[0].inspector if defectos_lote else (lote.operador or '—')
                data.append(['Nombre', '', inspector_name, '', '', '', '', ''])
                data.append(['Firma', '', '', '', '', '', '', ''])
                data.append(['Grupo', '', '', '', '', '', '', ''])

                tabla = Table(data, colWidths=col_widths, repeatRows=0)
                style = base_style.copy()

                style.append(('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e3f2fd')))
                style.append(('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'))

                for r in [1, 2]:
                    for c in [0, 2, 4, 6]:
                        style.append(('BACKGROUND', (c, r), (c, r), colors.HexColor('#e3f2fd')))
                        style.append(('FONTNAME', (c, r), (c, r), 'Helvetica-Bold'))

                style.append(('BACKGROUND', (0, 3), (-1, 3), colors.HexColor('#e3f2fd')))
                style.append(('FONTNAME', (0, 3), (-1, 3), 'Helvetica-Bold'))

                for i in range(base_row, base_row + 5):
                    style.append(('BACKGROUND', (0, i), (0, i), colors.HexColor('#e3f2fd')))
                    style.append(('FONTNAME', (0, i), (0, i), 'Helvetica-Bold'))
                    style.append(('ALIGN', (0, i), (0, i), 'LEFT'))
                    if i < base_row + 4:
                        style.append(('FONTNAME', (4, i), (4, i), 'Helvetica-Bold'))
                        style.append(('ALIGN', (4, i), (4, i), 'LEFT'))
                        style.append(('ALIGN', (5, i), (5, i), 'RIGHT'))
                        style.append(('ALIGN', (6, i), (6, i), 'RIGHT'))
                        style.append(('FONTNAME', (7, i), (7, i), 'Helvetica-Bold'))
                        style.append(('ALIGN', (7, i), (7, i), 'LEFT'))

                style.append(('BACKGROUND', (0, obs_row), (-1, obs_row), colors.HexColor('#e3f2fd')))
                style.append(('FONTNAME', (0, obs_row), (-1, obs_row), 'Helvetica-Bold'))

                for i in range(resp_row, resp_row + 4):
                    style.append(('FONTNAME', (0, i), (0, i), 'Helvetica-Bold'))
                    style.append(('ALIGN', (0, i), (0, i), 'LEFT'))

                style.append(('SPAN', (0, 0), (2, 0)))
                style.append(('SPAN', (3, 0), (5, 0)))
                style.append(('SPAN', (6, 0), (7, 0)))

                for i in range(base_row, base_row + 5):
                    style.append(('SPAN', (0, i), (3, i)))

                style.append(('SPAN', (0, base_row + 4), (6, base_row + 4)))

                for i in range(obs_row, obs_row + 4):
                    style.append(('SPAN', (0, i), (7, i)))

                for i in range(resp_row, resp_row + 4):
                    style.append(('SPAN', (0, i), (1, i)))
                    style.append(('SPAN', (2, i), (7, i)))

                tabla.setStyle(TableStyle(style))
                elements.append(tabla)

        doc.build(elements)
        buffer.seek(0)

        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="Sabana_PorCliente_{datetime.now().strftime("%Y%m%d_%H%M")}.pdf"'}
        )

    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Librería no instalada: {str(e)}. Ejecuta: pip install reportlab")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {str(e)}")