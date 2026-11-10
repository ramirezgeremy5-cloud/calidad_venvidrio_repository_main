/* ==========================================
   VENVIDRIO - DASHBOARD
   JS v15 - Unidades puras en gráfico, KPIs reales
   ========================================== */

// ==========================================
// 1. CONTROL DE ALERTAS NATIVAS
// ==========================================
(function() {
  var _alert = window.alert;
  var _confirm = window.confirm;

  window.alert = function(msg) {
    if (typeof window.mostrarAlertaPersonalizada === 'function') {
      window.mostrarAlertaPersonalizada(msg, 'info');
    } else {
      _alert(msg);
    }
  };

  window.confirm = function(msg) {
    if (typeof window.mostrarAlertaPersonalizada === 'function') {
      window.mostrarAlertaPersonalizada(msg, 'warning', true).then(function(res) {
        if (res) console.log('Confirmado por el usuario');
      });
      return true; 
    } else {
      return _confirm(msg);
    }
  };
})();

// Detectar dinámicamente la URL del servidor
let API_URL;
if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
  API_URL = "http://127.0.0.1:8000";
} else {
  API_URL = "https://calidad-venvidrio-repository-main.onrender.com";
}

let productionChart = null;
let defectosChart = null;
let aptoChart = null;
let lineasChart = null;
let eficienciaChart = null;
let intervaloCarga = null;
let datosDashboard = null;
let periodoActual = 7;
let filtroGrafico = 'unidades'; // 👈 FIX: Solo unidades
let filtroPlanta = '';
let abortController = null;

const CLASE_COLOR = {
  "Crítico": "#dc3545",
  "Mayor B+": "#e65100",
  "Mayor B-": "#f57f17",
  "Menor": "#1565c0"
};

const ESTATUS_BADGE = {
  "100": { class: 'badge-warning', label: 'Pendiente' },
  "200": { class: 'badge-success', label: 'Apto' },
  "300": { class: 'badge-danger', label: 'Retenido' },
  "600": { class: 'badge-info', label: 'Despachado' },
  "910": { class: 'badge-info', label: 'Decorado' },
  "950": { class: 'badge-warning', label: 'Reselec.' },
  "999": { class: 'badge-warning', label: 'Sobrante' }
};

/* ==========================================
   LOGS
========================================== */
function log(msg, data = null) {
  const t = new Date().toLocaleTimeString();
  data ? console.log(`[${t}] 📊 ${msg}`, data) : console.log(`[${t}] 📊 ${msg}`);
}
function logError(msg, err = null) {
  const t = new Date().toLocaleTimeString();
  err ? console.error(`[${t}] ❌ ${msg}`, err) : console.error(`[${t}] ❌ ${msg}`);
}
function logSuccess(msg, data = null) {
  const t = new Date().toLocaleTimeString();
  data ? console.log(`[${t}] ✅ ${msg}`, data) : console.log(`[${t}] ✅ ${msg}`);
}

/* ==========================================
   UTILIDADES
========================================== */
function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtNum(n) {
  if (n === null || n === undefined) return '0';
  return Number(n).toLocaleString('es-VE');
}

