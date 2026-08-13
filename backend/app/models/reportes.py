# app/services/reportes.py
import io
import base64
from datetime import datetime
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfgen import canvas
import tempfile
import os

from app.models.inspeccion import Inspeccion


class GeneradorReportes:
    
    @staticmethod
    def generar_excel(inspeccion: Inspeccion) -> bytes:
        """Genera un archivo Excel con el formato de registro de inspección"""
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Registro de Inspección"
        
        # Estilos
        titulo_font = Font(name='Arial', size=12, bold=True)
        subtitulo_font = Font(name='Arial', size=10, bold=True)
        normal_font = Font(name='Arial', size=9)
        border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        center_alignment = Alignment(horizontal='center', vertical='center')
        left_alignment = Alignment(horizontal='left', vertical='center')
        
        # Título principal
        ws.merge_cells('A1:O1')
        ws['A1'] = 'REGISTRO DE INSPECCIÓN DE CALIDAD'
        ws['A1'].font = Font(name='Arial', size=16, bold=True)
        ws['A1'].alignment = center_alignment
        
        # FILA 2 - Datos del encabezado
        headers = [
            ('PROD. TERMINADO:', 1, 3, ''),
            ('RESELECCIÓN:', 3, 5, ''),
            ('EMPAQUE FINAL:', 5, 7, '')
        ]
        
        col = 1
        for label, start, end, value in headers:
            ws.merge_cells(start_row=2, start_col=start, end_row=2, end_col=end)
            cell = ws.cell(row=2, column=start, value=label)
            cell.font = subtitulo_font
            cell.alignment = center_alignment
            cell.border = border
        
        # FILA 3 - FECHA, MÁQUINA, LÍNEA, CLIENTE
        datos = [
            ('FECHA:', 1, 2, str(inspeccion.fecha.strftime('%d/%m/%Y')) if inspeccion.fecha else ''),
            ('MÁQUINA:', 3, 4, inspeccion.maquina or ''),
            ('LÍNEA:', 5, 6, inspeccion.linea or ''),
            ('CLIENTE:', 7, 8, inspeccion.cliente or '')
        ]
        
        for label, start, end, value in datos:
            ws.merge_cells(start_row=3, start_col=start, end_row=3, end_col=end)
            cell = ws.cell(row=3, column=start, value=f"{label} {value}")
            cell.font = normal_font
            cell.alignment = left_alignment
            cell.border = border
        
        # FILA 4 - MOLDE, ACABADO, ITEM, NÚMERO
        datos2 = [
            ('MOLDE:', 1, 2, inspeccion.molde or ''),
            ('ACABADO:', 3, 5, inspeccion.acabado or ''),
            ('ITEM:', 6, 7, inspeccion.item or ''),
            ('NÚMERO:', 8, 8, inspeccion.numero or '')
        ]
        
        for label, start, end, value in datos2:
            ws.merge_cells(start_row=4, start_col=start, end_row=4, end_col=end)
            cell = ws.cell(row=4, column=start, value=f"{label} {value}")
            cell.font = normal_font
            cell.alignment = left_alignment
            cell.border = border
        
        # FILA 5 - Encabezado de tabla
        tabla_headers = ['N° de Ticket', 'N° Lote', 'Turno/Grupo', 'Ok', 'Ret', 'Defectos Encontrados', 'Cav. N°', 'Cant.']
        for col_idx, header in enumerate(tabla_headers, 1):
            cell = ws.cell(row=5, column=col_idx, value=header)
            cell.font = subtitulo_font
            cell.alignment = center_alignment
            cell.border = border
        
        # Filas de datos (hasta 20 filas)
        for row_idx in range(6, 26):
            for col_idx in range(1, 9):
                cell = ws.cell(row=row_idx, column=col_idx)
                cell.border = border
                cell.alignment = center_alignment
                if col_idx == 6:  # Defectos Encontrados
                    cell.alignment = left_alignment
        
        # Si hay datos, llenar algunas filas
        if inspeccion.id:
            row = 6
            ws.cell(row=row, column=1, value=inspeccion.ticket or '')
            ws.cell(row=row, column=2, value=inspeccion.lote or '')
            ws.cell(row=row, column=3, value=inspeccion.turno_grupo or '')
            ws.cell(row=row, column=4, value=inspeccion.ok or 0)
            ws.cell(row=row, column=5, value=inspeccion.ret or 0)
            ws.cell(row=row, column=6, value=inspeccion.defectos or '')
            ws.cell(row=row, column=7, value=inspeccion.cavidad or '')
            ws.cell(row=row, column=8, value=inspeccion.cantidad or 0)
        
        # FILA 27 - Estadísticas
        stats_row = 27
        stats_data = [
            ('Paletas Inspeccionadas:', 1, 2, inspeccion.paletas_inspeccionadas or 0),
            ('Críticos', 3, 3, f"A={inspeccion.criticos_a or 0} R={inspeccion.criticos_r or 0}"),
            ('Tamaño de Muestra:', 5, 6, inspeccion.tamano_muestra or ''),
            ('Paletas Buenas:', 1, 2, inspeccion.paletas_buenas or 0),
            ('Mayores B+', 3, 3, f"A={inspeccion.mayores_b_plus_a or 0} R={inspeccion.mayores_b_plus_r or 0}"),
            ('Tamaño de la Población:', 5, 6, inspeccion.tamano_poblacion or ''),
            ('Paletas Retenidas:', 1, 2, inspeccion.paletas_retenidas or 0),
            ('Mayores B-', 3, 3, f"A={inspeccion.mayores_b_minus_a or 0} R={inspeccion.mayores_b_minus_r or 0}"),
            ('Bot. por Camadas/Caja:', 5, 6, inspeccion.bot_por_camada or ''),
            ('Porcentaje de Rechazo:', 1, 2, f"{inspeccion.porcentaje_rechazo or 0}%"),
            ('Menores', 3, 3, f"A={inspeccion.menores_a or 0} R={inspeccion.menores_r or 0}"),
            ('Bot. por Paleta:', 5, 6, inspeccion.bot_por_paleta or ''),
            ('', 3, 3, ''),
            ('Gruesas por Paleta:', 5, 6, inspeccion.gruesas_por_paleta or '')
        ]
        
        for label, start, end, value in stats_data:
            if label:
                ws.merge_cells(start_row=stats_row, start_col=start, end_row=stats_row, end_col=end)
                cell = ws.cell(row=stats_row, column=start, value=f"{label} {value}" if isinstance(value, str) and not label.endswith(':') else label)
                cell.font = normal_font
                cell.alignment = center_alignment if start == 3 else left_alignment
                cell.border = border
            stats_row += 1
        
        # OBSERVACIONES
        obs_row = 36
        ws.merge_cells(start_row=obs_row, start_col=1, end_row=obs_row, end_col=8)
        ws.cell(row=obs_row, column=1, value='OBSERVACIONES')
        ws.cell(row=obs_row, column=1).font = subtitulo_font
        ws.cell(row=obs_row, column=1).alignment = center_alignment
        ws.cell(row=obs_row, column=1).border = border
        
        for row in range(obs_row + 1, obs_row + 5):
            ws.merge_cells(start_row=row, start_col=1, end_row=row, end_col=8)
            cell = ws.cell(row=row, column=1, value=inspeccion.observaciones or '' if row == obs_row + 1 else '')
            cell.border = border
            cell.alignment = left_alignment
        
        # RESPONSABLE
        resp_row = 41
        ws.merge_cells(start_row=resp_row, start_col=1, end_row=resp_row, end_col=2)
        ws.cell(row=resp_row, column=1, value='RESPONSABLE')
        ws.cell(row=resp_row, column=1).font = subtitulo_font
        ws.cell(row=resp_row, column=1).alignment = center_alignment
        ws.cell(row=resp_row, column=1).border = border
        
        ws.merge_cells(start_row=resp_row, start_col=3, end_row=resp_row, end_col=8)
        ws.cell(row=resp_row, column=3, value=inspeccion.responsable_nombre or '')
        ws.cell(row=resp_row, column=3).border = border
        ws.cell(row=resp_row, column=3).alignment = left_alignment
        
        # FIRMA
        firma_row = resp_row + 1
        ws.merge_cells(start_row=firma_row, start_col=1, end_row=firma_row, end_col=2)
        ws.cell(row=firma_row, column=1, value='Firma')
        ws.cell(row=firma_row, column=1).font = subtitulo_font
        ws.cell(row=firma_row, column=1).alignment = center_alignment
        ws.cell(row=firma_row, column=1).border = border
        
        ws.merge_cells(start_row=firma_row, start_col=3, end_row=firma_row, end_col=8)
        ws.cell(row=firma_row, column=3, value=inspeccion.firma or '')
        ws.cell(row=firma_row, column=3).border = border
        
        # GRUPO
        grupo_row = firma_row + 1
        ws.merge_cells(start_row=grupo_row, start_col=1, end_row=grupo_row, end_col=2)
        ws.cell(row=grupo_row, column=1, value='Grupo')
        ws.cell(row=grupo_row, column=1).font = subtitulo_font
        ws.cell(row=grupo_row, column=1).alignment = center_alignment
        ws.cell(row=grupo_row, column=1).border = border
        
        ws.merge_cells(start_row=grupo_row, start_col=3, end_row=grupo_row, end_col=8)
        ws.cell(row=grupo_row, column=3, value=inspeccion.responsable_grupo or '')
        ws.cell(row=grupo_row, column=3).border = border
        
        # Ajustar anchos de columna
        for col in range(1, 9):
            ws.column_dimensions[get_column_letter(col)].width = 20
        
        # Guardar en bytes
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output.getvalue()
    
    @staticmethod
    def generar_pdf(inspeccion: Inspeccion) -> bytes:
        """Genera un archivo PDF con el formato de registro de inspección"""
        
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
        
        # Título
        titulo_style = ParagraphStyle(
            'Titulo',
            parent=styles['Heading1'],
            fontSize=18,
            alignment=TA_CENTER,
            spaceAfter=10
        )
        elements.append(Paragraph('REGISTRO DE INSPECCIÓN DE CALIDAD', titulo_style))
        elements.append(Spacer(1, 10))
        
        # Datos del encabezado (tabla 2x4)
        data_header = [
            ['PROD. TERMINADO:', '', 'RESELECCIÓN:', '', 'EMPAQUE FINAL:', ''],
            [
                f'FECHA: {inspeccion.fecha.strftime("%d/%m/%Y") if inspeccion.fecha else ""}',
                f'MÁQUINA: {inspeccion.maquina or ""}',
                f'LÍNEA: {inspeccion.linea or ""}',
                f'CLIENTE: {inspeccion.cliente or ""}'
            ],
            [
                f'MOLDE: {inspeccion.molde or ""}',
                f'ACABADO: {inspeccion.acabado or ""}',
                f'ITEM: {inspeccion.item or ""}',
                f'NÚMERO: {inspeccion.numero or ""}'
            ]
        ]
        
        header_table = Table(data_header, colWidths=[2.5*cm, 2.5*cm, 2.5*cm, 2.5*cm, 2.5*cm, 2.5*cm])
        header_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 10))
        
        # Tabla de datos (similar al Excel)
        datos_tabla = [
            ['N° de Ticket', 'N° Lote', 'Turno/Grupo', 'Ok', 'Ret', 'Defectos Encontrados', 'Cav. N°', 'Cant.']
        ]
        
        # Filas de datos (hasta 20)
        for i in range(20):
            if i == 0 and inspeccion.id:
                datos_tabla.append([
                    inspeccion.ticket or '',
                    inspeccion.lote or '',
                    inspeccion.turno_grupo or '',
                    inspeccion.ok or 0,
                    inspeccion.ret or 0,
                    inspeccion.defectos or '',
                    inspeccion.cavidad or '',
                    inspeccion.cantidad or 0
                ])
            else:
                datos_tabla.append(['', '', '', '', '', '', '', ''])
        
        tabla_data = Table(datos_tabla, colWidths=[1.8*cm, 1.8*cm, 1.8*cm, 1.2*cm, 1.2*cm, 3*cm, 1.5*cm, 1.5*cm])
        tabla_data.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
        ]))
        elements.append(tabla_data)
        elements.append(Spacer(1, 10))
        
        # Estadísticas
        stats_data = [
            ['Paletas Inspeccionadas:', str(inspeccion.paletas_inspeccionadas or 0), 'Críticos', f"A={inspeccion.criticos_a or 0} R={inspeccion.criticos_r or 0}", 'Tamaño de Muestra:', str(inspeccion.tamano_muestra or '')],
            ['Paletas Buenas:', str(inspeccion.paletas_buenas or 0), 'Mayores B+', f"A={inspeccion.mayores_b_plus_a or 0} R={inspeccion.mayores_b_plus_r or 0}", 'Tamaño de la Población:', str(inspeccion.tamano_poblacion or '')],
            ['Paletas Retenidas:', str(inspeccion.paletas_retenidas or 0), 'Mayores B-', f"A={inspeccion.mayores_b_minus_a or 0} R={inspeccion.mayores_b_minus_r or 0}", 'Bot. por Camadas/Caja:', str(inspeccion.bot_por_camada or '')],
            ['Porcentaje de Rechazo:', f"{inspeccion.porcentaje_rechazo or 0}%", 'Menores', f"A={inspeccion.menores_a or 0} R={inspeccion.menores_r or 0}", 'Bot. por Paleta:', str(inspeccion.bot_por_paleta or '')],
            ['', '', '', '', 'Gruesas por Paleta:', str(inspeccion.gruesas_por_paleta or '')]
        ]
        
        stats_table = Table(stats_data, colWidths=[2.5*cm, 2*cm, 2.5*cm, 3*cm, 2.5*cm, 2*cm])
        stats_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
        ]))
        elements.append(stats_table)
        elements.append(Spacer(1, 10))
        
        # Observaciones
        obs_style = ParagraphStyle('Observaciones', parent=styles['Normal'], fontSize=10, spaceAfter=5)
        elements.append(Paragraph('OBSERVACIONES', styles['Heading4']))
        elements.append(Paragraph(inspeccion.observaciones or '', obs_style))
        elements.append(Spacer(1, 10))
        
        # Responsable
        resp_style = ParagraphStyle('Responsable', parent=styles['Normal'], fontSize=10)
        elements.append(Paragraph(f'<b>RESPONSABLE:</b> {inspeccion.responsable_nombre or ""}', resp_style))
        elements.append(Paragraph(f'<b>Firma:</b> {inspeccion.firma or ""}', resp_style))
        elements.append(Paragraph(f'<b>Grupo:</b> {inspeccion.responsable_grupo or ""}', resp_style))
        
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()