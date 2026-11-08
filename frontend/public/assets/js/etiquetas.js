/* ==========================================
   VENVIDRIO - ETIQUETAS Y TRAZABILIDAD
   etiquetas.js — v11 (Historial, Descargas, Validación)
   ========================================== */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  const hostname = window.location.hostname;
  let API_URL = (hostname === 'localhost' || hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000'
    : 'https://calidad-venvidrio-repository-main.onrender.com';

  // Referencias al DOM
  const btnBuscar     = document.getElementById('btn-buscar-lote');
  const inputLote     = document.getElementById('buscar-lote');
  const btnImprimir   = document.getElementById('btn-imprimir');
  const btnJPG        = document.getElementById('btn-descargar-jpg');
  const btnPDF        = document.getElementById('btn-descargar-pdf');
  const btnActions    = document.getElementById('btn-actions');
  const errorMsg      = document.getElementById('error-lote');
  const successMsg    = document.getElementById('success-lote');
  const warningMsg    = document.getElementById('warning-lote');
  const warningText   = document.getElementById('warning-text');
  const ticketEmpty   = document.getElementById('ticket-empty');
  const ticketContent = document.getElementById('ticket-content');
  const ticketPreview = document.getElementById('ticket-preview');
  const barcodeSvg    = document.getElementById('barcode');
  const historialCont = document.getElementById('historial-lotes');
  const toast         = document.getElementById('toast');
  const toastMsg      = document.getElementById('toast-message');

  let cargando = false;
  let loteActual = null;
  let historial = []; // Array para guardar los lotes de la sesión

  // =========================
  // UTILIDADES
  // =========================
  if (!document.getElementById('spin-keyframes')) {
    const st = document.createElement('style');
    st.id = 'spin-keyframes';
    st.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
    document.head.appendChild(st);
  }

  function mostrarToast(mensaje, esError = false) {
    if (!toast || !toastMsg) return;
    toastMsg.textContent = mensaje;
    toast.style.background = esError ? '#b91c1c' : '#15803d';
    toast.style.display = 'flex';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
  }

  function formatearFecha(fechaStr) {
    if (!fechaStr) return '--/--/----';
    const soloFecha = fechaStr.split('T')[0];
    const partes = soloFecha.split('-');
    if (partes.length === 3) return partes[2] + '/' + partes[1] + '/' + partes[0];
    return fechaStr;
  }

  function setVisible(el, visible, displayValue) {
    if (!el) return;
    el.style.display = visible ? (displayValue || 'block') : 'none';
  }

  function limpiarBarcode() {
    if (barcodeSvg) {
      while (barcodeSvg.firstChild) barcodeSvg.removeChild(barcodeSvg.firstChild);
    }
  }

  function setLoadingBtn(loading) {
    if (!btnBuscar) return;
    if (loading) {
      btnBuscar.disabled = true;
      btnBuscar.innerHTML = '<i class="ti ti-loader-2" style="display:inline-block;animation:spin 1s linear infinite;"></i> Cargando...';
    } else {
      btnBuscar.disabled = false;
      btnBuscar.innerHTML = '<i class="ti ti-search"></i> Cargar';
    }
  }

  // =========================
  // MOSTRAR / OCULTAR MENSAJES
  // =========================
  function mostrarError(mensaje) {
    if (!mensaje) mensaje = "Lote no encontrado.";
    if (errorMsg) {
      errorMsg.innerHTML = '<i class="ti ti-alert-circle"></i> ' + mensaje;
      setVisible(errorMsg, true);
    }
    setVisible(successMsg, false);
    setVisible(warningMsg, false);
    setVisible(ticketEmpty, true, 'flex');
    setVisible(ticketContent, false);
    limpiarBarcode();
    if (btnActions) { btnActions.style.opacity = '0'; btnActions.style.pointerEvents = 'none'; }
    if (inputLote) { inputLote.focus(); inputLote.select(); }
  }

  function ocultarMensajes() {
    setVisible(errorMsg, false);
    setVisible(successMsg, false);
    setVisible(warningMsg, false);
  }

  // =========================
  // HISTORIAL
  // =========================
  function renderHistorial() {
    if (!historialCont) return;
    if (historial.length === 0) {
      historialCont.innerHTML = '<span style="font-size: 12px; color: #94a3b8; font-style: italic;">Aún no has cargado ningún lote.</span>';
      return;
    }

    historialCont.innerHTML = historial.map(function(item) {
      return `
        <button type="button" class="hist-item" data-codigo="${item.codigo}" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; text-align: left; transition: all 0.15s;">
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 12px; font-weight: 700; color: #1e293b;">${item.codigo}</span>
            <span style="font-size: 10px; color: #64748b;">${item.ticket || 'Sin ticket'}</span>
          </div>
          <i class="ti ti-refresh" style="color: #94a3b8;"></i>
        </button>
      `;
    }).join('');

    // Asignar eventos de clic a los items del historial
    historialCont.querySelectorAll('.hist-item').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const codigo = this.getAttribute('data-codigo');
        if (inputLote) inputLote.value = codigo;
        cargarLote(codigo);
      });
    });
  }

  function agregarAlHistorial(data) {
    // Evitar duplicados en la sesión
    const existe = historial.find(function(h) { return h.codigo === data.codigo_lote; });
    if (existe) return;

    historial.unshift({
      codigo: data.codigo_lote,
      ticket: data.ticket_carga
    });

    // Limitar a 5 elementos para no saturar
    if (historial.length > 5) historial.pop();
    
    renderHistorial();
  }

  // =========================
  // RELLENAR ETIQUETA
  // =========================
  function llenarEtiqueta(data) {
    ocultarMensajes();
    loteActual = data;

    setVisible(ticketEmpty, false);
    setVisible(ticketContent, true, 'flex');

    function setVal(id, val, defaultVal) {
      const el = document.getElementById(id);
      if (el) el.textContent = (val !== null && val !== undefined && val !== '') ? val : defaultVal;
    }

    setVal('tk-planta',   data.planta ? 'VENVIDRIO ' + data.planta.toUpperCase() : 'VENVIDRIO VALERA', 'VENVIDRIO VALERA');
    setVal('tk-ticket',   data.ticket_carga || data.ticket, '---');
    setVal('tk-cliente',  data.cliente, '---');
    setVal('tk-orden',    data.orden || 'S/O', 'S/O');
    setVal('tk-obs',      data.obs_produccion || 'NO APLICA', 'NO APLICA');
    setVal('tk-maquina',  data.maquina, '--');
    setVal('tk-turno',    data.turno, '-');
    setVal('tk-grupo',    data.grupo, '--');
    setVal('tk-fecha',    formatearFecha(data.fecha_produccion), '--/--/----');
    setVal('tk-producto', data.tipo_producto, '---');
    setVal('tk-acabado',  data.acabado, '---');
    setVal('tk-item',     data.item, '---');

    let bppText = data.bpp;
    if (typeof bppText === 'number') bppText = bppText.toLocaleString('es-VE');
    setVal('tk-bpp',   bppText, '---');
    setVal('tk-cap',   data.capacidad, '---');
    setVal('tk-molde', data.molde, '---');
    setVal('tk-lote',  data.codigo_lote, '---');

    const barcodeText = data.ticket_carga || data.ticket || data.codigo_lote;
    setVal('tk-barcode-text', barcodeText, '---');

    limpiarBarcode();

    if (barcodeText && typeof JsBarcode !== 'undefined') {
      try {
        JsBarcode('#barcode', barcodeText, {
          format: 'CODE128', lineColor: '#000000', width: 2, height: 60, displayValue: false, margin: 0, background: 'transparent'
        });
      } catch (err) { console.error('Error generando código de barras:', err); }
    }

    // Mostrar/Ocultar advertencia según el estatus
    if (data.estatus === '600') {
      warningText.textContent = 'Este lote ya fue DESPACHADO. Reimprimir solo si es estrictamente necesario.';
      setVisible(warningMsg, true);
    } else if (data.estatus === '999') {
      warningText.textContent = 'Este lote está marcado como SOBRANTE. Reimprimir con precaución.';
      setVisible(warningMsg, true);
    } else if (data.estatus === '200') {
      warningText.textContent = 'Este lote ya fue impreso anteriormente. Puedes reimprimirlo sin problema.';
      setVisible(warningMsg, true);
      warningMsg.style.background = '#eff6ff'; warningMsg.style.borderColor = '#dbeafe'; warningMsg.style.color = '#1e3a8a';
    } else {
      setVisible(warningMsg, false);
    }

    if (btnActions) {
      btnActions.style.opacity = '1';
      btnActions.style.pointerEvents = 'auto';
    }
  }

  // =========================
  // CARGAR LOTE
  // =========================
  function cargarLote(codigoBusqueda) {
    if (cargando) return;

    const lote = codigoBusqueda || (inputLote ? inputLote.value.trim().toUpperCase() : '');
    if (!lote) { mostrarError('Por favor, ingrese un código de lote o ticket.'); return; }

    cargando = true;
    ocultarMensajes();
    setLoadingBtn(true);

    fetch(`${API_URL}/produccion/publico/${encodeURIComponent(lote)}`)
    .then(function (res) {
      if (!res.ok) {
        if (res.status === 404) throw new Error('El lote no existe en la base de datos. Verifique el código.');
        if (res.status === 401) throw new Error('Sesión expirada. Vuelva a iniciar sesión.');
        throw new Error('Error al consultar el lote.');
      }
      return res.json();
    })
    .then(function (data) {
      var loteData = Array.isArray(data) ? data[0] : data;
      if (!loteData) throw new Error('No se encontraron datos para este lote.');
      
      llenarEtiqueta(loteData);
      agregarAlHistorial(loteData); // Guardar en historial
    })
    .catch(function (error) {
      console.error('Error cargando lote:', error.message);
      mostrarError(error.message);
    })
    .finally(function () {
      cargando = false;
      setLoadingBtn(false);
    });
  }

  // =========================
  // ESCÁNER
  // =========================
  function initEscanerEtiquetas() {
    if (typeof EscanerApp === 'undefined') return;

    EscanerApp.init(
      'reader-container-etiqueta', 'btn-escanear-etiqueta', 'btn-cerrar-camara-etiqueta', 'reader-etiqueta'
    );

    EscanerApp.onScanSuccess(async (codigoEscaneado) => {
      if (inputLote) inputLote.value = codigoEscaneado;
      cargarLote(codigoEscaneado);
    });
  }

  // =========================
  // IMPRIMIR Y MARCAR (1 HOJA A4)
  // =========================
  function imprimirEtiquetaComoImagen() {
    if (!ticketPreview || !ticketContent || ticketContent.style.display === 'none') {
      alert('Primero debe generar una etiqueta válida.');
      return;
    }

    const textoOriginal = btnImprimir.innerHTML;
    btnImprimir.disabled = true;
    btnImprimir.innerHTML = '<i class="ti ti-loader-2" style="display:inline-block;animation:spin 1s linear infinite;"></i> Preparando...';

    html2canvas(ticketPreview, { scale: 3, useCORS: true, backgroundColor: '#ffffff', logging: false })
    .then(function (canvas) {
      const imgData = canvas.toDataURL('image/png');
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute'; iframe.style.width = '0px'; iframe.style.height = '0px'; iframe.style.border = 'none';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow.document;
      doc.open();
      
      doc.write(`
        <html>
          <head>
            <title>Imprimir Etiqueta</title>
            <style>
              @page { size: A4 portrait; margin: 10mm; }
              body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              img { width: 100%; height: auto; display: block; page-break-inside: avoid; }
            </style>
          </head>
          <body>
            <img src="${imgData}" onload="setTimeout(function(){ window.print(); window.frameElement.remove(); }, 200);">
          </body>
        </html>
      `);
      doc.close();

      btnImprimir.innerHTML = textoOriginal;
      btnImprimir.disabled = false;

      // Marcar en el backend y mostrar feedback
      if (loteActual && loteActual.id) {
        marcarLoteComoImpreso(loteActual.id);
      }
    }).catch(function (err) {
      console.error('Error al generar la imagen:', err);
      mostrarToast('Error al preparar la etiqueta.', true);
      btnImprimir.innerHTML = textoOriginal;
      btnImprimir.disabled = false;
    });
  }

  // =========================
  // DESCARGAR JPG
  // =========================
  function descargarJPG() {
    if (!ticketPreview || !ticketContent || ticketContent.style.display === 'none') return;

    const textoOriginal = btnJPG.innerHTML;
    btnJPG.disabled = true;
    btnJPG.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 1s linear infinite;"></i>';

    html2canvas(ticketPreview, { scale: 3, useCORS: true, backgroundColor: '#ffffff', logging: false })
    .then(function (canvas) {
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const enlace = document.createElement('a');
      enlace.href = imgData;
      enlace.download = "etiqueta_" + (loteActual.codigo_lote || "lote") + ".jpg";
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      
      btnJPG.innerHTML = textoOriginal;
      btnJPG.disabled = false;
      mostrarToast('Imagen descargada correctamente.');
    }).catch(function (err) {
      console.error(err);
      mostrarToast('Error al descargar la imagen.', true);
      btnJPG.innerHTML = textoOriginal;
      btnJPG.disabled = false;
    });
  }

  // =========================
  // DESCARGAR PDF
  // =========================
  function descargarPDF() {
    if (!ticketPreview || !ticketContent || ticketContent.style.display === 'none') return;

    const textoOriginal = btnPDF.innerHTML;
    btnPDF.disabled = true;
    btnPDF.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 1s linear infinite;"></i>';

    html2canvas(ticketPreview, { scale: 3, useCORS: true, backgroundColor: '#ffffff', logging: false })
    .then(function (canvas) {
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const { jsPDF } = window.jspdf;
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = pageWidth - 20; // Margen de 10mm a cada lado
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 10, 10, imgWidth, imgHeight);
      pdf.save("etiqueta_" + (loteActual.codigo_lote || "lote") + ".pdf");
      
      btnPDF.innerHTML = textoOriginal;
      btnPDF.disabled = false;
      mostrarToast('PDF descargado correctamente.');
    }).catch(function (err) {
      console.error(err);
      mostrarToast('Error al descargar el PDF.', true);
      btnPDF.innerHTML = textoOriginal;
      btnPDF.disabled = false;
    });
  }

  // =========================
  // ACTUALIZAR ESTATUS
  // =========================
  function marcarLoteComoImpreso(id) {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`${API_URL}/produccion/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ estatus: "200" })
    })
    .then(res => {
      if (res.ok) {
        mostrarToast('Etiqueta impresa y lote marcado como Apto.');
        // Actualizamos el estado en el objeto local y en el historial
        if (loteActual) loteActual.estatus = '200';
      } else {
        mostrarToast('No se pudo actualizar el estatus del lote.', true);
      }
    })
    .catch(err => {
      console.error("Error actualizando estatus:", err);
      mostrarToast('Error de conexión al actualizar estatus.', true);
    });
  }

  // =========================
  // EVENTOS
  // =========================
  if (btnBuscar) btnBuscar.addEventListener('click', () => cargarLote());
  
  if (inputLote) {
    inputLote.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); cargarLote(); }
    });
  }

  if (btnImprimir) btnImprimir.addEventListener('click', imprimirEtiquetaComoImagen);
  if (btnJPG) btnJPG.addEventListener('click', descargarJPG);
  if (btnPDF) btnPDF.addEventListener('click', descargarPDF);

  initEscanerEtiquetas();
});