function fmtFecha(fecha) {
  if (!fecha) return '—';
  const d = new Date(fecha);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES');
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function filtrarPorDias(lista, campoFecha) {
  if (periodoActual === 'all' || periodoActual >= 365) return lista;
  const hoy = new Date();
  const limite = new Date(hoy.getTime() - (periodoActual * 24 * 60 * 60 * 1000));
  return lista.filter(item => {
    const f = new Date(item[campoFecha]);
    return !isNaN(f.getTime()) && f >= limite;
  });
}

function normalizarClase(claseStr) {
  if (!claseStr) return 'Menor';
  const c = String(claseStr).toLowerCase().trim();
  if (c.includes('critic')) return 'Crítico';
  if (c.includes('b+') || c.includes('b +')) return 'Mayor B+';
  if (c.includes('b-') || c.includes('b -')) return 'Mayor B-';
  if (c.includes('menor')) return 'Menor';
  return 'Menor';
}

/* ==========================================
   MANEJO DE ERRORES EN INTERFAZ
========================================== */
function renderError(contenedorId, mensaje, callbackReintentar) {
  const el = document.getElementById(contenedorId);
  if (!el) return;
  el.innerHTML = `
    <div class="error-state">
      <i class="ti ti-cloud-off"></i>
      <p>${mensaje}</p>
      <button class="btn-reintentar" id="btn-reintentar-${contenedorId}">Reintentar</button>
    </div>
  `;
  document.getElementById(`btn-reintentar-${contenedorId}`)?.addEventListener('click', () => {
    el.innerHTML = `<div class="loading-placeholder"><i class="ti ti-loader-2 loading-spinner"></i> Reintentando...</div>`;
    callbackReintentar();
  });
}

/* ==========================================
   CARGA PRINCIPAL DE DATOS
========================================== */
async function cargarDashboard(isBackground = false) {
  if (abortController) abortController.abort();
  abortController = new AbortController();

  if (!isBackground) {
    document.getElementById('btn-refresh')?.classList.add('loading');
  }

  try {
    log('Cargando dashboard...');

    const token = localStorage.getItem('token');
    if (!token) return;

    const headers = { 'Authorization': `Bearer ${token}` };

    let urlLotes = `${API_URL}/produccion?limit=2000`;
    let urlDefectos = `${API_URL}/defectos?limit=2000`;

    if (filtroPlanta) {
      urlLotes += `&planta=${encodeURIComponent(filtroPlanta)}`;
      urlDefectos += `&planta=${encodeURIComponent(filtroPlanta)}`;
    }

    const [resLotes, resDefectos] = await Promise.all([
      fetch(urlLotes, { headers, signal: abortController.signal }),
      fetch(urlDefectos, { headers, signal: abortController.signal })
    ]);

    if (resLotes.status === 401 || resDefectos.status === 401) {
      logError('Token expirado. Deteniendo carga.');
      return;
    }

    if (!resLotes.ok || !resDefectos.ok) throw new Error("Error cargando datos de la API");

    const lotes = await resLotes.json();
    const defectos = await resDefectos.json();

    let defectosFiltrados = defectos;
    if (filtroPlanta) {
      const idsLotesFiltrados = new Set(lotes.map(l => l.id));
      defectosFiltrados = defectos.filter(d => idsLotesFiltrados.has(d.produccion_id));
    }

    datosDashboard = { lotes, defectos: defectosFiltrados };

    logSuccess(`${lotes.length} lotes | ${defectosFiltrados.length} defectos`);

    renderKPIs(lotes, defectosFiltrados);
    renderChartProduccion(lotes);
    renderChartDefectos(defectosFiltrados);
    renderChartApto(lotes);
    renderChartLineas(lotes);
    renderTopProductos(lotes);
    renderTopTiposDefecto(defectosFiltrados);
    renderChartEficiencia(lotes);
    renderTopClientesRetencion(lotes);
    renderAuditoriasPendientes(lotes, defectosFiltrados);
    renderAlertas(lotes, defectosFiltrados);
    renderTablaUltimosRegistros(lotes);

    setText('ultima-actualizacion', new Date().toLocaleTimeString('es-VE'));

  } catch (error) {
    if (error.name === 'AbortError') return;
    logError('Error cargando dashboard:', error);

    ['top-productos', 'top-tipos-defecto', 'top-clientes-retencion', 'auditorias-pendientes', 'dashboard-alerts', 'dashboard-table'].forEach(id => {
      renderError(id, 'No se pudieron cargar los datos', () => cargarDashboard());
    });

    mostrarErrorKPI();
  } finally {
    document.getElementById('btn-refresh')?.classList.remove('loading');
  }
}

function mostrarErrorKPI() {
  ['dash-unidades', 'dash-lotes', 'dash-pendientes', 'dash-defectos', 'dash-rechazo', 'dash-eficiencia'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '⚠️';
  });
}

/* ==========================================
   KPIs
========================================== */
function renderKPIs(lotes, defectos) {
  const lotesFiltrados = filtrarPorDias(lotes, 'fecha_produccion');
  const defectosFiltrados = filtrarPorDias(defectos, 'fecha_registro');

  const totalUnidades = lotesFiltrados.reduce((a, l) => a + (l.cantidad || 0), 0);
  const totalLotes = lotesFiltrados.length;
  const totalDefectos = defectosFiltrados.length;

  const pendientes = lotesFiltrados.filter(l => String(l.estatus || '100') === '100').length;

  // 👇 FIX CALIDAD 1: Tasa de Rechazo (Aptos vs Total Evaluado a nivel de paletas)
  const retenidos = lotesFiltrados.filter(l => String(l.estatus) === '300');
  const paletasInspeccionadas = lotesFiltrados.reduce((a, l) => a + (l.paletas || 0), 0);
  const paletasRetenidas = retenidos.reduce((a, l) => a + (l.paletas || 0), 0);
  const tasaRechazo = paletasInspeccionadas > 0
    ? ((paletasRetenidas / paletasInspeccionadas) * 100).toFixed(2)
    : '0.00';

  // 👇 FIX CALIDAD 2: Eficiencia General (Aptos vs Total Evaluado)
  const lotesEvaluados = lotesFiltrados.filter(l => String(l.estatus) === '200' || String(l.estatus) === '300');
  const unidadesEvaluadas = lotesEvaluados.reduce((a, l) => a + (l.cantidad || 0), 0);
  const unidadesAptas = lotesFiltrados.filter(l => String(l.estatus) === '200').reduce((a, l) => a + (l.cantidad || 0), 0);

  const eficiencia = unidadesEvaluadas > 0
    ? ((unidadesAptas / unidadesEvaluadas) * 100).toFixed(1)
    : '0.0';

  setText('dash-unidades', fmtNum(totalUnidades));
  setText('dash-lotes', fmtNum(totalLotes));
  setText('dash-pendientes', fmtNum(pendientes));
  setText('dash-defectos', fmtNum(totalDefectos));
  setText('dash-rechazo', `${tasaRechazo}%`);
  setText('dash-eficiencia', `${eficiencia}%`);
  setText('total-defectos-badge', `Total: ${totalDefectos}`);
}

