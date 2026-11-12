/* ==========================================
   VENVIDRIO - AUDITORÍA INTERNA DE CALIDAD
   auditoria_interna.js - v1 (Adaptado al HTML)
   ========================================== */

(function () {
  'use strict';

  // =========================
  // CONFIGURACIÓN
  // =========================
  const hostname = window.location.hostname;
  const API_URL = (hostname === 'localhost' || hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000'
    : 'https://calidad-venvidrio-repository-main.onrender.com';

  const ROLES_PERMITIDOS = [2, 3];
  const TIMEOUT_MS = 15000;
  const TIMEOUT_WAKE_MS = 30000;

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
  // ESTADO GLOBAL
  // =========================
  let personal = [...PERSONAL_FALLBACK];
  let evaluaciones = [];
  let planes = [];
  let evaluadoActual = null;
  let evaluacionState = {};
  let usuarioActual = null;
  let rolActual = 0;
  let idAEliminar = null;
  let filtrosActuales = {};

  // =========================
  // UTILIDADES
  // =========================
  const $ = (id) => document.getElementById(id);
  const val = (id) => { const el = $(id); return el ? String(el.value).trim() : ''; };
  const setText = (id, t) => { const el = $(id); if (el) el.textContent = t; };
  const setHTML = (id, h) => { const el = $(id); if (el) el.innerHTML = h; };

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
    const b = partes[1] ? partes[1][0] : '';
    return (a + b).toUpperCase() || '??';
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

  function mostrarToast(mensaje, esError = false) {
    const toast = $('toast-auditoria');
    if (toast) {
      const icono = esError ? 'ti-alert-circle' : 'ti-circle-check';
      toast.innerHTML = `<i class="ti ${icono}" aria-hidden="true"></i> <span>${esc(mensaje)}</span>`;
      toast.style.background = esError ? '#fee2e2' : '#d1fae5';
      toast.style.color = esError ? '#b91c1c' : '#065f46';
      toast.style.borderLeftColor = esError ? '#ef4444' : '#10b981';
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 4000);
    }
  }

  // =========================
  // FETCH CON TIMEOUT Y RETRY
  // =========================
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

  // =========================
  // CONTROL DE ACCESO
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
      alert('⛔ Acceso restringido a Supervisores y Administradores.');
      window.location.href = '../dashboard.html';
      return false;
    }
    return true;
  }

  // =========================
  // NAVBAR Y SESIÓN
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

      if ($('navAvatar')) $('navAvatar').innerHTML = avatarHtml;
      if ($('dropdownAvatar')) $('dropdownAvatar').innerHTML = avatarHtml;
      setText('navUsername', user.nombre || 'Usuario');
      setText('dropdownName', user.nombre || 'Usuario');
      setText('dropdownEmail', user.correo || 'usuario@email.com');
    } catch (e) {
      console.error('Error cargando usuario:', e);
    }
  }

  function initUserControls() {
    const container = $('navUserContainer');
    const dropdown = $('userDropdown');
    const logoutBtn = $('dropdownLogout');

    if (container) {
      container.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dropdown) dropdown.classList.toggle('show');
      });
    }
    document.addEventListener('click', () => { if (dropdown) dropdown.classList.remove('show'); });
    
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('¿Cerrar sesión?')) {
          localStorage.clear();
          window.location.href = '../public/login.html';
        }
      });
    }
  }

  // =========================
  // CARGA DE PERSONAL
  // =========================
  async function cargarPersonal() {
    try {
      const response = await fetchConTimeout(`${API_URL}/usuarios?t=${Date.now()}`, { headers: authHeaders() });
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
      }
    } catch (e) {
      console.warn('Usando personal de fallback:', e);
    }
    poblarSelectorPersonal();
  }

  function poblarSelectorPersonal() {
    const sel = $('evaluado');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Seleccione un miembro del personal --</option>';
    personal.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.nombre} · ${p.cargo}`;
      sel.appendChild(opt);
    });
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

  // =========================
  // CHECKLIST DE EVALUACIÓN
  // =========================
  function resetEvaluacion() {
    evaluacionState = {};
    CRITERIOS.forEach(c => { evaluacionState[c.id] = null; });
    renderChecklist();
    const obs = $('obs-eval');
    if (obs) obs.value = '';
    actualizarContadorObs();
  }

  function renderChecklist() {
    const cont = $('checklist-body');
    if (!cont) return;

    cont.innerHTML = CRITERIOS.map((c, i) => {
      const estado = evaluacionState[c.id];
      const cls = estado ? `evaluado ${estado === 'ok' ? 'cumple' : estado === 'parcial' ? 'parcial' : 'no-cumple'}` : '';
      const n = String(i + 1).padStart(2, '0');

      return `
        <div class="check-item ${cls}" data-id="${esc(c.id)}">
          <div class="check-num">${n}</div>
          <div class="check-text">${esc(c.texto)}</div>
          <div class="check-estados">
            <button type="button" class="check-estado estado-ok ${estado === 'ok' ? 'active' : ''}" data-id="${esc(c.id)}" data-val="ok"><i class="ti ti-check"></i></button>
            <button type="button" class="check-estado estado-parcial ${estado === 'parcial' ? 'active' : ''}" data-id="${esc(c.id)}" data-val="parcial"><i class="ti ti-minus"></i></button>
            <button type="button" class="check-estado estado-fail ${estado === 'fail' ? 'active' : ''}" data-id="${esc(c.id)}" data-val="fail"><i class="ti ti-x"></i></button>
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
    const puntaje = ok * 1.0 + parcial * 0.5;
    const pct = total ? Math.round((puntaje / total) * 100) : 0;
    return { evaluados, total, pct };
  }

  function actualizarProgreso() {
    const { evaluados, total, pct } = calcularProgreso();
    const fill = $('aud-progress-fill');
    if (fill) fill.style.width = `${pct}%`;
    setText('pct-label', `${pct}%`);
    setText('badge-progreso', `${evaluados} / ${total}`);
    
    const track = $('aud-progress-track');
    if (track) track.setAttribute('aria-valuenow', pct);
  }

  function actualizarContadorObs() {
    const obs = $('obs-eval');
    const count = $('obs-eval-count');
    if (obs && count) {
      count.textContent = obs.value.length;
    }
  }

  // =========================
  // GUARDAR EVALUACIÓN
  // =========================
  async function guardarEvaluacion() {
    if (!evaluadoActual) { mostrarToast('Selecciona un miembro del personal primero.', true); return; }

    const { evaluados, total, pct } = calcularProgreso();
    if (evaluados < total) {
      if (!confirm(`Solo has evaluado ${evaluados} de ${total} criterios. ¿Deseas guardar de todas formas?`)) return;
    }

    const { categoria } = clasificar(pct);
    const obs = val('obs-eval');
    const periodo = val('periodo');

    const body = {
      evaluado_id: evaluadoActual.id,
      evaluado_nombre: evaluadoActual.nombre,
      evaluado_cargo: evaluadoActual.cargo,
      evaluado_turno: evaluadoActual.turno || '—',
      periodo: periodo,
      puntaje_total: pct,
      categoria: categoria,
      observaciones: obs || null,
      detalles: CRITERIOS.map(c => ({
        criterio_id: c.id,
        criterio: c.texto,
        funcion: c.funcion,
        valor: evaluacionState[c.id] || null
      })),
      evaluador: usuarioActual?.nombre || 'Desconocido',
      fecha: new Date().toISOString()
    };

    try {
      const btn = $('btn-guardar-eval');
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Guardando...'; }

      const response = await fetchConRetry(
        `${API_URL}/auditoria-interna`,
        { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) },
        2
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${response.status}`);
      }

      // Generar planes de mejora si aplica
      const nuevos = generarPlanesDesdeEvaluacion(evaluadoActual, body, pct, categoria);
      if (nuevos.length) planes = [...planes, ...nuevos];

      mostrarToast('Evaluación guardada correctamente.');
      resetEvaluacion();
      await cargarEvaluaciones();
      renderHistorialEvaluado();
      renderPlanes();
      renderTablaHistorial();

    } catch (e) {
      console.error(e);
      mostrarToast('No se pudo guardar la evaluación.', true);
    } finally {
      const btn = $('btn-guardar-eval');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-device-floppy"></i> Guardar Evaluación'; }
    }
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
      cont.innerHTML = `<div class="empty-panel"><i class="ti ti-target-arrow"></i><span>Sin planes de mejora activos</span></div>`;
      return;
    }

    cont.innerHTML = planes.slice(0, 8).map(p => `
      <div class="plan-item ${p.prioridad === 'alta' ? 'prioridad-alta' : ''}">
        <div class="plan-icon"><i class="ti ${p.prioridad === 'alta' ? 'ti-alert-triangle' : 'ti-flag'}"></i></div>
        <div class="plan-body">
          <div class="plan-titulo">${esc(p.criterio)}</div>
          <div class="plan-desc">${esc(p.evaluado)} · ${esc(p.cargo)}</div>
          <div class="plan-meta">
            <span><strong>Función:</strong> ${esc(p.funcion)}</span>
            <span><strong>Prioridad:</strong> ${esc(p.prioridad)}</span>
            <span>${fmtFecha(p.fecha)}</span>
          </div>
        </div>
        <span class="plan-estado ${p.estado === 'cerrado' ? 'cerrado' : ''}">${p.estado === 'cerrado' ? 'Cerrado' : 'Abierto'}</span>
      </div>`).join('');
  }

  // =========================
  // HISTORIAL DEL EVALUADO
  // =========================
  function renderHistorialEvaluado() {
    const cont = $('historial-evaluado');
    if (!cont) return;

    if (!evaluadoActual) {
      cont.innerHTML = `<div class="empty-panel"><i class="ti ti-history"></i><span>Selecciona un miembro del personal</span></div>`;
      return;
    }

    const propias = evaluaciones.filter(e => String(e.evaluado_id) === String(evaluadoActual.id));

    if (propias.length === 0) {
      cont.innerHTML = `<div class="empty-panel"><i class="ti ti-history"></i><span>Sin evaluaciones previas</span></div>`;
      return;
    }

    cont.innerHTML = propias.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(e => {
      const cls = clasificar(Number(e.puntaje_total) || 0);
      return `
        <div class="hist-item">
          <div class="hist-fecha">${fmtFecha(e.fecha)}</div>
          <div class="hist-puntaje">
            <strong>${esc(e.puntaje_total ?? '—')}%</strong>
            <span class="cat-badge ${cls.clase}">${esc(cls.categoria)}</span>
          </div>
          <div class="hist-obs">${esc(e.observaciones || 'Sin observaciones')}</div>
        </div>`;
    }).join('');
  }

  // =========================
  // TABLA HISTORIAL GENERAL
  // =========================
  function renderTablaHistorial() {
    const tbody = $('tabla-eval');
    if (!tbody) return;

    let data = [...evaluaciones];
    const { cargo, evaluador, periodo, categoria, desde, hasta } = filtrosActuales;

    if (cargo) data = data.filter(e => (e.evaluado_cargo || '').toLowerCase().includes(cargo.toLowerCase()));
    if (evaluador) data = data.filter(e => (e.evaluador || '').toLowerCase().includes(evaluador.toLowerCase()));
    if (periodo) data = data.filter(e => e.periodo === periodo);
    if (categoria) data = data.filter(e => e.categoria === categoria);
    
    if (desde) {
      const dDesde = new Date(desde);
      data = data.filter(e => new Date(e.fecha) >= dDesde);
    }
    if (hasta) {
      const dHasta = new Date(hasta);
      dHasta.setHours(23, 59, 59);
      data = data.filter(e => new Date(e.fecha) <= dHasta);
    }

    const resultadoEl = $('filtro-resultados');
    if (resultadoEl) {
      const totalActivos = Object.values(filtrosActuales).filter(Boolean).length;
      resultadoEl.textContent = totalActivos > 0 
        ? `🔍 Filtros aplicados: ${totalActivos} | ${data.length} resultados`
        : `📋 Mostrando todas las evaluaciones (${data.length})`;
    }

    // KPIs Globales
    setText('kpi-evaluaciones', data.length);
    setText('kpi-evaluaciones-sub', 'Registros totales');
    const pctPromedio = data.length ? Math.round(data.reduce((s, e) => s + (Number(e.puntaje_total) || 0), 0) / data.length) : 0;
    setText('kpi-promedio', `${pctPromedio}%`);
    const personasUnicas = new Set(data.map(e => e.evaluado_id)).size;
    setText('kpi-personas', personasUnicas);
    setText('kpi-personas-sub', 'Personal evaluado');

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--text-muted)"><i class="ti ti-inbox" style="font-size:1.5rem;margin-bottom:0.5rem;display:block;"></i> No hay evaluaciones registradas</td></tr>`;
      return;
    }

    tbody.innerHTML = data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(e => {
      const cls = clasificar(Number(e.puntaje_total) || 0);
      const planesCount = (e.planes_generados || []).length;
      return `
        <tr>
          <td><span style="font-weight:600;color:var(--navy);">${esc(e.evaluado_nombre)}</span></td>
          <td>${esc(e.evaluado_cargo)}</td>
          <td>${esc(e.evaluador)}</td>
          <td><span class="badge badge-info">${esc(e.periodo || 'Mensual')}</span></td>
          <td><strong>${esc(e.puntaje_total)}%</strong></td>
          <td><span class="cat-badge ${cls.clase}">${esc(cls.categoria)}</span></td>
          <td style="text-align:center;">${planesCount}</td>
          <td>${fmtFecha(e.fecha)}</td>
          <td>
            <div style="display:flex;gap:4px;justify-content:center;">
              <button type="button" class="btn btn-primary btn-xs" onclick="verEvaluacion('${esc(e.id)}')"><i class="ti ti-eye"></i></button>
              <button type="button" class="btn btn-danger btn-xs" onclick="abrirModalEliminar('${esc(e.id)}')"><i class="ti ti-trash"></i></button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  // =========================
  // CARGAR EVALUACIONES (API)
  // =========================
  async function cargarEvaluaciones() {
    try {
      const response = await fetchConRetry(`${API_URL}/auditoria-interna?t=${Date.now()}`, { headers: authHeaders() }, 2);
      if (response.ok) {
        const data = await response.json();
        evaluaciones = Array.isArray(data) ? data : (data.items || []);
      } else {
        evaluaciones = [];
      }
    } catch (e) {
      console.warn('Error cargando evaluaciones:', e);
      evaluaciones = [];
    }
  }

  // =========================
  // MODALES
  // =========================
  window.verEvaluacion = function(id) {
    const e = evaluaciones.find(ev => String(ev.id) === String(id));
    if (!e) return;

    const cls = clasificar(Number(e.puntaje_total) || 0);
    
    let detallesHtml = '';
    if (e.detalles && e.detalles.length) {
      detallesHtml = `
        <div style="margin-top:1rem;">
          <h4 style="font-size:12px;font-weight:700;color:var(--navy);text-transform:uppercase;margin-bottom:8px;">Criterios Evaluados</h4>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${e.detalles.map(d => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:var(--off-white);border-radius:6px;font-size:12px;">
                <span style="flex:1;">${esc(d.criterio)}</span>
                <span style="font-weight:700;color:${d.valor === 'ok' ? 'var(--success)' : d.valor === 'parcial' ? 'var(--warning)' : 'var(--danger)'}">
                  ${d.valor === 'ok' ? 'Cumple' : d.valor === 'parcial' ? 'Parcial' : d.valor === 'fail' ? 'No cumple' : '—'}
                </span>
              </div>
            `).join('')}
          </div>
        </div>`;
    }

    const bodyHtml = `
      <div style="display:flex;gap:12px;margin-bottom:1rem;">
        <div style="width:50px;height:50px;border-radius:50%;background:var(--brand-soft);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--brand-1);font-size:18px;">
          ${iniciales(e.evaluado_nombre)}
        </div>
        <div>
          <div style="font-weight:700;font-size:15px;">${esc(e.evaluado_nombre)}</div>
          <div style="font-size:12px;color:var(--text-muted);">${esc(e.evaluado_cargo)} · Turno ${esc(e.evaluado_turno || '—')}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:1rem;">
        <div><span style="font-size:10px;color:var(--text-muted);display:block;">Puntaje</span><strong>${esc(e.puntaje_total)}%</strong></div>
        <div><span style="font-size:10px;color:var(--text-muted);display:block;">Categoría</span><span class="cat-badge ${cls.clase}">${esc(cls.categoria)}</span></div>
        <div><span style="font-size:10px;color:var(--text-muted);display:block;">Evaluador</span><strong>${esc(e.evaluador)}</strong></div>
        <div><span style="font-size:10px;color:var(--text-muted);display:block;">Fecha</span><strong>${fmtFecha(e.fecha)}</strong></div>
      </div>
      <div style="padding:12px;background:var(--off-white);border-radius:6px;font-size:12px;margin-bottom:1rem;">
        <strong style="display:block;margin-bottom:4px;font-size:10px;text-transform:uppercase;color:var(--text-muted);">Observaciones</strong>
        ${esc(e.observaciones || 'Sin observaciones')}
      </div>
      ${detallesHtml}
    `;

    setHTML('modal-eval-body', bodyHtml);
    $('modal-ver-eval').style.display = 'flex';
  };

  window.abrirModalEliminar = function(id) {
    const e = evaluaciones.find(ev => String(ev.id) === String(id));
    if (!e) return;
    idAEliminar = id;
    setText('eliminar-eval-nombre', e.evaluado_nombre);
    $('modal-eliminar-eval').style.display = 'flex';
  };

  async function confirmarEliminar() {
    if (!idAEliminar) return;
    try {
      const response = await fetchConRetry(
        `${API_URL}/auditoria-interna/${idAEliminar}`,
        { method: 'DELETE', headers: authHeaders() },
        2
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      evaluaciones = evaluaciones.filter(e => String(e.id) !== String(idAEliminar));
      renderHistorialEvaluado();
      renderTablaHistorial();
      $('modal-eliminar-eval').style.display = 'none';
      idAEliminar = null;
      mostrarToast('Evaluación eliminada correctamente.');
    } catch (e) {
      console.error(e);
      mostrarToast('No se pudo eliminar la evaluación.', true);
    }
  }

  function configurarModales() {
    // Modal Ver
    const cerrarVer = () => $('modal-ver-eval').style.display = 'none';
    $('modal-eval-close')?.addEventListener('click', cerrarVer);
    $('modal-eval-cerrar-footer')?.addEventListener('click', cerrarVer);

    // Modal Eliminar
    const cerrarEliminar = () => { $('modal-eliminar-eval').style.display = 'none'; idAEliminar = null; };
    $('modal-eliminar-close')?.addEventListener('click', cerrarEliminar);
    $('modal-eliminar-cancelar')?.addEventListener('click', cerrarEliminar);
    $('modal-eliminar-confirmar')?.addEventListener('click', confirmarEliminar);
  }

  // =========================
  // FILTROS
  // =========================
  function poblarFiltros() {
    const cargos = new Set();
    const evaluadores = new Set();
    evaluaciones.forEach(e => {
      if (e.evaluado_cargo) cargos.add(e.evaluado_cargo);
      if (e.evaluador) evaluadores.add(e.evaluador);
    });

    const selCargo = $('f-cargo');
    if (selCargo) {
      selCargo.innerHTML = '<option value="">Todos</option>' + [...cargos].sort().map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    }
    const selEval = $('f-evaluador');
    if (selEval) {
      selEval.innerHTML = '<option value="">Todos</option>' + [...evaluadores].sort().map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('');
    }
  }

  function aplicarFiltros() {
    filtrosActuales = {
      cargo: val('f-cargo'),
      evaluador: val('f-evaluador'),
      periodo: val('f-periodo'),
      categoria: val('f-categoria'),
      desde: val('f-desde'),
      hasta: val('f-hasta')
    };
    renderTablaHistorial();
  }

  function limpiarFiltros() {
    ['f-cargo', 'f-evaluador', 'f-periodo', 'f-categoria', 'f-desde', 'f-hasta'].forEach(id => {
      const el = $(id); if (el) el.selectedIndex = 0;
    });
    filtrosActuales = {};
    renderTablaHistorial();
  }

  // =========================
  // EXPORTACIONES (Placeholder)
  // =========================
  function exportarCSV() {
    if (evaluaciones.length === 0) { mostrarToast('No hay evaluaciones para exportar.', true); return; }
    const header = ['Evaluado', 'Cargo', 'Evaluador', 'Periodo', 'Puntaje', 'Categoría', 'Fecha', 'Observaciones'];
    const rows = evaluaciones.map(e => [
      e.evaluado_nombre, e.evaluado_cargo, e.evaluador, e.periodo || 'Mensual',
      e.puntaje_total, e.categoria, fmtFecha(e.fecha), (e.observaciones || '').replace(/[\n\r,]/g, ' ')
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditorias_personal_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // =========================
  // INICIALIZACIÓN
  // =========================
  async function init() {
    if (!verificarAcceso()) return;

    cargarUsuarioNav();
    initUserControls();
    configurarModales();

    // Eventos
    $('evaluado')?.addEventListener('change', (e) => {
      evaluadoActual = personal.find(p => String(p.id) === e.target.value) || null;
      mostrarFicha(evaluadoActual);
      renderHistorialEvaluado();
      resetEvaluacion();
    });

    $('obs-eval')?.addEventListener('input', actualizarContadorObs);
    $('btn-reset-eval')?.addEventListener('click', () => {
      if (confirm('¿Limpiar la evaluación actual?')) resetEvaluacion();
    });
    $('btn-guardar-eval')?.addEventListener('click', guardarEvaluacion);

    $('btn-aplicar-filtros')?.addEventListener('click', aplicarFiltros);
    $('btn-limpiar-filtros')?.addEventListener('click', limpiarFiltros);
    $('btn-export-word-global')?.addEventListener('click', exportarCSV); // Placeholder
    $('btn-export-pdf-global')?.addEventListener('click', () => mostrarToast('Exportación PDF en desarrollo', false));

    // Carga inicial
    await cargarPersonal();
    await cargarEvaluaciones();
    
    poblarFiltros();
    renderPlanes();
    renderTablaHistorial();
    resetEvaluacion();
  }

  // Arrancar
  init();

})();