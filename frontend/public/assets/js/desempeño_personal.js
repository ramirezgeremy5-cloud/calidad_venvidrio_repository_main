/* ==========================================
   VENVIDRIO - AUDITORÍA INTERNA DE CALIDAD
   auditoria.js - v3 (alineado con backend FastAPI)
   Endpoints correctos: /auditorias/interna/*
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

  // 👇 PREFIJO CORRECTO DEL BACKEND
  const BASE = `${API_URL}/auditorias/interna`;

  const ROLES_PERMITIDOS = [2, 3];
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

  // 👇 helper: el backend devuelve "puntaje", no "porcentaje"
  function getPuntaje(e) {
    if (!e) return 0;
    return Number(e.puntaje ?? e.porcentaje ?? 0);
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

      cargarUsuarioNav();
      mostrarEnlaceUsuarios();
      initUserControls();
      init();

    } catch (error) {
      logError('Error en verificación de sesión:', error);
      if (error.name === 'AbortError') {
        alert('El servidor tardó demasiado en responder. Revisa tu conexión.');
      }
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
      // 👇 Probar varias rutas posibles de usuarios
      const rutas = [
        `${API_URL}/usuarios`,
        `${API_URL}/users`,
        `${API_URL}/auth/usuarios`
      ];

      let lista = null;
      for (const url of rutas) {
        try {
          const response = await fetchConTimeout(
            `${url}?t=${Date.now()}`,
            { headers: authHeaders() },
            8000
          );
          if (response.ok) {
            const data = await response.json();
            lista = Array.isArray(data) ? data : (data.items || data.usuarios || data.users || []);
            if (lista.length) { logSuccess(`Personal cargado desde ${url}`); break; }
          }
        } catch (_) { /* siguiente ruta */ }
      }

      if (lista && lista.length) {
        personal = lista.map(u => ({
          id: u.id,
          nombre: u.nombre || u.name || 'Sin nombre',
          cargo: u.cargo || u.rol_nombre || u.role || 'Sin cargo',
          turno: u.turno || '—',
          ingreso: u.created_at || u.fecha_ingreso || null
        }));
        logSuccess(`${personal.length} personas cargadas desde backend`);
      } else {
        log('Usando personal de fallback (backend sin /usuarios accesible)');
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
  // PLANES DE MEJORA (derivados de evaluaciones, en memoria)
  // =========================
  function generarPlanesDesdeEvaluacion(p, pct, categoria) {
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
  // HISTORIAL DEL EVALUADO (✅ ahora bien cerrado)
  // =========================
  function renderHistorialEvaluado() {
    const cont = $('historial-evaluado') || $('historial-evaluaciones');
    if (!cont) return;

    if (!evaluadoActual) {
      cont.innerHTML = '<div class="empty-panel"><i class="ti ti-history"></i><span>Selecciona una persona</span></div>';
      return;
    }

    const hist = evaluaciones
      .filter(e => String(e.evaluado_id) === String(evaluadoActual.id))
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    if (!hist.length) {
      cont.innerHTML = '<div class="empty-panel"><i class="ti ti-history"></i><span>Sin evaluaciones registradas</span></div>';
      return;
    }

    cont.innerHTML = hist.map(e => {
      const pts = getPuntaje(e);
      const cls = clasificar(pts);
      return `
        <div class="hist-item">
          <div class="hist-info">
            <div class="hist-fecha">${fmtFecha(e.fecha)}</div>
            <div class="hist-meta">${esc(e.categoria || cls.categoria)} · ${pts}% · ${esc(e.periodo || '—')}</div>
          </div>
          <div class="hist-acciones">
            <span class="cat-badge ${cls.clase}">${esc(e.categoria || cls.categoria)}</span>
            ${rolActual === 3 ? `
              <button type="button" class="btn-icon btn-danger" data-del="${esc(e.id)}" title="Eliminar">
                <i class="ti ti-trash"></i>
              </button>` : ''}
          </div>
        </div>`;
    }).join('');

    cont.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => eliminarEvaluacion(btn.dataset.del));
    });
  }

  // =========================
  // CARGAR EVALUACIONES (endpoint correcto)
  // =========================
  async function cargarEvaluaciones() {
    try {
      const res = await fetchConRetry(
        `${BASE}/evaluaciones?t=${Date.now()}`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      evaluaciones = Array.isArray(data) ? data : (data.items || []);
      logSuccess(`${evaluaciones.length} evaluaciones cargadas`);
    } catch (e) {
      logError('No se pudieron cargar evaluaciones:', e);
      evaluaciones = [];
    }
    renderKPIs();
    renderHistorialEvaluado();
  }

  // =========================
  // KPIs
  // =========================
  function renderKPIs() {
    const total = evaluaciones.length;
    const promedio = total
      ? Math.round(evaluaciones.reduce((s, e) => s + getPuntaje(e), 0) / total)
      : 0;
    setText('kpi-total', total);
    setText('kpi-promedio', `${promedio}%`);
    setText('kpi-evaluados', new Set(evaluaciones.map(e => e.evaluado_id)).size);
  }

  // =========================
  // GUARDAR EVALUACIÓN (payload alineado al schema)
  // =========================
  async function guardarEvaluacion() {
    if (!evaluadoActual) {
      alert('Selecciona primero a la persona a evaluar.');
      return;
    }

    const { ok, parcial, fail, evaluados, total, puntaje, pct } = calcularProgreso();

    if (evaluados < total) {
      if (!confirm(`Solo has evaluado ${evaluados} de ${total} criterios. ¿Guardar de todas formas?`)) return;
    }

    const categoria = clasificar(pct).categoria;
    const observaciones = val('obs-eval');

    // 👇 Payload EXACTO según AuditoriaInternaCreate del backend
    const payload = {
      evaluado_id: evaluadoActual.id,
      periodo: val('periodo-eval') || new Date().toISOString().slice(0, 7), // "YYYY-MM"
      puntaje: pct,          // el backend usa "puntaje" (0-100)
      categoria: categoria,
      observaciones: observaciones,
      detalles: CRITERIOS.map(c => ({
        criterio_id: c.id,
        texto: c.texto,
        funcion: c.funcion,
        valor: evaluacionState[c.id] || null
      }))
    };

    try {
      const res = await fetchConRetry(
        `${BASE}/evaluaciones`,
        {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload)
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        logError(`POST /evaluaciones → HTTP ${res.status}`, errText);
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const nueva = await res.json();
      // Normalizar: el backend devuelve "puntaje", no "porcentaje"
      evaluaciones.unshift(nueva);

      // Planes en memoria
      const nuevosPlanes = generarPlanesDesdeEvaluacion(evaluadoActual, pct, categoria);
      if (nuevosPlanes.length) {
        planes = [...nuevosPlanes, ...planes];
        renderPlanes();
      }

      renderKPIs();
      renderHistorialEvaluado();
      resetEvaluacion();
      alert(`✅ Evaluación guardada: ${categoria} (${pct}%)`);

    } catch (e) {
      logError('Error guardando evaluación:', e);
      alert('❌ No se pudo guardar la evaluación.\n\nRevisa la consola (F12) para ver el detalle del error del servidor.');
    }
  }

  // =========================
  // ELIMINAR EVALUACIÓN (solo admin en backend)
  // =========================
  async function eliminarEvaluacion(id) {
    if (rolActual !== 3) {
      alert('Solo un Administrador puede eliminar evaluaciones.');
      return;
    }
    if (!confirm('¿Eliminar esta evaluación? Esta acción no se puede deshacer.')) return;

    evaluacionEliminando = id;
    try {
      const res = await fetchConRetry(
        `${BASE}/evaluaciones/${encodeURIComponent(id)}`,
        { method: 'DELETE', headers: authHeaders() }
      );
      if (!res.ok && res.status !== 204) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      evaluaciones = evaluaciones.filter(e => String(e.id) !== String(id));
      renderKPIs();
      renderHistorialEvaluado();
      logSuccess('Evaluación eliminada');
    } catch (e) {
      logError('Error eliminando evaluación:', e);
      alert('❌ No se pudo eliminar la evaluación.');
    } finally {
      evaluacionEliminando = null;
    }
  }

  // =========================
  // EXPORTACIONES (token por header)
  // =========================
  async function descargarArchivo(url, filename) {
    try {
      const res = await fetchConTimeout(url, { headers: authHeaders() }, TIMEOUT_WAKE_MS);
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      logError('Error descargando archivo:', e);
      alert('❌ No se pudo descargar el archivo. Revisa la consola.');
    }
  }

  function initExportButtons() {
    const btnPdfTodos = $('btn-export-pdf');
    if (btnPdfTodos) {
      btnPdfTodos.addEventListener('click', () => {
        descargarArchivo(`${BASE}/evaluaciones/exportar/pdf`, 'Evaluaciones_Global.pdf');
      });
    }

    const btnWordTodos = $('btn-export-word');
    if (btnWordTodos) {
      btnWordTodos.addEventListener('click', () => {
        descargarArchivo(`${BASE}/evaluaciones/exportar/word`, 'Evaluaciones_Global.docx');
      });
    }
  }

  // =========================
  // INIT
  // =========================
  async function init() {
    if (!personalCargado) {
      await cargarPersonal();
    } else {
      poblarSelectorPersonal();
    }

    await cargarEvaluaciones();

    initSelectorEvaluado();
    initExportButtons();

    const btnGuardar = $('btn-guardar-evaluacion');
    if (btnGuardar) btnGuardar.addEventListener('click', guardarEvaluacion);

    const btnReset = $('btn-reset-evaluacion');
    if (btnReset) btnReset.addEventListener('click', resetEvaluacion);

    resetEvaluacion();
    renderPlanes();
    renderKPIs();
  }

  // =========================
  // BOOT
  // =========================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', verificarSesion);
  } else {
    verificarSesion();
  }

})();