/* ==========================================
   GRÁFICA: PRODUCCIÓN (SOLO UNIDADES)
========================================== */
function renderChartProduccion(lotes) {
  const canvas = document.getElementById('productionChart');
  if (!canvas) return;

  const lotesFiltrados = filtrarPorDias(lotes, 'fecha_produccion');

  const porDia = {};
  lotesFiltrados.forEach(l => {
    if (!l.fecha_produccion) return;
    const key = new Date(l.fecha_produccion).toISOString().split('T')[0];
    if (!porDia[key]) porDia[key] = { unidades: 0 };
    porDia[key].unidades += (l.cantidad || 0);
  });

  const fechas = Object.keys(porDia).sort().slice(-14);
  const labels = fechas.map(f => {
    const d = new Date(f + 'T00:00:00');
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });

  // 👇 FIX: Solo mostramos el dataset de Unidades para que la gráfica sea legible
  const datasets = [{
    label: 'Unidades Producidas',
    data: fechas.map(f => porDia[f].unidades),
    backgroundColor: 'rgba(26, 35, 126, 0.75)',
    borderColor: 'rgba(26, 35, 126, 1)',
    borderWidth: 2,
    borderRadius: 6,
    barPercentage: 0.6
  }];

  if (productionChart) productionChart.destroy();

  productionChart = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (e, activeElements) => {
        if (activeElements.length > 0) {
          const index = activeElements[0].index;
          const fecha = fechas[index];
          window.location.href = `../pages/produccion.html?fecha=${fecha}`;
        }
      },
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, padding: 20, font: { size: 12, weight: '500' } } },
        tooltip: {
          backgroundColor: 'rgba(255,255,255,0.95)', titleColor: '#1a237e', bodyColor: '#333', borderColor: '#e0e0e0', borderWidth: 1, cornerRadius: 8, padding: 12,
          callbacks: { afterBody: () => 'Haz clic para ver detalle' }
        }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { font: { size: 11, weight: '500' } } }
      },
      animation: { duration: 800, easing: 'easeOutQuart' }
    }
  });
}

/* ==========================================
   GRÁFICA: DEFECTOS POR CLASIFICACIÓN
========================================== */
function renderChartDefectos(defectos) {
  const canvas = document.getElementById('defectosChart');
  if (!canvas) return;

  const defectosFiltrados = filtrarPorDias(defectos, 'fecha_registro');
  const porClase = { 'Crítico': 0, 'Mayor B+': 0, 'Mayor B-': 0, 'Menor': 0 };

  defectosFiltrados.forEach(d => {
    const claseNorm = normalizarClase(d.clasificacion);
    if (porClase[claseNorm] !== undefined) porClase[claseNorm]++;
  });

  const labels = Object.keys(porClase);
  const values = Object.values(porClase);
  const colors = labels.map(k => CLASE_COLOR[k]);
  const total = values.reduce((a, b) => a + b, 0);

  if (defectosChart) defectosChart.destroy();

  defectosChart = new Chart(canvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderColor: '#fff', borderWidth: 2, hoverOffset: 6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 4, bottom: 4, left: 4, right: 4 } },
      onClick: (e, activeElements) => {
        if (activeElements.length > 0) {
          const clase = labels[activeElements[0].index];
          window.location.href = `../pages/defectos.html?clase=${encodeURIComponent(clase)}`;
        }
      },
      plugins: {
        legend: {
          position: 'bottom', align: 'center',
          labels: {
            usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 8, font: { size: 10, weight: '500' },
            generateLabels: function (chart) {
              const data = chart.data;
              return data.labels.map((label, i) => {
                const value = data.datasets[0].data[i];
                const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                return { text: `${label} (${pct}%)`, fillStyle: data.datasets[0].backgroundColor[i], strokeStyle: data.datasets[0].borderColor, lineWidth: data.datasets[0].borderWidth, pointStyle: 'circle', hidden: false, index: i };
              });
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(255,255,255,0.95)', titleColor: '#1a237e', bodyColor: '#333', borderColor: '#e0e0e0', borderWidth: 1, cornerRadius: 8, padding: 12,
          callbacks: {
            label: ctx => {
              const v = ctx.raw || 0;
              const pct = total > 0 ? Math.round((v / total) * 100) : 0;
              return ` ${ctx.label}: ${v} (${pct}%)`;
            },
            afterBody: () => 'Haz clic para ver en Defectos'
          }
        }
      },
      animation: { animateRotate: true, duration: 1000, easing: 'easeOutQuart' }
    }
  });

  const centerVal = document.getElementById('defectos-center-value');
  if (centerVal) centerVal.textContent = fmtNum(total);
}

