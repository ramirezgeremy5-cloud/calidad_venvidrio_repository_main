/* ==========================================
   VENVIDRIO - AUDITORÍA DE PRODUCTO
   auditoria_producto.js
   ========================================= */

(function () {
  'use strict';

  const API_URL = "http://127.0.0.1:8000";

  // Variables de control de sesión
  let temporizadorInactividad = null;
  let TIEMPO_INACTIVIDAD = 5 * 60 * 1000; // 5 minutos
  let tiempoRestante = TIEMPO_INACTIVIDAD / 1000;
  let intervaloContador = null;
  let sesionActiva = true;
  let usuarioLogueado = null;

  /* ==========================================
     UTILIDADES Y LOGS
  ========================================== */

  function log(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    if (data) {
      console.log(`[${timestamp}] 📋 ${message}`, data);
    } else {
      console.log(`[${timestamp}] 📋 ${message}`);
    }
  }

  function logError(message, error = null) {
    const timestamp = new Date().toLocaleTimeString();
    if (error) {
      console.error(`[${timestamp}] ❌ ${message}`, error);
    } else {
      console.error(`[${timestamp}] ❌ ${message}`);
    }
  }

  function logSuccess(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    if (data) {
      console.log(`[${timestamp}] ✅ ${message}`, data);
    } else {
      console.log(`[${timestamp}] ✅ ${message}`);
    }
  }

  /* ==========================================
     CONTROL DE SESIÓN - USUARIO
  ========================================== */

  function cargarUsuarioNav() {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        usuarioLogueado = user;
        const avatar = document.getElementById('navAvatar');
        const username = document.getElementById('navUsername');
        const dropdownAvatar = document.getElementById('dropdownAvatar');
        const dropdownName = document.getElementById('dropdownName');
        const dropdownEmail = document.getElementById('dropdownEmail');

        const iniciales = user.nombre ? user.nombre.substring(0, 2).toUpperCase() : 'US';
        const nombre = user.nombre || 'Usuario';
        const correo = user.correo || 'usuario@email.com';

        if (avatar) avatar.textContent = iniciales;
        if (username) username.textContent = nombre;
        if (dropdownAvatar) dropdownAvatar.textContent = iniciales;
        if (dropdownName) dropdownName.textContent = nombre;
        if (dropdownEmail) dropdownEmail.textContent = correo;

        logSuccess('Usuario cargado en navbar:', nombre);
      } catch (e) {
        logError('Error parseando usuario:', e);
      }
    }
  }

  function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  function verificarSesion() {
    const token = localStorage.getItem('token');
    if (!token) {
      log('❌ No hay token, redirigiendo al login...');
      window.location.href = '../public/login.html';
      return;
    }

    log('🔐 Verificando token...');

    fetch(`${API_URL}/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Token inválido');
      }
      return response.json();
    })
    .then(data => {
      logSuccess('✅ Sesión verificada');
      cargarUsuarioNav();
      iniciarControlInactividad();
      initUserControls();
      init();
    })
    .catch(error => {
      logError('❌ Error verificando sesión:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('role');
      window.location.href = '../public/login.html';
    });
  }

  function iniciarControlInactividad() {
    const eventos = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart', 'touchmove'];
    eventos.forEach(evento => {
      document.addEventListener(evento, function() {
        if (sesionActiva) {
          reiniciarTemporizador();
        }
      });
    });

    reiniciarTemporizador();
    iniciarContador();
  }

  function iniciarContador() {
    if (intervaloContador) {
      clearInterval(intervaloContador);
    }

    tiempoRestante = TIEMPO_INACTIVIDAD / 1000;

    intervaloContador = setInterval(function() {
      tiempoRestante--;
      actualizarTimerDisplay();

      if (tiempoRestante <= 0) {
        clearInterval(intervaloContador);
        intervaloContador = null;
      }
    }, 1000);
  }

  function actualizarTimerDisplay() {
    const timerDisplay = document.getElementById('timerDisplay');
    const timerBadge = document.getElementById('timerBadge');
    
    if (timerDisplay) {
      const minutos = Math.floor(tiempoRestante / 60);
      const segundos = Math.floor(tiempoRestante % 60);
      timerDisplay.textContent = String(minutos).padStart(2, '0') + ':' + String(segundos).padStart(2, '0');
    }

    if (timerBadge) {
      if (tiempoRestante > 120) {
        timerBadge.className = 'badge-timer';
        timerBadge.textContent = 'Activo';
      } else if (tiempoRestante > 60) {
        timerBadge.className = 'badge-timer warning';
        timerBadge.textContent = '⚠️ Cerca de expirar';
      } else {
        timerBadge.className = 'badge-timer danger';
        timerBadge.textContent = '🔴 Expirando';
      }
    }
  }

  function reiniciarTemporizador() {
    if (!sesionActiva) return;

    if (temporizadorInactividad) {
      clearTimeout(temporizadorInactividad);
    }

    tiempoRestante = TIEMPO_INACTIVIDAD / 1000;
    actualizarTimerDisplay();

    temporizadorInactividad = setTimeout(function() {
      cerrarSesion('⏳ Tu sesión ha expirado por inactividad. Por favor, inicia sesión nuevamente.');
    }, TIEMPO_INACTIVIDAD);
  }

  function cerrarSesion(mensaje) {
    sesionActiva = false;

    if (temporizadorInactividad) {
      clearTimeout(temporizadorInactividad);
      temporizadorInactividad = null;
    }

    if (intervaloContador) {
      clearInterval(intervaloContador);
      intervaloContador = null;
    }

    const token = localStorage.getItem('token');

    if (token) {
      fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      .catch(error => {
        console.warn('⚠️ No se pudo comunicar con el backend al cerrar sesión:', error);
      })
      .finally(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        localStorage.removeItem('login_time');

        if (mensaje) {
          alert(mensaje);
        }

        window.location.href = '../public/login.html';
      });
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('role');
      localStorage.removeItem('login_time');

      if (mensaje) {
        alert(mensaje);
      }

      window.location.href = '../public/login.html';
    }
  }

  function logoutManual() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      cerrarSesion('👋 Sesión cerrada exitosamente.');
    }
  }

  function toggleDropdown() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
      dropdown.classList.toggle('show');
    }
  }

  function cerrarDropdown() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
      dropdown.classList.remove('show');
    }
  }

  function initUserControls() {
    const container = document.getElementById('navUserContainer');
    const logoutBtn = document.getElementById('dropdownLogout');

    if (container) {
      container.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleDropdown();
      });
    }

    document.addEventListener('click', function() {
      cerrarDropdown();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        cerrarDropdown();
      }
    });

    if (logoutBtn) {
      logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        logoutManual();
      });
    }

    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        logoutManual();
      }
    });

    log('Controles de usuario inicializados');
  }

  /* ==========================================
     CARGAR LOTES PENDIENTES
  ========================================== */

  async function cargarLotesPendientes() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '../public/login.html';
        return;
      }

      log('Cargando lotes pendientes de auditar...');
      
      const response = await fetch(`${API_URL}/auditoria-producto/lotes-pendientes`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        log('⚠️ Sesión expirada (401), redirigiendo...');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        window.location.href = '../public/login.html';
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        logError(`Error ${response.status}:`, errorText);
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const lotes = await response.json();
      log(`Lotes recibidos: ${lotes.length}`);

      const selectLote = document.getElementById('lote_id');
      if (!selectLote) {
        logError('❌ Selector de lote no encontrado');
        return;
      }

      selectLote.innerHTML = '<option value="">-- Seleccione un lote pendiente --</option>';

      if (!lotes || lotes.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No hay lotes pendientes por auditar';
        option.disabled = true;
        selectLote.appendChild(option);
        log('No hay lotes pendientes.');
        return;
      }

      lotes.forEach(lote => {
        const option = document.createElement('option');
        option.value = lote.id;
        const texto = `${lote.codigo_lote} - ${lote.linea_produccion || 'Sin línea'} - ${lote.item || 'Sin producto'}`;
        option.textContent = texto;
        selectLote.appendChild(option);
      });

      logSuccess(`${lotes.length} lotes pendientes cargados.`);

    } catch (error) {
      logError('Error cargando lotes pendientes:', error);
      const selectLote = document.getElementById('lote_id');
      if (selectLote) {
        selectLote.innerHTML = `<option value="">❌ Error: ${error.message}</option>`;
      }
    }
  }

  /* ==========================================
     AUTOCARGAR DATOS DEL LOTE AL SELECCIONAR
  ========================================== */

  function autocompletarDatosLote() {
    const selectLote = document.getElementById('lote_id');
    const inputMaquina = document.getElementById('maquina');
    const inputEv = document.getElementById('ev');
    const inputItem = document.getElementById('item');

    if (!selectLote) {
      logError('❌ Selector de lote no encontrado para autocompletar');
      return;
    }

    selectLote.addEventListener('change', async function() {
      const loteId = this.value;
      
      if (!loteId) {
        if (inputMaquina) inputMaquina.value = '';
        if (inputEv) inputEv.value = '';
        if (inputItem) inputItem.value = '';
        return;
      }

      try {
        const token = localStorage.getItem('token');
        if (!token) {
          window.location.href = '../public/login.html';
          return;
        }

        const response = await fetch(`${API_URL}/produccion/${loteId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('role');
          window.location.href = '../public/login.html';
          return;
        }

        if (!response.ok) throw new Error('Error al obtener datos del lote');

        const lote = await response.json();
        
        if (inputMaquina) inputMaquina.value = lote.linea_produccion || '';
        if (inputEv) inputEv.value = lote.codigo_lote || '';
        if (inputItem) inputItem.value = lote.item || '';

        log(`Datos del lote ${lote.codigo_lote} cargados.`);

      } catch (error) {
        logError('Error autocompletando datos del lote:', error);
      }
    });
  }

  /* ==========================================
     CARGAR LISTA DE DEFECTOS
  ========================================== */

  async function cargarDefectos() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '../public/login.html';
        return;
      }

      log('Cargando lista de defectos...');
      
      const response = await fetch(`${API_URL}/defectos`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        window.location.href = '../public/login.html';
        return;
      }

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const defectos = await response.json();
      const selectDefectos = document.getElementById('defectos_ids');

      if (!selectDefectos) {
        logError('❌ Selector de defectos no encontrado');
        return;
      }

      selectDefectos.innerHTML = '';

      if (!defectos || defectos.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No hay defectos registrados';
        option.disabled = true;
        selectDefectos.appendChild(option);
        log('No hay defectos registrados.');
        return;
      }

      defectos.forEach(def => {
        const option = document.createElement('option');
        option.value = def.id;
        const nombreDefecto = def.nombre || def.descripcion || 'Defecto';
        option.textContent = nombreDefecto;
        selectDefectos.appendChild(option);
      });

      logSuccess(`${defectos.length} defectos cargados.`);

    } catch (error) {
      logError('Error cargando defectos:', error);
      const selectDefectos = document.getElementById('defectos_ids');
      if (selectDefectos) {
        selectDefectos.innerHTML = `<option value="">❌ Error: ${error.message}</option>`;
      }
    }
  }

  /* ==========================================
     GUARDAR AUDITORÍA
  ========================================== */

  const btnRegistrar = document.getElementById('btn-registrar');

  if (btnRegistrar) {
    btnRegistrar.addEventListener('click', async function(e) {
      e.preventDefault();
      
      const loteId = document.getElementById('lote_id').value;
      const fecha = document.getElementById('fecha_auditoria').value;
      const inspeccionadas = document.getElementById('paletas_inspeccionadas').value;
      const aprobadas = document.getElementById('paletas_aprobadas').value;
      const rechazadas = document.getElementById('paletas_rechazadas').value;
      const observaciones = document.getElementById('observaciones').value || null;

      const selectDefectos = document.getElementById('defectos_ids');
      const defectosSeleccionados = selectDefectos ? 
        Array.from(selectDefectos.selectedOptions).map(opt => parseInt(opt.value)) : [];

      if (!loteId || !fecha || !inspeccionadas || !aprobadas || !rechazadas) {
        alert('Completa todos los campos obligatorios: Lote, Fecha, Paletas Inspeccionadas, Aprobadas y Rechazadas.');
        return;
      }

      const body = {
        produccion_id: parseInt(loteId),
        fecha_auditoria: fecha,
        paletas_inspeccionadas: parseInt(inspeccionadas),
        paletas_aprobadas: parseInt(aprobadas),
        paletas_rechazadas: parseInt(rechazadas),
        observaciones: observaciones,
        defectos_ids: defectosSeleccionados
      };

      try {
        const token = localStorage.getItem('token');
        if (!token) {
          window.location.href = '../public/login.html';
          return;
        }

        const response = await fetch(`${API_URL}/auditoria-producto`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('role');
          window.location.href = '../public/login.html';
          return;
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Error guardando la auditoría');
        }

        const toast = document.getElementById('toast-auditoria');
        if (toast) {
          toast.classList.add('show');
          setTimeout(() => {
            toast.classList.remove('show');
          }, 3000);
        }

        logSuccess('Auditoría guardada correctamente');
        await cargarLotesPendientes();
        
        const btnLimpiar = document.getElementById('btn-limpiar');
        if (btnLimpiar) btnLimpiar.click();

      } catch (error) {
        logError('Error guardando auditoría:', error);
        alert(error.message || 'No se pudo guardar la auditoría');
      }
    });
  }

  /* ==========================================
     LIMPIAR FORMULARIO
  ========================================== */

  const btnLimpiar = document.getElementById('btn-limpiar');

  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', function() {
      const loteSelect = document.getElementById('lote_id');
      if (loteSelect) loteSelect.value = '';
      
      const maquina = document.getElementById('maquina');
      if (maquina) maquina.value = '';
      
      const ev = document.getElementById('ev');
      if (ev) ev.value = '';
      
      const item = document.getElementById('item');
      if (item) item.value = '';
      
      const fecha = document.getElementById('fecha_auditoria');
      if (fecha) fecha.value = '';
      
      const inspeccionadas = document.getElementById('paletas_inspeccionadas');
      if (inspeccionadas) inspeccionadas.value = '';
      
      const aprobadas = document.getElementById('paletas_aprobadas');
      if (aprobadas) aprobadas.value = '';
      
      const rechazadas = document.getElementById('paletas_rechazadas');
      if (rechazadas) rechazadas.value = '';
      
      const observaciones = document.getElementById('observaciones');
      if (observaciones) observaciones.value = '';
      
      const selectDefectos = document.getElementById('defectos_ids');
      if (selectDefectos) {
        Array.from(selectDefectos.options).forEach(opt => opt.selected = false);
      }
    });
  }

  /* ==========================================
     INICIALIZACIÓN
  ========================================== */

  function init() {
    log('🚀 Iniciando módulo de Auditoría de Producto...');
    
    const fechaInput = document.getElementById('fecha_auditoria');
    if (fechaInput) {
      fechaInput.value = new Date().toISOString().split('T')[0];
    }

    cargarLotesPendientes();
    cargarDefectos();
    autocompletarDatosLote();

    log('✅ Auditoría de Producto iniciada correctamente.');
  }

  // ==========================================
  // INICIO - Verificar sesión
  // ==========================================

  log('🔐 Verificando sesión...');
  verificarSesion();

})();