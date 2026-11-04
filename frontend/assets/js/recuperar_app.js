/* =============================================
   Venvidrio — Recuperar contraseña
   ============================================= */

// ⚠️ Ajusta esta URL según tu entorno
const API_BASE = 'http://localhost:8000';
const RECUPERAR_ENDPOINT = `${API_BASE}/usuarios/recuperar-password`;

const form          = document.getElementById('recuperarForm');
const correoInput   = document.getElementById('correo');
const submitBtn     = document.getElementById('submitBtn');
const errorMessage  = document.getElementById('errorMessage');
const errorText     = document.getElementById('errorText');
const successMessage= document.getElementById('successMessage');
const successText   = document.getElementById('successText');

// ---------- Utilidades de UI ----------
function mostrarError(msg) {
  errorText.textContent = msg;
  errorMessage.classList.add('show');
  successMessage.classList.remove('show');
}

function mostrarExito(msg) {
  successText.textContent = msg;
  successMessage.classList.add('show');
  errorMessage.classList.remove('show');
}

function limpiarMensajes() {
  errorMessage.classList.remove('show');
  successMessage.classList.remove('show');
}

function setLoading(loading) {
  submitBtn.classList.toggle('loading', loading);
  submitBtn.disabled = loading;
}

// ---------- Validación básica en cliente ----------
function esEmailValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

// ---------- Envío del formulario ----------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarMensajes();

  const correo = correoInput.value.trim();

  if (!correo) {
    correoInput.classList.add('error');
    mostrarError('Ingresa tu correo electrónico');
    return;
  }

  if (!esEmailValido(correo)) {
    correoInput.classList.add('error');
    mostrarError('El formato del correo no es válido');
    return;
  }

  correoInput.classList.remove('error');
  setLoading(true);

  try {
    const response = await fetch(RECUPERAR_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo }),
    });

    // El backend responde igual exista o no el correo
    if (response.ok) {
      mostrarExito(
        'Si el correo está registrado, recibirás las instrucciones en unos minutos.'
      );
      form.reset();
    } else {
      let detalle = 'No se pudo procesar la solicitud. Intenta de nuevo.';
      try {
        const data = await response.json();
        if (data?.detail) detalle = data.detail;
      } catch (_) {}
      mostrarError(detalle);
    }
  } catch (err) {
    // Error de red / servidor caído
    mostrarError('No se pudo conectar con el servidor. Verifica tu conexión.');
  } finally {
    setLoading(false);
  }
});

// ---------- Quitar estado de error al escribir ----------
correoInput.addEventListener('input', () => {
  if (correoInput.classList.contains('error')) {
    correoInput.classList.remove('error');
    limpiarMensajes();
  }
});