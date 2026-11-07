/* ==========================================
   ESCANER.JS - Módulo de Escaneo QR/Código de Barras
   (Reutilizable para Producción, Defectos, etc.)
   ========================================== */

const EscanerApp = (function() {
  let html5QrCode = null;
  let callbackExito = null;
  let uiContainer = null;
  let btnEscanear = null;
  let btnCerrar = null;

  /**
   * Inicializa el escáner en los elementos del DOM indicados.
   * @param {string} containerId - ID del div que contiene la cámara (ej. "reader-container-global").
   * @param {string} btnId - ID del botón que abre la cámara (ej. "btn-escanear-global").
   * @param {string} btnCerrarId - ID del botón para cerrar la cámara (ej. "btn-cerrar-camara-global").
   * @param {string} readerDivId - ID del div interno donde se renderiza el video (ej. "reader-global").
   */
  function init(containerId, btnId, btnCerrarId, readerDivId = "reader-global") {
    uiContainer = document.getElementById(containerId);
    btnEscanear = document.getElementById(btnId);
    btnCerrar = document.getElementById(btnCerrarId);

    if (!btnEscanear || !uiContainer) return;

    btnEscanear.addEventListener('click', () => {
      uiContainer.style.display = 'block';
      btnEscanear.style.display = 'none';

      // Usamos el ID dinámico para crear la instancia de la cámara
      html5QrCode = new Html5Qrcode(readerDivId);
      
      const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        formatsToSupport: [ 
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39
        ]
      };

      html5QrCode.start(
        { facingMode: "environment" }, 
        config,
        (decodedText) => {
          html5QrCode.stop().then(() => {
            uiContainer.style.display = 'none';
            btnEscanear.style.display = 'flex';
            
            // Si hay una función de callback registrada, la ejecutamos
            if (callbackExito) callbackExito(decodedText);
          }).catch(err => console.error("Error al detener cámara:", err));
        },
        (errorMessage) => { /* Ignorar frames que no tienen código */ }
      ).catch(err => {
        console.error("Error al iniciar cámara:", err);
        alert("No se pudo acceder a la cámara. Verifica los permisos.");
        uiContainer.style.display = 'none';
        btnEscanear.style.display = 'flex';
      });
    });

    if (btnCerrar) {
      btnCerrar.addEventListener('click', () => {
        if (html5QrCode) {
          html5QrCode.stop().then(() => {
            uiContainer.style.display = 'none';
            btnEscanear.style.display = 'flex';
          });
        }
      });
    }
  }

  /**
   * Registra la función que se ejecutará cuando se lea un código con éxito.
   * @param {function} callback - Función que recibe el texto decodificado.
   */
  function onScanSuccess(callback) {
    callbackExito = callback;
  }

  return { init, onScanSuccess };
})();