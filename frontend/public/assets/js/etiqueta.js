/* ==========================================
   VENVIDRIO - ETIQUETA (MoonDRAGO)
   etiqueta.js - v5 (Diseño expandido para PDF/JPG)
   ========================================== */

(function () {
  'use strict';

  const hostname = window.location.hostname;
  let API_URL = (hostname === 'localhost' || hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000'
    : 'https://calidad-venvidrio-repository-main.onrender.com';

  // ==========================================
  // UTILIDADES
  // ==========================================
  function formatearFecha(fechaStr) {
    if (!fechaStr) return '—';
    try {
      const d = new Date(fechaStr + 'T00:00:00');
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return fechaStr; }
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
    const plantaNombre = (lote.planta || 'VENEZUELA').toUpperCase();
    setTexto('ticket-planta', `VENVIDRIO ${plantaNombre}`);
    setTexto('ticket-title-code', lote.ticket_carga || lote.codigo_lote || '—');

    setTexto('ticket-cliente', lote.cliente || 'SIN ASIGNAR');
    setTexto('ticket-orden', lote.orden || 'NO APLICA');
    
    // Observaciones (Si tu API lo envía, se muestra. Si no, queda NO APLICA)
    setTexto('ticket-obs', lote.observaciones || 'NO APLICA');
    
    // Fecha de producción o registro
    const fechaAMostrar = lote.fecha_produccion || lote.fecha_registro;
    setTexto('ticket-fecha', formatearFecha(fechaAMostrar));

    // Máquina / Turno / Grupo
    const maquina = lote.maquina || '—';
    const turno = lote.turno || '—';
    const grupo = lote.grupo || '—';
    setTexto('ticket-maquina', `${maquina}   ${turno}   ${grupo}`);

    // Producto y Acabado
    setTexto('ticket-producto', lote.tipo_producto || '—');
    setTexto('ticket-acabado', lote.acabado || '—');

    // Item / Molde / Lote
    setTexto('ticket-item-code', lote.item || '—');
    setTexto('ticket-molde', lote.molde || '—');
    setTexto('ticket-lote', lote.codigo_lote || '—');

    // BPP y Capacidad
    if (lote.bpp !== null && lote.bpp !== undefined) {
        setTexto('ticket-bpp', Number(lote.bpp).toLocaleString('es-VE'));
    }
    if (lote.capacidad !== null && lote.capacidad !== undefined) {
        setTexto('ticket-cap', lote.capacidad);
    }

    // Generar el Código de Barras Real
    const codigoParaBarras = lote.ticket_carga || lote.codigo_lote || '000000';
    setTexto('ticket-barcode-text', codigoParaBarras);

    if (typeof JsBarcode !== 'undefined') {
      JsBarcode("#barcode-svg", codigoParaBarras, {
        format: "CODE128",
        lineColor: "#000000",
        width: 2,
        height: 70,
        displayValue: false,
        margin: 0
      });
    }

    // Mostrar contenedores
    document.getElementById('ticket-para-captura').style.display = 'block';
    document.getElementById('acciones-descarga').style.display = 'flex';
    document.getElementById('nota-info').style.display = 'block';
  }

  // ==========================================
  // DESCARGAS (JPG y PDF Expandidos)
  // ==========================================
  function descargarJPG() {
    const elementoCaptura = document.getElementById('ticket-para-captura');
    if (!elementoCaptura) return;
    
    const btn = document.getElementById('btn-descargar-jpg');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="ti ti-loader"></i> Generando...';
    btn.disabled = true;

    html2canvas(elementoCaptura, { 
      scale: 3, // Mayor resolución
      backgroundColor: '#ffffff', // Fondo blanco para que no salga gris
      useCORS: true 
    })
      .then(canvas => {
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const idLote = (document.getElementById('ticket-lote').textContent || 'lote').replace(/[^a-zA-Z0-9]/g, '_');
        
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
        console.error(err);
        alert('Error al generar JPG');
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

    html2canvas(elementoCaptura, { 
      scale: 3, 
      backgroundColor: '#ffffff', 
      useCORS: true 
    })
      .then(canvas => {
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const { jsPDF } = window.jspdf;
        
        // Creamos el PDF en tamaño A4
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        // OBTENEMOS EL ANCHO DE LA HOJA Y LE DAMOS UN MARGEN
        const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
        const imgWidth = pageWidth - 20; // 190mm de ancho (Ocupa casi todo)
        
        // Calculamos la altura proporcional para no deformar
        const imgHeight = (canvas.height * imgWidth) / canvas.width; 
        
        // Centrado (x = 10mm, y = 15mm)
        const x = 10; 
        const y = 15; 

        pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);
        
        const idLote = (document.getElementById('ticket-lote').textContent || 'lote').replace(/[^a-zA-Z0-9]/g, '_');
        pdf.save(`Etiqueta_Lote_${idLote}.pdf`);
        
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      })
      .catch(err => {
        console.error(err);
        alert('Error al generar PDF');
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
      mostrarError('No se especificó ningún lote en la URL.');
      return;
    }

    const codigoLote = loteParam.trim();
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = `Buscando lote ${codigoLote}...`;

    try {
      const response = await fetch(`${API_URL}/produccion/publico/${encodeURIComponent(codigoLote)}`);
      
      if (!response.ok) {
        if (response.status === 404) throw new Error(`No se encontró el lote "${codigoLote}".`);
        throw new Error(`Error ${response.status} al buscar el lote.`);
      }

      const lote = await response.json();
      renderizarEtiqueta(lote);
      ocultarLoading();

    } catch (error) {
      console.error('Error cargando lote:', error);
      mostrarError(error.message || 'Error de conexión.');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('btn-descargar-jpg')?.addEventListener('click', descargarJPG);
    document.getElementById('btn-descargar-pdf')?.addEventListener('click', descargarPDF);
    init();
  });

})();