/* ==========================================
   VENVIDRIO - USUARIOS
   usuarios.js - Gestión de usuarios + CRUD de cargos con Permisos
   v5 - Filtros avanzados + Bloqueo de eliminación + Chips de permisos
   ========================================== */

(function () {
  'use strict';

  // Detectar la URL de la API
  let API_URL;
  if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    API_URL = "http://127.0.0.1:8000";
  } else {
    API_URL = "https://calidad-venvidrio-repository-main.onrender.com";
  }

  const ROLES_PERMITIDOS = [3]; // Solo admin

  const ROL_LABEL = { 1: 'Usuario', 2: 'Supervisor', 3: 'Administrador' };
  const ROL_CLASS = { 1: 'rol-usuario', 2: 'rol-supervisor', 3: 'rol-admin' };

  // =========================
  // ESTADO
  // =========================
  let usuarios = [];
  let cargos = [];
  let usuarioEditando = null;
  let usuarioEliminando = null;
  let usuarioActual = null;
  let rolActual = 0;
  
  // Variables para la foto
  let archivoFotoSeleccionado = null;
  let urlFotoActual = null;

  // =========================
  // UTILIDADES
  // =========================
  function log(m, d)     { console.log(`[${new Date().toLocaleTimeString()}] 🔍 ${m}`, d || ''); }
  function logError(m,e) { console.error(`[${new Date().toLocaleTimeString()}] ❌ ${m}`, e || ''); }
  function logSuccess(m,d){ console.log(`[${new Date().toLocaleTimeString()}] ✅ ${m}`, d || ''); }

  function $(id) { return document.getElementById(id); }
  function val(id) { const el = $(id); return el ? String(el.value).trim() : ''; }
  function setText(id,t){ const el = $(id); if (el) el.textContent = t; }

  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function fmtFecha(f) {
    if (!f) return '—';
    const d = new Date(f);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-ES') + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  function iniciales(nombre) {
    if (!nombre) return '??';
    const p = String(nombre).trim().split(/\s+/);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || p[0]?.[1] || '')).toUpperCase();
  }

  function authHeaders() {
    return {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    };
  }

  function obtenerUrlFoto(fotoUrl) {
    if (!fotoUrl) return null;
    if (fotoUrl.startsWith('http://') || fotoUrl.startsWith('https://')) {
      return fotoUrl;
    }
    return `${API_URL}${fotoUrl}`;
  }

  function toast(msg, tipo) {
    const t = $('toast-usuarios');
    const txt = $('toast-text');
    if (!t || !txt) { tipo === 'error' ? alert(msg) : log(msg); return; }
    txt.textContent = msg;
    t.classList.remove('error');
    if (tipo === 'error') t.classList.add('error');
    t.classList.add('show');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
  }

  // =========================
  // CONTROL DE ACCESO
  // =========================
  function verificarAcceso() {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '../public/login.html'; return false; }

    const rol = parseInt(localStorage.getItem('role'), 10);
    rolActual = isNaN(rol) ? 0 : rol;

    if (!ROLES_PERMITIDOS.includes(rolActual)) {
      alert('⛔ Acceso restringido.\n\nEl módulo de Usuarios es exclusivo para Administradores.');
      window.location.href = '../public/dashboard.html';
      return false;
    }
    return true;
  }

  // =========================
  // CARGA DE CARGOS
  // =========================
  async function cargarCargos() {
    try {
      const response = await fetch(`${API_URL}/cargos/?t=${Date.now()}`, { headers: authHeaders() });
      if (response.ok) {
        const data = await response.json();
        const lista = Array.isArray(data) ? data : (data.items || data.cargos || []);
        cargos = lista.map(c => ({
          id: c.id,
          nombre: c.nombre || c.cargo || 'Sin nombre',
          uso: Number(c.uso || c.total_usuarios || 0),
          permisos: c.permisos || '' 
        }));
        logSuccess(`${cargos.length} cargos cargados`);
        return;
      }
    } catch (e) {
      logError('Error cargando cargos:', e);
    }
  }

  async function crearCargo(nombre, permisos) {
    if (!nombre) return null;
    if (cargos.some(c => c.nombre.toLowerCase() === nombre.toLowerCase())) {
      toast('Ese cargo ya existe', 'error');
      return null;
    }

    try {
      const response = await fetch(`${API_URL}/cargos/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ nombre, permisos })
      });
      if (response.ok) {
        const data = await response.json();
        const nuevo = { 
          id: data.id || Date.now(), 
          nombre: data.nombre || nombre, 
          uso: 0,
          permisos: data.permisos || permisos
        };
        cargos.push(nuevo);
        return nuevo;
      }
    } catch (e) {
      logError('No se pudo crear cargo en backend:', e);
    }
    return null;
  }

  async function editarCargo(id, nombre, permisos) {
    try {
      const response = await fetch(`${API_URL}/cargos/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ nombre, permisos })
      });
      if (response.ok) {
        const data = await response.json();
        const index = cargos.findIndex(c => String(c.id) === String(id));
        if (index !== -1) {
          cargos[index].nombre = data.nombre || nombre;
          cargos[index].permisos = data.permisos || permisos;
        }
        return true;
      }
    } catch (e) {
      logError('No se pudo editar el cargo:', e);
    }
    return false;
  }

  async function eliminarCargo(id) {
    const cargo = cargos.find(c => String(c.id) === String(id));
    if (!cargo) return;

    // 👇 BLOQUEO EN EL FRONTEND: No permitir clic si tiene usuarios asignados
    const asignados = usuarios.filter(u => String(u.cargo_id) === String(id)).length;
    if (asignados > 0) {
      toast(`No se puede eliminar "${cargo.nombre}" (${asignados} usuario(s) asignado(s))`, 'error');
      return;
    }

    if (!confirm(`¿Eliminar el cargo "${cargo.nombre}"?`)) return;

    try {
      const response = await fetch(`${API_URL}/cargos/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (response.ok) logSuccess(`Cargo ${id} eliminado`);
    } catch (e) {
      logError('No se pudo eliminar cargo en backend:', e);
    }

    cargos = cargos.filter(c => String(c.id) !== String(id));
    renderCargos();
    renderTabla();
  }

  // 👇 RENDERIZADO CON CHIPS DE PERMISOS Y BLOQUEO
  function renderCargos() {
    const cont = $('lista-cargos');
    if (!cont) return;

    setText('badge-cargos', cargos.length);

    if (cargos.length === 0) {
      cont.innerHTML = `
        <div class="empty-panel">
          <i class="ti ti-briefcase"></i>
          <span>Sin cargos definidos aún</span>
        </div>`;
      return;
    }

    cont.innerHTML = cargos.map(c => {
      const asignados = usuarios.filter(u => String(u.cargo_id) === String(c.id)).length;
      const permisosArr = c.permisos ? c.permisos.split(',').map(p => p.trim()).filter(Boolean) : [];
      
      const chipsPermisos = permisosArr.length > 0
        ? permisosArr.map(p => `<span class="chip-permiso"><i class="ti ti-shield-check"></i> ${esc(p)}</span>`).join('')
        : `<span class="chip-permiso sin-permisos">Sin permisos especiales</span>`;

      const bloqueado = asignados > 0;
      
      return `
        <div class="cargo-item" data-id="${esc(c.id)}">
          <div class="cargo-icon"><i class="ti ti-id-badge-2"></i></div>
          <div class="cargo-info">
            <div class="cargo-nombre">${esc(c.nombre)}</div>
            <div class="cargo-uso ${asignados > 0 ? 'tiene-asignados' : ''}">
              ${asignados} usuario${asignados !== 1 ? 's' : ''} asignado${asignados !== 1 ? 's' : ''}
            </div>
            <div class="cargo-permisos-lista">${chipsPermisos}</div>
          </div>
          <div style="display:flex; gap:4px;">
            <button class="btn-icon" data-editar-cargo="${esc(c.id)}" title="Editar permisos">
              <i class="ti ti-edit"></i>
            </button>
            <button class="btn-icon btn-icon-danger" data-eliminar-cargo="${esc(c.id)}" title="${bloqueado ? 'No se puede eliminar (tiene usuarios)' : 'Eliminar cargo'}" ${bloqueado ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
              <i class="ti ti-trash"></i>
            </button>
          </div>
        </div>`;
    }).join('');

    cont.querySelectorAll('[data-eliminar-cargo]').forEach(btn => {
      if (btn.hasAttribute('disabled')) return;
      btn.addEventListener('click', () => eliminarCargo(btn.dataset.eliminarCargo));
    });
    
    cont.querySelectorAll('[data-editar-cargo]').forEach(btn => {
      btn.addEventListener('click', () => abrirModalCargo(btn.dataset.editarCargo));
    });
  }

  function initCargosUI() {
    $('btn-add-cargo')?.addEventListener('click', async () => {
      const input = $('nuevo-cargo');
      const nombre = (input?.value || '').trim();
      if (!nombre) { toast('Escriba el nombre del cargo', 'error'); input?.focus(); return; }
      if (nombre.length < 3) { toast('El nombre debe tener al menos 3 caracteres', 'error'); return; }

      // Abrimos el modal de cargo vacío
      abrirModalCargo(null, nombre);
      input.value = '';
    });

    $('nuevo-cargo')?.addEventListener('keypress', e => {
      if (e.key === 'Enter') { e.preventDefault(); $('btn-add-cargo')?.click(); }
    });
  }

  // =========================
  // CARGA DE USUARIOS
  // =========================
  async function cargarUsuarios() {
    try {
      const response = await fetch(`${API_URL}/usuarios/?t=${Date.now()}`, { headers: authHeaders() });
      if (response.ok) {
        const data = await response.json();
        const lista = Array.isArray(data) ? data : (data.items || data.usuarios || []);
        usuarios = lista.map(u => ({
          id: u.id,
          nombre: u.nombre || 'Sin nombre',
          cedula: u.cedula || '',
          correo: u.correo || '—',
          rol: parseInt(u.rol_id || u.rol || 1, 10),
          activo: u.activo !== false,
          cargo_id: u.cargo_id || null,
          cargo: u.cargo || null,
          turno: u.turno || '',
          fecha_ingreso: u.fecha_ingreso || '',
          fecha_nacimiento: u.fecha_nacimiento || '',
          foto_url: u.foto_url || '',
          ultimo_login: u.ultimo_login || null
        }));
        renderTabla();
        actualizarStats();
        poblarCargoDeCargos();
        poblarFiltroCargos();
        return;
      }
    } catch (e) {
      logError('Error cargando usuarios:', e);
    }
  }

  function poblarCargoDeCargos() {
    usuarios.forEach(u => {
      if (!u.cargo && u.cargo_id) {
        const c = cargos.find(x => String(x.id) === String(u.cargo_id));
        u.cargo = c ? c.nombre : null;
      }
    });
  }

  // 👇 POBLAR EL NUEVO SELECT DE FILTRO POR CARGO
  function poblarFiltroCargos() {
    const select = $('filtro-cargo');
    if (!select) return;
    const actual = select.value;
    select.innerHTML = '<option value="">Todos los cargos</option>';
    
    // Solo cargos que tienen al menos un usuario asignado
    const cargosConUso = cargos.filter(c => usuarios.some(u => String(u.cargo_id) === String(c.id)));
    
    cargosConUso.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nombre;
      select.appendChild(opt);
    });
    
    if (actual) select.value = actual;
  }

  // =========================
  // KPIs
  // =========================
  function actualizarStats() {
    setText('stat-total', usuarios.length);
    setText('stat-activos', usuarios.filter(u => u.activo).length);
    setText('stat-admins', usuarios.filter(u => u.rol === 3).length);
    setText('stat-supervisores', usuarios.filter(u => u.rol === 2).length);
    setText('stat-usuarios', usuarios.filter(u => u.rol === 1).length);
  }

  // =========================
  // TABLA DE USUARIOS
  // =========================
  function filtrarUsuarios() {
    const nombre  = val('filtro-nombre').toLowerCase();
    const correo  = val('filtro-correo').toLowerCase();
    const rol     = val('filtro-rol');
    const cargo   = val('filtro-cargo');
    const activo  = val('filtro-activo');
    const inactividadDias = parseInt(val('filtro-inactividad'), 10);
    const ahora = Date.now();

    return usuarios.filter(u => {
      if (nombre && !String(u.nombre).toLowerCase().includes(nombre)) return false;
      if (correo && !String(u.correo).toLowerCase().includes(correo)) return false;
      if (rol    && String(u.rol) !== rol) return false;
      if (cargo  && String(u.cargo_id) !== cargo) return false;
      if (activo === 'true'  && !u.activo) return false;
      if (activo === 'false' &&  u.activo) return false;
      
      // 👇 FILTRO DE INACTIVIDAD
      if (inactividadDias) {
        if (!u.ultimo_login) return true; // Si nunca entró, cuenta como inactivo
        const ultima = new Date(u.ultimo_login).getTime();
        if (isNaN(ultima)) return true;
        const dias = Math.floor((ahora - ultima) / (1000 * 60 * 60 * 24));
        if (dias < inactividadDias) return false;
      }
      
      return true;
    });
  }

  function renderTabla() {
    const tbody = $('tabla-usuarios');
    if (!tbody) return;

    const lista = filtrarUsuarios();
    setText('filtro-resultados', `📋 ${lista.length} usuario(s) mostrado(s)`);

    if (lista.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted)">
        Sin usuarios con los filtros actuales
      </td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(u => {
      const rolCls = ROL_CLASS[u.rol] || 'rol-usuario';
      const rolTxt = ROL_LABEL[u.rol] || 'Usuario';
      const esSelf = usuarioActual && String(usuarioActual.id) === String(u.id);

      const avatarHtml = u.foto_url 
        ? `<img src="${obtenerUrlFoto(u.foto_url)}" class="avatar-mini" style="object-fit:cover;">`
        : `<div class="avatar-mini">${esc(iniciales(u.nombre))}</div>`;

      return `
        <tr>
          <td>
            <div class="user-cell">
              ${avatarHtml}
              <div class="user-info">
                <div class="user-name">${esc(u.nombre)}</div>
                <div class="user-id">ID ${esc(u.id)}</div>
              </div>
            </div>
          </td>
          <td style="font-size:12.5px;color:var(--text-muted)">${esc(u.correo)}</td>
          <td><span class="rol-badge ${rolCls}">${esc(rolTxt)}</span></td>
          <td>
            ${u.cargo
              ? `<span class="cargo-badge">${esc(u.cargo)}</span>`
              : `<span class="cargo-badge sin-cargo">Sin cargo</span>`}
          </td>
          <td>
            <span class="estado-badge ${u.activo ? 'activo' : 'inactivo'}">
              ${u.activo ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td style="font-size:11.5px;color:var(--text-muted)">${fmtFecha(u.ultimo_login)}</td>
          <td>
            <div class="acciones-cell">
              <button class="btn-icon" data-editar="${esc(u.id)}" title="Editar">
                <i class="ti ti-pencil"></i>
              </button>
              <button class="btn-icon btn-icon-danger" data-eliminar="${esc(u.id)}" title="Eliminar" ${esSelf ? 'disabled' : ''}>
                <i class="ti ti-trash"></i>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-editar]').forEach(btn => {
      btn.addEventListener('click', () => abrirModalEditar(btn.dataset.editar));
    });

    tbody.querySelectorAll('[data-eliminar]').forEach(btn => {
      btn.addEventListener('click', () => abrirModalEliminar(btn.dataset.eliminar));
    });
  }

  function initFiltros() {
    $('btn-aplicar-filtros')?.addEventListener('click', renderTabla);
    $('btn-limpiar-filtros')?.addEventListener('click', () => {
      ['filtro-nombre', 'filtro-correo', 'filtro-rol', 'filtro-cargo', 'filtro-activo', 'filtro-inactividad']
        .forEach(id => { const el = $(id); if (el) el.value = ''; });
      renderTabla();
    });

    let timer;
    ['filtro-nombre', 'filtro-correo'].forEach(id => {
      $(id)?.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(renderTabla, 250);
      });
    });

    ['filtro-rol', 'filtro-cargo', 'filtro-activo', 'filtro-inactividad'].forEach(id => {
      $(id)?.addEventListener('change', renderTabla);
    });
  }

  // =========================
  // MODAL CREAR/EDITAR USUARIO
  // =========================
  function poblarSelectCargoModal() {
    const sel = $('modal-cargo');
    if (!sel) return;
    const actual = sel.value;
    sel.innerHTML = '<option value="">— Sin cargo asignado —</option>';
    cargos.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nombre;
      sel.appendChild(opt);
    });
    if (actual && cargos.some(c => String(c.id) === actual)) sel.value = actual;
  }

  function abrirModalCrear() {
    usuarioEditando = null;
    const t = $('modal-title');
    if (t) t.innerHTML = '<i class="ti ti-user-plus"></i> Nuevo Usuario';

    ['modal-nombre', 'modal-cedula', 'modal-correo-prefix', 'modal-password'].forEach(id => { const el = $(id); if (el) el.value = ''; });
    
    $('modal-rol').value = '1';
    $('modal-cargo').value = '';
    $('modal-turno').value = '';
    $('modal-fecha-ingreso').value = '';
    $('modal-fecha-nacimiento').value = '';
    
    archivoFotoSeleccionado = null;
    urlFotoActual = null;
    $('preview-foto').style.display = 'none';
    $('preview-foto').src = '';
    $('icono-camara').style.display = 'block';
    $('modal-file-foto').value = '';

    $('modal-activo').checked = true;
    $('modal-password-field').style.display = '';
    $('modal-activo-field').style.display = 'none';
    $('modal-error').style.display = 'none';

    poblarSelectCargoModal();
    $('modalUsuario').style.display = 'flex';
  }

  function abrirModalEditar(id) {
    const u = usuarios.find(x => String(x.id) === String(id));
    if (!u) return;

    usuarioEditando = u;
    const t = $('modal-title');
    if (t) t.innerHTML = '<i class="ti ti-pencil"></i> Editar Usuario';

    $('modal-user-id').value = u.id;
    $('modal-nombre').value = u.nombre;
    $('modal-cedula').value = u.cedula || '';

    const partesCorreo = u.correo.split('@');
    $('modal-correo-prefix').value = partesCorreo[0] || '';
    
    $('modal-password').value = '';
    $('modal-rol').value = String(u.rol);
    
    $('modal-turno').value = u.turno || '';
    $('modal-fecha-ingreso').value = u.fecha_ingreso || '';
    $('modal-fecha-nacimiento').value = u.fecha_nacimiento || '';

    $('modal-activo').checked = u.activo;

    archivoFotoSeleccionado = null;
    urlFotoActual = u.foto_url;
    $('modal-file-foto').value = '';
    
    const previewImg = $('preview-foto');
    const iconCamara = $('icono-camara');
    
    if (u.foto_url) {
      previewImg.src = obtenerUrlFoto(u.foto_url);
      previewImg.style.display = 'block';
      iconCamara.style.display = 'none';
    } else {
      previewImg.style.display = 'none';
      iconCamara.style.display = 'block';
    }

    $('modal-password-field').style.display = 'none';
    $('modal-activo-field').style.display = '';

    poblarSelectCargoModal();
    $('modal-cargo').value = u.cargo_id ? String(u.cargo_id) : '';

    $('modal-error').style.display = 'none';
    $('modalUsuario').style.display = 'flex';
  }

  function cerrarModalUsuario() {
    $('modalUsuario').style.display = 'none';
    usuarioEditando = null;
  }

  function mostrarErrorModal(msg) {
    const el = $('modal-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  }

  async function guardarUsuario() {
    const esEdicion = !!usuarioEditando;
    const nombre = val('modal-nombre');
    const cedula = val('modal-cedula');
    const prefijoCorreo = val('modal-correo-prefix'); 
    const password = val('modal-password');
    const rol = parseInt(val('modal-rol'), 10);
    const cargoId = val('modal-cargo');
    
    const turno = val('modal-turno'); 
    
    const fechaIngreso = val('modal-fecha-ingreso');
    const fechaNacimiento = val('modal-fecha-nacimiento');
    const activo = $('modal-activo')?.checked ?? true;

    $('modal-error').style.display = 'none';

    if (!nombre || nombre.length < 3) { mostrarErrorModal('El nombre debe tener al menos 3 caracteres'); return; }
    if (!prefijoCorreo) { mostrarErrorModal('El usuario del correo es obligatorio'); return; }
    if (!/^[a-zA-Z0-9._%+-]+$/.test(prefijoCorreo)) { mostrarErrorModal('El usuario del correo tiene caracteres inválidos'); return; }
    if (!turno) { mostrarErrorModal('Debe seleccionar un turno'); return; }
    
    if (!esEdicion && (!password || password.length < 8)) {
      mostrarErrorModal('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    const correoCompleto = `${prefijoCorreo}@venvidrio.com`;
    const btn = $('modal-guardar');
    if (btn) btn.disabled = true;

    let fotoUrlFinal = urlFotoActual;

    if (archivoFotoSeleccionado) {
      try {
        const formData = new FormData();
        formData.append("file", archivoFotoSeleccionado);

        const uploadRes = await fetch(`${API_URL}/usuarios/upload-foto`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: formData
        });

        if (uploadRes.ok) {
          const data = await uploadRes.json();
          fotoUrlFinal = data.url;
        } else {
          throw new Error('Error al subir la imagen');
        }
      } catch (err) {
        mostrarErrorModal('No se pudo subir la foto de perfil');
        if (btn) btn.disabled = false;
        return;
      }
    }

    const payload = {
      nombre,
      cedula: cedula || null,
      correo: correoCompleto,
      rol_id: rol,
      activo,
      cargo_id: cargoId ? parseInt(cargoId, 10) : null,
      turno: turno,
      fecha_ingreso: fechaIngreso || null,
      fecha_nacimiento: fechaNacimiento || null,
      foto_url: fotoUrlFinal || null
    };
    
    if (!esEdicion) payload.password = password;

    try {
      const url = esEdicion ? `${API_URL}/usuarios/${usuarioEditando.id}` : `${API_URL}/usuarios/`;
      const response = await fetch(url, {
        method: esEdicion ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        
        if (esEdicion && usuarioActual && String(usuarioActual.id) === String(usuarioEditando.id)) {
          const userLocal = JSON.parse(localStorage.getItem('user'));
          userLocal.nombre = nombre;
          userLocal.correo = correoCompleto;
          userLocal.foto_url = fotoUrlFinal;
          userLocal.cedula = cedula;
          userLocal.turno = turno;
          userLocal.fecha_nacimiento = fechaNacimiento;
          
          const cargoObj = cargos.find(c => String(c.id) === String(cargoId));
          userLocal.cargo = cargoObj ? cargoObj.nombre : null;
          
          localStorage.setItem('user', JSON.stringify(userLocal));
          usuarioActual = userLocal;
          
          const navAvatar = $('navAvatar');
          if (navAvatar) {
            navAvatar.innerHTML = fotoUrlFinal 
              ? `<img src="${obtenerUrlFoto(fotoUrlFinal)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
              : iniciales(nombre);
          }
          setText('navUsername', nombre);
        }
        
        toast(esEdicion ? 'Usuario actualizado' : 'Usuario creado');
        cerrarModalUsuario();
        await cargarUsuarios();
        renderCargos();
      } else {
        const err = await response.json().catch(() => ({}));
        let msj = err.detail || `HTTP ${response.status}`;
        if (Array.isArray(msj)) msj = msj.map(e => e.msg).join(', ');
        throw new Error(msj);
      }
    } catch (e) {
      mostrarErrorModal(e.message || 'No se pudo guardar el usuario');
      if (btn) btn.disabled = false;
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function initModalUsuario() {
    $('btn-nuevo-usuario')?.addEventListener('click', abrirModalCrear);
    $('modal-close')?.addEventListener('click', cerrarModalUsuario);
    $('modal-cancelar')?.addEventListener('click', cerrarModalUsuario);
    $('modal-guardar')?.addEventListener('click', guardarUsuario);

    $('modalUsuario')?.addEventListener('click', e => {
      if (e.target === $('modalUsuario')) cerrarModalUsuario();
    });

    $('modal-pw-toggle')?.addEventListener('click', () => {
      const inp = $('modal-password');
      const icon = $('modal-pw-icon');
      if (!inp || !icon) return;
      const hidden = inp.type === 'password';
      inp.type = hidden ? 'text' : 'password';
      icon.className = hidden ? 'ti ti-eye-off' : 'ti ti-eye';
    });

    const avatarContainer = $('perfil-avatar-container');
    const inputFile = $('modal-file-foto');
    const previewImg = $('preview-foto');
    const iconCamara = $('icono-camara');

    if (avatarContainer && inputFile) {
      avatarContainer.addEventListener('click', () => inputFile.click());
      inputFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        archivoFotoSeleccionado = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
          previewImg.src = ev.target.result;
          previewImg.style.display = 'block';
          iconCamara.style.display = 'none';
        };
        reader.readAsDataURL(file);
      });
    }
  }

  // =========================
  // MODAL CREAR/EDITAR CARGO (Permisos)
  // =========================
  function abrirModalCargo(id = null, nombre = '') {
    let modalCargo = $('modalCargo');
    if (!modalCargo) {
      const modalHtml = `
        <div class="modal-overlay" id="modalCargo" style="display:none;">
          <div class="modal-box" style="max-width:420px;">
            <div class="modal-header">
              <h2 id="modal-cargo-title"><i class="ti ti-briefcase"></i> Nuevo Cargo</h2>
              <button class="modal-close" id="modal-cargo-close"><i class="ti ti-x"></i></button>
            </div>
            <div class="modal-body">
              <div class="field">
                <label for="modal-cargo-nombre">Nombre del Cargo</label>
                <input type="text" id="modal-cargo-nombre" placeholder="Ej: Jefe de Calidad" />
              </div>
              <div class="field">
                <label style="margin-bottom:8px;">Permisos de Acceso</label>
                
                <!-- 👇 SOLO DEJAMOS AUDITORÍA PRODUCTO (Las otras dos son exclusivas por Rol) -->
                <label class="label-checkbox">
                  <input type="checkbox" value="auditoria_producto" class="permiso-check"> Auditoría Producto
                </label>
                
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" id="modal-cargo-cancelar">Cancelar</button>
              <button class="btn btn-primary" id="modal-cargo-guardar"><i class="ti ti-device-floppy"></i> Guardar Cargo</button>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      modalCargo = $('modalCargo');

      $('modal-cargo-close').addEventListener('click', cerrarModalCargo);
      $('modal-cargo-cancelar').addEventListener('click', cerrarModalCargo);
      $('modal-cargo-guardar').addEventListener('click', guardarCargoDesdeModal);
    }

    const title = $('modal-cargo-title');
    const inputNombre = $('modal-cargo-nombre');
    
    if (id) {
      const cargo = cargos.find(c => String(c.id) === String(id));
      if (cargo) {
        title.innerHTML = '<i class="ti ti-edit"></i> Editar Cargo';
        inputNombre.value = cargo.nombre;
        window._editingCargoId = id;
        
        const permisos = cargo.permisos ? cargo.permisos.split(',').map(p => p.trim()) : [];
        document.querySelectorAll('.permiso-check').forEach(chk => {
          chk.checked = permisos.includes(chk.value);
        });
      }
    } else {
      title.innerHTML = '<i class="ti ti-plus"></i> Nuevo Cargo';
      inputNombre.value = nombre || '';
      window._editingCargoId = null;
      document.querySelectorAll('.permiso-check').forEach(chk => chk.checked = false);
    }

    modalCargo.style.display = 'flex';
  }

  function cerrarModalCargo() {
    $('modalCargo').style.display = 'none';
    window._editingCargoId = null;
  }

  async function guardarCargoDesdeModal() {
    const nombre = val('modal-cargo-nombre');
    if (!nombre || nombre.length < 3) {
      alert('El nombre debe tener al menos 3 caracteres');
      return;
    }

    const checks = document.querySelectorAll('.permiso-check:checked');
    const permisos = Array.from(checks).map(chk => chk.value).join(',');

    const btn = $('modal-cargo-guardar');
    if (btn) btn.disabled = true;

    let exito = false;
    if (window._editingCargoId) {
      exito = await editarCargo(window._editingCargoId, nombre, permisos);
    } else {
      const nuevo = await crearCargo(nombre, permisos);
      exito = !!nuevo;
    }

    if (btn) btn.disabled = false;
    
    if (exito) {
      toast('Cargo guardado exitosamente');
      cerrarModalCargo();
      renderCargos();
      poblarSelectCargoModal();
      poblarFiltroCargos();
    } else {
      alert('No se pudo guardar el cargo');
    }
  }

  // =========================
  // MODAL ELIMINAR
  // =========================
  function abrirModalEliminar(id) {
    const u = usuarios.find(x => String(x.id) === String(id));
    if (!u) return;
    usuarioEliminando = u;
    setText('eliminar-nombre', u.nombre);
    $('modalEliminar').style.display = 'flex';
  }

  function cerrarModalEliminar() {
    $('modalEliminar').style.display = 'none';
    usuarioEliminando = null;
  }

  async function confirmarEliminar() {
    if (!usuarioEliminando) return;

    const btn = $('modal-eliminar-confirmar');
    if (btn) btn.disabled = true;

    try {
      const response = await fetch(`${API_URL}/usuarios/${usuarioEliminando.id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (response.ok) logSuccess(`Usuario ${usuarioEliminando.id} eliminado`);
    } catch (e) {
      logError('No se pudo eliminar en backend:', e);
    }

    usuarios = usuarios.filter(u => String(u.id) !== String(usuarioEliminando.id));
    renderTabla();
    renderCargos();
    actualizarStats();
    poblarFiltroCargos();
    cerrarModalEliminar();
    toast('Usuario eliminado');
  }

  function initModalEliminar() {
    $('modal-eliminar-close')?.addEventListener('click', cerrarModalEliminar);
    $('modal-eliminar-cancelar')?.addEventListener('click', cerrarModalEliminar);
    $('modal-eliminar-confirmar')?.addEventListener('click', confirmarEliminar);

    $('modalEliminar')?.addEventListener('click', e => {
      if (e.target === $('modalEliminar')) cerrarModalEliminar();
    });
  }

  // =========================
  // INIT (SIN DUPLICAR SHARED.JS)
  // =========================
  function init() {
    log('Iniciando módulo Usuarios...');

    const userData = localStorage.getItem('user');
    if (userData) {
      usuarioActual = JSON.parse(userData);
    }

    initFiltros();
    initCargosUI();
    initModalUsuario();
    initModalEliminar();

    $('btn-refresh')?.addEventListener('click', async () => {
      await Promise.all([cargarCargos(), cargarUsuarios()]);
      renderCargos();
      poblarSelectCargoModal();
      poblarFiltroCargos();
      toast('Datos actualizados');
    });

    Promise.all([cargarCargos(), cargarUsuarios()]).then(() => {
      renderCargos();
      poblarSelectCargoModal();
      poblarFiltroCargos();
      log('Usuarios iniciado');
    });
  }

  window.recargarUsuarios = async () => {
    await cargarCargos();
    await cargarUsuarios();
    renderCargos();
    renderTabla();
    poblarFiltroCargos();
  };

  if (verificarAcceso()) {
    init();
  }

})();