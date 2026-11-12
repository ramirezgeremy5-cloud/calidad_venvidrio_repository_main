/* ==========================================
   VENVIDRIO - AUDITORÍA INTERNA DE CALIDAD
   auditoria_interna.js - v5 (Completo y Adaptado)
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

  const BASE = `${API_URL}/auditorias/interna`;
  const ROLES_PERMITIDOS = [2, 3]; // 2 = supervisor, 3 = admin

  // =========================
  // CRITERIOS Y FALLBACK
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
  // ESTADO GLOBAL
  // =========================
  let personal = [...PERSONAL_FALLBACK];
  let evaluaciones = [];
  let evaluadoActual = null;
  let evaluacionState = {};
  let rolActual = 0;
  let evaluacionAEliminar = null;

  // =========================
  // UTILIDADES
  // =========================
  const $ = (id) => document.getElementById(id);
  const val = (id) => $(id) ? String($(id).value).trim() : '';
  const setText = (id, t) => { if ($(id)) $(id).textContent = t; };

  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtFecha(f) {
    if (!f) return '—';
    const d = new Date(f);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function iniciales(nombre) {
    if (!nombre) return '??';
    const partes = String(nombre).trim().split(/\s+/);
    return ((partes[0]?.[0] || '') + (partes[1]?.[0] || '')).toUpperCase();
  }

  function authHeaders() {
    return {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    };
  }

  async function fetchConTimeout(url, options = {}, timeout = 15000) {
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

  function clasificar(pct) {
    if (pct >= 90) return { categoria: 'Excelente',  clase: 'cat-excelente' };
    if (pct >= 75) return { categoria: 'Bueno',      clase: 'cat-bueno' };
    if (pct >= 60) return { categoria: 'Regular',    clase: 'cat-regular' };
    return { categoria: 'Deficiente', clase: 'cat-deficiente' };
  }

  function mostrarToast(msg) {
    const toast = $('toast-auditoria');
    if (toast) {
      toast.querySelector('span').textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }
  }

  // =========================
  // CARGA DE DATOS INICIALES
  // =========================
  async function cargarPersonal() {
    try {
      const res = await fetchConTimeout(`${API_URL}/usuarios?t=${Date.now()}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const lista = Array.isArray(data) ? data : (data.items || data.usuarios || []);
        if (lista.length > 0) {
          personal = lista.map(u => ({
            id: u.id,
            nombre: u.nombre || 'Sin nombre',
            cargo: u.cargo || 'Personal',
            turno: u.turno || 'A',
            ingreso: u.created_at || u.fecha_ingreso || null
          }));
        }
      }
    } catch (e) {
      console.warn('Fallo al cargar usuarios del backend, usando fallback.');
    }
    poblarSelectorPersonal();
  }

  async function cargarEvaluaciones() {
    try {
      const res = await fetchConTimeout(`${BASE}/evaluaciones?t=${Date.now()}`, { headers: authHeaders() });
      if (res.ok) {
        evaluaciones = await res.json();
      } else {
        evaluaciones = [];
      }
    } catch (e) {
      console.error('Error cargando evaluaciones:', e);
      evaluaciones = [];
    }
    renderKPIs();
    renderTablaEvaluaciones();
    renderHistorialEvaluado();
    poblarFiltros();
  }

  // =========================
  // RENDERIZADO DE UI
  // =========================
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

  function renderKPIs() {
    const total = evaluaciones.length;
    const promedio = total ? Math.round(evaluaciones.reduce((s, e) => s + (e.puntaje || 0), 0) / total) : 0;
    const personasUnicas = new Set(evaluaciones.map(e => e.evaluado_id)).size;
    const planesActivos = evaluaciones.filter(e => e.categoria === 'Deficiente' || e.categoria === 'Regular').length; // Simulación de planes

    setText('kpi-evaluaciones', total);
    setText('kpi-evaluaciones-sub', 'Registradas en el sistema');
    
    setText('kpi-promedio', `${promedio}%`);
    setText('kpi-promedio-sub', 'Global del personal');
    
    setText('kpi-personas', personasUnicas);
    setText('kpi-personas-sub', 'Con al menos 1 evaluación');
    
    setText('kpi-planes', planesActivos);
    setText('kpi-planes-sub', planesActivos ? 'Derivados de bajas notas' : 'Todo al día');
  }

  function renderTablaEvaluaciones() {
    const tbody = $('tabla-eval');
    if (!tbody) return;

    if (evaluaciones.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;">No hay evaluaciones registradas.</td></tr>`;
      return;
    }

    tbody.innerHTML = evaluaciones.map(e => {
      const pts = e.puntaje || 0;
      const cls = clasificar(pts).clase;
      
      // Buscar el cargo en el personal (por si el backend no lo envía)
      const persona = personal.find(p => p.id === e.evaluado_id);
      const cargo = e.cargo || (persona ? persona.cargo : '—');

      return `
        <tr>
          <td><strong>${esc(e.evaluado_nombre || 'Desconocido')}</strong></td>
          <td>${esc(cargo)}</td>
          <td>${esc(e.evaluador_nombre || '—')}</td>
          <td style="text-transform:capitalize;">${esc(e.periodo || '—')}</td>
          <td><strong>${pts}%</strong></td>
          <td><span class="cat-badge ${cls}">${esc(e.categoria || '—')}</span></td>
          <td>${(e.categoria === 'Deficiente' || e.categoria === 'Regular') ? '<span class="badge badge-warning">Sí</span>' : '0'}</td>
          <td>${fmtFecha(e.fecha)}</td>
          <td style="text-align:center;">
            ${rolActual === 3 ? `<button class="btn-icon btn-danger" onclick="abrirModalEliminar(${e.id}, '${esc(e.evaluado_nombre)}')"><i class="ti ti-trash"></i></button>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderHistorialEvaluado() {
    const cont = $('historial-evaluado');
    if (!cont) return;

    if (!evaluadoActual) {
      cont.innerHTML = `<div class="empty-panel" style="padding:2rem;text-align:center;"><i class="ti ti-history" style="font-size:2rem;color:#ccc;"></i><p>Selecciona alguien para ver su historial</p></div>`;
      return;
    }

    const hist = evaluaciones.filter(e => String(e.evaluado_id) === String(evaluadoActual.id));
    
    if (hist.length === 0) {
      cont.innerHTML = `<div class="empty-panel" style="padding:2rem;text-align:center;"><i class="ti ti-history" style="font-size:2rem;color:#ccc;"></i><p>Sin historial registrado</p></div>`;
      return;
    }

    cont.innerHTML = hist.map(e => {
      const pts = e.puntaje || 0;
      return `
        <div class="hist-item" style="padding: 0.8rem 1rem; border-bottom: 1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:12px; color:#666; text-transform:capitalize;">${esc(e.periodo)} · ${fmtFecha(e.fecha)}</div>
            <div style="font-weight:600; font-size:14px; color:var(--text-main);">${esc(e.categoria)}</div>
          </div>
          <div style="font-size:16px; font-weight:700; color:var(--primary);">${pts}%</div>
        </div>
      `;
    }).join('');
  }

  // =========================
  // LÓGICA DEL CHECKLIST
  // =========================
  function resetEvaluacion() {
    evaluacionState = {};
    CRITERIOS.forEach(c => evaluacionState[c.id] = null);
    renderChecklist();
    if ($('obs-eval')) $('obs-eval').value = '';
    if ($('obs-eval-count')) $('obs-eval-count').textContent = '0';
  }

  function renderChecklist() {
    const cont = $('checklist-body');
    if (!cont) return;

    cont.innerHTML = CRITERIOS.map((c, i) => {
      const estado = evaluacionState[c.id];
      const cls = estado ? `evaluado ${estado === 'ok' ? 'cumple' : estado === 'parcial' ? 'parcial' : 'no-cumple'}` : '';
      
      return `
        <div class="check-item ${cls}" data-id="${c.id}">
          <div class="check-num">${String(i + 1).padStart(2, '0')}</div>
          <div class="check-text">${esc(c.texto)}</div>
          <div class="check-estados">
            <button type="button" class="check-estado estado-ok ${estado === 'ok' ? 'active' : ''}" data-id="${c.id}" data-val="ok" title="Cumple (1.0)"><i class="ti ti-check"></i></button>
            <button type="button" class="check-estado estado-parcial ${estado === 'parcial' ? 'active' : ''}" data-id="${c.id}" data-val="parcial" title="Parcial (0.5)"><i class="ti ti-minus"></i></button>
            <button type="button" class="check-estado estado-fail ${estado === 'fail' ? 'active' : ''}" data-id="${c.id}" data-val="fail" title="No cumple (0.0)"><i class="ti ti-x"></i></button>
          </div>
        </div>`;
    }).join('');

    cont.querySelectorAll('.check-estado').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const v = btn.dataset.val;
        evaluacionState[id] = (evaluacionState[id] === v) ? null : v;
        renderChecklist();
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
    return { ok, parcial, fail, evaluados, total, pct };
  }

  function actualizarProgreso() {
    const { evaluados, total, pct } = calcularProgreso();
    if ($('aud-progress-fill')) $('aud-progress-fill').style.width = `${pct}%`;
    setText('pct-label', `${pct}%`);
    setText('badge-progreso', `${evaluados} / ${total}`);
  }

  // =========================
  // GUARDAR EVALUACIÓN
  // =========================
  async function guardarEvaluacion() {
    if (!evaluadoActual) {
      alert('Selecciona primero a la persona a evaluar.');
      return;
    }
    
    const { evaluados, total, pct } = calcularProgreso();
    if (evaluados < total && !confirm(`Solo has evaluado ${evaluados} de ${total} criterios. ¿Deseas guardar de todas formas?`)) {
      return;
    }

    const categoria = clasificar(pct).categoria;
    const payload = {
      evaluado_id: evaluadoActual.id,
      periodo: val('periodo') || 'mensual',
      puntaje: pct,
      categoria: categoria,
      observaciones: val('obs-eval'),
      detalles: CRITERIOS.map(c => ({
        criterio_id: c.id,
        texto: c.texto,
        valor: evaluacionState[c.id] || null
      }))
    };

    const btn = $('btn-guardar-eval');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="ti ti-loader"></i> Guardando...';
    }

    try {
      const res = await fetchConTimeout(`${BASE}/evaluaciones`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorTxt = await res.text();
        throw new Error(errorTxt);
      }

      mostrarToast('Evaluación guardada exitosamente');
      await cargarEvaluaciones();
      resetEvaluacion();
      
    } catch (e) {
      console.error('Error al guardar:', e);
      alert('❌ Error al guardar en el servidor. Revisa la consola (F12) para más detalles.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar Evaluación';
      }
    }
  }

  // =========================
  // ELIMINAR EVALUACIÓN (MODAL)
  // =========================
  window.abrirModalEliminar = function(id, nombre) {
    evaluacionAEliminar = id;
    if ($('eliminar-eval-nombre')) $('eliminar-eval-nombre').textContent = nombre;
    if ($('modal-eliminar-eval')) $('modal-eliminar-eval').style.display = 'flex';
  };

  function cerrarModalEliminar() {
    evaluacionAEliminar = null;
    if ($('modal-eliminar-eval')) $('modal-eliminar-eval').style.display = 'none';
  }

  async function confirmarEliminar() {
    if (!evaluacionAEliminar) return;
    
    try {
      const res = await fetchConTimeout(`${BASE}/evaluaciones/${evaluacionAEliminar}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      
      if (res.ok || res.status === 204) {
        mostrarToast('Evaluación eliminada');
        cerrarModalEliminar();
        await cargarEvaluaciones();
      } else {
        alert('Error al eliminar la evaluación.');
      }
    } catch (e) {
      alert('Error de red al intentar eliminar.');
    }
  }

  // =========================
  // FILTROS
  // =========================
  function poblarFiltros() {
    const selEvaluador = $('f-evaluador');
    if (selEvaluador) {
      const evaluadores = [...new Set(evaluaciones.map(e => e.evaluador_nombre).filter(Boolean))];
      selEvaluador.innerHTML = '<option value="">Todos</option>' + evaluadores.map(n => `<option value="${n}">${n}</option>`).join('');
    }
    
    const selCargo = $('f-cargo');
    if (selCargo) {
      const cargos = [...new Set(personal.map(p => p.cargo).filter(Boolean))];
      selCargo.innerHTML = '<option value="">Todos</option>' + cargos.map(c => `<option value="${c}">${c}</option>`).join('');
    }
  }

  function aplicarFiltros() {
    // NOTA: En una app real aquí harías un fetch con query params.
    // Para este ejemplo, filtraremos en el cliente sobre la tabla actual.
    const cargo = val('f-cargo').toLowerCase();
    const evaluador = val('f-evaluador').toLowerCase();
    const periodo = val('f-periodo').toLowerCase();
    const categoria = val('f-categoria').toLowerCase();
    const desde = val('f-desde');
    const hasta = val('f-hasta');

    const filtradas = evaluaciones.filter(e => {
      const persona = personal.find(p => p.id === e.evaluado_id);
      const eCargo = (e.cargo || (persona ? persona.cargo : '')).toLowerCase();
      const eEvaluador = (e.evaluador_nombre || '').toLowerCase();
      const ePeriodo = (e.periodo || '').toLowerCase();
      const eCategoria = (e.categoria || '').toLowerCase();
      const eFecha = e.fecha ? e.fecha.split('T')[0] : '';

      if (cargo && !eCargo.includes(cargo)) return false;
      if (evaluador && !eEvaluador.includes(evaluador)) return false;
      if (periodo && ePeriodo !== periodo) return false;
      if (categoria && eCategoria !== categoria) return false;
      if (desde && eFecha < desde) return false;
      if (hasta && eFecha > hasta) return false;

      return true;
    });

    renderTablaFiltrada(filtradas);
    if ($('filtro-resultados')) {
      $('filtro-resultados').innerHTML = `📋 Mostrando <strong>${filtradas.length}</strong> de ${evaluaciones.length} evaluaciones`;
    }
  }

  function renderTablaFiltrada(filtradas) {
    const tbody = $('tabla-eval');
    if (!tbody) return;

    if (filtradas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;">No se encontraron resultados con los filtros aplicados.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtradas.map(e => {
      const pts = e.puntaje || 0;
      const cls = clasificar(pts).clase;
      const persona = personal.find(p => p.id === e.evaluado_id);
      const cargo = e.cargo || (persona ? persona.cargo : '—');

      return `
        <tr>
          <td><strong>${esc(e.evaluado_nombre || 'Desconocido')}</strong></td>
          <td>${esc(cargo)}</td>
          <td>${esc(e.evaluador_nombre || '—')}</td>
          <td style="text-transform:capitalize;">${esc(e.periodo || '—')}</td>
          <td><strong>${pts}%</strong></td>
          <td><span class="cat-badge ${cls}">${esc(e.categoria || '—')}</span></td>
          <td>${(e.categoria === 'Deficiente' || e.categoria === 'Regular') ? '<span class="badge badge-warning">Sí</span>' : '0'}</td>
          <td>${fmtFecha(e.fecha)}</td>
          <td style="text-align:center;">
            ${rolActual === 3 ? `<button class="btn-icon btn-danger" onclick="abrirModalEliminar(${e.id}, '${esc(e.evaluado_nombre)}')"><i class="ti ti-trash"></i></button>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  function limpiarFiltros() {
    if ($('f-cargo')) $('f-cargo').value = '';
    if ($('f-evaluador')) $('f-evaluador').value = '';
    if ($('f-periodo')) $('f-periodo').value = '';
    if ($('f-categoria')) $('f-categoria').value = '';
    if ($('f-desde')) $('f-desde').value = '';
    if ($('f-hasta')) $('f-hasta').value = '';
    
    renderTablaEvaluaciones();
    if ($('filtro-resultados')) {
      $('filtro-resultados').innerHTML = '📋 Mostrando todas las evaluaciones';
    }
  }

  // =========================
  // EXPORTACIONES
  // =========================
  async function descargarReporte(tipo) {
    const url = `${BASE}/evaluaciones/exportar/${tipo}`;
    try {
      const res = await fetchConTimeout(url, { headers: authHeaders() }, 30000);
      if (!res.ok) throw new Error('Error al generar el reporte');
      
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = tipo === 'pdf' ? 'Evaluaciones_Global.pdf' : 'Evaluaciones_Global.docx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert(`No se pudo descargar el archivo ${tipo.toUpperCase()}.`);
    }
  }

  // =========================
  // EVENT LISTENERS
  // =========================
  function initListeners() {
    // Evaluado Change
    if ($('evaluado')) {
      $('evaluado').addEventListener('change', (e) => {
        evaluadoActual = personal.find(p => String(p.id) === e.target.value) || null;
        mostrarFicha(evaluadoActual);
        renderHistorialEvaluado();
        resetEvaluacion();
      });
    }

    // Guardar y Reiniciar
    if ($('btn-guardar-eval')) $('btn-guardar-eval').addEventListener('click', guardarEvaluacion);
    if ($('btn-reset-eval')) $('btn-reset-eval').addEventListener('click', resetEvaluacion);

    // Contador de caracteres
    if ($('obs-eval')) {
      $('obs-eval').addEventListener('input', (e) => {
        if ($('obs-eval-count')) $('obs-eval-count').textContent = e.target.value.length;
      });
    }

    // Filtros
    if ($('btn-aplicar-filtros')) $('btn-aplicar-filtros').addEventListener('click', aplicarFiltros);
    if ($('btn-limpiar-filtros')) $('btn-limpiar-filtros').addEventListener('click', limpiarFiltros);

    // Modales
    if ($('modal-eliminar-close')) $('modal-eliminar-close').addEventListener('click', cerrarModalEliminar);
    if ($('modal-eliminar-cancelar')) $('modal-eliminar-cancelar').addEventListener('click', cerrarModalEliminar);
    if ($('modal-eliminar-confirmar')) $('modal-eliminar-confirmar').addEventListener('click', confirmarEliminar);

    // Exportaciones
    if ($('btn-export-pdf-global')) $('btn-export-pdf-global').addEventListener('click', () => descargarReporte('pdf'));
    if ($('btn-export-word-global')) $('btn-export-word-global').addEventListener('click', () => descargarReporte('word'));
  }

  // =========================
  // INIT
  // =========================
  async function init() {
    const rol = parseInt(localStorage.getItem('role'), 10);
    rolActual = isNaN(rol) ? 0 : rol;

    initListeners();

    // Cargar datos en orden
    await cargarPersonal();
    await cargarEvaluaciones();
    
    resetEvaluacion();
  }

  // Arrancar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
