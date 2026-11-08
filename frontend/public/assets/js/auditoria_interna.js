/* ==========================================
   VENVIDRIO - AUDITORÍA INTERNA DE CALIDAD
   auditoria.js - v2 (Corregido)
   - API_URL dinámico (localhost vs Render)
   - Timeout + retry para Render wake-up
   - foto_url robusta (absoluta o relativa)
   - Race condition personal/evaluaciones resuelta
   - Eliminación de evaluación con permisos por rol
   - Exportaciones con token por header (no query)
   ========================================== */

(function () {
  'use strict';

  // =========================
  // CONFIGURACIÓN DINÁMICA DE API
  // =========================
  const hostname = window.location.hostname;
  const API_URL = (hostname === 'localhost' || hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000'
    : 'https://calidad-venvidrio-repository-main.onrender.com';

  const ROLES_PERMITIDOS = [2, 3]; // 2 = supervisor, 3 = admin
  const TIMEOUT_MS = 15000;
  const TIMEOUT_WAKE_MS = 30000;

  // =========================
  // CATÁLOGO DE CRITERIOS
  // =========================
  const CRITERIOS = [
    { id: "c1",  texto: "Cumple sus funciones y responsabilidades asignadas", funcion: "Cumplimiento de funciones" },
    { id: "c2",  texto: "Asiste puntualmente a las reuniones del departamento de calidad", funcion: "Puntualidad en reuniones" },
    { id: "c3",  texto: "Participa activamente en reuniones y aporta soluciones", funcion: "Participación activa" },
    { id: "c4",  texto: "Entrega reportes e informes de calidad en la fecha acordada", funcion: "Entrega de reportes" },
    { id: "c5",  texto: "Cumple con el plan anual de formación y capacitaciones", funcion: "Formación continua" },
    { id: "c6",  texto: "Aplica correctamente los procedimientos del SGC", funcion: "Aplicación de procedimientos" },
    { id: "c7",  texto: "Registra y documenta sus actividades en el sistema", funcion: "Documentación" },
    { id: "c8",  texto: "Colabora con otros procesos y áreas de la organización", funcion: "Colaboración inter-área" },
    { id: "c9",  texto: "Cumple con los objetivos e indicadores de su cargo", funcion: "Cumplimiento de objetivos" },
    { id: "c10", texto: "Mantiene actualizada su documentación personal y certificaciones", funcion: "Documentación personal" }
  ];

  const PERSONAL_FALLBACK = [
    { id: 1,  nombre: "María González",   cargo: "Inspectora de Calidad",  turno: "A", ingreso: "2022-03-15" },
    { id: 2,  nombre: "Carlos Rodríguez", cargo: "Supervisor de Calidad",  turno: "A", ingreso: "2020-08-02" },
    { id: 3,  nombre: "Ana Martínez",     cargo: "Analista de Calidad",    turno: "B", ingreso: "2021-11-20" },
    { id: 4,  nombre: "José Pérez",       cargo: "Inspector de Calidad",   turno: "B", ingreso: "2023-01-09" },
    { id: 5,  nombre: "Luisa Fernández",  cargo: "Coordinadora SGC",       turno: "A", ingreso: "2019-05-12" },
    { id: 6,  nombre: "Pedro Sánchez",    cargo: "Metrólogo",              turno: "C", ingreso: "2021-02-18" },
    { id: 7,  nombre: "Daniela Torres",   cargo: "Inspectora de Calidad",  turno: "C", ingreso: "2023-06-30" },
    { id: 8,  nombre: "Ramón Herrera",    cargo: "Jefe de Calidad",        turno: "A", ingreso: "2018-09-05" }
  ];

  // =========================
  // ESTADO
  // =========================
  let personal = [...PERSONAL_FALLBACK];
  let evaluaciones = [];
  let planes = [];
  let evaluadoActual = null;
  let evaluacionState = {};
  let usuarioActual = null;
  let rolActual = 0;
  let evaluacionEliminando = null;
  let personalCargado = false;

  // =========================
  // UTILIDADES
  // =========================
  function log(msg, d)     { console.log(`[${new Date().toLocaleTimeString()}] 🔍 ${msg}`, d || ''); }
  function logError(m, e)  { console.error(`[${new Date().toLocaleTimeString()}] ❌ ${m}`, e || ''); }
  function logSuccess(m,d) { console.log(`[${new Date().toLocaleTimeString()}] ✅ ${m}`, d || ''); }

  function $(id) { return document.getElementById(id); }
  function val(id) { const el = $(id); return el ? String(el.value).trim() : ''; }
  function setText(id, t) { const el = $(id); if (el) el.textContent = t; }

  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtFecha(f) {
    if (!f) return '—';
    const d = new Date(f);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES');
  }

  function iniciales(nombre) {
    if (!nombre) return '??';
    const partes = String(nombre).trim().split(/\s+/);
    const a = partes[0] ? partes[0][0] : '';
    const b = partes[1] ? partes[1][0] : (partes[0] && partes[0][1] || '');
    return (a + b).toUpperCase();
  }

  // 👇 CORREGIDO: robusto para URLs relativas o absolutas (Supabase Storage)
  function obtenerUrlFoto(fotoUrl) {
    if (!fotoUrl) return null;
    if (/^https?:\/\//i.test(fotoUrl)) return fotoUrl;
    if (fotoUrl.startsWith('//')) return `https:${fotoUrl}`;
    return `${API_URL}${fotoUrl.startsWith('/') ? '' : '/'}${fotoUrl}`;
  }

  function authHeaders(extra = {}) {
    return {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json',
      ...extra
    };
  }

  // 👇 NUEVO: fetch con timeout (para evitar cuelgues si Render duerme)
  async function fetchConTimeout(url, options = {}, timeout = TIMEOUT_MS) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  // 👇 NUEVO: fetch con retry + pantalla de "conectando" para Render
  async function fetchConRetry(url, options = {}, intentos = 2) {
    try {
      return await fetchConTimeout(url, options, TIMEOUT_MS);
    } catch (err) {
      if (intentos <= 1) throw err;
      mostrarPantallaConexion();
      await new Promise(r => setTimeout(r, 5000));
      try {
        return await fetchConTimeout(url, options, TIMEOUT_WAKE_MS);
      } finally {
        ocultarPantallaConexion();
      }
    }
  }

  function mostrarPantallaConexion() {
    if ($('render-wake-up')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="render-wake-up" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.95);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;">
        <div style="border:4px solid #f3f3f3;border-top:4px solid #1a237e;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin-bottom:20px;"></div>
        <h2 style="color:#1a237e;margin-bottom:10px;">Conectando con el servidor...</h2>
        <p style="color:#64748b;">El servidor estaba en reposo. Reintentando...</p>
        <style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
      </div>
    `);
  }

  function ocultarPantallaConexion() {
    const el = $('render-wake-up');
    if (el) el.remove();
  }

  function clasificar(pct) {
    if (pct >= 90) return { categoria: 'Excelente',  clase: 'cat-excelente'  };
    if (pct >= 75) return { categoria: 'Bueno',      clase: 'cat-bueno'      };
    if (pct >= 60) return { categoria: 'Regular',    clase: 'cat-regular'    };
    return { categoria: 'Deficiente', clase: 'cat-deficiente' };
  }

  // =========================
  // CONTROL DE ROLES / ACCESO
  // =========================
  function verificarAcceso() {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '../public/login.html';
      return false;
    }

    const rol = parseInt(localStorage.getItem('role'), 10);
    rolActual = isNaN(rol) ? 0 : rol;

    if (!ROLES_PERMITIDOS.includes(rolActual)) {
      alert('⛔ Acceso restringido.\n\nEsta sección de Auditoría Interna de Calidad es exclusiva para Supervisores y Administradores.');
      window.location.href = '../public/dashboard.html';
      return false;
    }
    return true;
  }

  // =========================
  // SESIÓN / NAVBAR
  // =========================
  function cargarUsuarioNav() {
    const userData = localStorage.getItem('user');
    if (!userData) return;
    try {
      const user = JSON.parse(userData);
      usuarioActual = user;

      let avatarHtml = '';
      const urlFoto = obtenerUrlFoto(user.foto_url);
      if (urlFoto) {
        avatarHtml = `<img src="${esc(urlFoto)}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      } else {
        avatarHtml = user.nombre ? user.nombre.substring(0, 2).toUpperCase() : 'US';
      }

      const navAvatar = $('navAvatar');
      if (navAvatar) navAvatar.innerHTML = avatarHtml;

      const dropdownAvatar = $('dropdownAvatar');
      if (dropdownAvatar) dropdownAvatar.innerHTML = avatarHtml;

      setText('navUsername', user.nombre || 'Usuario');
      setText('dropdownName', user.nombre || 'Usuario');
      setText('dropdownEmail', user.correo || 'usuario@email.com');
    } catch (e) {
      logError('Error cargando usuario:', e);
    }
  }

  function mostrarEnlaceUsuarios() {
    if (rolActual === 3) {
      const link = $('navUsuariosLink');
      if (link) link.style.display = 'flex';
    }
  }

  async function cerrarSesion(mensaje) {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetchConTimeout(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }, 5000).catch(() => {});
      }
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('role');
      if (mensaje) alert(mensaje);
      window.location.href = '../public/login.html';
    }
  }

  function initUserControls() {
    const container = $('navUserContainer');
    const dropdown  = $('userDropdown');
    const logoutBtn = $('dropdownLogout');

    let lastToggle = 0;
    const toggleDropdown = (e) => {
      e.stopPropagation();
      const now = Date.now();
      if (now - lastToggle < 300) return;
      lastToggle = now;
      if (dropdown) dropdown.classList.toggle('show');
    };

    if (container) {
      container.addEventListener('click', toggleDropdown);
      container.addEventListener('touchstart', toggleDropdown, { passive: false });
    }

    const cerrarDropdown = () => { if (dropdown) dropdown.classList.remove('show'); };
    document.addEventListener('click', cerrarDropdown);
    document.addEventListener('touchstart', (e) => {
      if (container && !container.contains(e.target)) cerrarDropdown();
    }, { passive: true });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarDropdown(); });

    if (logoutBtn) {
      logoutBtn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
          cerrarSesion('👋 Sesión cerrada exitosamente.');
        }
      });
    }
  }

  // 👇 CORREGIDO: verificación asíncrona robusta con timeout + retry
  async function verificarSesion() {
    if (!verificarAcceso()) return;

    try {
      const response = await fetchConRetry(
        `${API_URL}/auth/verify`,
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } },
        2
      );

      if (response.status === 401 || response.status === 403) {
        await cerrarSesion('Sesión expirada. Vuelve a iniciar sesión.');
        return;
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Todo OK
      cargarUsuarioNav();
      mostrarEnlaceUsuarios();
      initUserControls();
      init();

    } catch (error) {
      logError('Error en verificación de sesión:', error);

      if (error.name === 'AbortError') {
        alert('El servidor tardó demasiado en responder. Revisa tu conexión.');
      }

      // ⚠️ NO borramos token por error de red: permitimos que la app cargue
      // (la UI se mostrará, y si el backend falla, verá errores puntuales)
      cargarUsuarioNav();
      mostrarEnlaceUsuarios();
      initUserControls();
      init();
    }
  }

  // =========================
  // CARGA DEL PERSONAL
  // =========================
  async function cargarPersonal() {
    try {
      // 👇 Sin barra final para evitar redirects problemáticos
      const response = await fetchConTimeout(
        `${API_URL}/usuarios?t=${Date.now()}`,
        { headers: authHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        const lista = Array.isArray(data) ? data : (data.items || data.usuarios || []);

        personal = lista.map(u => ({
          id: u.id,
          nombre: u.nombre || 'Sin nombre',
          cargo: u.cargo || 'Sin cargo',
          turno: u.turno || '—',
          ingreso: u.created_at || u.fecha_ingreso || null
        }));

        logSuccess(`${personal.length} personas cargadas desde backend`);
      } else {
        logError(`No se pudo cargar personal (HTTP ${response.status}), usando fallback`);
      }
    } catch (e) {
      logError('No se pudo cargar personal del backend, usando fallback:', e);
    }

    personalCargado = true;
    poblarSelectorPersonal();
  }

  function poblarSelectorPersonal() {
    const sel = $('evaluado');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">-- Seleccione un miembro del personal --</option>';
    personal.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.nombre} · ${p.cargo}`;
      sel.appendChild(opt);
    });
    if (prev && personal.some(p => String(p.id) === prev)) sel.value = prev;
  }

  // =========================
  // FICHA DEL EVALUADO
  // =========================
  function mostrarFicha(p) {
    const ficha = $('ficha-evaluado');
    if (!ficha) return;
    if (!p) { ficha.style.display = 'none'; return; }

    setText('ficha-avatar', iniciales(p.nombre));
    setText('ficha-nombre', p.nombre);
    setText('ficha-cargo', p.cargo);
    setText('ficha-turno', p.turno || '—');
    setText('ficha-ingreso', fmtFecha(p.ingreso));

    ficha.style.display = 'block';
  }

  function initSelectorEvaluado() {
    const sel = $('evaluado');
    if (!sel) return;
    sel.addEventListener('change', () => {
      evaluadoActual = personal.find(p => String(p.id) === sel.value) || null;
      mostrarFicha(evaluadoActual);
      renderHistorialEvaluado();
      resetEvaluacion();
    });
  }

  // =========================
  // CHECKLIST / EVALUACIÓN
  // =========================
  function resetEvaluacion() {
    evaluacionState = {};
    CRITERIOS.forEach(c => { evaluacionState[c.id] = null; });
    renderChecklist();
    const obs = $('obs-eval');
    if (obs) obs.value = '';
  }

  function renderChecklist() {
    const cont = $('checklist-body');
    if (!cont) return;

    cont.innerHTML = CRITERIOS.map((c, i) => {
      const estado = evaluacionState[c.id];
      const cls = estado
        ? `evaluado ${estado === 'ok' ? 'cumple' : estado === 'parcial' ? 'parcial' : 'no-cumple'}`
        : '';
      const n = String(i + 1).padStart(2, '0');

      return `
        <div class="check-item ${cls}" data-id="${esc(c.id)}">
          <div class="check-num">${n}</div>
          <div class="check-text">${esc(c.texto)}</div>
          <div class="check-estados">
            <button type="button" class="check-estado estado-ok ${estado === 'ok' ? 'active' : ''}" data-id="${esc(c.id)}" data-val="ok" title="Cumple (1.0)">
              <i class="ti ti-check"></i>
            </button>
            <button type="button" class="check-estado estado-parcial ${estado === 'parcial' ? 'active' : ''}" data-id="${esc(c.id)}" data-val="parcial" title="Parcial (0.5)">
              <i class="ti ti-minus"></i>
            </button>
            <button type="button" class="check-estado estado-fail ${estado === 'fail' ? 'active' : ''}" data-id="${esc(c.id)}" data-val="fail" title="No cumple (0.0)">
              <i class="ti ti-x"></i>
            </button>
          </div>
        </div>`;
    }).join('');

    cont.querySelectorAll('.check-estado').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const v = btn.dataset.val;
        evaluacionState[id] = (evaluacionState[id] === v) ? null : v;
        renderChecklist();
        actualizarProgreso();
      });
    });

    actualizarProgreso();
  }

  function calcularProgreso() {
    let ok = 0, parcial = 0, fail = 0;
    CRITERIOS.forEach(c => {
      const v = evaluacionState[c.id];
      if (v === 'ok') ok++;
      else if (v === 'parcial') parcial++;
      else if (v === 'fail') fail++;
    });
    const evaluados = ok + parcial + fail;
    const total = CRITERIOS.length;
    const puntaje = ok * 1.0 + parcial * 0.5 + fail * 0.0;
    const pct = total ? Math.round((puntaje / total) * 100) : 0;
    return { ok, parcial, fail, evaluados, total, puntaje, pct };
  }

  function actualizarProgreso() {
    const { evaluados, total, pct } = calcularProgreso();
    const fill = $('aud-progress-fill');
    if (fill) fill.style.width = `${pct}%`;
    setText('pct-label', `${pct}%`);
    setText('badge-progreso', `${evaluados} / ${total}`);
  }

  // =========================
  // PLANES DE MEJORA
  // =========================
  function generarPlanesDesdeEvaluacion(p, evaluacion, pct, categoria) {
    const nuevos = [];
    if (categoria === 'Regular' || categoria === 'Deficiente') {
      CRITERIOS.forEach(c => {
        const v = evaluacionState[c.id];
        if (v === 'fail' || v === 'parcial') {
          nuevos.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            evaluado_id: p.id,
            evaluado: p.nombre,
            cargo: p.cargo,
            criterio: c.texto,
            funcion: c.funcion,
            prioridad: v === 'fail' ? 'alta' : 'media',
            estado: 'abierto',
            fecha: new Date().toISOString(),
            origen: `Evaluación ${categoria} (${pct}%)`
          });
        }
      });
    }
    return nuevos;
  }

  function renderPlanes() {
    const cont = $('lista-planes');
    if (!cont) return;

    setText('badge-planes', planes.length);
    setText('kpi-planes', planes.length);
    setText('kpi-planes-sub', planes.length
      ? `${planes.filter(p => p.prioridad === 'alta').length} de prioridad alta`
      : 'Sin planes pendientes');

    if (planes.length === 0) {
      cont.innerHTML = `
        <div class="empty-panel">
          <i class="ti ti-target-arrow"></i>
          <span>Sin planes de mejora activos</span>
        </div>`;
      return;
    }

    cont.innerHTML = planes.slice(0, 8).map(p => `
      <div class="plan-item ${p.prioridad === 'alta' ? 'prioridad-alta' : ''}">
        <div class="plan-icon">
          <i class="ti ${p.prioridad === 'alta' ? 'ti-alert-triangle' : 'ti-flag'}"></i>
        </div>
        <div class="plan-body">
          <div class="plan-titulo">${esc(p.criterio)}</div>
          <div class="plan-desc">${esc(p.evaluado)} · ${esc(p.cargo)}</div>
          <div class="plan-meta">
            <span><strong>Función:</strong> ${esc(p.funcion)}</span>
            <span><strong>Prioridad:</strong> ${esc(p.prioridad)}</span>
            <span>${fmtFecha(p.fecha)}</span>
          </div>
        </div>
        <span class="plan-estado ${p.estado === 'cerrado' ? 'cerrado' : ''}">
          ${p.estado === 'cerrado' ? 'Cerrado' : 'Abierto'}
        </span>
      </div>`).join('');
  }

  // =========================
  // HISTORIAL DEL EVALUADO
  // =========================
  function renderHistorialEvaluado() {
    const cont = $('historial-evaluado');
    if (!cont) return;

    if (!evaluadoActual) {
      cont.innerHTML = `
        <div class="empty-panel">
          <i class="ti ti-user-question"></i>
          <span>Seleccione un evaluado para ver su historial</span>
        </div>`;
      return;
    }

    const delEvaluado = evaluaciones
      .filter(e => String(e.evaluado_id) === String(evaluadoActual.id))
      .slice(0, 5);

    if (delEvaluado.length === 0) {
      cont.innerHTML = `
        <div class="empty-panel">
          <i class="ti ti-inbox"></i>
          <span>Sin evaluaciones previas registradas</span>
        </div>`;
      return;
    }

    cont.innerHTML = delEvaluado.map(e => {
      const cat = clasificar(e.puntaje);
      return `
        <div class="hist-item">
          <div class="hist-puntaje ${cat.clase}">${e.puntaje}%</div>
          <div class="hist-body">
            <div class="hist-periodo">${esc(e.periodo)}</div>
            <div class="hist-fecha">${fmtFecha(e.fecha)}</div>
            <div class="hist-evaluador">Evaluó: ${esc(e.evaluador)}</div>
          </div>
        </div>`;
    }).join('');
  }

  // =========================
  // GUARDAR EVALUACIÓN
  // =========================
  async function guardarEvaluacion() {
    if (!evaluadoActual) { alert('Debe seleccionar el personal a evaluar.'); return; }

    const { ok, parcial, fail, evaluados, total, puntaje, pct } = calcularProgreso();
    if (evaluados < total) {
      if (!confirm(`Ha evaluado ${evaluados} de ${total} criterios. ¿Desea guardar de todas formas?`)) return;
    }

    const periodo = val('periodo') || 'mensual';
    const obs = val('obs-eval');
    const { categoria } = clasificar(pct);

    const payload = {
      evaluado_id: evaluadoActual.id,
      periodo,
      puntaje: pct,
      categoria,
      detalles: JSON.stringify(evaluacionState),
      observaciones: obs || null
    };

    const btn = $('btn-guardar-eval');
    if (btn) btn.disabled = true;

    try {
      const response = await fetchConTimeout(
        `${API_URL}/auditorias/calidad/evaluaciones`,
        {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload)
        },
        TIMEOUT_WAKE_MS
      );

      if (response.ok) {
        logSuccess('Evaluación guardada en backend');

        // Planes solo en memoria (ideal: guardarlos también en backend)
        const nuevosPlanes = generarPlanesDesdeEvaluacion(evaluadoActual, payload, pct, categoria);
        planes = [...nuevosPlanes, ...planes];
        renderPlanes();
        actualizarKPIs();

        // Recargar historial
        await cargarEvaluaciones();

        alert(`✅ Evaluación guardada.\nPuntaje: ${pct}% (${categoria})`);

        evaluadoActual = null;
        const sel = $('evaluado');
        if (sel) sel.value = '';
        mostrarFicha(null);
        resetEvaluacion();
        renderHistorialEvaluado();

      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Error al guardar: ${errorData.detail || 'Error desconocido'}`);
      }
    } catch (e) {
      logError('Fallo al guardar:', e);
      alert('No se pudo conectar con el servidor.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // =========================
  // HISTORIAL GENERAL
  // =========================
  function filtrarEvaluaciones() {
    const cargo     = val('f-cargo');
    const evaluador = val('f-evaluador');
    const periodo   = val('f-periodo');
    const categoria = val('f-categoria');
    const desde     = val('f-desde');
    const hasta     = val('f-hasta');

    return evaluaciones.filter(e => {
      if (cargo     && e.cargo !== cargo) return false;
      if (evaluador && e.evaluador !== evaluador) return false;
      if (periodo   && e.periodo !== periodo) return false;
      if (categoria && e.categoria !== categoria) return false;
      if (desde || hasta) {
        const f = new Date(e.fecha);
        if (desde && f < new Date(desde)) return false;
        if (hasta && f > new Date(`${hasta}T23:59:59`)) return false;
      }
      return true;
    });
  }

  function renderHistorial() {
    const tbody = $('tabla-eval');
    if (!tbody) return;

    const lista = filtrarEvaluaciones();
    setText('filtro-resultados', `📋 ${lista.length} evaluación(es) mostrada(s)`);

    if (lista.length === 0) {
      tbody.innerHTML = `<tr class="fila-vacia"><td colspan="9">Sin evaluaciones registradas con los filtros actuales</td></tr>`;
      return;
    }

    const puedeEliminar = rolActual === 3;

    tbody.innerHTML = lista.map(e => {
      const cat = clasificar(e.puntaje);
      const planesDelEvaluado = planes.filter(p =>
        String(p.evaluado) === String(e.evaluado) && p.estado === 'abierto'
      ).length;

      const colorBarra =
        cat.clase === 'cat-excelente' ? '#2e7d32' :
        cat.clase === 'cat-bueno'     ? '#1565c0' :
        cat.clase === 'cat-regular'   ? '#f57f17' : '#dc3545';

      return `
        <tr>
          <td class="cell-nombre">${esc(e.evaluado)}</td>
          <td class="cell-cargo">${esc(e.cargo)}</td>
          <td class="cell-evaluador">${esc(e.evaluador)}</td>
          <td class="cell-periodo" style="text-transform:capitalize">${esc(e.periodo)}</td>
          <td>
            <div class="cell-puntaje">
              <span class="cell-puntaje-num ${cat.clase}">${e.puntaje}%</span>
              <div class="mini-progress-track">
                <div class="mini-progress-fill" style="width:${e.puntaje}%;background:${colorBarra}"></div>
              </div>
            </div>
          </td>
          <td><span class="categoria-badge ${cat.clase}">${cat.categoria}</span></td>
          <td class="cell-planes ${planesDelEvaluado ? 'tiene-planes' : ''}">${planesDelEvaluado}</td>
          <td class="cell-fecha">${fmtFecha(e.fecha)}</td>
          <td style="text-align:center">
            <div class="acciones-cell">
              <button class="btn-icon" data-ver="${esc(e.id)}" title="Ver detalle">
                <i class="ti ti-eye"></i>
              </button>
              <button class="btn-icon" data-reevaluar="${esc(e.evaluado_id)}" title="Reevaluar">
                <i class="ti ti-refresh"></i>
              </button>
              ${puedeEliminar ? `
                <button class="btn-icon btn-icon-danger" data-eliminar="${esc(e.id)}" title="Eliminar evaluación">
                  <i class="ti ti-trash"></i>
                </button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-ver]').forEach(btn => {
      btn.addEventListener('click', () => abrirModalVer(btn.dataset.ver));
    });

    tbody.querySelectorAll('[data-reevaluar]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.reevaluar;
        const sel = $('evaluado');
        if (sel) {
          sel.value = id;
          sel.dispatchEvent(new Event('change'));
          sel.closest('.card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    tbody.querySelectorAll('[data-eliminar]').forEach(btn => {
      btn.addEventListener('click', () => abrirModalEliminar(btn.dataset.eliminar));
    });
  }

  // =========================
  // MODAL: VER DETALLE
  // =========================
  function abrirModalVer(id) {
    const evalEncontrada = evaluaciones.find(e => String(e.id) === String(id));
    if (!evalEncontrada) return;

    const modal = $('modal-ver-eval');
    const body = $('modal-eval-body');
    if (!modal || !body) return;

    const titleEl = $('modal-eval-title');
    if (titleEl) titleEl.innerHTML = `<i class="ti ti-eye"></i> Detalle de Evaluación: ${esc(evalEncontrada.evaluado)}`;

    const cat = clasificar(evalEncontrada.puntaje);

    body.innerHTML = `
      <div class="ficha-evaluado" style="margin-bottom:1rem;">
        <div class="ficha-avatar">${iniciales(evalEncontrada.evaluado)}</div>
        <div class="ficha-info">
          <div class="ficha-nombre">${esc(evalEncontrada.evaluado)}</div>
          <div class="ficha-detalle">
            <span><i class="ti ti-briefcase"></i> ${esc(evalEncontrada.cargo)}</span>
            <span><i class="ti ti-calendar"></i> ${fmtFecha(evalEncontrada.fecha)}</span>
          </div>
        </div>
      </div>

      <div class="grid-2" style="margin-bottom:1rem;">
        <div class="field">
          <label>Evaluador</label>
          <div style="padding:8px;background:#f8f9fa;border-radius:4px;border:1px solid #ddd;">${esc(evalEncontrada.evaluador)}</div>
        </div>
        <div class="field">
          <label>Periodo</label>
          <div style="padding:8px;background:#f8f9fa;border-radius:4px;border:1px solid #ddd;text-transform:capitalize;">${esc(evalEncontrada.periodo)}</div>
        </div>
      </div>

      <div class="field" style="margin-bottom:1rem;">
        <label>Puntaje Obtenido</label>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="categoria-badge ${cat.clase}" style="font-size:14px;padding:4px 12px;">${evalEncontrada.puntaje}%</span>
          <span style="font-weight:600;color:var(--navy);">${cat.categoria}</span>
        </div>
      </div>

      <div class="field">
        <label>Observaciones</label>
        <div style="padding:10px;background:#f8f9fa;border-radius:4px;border:1px solid #ddd;min-height:60px;font-size:13px;">
          ${evalEncontrada.observaciones ? esc(evalEncontrada.observaciones) : '<span style="color:#999;font-style:italic;">Sin observaciones registradas.</span>'}
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  }

  function initModalVer() {
    const modal = $('modal-ver-eval');
    const cerrar = () => { if (modal) modal.style.display = 'none'; };

    $('modal-eval-close')?.addEventListener('click', cerrar);
    $('modal-eval-cerrar-footer')?.addEventListener('click', cerrar);

    if (modal) {
      modal.addEventListener('click', e => { if (e.target === modal) cerrar(); });
    }
  }

  // =========================
  // MODAL: ELIMINAR
  // =========================
  function abrirModalEliminar(id) {
    const evalEncontrada = evaluaciones.find(e => String(e.id) === String(id));
    if (!evalEncontrada) return;

    evaluacionEliminando = evalEncontrada;
    setText('eliminar-eval-nombre', `${evalEncontrada.evaluado} (${evalEncontrada.puntaje}%)`);

    const modal = $('modal-eliminar-eval');
    if (modal) modal.style.display = 'flex';
  }

  function cerrarModalEliminar() {
    const modal = $('modal-eliminar-eval');
    if (modal) modal.style.display = 'none';
    evaluacionEliminando = null;
  }

  async function confirmarEliminar() {
    if (!evaluacionEliminando) return;

    const btn = $('modal-eliminar-confirmar');
    if (btn) btn.disabled = true;

    try {
      const response = await fetchConTimeout(
        `${API_URL}/auditorias/calidad/evaluaciones/${evaluacionEliminando.id}`,
        { method: 'DELETE', headers: authHeaders() },
        TIMEOUT_WAKE_MS
      );

      if (response.ok) {
        logSuccess('Evaluación eliminada');
        cerrarModalEliminar();
        await cargarEvaluaciones();
      } else if (response.status === 403) {
        alert('No tienes permisos para eliminar evaluaciones (solo Administradores).');
      } else {
        alert('Error al eliminar la evaluación.');
      }
    } catch (e) {
      logError('Fallo al eliminar:', e);
      alert('No se pudo conectar con el servidor.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function initModalEliminar() {
    const modal = $('modal-eliminar-eval');
    const cerrar = () => cerrarModalEliminar();

    $('modal-eliminar-close')?.addEventListener('click', cerrar);
    $('modal-eliminar-cancelar')?.addEventListener('click', cerrar);
    $('modal-eliminar-confirmar')?.addEventListener('click', confirmarEliminar);

    if (modal) {
      modal.addEventListener('click', e => { if (e.target === modal) cerrar(); });
    }
  }

  function poblarFiltrosHistorial() {
    const cargos      = [...new Set(evaluaciones.map(e => e.cargo).filter(Boolean))].sort();
    const evaluadores = [...new Set(evaluaciones.map(e => e.evaluador).filter(Boolean))].sort();

    const fill = (id, opciones) => {
      const sel = $(id);
      if (!sel) return;
      const actual = sel.value;
      const first = sel.querySelector('option');
      const firstHtml = first ? first.outerHTML : '<option value="">Todos</option>';
      sel.innerHTML = firstHtml + opciones.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('');
      if (actual && opciones.includes(actual)) sel.value = actual;
    };

    fill('f-cargo', cargos);
    fill('f-evaluador', evaluadores);
  }

  function initFiltros() {
    $('btn-aplicar-filtros')?.addEventListener('click', renderHistorial);
    $('btn-limpiar-filtros')?.addEventListener('click', () => {
      ['f-cargo','f-evaluador','f-periodo','f-categoria','f-desde','f-hasta']
        .forEach(id => { const el = $(id); if (el) el.value = ''; });
      renderHistorial();
    });
  }

  // =========================
  // KPIs
  // =========================
  function actualizarKPIs() {
    const ahora = new Date();
    const delMes = evaluaciones.filter(e => {
      const f = new Date(e.fecha);
      return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
    });

    setText('kpi-evaluaciones', delMes.length);
    setText('kpi-evaluaciones-sub', delMes.length
      ? `${delMes.length} en ${ahora.toLocaleDateString('es-ES', { month: 'long' })}`
      : 'Sin evaluaciones este mes');

    if (evaluaciones.length > 0) {
      const prom = Math.round(
        evaluaciones.reduce((s, e) => s + (Number(e.puntaje) || 0), 0) / evaluaciones.length
      );
      setText('kpi-promedio', `${prom}%`);
      const { categoria } = clasificar(prom);
      setText('kpi-promedio-sub', `Categoría ${categoria}`);
    } else {
      setText('kpi-promedio', '0%');
      setText('kpi-promedio-sub', 'Sin datos aún');
    }

    const unicas = new Set(evaluaciones.map(e => e.evaluado_id || e.evaluado)).size;
    setText('kpi-personas', unicas);
    setText('kpi-personas-sub', `de ${personal.length} en el departamento`);

    setText('kpi-planes', planes.filter(p => p.estado === 'abierto').length);
  }

  // =========================
  // CARGA DE EVALUACIONES
  // =========================
  async function cargarEvaluaciones() {
    try {
      const response = await fetchConTimeout(
        `${API_URL}/auditorias/calidad/evaluaciones?t=${Date.now()}`,
        { headers: authHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        const lista = Array.isArray(data) ? data : (data.items || data.evaluaciones || []);

        evaluaciones = lista.map(e => ({
          id: e.id,
          evaluado_id: e.evaluado_id,
          evaluado: e.evaluado_nombre || '—',
          cargo: personal.find(p => String(p.id) === String(e.evaluado_id))?.cargo || '—',
          evaluador: e.evaluador_nombre || '—',
          periodo: e.periodo || 'mensual',
          puntaje: Number(e.puntaje) || 0,
          categoria: e.categoria || clasificar(Number(e.puntaje)).categoria,
          fecha: e.fecha || new Date().toISOString(),
          observaciones: e.observaciones || null
        }));

        logSuccess(`${evaluaciones.length} evaluaciones cargadas`);
      }
    } catch (e) {
      logError('No se pudo cargar historial:', e);
    }

    renderHistorial();
    poblarFiltrosHistorial();
    actualizarKPIs();
  }

  // =========================
  // EXPORTACIONES (token por header, no query)
  // =========================
  function initExportes() {
    const descargar = async (endpoint, nombre) => {
      try {
        const res = await fetchConTimeout(
          `${API_URL}${endpoint}`,
          { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } },
          TIMEOUT_WAKE_MS
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombre;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e) {
        logError('Error al exportar:', e);
        alert('No se pudo generar el archivo. Revisa tu conexión.');
      }
    };

    $('btn-export-pdf-global')?.addEventListener('click', () => {
      descargar('/auditorias/calidad/evaluaciones/exportar/pdf', 'auditoria-interna.pdf');
    });

    $('btn-export-word-global')?.addEventListener('click', () => {
      descargar('/auditorias/calidad/evaluaciones/exportar/word', 'auditoria-interna.docx');
    });
  }

  // =========================
  // INIT
  // =========================
  async function init() {
    log('Iniciando módulo Auditoría Interna de Calidad...');

    resetEvaluacion();
    initSelectorEvaluado();
    initFiltros();
    initExportes();
    initModalVer();
    initModalEliminar();

    $('btn-reset-eval')?.addEventListener('click', () => {
      if (!confirm('¿Reiniciar la evaluación actual?')) return;
      resetEvaluacion();
    });

    $('btn-guardar-eval')?.addEventListener('click', guardarEvaluacion);

    // 👇 CORREGIDO: cargar personal PRIMERO y esperar, luego evaluaciones
    // (evita que `evaluaciones` se mapee sin `personal` disponible)
    await cargarPersonal();
    await cargarEvaluaciones();
    renderPlanes();
    renderHistorialEvaluado();

    log('Auditoría Interna de Calidad iniciada');
  }

  // Expuesto para depuración
  window.recargarAuditoria = async () => {
    await cargarPersonal();
    await cargarEvaluaciones();
    renderPlanes();
  };

  // 👇 CORREGIDO: arrancar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', verificarSesion);
  } else {
    verificarSesion();
  }

})();