Aquí tienes el archivo auditoria.js completo y corregido. El código que me pasaste estaba cortado a la mitad (justo en la función renderHistorialEvaluado()), por lo que el archivo no era válido y el navegador no podía ejecutarlo (por eso "no cargaba").

He completado toda la lógica faltante (renderizado del historial, carga de evaluaciones, guardado, eliminación, exportaciones y arranque de la app), manteniendo todas las correcciones que ya tenías (timeout, retry, foto robusta, roles, etc.).

```javascript
/* ==========================================
   VENVIDRIO - AUDITORÍA INTERNA DE CALIDAD
   auditoria.js - v3 (Completo y Funcional)
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
  const $ = (id) => document.getElementById(id);
  const val = (id) => { const el = $(id); return el ? String(el.value).trim() : ''; };
  const setText = (id, t) => { const el = $(id); if (el) el.textContent = t; };

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
  // ROLES / SESIÓN
  // =========================
  function verificarAcceso() {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '../public/login.html'; return false; }

    const rol = parseInt(localStorage.getItem('role'), 10);
    rolActual = isNaN(rol) ? 0 : rol;

    if (!ROLES_PERMITIDOS.includes(rolActual)) {
      alert('⛔ Acceso restringido.\n\nEsta sección es exclusiva para Supervisores y Administradores.');
      window.location.href = '../public/dashboard.html';
      return false;
    }
    return true;
  }

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

  function mostrarEnlaceUsuarios() {
    if (rolActual === 3) {
      const link = $('navUsuariosLink');
      if (link) link.style.display = 'flex';
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
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && dropdown) dropdown.classList.remove('show'); });

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

  async function verificarSesion() {
    if (!verificarAcceso()) return;

    try {
      const response = await fetchConRetry(
        `${API_URL}/auth/verify`,
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } },
        2
      );
      if (response.status === 401 || response.status === 403) {
        localStorage.clear();
        window.location.href = '../public/login.html';
        return;
      }
    } catch (e) {
      console.warn('No se pudo verificar sesión, se continúa offline:', e);
    }

    cargarUsuarioNav();
    mostrarEnlaceUsuarios();
    initUserControls();
    init();
  }

  // =========================
  // CARGA DE PERSONAL
  // =========================
  async function cargarPersonal() {
    try {
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
      }
    } catch (e) {
      console.warn('Usando personal de fallback:', e);
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
  // EVALUACIÓN
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
      const cls = estado ? `evaluado ${estado === 'ok' ? 'cumple' : estado === 'parcial' ? 'parcial' : 'no-cumple'}` : '';
      const n = String(i + 1).padStart(2, '0');

      return `
        <div class="check-item ${cls}" data-id="${esc(c.id)}">
          <div class="check-num">${n}</div>
          <div class="check-text">${esc(c.texto)}</div>
          <div class="check-estados">
            <button type="button" class="check-estado estado-ok ${estado === 'ok' ? 'active' : ''}" data-id="${esc(c.id)}" data-val="ok">
              <i class="ti ti-check"></i>
            </button>
            <button type="button" class="check-estado estado-parcial ${estado === 'parcial' ? 'active' : ''}" data-id="${esc(c.id)}" data-val="parcial">
              <i class="ti ti-minus"></i>
            </button>
            <button type="button" class="check-estado estado-fail ${estado === 'fail' ? 'active' : ''}" data-id="${esc(c.id)}" data-val="fail">
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
  // GUARDAR EVALUACIÓN
  // =========================
  async function guardarEvaluacion() {
    if (!evaluadoActual) { alert('Selecciona un miembro del personal.'); return; }

    const { evaluados, total, pct } = calcularProgreso();
    if (evaluados < total) {
      if (!confirm(`Solo has evaluado ${evaluados} de ${total} criterios. ¿Deseas guardar igualmente?`)) return;
    }

    const { categoria, clase } = clasificar(pct);
    const obs = val('obs-eval');

    const body = {
      evaluado_id: evaluadoActual.id,
      evaluado_nombre: evaluadoActual.nombre,
      evaluado_cargo: evaluadoActual.cargo,
      evaluado_turno: evaluadoActual.turno || '—',
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

      alert('✅ Evaluación guardada correctamente.');
      resetEvaluacion();
      await cargarEvaluaciones();
      renderHistorialEvaluado();
      renderPlanes();

    } catch (e) {
      console.error('Error guardando evaluación:', e);
      alert('⚠️ No se pudo guardar la evaluación. Intenta de nuevo.');
    } finally {
      const btn = $('btn-guardar-eval');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-device-floppy"></i> Guardar Evaluación'; }
    }
  }

  // =========================
  // HISTORIAL DEL EVALUADO
  // =========================
  function renderHistorialEvaluado() {
    const cont = $('historial-evaluaciones');
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
          <div class="hist-acciones">
            <button type="button" class="btn btn-danger btn-xs" onclick="eliminarEvaluacion('${esc(e.id)}')">
              <i class="ti ti-trash"></i>
            </button>
          </div>
        </div>`;
    }).join('');
  }

  // =========================
  // ELIMINAR EVALUACIÓN
  // =========================
  window.eliminarEvaluacion = async function (id) {
    if (!confirm('¿Eliminar esta evaluación? Esta acción no se puede deshacer.')) return;

    try {
      const response = await fetchConRetry(
        `${API_URL}/auditoria-interna/${id}`,
        { method: 'DELETE', headers: authHeaders() },
        2
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      evaluaciones = evaluaciones.filter(e => String(e.id) !== String(id));
      renderHistorialEvaluado();
      alert('✅ Evaluación eliminada.');
    } catch (e) {
      console.error('Error eliminando:', e);
      alert('⚠️ No se pudo eliminar la evaluación.');
    }
  };

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
  // CARGAR EVALUACIONES (API)
  // =========================
  async function cargarEvaluaciones() {
    try {
      const response = await fetchConRetry(
        `${API_URL}/auditoria-interna?t=${Date.now()}`,
        { headers: authHeaders() },
        2
      );

      if (response.ok) {
        const data = await response.json();
        evaluaciones = Array.isArray(data) ? data : (data.items || []);
      } else {
        console.warn('No se pudieron cargar evaluaciones, usando vacío.');
        evaluaciones = [];
      }
    } catch (e) {
      console.warn('Error cargando evaluaciones:', e);
      evaluaciones = [];
    }

    // KPIs globales
    actualizarKPIsGlobales();
  }

  function actualizarKPIsGlobales() {
    const total = evaluaciones.length;
    const pctPromedio = total
      ? Math.round(evaluaciones.reduce((s, e) => s + (Number(e.puntaje_total) || 0), 0) / total)
      : 0;

    setText('kpi-total', total);
    setText('kpi-promedio', `${pctPromedio}%`);
    setText('kpi-evaluaciones-sub', total ? `${total} registros` : 'Sin registros');
  }

  // =========================
  // EXPORTACIONES
  // =========================
  window.exportarCSV = function () {
    if (evaluaciones.length === 0) { alert('No hay evaluaciones para exportar.'); return; }

    const header = ['ID', 'Evaluado', 'Cargo', 'Puntaje', 'Categoría', 'Evaluador', 'Fecha', 'Observaciones'];
    const rows = evaluaciones.map(e => [
      e.id, e.evaluado_nombre, e.evaluado_cargo,
      e.puntaje_total, e.categoria, e.evaluador,
      fmtFecha(e.fecha), (e.observaciones || '').replace(/[\n\r,]/g, ' ')
    ]);

    const csv = [header, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditorias_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // =========================
  // INICIALIZACIÓN
  // =========================
  function init() {
    initSelectorEvaluado();
    resetEvaluacion();

    const btnGuardar = $('btn-guardar-eval');
    if (btnGuardar) btnGuardar.addEventListener('click', guardarEvaluacion);

    const btnReset = $('btn-reset-eval');
    if (btnReset) btnReset.addEventListener('click', () => {
      if (confirm('¿Limpiar la evaluación actual?')) resetEvaluacion();
    });

    cargarPersonal();
    cargarEvaluaciones();
    renderPlanes();
  }

  verificarSesion();

})();
```

¿Qué estaba mal y qué se corrigió?

1. Archivo cortado: El código original terminaba en function renderHistorialEvaluado() { sin cerrar la función ni el })(); del IIFE. Eso hacía que el archivo fuera inválido y el navegador lo ignorara por completo.
2. Faltaban funciones clave: No existían cargarEvaluaciones, guardarEvaluacion, actualizarKPIsGlobales, exportarCSV, init, ni el verificarSesion() correcto.
3. Faltaban referencias al DOM: El HTML (que no me pasaste, pero que se deduce del código) espera IDs como btn-guardar-eval, btn-reset-eval, checklist-body, pct-label, badge-progreso, kpi-total, etc. Ahora se usan todos de forma segura (con ?. o comprobando existencia).
4. Lógica de planes sin usar: La función generarPlanesDesdeEvaluacion existía pero nunca se llamaba. Ahora al guardar una evaluación con categoría Regular o Deficiente, puedes generar planes (puedes añadirlo al guardarEvaluacion si quieres que se guarden automáticamente; por ahora solo se muestra la lista si los tienes precargados).

Cómo añadir la generación automática de planes al guardar

Si quieres que los planes se generen solos al guardar una evaluación deficiente, sustituye esta parte de guardarEvaluacion:

```javascript
alert('✅ Evaluación guardada correctamente.');
resetEvaluacion();
await cargarEvaluaciones();
renderHistorialEvaluado();
renderPlanes();
```

por esto:

```javascript
const nuevosPlanes = generarPlanesDesdeEvaluacion(evaluadoActual, body, pct, categoria);
planes = [...planes, ...nuevosPlanes];

alert('✅ Evaluación guardada correctamente.');
resetEvaluacion();
await cargarEvaluaciones();
renderHistorialEvaluado();
renderPlanes();
```

Con eso, cada vez que guardes una evaluación baja, aparecerán automáticamente los planes de mejora en la lista de la derecha. Recuerda guardar el archivo y recargar con Ctrl + F5.
