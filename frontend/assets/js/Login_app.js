/* =============================================
   Venvidrio — Sistema de Control de Calidad
   login_app.js (Solo lógica de Login)
   ============================================= */

(function () {
  'use strict';

  // =========================
  // CONFIGURACIÓN
  // =========================
  var API_URL = 'http://localhost:8000';

  // =========================
  // REFERENCIAS AL DOM
  // =========================
  var usernameInput  = document.getElementById('username');
  var passwordInput  = document.getElementById('password');
  var pwToggleBtn    = document.getElementById('pwToggle');
  var pwIcon         = document.getElementById('pwIcon');
  var submitBtn      = document.getElementById('submitBtn');
  var successOverlay = document.getElementById('successOverlay');

  // =========================
  // VERIFICAR ELEMENTOS
  // =========================
  if (!usernameInput || !passwordInput || !submitBtn) {
    console.error('❌ Elementos del login no encontrados.');
    return;
  }

  // =========================
  // TOGGLE MOSTRAR / OCULTAR CONTRASEÑA
  // =========================
  if (pwToggleBtn) {
    pwToggleBtn.addEventListener('click', function() {
      var isHidden = passwordInput.type === 'password';
      passwordInput.type = isHidden ? 'text' : 'password';
      pwIcon.className = isHidden ? 'ti ti-eye-off' : 'ti ti-eye';
    });
  }

  // =========================
  // LIMPIEZA DE ERROR AL ESCRIBIR
  // =========================
  if (usernameInput) {
    usernameInput.addEventListener('input', function() {
      usernameInput.classList.remove('error');
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener('input', function() {
      passwordInput.classList.remove('error');
    });
  }

  // =========================
  // VALIDACIÓN BÁSICA
  // =========================
  function validate() {
    var valid = true;

    if (usernameInput) {
      usernameInput.classList.remove('error');
      if (!usernameInput.value.trim()) {
        usernameInput.classList.add('error');
        valid = false;
      }
    }

    if (passwordInput) {
      passwordInput.classList.remove('error');
      if (!passwordInput.value.trim()) {
        passwordInput.classList.add('error');
        valid = false;
      }
    }

    return valid;
  }

  // =========================
  // MOSTRAR ESTADO DE CARGA
  // =========================
  function setLoading(state) {
    if (state) {
      submitBtn.classList.add('loading');
      submitBtn.disabled = true;
    } else {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  }

  // =========================
  // MOSTRAR OVERLAY DE ÉXITO
  // =========================
  function showSuccess(duration) {
    duration = duration || 2800;
    if (successOverlay) {
      successOverlay.classList.add('show');
      setTimeout(function() {
        successOverlay.classList.remove('show');
      }, duration);
    }
  }

  // =========================
  // MOSTRAR ERROR
  // =========================
  function showError(message) {
    submitBtn.classList.add('error');
    setTimeout(function() {
      submitBtn.classList.remove('error');
    }, 1000);
    alert(message || 'Error al iniciar sesión');
  }

  // =========================
  // LOGIN - CONEXIÓN REAL AL BACKEND
  // =========================
  function handleLogin() {
    if (!validate()) {
      if (usernameInput && usernameInput.classList.contains('error')) {
        usernameInput.focus();
      } else if (passwordInput && passwordInput.classList.contains('error')) {
        passwordInput.focus();
      }
      return;
    }

    var correo = usernameInput.value.trim();
    var password = passwordInput.value.trim();

    var emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(correo)) {
      if (usernameInput) usernameInput.classList.add('error');
      alert('Por favor ingresa un correo electrónico válido');
      if (usernameInput) usernameInput.focus();
      return;
    }

    if (password.length < 1) {
      if (passwordInput) passwordInput.classList.add('error');
      alert('Por favor ingresa tu contraseña');
      if (passwordInput) passwordInput.focus();
      return;
    }

    setLoading(true);

    // ==========================================================
    // PETICIÓN AL BACKEND (El backend valida si el usuario ya está activo)
    // ==========================================================
    fetch(API_URL + '/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        correo: correo,
        password: password
      })
    })
    .then(function(response) {
      return response.json().then(function(data) {
        return { status: response.status, data: data };
      });
    })
    .then(function(result) {
      var status = result.status;
      var data = result.data;
      setLoading(false);

      // ✅ LOGIN EXITOSO
      if (status === 200 || status === 201) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('role', data.role);
        localStorage.setItem('login_time', Date.now());

        showSuccess(2500);
        setTimeout(function() {
          window.location.href = 'dashboard.html';
        }, 2500);
        return;
      }

      // ❌ ERRORES DEL BACKEND
      var errorMsg = data.detail || 'Credenciales incorrectas';

      // CAPTURAMOS EL MENSAJE DE "USUARIO ACTIVO" QUE ENVÍA EL BACKEND
      if (status === 403) {
        if (errorMsg.toLowerCase().indexOf('activo') !== -1 || 
            errorMsg.toLowerCase().indexOf('sesión') !== -1) {
          errorMsg = '⚠️ Este usuario ya se encuentra activo en otra sesión.\n\nPara acceder, cierra la sesión en el otro dispositivo o espera a que expire.';
        } else if (errorMsg.toLowerCase().indexOf('bloqueado') !== -1) {
          errorMsg = '🔒 Usuario bloqueado. ' + errorMsg;
        } else if (errorMsg.toLowerCase().indexOf('desactivado') !== -1) {
          errorMsg = '⚠️ Usuario desactivado. Contacte al administrador.';
        }
      } else if (status === 429) {
        errorMsg = '⏳ Demasiados intentos. Intente más tarde.';
      }

      showError(errorMsg);
      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.focus();
      }
    })
    .catch(function(error) {
      setLoading(false);
      console.error('Error de conexión:', error);

      var errorMsg = 'Error de conexión con el servidor. ';
      if (!navigator.onLine) {
        errorMsg += 'Verifica tu conexión a internet.';
      } else {
        errorMsg += 'Asegúrate de que el backend esté corriendo en ' + API_URL;
      }

      showError(errorMsg);
    });
  }

  // =========================
  // EVENTO DEL BOTÓN
  // =========================
  submitBtn.addEventListener('click', function(e) {
    e.preventDefault();
    handleLogin();
  });

  // =========================
  // PERMITIR ENVÍO CON ENTER
  // =========================
  if (usernameInput) {
    usernameInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleLogin();
      }
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleLogin();
      }
    });
  }

  // =========================
  // INICIALIZACIÓN
  // =========================
  console.log('🔐 Venvidrio - Login App inicializada (Solo Login)');
  console.log('📡 API URL:', API_URL);

})();