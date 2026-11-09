/* ==========================================
   ESCANER.JS - Módulo de Escaneo QR/Código de Barras
   (Corregido para html5-qrcode y CSP)
   ========================================== */

const EscanerApp = (function() {
  let html5QrCode = null;
  let callbackExito = null;
  let uiContainer = null;
  let btnEscanear = null;
  let btnCerrar = null;

  function init(containerId, btnId, btnCerrarId, readerDivId) {
    uiContainer = document.getElementById(containerId);
    btnEscanear = document.getElementById(btnId);
    btnCerrar = document.getElementById(btnCerrarId);

    if (!uiContainer || !btnEscanear) {
      console.warn("EscanerApp: Faltan elementos del DOM.");
      return;
    }
    if (!readerDivId) {
      console.warn("EscanerApp: Falta el ID del div de lectura.");
      return;
    }

    btnEscanear.addEventListener('click', async () => {
      // 1. Verificación de contexto seguro (HTTPS o localhost)
      if (!window.isSecureContext) {
        alert("La cámara requiere HTTPS. Revisa la URL.");
        return;
      }

      uiContainer.style.display = 'block';
      btnEscanear.style.display = 'none';

      try {
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

        // 👇 CORRECCIÓN CLAVE: facingMode debe ser un STRING exacto, no un objeto.
        // Si le pasas { ideal: "environment" } o similar, la librería falla.
        await html5QrCode.start(
          { facingMode: "environment" }, 
          config,
          (decodedText) => {
            html5QrCode.stop().then(() => {
              uiContainer.style.display = 'none';
              btnEscanear.style.display = 'flex';
              if (callbackExito) callbackExito(decodedText);
            }).catch(err => console.error("Error al detener:", err));
          },
          (errorMessage) => { /* Ignorar frames sin código */ }
        );
      } catch (err) {
        console.error("Error al iniciar cámara:", err);
        
        // Diagnóstico más claro según el tipo de error
        if (err.name === "NotAllowedError") {
          alert("Permiso denegado. Revisa el CSP o la configuración del sitio.");
        } else if (err.name === "NotFoundError") {
          alert("No se encontró ninguna cámara disponible.");
        } else {
          alert("No se pudo acceder a la cámara: " + err.message);
        }
        
        uiContainer.style.display = 'none';
        btnEscanear.style.display = 'flex';
      }
    });

    if (btnCerrar) {
      btnCerrar.addEventListener('click', () => {
        if (html5QrCode) {
          html5QrCode.stop().then(() => {
            uiContainer.style.display = 'none';
            btnEscanear.style.display = 'flex';
          }).catch(err => console.error("Error al cerrar:", err));
        }
      });
    }
  }

  function onScanSuccess(callback) {
    callbackExito = callback;
  }

  return { init, onScanSuccess };
})();
