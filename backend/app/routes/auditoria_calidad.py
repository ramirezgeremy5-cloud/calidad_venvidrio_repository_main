from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import io
from datetime import datetime
from pathlib import Path
from fastapi.responses import Response

from app.models.auditoria_calidad import AuditoriaCalidad
from app.models.usuario import Usuario
from app.schemas.auditoria_calidad import AuditoriaCalidadCreate, AuditoriaCalidadResponse
from app.dependencies.auth import get_db, check_role

router = APIRouter(
    prefix="/auditorias/calidad",
    tags=["Auditoría Interna de Calidad"]
)

# Ruta absoluta al logo
BASE_DIR = Path(__file__).resolve().parent.parent
LOGO_PATH = BASE_DIR / "static" / "logo.png"

# =========================
# LISTAR EVALUACIONES
# =========================
@router.get("/evaluaciones", response_model=List[AuditoriaCalidadResponse])
def listar_evaluaciones(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_role([2, 3]))
):
    auditorias = db.query(AuditoriaCalidad).order_by(AuditoriaCalidad.fecha.desc()).all()
    
    res = []
    for a in auditorias:
        evaluado = db.query(Usuario).filter(Usuario.id == a.evaluado_id).first()
        evaluador = db.query(Usuario).filter(Usuario.id == a.evaluador_id).first()
        
        res.append(
            AuditoriaCalidadResponse(
                id=a.id,
                evaluado_id=a.evaluado_id,
                evaluador_id=a.evaluador_id,
                periodo=a.periodo,
                puntaje=a.puntaje,
                categoria=a.categoria,
                observaciones=a.observaciones,
                fecha=a.fecha,
                evaluado_nombre=evaluado.nombre if evaluado else "Desconocido",
                evaluador_nombre=evaluador.nombre if evaluador else "Desconocido"
            )
        )
    return res


# =========================
# CREAR EVALUACIÓN
# =========================
@router.post("/evaluaciones", response_model=AuditoriaCalidadResponse, status_code=status.HTTP_201_CREATED)
def crear_evaluacion(
    data: AuditoriaCalidadCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_role([2, 3]))
):
    evaluado = db.query(Usuario).filter(Usuario.id == data.evaluado_id).first()
    if not evaluado:
        raise HTTPException(404, "El usuario evaluado no existe")

    nueva_auditoria = AuditoriaCalidad(
        evaluado_id=data.evaluado_id,
        evaluador_id=current_user.id,
        periodo=data.periodo,
        puntaje=data.puntaje,
        categoria=data.categoria,
        detalles=data.detalles,
        observaciones=data.observaciones
    )
    
    db.add(nueva_auditoria)
    db.commit()
    db.refresh(nueva_auditoria)

    return AuditoriaCalidadResponse(
        id=nueva_auditoria.id,
        evaluado_id=nueva_auditoria.evaluado_id,
        evaluador_id=nueva_auditoria.evaluador_id,
        periodo=nueva_auditoria.periodo,
        puntaje=nueva_auditoria.puntaje,
        categoria=nueva_auditoria.categoria,
        observaciones=nueva_auditoria.observaciones,
        fecha=nueva_auditoria.fecha,
        evaluado_nombre=evaluado.nombre,
        evaluador_nombre=current_user.nombre
    )