/* ==========================================
   GRÁFICA: APTO vs RETENIDO
========================================== */
function renderChartApto(lotes) {
  const canvas = document.getElementById('aptoChart');
  if (!canvas) return;

  const lotesFiltrados = filtrarPorDias(lotes, 'fecha_produccion');
  const aptos = lotesFiltrados.filter(l => String(l.estatus) === '200').length;
  const retenidos = lotesFiltrados.filter(l => String(l.estatus) === '300').length;
  const total = aptos + retenidos;

  if (aptoChart) aptoChart.destroy();

  aptoChart = new Chart(canvas, {
    type: 'pie',
    data: {
      labels: ['APTO', 'RETENIDO'],
      datasets: [{ data: [aptos, retenidos], backgroundColor: ['#2e7d32', '#dc3545'], borderColor: '#fff', borderWidth: 2, hoverOffset: 6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 4, bottom: 4, left: 4, right: 4 } },
      onClick: (e, activeElements) => {
        if (activeElements.length > 0) {
          const index = activeElements[0].index;
          if (index === 1) window.location.href = `../pages/defectos.html`;
        }
      },
      plugins: {
        legend: {
          position: 'bottom', align: 'center',
          labels: {
            usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 8, font: { size: 10, weight: '500' },
            generateLabels: function (chart) {
              const data = chart.data;
              return data.labels.map((label, i) => {
                const value = data.datasets[0].data[i];
                const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                return { text: `${label} (${pct}%)`, fillStyle: data.datasets[0].backgroundColor[i], strokeStyle: data.datasets[0].borderColor, lineWidth: data.datasets[0].borderWidth, pointStyle: 'circle', hidden: false, index: i };
              });
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(255,255,255,0.95)', titleColor: '#1a237e', bodyColor: '#333', borderColor: '#e0e0e0', borderWidth: 1, cornerRadius: 8, padding: 12,
          callbacks: {
            label: ctx => {
              const v = ctx.raw || 0;
              const pct = total > 0 ? Math.round((v / total) * 100) : 0;
              return ` ${ctx.label}: ${v} (${pct}%)`;
            }
          }
        }
      },
      animation: { animateRotate: true, duration: 1000, easing: 'easeOutQuart' }
    }
  });

  const centerVal = document.getElementById('apto-center-value');
  if (centerVal) centerVal.textContent = fmtNum(total);
}

/* ==========================================
   GRÁFICA: PRODUCCIÓN POR LÍNEA
========================================== */
function renderChartLineas(lotes) {
  const canvas = document.getElementById('lineasChart');
  if (!canvas) return;

  const lotesFiltrados = filtrarPorDias(lotes, 'fecha_produccion');
  const porLinea = {};

  lotesFiltrados.forEach(l => {
    const linea = l.linea_produccion || 'Sin línea';
    if (!porLinea[linea]) porLinea[linea] = 0;
    porLinea[linea] += (l.cantidad || 0);
  });

  const ordenados = Object.entries(porLinea).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const labels = ordenados.map(([k]) => k);
  const valores = ordenados.map(([, v]) => v);
  const total = valores.reduce((a, b) => a + b, 0);

  const colores = [
    'rgba(26, 35, 126, 0.8)', 'rgba(76, 175, 80, 0.8)', 'rgba(255, 152, 0, 0.8)',
    'rgba(220, 53, 69, 0.8)', 'rgba(23, 162, 184, 0.8)', 'rgba(156, 39, 176, 0.8)',
    'rgba(255, 87, 34, 0.8)', 'rgba(63, 81, 181, 0.8)'
  ];

  if (lineasChart) lineasChart.destroy();

  lineasChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Unidades',
        data: valores,
        backgroundColor: colores.slice(0, valores.length),
        borderColor: colores.slice(0, valores.length).map(c => c.replace('0.8', '1')),
        borderWidth: 2,
        borderRadius: 6,
        barPercentage: 0.6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(255,255,255,0.95)', titleColor: '#1a237e', bodyColor: '#333', borderColor: '#e0e0e0', borderWidth: 1, cornerRadius: 8, padding: 12,
          callbacks: { label: ctx => { const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0; return `${ctx.raw.toLocaleString()} unidades (${pct}%)`; } }
        }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { font: { size: 10, weight: '500' } } }
      },
      animation: { duration: 800, easing: 'easeOutQuart' }
    }
  });
}

