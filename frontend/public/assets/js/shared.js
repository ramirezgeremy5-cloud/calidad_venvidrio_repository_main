/* ==========================================
   VENVIDRIO - SHARED
   Navbar, Reloj, Dropdown, Modal Mi Perfil, Roles
   v12 - Blindaje de modales, mejoras de rendimiento y limpieza
   ========================================== */

(function () {
  'use strict';

  // ==========================================================
  // DETECCIÓN DE ENTORNO
  // ==========================================================
  const API_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
    ? "http://127.0.0.1:8000"
    : "https://calidad-venvidrio-repository-main.onrender.com";

  // ==========================================================
  // UTILIDADES
  // ==========================================================
  const $ = (id) => document.getElementById(id);
  const val = (id) => String($(id)?.value ?? '').trim();

  function authHeaders() {
    return {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    };
  }

  function obtenerUrlFoto(fotoUrl) {
    if (!fotoUrl) return null;
    if (/^https?:\/\//i.test(fotoUrl)) return fotoUrl;
    return `${API_URL}${fotoUrl.startsWith('/') ? '' : '/'}${fotoUrl}`;
  }

  function iniciales(nombre) {
    if (!nombre) return '??';
    const p = String(nombre).trim().split(/\s+/);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || p[0]?.[1] || '')).toUpperCase();
  }

  function toast(msg, tipo = 'success') {
    const el = document.querySelector('.toast, #toast-usuarios');
    const txt = document.getElementById('toast-text') || el?.querySelector('span');
    if (el && txt) {
      txt.textContent = msg;
      el.classList.remove('error');
      if (tipo === 'error') el.classList.add('error');
      el.classList.add('show');
      clearTimeout(window._sharedToastTimer);
      window._sharedToastTimer = setTimeout(() => el.classList.remove('show'), 3000);
    } else {
      if (tipo === 'error') alert('⚠️ ' + msg);
      else console.log('✅ ' + msg);
    }
  }

  // ==========================================================
  // RELOJ EN TIEMPO REAL
  // ==========================================================
  function iniciarReloj() {
    const reloj = document.getElementById('reloj-real');
    if (!reloj) {
      setTimeout(iniciarReloj, 100);
      return;
    }

    const actualizarHora = () => {
      try {
        const ahora = new Date();
        const fechaStr = ahora.toLocaleDateString('es-VE', {
          weekday: 'long', day: 'numeric', month: 'short'
        });
        const horaStr = ahora.toLocaleTimeString('es-VE', {
          hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        reloj.textContent = fechaStr.charAt(0).toUpperCase() + fechaStr.slice(1) + ' | ' + horaStr;
      } catch (e) {
        console.error('Error actualizando el reloj:', e);
      }
    };

    actualizarHora();
    if (window.relojInterval) clearInterval(window.relojInterval);
    window.relojInterval = setInterval(actualizarHora, 1000);
  }

  iniciarReloj();
  document.addEventListener('DOMContentLoaded', iniciarReloj);

  // ==========================================================
  // CONTROL DE ACCESO AL MENÚ (Roles + Cargos)
  // ==========================================================
  function controlarMenuPorRol() {
    const rol = parseInt(localStorage.getItem('role'), 10);
    const userStr = localStorage.getItem('user');

    if (isNaN(rol) || !userStr) return;

    let user = {};
    try { user = JSON.parse(userStr); } catch (_) { return; }

    const permisosCargo = user.permisos_cargo
      ? String(user.permisos_cargo).toLowerCase().split(',').map(p => p.trim())
      : [];

    const linkUsuarios = document.getElementById('navUsuariosLink');
    const linkAuditoriaInterna = document.getElementById('navAuditoriaInternaLink');
    const linkAuditoriaProducto = document.getElementById('navAuditoriaProductoLink');

    const puedeVerUsuarios = (rol === 3);
    const puedeVerAuditoriaInt = (rol === 2 || rol === 3);
    const puedeVerAuditoriaProd = (rol === 2 || rol === 3 || permisosCargo.includes('auditoria_producto'));

    if (linkUsuarios && !puedeVerUsuarios) linkUsuarios.remove();
    if (linkAuditoriaInterna && !puedeVerAuditoriaInt) linkAuditoriaInterna.remove();
    if (linkAuditoriaProducto && !puedeVerAuditoriaProd) linkAuditoriaProducto.remove();
  }

  // ==========================================================
  // MODAL "MI PERFIL" (Blindado con estilos en línea)
  // ==========================================================
  function crearModalPerfil() {
    if (document.getElementById('modalMiPerfil')) return;

    const modalHtml = `
      <div class="modal-overlay" id="modalMiPerfil" style="display:none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); z-index: 2147483647; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px);">
        <div class="modal-box" style="max-width: 550px; width: 100%; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 60px -12px rgba(15, 23, 42, 0.5); display: flex; flex-direction: column;">
          <div class="modal-header" style="display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; background: linear-gradient(135deg, #1a237e 0%, #3949ab 55%, #5c6bc0 100%); color: #fff;">
            <h2 style="margin: 0; font-size: 1.15rem; display: flex; align-items: center; gap: 10px;"><i class="ti ti-user-circle"></i> Mi Perfil</h2>
            <button class="modal-close" id="perfil-close" style="background: rgba(255,255,255,0.15); border: none; color: #fff; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i class="ti ti-x"></i></button>
          </div>
          <div class="modal-body" style="padding: 24px; overflow-y: auto; max-height: 70vh;">
            <div class="field" style="display: flex; flex-direction: column; align-items: center; margin-bottom: 1.5rem;">
              <div id="miPerfil-avatar-container" style="position: relative; cursor: pointer; width: 100px; height: 100px; border-radius: 50%; border: 2px dashed var(--border); display: flex; align-items: center; justify-content: center; background: #f8f9fa; overflow: hidden;">
                <i class="ti ti-camera" style="font-size: 32px; color: var(--text-muted);" id="miPerfil-icono-camara"></i>
                <img id="miPerfil-preview-foto" src="" style="width: 100%; height: 100%; object-fit: cover; display: none;">
              </div>
              <input type="file" id="miPerfil-file-foto" accept="image/*" style="display: none;">
              <small style="font-size:10px;color:var(--text-hint);margin-top:5px;">Clic en la foto para cambiarla</small>
            </div>
            <div class="grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="field">
                <label style="display: block; font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Nombre Completo *</label>
                <input type="text" id="miPerfil-nombre" style="width: 100%; padding: 11px 14px; border: 1.5px solid #dde3ee; border-radius: 10px; font-size: 14px;" />
              </div>
              <div class="field">
                <label style="display: block; font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Cédula</label>
                <input type="text" id="miPerfil-cedula" style="width: 100%; padding: 11px 14px; border: 1.5px solid #dde3ee; border-radius: 10px; font-size: 14px;" />
              </div>
            </div>
            <div class="field" style="margin-top: 14px;">
              <label style="display: block; font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Correo Electrónico (No editable)</label>
              <input type="email" id="miPerfil-correo" disabled style="width: 100%; padding: 11px 14px; border: 1.5px solid #dde3ee; border-radius: 10px; font-size: 14px; background:#f5f5f5; cursor:not-allowed;" />
            </div>
            <div class="grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px;">
              <div class="field">
                <label style="display: block; font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Turno (Asignado)</label>
                <input type="text" id="miPerfil-turno" disabled style="width: 100%; padding: 11px 14px; border: 1.5px solid #dde3ee; border-radius: 10px; font-size: 14px; background:#f5f5f5;" />
              </div>
              <div class="field">
                <label style="display: block; font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Cargo (Asignado)</label>
                <input type="text" id="miPerfil-cargo" disabled style="width: 100%; padding: 11px 14px; border: 1.5px solid #dde3ee; border-radius: 10px; font-size: 14px; background:#f5f5f5;" />
              </div>
            </div>
            <div class="grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px;">
              <div class="field">
                <label style="display: block; font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Fecha de Ingreso</label>
                <input type="date" id="miPerfil-fecha-ingreso" style="width: 100%; padding: 11px 14px; border: 1.5px solid #dde3ee; border-radius: 10px; font-size: 14px;" />
              </div>
              <div class="field">
                <label style="display: block; font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Fecha de Nacimiento</label>
                <input type="date" id="miPerfil-fecha-nacimiento" style="width: 100%; padding: 11px 14px; border: 1.5px solid #dde3ee; border-radius: 10px; font-size: 14px;" />
              </div>
            </div>
            <div class="modal-error" id="miPerfil-error" style="display:none; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 10px; padding: 10px 14px; font-size: 13px; margin-top: 12px;"></div>
          </div>
          <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 16px 22px; background: #f8fafc; border-top: 1px solid #e9edf5;">
            <button class="btn btn-outline" id="miPerfil-cancelar" style="padding: 11px 22px; border-radius: 10px; border: 1.5px solid #dde3ee; background: #fff; color: #475569; cursor: pointer; font-weight: 600;">Cancelar</button>
            <button class="btn btn-primary" id="miPerfil-guardar" style="padding: 11px 22px; border-radius: 10px; border: none; background: linear-gradient(135deg, #3949ab, #1a237e); color: #fff; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 8px;"><i class="ti ti-device-floppy"></i> Actualizar Datos</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  let archivoFotoPerfil = null;

  function abrirModalPerfil() {
    crearModalPerfil();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) {
      alert('No hay sesión activa');
      return;
    }

    $('miPerfil-nombre').value = user.nombre || '';
    $('miPerfil-cedula').value = user.cedula || '';
    $('miPerfil-correo').value = user.correo || '';
    $('miPerfil-turno').value = user.turno || '—';
    $('miPerfil-cargo').value = user.cargo || '—';
    $('miPerfil-fecha-ingreso').value = user.fecha_ingreso || '';
    $('miPerfil-fecha-nacimiento').value = user.fecha_nacimiento || '';

    archivoFotoPerfil = null;
    const previewImg = $('miPerfil-preview-foto');
    const iconCamara = $('miPerfil-icono-camara');
    if (user.foto_url) {
      previewImg.src = obtenerUrlFoto(user.foto_url);
      previewImg.style.display = 'block';
      iconCamara.style.display = 'none';
    } else {
      previewImg.style.display = 'none';
      iconCamara.style.display = 'block';
    }
    $('miPerfil-file-foto').value = '';
    $('miPerfil-error').style.display = 'none';

    // Mostrar con animación
    const modal = $('modalMiPerfil');
    modal.style.display = 'flex';
    void modal.offsetWidth;
  }

  function cerrarModalPerfil() {
    const modal = $('modalMiPerfil');
    if (modal) {
      modal.style.display = 'none';
    }
    archivoFotoPerfil = null;
  }

  function mostrarErrorPerfil(msg) {
    const el = $('miPerfil-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  }

  async function guardarPerfil() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) return;

    const nombre = val('miPerfil-nombre');
    const cedula = val('miPerfil-cedula');
    const fechaIngreso = val('miPerfil-fecha-ingreso');
    const fechaNacimiento = val('miPerfil-fecha-nacimiento');

    if (!nombre || nombre.length < 3) {
      mostrarErrorPerfil('El nombre debe tener al menos 3 caracteres');
      return;
    }

    const btn = $('miPerfil-guardar');
    if (btn) btn.disabled = true;

    let fotoUrlFinal = user.foto_url || null;

    if (archivoFotoPerfil) {
      try {
        const formData = new FormData();
        formData.append('file', archivoFotoPerfil);
        const res = await fetch(`${API_URL}/usuarios/upload-foto`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: formData
        });
        if (!res.ok) throw new Error('Error al subir foto');
        const data = await res.json();
        fotoUrlFinal = data.url;
      } catch (e) {
        mostrarErrorPerfil('No se pudo subir la foto de perfil');
        if (btn) btn.disabled = false;
        return;
      }
    }

    const payload = {
      nombre,
      cedula: cedula || null,
      fecha_ingreso: fechaIngreso || null,
      fecha_nacimiento: fechaNacimiento || null,
      foto_url: fotoUrlFinal
    };

    try {
      const res = await fetch(`${API_URL}/usuarios/${user.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      user.nombre = nombre;
      user.cedula = cedula;
      user.fecha_ingreso = fechaIngreso;
      user.fecha_nacimiento = fechaNacimiento;
      user.foto_url = fotoUrlFinal;
      localStorage.setItem('user', JSON.stringify(user));

      const navAvatar = $('navAvatar');
      const dropdownAvatar = $('dropdownAvatar');
      const navUsername = $('navUsername');
      const dropdownName = $('dropdownName');

      if (navAvatar) {
        navAvatar.innerHTML = fotoUrlFinal
          ? `<img src="${obtenerUrlFoto(fotoUrlFinal)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
          : iniciales(nombre);
      }
      if (dropdownAvatar) {
        dropdownAvatar.innerHTML = fotoUrlFinal
          ? `<img src="${obtenerUrlFoto(fotoUrlFinal)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
          : iniciales(nombre);
      }
      if (navUsername) navUsername.textContent = nombre;
      if (dropdownName) dropdownName.textContent = nombre;

      toast('Perfil actualizado correctamente');
      cerrarModalPerfil();
    } catch (e) {
      mostrarErrorPerfil(e.message || 'No se pudo actualizar el perfil');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ==========================================================
  // INICIALIZACIÓN (DOMContentLoaded)
  // ==========================================================
  document.addEventListener('DOMContentLoaded', () => {

    // 1. Control de roles
    controlarMenuPorRol();

    // 2. Menú hamburguesa
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

      navToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = navLinks.classList.toggle('active');
        const icon = navToggle.querySelector('i');
        if (isActive) {
          icon.className = 'ti ti-x';
          navToggle.setAttribute('aria-expanded', 'true');
        } else {
          icon.className = 'ti ti-menu-2';
          navToggle.setAttribute('aria-expanded', 'false');
        }
      });

      navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          if (window.innerWidth <= 900) {
            navLinks.classList.remove('active');
            const icon = navToggle.querySelector('i');
            if (icon) icon.className = 'ti ti-menu-2';
            navToggle.setAttribute('aria-expanded', 'false');
          }
        });
      });

      document.addEventListener('click', (e) => {
        if (window.innerWidth <= 900 && navLinks.classList.contains('active')) {
          if (!navLinks.contains(e.target) && !navToggle.contains(e.target)) {
            navLinks.classList.remove('active');
            const icon = navToggle.querySelector('i');
            if (icon) icon.className = 'ti ti-menu-2';
            navToggle.setAttribute('aria-expanded', 'false');
          }
        }
      });
    }

    // 3. Dropdown del usuario (con animación)
    document.body.addEventListener('click', (e) => {
      const navUser = e.target.closest('#navUserContainer');
      const userDropdown = document.getElementById('userDropdown');
      if (!userDropdown) return;

      if (navUser) {
        e.stopPropagation();
        userDropdown.classList.toggle('show');
      } else if (!e.target.closest('#userDropdown')) {
        userDropdown.classList.remove('show');
      }
    });

    // 4. Abrir modal Mi Perfil
    document.body.addEventListener('click', (e) => {
      if (e.target.closest('#dropdownPerfil')) {
        e.preventDefault();
        document.getElementById('userDropdown')?.classList.remove('show');
        abrirModalPerfil();
      }
    });

    // 5. Cerrar modal Mi Perfil
    document.body.addEventListener('click', (e) => {
      if (e.target.closest('#perfil-close') || e.target.closest('#miPerfil-cancelar')) {
        cerrarModalPerfil();
      }
      if (e.target.id === 'modalMiPerfil') {
        cerrarModalPerfil();
      }
    });

    // 6. Guardar perfil
    document.body.addEventListener('click', (e) => {
      if (e.target.closest('#miPerfil-guardar')) {
        guardarPerfil();
      }
    });

    // 7. Avatar click → input file
    document.body.addEventListener('click', (e) => {
      if (e.target.closest('#miPerfil-avatar-container')) {
        $('miPerfil-file-foto')?.click();
      }
    });

    // 8. Preview de foto en modal Mi Perfil
    document.body.addEventListener('change', (e) => {
      if (e.target.id === 'miPerfil-file-foto') {
        const file = e.target.files[0];
        if (!file) return;
        archivoFotoPerfil = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = $('miPerfil-preview-foto');
          const icon = $('miPerfil-icono-camara');
          if (img) { img.src = ev.target.result; img.style.display = 'block'; }
          if (icon) icon.style.display = 'none';
        };
        reader.readAsDataURL(file);
      }
    });

    // 9. Logout
    document.body.addEventListener('click', (e) => {
      const logoutBtn = e.target.closest('#dropdownLogout');
      if (!logoutBtn) return;
      e.preventDefault();
      if (!confirm('¿Estás seguro de que deseas cerrar sesión?')) return;

      const token = localStorage.getItem('token');
      const finalizar = () => {
        if (window.relojInterval) clearInterval(window.relojInterval);
        localStorage.clear();
        window.location.href = '/login.html'; 
      };

      if (token) {
        fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        }).catch(() => {}).finally(finalizar);
      } else {
        finalizar();
      }
    });

    // 10. Animación de transición entre páginas (solo PC)
    if (window.innerWidth > 900) {
      document.body.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;
        const href = link.getAttribute('href');
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
        setTimeout(() => { window.location.href = href; }, 280);
      });

      window.addEventListener('pageshow', (event) => {
        if (event.persisted) document.body.classList.remove('page-transition-out');
      });
    }

    // 11. Actualizar avatar del navbar desde localStorage al cargar
    actualizarNavbarDesdeLocalStorage();

    console.log('✅ Navbar, Dropdown, Reloj y Modal inicializados.');
  });

  // ==========================================================
  // ACTUALIZAR AVATAR DEL NAVBAR
  // ==========================================================
  function actualizarNavbarDesdeLocalStorage() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) return;

    const navAvatar = document.getElementById('navAvatar');
    const dropdownAvatar = document.getElementById('dropdownAvatar');
    const navUsername = document.getElementById('navUsername');
    const dropdownName = document.getElementById('dropdownName');
    const dropdownEmail = document.getElementById('dropdownEmail');

    const avatarHtml = user.foto_url
      ? `<img src="${obtenerUrlFoto(user.foto_url)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : iniciales(user.nombre);

    if (navAvatar) navAvatar.innerHTML = avatarHtml;
    if (dropdownAvatar) dropdownAvatar.innerHTML = avatarHtml;
    if (navUsername) navUsername.textContent = user.nombre || 'Usuario';
    if (dropdownName) dropdownName.textContent = user.nombre || 'Usuario';
    if (dropdownEmail) dropdownEmail.textContent = user.correo || '—';
  }

})();