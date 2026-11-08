/* ==========================================
   VENVIDRIO - ETIQUETAS Y TRAZABILIDAD
   etiquetas.js — v8 (Impresión al 100% de la hoja)
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
  const btnActions    = document.getElementById('btn-actions');
  const errorMsg      = document.getElementById('error-lote');
  const ticketEmpty   = document.getElementById('ticket-empty');
  const ticketContent = document.getElementById('ticket-content');
  const ticketPreview = document.getElementById('ticket-preview');
  const barcodeSvg    = document.getElementById('barcode');

  // Referencias al escáner
  const btnEscanear   = document.getElementById('btn-escanear-etiqueta');
  const readerContainer = document.getElementById('reader-container-etiqueta');
  const readerDiv     = document.getElementById('reader-etiqueta');
  const btnCerrarCamara = document.getElementById('btn-cerrar-camara-etiqueta');

  let cargando = false;
  let loteActual = null; // Guardamos el lote cargado para actualizar su estatus

  // =========================
  // UTILIDADES
  // =========================

  if (!document.getElementById('spin-keyframes')) {
    const st = document.createElement('style');
    st.id = 'spin-keyframes';
    st.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
    document.head.appendChild(st);
  }

  function formatearFecha(fechaStr) {
    if (!fechaStr) return '--/--/----';
    const soloFecha = fechaStr.split('T')[0];
    const partes = soloFecha.split('-');
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
    setVisible(ticketEmpty, true, 'flex');
    setVisible(ticketContent, false);
    limpiarBarcode();
    if (btnActions) { btnActions.style.opacity = '0'; btnActions.style.pointerEvents = 'none'; }
    if (inputLote) { inputLote.focus(); inputLote.select(); }
  }

  function ocultarError() {
    setVisible(errorMsg, false);
  }

  // =========================
  // RELLENAR ETIQUETA
  // =========================
  function llenarEtiqueta(data) {
    ocultarError();
    loteActual = data; // Guardamos los datos del lote

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
    if (typeof bppText === 'number') {
      bppText = bppText.toLocaleString('es-VE');
    }
    setVal('tk-bpp',   bppText, '---');
    setVal('tk-cap',   data.capacidad, '---');
    setVal('tk-molde', data.molde, '---');
    setVal('tk-lote',  data.codigo_lote, '---');

    // Código de barras
    const barcodeText = data.ticket_carga || data.ticket || data.codigo_lote;
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
  function cargarLote(codigoBusqueda) {
    if (cargando) return;

    const lote = codigoBusqueda || (inputLote ? inputLote.value.trim().toUpperCase() : '');

    if (!lote) {
      mostrarError('Por favor, ingrese un código de lote o ticket.');
      return;
    }

    cargando = true;
    ocultarError();
    setLoadingBtn(true);

    // Usamos el endpoint público que busca por código de lote o ticket
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
  // ESCÁNER (CONEXIÓN CON EL MÓDULO GLOBAL)
  // =========================
  function initEscanerEtiquetas() {
    if (typeof EscanerApp === 'undefined') {
      console.warn('La librería EscanerApp no está cargada. El botón de escanear no funcionará.');
      return;
    }

    EscanerApp.init(
      'reader-container-etiqueta', 
      'btn-escanear-etiqueta', 
      'btn-cerrar-camara-etiqueta', 
      'reader-etiqueta'
    );

    EscanerApp.onScanSuccess(async (codigoEscaneado) => {
      if (inputLote) inputLote.value = codigoEscaneado;
      cargarLote(codigoEscaneado); // Cargamos el lote automáticamente
    });
  }

  // =========================
  // IMPRIMIR COMO IMAGEN EXACTA Y MARCAR LOTE (OCUPANDO TODA LA HOJA)
  // =========================
  function imprimirEtiquetaComoImagen() {
    if (!ticketPreview || !ticketContent || ticketContent.style.display === 'none') {
      alert('Primero debe generar una etiqueta válida.');
      return;
    }

    const textoOriginal = btnImprimir.innerHTML;
    btnImprimir.disabled = true;
    btnImprimir.innerHTML = '<i class="ti ti-loader-2" style="display:inline-block;animation:spin 1s linear infinite;"></i> Preparando...';

    html2canvas(ticketPreview, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    }).then(function (canvas) {
      const imgData = canvas.toDataURL('image/png');

      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      
      // 👇 AQUÍ ESTÁ EL CAMBIO CLAVE: 
      // El @page ahora es A4 con margen 0, y la imagen ocupa el 100% del ancho
      doc.write(`
        <html>
          <head>
            <title>Imprimir Etiqueta</title>
            <style>
              @page {
                size: A4 portrait; /* Tamaño estándar de hoja */
                margin: 0;          /* Elimina los márgenes blancos */
              }
              body {
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: flex-start;
                background: #fff;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              img {
                width: 100%;       /* Ocupa todo el ancho de la hoja */
                height: auto;      /* Mantiene la proporción */
                object-fit: contain; 
                border: none;      /* Quitamos el borde extra del iframe */
                box-sizing: border-box;
                margin-top: 10mm;  /* Un pequeño margen superior para que no se corte */
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

      // ==========================================
      // ACTUALIZAR ESTATUS DEL LOTE (Marcar como Impreso/Apto)
      // ==========================================
      if (loteActual && loteActual.id) {
        marcarLoteComoImpreso(loteActual.id);
      }
      
    }).catch(function (err) {
      console.error('Error al generar la imagen de la etiqueta:', err);
      alert('Hubo un error al preparar la etiqueta para imprimir.');
      btnImprimir.innerHTML = textoOriginal;
      btnImprimir.disabled = false;
    });
  }

  // Función para enviar la actualización al backend
  function marcarLoteComoImpreso(id) {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`${API_URL}/produccion/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ estatus: "200" })
    })
    .then(res => {
      if (res.ok) {
        console.log(`✅ Lote ${id} marcado como IMPRESO (Estatus 200).`);
      } else {
        console.warn("No se pudo actualizar el estatus del lote.");
      }
    })
    .catch(err => console.error("Error actualizando estatus:", err));
  }

  // =========================
  // EVENTOS
  // =========================
  if (btnBuscar) btnBuscar.addEventListener('click', () => cargarLote());
  
  if (inputLote) {
    inputLote.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        cargarLote();
      }
    });
  }

  if (btnImprimir) btnImprimir.addEventListener('click', imprimirEtiquetaComoImagen);

  // Inicializamos el escáner
  initEscanerEtiquetas();
});