/* ==========================================
   TOP PRODUCTOS MÁS PRODUCIDOS
========================================== */
function renderTopProductos(lotes) {
  const el = document.getElementById('top-productos');
  if (!el) return;

  const lotesFiltrados = filtrarPorDias(lotes, 'fecha_produccion');
  const porProducto = {};

  lotesFiltrados.forEach(l => {
    const prod = l.tipo_producto || 'Sin producto';
    if (!porProducto[prod]) porProducto[prod] = { unidades: 0, lotes: 0, cliente: l.cliente };
    porProducto[prod].unidades += (l.cantidad || 0);
    porProducto[prod].lotes += 1;
  });

  const ordenados = Object.entries(porProducto).sort((a, b) => b[1].unidades - a[1].unidades).slice(0, 5);

  if (ordenados.length === 0) {
    el.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:1rem 0;"><i class="ti ti-inbox" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>Sin datos en este período</div>`;
    return;
  }

  const maxUnidades = ordenados[0][1].unidades;

  el.innerHTML = ordenados.map(([prod, data], i) => {
    const pct = maxUnidades > 0 ? (data.unidades / maxUnidades) * 100 : 0;
    return `
      <div class="rank-item">
        <div class="rank-num">${i + 1}</div>
        <div class="rank-info">
          <div class="rank-name">${esc(prod)}</div>
          <div class="rank-meta">${data.lotes} lote${data.lotes !== 1 ? 's' : ''} · ${esc(data.cliente || '—')}</div>
          <div class="rank-bar"><div class="rank-bar-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="rank-value">${fmtNum(data.unidades)}</div>
      </div>`;
  }).join('');
}

