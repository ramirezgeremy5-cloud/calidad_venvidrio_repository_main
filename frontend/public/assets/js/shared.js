(function () {
  'use strict';

  // Detectar la URL de la API (CORREGIDO)
  var API_URL;
  if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    API_URL = "http://127.0.0.1:8000";
  } else {
    API_URL = "https://calidad-venvidrio-repository-main.onrender.com";
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

  document.addEventListener('DOMContentLoaded', function () {

    // =============================================
    // 1. MENÚ HAMBURGUESA (RESPONSIVE)
    // =============================================
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
        e.stopPropagation(); // Evitar que el clic se propague
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

      // Cerrar el menú al hacer clic fuera (en móvil)
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

    // =============================================
    // 2. LÓGICA DEL DROPDOWN (EL CORAZÓN DEL PROBLEMA)
    // =============================================
    
    // Usamos delegación de eventos en el body para capturar el clic de forma segura
    document.body.addEventListener('click', function(e) {
      var navUser = e.target.closest('#navUserContainer');
      var userDropdown = document.getElementById('userDropdown');
      
      if (!userDropdown) return;

      // Si el clic fue en el botón del usuario
      if (navUser) {
        // Prevenir el cierre inmediato por burbujeo
        e.stopPropagation(); 
        
        // Alternar el menú
        userDropdown.classList.toggle('show');
        
        // Forzar z-index para que aparezca arriba de todo
        if (userDropdown.classList.contains('show')) {
          userDropdown.style.zIndex = '99999';
        }
      } 
      // Si el clic fue en cualquier otro lado, cerramos el menú
      else if (!e.target.closest('#userDropdown')) {
        userDropdown.classList.remove('show');
      }
    });

    // =============================================
    // 3. INYECTAR MODAL "MI PERFIL" (Solo si no existe)
    // =============================================
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

    // =============================================
    // 4. LOGOUT (Lógica directa)
    // =============================================
    // Usamos delegación para el botón de logout
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

    // =============================================
    // 5. ANIMACIÓN DE TRANSICIÓN DE PÁGINA (SOLO PC)
    // =============================================
    if (window.innerWidth > 900) {
      // Interceptar clics en enlaces internos para animar la salida
      document.body.addEventListener('click', function(e) {
        var link = e.target.closest('a');
        if (!link) return;

        var href = link.getAttribute('href');

        // Ignorar enlaces vacíos, anclas, externos, mailto, tel, target _blank o con modificadores
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

        // Evitar doble transición
        if (document.body.classList.contains('page-transition-out')) return;

        e.preventDefault();
        document.body.classList.add('page-transition-out');

        // Navegar tras la animación
        setTimeout(function() {
          window.location.href = href;
        }, 280);
      });

      // Al volver con el botón "atrás" del navegador, quitar la clase de salida
      window.addEventListener('pageshow', function(event) {
        if (event.persisted) {
          document.body.classList.remove('page-transition-out');
        }
      });
    }

    console.log("✅ Navbar, Dropdown y Modal (cascarón) inicializados con animaciones.");
  });
})();