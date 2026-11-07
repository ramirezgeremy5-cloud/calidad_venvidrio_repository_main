/* ==========================================
   VENVIDRIO - ETIQUETAS Y TRAZABILIDAD
   etiquetas.js — v6 (Conexión Real + Sin Simulación)
   ========================================== */

document.addEventListener('DOMContentLoaded', function () {

  // Detectar la URL de la API correctamente (igual que en produccion.js)
  const hostname = window.location.hostname;
  let API_URL;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    API_URL = 'http://127.0.0.1:8000';
  } else {
    API_URL = 'https://calidad-venvidrio-repository-main.onrender.com';
  }

  // Referencias al DOM
  var btnBuscar     = document.getElementById('btn-buscar-lote');
  var inputLote     = document.getElementById('buscar-lote');
  var btnImprimir   = document.getElementById('btn-imprimir');
  var btnActions    = document.getElementById('btn-actions');
  var errorMsg      = document.getElementById('error-lote');
  var ticketEmpty   = document.getElementById('ticket-empty');
  var ticketContent = document.getElementById('ticket-content');
  var ticketPreview = document.getElementById('ticket-preview');
  var barcodeSvg    = document.getElementById('barcode');

  // Bandera anti doble clic
  var cargando = false;

  // =========================
  // UTILIDADES
  // =========================

  if (!document.getElementById('spin-keyframes')) {
    var st = document.createElement('style');
    st.id = 'spin-keyframes';
    st.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
    document.head.appendChild(st);
  }

  function formatearFecha(fechaStr) {
    if (!fechaStr) return '--/--/----';
    var soloFecha = fechaStr.split('T')[0];
    var partes = soloFecha.split('-');
    if (partes.length === 3) {
      return partes[2] + '/' + partes[1] + '/' + partes[0];
    }
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
      btnBuscar.setAttribute('aria-busy', 'true');
      btnBuscar.innerHTML = '<i class="ti ti-loader-2" style="display:inline-block;animation:spin 1s linear infinite;"></i> Cargando...';
    } else {
      btnBuscar.disabled = false;
      btnBuscar.removeAttribute('aria-busy');
      btnBuscar.innerHTML = '<i class="ti ti-search"></i> Cargar';
    }
  }

  // =========================
  // MOSTRAR / OCULTAR ERROR
  // =========================
  function mostrarError(mensaje) {
    if (!mensaje) mensaje = "Lote no encontrado.";
    if (errorMsg) {
      errorMsg.innerHTML = '<i class="ti ti-alert-circle"></i> ' + mensaje;
      setVisible(errorMsg, true);
    }

    setVisible(ticketEmpty, true, 'flex');
    setVisible(ticketContent, false);
    limpiarBarcode();

    if (btnActions) {
      btnActions.style.opacity = '0';
      btnActions.style.pointerEvents = 'none';
    }

    if (inputLote) {
      inputLote.focus();
      inputLote.select();
    }
  }

  function ocultarError() {
    setVisible(errorMsg, false);
  }

  // =========================
  // RELLENAR ETIQUETA
  // =========================
  function llenarEtiqueta(data) {
    ocultarError();

    setVisible(ticketEmpty, false);
    setVisible(ticketContent, true, 'flex');

    function setVal(id, val, defaultVal) {
      var el = document.getElementById(id);
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

    var bppText = data.bpp;
    if (typeof bppText === 'number') {
      bppText = bppText.toLocaleString('es-VE');
    }
    setVal('tk-bpp',   bppText, '---');
    setVal('tk-cap',   data.capacidad, '---');
    setVal('tk-molde', data.molde, '---');
    setVal('tk-lote',  data.codigo_lote, '---');

    // Código de barras
    var barcodeText = data.ticket_carga || data.ticket || data.codigo_lote;
    setVal('tk-barcode-text', barcodeText, '---');

    limpiarBarcode();

    if (barcodeText && typeof JsBarcode !== 'undefined') {
      try {
        JsBarcode('#barcode', barcodeText, {
          format: 'CODE128',
          lineColor: '#000000',
          width: 2,
          height: 60,
          displayValue: false,
          margin: 0,
          background: 'transparent'
        });
      } catch (err) {
        console.error('Error generando código de barras:', err);
      }
    }

    if (btnActions) {
      btnActions.style.opacity = '1';
      btnActions.style.pointerEvents = 'auto';
    }
  }

  // =========================
  // CARGAR LOTE (CONEXIÓN REAL)
  // =========================
  function cargarLote() {
    if (cargando) return;

    var lote = inputLote ? inputLote.value.trim().toUpperCase() : '';

    if (!lote) {
      mostrarError('Por favor, ingrese un código de lote.');
      return;
    }

    cargando = true;
    ocultarError();
    setLoadingBtn(true);

    var token = localStorage.getItem('token');

    // Hacemos la petición al endpoint de etiquetas
    fetch(API_URL + '/produccion/lote/' + lote, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    })
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
    })
    .catch(function (error) {
      // SI HAY ERROR, MOSTRAMOS EL MENSAJE REAL (Ya no hay simulación falsa)
      console.error('Error cargando lote:', error.message);
      mostrarError(error.message);
    })
    .finally(function () {
      cargando = false;
      setLoadingBtn(false);
    });
  }

  // =========================
  // IMPRIMIR COMO IMAGEN EXACTA
  // =========================
  function imprimirEtiquetaComoImagen() {
    if (!ticketPreview || !ticketContent || ticketContent.style.display === 'none') {
      alert('Primero debe generar una etiqueta válida.');
      return;
    }

    var textoOriginal = btnImprimir.innerHTML;
    btnImprimir.disabled = true;
    btnImprimir.innerHTML = '<i class="ti ti-loader-2" style="display:inline-block;animation:spin 1s linear infinite;"></i> Preparando...';

    html2canvas(ticketPreview, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    }).then(function (canvas) {
      var imgData = canvas.toDataURL('image/png');

      var iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      var doc = iframe.contentWindow.document;
      doc.open();
      
      doc.write(`
        <html>
          <head>
            <title>Imprimir Etiqueta</title>
            <style>
              @page {
                size: 100mm 150mm;
                margin: 0; 
              }
              body {
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                background: #fff;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              img {
                width: 100%;
                height: 100%;
                object-fit: fill;
                border: 2px solid #000;
                box-sizing: border-box;
              }
            </style>
          </head>
          <body>
            <img src="${imgData}" onload="setTimeout(function(){ window.print(); window.frameElement.remove(); }, 100);">
          </body>
        </html>
      `);
      doc.close();

      btnImprimir.innerHTML = textoOriginal;
      btnImprimir.disabled = false;
      
    }).catch(function (err) {
      console.error('Error al generar la imagen de la etiqueta:', err);
      alert('Hubo un error al preparar la etiqueta para imprimir.');
      btnImprimir.innerHTML = textoOriginal;
      btnImprimir.disabled = false;
    });
  }

  // =========================
  // EVENTOS
  // =========================
  if (btnBuscar) {
    btnBuscar.addEventListener('click', cargarLote);
  }

  if (inputLote) {
    inputLote.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        cargarLote();
      }
    });
  }

  if (btnImprimir) {
    btnImprimir.addEventListener('click', imprimirEtiquetaComoImagen);
  }

});