/* ==========================================
   TOP TIPOS DE DEFECTO
========================================== */
function renderTopTiposDefecto(defectos) {
  const el = document.getElementById('top-tipos-defecto');
  if (!el) return;

  const defectosFiltrados = filtrarPorDias(defectos, 'fecha_registro');
  const porTipo = {};

  defectosFiltrados.forEach(d => {
    const tipo = d.tipo_defecto || 'Sin tipo';
    if (!porTipo[tipo]) porTipo[tipo] = { piezas: 0, registros: 0, clase: normalizarClase(d.clasificacion) };
    porTipo[tipo].piezas += (d.cantidad_piezas || 0);
    porTipo[tipo].registros += 1;
  });

  const ordenados = Object.entries(porTipo).sort((a, b) => b[1].piezas - a[1].piezas).slice(0, 5);

  if (ordenados.length === 0) {
    el.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:1rem 0;"><i class="ti ti-circle-check" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;color:var(--success);"></i>Sin defectos en este período</div>`;
    return;
  }

  const maxPiezas = ordenados[0][1].piezas;

  el.innerHTML = ordenados.map(([tipo, data], i) => {
    const pct = maxPiezas > 0 ? (data.piezas / maxPiezas) * 100 : 0;
    const color = CLASE_COLOR[data.clase] || '#1565c0';
    return `
      <div class="rank-item">
        <div class="rank-num danger">${i + 1}</div>
        <div class="rank-info">
          <div class="rank-name">${esc(tipo)}</div>
          <div class="rank-meta">
            <span style="color:${color};font-weight:600;">${esc(data.clase)}</span>
            · ${data.registros} registro${data.registros !== 1 ? 's' : ''}
          </div>
          <div class="rank-bar"><div class="rank-bar-fill danger" style="width:${pct}%"></div></div>
        </div>
        <div class="rank-value danger">${fmtNum(data.piezas)}</div>
      </div>`;
  }).join('');
}

/* ==========================================
   EFICIENCIA MENSUAL
========================================== */
function renderChartEficiencia(lotes) {
  const canvas = document.getElementById('eficienciaChart');
  if (!canvas) return;

  const hoy = new Date();
  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('es-VE', { month: 'short' })
    });
  }

  const valores = meses.map(m => {
    const lotesMes = lotes.filter(l => {
      if (!l.fecha_produccion) return false;
      const d = new Date(l.fecha_produccion);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === m.key;
    });

    // 👇 FIX: Eficiencia mensual basada en estatus real
    const evaluadosMes = lotesMes.filter(l => String(l.estatus) === '200' || String(l.estatus) === '300');
    const totalEvaluado = evaluadosMes.reduce((a, l) => a + (l.cantidad || 0), 0);
    
    const aptosMes = lotesMes.filter(l => String(l.estatus) === '200');
    const totalAptos = aptosMes.reduce((a, l) => a + (l.cantidad || 0), 0);

    return totalEvaluado > 0 ? Math.round((totalAptos / totalEvaluado) * 100) : 0;
  });

  if (eficienciaChart) eficienciaChart.destroy();

  eficienciaChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: meses.map(m => m.label),
      datasets: [{
        label: 'Eficiencia (%)',
        data: valores,
        borderColor: 'rgba(26, 35, 126, 1)',
        backgroundColor: 'rgba(26, 35, 126, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgba(26, 35, 126, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(255,255,255,0.95)', titleColor: '#1a237e', bodyColor: '#333', borderColor: '#e0e0e0', borderWidth: 1, cornerRadius: 8, padding: 12,
          callbacks: { label: ctx => `${ctx.raw}%` }
        }
      },
      scales: {
        y: { beginAtZero: true, max: 100, grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { font: { size: 11 }, callback: v => v + '%' } },
        x: { grid: { display: false }, ticks: { font: { size: 11, weight: '500' } } }
      },
      animation: { duration: 800, easing: 'easeOutQuart' }
    }
  });
}

/* ==========================================
   TOP CLIENTES CON RETENCIÓN
========================================== */
function renderTopClientesRetencion(lotes) {
  const el = document.getElementById('top-clientes-retencion');
  if (!el) return;

  const lotesFiltrados = filtrarPorDias(lotes, 'fecha_produccion');
  const retenidos = lotesFiltrados.filter(l => String(l.estatus) === '300');
  const porCliente = {};

  retenidos.forEach(l => {
    const c = l.cliente || 'Sin cliente';
    if (!porCliente[c]) porCliente[c] = { lotes: 0, paletas: 0, unidades: 0 };
    porCliente[c].lotes += 1;
    porCliente[c].paletas += (l.paletas || 0);
    porCliente[c].unidades += (l.cantidad || 0);
  });

  const ordenados = Object.entries(porCliente).sort((a, b) => b[1].paletas - a[1].paletas).slice(0, 5);

  if (ordenados.length === 0) {
    el.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:1rem 0;"><i class="ti ti-circle-check" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;color:var(--success);"></i>Sin retenciones en este período</div>`;
    return;
  }

  const maxPaletas = ordenados[0][1].paletas;

  el.innerHTML = ordenados.map(([cliente, data], i) => {
    const pct = maxPaletas > 0 ? (data.paletas / maxPaletas) * 100 : 0;
    return `
      <div class="rank-item">
        <div class="rank-num danger">${i + 1}</div>
        <div class="rank-info">
          <div class="rank-name">${esc(cliente)}</div>
          <div class="rank-meta">${data.lotes} lote${data.lotes !== 1 ? 's' : ''} retenido${data.lotes !== 1 ? 's' : ''} · ${fmtNum(data.unidades)} uds</div>
          <div class="rank-bar"><div class="rank-bar-fill danger" style="width:${pct}%"></div></div>
        </div>
        <div class="rank-value danger">${fmtNum(data.paletas)} pal.</div>
      </div>`;
  }).join('');
}

