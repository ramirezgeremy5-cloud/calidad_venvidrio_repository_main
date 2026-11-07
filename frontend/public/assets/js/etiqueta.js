/* ==========================================
   VENVIDRIO - ETIQUETA (MoonDRAGO)
   etiqueta.js - v3 (Final)
   ========================================== */

(function () {
  'use strict';

  // ==========================================
  // CONFIGURACIÓN DE LA API
  // ==========================================
  const hostname = window.location.hostname;
  let API_URL;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    API_URL = 'http://127.0.0.1:8000';
  } else {
    API_URL = 'https://calidad-venvidrio-repository-main.onrender.com';
  }

  // ==========================================
  // UTILIDADES
  // ==========================================
  function formatearFechaProd(fechaStr) {
    if (!fechaStr) return '—';
    try {
      const d = new Date(fechaStr + 'T00:00:00');
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return fechaStr; }
  }

  function formatearCapacidad(ml, unidad) {
    if (ml === null || ml === undefined || isNaN(ml)) return '';
    const val = parseFloat(ml);
    if (unidad === 'l' || unidad === 'L') {
      return (val / 1000).toFixed(3).replace('.', ',') + ' L';
    }
    return val + ' ml';
  }

  function setTexto(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = (valor !== null && valor !== undefined && valor !== '') ? valor : '—';
  }

  function mostrarError(msg) {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
    
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    
    if (errorContainer && errorMessage) {
      errorContainer.style.display = 'block';
      errorMessage.textContent = msg;
    }
  }

  function ocultarLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
  }

  // ==========================================
  // LLENAR LA ETIQUETA CON LOS DATOS DEL LOTE
  // ==========================================
  function renderizarEtiqueta(lote) {
    // Planta (brand del ticket)
    const plantaNombre = (lote.planta || 'VENEZUELA').toUpperCase();
    setTexto('ticket-planta', `VENVIDRIO ${plantaNombre}`);

    // Ticket (título)
    setTexto('ticket-title-code', lote.ticket_carga || lote.codigo_lote || '—');

    // Datos principales
    setTexto('ticket-cliente', lote.cliente || 'SIN ASIGNAR');
    setTexto('ticket-orden', lote.orden || 'NO APLICA');
    setTexto('ticket-producto', lote.tipo_producto || '—');
    setTexto('ticket-acabado', lote.acabado || '—');

    // Máquina / Turno / Grupo
    const maquina = lote.maquina || '—';
    const turno = lote.turno || '—';
    const grupo = lote.grupo || '—';
    setTexto('ticket-maquina', `${maquina} / ${turno} / ${grupo}`);

    // Item / Molde / Lote
    setTexto('ticket-item-code', lote.item || '—');
    setTexto('ticket-molde', lote.molde || '—');
    setTexto('ticket-lote', lote.codigo_lote || '—');

    // Código de barras visual
    setTexto('ticket-ticket-text', lote.ticket_carga || lote.codigo_lote || '—');

    // Mostrar la etiqueta y los botones
    const ticketContainer = document.getElementById('ticket-para-captura');
    const accionesContainer = document.getElementById('acciones-descarga');
    const notaInfo = document.getElementById('nota-info');

    if (ticketContainer) ticketContainer.style.display = 'block';
    if (accionesContainer) accionesContainer.style.display = 'flex';
    if (notaInfo) notaInfo.style.display = 'block';
  }

  // ==========================================
  // FUNCIONES DE DESCARGA
  // ==========================================
  function descargarJPG() {
    const elementoCaptura = document.getElementById('ticket-para-captura');
    if (!elementoCaptura) return;

    const btn = document.getElementById('btn-descargar-jpg');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="ti ti-loader"></i> Generando...';
    btn.disabled = true;

    html2canvas(elementoCaptura, { scale: 3, backgroundColor: '#ffffff' })
      .then(canvas => {
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const idLote = (document.getElementById('ticket-lote')?.textContent || 'lote')
          .replace(/[^a-zA-Z0-9]/g, '_');
        
        const enlace = document.createElement('a');
        enlace.href = imgData;
        enlace.download = `Etiqueta_Lote_${idLote}.jpg`;
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      })
      .catch(err => {
        console.error('Error al generar JPG:', err);
        alert('Error al generar la imagen JPG.');
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      });
  }

  function descargarPDF() {
    const elementoCaptura = document.getElementById('ticket-para-captura');
    if (!elementoCaptura) return;

    const btn = document.getElementById('btn-descargar-pdf');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="ti ti-loader"></i> Generando...';
    btn.disabled = true;

    html2canvas(elementoCaptura, { scale: 3, backgroundColor: '#ffffff' })
      .then(canvas => {
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const { jsPDF } = window.jspdf;
        
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 100;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const x = (pdf.internal.pageSize.getWidth() - imgWidth) / 2;
        const y = 20;
        
        pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);
        
        const idLote = (document.getElementById('ticket-lote')?.textContent || 'lote')
          .replace(/[^a-zA-Z0-9]/g, '_');
        pdf.save(`Etiqueta_Lote_${idLote}.pdf`);
        
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      })
      .catch(err => {
        console.error('Error al generar PDF:', err);
        alert('Error al generar el PDF.');
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      });
  }

  // ==========================================
  // CARGA INICIAL
  // ==========================================
  async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const loteParam = urlParams.get('lote');

    if (!loteParam || !loteParam.trim()) {
      mostrarError('No se especificó ningún lote en la URL. Debe escanear un código QR válido.');
      return;
    }

    const codigoLote = loteParam.trim();
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = `Buscando lote ${codigoLote}...`;

    try {
      // 👇 ENDPOINT PÚBLICO (SIN AUTENTICACIÓN)
      const response = await fetch(
        `${API_URL}/produccion/publico/${encodeURIComponent(codigoLote)}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`No se encontró el lote "${codigoLote}" en la base de datos.`);
        }
        if (response.status === 422) {
          throw new Error(`El código "${codigoLote}" no tiene un formato válido.`);
        }
        throw new Error(`Error ${response.status} al buscar el lote.`);
      }

      const lote = await response.json();
      renderizarEtiqueta(lote);
      ocultarLoading();

    } catch (error) {
      console.error('Error cargando lote:', error);
      mostrarError(error.message || 'No se pudo conectar con el servidor. Verifique su conexión a internet.');
    }
  }

  // ==========================================
  // EVENTOS Y ARRANQUE
  // ==========================================
  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('btn-descargar-jpg')?.addEventListener('click', descargarJPG);
    document.getElementById('btn-descargar-pdf')?.addEventListener('click', descargarPDF);
    init();
  });

})();