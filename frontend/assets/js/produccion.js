/* ==========================================
   VENVIDRIO - PRODUCCIÓN
   produccion.js - Versión Completa con Clientes (CORREGIDA)
   ========================================= */

(function () {
  'use strict';

  const API_URL = "http://127.0.0.1:8000";

  let lotes = [];
  let intervaloCarga = null;
  let filtrosActivos = {};

  // Datos de líneas
  const LINEAS = [
    { name: 'Línea A — Corte', pct: 0, status: 'success', meta: 'Cargando...' },
    { name: 'Línea B — Templado', pct: 0, status: 'warning', meta: 'Cargando...' },
    { name: 'Línea C — Laminado', pct: 0, status: 'success', meta: 'Cargando...' },
    { name: 'Línea D — Serigrafía', pct: 0, status: 'danger', meta: 'Cargando...' }
  ];

  /* ==========================================
     UTILIDADES Y LOGS
  ========================================== */

  function log(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    if (data) {
      console.log(`[${timestamp}] 🏭 ${message}`, data);
    } else {
      console.log(`[${timestamp}] 🏭 ${message}`);
    }
  }

  function logError(message, error = null) {
    const timestamp = new Date().toLocaleTimeString();
    if (error) {
      console.error(`[${timestamp}] ❌ ${message}`, error);
    } else {
      console.error(`[${timestamp}] ❌ ${message}`);
    }
  }

  function logSuccess(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    if (data) {
      console.log(`[${timestamp}] ✅ ${message}`, data);
    } else {
      console.log(`[${timestamp}] ✅ ${message}`);
    }
  }

  /* ==========================================
     SKELETON LOADING
  ========================================== */

  function mostrarSkeleton() {
    const elementos = ['cnt-lotes', 'cnt-unidades', 'cnt-eficiencia', 'cnt-rechazos'];
    elementos.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = `<span class="skeleton"></span>`;
      }
    });
  }

  /* ==========================================
     ACTUALIZAR TIMESTAMP
  ========================================== */

  function actualizarTimestamp() {
    const now = new Date();
    const el = document.getElementById('ultima-actualizacion');
    if (el) {
      el.textContent = now.toLocaleTimeString();
    }
  }

  /* ==========================================
     CARGAR PRODUCCIÓN DESDE API (CORREGIDA)
  ========================================== */

  async function cargarProduccion(filtros = {}) {
    try {
      log('Cargando producción desde API...');

      const params = new URLSearchParams();
      if (filtros.codigo) params.append('codigo', filtros.codigo);
      if (filtros.producto) params.append('producto', filtros.producto);
      if (filtros.linea) params.append('linea', filtros.linea);
      if (filtros.operador) params.append('operador', filtros.operador);
      if (filtros.turno) params.append('turno', filtros.turno);
      if (filtros.fecha_desde) params.append('fecha_desde', filtros.fecha_desde);
      if (filtros.fecha_hasta) params.append('fecha_hasta', filtros.fecha_hasta);

      // 🔥 CORRECCIÓN CRÍTICA: Evitar el '?' vacío que causa redirección y error 500
      const queryString = params.toString();
      // Añadimos un timestamp para evitar la caché del navegador
      const cacheBuster = `t=${Date.now()}`;
      
      let url;
      if (queryString) {
        url = `${API_URL}/produccion?${queryString}&${cacheBuster}`;
      } else {
        url = `${API_URL}/produccion?${cacheBuster}`;
      }

      log(`📤 URL: ${url}`);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      log(`📊 Datos recibidos: ${data.length} lotes`);

      // Mapeamos los datos incluyendo el cliente si viene en la respuesta
      lotes = data.map(p => ({
        id: p.id,
        codigo: p.codigo_lote,
        prod: p.tipo_producto,
        linea: p.linea_produccion,
        op: p.operador,
        uds: p.cantidad,
        turno: p.turno,
        // Extraemos el nombre del cliente si existe en el objeto anidado
        cliente: p.cliente ? p.cliente.nombre : 'Sin asignar', 
        fecha: new Date(p.fecha_registro).toLocaleString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      }));

      actualizarLineasDesdeProduccion(lotes);
      actualizarKPIs(lotes);
      renderTabla();
      actualizarTimestamp();

      const resultadoEl = document.getElementById('filtro-resultados');
      if (resultadoEl) {
        const filtrosActivos = Object.values(filtros).filter(v => v);
        if (filtrosActivos.length > 0) {
          resultadoEl.textContent = `🔍 Filtros aplicados: ${filtrosActivos.length} | ${data.length} resultados`;
        } else {
          resultadoEl.textContent = `📋 Mostrando ${data.length} lotes`;
        }
      }

      logSuccess('Producción cargada correctamente');

    } catch (error) {
      logError('Error cargando producción:', error);
      mostrarError();
    }
  }

  /* ==========================================
     ACTUALIZAR LÍNEAS DESDE PRODUCCIÓN
  ========================================== */

  function actualizarLineasDesdeProduccion(lotesData) {
    const lineasMap = {};

    lotesData.forEach(l => {
      if (!lineasMap[l.linea]) {
        lineasMap[l.linea] = 0;
      }
      lineasMap[l.linea] += l.uds;
    });

    const total = Object.values(lineasMap).reduce((sum, val) => sum + val, 0);

    LINEAS.forEach(linea => {
      const nombreLinea = linea.name;
      const unidades = lineasMap[nombreLinea] || 0;

      if (total > 0) {
        linea.pct = Math.round((unidades / total) * 100);
      } else {
        linea.pct = 0;
      }

      if (unidades > 0) {
        linea.meta = `${unidades} unidades producidas`;
        linea.status = unidades > 50 ? 'success' : 'warning';
      } else {
        linea.meta = 'Sin producción';
        linea.status = 'danger';
      }
    });

    renderLineas();
    actualizarMetricasLineas();
  }

  /* ==========================================
     ACTUALIZAR MÉTRICAS DE LÍNEAS
  ========================================== */

  function actualizarMetricasLineas() {
    const eficienciaEl = document.getElementById('cnt-eficiencia');
    const estadoEl = document.getElementById('estado-lineas');

    if (LINEAS && LINEAS.length) {
      const promedio = Math.round(LINEAS.reduce((acc, l) => acc + l.pct, 0) / LINEAS.length);
      if (eficienciaEl) eficienciaEl.textContent = promedio + '%';

      const activas = LINEAS.filter(l => l.pct > 0).length;
      if (estadoEl) estadoEl.textContent = `${activas} de ${LINEAS.length} líneas activas`;
    }
  }

  /* ==========================================
     ACTUALIZAR KPIs
  ========================================== */

  function actualizarKPIs(lotesData) {
    const totalLotes = lotesData.length;
    const totalUnidades = lotesData.reduce((sum, l) => sum + (l.uds || 0), 0);

    const kpis = [
      {
        id: 'cnt-lotes',
        valor: totalLotes,
        label: 'Lotes registrados',
        formato: 'numero'
      },
      {
        id: 'cnt-unidades',
        valor: totalUnidades,
        label: 'Unidades producidas',
        formato: 'numero'
      },
      {
        id: 'cnt-eficiencia',
        valor: calcularEficiencia(lotesData),
        label: 'Eficiencia',
        formato: 'porcentaje'
      },
      {
        id: 'cnt-rechazos',
        valor: 0,
        label: 'Rechazos',
        formato: 'numero',
        invertir: true
      }
    ];

    kpis.forEach(kpi => {
      const el = document.getElementById(kpi.id);
      if (!el) return;

      const tendencia = 0;

      const esPositiva = kpi.invertir ? tendencia < 0 : tendencia > 0;
      const esCero = tendencia === 0;

      let color = 'var(--text-hint)';
      let flecha = '→';
      let claseTendencia = 'neutral';

      if (!esCero) {
        color = esPositiva ? 'var(--success)' : 'var(--danger)';
        flecha = esPositiva ? '↑' : '↓';
        claseTendencia = esPositiva ? 'up' : 'down';
      }

      let valorFormateado;
      if (kpi.formato === 'porcentaje') {
        valorFormateado = typeof kpi.valor === 'number' ? kpi.valor + '%' : kpi.valor;
      } else {
        valorFormateado = typeof kpi.valor === 'number' ? kpi.valor.toLocaleString() : kpi.valor;
      }

      const tendenciaHTML = !esCero ? `
        <span class="tendencia ${claseTendencia}">
          ${flecha} ${Math.abs(tendencia)}%
        </span>
      ` : '';

      el.innerHTML = `
        ${valorFormateado}
        ${tendenciaHTML}
      `;

      const card = el.closest('.stat-card');
      if (card) {
        const subEl = card.querySelector('.stat-sub');
        if (subEl) {
          if (kpi.id === 'cnt-lotes') {
            subEl.textContent = `${totalLotes} lotes registrados`;
          } else if (kpi.id === 'cnt-unidades') {
            subEl.textContent = `${totalUnidades.toLocaleString()} unidades totales`;
          } else if (kpi.id === 'cnt-eficiencia') {
            subEl.textContent = `Promedio de líneas activas`;
          } else if (kpi.id === 'cnt-rechazos') {
            subEl.textContent = `0% del total`;
          }
        }
      }
    });
  }

  function calcularEficiencia(lotesData) {
    if (lotesData.length === 0) return 0;
    const totalUnidades = lotesData.reduce((sum, l) => sum + (l.uds || 0), 0);
    const promedio = totalUnidades / lotesData.length;
    return Math.min(Math.round((promedio / 100) * 100), 100);
  }

  /* ==========================================
     RENDER LINEAS
  ========================================== */

  function renderLineas() {
    const container = document.getElementById('lineas-list');
    if (!container) return;

    container.innerHTML = '';

    LINEAS.forEach((l, i) => {
      const div = document.createElement('div');
      div.className = 'linea-item';
      div.style.animationDelay = `${0.1 * i}s`;

      let statusClass = 'success';
      if (l.pct < 50) statusClass = 'danger';
      else if (l.pct < 75) statusClass = 'warning';

      div.innerHTML = `
        <div class="linea-header">
          <span class="linea-name">${l.name}</span>
          <span class="linea-pct">${l.pct}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar ${statusClass}" data-pct="${l.pct}" style="width:0"></div>
        </div>
        <div class="linea-meta">${l.meta}</div>
      `;

      container.appendChild(div);
    });

    setTimeout(() => {
      document.querySelectorAll('.progress-bar').forEach(bar => {
        bar.style.width = bar.dataset.pct + '%';
      });
    }, 200);
  }

  /* ==========================================
     GENERAR CÓDIGO DE LOTE
  ========================================== */

  function generarCodigoLote() {
    const año = new Date().getFullYear();
    const count = lotes.length + 1;
    return `PROD-${año}-${String(count).padStart(4, '0')}`;
  }

  /* ==========================================
     RENDER TABLA (CON BOTONES Y CLIENTE)
  ========================================== */

  function renderTabla(filtro = '') {
    const tbody = document.getElementById('tabla-lotes');
    if (!tbody) return;

    const data = filtro
      ? lotes.filter(l =>
          l.codigo.toLowerCase().includes(filtro) ||
          l.prod.toLowerCase().includes(filtro) ||
          l.op.toLowerCase().includes(filtro)
        )
      : lotes;

    tbody.innerHTML = '';

    if (data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted)">
            <i class="ti ti-inbox" style="font-size:1.5rem;margin-right:0.5rem"></i>
            No hay lotes registrados
          </td>
        </tr>
      `;
      return;
    }

    data.forEach((l, i) => {
      const tr = document.createElement('tr');
      tr.style.animationDelay = `${0.04 * i}s`;

      // Añadimos una columna para mostrar el Cliente
      tr.innerHTML = `
        <td class="font-mono" style="font-size:12px">
          <span class="badge badge-info">${l.codigo}</span>
        </td>
        <td>${l.prod}</td>
        <td>${l.linea}</td>
        <td>${l.op}</td>
        <td style="text-align:center">${l.uds}</td>
        <td><span class="badge badge-info">${l.turno}</span></td>
        <td class="text-muted text-sm">
          <span style="display:block;font-weight:600;color:var(--navy);">${l.cliente}</span>
          <span style="font-size:10px;color:var(--text-hint)">${l.fecha}</span>
        </td>
        <td>
          <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">
            <button class="btn btn-success btn-xs" onclick="exportarLoteIndividual(${l.id})" title="Exportar Individual">
              <i class="ti ti-file-spreadsheet"></i>
            </button>
            <button class="btn btn-outline btn-xs" onclick="exportarLoteGeneral(${l.id})" title="Exportar Sábana General">
              <i class="ti ti-file-sheet"></i>
            </button>
            <button class="btn btn-danger btn-xs" onclick="eliminarLote(${l.id})" title="Eliminar lote">
              <i class="ti ti-trash"></i>
            </button>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  /* ==========================================
     ELIMINAR LOTE
  ========================================== */

  window.eliminarLote = async function(id) {
    if (!confirm('¿Estás seguro de eliminar este lote? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/produccion/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      logSuccess(`Lote ${id} eliminado correctamente`);
      await cargarProduccion(filtrosActivos);

      const toast = document.getElementById('toast-prod');
      if (toast) {
        toast.textContent = '✅ Lote eliminado correctamente';
        toast.style.background = '#ffebee';
        toast.style.color = '#b71c1c';
        toast.classList.add('show');
        setTimeout(() => {
          toast.classList.remove('show');
          toast.textContent = '✅ Lote registrado correctamente';
          toast.style.background = '#d1fae5';
          toast.style.color = '#065f46';
        }, 3000);
      }

    } catch (error) {
      logError('Error eliminando lote:', error);
      alert('No se pudo eliminar el lote: ' + error.message);
    }
  };

  /* ==========================================
     EXPORTAR LOTE (INDIVIDUAL Y GENERAL)
  ========================================== */

  window.exportarLoteIndividual = function(id) {
    if (!id) {
      alert('ID de lote no válido');
      return;
    }
    log(`📤 Exportando lote ${id} a Excel Individual...`);
    window.open(`${API_URL}/reportes/produccion/excel/individual/${id}`, '_blank');
  };

  window.exportarLoteGeneral = function(id) {
    if (!id) {
      alert('ID de lote no válido');
      return;
    }
    log(`📤 Exportando lote ${id} a Excel General (Sábana)...`);
    window.open(`${API_URL}/reportes/produccion/excel/general/${id}`, '_blank');
  };

  /* ==========================================
     REGISTRAR PRODUCCIÓN (CON CLIENTE_ID)
  ========================================== */

  const btnRegistrar = document.getElementById('btn-registrar');

  if (btnRegistrar) {
    btnRegistrar.addEventListener('click', async () => {
      const linea = document.getElementById('linea').value;
      const prod = document.getElementById('producto').value;
      const cant = document.getElementById('cantidad').value;
      const op = document.getElementById('operador').value.trim();
      const turno = document.getElementById('turno').value;
      const fecha = document.getElementById('fecha-prod').value;
      // Obtenemos el ID del cliente seleccionado
      const clienteId = document.getElementById('cliente').value;

      if (!linea || !prod || !cant || !op || !turno || !clienteId) {
        alert('Completa todos los campos obligatorios, incluyendo el Cliente.');
        return;
      }

      const codigo = generarCodigoLote();

      const body = {
        codigo_lote: codigo,
        linea_produccion: linea,
        tipo_producto: prod,
        cantidad: parseInt(cant),
        operador: op,
        turno: turno,
        observaciones: document.getElementById('obs-prod').value || null,
        // Enviamos el ID del cliente
        cliente_id: parseInt(clienteId) 
      };

      if (fecha) {
        body.fecha_produccion = new Date(fecha).toISOString();
      }

      try {
        const response = await fetch(`${API_URL}/produccion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Error guardando');
        }

        await cargarProduccion(filtrosActivos);

        const toast = document.getElementById('toast-prod');
        if (toast) {
          toast.classList.add('show');
          setTimeout(() => {
            toast.classList.remove('show');
          }, 3000);
        }

        document.getElementById('btn-limpiar').click();

      } catch (error) {
        logError('Error registrando producción:', error);
        alert(error.message || 'No se pudo registrar la producción');
      }
    });
  }

  /* ==========================================
     LIMPIAR FORMULARIO
  ========================================== */

  const btnLimpiar = document.getElementById('btn-limpiar');

  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', () => {
      ['lote-id', 'cantidad', 'operador', 'obs-prod', 'fecha-prod'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });

      ['linea', 'producto', 'turno', 'cliente'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.selectedIndex = 0;
      });

      const loteInput = document.getElementById('lote-id');
      if (loteInput) {
        loteInput.placeholder = `PROD-${new Date().getFullYear()}-${String(lotes.length + 1).padStart(4, '0')}`;
      }
    });
  }

  /* ==========================================
     FILTROS
  ========================================== */

  function aplicarFiltros() {
    filtrosActivos = {
      codigo: document.getElementById('filtro-codigo')?.value.trim() || '',
      producto: document.getElementById('filtro-producto')?.value || '',
      linea: document.getElementById('filtro-linea')?.value || '',
      operador: document.getElementById('filtro-operador')?.value || '',
      turno: document.getElementById('filtro-turno')?.value || '',
      fecha_desde: document.getElementById('filtro-fecha-desde')?.value || '',
      fecha_hasta: document.getElementById('filtro-fecha-hasta')?.value || ''
    };

    log('🔍 Aplicando filtros:', filtrosActivos);
    cargarProduccion(filtrosActivos);
  }

  function limpiarFiltros() {
    document.getElementById('filtro-codigo').value = '';
    document.getElementById('filtro-producto').value = '';
    document.getElementById('filtro-linea').value = '';
    document.getElementById('filtro-operador').value = '';
    document.getElementById('filtro-turno').value = '';
    document.getElementById('filtro-fecha-desde').value = '';
    document.getElementById('filtro-fecha-hasta').value = '';

    filtrosActivos = {};
    log('🧹 Filtros limpiados');
    cargarProduccion({});
  }

  async function cargarOpcionesFiltros() {
    try {
      const response = await fetch(`${API_URL}/produccion/opciones`);
      if (!response.ok) throw new Error('Error cargando opciones');

      const data = await response.json();

      const selects = [
        { id: 'filtro-producto', opciones: data.productos || [] },
        { id: 'filtro-linea', opciones: data.lineas || [] },
        { id: 'filtro-operador', opciones: data.operadores || [] },
        { id: 'filtro-turno', opciones: data.turnos || [] }
      ];

      selects.forEach(({ id, opciones }) => {
        const select = document.getElementById(id);
        if (!select) return;

        const valorActual = select.value;

        while (select.options.length > 0) {
          select.remove(0);
        }

        const optTodos = document.createElement('option');
        optTodos.value = '';
        optTodos.textContent = 'Todos';
        select.appendChild(optTodos);

        const valoresUnicos = [...new Set(opciones)];
        valoresUnicos.sort();
        valoresUnicos.forEach(val => {
          if (val) {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            select.appendChild(opt);
          }
        });

        if (valorActual) {
          select.value = valorActual;
        }
      });

      log('✅ Opciones de filtros cargadas');

    } catch (error) {
      logError('Error cargando opciones de filtros:', error);
    }
  }

  /* ==========================================
     BUSCADOR RÁPIDO
  ========================================== */

  const buscar = document.getElementById('buscar-lote');

  if (buscar) {
    buscar.addEventListener('input', e => {
      renderTabla(e.target.value.toLowerCase().trim());
    });
  }

  /* ==========================================
     EXPORTAR A CSV
  ========================================== */

  function exportarCSV() {
    if (lotes.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    const headers = ['Código', 'Producto', 'Línea', 'Operador', 'Unidades', 'Turno', 'Fecha', 'Cliente'];
    const rows = lotes.map(l => [
      l.codigo,
      l.prod,
      l.linea,
      l.op,
      l.uds,
      l.turno,
      l.fecha,
      l.cliente
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `produccion_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /* ==========================================
     EXPORTAR TODOS A EXCEL Y PDF
  ========================================== */

  function exportarExcel() {
    if (lotes.length === 0) {
      alert('No hay datos para exportar');
      return;
    }
    // Si quieres exportar todos los lotes a un solo archivo, necesitas un endpoint masivo
    // Por ahora, exportamos el primero como ejemplo o puedes deshabilitarlo
    window.open(`${API_URL}/reportes/produccion/excel/general/${lotes[0].id}`, '_blank');
  }

  function exportarPDF() {
    if (lotes.length === 0) {
      alert('No hay datos para exportar');
      return;
    }
    window.open(`${API_URL}/reportes/produccion/pdf/general/${lotes[0].id}`, '_blank');
  }

  /* ==========================================
     RECARGAR MANUAL
  ========================================== */

  window.recargarProduccion = function() {
    log('🔄 Recargando producción manualmente...');
    cargarProduccion(filtrosActivos);
  };

  /* ==========================================
     MOSTRAR ERROR
  ========================================== */

  function mostrarError() {
    const tbody = document.getElementById('tabla-lotes');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted)">
            <i class="ti ti-alert-circle" style="font-size:1.5rem;margin-right:0.5rem"></i>
            Error al cargar datos. Verifica que el servidor esté corriendo en ${API_URL}
          </td>
        </tr>
      `;
    }
  }

  /* ==========================================
     INICIALIZACIÓN
  ========================================== */

  function init() {
    log('🚀 Producción iniciado');

    mostrarSkeleton();

    cargarOpcionesFiltros();

    document.getElementById('btn-aplicar-filtros')?.addEventListener('click', aplicarFiltros);
    document.getElementById('btn-limpiar-filtros')?.addEventListener('click', limpiarFiltros);

    document.getElementById('filtro-codigo')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') aplicarFiltros();
    });

    document.getElementById('btn-exportar-csv')?.addEventListener('click', exportarCSV);
    document.getElementById('btn-exportar-excel')?.addEventListener('click', exportarExcel);
    document.getElementById('btn-exportar-pdf')?.addEventListener('click', exportarPDF);

    renderLineas();
    cargarProduccion({});

    if (intervaloCarga) {
      clearInterval(intervaloCarga);
    }

    intervaloCarga = setInterval(() => {
      log('🔄 Auto-actualización de producción...');
      cargarProduccion(filtrosActivos);
    }, 30000);

    log('✅ Producción iniciado correctamente');
  }

  // Iniciar
  init();

})();