/* ==========================================
   AUDITORÍAS PENDIENTES
========================================== */
function renderAuditoriasPendientes(lotes, defectos) {
  const el = document.getElementById('auditorias-pendientes');
  if (!el) return;

  const lotesFiltrados = filtrarPorDias(lotes, 'fecha_produccion');

  let pendientes = 0;
  let aptos = 0;
  let retenidos = 0;
  let despachados = 0;
  let otros = 0;

  lotesFiltrados.forEach(l => {
    const est = String(l.estatus || '100').trim();
    const tieneDefectos = defectos.some(d => String(d.produccion_id) === String(l.id) || String(l.lote_id) === String(l.id));

    if (est === '100') {
      pendientes++;
    } else if (est === '200') {
      if (!tieneDefectos && !l.inspector && !l.observaciones) {
        pendientes++;
      } else {
        aptos++;
      }
    } else if (est === '300') {
      retenidos++;
    } else if (est === '600') {
      despachados++;
    } else {
      otros++;
    }
  });

  const items = [
    { valor: pendientes, label: 'Pendientes', color: '#f57c00' },
    { valor: aptos, label: 'Aptos', color: '#2e7d32' },
    { valor: retenidos, label: 'Retenidos', color: '#dc3545' },
    { valor: despachados, label: 'Despachados', color: '#1a237e' },
    { valor: otros, label: 'Otros', color: '#757575' }
  ];

  el.innerHTML = `
    <div class="auditorias-grid">
      ${items.map(it => `
        <div class="aud-item">
          <div class="aud-valor" style="color:${it.color};">${it.valor}</div>
          <div class="aud-label">${it.label}</div>
        </div>
      `).join('')}
    </div>`;
}

/* ==========================================
   ALERTAS
========================================== */
function renderAlertas(lotes, defectos) {
  const lista = document.getElementById('dashboard-alerts');
  if (!lista) return;

  const alertas = [];
  const lotesConRechazo = lotes.filter(l => String(l.estatus) === '300');

  if (lotesConRechazo.length > 0) {
    alertas.push({ tipo: 'danger', icono: 'ti ti-alert-triangle', titulo: `${lotesConRechazo.length} lote(s) retenido(s)`, desc: 'Requieren revisión inmediata de calidad.' });
  }

  const criticos = defectos.filter(d => normalizarClase(d.clasificacion) === 'Crítico');
  if (criticos.length > 0) {
    alertas.push({ tipo: 'danger', icono: 'ti ti-flame', titulo: `${criticos.length} defecto(s) crítico(s)`, desc: 'Se recomienda auditar los lotes afectados.' });
  }

  const pendientes = lotes.filter(l => String(l.estatus || '100') === '100');
  if (pendientes.length > 0) {
    alertas.push({ tipo: 'warning', icono: 'ti ti-clock', titulo: `${pendientes.length} lote(s) sin evaluar`, desc: 'Pendientes de aprobación en el módulo Defectos.' });
  }

  if (lotesConRechazo.length === 0 && criticos.length === 0) {
    alertas.push({ tipo: 'success', icono: 'ti ti-circle-check', titulo: 'Sin alertas críticas', desc: 'Todos los lotes evaluados sin observaciones.' });
  }

  const lotesEval = lotes.filter(l => ['200', '300'].includes(String(l.estatus)));
  if (lotesEval.length > 0) {
    const efic = (lotes.filter(l => String(l.estatus) === '200').length / lotesEval.length) * 100;
    if (efic >= 90) {
      alertas.push({ tipo: 'success', icono: 'ti ti-trending-up', titulo: `Eficiencia del ${efic.toFixed(1)}%`, desc: 'Buen desempeño en control de calidad.' });
    } else if (efic >= 70) {
      alertas.push({ tipo: 'warning', icono: 'ti ti-chart-line', titulo: `Eficiencia del ${efic.toFixed(1)}%`, desc: 'Revisar procesos con mayor tasa de rechazo.' });
    } else {
      alertas.push({ tipo: 'danger', icono: 'ti ti-trending-down', titulo: `Eficiencia del ${efic.toFixed(1)}%`, desc: 'Atención: tasa de rechazo elevada.' });
    }
  }

  if (alertas.length === 0) {
    lista.innerHTML = `<li style="display:flex;align-items:center;gap:10px;padding:12px 0;color:var(--text-muted);"><i class="ti ti-circle-check" style="font-size:1.2rem;color:var(--success);"></i>Sin alertas activas</li>`;
    return;
  }

  lista.innerHTML = alertas.map(a => `
    <li class="alert-item ${a.tipo}">
      <i class="${a.icono}"></i>
      <div class="alert-item-body">
        <div class="alert-item-title">${esc(a.titulo)}</div>
        <div class="alert-item-desc">${esc(a.desc)}</div>
      </div>
    </li>
  `).join('');
}

