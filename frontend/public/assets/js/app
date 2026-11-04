/* ==========================================
   VENVIDRIO - CONTROL DE CALIDAD
   app.js
========================================== */

/* ==========================================
   NAVEGACIÓN ENTRE MÓDULOS
========================================== */

function nav(page) {

    document.querySelectorAll('.page').forEach(section => {
        section.classList.remove('active');
    });

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    const selectedPage =
        document.getElementById(`page-${page}`);

    if (selectedPage) {
        selectedPage.classList.add('active');
    }

    const selectedNav =
        document.querySelector(`[data-page="${page}"]`);

    if (selectedNav) {
        selectedNav.classList.add('active');
    }
}

/* ==========================================
   PRODUCCIÓN
========================================== */

function addProd() {

    const form =
        document.getElementById('prod-form-card');

    if (form) {
        form.style.display = 'block';
    }
}

function cancelProd() {

    const form =
        document.getElementById('prod-form-card');

    if (form) {
        form.style.display = 'none';
    }
}

function saveProd() {

    const molde =
        document.getElementById('f-molde')?.value.trim() || 'M-00';

    const inicio =
        document.getElementById('f-inicio')?.value || '-';

    const fin =
        document.getElementById('f-fin')?.value || '-';

    const estado =
        document.getElementById('f-estado')?.value || 'Activa';

    const table =
        document.getElementById('prod-table');

    if (!table) return;

    const totalRows =
        table.querySelectorAll('tr').length;

    const corrida =
        `CR-${String(totalRows).padStart(3, '0')}`;

    let chipClass = 'chip-blue';

    switch (estado) {

        case 'Completa':
            chipClass = 'chip-green';
            break;

        case 'Revisión':
            chipClass = 'chip-amber';
            break;

        default:
            chipClass = 'chip-blue';
    }

    const row =
        document.createElement('tr');

    row.dataset.estado = estado;

    row.innerHTML = `
        <td>${corrida}</td>
        <td>${molde}</td>
        <td>${inicio}</td>
        <td>${fin}</td>
        <td>--</td>
        <td>--</td>
        <td>
            <span class="chip ${chipClass}">
                ${estado}
            </span>
        </td>
    `;

    table.appendChild(row);

    document.getElementById('f-molde').value = '';
    document.getElementById('f-inicio').value = '';
    document.getElementById('f-fin').value = '';

    cancelProd();
}

/* ==========================================
   FILTRO DE PRODUCCIÓN
========================================== */

function filterProd(status) {

    document
        .querySelectorAll('#prod-table tr[data-estado]')
        .forEach(row => {

            if (
                status === 'all' ||
                row.dataset.estado === status
            ) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }

        });
}

/* ==========================================
   DEFECTOS
========================================== */

function addDefecto() {

    const form =
        document.getElementById('def-form-card');

    if (form) {
        form.style.display = 'block';
    }
}

function cancelDef() {

    const form =
        document.getElementById('def-form-card');

    if (form) {
        form.style.display = 'none';
    }
}

function saveDef() {

    const corrida =
        document.getElementById('d-corrida')?.value || '';

    const tipo =
        document.getElementById('d-tipo')?.value || '';

    const cantidad =
        document.getElementById('d-cant')?.value || '1';

    const severidad =
        document.getElementById('d-sev')?.value || 'Leve';

    const observacion =
        document.getElementById('d-obs')?.value || '-';

    const table =
        document.getElementById('def-table');

    if (!table) return;

    let chipClass = 'chip-green';

    switch (severidad) {

        case 'Moderado':
            chipClass = 'chip-amber';
            break;

        case 'Crítico':
            chipClass = 'chip-red';
            break;

        default:
            chipClass = 'chip-green';
    }

    const row =
        document.createElement('tr');

    row.innerHTML = `
        <td>${corrida}</td>
        <td>${tipo}</td>
        <td>${cantidad}</td>
        <td>
            <span class="chip ${chipClass}">
                ${severidad}
            </span>
        </td>
        <td>${observacion}</td>
        <td>
            <button
                class="btn btn-danger"
                onclick="deleteRow(this)">
                Eliminar
            </button>
        </td>
    `;

    table.appendChild(row);

    document.getElementById('d-tipo').value = '';
    document.getElementById('d-cant').value = '1';
    document.getElementById('d-obs').value = '';

    cancelDef();
}

function deleteRow(button) {

    const row = button.closest('tr');

    if (row) {
        row.remove();
    }
}

/* ==========================================
   ETIQUETAS
========================================== */

function updateLabel() {

    const producto =
        document.getElementById('lbl-prod')?.value || '';

    const lote =
        document.getElementById('lbl-lote')?.value || '';

    const composicion =
        document.getElementById('lbl-comp')?.value || '';

    const peso =
        document.getElementById('lbl-peso')?.value || '';

    const estado =
        document.getElementById('lbl-estado')?.value || '';

    document.getElementById('tp-prod').textContent =
        producto;

    document.getElementById('tp-lote').textContent =
        lote;

    document.getElementById('tp-comp').textContent =
        composicion;

    document.getElementById('tp-peso').textContent =
        peso;

    const estadoElement =
        document.getElementById('tp-estado');

    estadoElement.textContent = estado;

    estadoElement.className = 'chip';

    if (estado === 'Producción Apta') {

        estadoElement.classList.add('chip-green');

    } else if (estado === 'No Apta') {

        estadoElement.classList.add('chip-red');

    } else {

        estadoElement.classList.add('chip-amber');
    }
}

/* ==========================================
   QR CODE
========================================== */

let qrInstance = null;

function generateQR() {

    const container =
        document.getElementById('qr-canvas');

    if (!container) return;

    container.innerHTML = '';

    const producto =
        document.getElementById('lbl-prod')?.value || '';

    const lote =
        document.getElementById('lbl-lote')?.value || '';

    const fecha =
        document.getElementById('lbl-fecha')?.value || '';

    const contenidoQR =
        `Producto: ${producto}
Lote: ${lote}
Fecha: ${fecha}`;

    qrInstance = new QRCode(container, {
        text: contenidoQR,
        width: 120,
        height: 120,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    const note =
        document.getElementById('qr-note');

    if (note) {
        note.textContent =
            `QR generado correctamente para el lote ${lote}`;
    }
}

/* ==========================================
   AUDITORÍA
========================================== */

function updateAudit() {

    const checks =
        document.querySelectorAll('.audit-check');

    const total =
        checks.length;

    const completed =
        [...checks].filter(
            check => check.checked
        ).length;

    const percentage =
        total > 0
            ? Math.round(
                (completed / total) * 100
              )
            : 0;

    const progressFill =
        document.getElementById('audit-fill');

    const progressText =
        document.getElementById('audit-pct');

    if (progressFill) {
        progressFill.style.width =
            `${percentage}%`;
    }

    if (progressText) {
        progressText.textContent =
            `${completed} / ${total} (${percentage}%)`;
    }
}

/* ==========================================
   INICIALIZACIÓN
========================================== */

document.addEventListener(
    'DOMContentLoaded',
    () => {

        updateLabel();
        updateAudit();

        console.log(
            'Sistema de Control de Calidad Venvidrio iniciado.'
        );

    }
);