# =========================
# EXPORTAR EVALUACIÓN INDIVIDUAL A PDF
# =========================
@router.get("/evaluaciones/{evaluacion_id}/pdf")
def exportar_pdf(
    evaluacion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_role([2, 3]))
):
    evaluacion = db.query(AuditoriaCalidad).filter(AuditoriaCalidad.id == evaluacion_id).first()
    if not evaluacion:
        raise HTTPException(404, "Evaluación no encontrada")

    evaluado = db.query(Usuario).filter(Usuario.id == evaluacion.evaluado_id).first()
    evaluador = db.query(Usuario).filter(Usuario.id == evaluacion.evaluador_id).first()

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        from reportlab.lib.enums import TA_CENTER, TA_LEFT

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=1.5*cm, leftMargin=1.5*cm, topMargin=1.5*cm)
        elements = []
        styles = getSampleStyleSheet()

        # Insertar Logo
        if LOGO_PATH.exists():
            try:
                img = Image(str(LOGO_PATH), width=5*cm, height=2.5*cm)
                img.hAlign = 'CENTER'
                elements.append(img)
                elements.append(Spacer(1, 0.5*cm))
            except Exception as e:
                print(f"Error cargando logo PDF: {e}")

        titulo_style = ParagraphStyle('Titulo', parent=styles['Heading1'], fontSize=16, alignment=TA_CENTER, textColor=colors.HexColor('#1a237e'))
        elements.append(Paragraph('REPORTE DE EVALUACIÓN DE CALIDAD', titulo_style))
        elements.append(Spacer(1, 0.8*cm))

        data = [
            ['ID Evaluación', str(evaluacion.id)],
            ['Periodo', evaluacion.periodo],
            ['Evaluado', evaluado.nombre if evaluado else '—'],
            ['Evaluador', evaluador.nombre if evaluador else '—'],
            ['Puntaje', f"{evaluacion.puntaje}%"],
            ['Categoría', evaluacion.categoria],
            ['Observaciones', evaluacion.observaciones or '—'],
            ['Fecha', evaluacion.fecha.strftime("%d/%m/%Y")],
        ]

        table = Table(data, colWidths=[4*cm, 12*cm])
        table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e3f2fd')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(table)
        doc.build(elements)
        
        buffer.seek(0)
        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="Evaluacion_{evaluacion.id}.pdf"'}
        )
    except Exception as e:
        raise HTTPException(500, f"Error generando PDF: {str(e)}")


# =========================
# EXPORTAR EVALUACIÓN INDIVIDUAL A WORD
# =========================
@router.get("/evaluaciones/{evaluacion_id}/word")
def exportar_word(
    evaluacion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_role([2, 3]))
):
    evaluacion = db.query(AuditoriaCalidad).filter(AuditoriaCalidad.id == evaluacion_id).first()
    if not evaluacion:
        raise HTTPException(404, "Evaluación no encontrada")

    evaluado = db.query(Usuario).filter(Usuario.id == evaluacion.evaluado_id).first()
    evaluador = db.query(Usuario).filter(Usuario.id == evaluacion.evaluador_id).first()

    try:
        from docx import Document
        from docx.shared import Cm
        from docx.enum.text import WD_ALIGN_PARAGRAPH

        doc = Document()

        # Insertar Logo
        if LOGO_PATH.exists():
            try:
                p_logo = doc.add_paragraph()
                p_logo.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run_logo = p_logo.add_run()
                run_logo.add_picture(str(LOGO_PATH), width=Cm(5))
            except Exception as e:
                print(f"Error cargando logo Word: {e}")

        titulo = doc.add_heading('REPORTE DE EVALUACIÓN DE CALIDAD', level=1)
        titulo.alignment = WD_ALIGN_PARAGRAPH.CENTER

        doc.add_paragraph(f"ID Evaluación: {evaluacion.id}")
        doc.add_paragraph(f"Periodo: {evaluacion.periodo}")
        doc.add_paragraph(f"Evaluado: {evaluado.nombre if evaluado else '—'}")
        doc.add_paragraph(f"Evaluador: {evaluador.nombre if evaluador else '—'}")
        doc.add_paragraph(f"Puntaje: {evaluacion.puntaje}%")
        doc.add_paragraph(f"Categoría: {evaluacion.categoria}")
        doc.add_paragraph(f"Observaciones: {evaluacion.observaciones or '—'}")
        doc.add_paragraph(f"Fecha: {evaluacion.fecha.strftime('%d/%m/%Y')}")

        buffer = io.BytesIO()
        doc.save(buffer)
        buffer.seek(0)

        return Response(
            content=buffer.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="Evaluacion_{evaluacion.id}.docx"'}
        )
    except Exception as e:
        raise HTTPException(500, f"Error generando Word: {str(e)}")