/* ==========================================
   TABLA ÚLTIMOS REGISTROS
========================================== */
function renderTablaUltimosRegistros(lotes) {
  const tbody = document.getElementById('dashboard-table');
  if (!tbody) return;

  const recientes = [...lotes]
    .sort((a, b) => new Date(b.fecha_produccion || b.fecha_registro) - new Date(a.fecha_produccion || a.fecha_registro))
    .slice(0, 8);

  if (recientes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);"><i class="ti ti-inbox" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>No hay registros recientes</td></tr>`;
    return;
  }

  tbody.innerHTML = recientes.map(l => {
    const est = String(l.estatus || '100');
    const badge = ESTATUS_BADGE[est] || { class: 'badge-info', label: est };
    return `
      <tr>
        <td style="padding:8px 12px;font-size:12px;">${fmtFecha(l.fecha_produccion || l.fecha_registro)}</td>
        <td style="padding:8px 12px;font-size:12px;font-family:monospace;">${esc(l.ticket_carga || '—')}</td>
        <td style="padding:8px 12px;font-size:12px;font-family:monospace;">${esc(l.codigo_lote || '—')}</td>
        <td style="padding:8px 12px;font-size:12px;">${esc(l.tipo_producto || '—')}</td>
        <td style="padding:8px 12px;font-size:12px;">${esc(l.cliente || '—')}</td>
        <td style="padding:8px 12px;font-size:12px;text-align:right;font-weight:600;">${fmtNum(l.cantidad || 0)}</td>
        <td style="padding:8px 12px;text-align:center;"><span class="badge ${badge.class}">${badge.label}</span></td>
      </tr>`;
  }).join('');

  const badge = document.getElementById('total-registros-badge');
  if (badge) badge.textContent = `${lotes.length} lotes`;
}

/* ==========================================
   FILTROS
========================================== */
function initFiltrosTiempo() {
  document.querySelectorAll('.filtro-tiempo').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filtro-tiempo').forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      const dias = this.dataset.dias;
      periodoActual = dias === 'all' ? 'all' : parseInt(dias);

      log(`🔄 Período cambiado a: ${periodoActual} días`);

      if (datosDashboard) {
        const { lotes, defectos } = datosDashboard;
        renderKPIs(lotes, defectos);
        renderChartProduccion(lotes);
        renderChartDefectos(defectos);
        renderChartApto(lotes);
        renderChartLineas(lotes);
        renderTopProductos(lotes);
        renderTopTiposDefecto(defectos);
        renderChartEficiencia(lotes);
        renderTopClientesRetencion(lotes);
        renderAuditoriasPendientes(lotes, defectos);
      }
    });
  });
}

function initFiltroPlanta() {
  const select = document.getElementById('filtro-planta');
  if (!select) return;

  select.addEventListener('change', function () {
    filtroPlanta = this.value;
    log(`🔄 Filtro de planta cambiado a: ${filtroPlanta || 'Todas'}`);
    cargarDashboard();
  });
}

/* ==========================================
   EXPORTAR WORD
========================================== */
function exportarDashboardWord() {
  log('📤 Exportando dashboard a Word...');
  const link = document.createElement('a');
  link.href = `${API_URL}/dashboard/exportar/word`;
  link.setAttribute('download', 'Reporte_Dashboard.docx');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ==========================================
   SHORTCUTS
========================================== */
function initShortcuts() {
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'r') { e.preventDefault(); recargarDashboard(); }
    if (e.ctrlKey && e.key === 'e') { e.preventDefault(); exportarDashboardWord(); }
  });
}

function recargarDashboard() {
  log('🔄 Recargando dashboard manualmente...');
  cargarDashboard();
}

/* ==========================================
   INIT
========================================== */
function iniciarDashboard() {
  log('🚀 Dashboard Venvidrio iniciado');

  initFiltrosTiempo();
  initFiltroPlanta();
  initShortcuts();

  document.getElementById('btn-exportar-word')?.addEventListener('click', exportarDashboardWord);
  document.getElementById('btn-refresh')?.addEventListener('click', recargarDashboard);

  cargarDashboard();

  if (intervaloCarga) clearInterval(intervaloCarga);
  intervaloCarga = setInterval(() => {
    if (document.visibilityState === 'visible') {
      log('🔄 Auto-actualización de datos en segundo plano...');
      cargarDashboard(true);
    }
  }, 30000);

  document.querySelectorAll('.kpi-card').forEach(card => {
    card.addEventListener('click', recargarDashboard);
  });

  logSuccess('Dashboard inicializado');
}

document.addEventListener('DOMContentLoaded', iniciarDashboard);

/* ==========================================
   LIMPIEZA AL SALIR
========================================== */
window.addEventListener('beforeunload', () => {
  if (intervaloCarga) clearInterval(intervaloCarga);
  if (abortController) abortController.abort();
  if (productionChart) productionChart.destroy();
  if (defectosChart) defectosChart.destroy();
  if (aptoChart) aptoChart.destroy();
  if (lineasChart) lineasChart.destroy();
  if (eficienciaChart) eficienciaChart.destroy();
});