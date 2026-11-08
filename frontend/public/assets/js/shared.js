(function () {
  'use strict';

  // Detectar la URL de la API
  var API_URL;
  if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    API_URL = "http://127.0.0.1:8000";
  } else {
    API_URL = "https://calidad-venvidrio-repository-main.onrender.com";
  }

  // 👇 NUEVA FUNCIÓN: Normaliza la URL de la foto
  function obtenerUrlFoto(fotoUrl) {
    if (!fotoUrl) return null;
    if (fotoUrl.startsWith('http://') || fotoUrl.startsWith('https://')) {
      return fotoUrl.replace(/^(https?)\/\//, '$1://');
    }
    return `${API_URL}${fotoUrl}`;
  }

  // =============================================
  // INYECTAR ESTILOS DE ANIMACIÓN
  // =============================================
  function injectAnimationStyles() {
    if (document.getElementById('nav-anim-styles')) return;
    var style = document.createElement('style');
    style.id = 'nav-anim-styles';
    style.textContent = `
      /* ---------- ANIMACIÓN MENÚ HAMBURGUESA (MÓVIL) ---------- */
      .nav-toggle {
        transition: transform 0.25s ease, background 0.25s ease;
      }
      .nav-toggle:active {
        transform: scale(0.9);
      }
      .nav-toggle i {
        display: inline-block;
        transition: transform 0.35s cubic-bezier(0.68, -0.55, 0.27, 1.55), opacity 0.2s ease;
      }
      .nav-toggle i.ti-x {
        transform: rotate(90deg) scale(1.1);
      }

      /* Enlaces del menú móvil con entrada escalonada */
      @media (max-width: 900px) {
        #navLinks {
          transform-origin: top center;
          transition: opacity 0.3s ease, transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
          opacity: 0;
          transform: translateY(-10px) scaleY(0.96);
          pointer-events: none;
        }
        #navLinks.active {
          opacity: 1;
          transform: translateY(0) scaleY(1);
          pointer-events: auto;
        }
        #navLinks a {
          opacity: 0;
          transform: translateX(-12px);
          transition: opacity 0.3s ease, transform 0.3s ease;
        }
        #navLinks.active a {
          opacity: 1;
          transform: translateX(0);
        }
        /* Retardo escalonado para cada enlace */
        #navLinks.active a:nth-child(1) { transition-delay: 0.05s; }
        #navLinks.active a:nth-child(2) { transition-delay: 0.10s; }
        #navLinks.active a:nth-child(3) { transition-delay: 0.15s; }
        #navLinks.active a:nth-child(4) { transition-delay: 0.20s; }
        #navLinks.active a:nth-child(5) { transition-delay: 0.25s; }
        #navLinks.active a:nth-child(6) { transition-delay: 0.30s; }
        #navLinks.active a:nth-child(7) { transition-delay: 0.35s; }
        #navLinks.active a:nth-child(8) { transition-delay: 0.40s; }
      }

      /* ---------- ANIMACIÓN DE TRANSICIÓN DE PÁGINA (PC) ---------- */
      @media (min-width: 901px) {
        body {
          animation: pageFadeIn 0.45s ease both;
        }
        body.page-transition-out {
          animation: pageFadeOut 0.3s ease forwards;
          pointer-events: none;
        }
        @keyframes pageFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pageFadeOut {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(-8px); }
        }
      }

      /* Respeto a usuarios con preferencia de movimiento reducido */
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.001ms !important;
          transition-duration: 0.001ms !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  injectAnimationStyles();

  // =============================================
  // 0. RELOJ EN TIEMPO REAL (A PRUEBA DE FALLOS)
  // =============================================
  function iniciarReloj() {
    var reloj = document.getElementById('reloj-real');
    
    if (!reloj) {
      setTimeout(iniciarReloj, 100);
      return;
    }

    var actualizarHora = function() {
      try {
        var ahora = new Date();
        var opcionesFecha = { weekday: 'long', day: 'numeric', month: 'short' };
        var fechaStr = ahora.toLocaleDateString('es-VE', opcionesFecha);
        var horaStr = ahora.toLocaleTimeString('es-VE', { 
          hour12: true, 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        });
        var fechaCapitalizada = fechaStr.charAt(0).toUpperCase() + fechaStr.slice(1);
        reloj.textContent = fechaCapitalizada + ' | ' + horaStr;
      } catch (e) {
        console.error("Error actualizando el reloj:", e);
      }
    };
    
    actualizarHora();
    if (window.relojInterval) clearInterval(window.relojInterval);
    window.relojInterval = setInterval(actualizarHora, 1000);
  }

  iniciarReloj();

  // =============================================
  // CONTROL DE ACCESO AL MENÚ (Roles y Cargos)
  // =============================================
  function controlarMenuPorRol() {
    var rol = parseInt(localStorage.getItem('role'), 10);
    var userStr = localStorage.getItem('user');
    
    // Si no hay datos, no hacemos nada
    if (isNaN(rol) || !userStr) return;

    var user = JSON.parse(userStr);
    // Obtenemos el string de permisos que viene del cargo (ej: "auditoria_producto")
    var permisosCargo = user.permisos_cargo ? String(user.permisos_cargo).toLowerCase().split(',') : [];

    // Capturamos los enlaces del navbar
    var linkUsuarios = document.getElementById('navUsuariosLink');
    var linkAuditoriaInterna = document.getElementById('navAuditoriaInternaLink');
    var linkAuditoriaProducto = document.getElementById('navAuditoriaProductoLink');

    // ==========================================
    // REGLAS ESTRICTAS
    // ==========================================
    
    // 1. Usuarios: EXCLUSIVO Admin (Rol 3). No importan los permisos de cargo.
    var puedeVerUsuarios = (rol === 3);

    // 2. Auditoría Interna: EXCLUSIVO Admin (3) y Supervisor (2). No importan los permisos de cargo.
    var puedeVerAuditoriaInt = (rol === 2 || rol === 3);

    // 3. Auditoría Producto: Admin (3), Supervisor (2) o permiso explícito "auditoria_producto"
    var puedeVerAuditoriaProd = (rol === 2 || rol === 3 || permisosCargo.includes('auditoria_producto'));

    // ==========================================
    // APLICAR VISIBILIDAD (Eliminar si no tiene permiso)
    // ==========================================
    if (linkUsuarios && !puedeVerUsuarios) linkUsuarios.remove();
    if (linkAuditoriaInterna && !puedeVerAuditoriaInt) linkAuditoriaInterna.remove();
    if (linkAuditoriaProducto && !puedeVerAuditoriaProd) linkAuditoriaProducto.remove();
  }

  // =============================================
  // RESTO DE LA LÓGICA (DOMContentLoaded)
  // =============================================
  document.addEventListener('DOMContentLoaded', function () {

    // 👇 Llamamos a la función de control de roles aquí
    controlarMenuPorRol();

    // ---------- MENÚ HAMBURGUESA (RESPONSIVE) ----------
    const navbar = document.querySelector('.navbar');
    const navBrand = document.querySelector('.nav-brand');
    const navLinks = document.getElementById('navLinks');

    if (navbar && navBrand && navLinks) {
      let navToggle = document.getElementById('navToggle');
      
      if (!navToggle) {
        navToggle = document.createElement('button');
        navToggle.id = 'navToggle';
        navToggle.className = 'nav-toggle';
        navToggle.innerHTML = '<i class="ti ti-menu-2"></i>';
        navBrand.insertAdjacentElement('afterend', navToggle);
      }

      navToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        navLinks.classList.toggle('active');
        const icon = navToggle.querySelector('i');
        icon.className = navLinks.classList.contains('active') ? 'ti ti-x' : 'ti ti-menu-2';
      });

      navLinks.querySelectorAll('a').forEach(function(link) {
        link.addEventListener('click', function() {
          if (window.innerWidth <= 900) {
            navLinks.classList.remove('active');
            const icon = navToggle.querySelector('i');
            if (icon) icon.className = 'ti ti-menu-2';
          }
        });
      });

      document.addEventListener('click', function(e) {
        if (window.innerWidth <= 900 && navLinks.classList.contains('active')) {
          if (!navLinks.contains(e.target) && !navToggle.contains(e.target)) {
            navLinks.classList.remove('active');
            const icon = navToggle.querySelector('i');
            if (icon) icon.className = 'ti ti-menu-2';
          }
        }
      });
    }

    // ---------- LÓGICA DEL DROPDOWN ----------
    document.body.addEventListener('click', function(e) {
      var navUser = e.target.closest('#navUserContainer');
      var userDropdown = document.getElementById('userDropdown');
      
      if (!userDropdown) return;

      if (navUser) {
        e.stopPropagation(); 
        userDropdown.classList.toggle('show');
        if (userDropdown.classList.contains('show')) {
          userDropdown.style.zIndex = '99999';
        }
      } 
      else if (!e.target.closest('#userDropdown')) {
        userDropdown.classList.remove('show');
      }
    });

    // ---------- MODAL "MI PERFIL" ----------
    if (!document.getElementById('modalMiPerfil')) {
      var modalHtml = `
        <div class="modal-overlay" id="modalMiPerfil" style="display:none; z-index: 99999;">
          <div class="modal-box" style="max-width: 550px;">
            <div class="modal-header">
              <h2><i class="ti ti-user-circle"></i> Mi Perfil</h2>
              <button class="modal-close" id="perfil-close"><i class="ti ti-x"></i></button>
            </div>
            <div class="modal-body">
              <div class="field" style="align-items: center; margin-bottom: 1.5rem;">
                <div id="miPerfil-avatar-container" style="position: relative; cursor: pointer; width: 100px; height: 100px; border-radius: 50%; border: 2px dashed var(--border); display: flex; align-items: center; justify-content: center; background: #f8f9fa; overflow: hidden;">
                  <i class="ti ti-camera" style="font-size: 32px; color: var(--text-muted);" id="miPerfil-icono-camara"></i>
                  <img id="miPerfil-preview-foto" src="" style="width: 100%; height: 100%; object-fit: cover; display: none;">
                </div>
                <input type="file" id="miPerfil-file-foto" accept="image/*" style="display: none;">
                <small style="font-size:10px;color:var(--text-hint);margin-top:5px;">Clic en la foto para cambiarla</small>
              </div>
              <div class="grid-2">
                <div class="field">
                  <label>Nombre Completo *</label>
                  <input type="text" id="miPerfil-nombre" />
                </div>
                <div class="field">
                  <label>Cédula</label>
                  <input type="text" id="miPerfil-cedula" />
                </div>
              </div>
              <div class="field">
                <label>Correo Electrónico (No editable)</label>
                <input type="email" id="miPerfil-correo" disabled style="background:#f5f5f5; cursor:not-allowed;" />
              </div>
              <div class="grid-2">
                <div class="field">
                  <label>Turno (Asignado)</label>
                  <input type="text" id="miPerfil-turno" disabled style="background:#f5f5f5;" />
                </div>
                <div class="field">
                  <label>Cargo (Asignado)</label>
                  <input type="text" id="miPerfil-cargo" disabled style="background:#f5f5f5;" />
                </div>
              </div>
              <div class="grid-2">
                <div class="field">
                  <label>Fecha de Ingreso</label>
                  <input type="date" id="miPerfil-fecha-ingreso" />
                </div>
                <div class="field">
                  <label>Fecha de Nacimiento</label>
                  <input type="date" id="miPerfil-fecha-nacimiento" />
                </div>
              </div>
              <div class="modal-error" id="miPerfil-error" style="display:none;"></div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" id="miPerfil-cancelar">Cancelar</button>
              <button class="btn btn-primary" id="miPerfil-guardar"><i class="ti ti-device-floppy"></i> Actualizar Datos</button>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // ---------- LOGOUT ----------
    document.body.addEventListener('click', function(e) {
      var logoutBtn = e.target.closest('#dropdownLogout');
      if (logoutBtn) {
        e.preventDefault();
        if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
          var token = localStorage.getItem('token');
          
          var finalizarSesion = function() {
            localStorage.clear();
            window.location.href = '../public/login.html';
          };

          if (token) {
            fetch(API_URL + '/auth/logout', {
              method: 'POST',
              headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
            }).finally(finalizarSesion);
          } else {
            finalizarSesion();
          }
        }
      }
    });

    // ---------- ANIMACIÓN DE TRANSICIÓN DE PÁGINA (SOLO PC) ----------
    if (window.innerWidth > 900) {
      document.body.addEventListener('click', function(e) {
        var link = e.target.closest('a');
        if (!link) return;

        var href = link.getAttribute('href');

        if (!href ||
            href.startsWith('#') ||
            href.startsWith('javascript:') ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:') ||
            link.target === '_blank' ||
            link.hasAttribute('download') ||
            e.ctrlKey || e.metaKey || e.shiftKey || e.altKey ||
            link.hostname !== window.location.hostname) {
          return;
        }

        if (document.body.classList.contains('page-transition-out')) return;

        e.preventDefault();
        document.body.classList.add('page-transition-out');

        setTimeout(function() {
          window.location.href = href;
        }, 280);
      });

      window.addEventListener('pageshow', function(event) {
        if (event.persisted) {
          document.body.classList.remove('page-transition-out');
        }
      });
    }

    console.log("✅ Navbar, Dropdown, Reloj y Modal inicializados con animaciones.");
  });
})();