# =========================
# EXPORTAR TODAS A PDF (GLOBAL)
# =========================
@router.get("/evaluaciones/exportar/pdf")
def exportar_todas_pdf(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_role([2, 3]))
):
    evaluaciones = db.query(AuditoriaCalidad).order_by(AuditoriaCalidad.fecha.desc()).all()
    if not evaluaciones:
        raise HTTPException(404, "No hay evaluaciones registradas")

    try:
        from reportlab.lib.pagesizes import landscape, A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        from reportlab.lib.enums import TA_CENTER

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), rightMargin=1*cm, leftMargin=1*cm, topMargin=1*cm, bottomMargin=1*cm)
        elements = []
        styles = getSampleStyleSheet()

        # Logo
        if LOGO_PATH.exists():
            try:
                img = Image(str(LOGO_PATH), width=4*cm, height=2*cm)
                img.hAlign = 'CENTER'
                elements.append(img)
                elements.append(Spacer(1, 0.5*cm))
            except Exception as e:
                print(f"Error cargando logo PDF global: {e}")

        titulo_style = ParagraphStyle('Titulo', parent=styles['Heading1'], fontSize=14, alignment=TA_CENTER, textColor=colors.HexColor('#1a237e'))
        elements.append(Paragraph('REPORTE GLOBAL DE EVALUACIONES DE CALIDAD', titulo_style))
        elements.append(Spacer(1, 0.5*cm))

        data = [['ID', 'Periodo', 'Evaluado', 'Evaluador', 'Puntaje', 'Categoría', 'Fecha']]
        for e in evaluaciones:
            evaluado = db.query(Usuario).filter(Usuario.id == e.evaluado_id).first()
            evaluador = db.query(Usuario).filter(Usuario.id == e.evaluador_id).first()
            data.append([
                str(e.id),
                e.periodo,
                evaluado.nombre if evaluado else '—',
                evaluador.nombre if evaluador else '—',
                f"{e.puntaje}%",
                e.categoria,
                e.fecha.strftime("%d/%m/%Y")
            ])

        table = Table(data, colWidths=[2*cm, 3*cm, 4*cm, 4*cm, 2.5*cm, 3*cm, 3*cm])
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
        doc.build(elements)
        
        buffer.seek(0)
        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="Evaluaciones_Global.pdf"'}
        )
    except Exception as e:
        raise HTTPException(500, f"Error generando PDF Global: {str(e)}")


# =========================
# EXPORTAR TODAS A WORD (GLOBAL)
# =========================
@router.get("/evaluaciones/exportar/word")
def exportar_todas_word(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_role([2, 3]))
):
    evaluaciones = db.query(AuditoriaCalidad).order_by(AuditoriaCalidad.fecha.desc()).all()
    if not evaluaciones:
        raise HTTPException(404, "No hay evaluaciones registradas")

    try:
        from docx import Document
        from docx.shared import Cm
        from docx.enum.text import WD_ALIGN_PARAGRAPH

        doc = Document()

        # Logo
        if LOGO_PATH.exists():
            try:
                p_logo = doc.add_paragraph()
                p_logo.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run_logo = p_logo.add_run()
                run_logo.add_picture(str(LOGO_PATH), width=Cm(4))
            except Exception as e:
                print(f"Error cargando logo Word global: {e}")

        titulo = doc.add_heading('REPORTE GLOBAL DE EVALUACIONES DE CALIDAD', level=1)
        titulo.alignment = WD_ALIGN_PARAGRAPH.CENTER

        table = doc.add_table(rows=1, cols=7)
        table.style = 'Table Grid'
        hdr_cells = table.rows[0].cells
        headers = ['ID', 'Periodo', 'Evaluado', 'Evaluador', 'Puntaje', 'Categoría', 'Fecha']
        
        for i, h in enumerate(headers):
            hdr_cells[i].text = h

        for e in evaluaciones:
            evaluado = db.query(Usuario).filter(Usuario.id == e.evaluado_id).first()
            evaluador = db.query(Usuario).filter(Usuario.id == e.evaluador_id).first()
            
            row_cells = table.add_row().cells
            row_cells[0].text = str(e.id)
            row_cells[1].text = e.periodo
            row_cells[2].text = evaluado.nombre if evaluado else '—'
            row_cells[3].text = evaluador.nombre if evaluador else '—'
            row_cells[4].text = f"{e.puntaje}%"
            row_cells[5].text = e.categoria
            row_cells[6].text = e.fecha.strftime("%d/%m/%Y")

        buffer = io.BytesIO()
        doc.save(buffer)
        buffer.seek(0)

        return Response(
            content=buffer.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": 'attachment; filename="Evaluaciones_Global.docx"'}
        )
    except Exception as e:
        raise HTTPException(500, f"Error generando Word Global: {str(e)}")


# =========================
# ELIMINAR EVALUACIÓN (SOLO ADMIN)
# =========================
@router.delete("/evaluaciones/{evaluacion_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_evaluacion(
    evaluacion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(check_role([3])) # 👈 Solo Admin
):
    evaluacion = db.query(AuditoriaCalidad).filter(AuditoriaCalidad.id == evaluacion_id).first()
    if not evaluacion:
        raise HTTPException(404, "Evaluación no encontrada")

    db.delete(evaluacion)
    db.commit()
    return None