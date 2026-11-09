/* =============================================
   Venvidrio — Sistema de Control de Calidad
   login_app.js (Multisesión + CAPTCHA + Alertas)
   ============================================= */

(function () {
  'use strict';

  // =========================
  // CONFIGURACIÓN DINÁMICA DE API
  // =========================
  var hostname = window.location.hostname;
  var API_URL = (hostname === 'localhost' || hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000'
    : 'https://calidad-venvidrio-repository-main.onrender.com';

  // 👇 SESIÓN: 1 HORA DE INACTIVIDAD
  var TIEMPO_ALERTA_MS       = 55 * 60 * 1000; 
  var TIEMPO_INACTIVIDAD_MS  = 60 * 60 * 1000; 
  var INTERVALO_HEARTBEAT_MS = 60000;          
  var INTERVALO_CHEQUEO_MS   = 5000;           

  var heartbeatInterval = null;
  var inactivityInterval = null;
  var alertaMostrada = false;

  // =========================
  // 0. SISTEMA DE ALERTAS PERSONALIZADAS (MODALES)
  // =========================
  function inyectarSistemaDeAlertas() {
    if (document.getElementById('sys-alertas-styles')) return;

    var style = document.createElement('style');
    style.id = 'sys-alertas-styles';
    style.textContent = `
      .sys-modal-overlay {
        position: fixed; inset: 0;
        background: rgba(15, 23, 42, 0.55);
        backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        z-index: 999999; padding: 20px;
        opacity: 0; transition: opacity 0.25s ease;
      }
      .sys-modal-overlay.show { opacity: 1; }
      .sys-modal-box {
        background: #fff; width: 100%; max-width: 420px;
        border-radius: 16px; overflow: hidden;
        box-shadow: 0 25px 60px -12px rgba(15, 23, 42, 0.4);
        transform: translateY(20px) scale(0.96); opacity: 0;
        transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease;
      }
      .sys-modal-overlay.show .sys-modal-box { transform: translateY(0) scale(1); opacity: 1; }
      .sys-modal-header {
        display: flex; align-items: center; gap: 12px;
        padding: 18px 20px; color: #fff; font-weight: 700; font-size: 15px;
      }
      .sys-modal-header i { font-size: 22px; }
      .sys-modal-header.info    { background: linear-gradient(135deg, #1e3a8a, #3b82f6); }
      .sys-modal-header.success { background: linear-gradient(135deg, #15803d, #22c55e); }
      .sys-modal-header.warning { background: linear-gradient(135deg, #b45309, #f59e0b); }
      .sys-modal-header.error   { background: linear-gradient(135deg, #b91c1c, #ef4444); }
      .sys-modal-body {
        padding: 22px 20px; color: #334155; font-size: 14px; line-height: 1.55; text-align: center;
      }
      .sys-modal-body strong { color: #0f172a; }
      .sys-modal-footer {
        display: flex; gap: 10px; padding: 0 20px 20px; justify-content: center;
      }
      .sys-modal-btn {
        padding: 10px 22px; border-radius: 8px; font-weight: 600; font-size: 14px;
        cursor: pointer; border: none; transition: all 0.2s ease; flex: 1;
      }
      .sys-modal-btn:hover { transform: translateY(-1px); }
      .sys-modal-btn:active { transform: scale(0.97); }
      .sys-modal-btn-primary { background: #1e3a8a; color: #fff; box-shadow: 0 4px 12px rgba(30, 58, 138, 0.3); }
      .sys-modal-btn-primary:hover { background: #1e40af; }
      .sys-modal-btn-outline { background: #fff; border: 1.5px solid #e2e8f0; color: #475569; }
      .sys-modal-btn-outline:hover { background: #f8fafc; }
      .sys-modal-warning-text {
        margin-top: 12px; padding: 10px; background: #fffbeb;
        border: 1px solid #fde68a; border-radius: 8px; color: #92400e; font-size: 13px;
      }
    `;
    document.head.appendChild(style);

    if (!document.getElementById('sys-alertas-container')) {
      var cont = document.createElement('div');
      cont.id = 'sys-alertas-container';
      document.body.appendChild(cont);
    }
  }

  window.mostrarAlertaPersonalizada = function (mensaje, tipo, esConfirmacion, textoAdicional) {
    return new Promise(function (resolve) {
      inyectarSistemaDeAlertas();

      var container = document.getElementById('sys-alertas-container');
      var overlay = document.createElement('div');
      overlay.className = 'sys-modal-overlay';

      var iconos = { info: 'ti-info-circle', success: 'ti-circle-check', warning: 'ti-alert-triangle', error: 'ti-alert-circle' };
      var titulos = { info: 'Información', success: 'Éxito', warning: 'Advertencia', error: 'Error' };

      var icono = iconos[tipo] || iconos.info;
      var titulo = titulos[tipo] || titulos.info;

      overlay.innerHTML = `
        <div class="sys-modal-box">
          <div class="sys-modal-header ${tipo}">
            <i class="ti ${icono}"></i>
            <span>${titulo}</span>
          </div>
          <div class="sys-modal-body">
            <p>${mensaje}</p>
            ${textoAdicional ? '<div class="sys-modal-warning-text">' + textoAdicional + '</div>' : ''}
          </div>
          <div class="sys-modal-footer" id="sys-modal-actions"></div>
        </div>
      `;

      var actions = overlay.querySelector('#sys-modal-actions');

      function cerrar(resultado) {
        overlay.classList.remove('show');
        setTimeout(function () {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          resolve(resultado);
        }, 250);
      }

      if (esConfirmacion) {
        var btnNo = document.createElement('button');
        btnNo.className = 'sys-modal-btn sys-modal-btn-outline';
        btnNo.textContent = 'Cancelar';
        btnNo.addEventListener('click', function () { cerrar(false); });

        var btnSi = document.createElement('button');
        btnSi.className = 'sys-modal-btn sys-modal-btn-primary';
        btnSi.textContent = 'Aceptar';
        btnSi.addEventListener('click', function () { cerrar(true); });

        actions.appendChild(btnNo);
        actions.appendChild(btnSi);
      } else {
        var btnOk = document.createElement('button');
        btnOk.className = 'sys-modal-btn sys-modal-btn-primary';
        btnOk.textContent = 'Entendido';
        btnOk.addEventListener('click', function () { cerrar(true); });
        actions.appendChild(btnOk);
      }

      container.appendChild(overlay);
      void overlay.offsetWidth;
      overlay.classList.add('show');
    });
  };

  // =========================
  // 1. REFERENCIAS AL DOM (LOGIN)
  // =========================
  var usernameInput   = document.getElementById('username-prefix');
  var passwordInput   = document.getElementById('password');
  var pwToggleBtn     = document.getElementById('pwToggle');
  var pwIcon          = document.getElementById('pwIcon');
  var submitBtn       = document.getElementById('submitBtn');
  var successOverlay  = document.getElementById('successOverlay');
  var errorMessage    = document.getElementById('errorMessage');
  var errorText       = document.getElementById('errorText');
  var logoArea        = document.getElementById('logoArea');
  var capsLockWarning = document.getElementById('capsLockWarning');
  var rememberMe      = document.getElementById('rememberMe');

  var esPaginaLogin = !!(usernameInput && passwordInput && submitBtn);

  // =========================
  // 2. FUNCIÓN: Normaliza la URL de la foto
  // =========================
  function obtenerUrlFoto(fotoUrl) {
    if (!fotoUrl) return null;
    let urlLimpia = fotoUrl.replace(/^(https?)\/\//, '$1://');
    if (urlLimpia.startsWith('http://') || urlLimpia.startsWith('https://')) {
      return urlLimpia;
    }
    return `${API_URL}${urlLimpia}`;
  }

  // =========================
  // 3. ACTUALIZAR NAVBAR
  // =========================
  function actualizarNavbar() {
    var data = localStorage.getItem('user');
    if (!data) return;

    try {
      var u = JSON.parse(data);

      function pintarAvatar(usuario) {
        var navAvatar = document.getElementById('navAvatar');
        var dropdownAvatar = document.getElementById('dropdownAvatar');

        var avatarHtml = usuario.foto_url
          ? '<img src="' + obtenerUrlFoto(usuario.foto_url) + '?t=' + Date.now() + '" alt="" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">'
          : (usuario.nombre ? usuario.nombre.substring(0, 2).toUpperCase() : 'US');

        if (navAvatar) navAvatar.innerHTML = avatarHtml;
        if (dropdownAvatar) dropdownAvatar.innerHTML = avatarHtml;
      }

      if (document.getElementById('navUsername'))
        document.getElementById('navUsername').textContent = u.nombre || 'Usuario';
      if (document.getElementById('dropdownName'))
        document.getElementById('dropdownName').textContent = u.nombre || 'Usuario';
      if (document.getElementById('dropdownEmail'))
        document.getElementById('dropdownEmail').textContent = u.correo || 'usuario@venvidrio.com';

      pintarAvatar(u);

      var token = localStorage.getItem('token');
      if (token && u.id) {
        fetch(API_URL + '/usuarios/' + u.id, {
          headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (freshData) {
          if (!freshData) return;
          var usuarioActualizado = Object.assign({}, u, freshData);
          localStorage.setItem('user', JSON.stringify(usuarioActualizado));
          pintarAvatar(usuarioActualizado);
          if (document.getElementById('navUsername'))
            document.getElementById('navUsername').textContent = usuarioActualizado.nombre || 'Usuario';
          if (document.getElementById('dropdownName'))
            document.getElementById('dropdownName').textContent = usuarioActualizado.nombre || 'Usuario';
          if (document.getElementById('dropdownEmail'))
            document.getElementById('dropdownEmail').textContent = usuarioActualizado.correo || 'usuario@venvidrio.com';
        })
        .catch(function (err) {
          console.warn('No se pudo cargar la foto fresca del backend', err);
        });
      }
    } catch (e) {
      console.warn('Error al actualizar el navbar:', e);
    }
  }

  // =========================
  // 4. VERIFICAR CUMPLEAÑOS
  // =========================
  function verificarCumpleanos() {
    var data = localStorage.getItem('user');
    if (!data) return;

    try {
      var u = JSON.parse(data);
      if (!u.fecha_nacimiento) return;

      var nacimiento = new Date(u.fecha_nacimiento + 'T12:00:00');
      var hoy = new Date();

      if (nacimiento.getMonth() === hoy.getMonth() && nacimiento.getDate() === hoy.getDate()) {
        setTimeout(function () {
          window.mostrarAlertaPersonalizada(
            '¡Feliz Cumpleaños, <strong>' + (u.nombre || 'compañero').split(' ')[0] + '</strong>! 🎂<br>Todo el equipo de Control de Calidad de Venvidrio te desea un excelente día.',
            'success'
          );
          if (typeof confetti === 'function') {
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
          }
        }, 1000);
      }
    } catch (e) {}
  }

  // =========================
  // 5. MODAL "MI PERFIL"
  // =========================
  function injectPerfilStyles() {
    if (document.getElementById('perfil-redesign-styles')) return;
    var style = document.createElement('style');
    style.id = 'perfil-redesign-styles';
    style.textContent = `
      #modalMiPerfil.modal-overlay {
        align-items: center; justify-content: center; padding: 16px;
        background: rgba(15, 23, 42, 0.55);
        backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
        opacity: 0; transition: opacity 0.25s ease;
      }
      #modalMiPerfil.modal-overlay.show { opacity: 1; }
      #modalMiPerfil .modal-box {
        width: 100%; max-width: 580px; max-height: 92vh;
        display: flex; flex-direction: column;
        border-radius: 20px; overflow: hidden; background: #fff;
        box-shadow: 0 25px 60px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(15, 23, 42, 0.04);
        transform: translateY(24px) scale(0.97); opacity: 0;
        transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease;
      }
      #modalMiPerfil.modal-overlay.show .modal-box { transform: translateY(0) scale(1); opacity: 1; }
      #modalMiPerfil .modal-header {
        position: relative;
        background: linear-gradient(135deg, #1a237e 0%, #3949ab 55%, #5c6bc0 100%);
        color: #fff; padding: 22px 24px; border-bottom: none;
        display: flex; align-items: center; justify-content: space-between;
      }
      #modalMiPerfil .modal-header::after {
        content: ''; position: absolute; right: -40px; top: -40px;
        width: 140px; height: 140px;
        background: radial-gradient(circle, rgba(255,255,255,0.22), transparent 70%);
        border-radius: 50%; pointer-events: none;
      }
      #modalMiPerfil .modal-header h2 {
        font-size: 1.15rem; font-weight: 700; letter-spacing: 0.2px;
        display: flex; align-items: center; gap: 10px; margin: 0; color: #fff;
      }
      #modalMiPerfil .modal-header h2 i { font-size: 1.4rem; }
      #modalMiPerfil .modal-close {
        position: relative; z-index: 1; background: rgba(255,255,255,0.15); color: #fff;
        border: none; width: 36px; height: 36px; border-radius: 50%;
        display: inline-flex; align-items: center; justify-content: center;
        cursor: pointer; transition: background 0.2s ease, transform 0.2s ease;
      }
      #modalMiPerfil .modal-close:hover { background: rgba(255,255,255,0.28); transform: rotate(90deg); }
      #modalMiPerfil .modal-body {
        padding: 24px; overflow-y: auto; -webkit-overflow-scrolling: touch;
        background: linear-gradient(180deg, #f8fafc 0%, #ffffff 40%);
      }
      #modalMiPerfil .modal-body::-webkit-scrollbar { width: 8px; }
      #modalMiPerfil .modal-body::-webkit-scrollbar-thumb { background: #c7cbe0; border-radius: 8px; }
      #miPerfil-avatar-wrap { display: flex; flex-direction: column; align-items: center; margin-bottom: 22px; }
      #miPerfil-avatar-container {
        position: relative; width: 112px; height: 112px; border-radius: 50%;
        cursor: pointer; background: linear-gradient(135deg, #e8eaf6, #c5cae9);
        border: 3px solid #fff; box-shadow: 0 8px 22px rgba(26, 35, 126, 0.18), 0 0 0 4px rgba(57, 73, 171, 0.10);
        display: flex; align-items: center; justify-content: center; overflow: hidden;
        transition: transform 0.25s ease, box-shadow 0.25s ease;
      }
      #miPerfil-avatar-container:hover {
        transform: scale(1.04);
        box-shadow: 0 12px 28px rgba(26, 35, 126, 0.28), 0 0 0 5px rgba(57, 73, 171, 0.18);
      }
      #miPerfil-avatar-container::after {
        content: '\\F3C5'; font-family: 'tabler-icons';
        position: absolute; right: 2px; bottom: 2px; width: 30px; height: 30px;
        border-radius: 50%; background: #3949ab; color: #fff;
        display: flex; align-items: center; justify-content: center;
        font-size: 15px; box-shadow: 0 2px 6px rgba(0,0,0,0.2); pointer-events: none;
      }
      #miPerfil-avatar-container img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
      #miPerfil-icono-camara { font-size: 34px; color: #5c6bc0; transition: transform 0.25s ease; }
      #miPerfil-avatar-container:hover #miPerfil-icono-camara { transform: scale(1.12); }
      #miPerfil-avatar-hint {
        margin-top: 10px; font-size: 11.5px; color: #64748b; background: #eef2ff;
        padding: 4px 12px; border-radius: 999px; font-weight: 600; letter-spacing: 0.2px;
      }
      #modalMiPerfil .perfil-section {
        background: #fff; border: 1px solid #e9edf5; border-radius: 14px;
        padding: 16px 18px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
      }
      #modalMiPerfil .perfil-section-title {
        display: flex; align-items: center; gap: 8px; font-size: 0.78rem;
        font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;
        color: #3949ab; margin-bottom: 14px;
      }
      #modalMiPerfil .perfil-section-title i { font-size: 1rem; }
      #modalMiPerfil .field { margin-bottom: 14px; }
      #modalMiPerfil .field:last-child { margin-bottom: 0; }
      #modalMiPerfil .field label {
        display: block; font-size: 11.5px; font-weight: 600; color: #64748b;
        text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 6px;
      }
      #modalMiPerfil .field input {
        width: 100%; padding: 11px 14px; border: 1.5px solid #dde3ee; border-radius: 10px;
        font-size: 14px; color: #1e293b; background: #fbfcfe; box-sizing: border-box;
        transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
      }
      #modalMiPerfil .field input:focus {
        outline: none; border-color: #3949ab; background: #fff; box-shadow: 0 0 0 4px rgba(57, 73, 171, 0.12);
      }
      #modalMiPerfil .field input:disabled {
        background: #f1f5f9; color: #64748b; cursor: not-allowed; border-color: #e2e8f0;
      }
      #modalMiPerfil .input-icon-wrap { position: relative; }
      #modalMiPerfil .input-icon-wrap i {
        position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
        color: #94a3b8; font-size: 1rem; pointer-events: none;
      }
      #modalMiPerfil .input-icon-wrap input { padding-left: 38px; }
      #modalMiPerfil .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      #modalMiPerfil .modal-error {
        background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 10px;
        padding: 10px 14px; font-size: 13px; font-weight: 500; margin-top: 4px;
        animation: shakeError 0.35s ease;
      }
      @keyframes shakeError {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
      }
      #modalMiPerfil .modal-footer {
        display: flex; gap: 10px; justify-content: flex-end;
        padding: 16px 22px; background: #f8fafc; border-top: 1px solid #e9edf5;
      }
      #modalMiPerfil .modal-footer .btn {
        border-radius: 10px; font-weight: 600; padding: 11px 22px; font-size: 14px;
        transition: transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease;
      }
      #modalMiPerfil .modal-footer .btn:active { transform: scale(0.97); }
      #modalMiPerfil .modal-footer .btn-primary {
        background: linear-gradient(135deg, #3949ab, #1a237e); border: none;
        box-shadow: 0 6px 16px -4px rgba(57, 73, 171, 0.5);
        display: inline-flex; align-items: center; gap: 8px;
      }
      #modalMiPerfil .modal-footer .btn-primary:hover {
        box-shadow: 0 10px 22px -4px rgba(57, 73, 171, 0.6); transform: translateY(-1px);
      }
      #modalMiPerfil .modal-footer .btn-primary:disabled {
        opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none;
      }
      #modalMiPerfil .modal-footer .btn-outline {
        background: #fff; border: 1.5px solid #dde3ee; color: #475569;
      }
      #modalMiPerfil .modal-footer .btn-outline:hover { background: #f1f5f9; border-color: #cbd5e1; }
      @media (max-width: 600px) {
        #modalMiPerfil.modal-overlay { padding: 0; align-items: flex-end; }
        #modalMiPerfil .modal-box {
          max-width: 100%; width: 100%; max-height: 94vh;
          border-radius: 22px 22px 0 0; transform: translateY(100%);
        }
        #modalMiPerfil.modal-overlay.show .modal-box { transform: translateY(0); }
        #modalMiPerfil .modal-header { padding: 18px 20px; border-radius: 22px 22px 0 0; }
        #modalMiPerfil .modal-body { padding: 20px 16px; }
        #modalMiPerfil .grid-2 { grid-template-columns: 1fr; gap: 0; }
        #modalMiPerfil .modal-footer {
          padding: 14px 16px calc(14px + env(safe-area-inset-bottom, 0px));
          flex-direction: column-reverse;
        }
        #modalMiPerfil .modal-footer .btn { width: 100%; justify-content: center; }
        #miPerfil-avatar-container { width: 96px; height: 96px; }
      }
      @media (prefers-reduced-motion: reduce) {
        #modalMiPerfil *, #modalMiPerfil *::before, #modalMiPerfil *::after {
          animation-duration: 0.001ms !important; transition-duration: 0.001ms !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function conectarModalPerfil() {
    injectPerfilStyles();
    var btnPerfil = document.getElementById('dropdownPerfil');
    var modalPerfil = document.getElementById('modalMiPerfil');

    if (!btnPerfil || !modalPerfil) {
      if (!window._perfilWaitStart) window._perfilWaitStart = Date.now();
      if (Date.now() - window._perfilWaitStart > 5000) return;
      setTimeout(conectarModalPerfil, 120);
      return;
    }
    if (btnPerfil.dataset.initialized === 'true') return;
    btnPerfil.dataset.initialized = 'true';

    reestructurarModalPerfil();

    async function abrirModal(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      cerrarDropdownPerfil();
      cerrarMenuHamburguesa();

      var u = JSON.parse(localStorage.getItem('user') || '{}');
      try {
        var token = localStorage.getItem('token');
        var res = await fetch(API_URL + '/usuarios/' + u.id, {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        if (res.ok) {
          var freshData = await res.json();
          u = Object.assign({}, u, freshData);
          localStorage.setItem('user', JSON.stringify(u));
          actualizarNavbar();
        }
      } catch (err) { console.warn('No se pudieron traer datos frescos', err); }

      setVal('miPerfil-nombre', u.nombre || '');
      setVal('miPerfil-cedula', u.cedula || '');
      setVal('miPerfil-correo', u.correo || '');
      setVal('miPerfil-turno', u.turno ? String(u.turno) : '');
      setVal('miPerfil-cargo', u.cargo || 'No asignado');
      setVal('miPerfil-fecha-ingreso', u.fecha_ingreso || '');
      setVal('miPerfil-fecha-nacimiento', u.fecha_nacimiento || '');

      window._miFotoSeleccionada = null;
      var preview = document.getElementById('miPerfil-preview-foto');
      var icono = document.getElementById('miPerfil-icono-camara');
      if (u.foto_url) {
        if (preview) { preview.src = obtenerUrlFoto(u.foto_url) + '?t=' + Date.now(); preview.style.display = 'block'; }
        if (icono) icono.style.display = 'none';
      } else {
        if (preview) { preview.removeAttribute('src'); preview.style.display = 'none'; }
        if (icono) icono.style.display = 'block';
      }
      var errDiv = document.getElementById('miPerfil-error');
      if (errDiv) errDiv.style.display = 'none';

      modalPerfil.style.display = 'flex';
      void modalPerfil.offsetWidth;
      modalPerfil.classList.add('show');
    }

    let lastOpenPerfil = 0;
    const abrirPerfil = function (e) {
      const now = Date.now();
      if (now - lastOpenPerfil < 300) return;
      lastOpenPerfil = now;
      abrirModal(e);
    };

    btnPerfil.addEventListener('click', abrirPerfil);
    btnPerfil.addEventListener('touchend', abrirPerfil, { passive: false });

    var cerrar = function () {
      modalPerfil.classList.remove('show');
      setTimeout(function () { modalPerfil.style.display = 'none'; }, 300);
    };

    var btnClose = document.getElementById('perfil-close');
    var btnCancel = document.getElementById('miPerfil-cancelar');
    if (btnClose) btnClose.addEventListener('click', cerrar);
    if (btnCancel) btnCancel.addEventListener('click', cerrar);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalPerfil.classList.contains('show')) cerrar();
    });

    var contenedorAvatar = document.getElementById('miPerfil-avatar-container');
    var inputFile = document.getElementById('miPerfil-file-foto');

    if (contenedorAvatar && inputFile) {
      const abrirSelector = function () { inputFile.value = ''; inputFile.click(); };
      contenedorAvatar.addEventListener('click', abrirSelector);

      inputFile.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!file.type || file.type.indexOf('image/') !== 0) {
          mostrarErrorPerfil('Selecciona un archivo de imagen válido (JPG, PNG…).');
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          mostrarErrorPerfil('La imagen no debe superar 5 MB.');
          return;
        }
        window._miFotoSeleccionada = file;
        var reader = new FileReader();
        reader.onload = function (ev) {
          var preview = document.getElementById('miPerfil-preview-foto');
          var icono = document.getElementById('miPerfil-icono-camara');
          if (preview) { preview.src = ev.target.result; preview.style.display = 'block'; }
          if (icono) icono.style.display = 'none';
        };
        reader.readAsDataURL(file);
      });
    }

    var btnGuardar = document.getElementById('miPerfil-guardar');
    if (btnGuardar) {
      btnGuardar.addEventListener('click', async function () {
        btnGuardar.disabled = true;
        var errDiv = document.getElementById('miPerfil-error');
        if (errDiv) errDiv.style.display = 'none';

        var nombre = (document.getElementById('miPerfil-nombre').value || '').trim();
        if (nombre.length < 3) {
          mostrarErrorPerfil('El nombre debe tener al menos 3 caracteres.');
          btnGuardar.disabled = false;
          return;
        }

        var userLocal = JSON.parse(localStorage.getItem('user') || '{}');
        var fotoUrlFinal = userLocal.foto_url;

        if (window._miFotoSeleccionada) {
          var formData = new FormData();
          formData.append('file', window._miFotoSeleccionada);
          try {
            var resUpload = await fetch(API_URL + '/usuarios/upload-foto', {
              method: 'POST',
              headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
              body: formData
            });
            if (resUpload.ok) {
              var dataUpload = await resUpload.json();
              fotoUrlFinal = dataUpload.url;
            } else {
              mostrarErrorPerfil('No se pudo subir la imagen. Intenta de nuevo.');
              btnGuardar.disabled = false;
              return;
            }
          } catch (e) {
            console.error('Error subiendo foto:', e);
            mostrarErrorPerfil('Error de conexión al subir la imagen.');
            btnGuardar.disabled = false;
            return;
          }
        }

        var turnoVal = document.getElementById('miPerfil-turno').value;
        var turnoNum = turnoVal ? parseInt(turnoVal, 10) : null;
        if (isNaN(turnoNum)) turnoNum = null;

        var payload = {
          nombre: nombre,
          cedula: (document.getElementById('miPerfil-cedula').value || '').trim() || null,
          turno: turnoNum,
          fecha_ingreso: document.getElementById('miPerfil-fecha-ingreso').value || null,
          fecha_nacimiento: document.getElementById('miPerfil-fecha-nacimiento').value || null,
          foto_url: fotoUrlFinal
        };

        try {
          var res = await fetch(API_URL + '/usuarios/' + userLocal.id, {
            method: 'PUT',
            headers: {
              'Authorization': 'Bearer ' + localStorage.getItem('token'),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            var dataRes = await res.json();
            userLocal.nombre = dataRes.nombre;
            userLocal.foto_url = dataRes.foto_url;
            userLocal.cedula = dataRes.cedula;
            userLocal.turno = dataRes.turno;
            userLocal.fecha_nacimiento = dataRes.fecha_nacimiento;
            localStorage.setItem('user', JSON.stringify(userLocal));

            actualizarNavbar();
            cerrar();

            window.mostrarAlertaPersonalizada('Perfil actualizado correctamente.', 'success');
          } else {
            var errorData = await res.json().catch(() => ({}));
            mostrarErrorPerfil(errorData.detail || 'Error al actualizar el perfil.');
          }
        } catch (err) {
          mostrarErrorPerfil('Error de conexión.');
        } finally {
          btnGuardar.disabled = false;
        }
      });
    }

    function setVal(id, v) { var el = document.getElementById(id); if (el) el.value = v; }
    function mostrarErrorPerfil(msg) {
      var errDiv = document.getElementById('miPerfil-error');
      if (errDiv) { errDiv.textContent = msg; errDiv.style.display = 'block'; }
    }
    function cerrarDropdownPerfil() {
      var dd = document.getElementById('userDropdown');
      var uc = document.getElementById('navUserContainer');
      if (dd) dd.classList.remove('show');
      if (uc) uc.classList.remove('is-open');
    }
    function cerrarMenuHamburguesa() {
      var nl = document.getElementById('navLinks');
      var nt = document.getElementById('navToggle');
      if (nl) nl.classList.remove('active');
      if (nt) {
        nt.setAttribute('aria-expanded', 'false');
        var ic = nt.querySelector('i');
        if (ic) ic.className = 'ti ti-menu-2';
      }
    }
  }

  function reestructurarModalPerfil() {
    var modal = document.getElementById('modalMiPerfil');
    if (!modal) return;
    var body = modal.querySelector('.modal-body');
    if (!body || body.dataset.redesigned === 'true') return;

    body.dataset.redesigned = 'true';

    var existing = {
      nombre: document.getElementById('miPerfil-nombre'),
      cedula: document.getElementById('miPerfil-cedula'),
      correo: document.getElementById('miPerfil-correo'),
      turno: document.getElementById('miPerfil-turno'),
      cargo: document.getElementById('miPerfil-cargo'),
      fechaIngreso: document.getElementById('miPerfil-fecha-ingreso'),
      fechaNacimiento: document.getElementById('miPerfil-fecha-nacimiento'),
      avatarContainer: document.getElementById('miPerfil-avatar-container'),
      preview: document.getElementById('miPerfil-preview-foto'),
      icono: document.getElementById('miPerfil-icono-camara'),
      inputFile: document.getElementById('miPerfil-file-foto'),
      error: document.getElementById('miPerfil-error')
    };

    body.innerHTML = '';

    var avatarWrap = document.createElement('div');
    avatarWrap.id = 'miPerfil-avatar-wrap';
    if (existing.avatarContainer) avatarWrap.appendChild(existing.avatarContainer);
    if (existing.preview) avatarWrap.appendChild(existing.preview);
    if (existing.inputFile) avatarWrap.appendChild(existing.inputFile);
    var hint = document.createElement('div');
    hint.id = 'miPerfil-avatar-hint';
    hint.textContent = 'Clic en la foto para cambiarla';
    avatarWrap.appendChild(hint);
    body.appendChild(avatarWrap);

    var secPersonal = document.createElement('div');
    secPersonal.className = 'perfil-section';
    secPersonal.innerHTML = '<div class="perfil-section-title"><i class="ti ti-user"></i> Datos personales</div>';
    var grid1 = document.createElement('div');
    grid1.className = 'grid-2';
    grid1.appendChild(crearField('Nombre Completo *', existing.nombre));
    grid1.appendChild(crearField('Cédula', existing.cedula));
    secPersonal.appendChild(grid1);
    body.appendChild(secPersonal);

    var secContacto = document.createElement('div');
    secContacto.className = 'perfil-section';
    secContacto.innerHTML = '<div class="perfil-section-title"><i class="ti ti-mail"></i> Contacto</div>';
    var fCorreo = crearField('Correo Electrónico (No editable)', existing.correo, true);
    var iconWrap = document.createElement('div');
    iconWrap.className = 'input-icon-wrap';
    iconWrap.innerHTML = '<i class="ti ti-mail"></i>';
    iconWrap.appendChild(existing.correo);
    fCorreo.innerHTML = '';
    fCorreo.appendChild(crearLabel('Correo Electrónico (No editable)'));
    fCorreo.appendChild(iconWrap);
    secContacto.appendChild(fCorreo);
    body.appendChild(secContacto);

    var secLaboral = document.createElement('div');
    secLaboral.className = 'perfil-section';
    secLaboral.innerHTML = '<div class="perfil-section-title"><i class="ti ti-briefcase"></i> Información laboral</div>';
    var grid2 = document.createElement('div');
    grid2.className = 'grid-2';
    grid2.appendChild(crearField('Turno (Asignado)', existing.turno));
    grid2.appendChild(crearField('Cargo (Asignado)', existing.cargo));
    secLaboral.appendChild(grid2);
    body.appendChild(secLaboral);

    var secFechas = document.createElement('div');
    secFechas.className = 'perfil-section';
    secFechas.innerHTML = '<div class="perfil-section-title"><i class="ti ti-calendar"></i> Fechas</div>';
    var grid3 = document.createElement('div');
    grid3.className = 'grid-2';
    grid3.appendChild(crearField('Fecha de Ingreso', existing.fechaIngreso));
    grid3.appendChild(crearField('Fecha de Nacimiento', existing.fechaNacimiento));
    secFechas.appendChild(grid3);
    body.appendChild(secFechas);

    if (existing.error) {
      existing.error.style.display = 'none';
      body.appendChild(existing.error);
    }

    if (existing.avatarContainer && !avatarWrap.contains(existing.avatarContainer)) {
      avatarWrap.insertBefore(existing.avatarContainer, hint);
    }
    if (existing.avatarContainer) {
      if (existing.preview && !existing.avatarContainer.contains(existing.preview))
        existing.avatarContainer.appendChild(existing.preview);
      if (existing.icono && !existing.avatarContainer.contains(existing.icono))
        existing.avatarContainer.appendChild(existing.icono);
    }
  }

  function crearLabel(txt) {
    var l = document.createElement('label');
    l.textContent = txt;
    return l;
  }

  function crearField(labelTxt, inputEl) {
    var f = document.createElement('div');
    f.className = 'field';
    f.appendChild(crearLabel(labelTxt));
    if (inputEl) f.appendChild(inputEl);
    return f;
  }

  // =========================
  // 6. SESIÓN Y EXPIRACIÓN
  // =========================
  function startHeartbeat() {
    if (heartbeatInterval) return;
    heartbeatInterval = setInterval(function () {
      var token = localStorage.getItem('token');
      if (!token) return;
      if (alertaMostrada) return;

      fetch(API_URL + '/auth/verify', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
      })
      .then(function (response) {
        // Solo cerramos la sesión si el token realmente ya no sirve (401)
        if (response.status === 401) {
          clearInterval(heartbeatInterval);
          clearInterval(inactivityInterval);
          localStorage.clear();
          window.mostrarAlertaPersonalizada('Tu sesión ha finalizado (expirada).', 'warning').then(function() {
            window.location.href = '/login.html'; // 👈 Corregido para evitar 404
          });
        }
      })
      .catch(function (error) { 
        console.warn('Heartbeat falló (posible problema de red):', error); 
      });
    }, INTERVALO_HEARTBEAT_MS);
  }

  function mostrarAlertaInactividad() {
    window.mostrarAlertaPersonalizada(
      'Tu sesión está a punto de expirar por inactividad.',
      'warning',
      true,
      '¿Deseas continuar en el sistema?'
    ).then(function(continuar) {
      if (continuar) {
        localStorage.setItem('lastActivity', Date.now());
        alertaMostrada = false;
      }
    });
  }

  function cerrarSesionPorInactividad() {
    clearInterval(heartbeatInterval);
    clearInterval(inactivityInterval);
    localStorage.clear();
    window.mostrarAlertaPersonalizada('Tu sesión ha expirado por inactividad. Por favor, inicia sesión de nuevo.', 'error').then(function() {
      window.location.href = '/login.html'; // 👈 Corregido para evitar 404
    });
  }

  // =========================
  // 7. LÓGICA GLOBAL
  // =========================
  if (!esPaginaLogin) {
    var token = localStorage.getItem('token');

    if (!token && window.location.pathname.indexOf('login.html') === -1) {
      window.location.href = '/login.html'; // 👈 Corregido para evitar 404
      return;
    }

    if (token) {
      startHeartbeat();

      function registrarActividad() {
        localStorage.setItem('lastActivity', Date.now());
        alertaMostrada = false;
      }

      ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'].forEach(function (event) {
        document.addEventListener(event, registrarActividad, { passive: true });
      });

      if (!localStorage.getItem('lastActivity')) {
        localStorage.setItem('lastActivity', Date.now());
      }

      if (inactivityInterval) clearInterval(inactivityInterval);
      inactivityInterval = setInterval(function () {
        var lastActivity = parseInt(localStorage.getItem('lastActivity') || '0', 10);
        var inactividad = Date.now() - lastActivity;

        if (inactividad >= TIEMPO_ALERTA_MS && inactividad < TIEMPO_INACTIVIDAD_MS) {
          if (!alertaMostrada) { mostrarAlertaInactividad(); alertaMostrada = true; }
        }
        if (inactividad >= TIEMPO_INACTIVIDAD_MS) { cerrarSesionPorInactividad(); }
      }, INTERVALO_CHEQUEO_MS);

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          actualizarNavbar();
          verificarCumpleanos();
          conectarModalPerfil();
        });
      } else {
        actualizarNavbar();
        verificarCumpleanos();
        conectarModalPerfil();
      }
    }
  }

  // =========================
  // 8. PÁGINA DE LOGIN
  // =========================
  if (esPaginaLogin) {
    if (pwToggleBtn) {
      pwToggleBtn.addEventListener('click', function () {
        var isHidden = passwordInput.type === 'password';
        passwordInput.type = isHidden ? 'text' : 'password';
        pwIcon.className = isHidden ? 'ti ti-eye-off' : 'ti ti-eye';
      });
    }

    if (passwordInput && capsLockWarning) {
      passwordInput.addEventListener('keydown', function (e) {
        if (typeof e.getModifierState === 'function' && e.getModifierState('CapsLock')) {
          capsLockWarning.style.display = 'flex';
        } else {
          capsLockWarning.style.display = 'none';
        }
      });
      passwordInput.addEventListener('blur', function () { capsLockWarning.style.display = 'none'; });
    }

    if (usernameInput) {
      usernameInput.addEventListener('input', function () {
        usernameInput.classList.remove('error');
        ocultarError();
      });
    }
    if (passwordInput) {
      passwordInput.addEventListener('input', function () {
        passwordInput.classList.remove('error');
        ocultarError();
      });
    }

    if (logoArea) {
      logoArea.addEventListener('dblclick', function () {
        usernameInput.value = '';
        passwordInput.value = '';
        usernameInput.classList.remove('error');
        passwordInput.classList.remove('error');
        ocultarError();
        usernameInput.focus();
      });
    }

    function mostrarError(message) {
      if (errorMessage && errorText) {
        errorText.textContent = message;
        errorMessage.classList.add('show');
        clearTimeout(window.errorTimeout);
        window.errorTimeout = setTimeout(function () { errorMessage.classList.remove('show'); }, 4000);
      } else {
        window.mostrarAlertaPersonalizada(message, 'error');
      }
    }

    function ocultarError() {
      if (errorMessage) {
        errorMessage.classList.remove('show');
        clearTimeout(window.errorTimeout);
      }
    }

    function validate() {
      var valid = true;
      ocultarError();
      if (usernameInput) {
        usernameInput.classList.remove('error');
        if (!usernameInput.value.trim()) { usernameInput.classList.add('error'); valid = false; }
      }
      if (passwordInput) {
        passwordInput.classList.remove('error');
        if (!passwordInput.value.trim()) { passwordInput.classList.add('error'); valid = false; }
      }
      return valid;
    }

    function setLoading(state) {
      if (state) { submitBtn.classList.add('loading'); submitBtn.disabled = true; }
      else { submitBtn.classList.remove('loading'); submitBtn.disabled = false; }
    }

    function showSuccess(duration) {
      duration = duration || 2800;
      if (successOverlay) {
        successOverlay.classList.add('show');
        setTimeout(function () { successOverlay.classList.remove('show'); }, duration);
      }
    }

    function handleLogin() {
      if (submitBtn.disabled) return;
      if (!validate()) {
        if (usernameInput && usernameInput.classList.contains('error')) usernameInput.focus();
        else if (passwordInput && passwordInput.classList.contains('error')) passwordInput.focus();
        return;
      }

      var inputUsuario = usernameInput.value.trim();
      var password = passwordInput.value.trim();
      var correo = "";

      if (inputUsuario.includes('@')) {
        correo = inputUsuario;
      } else {
        correo = inputUsuario + '@venvidrio.com';
      }

      var emailRegex = /^[a-zA-Z0-9._%+-]+@venvidrio\.com$/;
      if (!emailRegex.test(correo)) {
        if (usernameInput) usernameInput.classList.add('error');
        window.mostrarAlertaPersonalizada('Formato de usuario o correo inválido', 'error');
        if (usernameInput) usernameInput.focus();
        return;
      }

      if (password.length < 1) {
        if (passwordInput) passwordInput.classList.add('error');
        window.mostrarAlertaPersonalizada('Por favor ingresa tu contraseña', 'error');
        if (passwordInput) passwordInput.focus();
        return;
      }

      // 👇 LÓGICA DEL CAPTCHA PARA DISPOSITIVOS NUEVOS 👇
      var esDispositivoNuevo = !localStorage.getItem('dispositivo_autorizado');
      var captchaContainer = document.getElementById('captcha-container');
      var captchaToken = null;

      if (esDispositivoNuevo) {
        if (captchaContainer) captchaContainer.style.display = 'flex';

        if (typeof grecaptcha !== 'undefined') {
          captchaToken = grecaptcha.getResponse();
          if (captchaToken.length === 0) {
            window.mostrarAlertaPersonalizada('Por seguridad, completa el CAPTCHA para ingresar desde este nuevo dispositivo.', 'warning');
            return;
          }
        } else {
          window.mostrarAlertaPersonalizada('El CAPTCHA no está disponible. Recarga la página.', 'error');
          return;
        }
      }

      setLoading(true);

      // Preparamos los datos a enviar
      var loginData = { correo: correo, password: password };
      if (captchaToken) {
        loginData.captcha_token = captchaToken; // Enviamos el token al backend
      }

      fetch(API_URL + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(loginData)
      })
      .then(function (response) {
        return response.json().then(function (data) { return { status: response.status, data: data }; });
      })
      .then(function (result) {
        var status = result.status;
        var data = result.data;
        setLoading(false);

        if (status === 200 || status === 201) {
          // 👇 Si el login es exitoso, marcamos este dispositivo como autorizado 👇
          localStorage.setItem('dispositivo_autorizado', 'true');

          localStorage.setItem('token', data.access_token);
          localStorage.setItem('user', JSON.stringify(data.user));
          localStorage.setItem('role', data.role);
          localStorage.setItem('login_time', Date.now());
          localStorage.setItem('lastActivity', Date.now());

          if (rememberMe && rememberMe.checked) localStorage.setItem('remember_me', 'true');
          else localStorage.removeItem('remember_me');

          showSuccess(2500);
          setTimeout(function () { window.location.href = 'dashboard.html'; }, 2500);
          return;
        }

        var errorMsg = data.detail || 'Credenciales incorrectas';
        if (status === 400 && errorMsg.toLowerCase().indexOf('captcha') !== -1) {
          window.mostrarAlertaPersonalizada('El CAPTCHA es inválido o expiró. Intenta de nuevo.', 'error');
        } else if (status === 403) {
          var low = errorMsg.toLowerCase();
          if (low.indexOf('bloqueado') !== -1) {
            window.mostrarAlertaPersonalizada('Usuario bloqueado.', 'error', false, errorMsg);
          } else if (low.indexOf('desactivado') !== -1) {
            window.mostrarAlertaPersonalizada('Usuario desactivado.', 'warning', false, 'Contacte al administrador.');
          } else {
            window.mostrarAlertaPersonalizada(errorMsg, 'error');
          }
        } else {
          window.mostrarAlertaPersonalizada(errorMsg, 'error');
        }

        // Si falla, reseteamos el CAPTCHA para que vuelva a intentar
        if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
        if (passwordInput) { passwordInput.value = ''; passwordInput.focus(); }
      })
      .catch(function (error) {
        setLoading(false);
        console.error('Error de conexión:', error);
        var errorMsg = 'Error de conexión con el servidor. ';
        if (!navigator.onLine) errorMsg += 'Verifica tu conexión a internet.';
        else errorMsg += 'Asegúrate de que el backend esté corriendo en ' + API_URL;
        window.mostrarAlertaPersonalizada(errorMsg, 'error');
      });
    }

    // 👇 CORRECCIÓN CLAVE: Mostrar CAPTCHA desde el inicio si es dispositivo nuevo
    if (!localStorage.getItem('dispositivo_autorizado')) {
      var captchaContainer = document.getElementById('captcha-container');
      if (captchaContainer) {
        captchaContainer.style.display = 'flex';
      }
    }

    submitBtn.addEventListener('click', function (e) { e.preventDefault(); handleLogin(); });
    if (usernameInput) usernameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); handleLogin(); } });
    if (passwordInput) passwordInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); handleLogin(); } });

    localStorage.removeItem('token');
    localStorage.removeItem('lastActivity');
    console.log('🔐 Venvidrio - Login UI inicializada con reCAPTCHA');
  }
})();