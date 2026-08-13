/* ================================================================
   auditoria.js - Módulo de Auditoría
   ================================================================
   Estructura:
   1. Configuración y Constantes
   2. Logs y Depuración
   3. Gestión de Checklist
   4. Gestión de Auditorías (CRUD)
   5. Renderizado (UI)
   6. Eventos
   7. Exportación de Reportes
   8. Inicialización
   ================================================================ */

(function () {
  'use strict';

  /* ================================================================
     1. CONFIGURACIÓN Y CONSTANTES
  ================================================================ */

  const API_URL = "http://127.0.0.1:8000";

  let auditorias = [];
  let auditoriaActiva = null;
  let checklistEstado = {};
  let actualizando = false;
  let checklistActual = 'proceso';

  const CHECKLISTS = {
    proceso: [
      { sec: 'Equipo y Condiciones', items: [
        { id: 'p1', label: 'Temperatura del horno dentro de rango (600–700°C)', ref: 'PO-HOR-01' },
        { id: 'p2', label: 'Calibración del pirómetro verificada', ref: 'IT-CAL-03' },
        { id: 'p3', label: 'Velocidad de cinta ajustada por espesor', ref: 'PO-HOR-02' },
        { id: 'p4', label: 'Quemadores sin obstrucción ni llama irregular', ref: 'IT-MAN-01' },
      ] },
      { sec: 'Materia Prima', items: [
        { id: 'p5', label: 'Vidrio inspeccionado antes de hornear (sin rayaduras previas)', ref: 'PO-MP-01' },
        { id: 'p6', label: 'Lote registrado en sistema antes de procesar', ref: 'PO-TRZ-01' },
      ] },
      { sec: 'Seguridad', items: [
        { id: 'p7', label: 'EPP completo en operarios (lentes, guantes, zapatos)', ref: 'HS-SEG-02' },
        { id: 'p8', label: 'Extintores CO₂ accesibles y vigentes', ref: 'HS-SEG-04' },
      ] },
    ],
    corte: [
      { sec: 'Mesa y Equipo', items: [
        { id: 'c1', label: 'Mesa nivelada y limpia de partículas de vidrio', ref: 'IT-COR-01' },
        { id: 'c2', label: 'Rueda de corte en buen estado (sin desgaste visible)', ref: 'IT-COR-02' },
        { id: 'c3', label: 'Aceite de corte aplicado correctamente', ref: 'PO-COR-01' },
      ] },
      { sec: 'Dimensiones', items: [
        { id: 'c4', label: 'Medidas verificadas con cinta calibrada antes del primer corte', ref: 'IT-MED-01' },
        { id: 'c5', label: 'Tolerancia dimensional ±1mm respetada', ref: 'ES-DIM-01' },
        { id: 'c6', label: 'Escuadra comprobada en cortes a 90°', ref: 'IT-MED-02' },
      ] },
    ],
    inspeccion: [
      { sec: 'Visual', items: [
        { id: 'i1', label: 'Inspección bajo luz apropiada (≥ 1000 lux)', ref: 'IT-INS-01' },
        { id: 'i2', label: 'Ausencia de burbujas, manchas e inclusiones', ref: 'ES-VIS-01' },
        { id: 'i3', label: 'Bordes sin astillas o fisuras visibles', ref: 'ES-VIS-02' },
      ] },
      { sec: 'Dimensional', items: [
        { id: 'i4', label: 'Espesor medido en 4 puntos con micrómetro', ref: 'IT-MED-03' },
        { id: 'i5', label: 'Planitud verificada (flecha ≤ 0.3% de longitud)', ref: 'ES-DIM-02' },
      ] },
      { sec: 'Documentación', items: [
        { id: 'i6', label: 'Certificado de calidad emitido y firmado', ref: 'PO-DOC-01' },
        { id: 'i7', label: 'Etiqueta de lote adherida correctamente', ref: 'PO-ETQ-01' },
      ] },
    ],
    empaque: [
      { sec: 'Materiales', items: [
        { id: 'e1', label: 'Separadores de papel kraft entre piezas', ref: 'IT-EMP-01' },
        { id: 'e2', label: 'Cantoneras plásticas en esquinas', ref: 'IT-EMP-02' },
        { id: 'e3', label: 'Fleje de acero tensado correctamente', ref: 'IT-EMP-03' },
      ] },
      { sec: 'Estiba', items: [
        { id: 'e4', label: 'Pallet en buen estado (sin clavos sueltos)', ref: 'IT-EMP-04' },
        { id: 'e5', label: 'Peso por pallet dentro del límite (≤ 2 000 kg)', ref: 'PO-LOG-01' },
        { id: 'e6', label: 'Señalización de frágil y orientación visible', ref: 'PO-LOG-02' },
      ] },
    ],
  };

  /* ================================================================
     2. LOGS Y DEPURACIÓN
  ================================================================ */

  function log(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    if (data) {
      console.log(`[${timestamp}] ${message}`, data);
    } else {
      console.log(`[${timestamp}] ${message}`);
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

  /* ================================================================
     3. GESTIÓN DE CHECKLIST
  ================================================================ */

  function guardarChecklistLocal(auditoriaId) {
    try {
      const key = `checklist_${auditoriaId}`;
      localStorage.setItem(key, JSON.stringify(checklistEstado));
      log(`💾 Checklist guardado en localStorage para auditoría ${auditoriaId}`);
    } catch (e) {
      logError('No se pudo guardar checklist localmente:', e);
    }
  }

  async function cargarChecklistGuardado(auditoriaId) {
    try {
      const key = `checklist_${auditoriaId}`;
      const data = localStorage.getItem(key);
      if (data) {
        checklistEstado = JSON.parse(data);
        log(`📂 Checklist cargado desde localStorage: ${Object.keys(checklistEstado).length} items`);
      } else {
        log('📂 No hay checklist guardado, iniciando vacío');
        checklistEstado = {};
      }
      renderChecklist(checklistActual);
    } catch (e) {
      logError('No se pudo cargar checklist guardado:', e);
      checklistEstado = {};
      renderChecklist(checklistActual);
    }
  }

  function calcularEstadisticasChecklist(key) {
    const allIds = CHECKLISTS[key].flatMap(s => s.items.map(i => i.id));
    const total = allIds.length;
    const okCount = allIds.filter(id => checklistEstado[id] === 'ok').length;
    const ncCount = allIds.filter(id => checklistEstado[id] === 'nc').length;
    const naCount = allIds.filter(id => checklistEstado[id] === 'na').length;
    const done = allIds.filter(id => checklistEstado[id] && checklistEstado[id] !== 'pending').length;
    
    const evaluados = total - naCount;
    const cumplimiento = evaluados > 0 ? Math.round((okCount / evaluados) * 100) : 0;
    
    const stats = {
      total,
      okCount,
      ncCount,
      naCount,
      done,
      cumplimiento,
      noConformidades: ncCount
    };
    
    log(`📊 Estadísticas calculadas: ${cumplimiento}% cumplimiento, ${ncCount} NC, ${done}/${total} respondidos`);
    
    return stats;
  }

  function setChk(id, val) {
    log(`🔵 Marcando item ${id} como ${val}`);
    
    checklistEstado[id] = val;
    const el = document.getElementById(`chk-${id}`);
    if (!el) return;
    
    el.className = `chk-item ${val}`;
    el.querySelector('.chk-check').innerHTML =
      val === 'ok' ? '<i class="ti ti-check"></i>' :
      val === 'nc' ? '<i class="ti ti-x"></i>' : '—';
    
    updateProgreso(checklistActual);
    
    if (auditoriaActiva) {
      guardarChecklistLocal(auditoriaActiva.id);
      
      const stats = calcularEstadisticasChecklist(checklistActual);
      log(`📤 Enviando actualización a backend...`);
      
      actualizarAuditoriaBackend(
        auditoriaActiva.id,
        stats.cumplimiento,
        stats.noConformidades
      );
    } else {
      logError('⚠️ No hay auditoría activa, no se puede actualizar el backend');
    }
  }

  function updateProgreso(key) {
    const stats = calcularEstadisticasChecklist(key);
    const pct = stats.cumplimiento;

    const fill = document.getElementById('aud-progress-fill');
    if (fill) {
      fill.style.width = pct + '%';
      fill.className = `aud-progress-fill${pct === 100 ? ' complete' : ''}`;
    }
    
    const pctLabel = document.getElementById('pct-label');
    if (pctLabel) pctLabel.textContent = pct + '%';
    
    const badge = document.getElementById('badge-progreso');
    if (badge) badge.textContent = `${stats.done} / ${stats.total}`;

    const cumplimientoEl = document.getElementById('cnt-cumplimiento');
    if (cumplimientoEl) cumplimientoEl.textContent = pct + '%';

    const ncEl = document.getElementById('cnt-nc');
    if (ncEl) ncEl.textContent = stats.noConformidades;

    const badgeNc = document.getElementById('badge-nc-count');
    if (badgeNc) badgeNc.textContent = stats.noConformidades;

    if (auditoriaActiva) {
      actualizarAuditoriaEnTabla(auditoriaActiva.id, {
        cumplimiento: pct,
        no_conformidades: stats.noConformidades
      });
    }
  }

  function renderChecklist(key) {
    log(`🔄 Renderizando checklist: ${key}`);
    checklistActual = key;
    const secs = CHECKLISTS[key];
    const body = document.getElementById('checklist-body');
    if (!body) return;
    
    body.innerHTML = '';

    secs.forEach(sec => {
      const div = document.createElement('div');
      div.className = 'chk-section';
      div.innerHTML = `<div class="chk-section-title">${sec.sec}</div>`;
      
      sec.items.forEach(item => {
        const s = checklistEstado[item.id] || 'pending';
        const el = document.createElement('div');
        el.className = `chk-item ${s !== 'pending' ? s : ''}`;
        el.id = `chk-${item.id}`;
        el.innerHTML = `
          <div class="chk-check">
            ${s === 'ok' ? '<i class="ti ti-check"></i>' : s === 'nc' ? '<i class="ti ti-x"></i>' : s === 'na' ? '—' : ''}
          </div>
          <div class="chk-text">
            <div class="chk-label">${item.label}</div>
            <div class="chk-meta">Ref: ${item.ref}</div>
          </div>
          <div class="chk-actions">
            <button class="chk-btn ok-btn" title="Cumple" data-id="${item.id}" data-val="ok">✓</button>
            <button class="chk-btn nc-btn" title="No Cumple" data-id="${item.id}" data-val="nc">✗</button>
            <button class="chk-btn na-btn" title="N/A" data-id="${item.id}" data-val="na">—</button>
          </div>
        `;
        div.appendChild(el);
      });
      body.appendChild(div);
    });

    document.querySelectorAll('.chk-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const id = this.dataset.id;
        const val = this.dataset.val;
        setChk(id, val);
      });
    });

    updateProgreso(key);
  }

  /* ================================================================
     4. GESTIÓN DE AUDITORÍAS (CRUD)
  ================================================================ */

  async function cargarAuditorias(filtros = {}) {
    log('📋 Cargando auditorías desde API...');
    
    try {
      // Construir URL con parámetros de filtro
      const params = new URLSearchParams();
      
      if (filtros.codigo) params.append('codigo', filtros.codigo);
      if (filtros.tipo) params.append('tipo', filtros.tipo);
      if (filtros.area) params.append('area', filtros.area);
      if (filtros.auditor) params.append('auditor', filtros.auditor);
      if (filtros.estado) params.append('estado', filtros.estado);
      if (filtros.fecha_desde) params.append('fecha_desde', filtros.fecha_desde);
      if (filtros.fecha_hasta) params.append('fecha_hasta', filtros.fecha_hasta);
      
      const url = `${API_URL}/auditorias?${params.toString()}`;
      log(`📤 URL: ${url}`);
      
      const response = await fetch(url);
      
      log(`📥 Respuesta API: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      log(`📊 Datos recibidos: ${data.length} auditorías`);
      
      auditorias = data.map(a => ({
        id: a.id,
        codigo: a.codigo || `AUD-${a.id}`,
        tipo: a.tipo_auditoria,
        area: a.area,
        auditor: a.auditor,
        norma: a.norma,
        cumplimiento: a.cumplimiento || 0,
        no_conformidades: a.no_conformidades || 0,
        estado: a.estado || 'En proceso',
        observaciones: a.observaciones || '',
        fecha_registro: new Date(a.fecha_registro).toLocaleString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      }));
      
      const activa = auditorias.find(a => a.estado === 'En proceso');
      
      if (activa) {
        log(`🔍 Auditoría activa encontrada: ${activa.codigo} - ${activa.tipo}`);
        auditoriaActiva = activa;
        await cargarChecklistGuardado(activa.id);
      } else {
        log('⚠️ No hay auditoría activa');
        auditoriaActiva = null;
        checklistEstado = {};
        renderChecklist(checklistActual);
      }
      
      renderTablaAuditorias();
      actualizarMetricasAuditoria();
      renderNoConformidades();
      
      // Mostrar resumen de filtros
      const resultadoEl = document.getElementById('filtro-resultados');
      if (resultadoEl) {
        const filtrosActivos = Object.values(filtros).filter(v => v);
        if (filtrosActivos.length > 0) {
          resultadoEl.textContent = `🔍 Filtros aplicados: ${filtrosActivos.length} | ${data.length} resultados`;
        } else {
          resultadoEl.textContent = `📋 Mostrando ${data.length} auditorías`;
        }
      }
      
      logSuccess('Auditorías cargadas correctamente');
      
    } catch (error) {
      logError('Error cargando auditorías:', error);
      const tbody = document.getElementById('tabla-aud');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align:center;padding:2rem;color:var(--text-muted)">
              <i class="ti ti-alert-circle" style="font-size:1.5rem;margin-right:0.5rem"></i>
              Error al cargar auditorías: ${error.message}
            </td>
          </tr>
        `;
      }
    }
  }

  /* ================================================================
     FUNCIONES DE FILTROS
  ================================================================ */

  function aplicarFiltros() {
    const filtros = {
      codigo: document.getElementById('filtro-codigo')?.value.trim() || '',
      tipo: document.getElementById('filtro-tipo')?.value || '',
      area: document.getElementById('filtro-area')?.value || '',
      auditor: document.getElementById('filtro-auditor')?.value || '',
      estado: document.getElementById('filtro-estado')?.value || '',
      fecha_desde: document.getElementById('filtro-fecha-desde')?.value || '',
      fecha_hasta: document.getElementById('filtro-fecha-hasta')?.value || ''
    };
    
    log('🔍 Aplicando filtros:', filtros);
    cargarAuditorias(filtros);
  }

  function limpiarFiltros() {
    document.getElementById('filtro-codigo').value = '';
    document.getElementById('filtro-tipo').value = '';
    document.getElementById('filtro-area').value = '';
    document.getElementById('filtro-auditor').value = '';
    document.getElementById('filtro-estado').value = '';
    document.getElementById('filtro-fecha-desde').value = '';
    document.getElementById('filtro-fecha-hasta').value = '';
    
    log('🧹 Filtros limpiados');
    cargarAuditorias({});
  }

  async function cargarOpcionesFiltros() {
    try {
      const response = await fetch(`${API_URL}/auditorias/opciones`);
      if (!response.ok) throw new Error('Error cargando opciones');
      
      const data = await response.json();
      
      // Llenar selects con opciones
      const tipoSelect = document.getElementById('filtro-tipo');
      const areaSelect = document.getElementById('filtro-area');
      const auditorSelect = document.getElementById('filtro-auditor');
      const estadoSelect = document.getElementById('filtro-estado');
      
      const mantenerOpcion = (select, opciones) => {
        const valorActual = select.value;
        
        // Limpiar opciones existentes (mantener solo la primera si es "Todos")
        while (select.options.length > 0) {
          select.remove(0);
        }
        
        // Agregar opción "Todos"
        const optTodos = document.createElement('option');
        optTodos.value = '';
        optTodos.textContent = 'Todos';
        select.appendChild(optTodos);
        
        // Agregar opciones únicas
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
        
        // Restaurar valor seleccionado si existe
        if (valorActual) {
          select.value = valorActual;
        }
      };
      
      mantenerOpcion(tipoSelect, data.tipos || []);
      mantenerOpcion(areaSelect, data.areas || []);
      mantenerOpcion(auditorSelect, data.auditores || []);
      mantenerOpcion(estadoSelect, data.estados || []);
      
      log('✅ Opciones de filtros cargadas');
      
    } catch (error) {
      logError('Error cargando opciones de filtros:', error);
    }
  }

  async function crearAuditoria(datos) {
    log('📝 Creando nueva auditoría:', datos);
    
    try {
      const response = await fetch(`${API_URL}/auditorias`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(datos)
      });
      
      log(`📥 Respuesta POST: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        logError('Error en la respuesta:', errorData);
        throw new Error(errorData.detail || 'Error creando auditoría');
      }
      
      const nuevaAuditoria = await response.json();
      logSuccess('Auditoría creada:', nuevaAuditoria);
      
      const toast = document.getElementById('toast-aud');
      if (toast) {
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
      }
      
      await cargarAuditorias({});
      
      document.getElementById('a-auditor').value = '';
      document.getElementById('a-obs').value = '';
      
      checklistEstado = {};
      renderChecklist(checklistActual);
      
      return nuevaAuditoria;
      
    } catch (error) {
      logError('Error creando auditoría:', error);
      alert(error.message || 'No se pudo crear la auditoría');
      return null;
    }
  }

  async function actualizarAuditoriaBackend(id, cumplimiento, noConformidades) {
    if (actualizando) {
      log('⏳ Actualización en progreso, omitiendo...');
      return;
    }
    
    actualizando = true;
    log(`📤 Enviando actualización: ID=${id}, Cumplimiento=${cumplimiento}%, NC=${noConformidades}`);
    
    try {
      const url = `${API_URL}/auditorias/${id}`;
      const body = JSON.stringify({
        cumplimiento: cumplimiento,
        no_conformidades: noConformidades
      });
      
      log(`🔵 PUT a ${url}`);
      log(`🔵 Body: ${body}`);
      
      let response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: body
      });
      
      log(`📥 Respuesta PUT: ${response.status} ${response.statusText}`);
      
      if (response.status === 405) {
        log('🔄 PUT no permitido, intentando PATCH...');
        
        response = await fetch(url, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: body
        });
        
        log(`📥 Respuesta PATCH: ${response.status} ${response.statusText}`);
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        logError(`Error en la respuesta: ${errorText}`);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      logSuccess(`Auditoría ${id} actualizada en backend: cumplimiento=${data.cumplimiento}%, NC=${data.no_conformidades}`);
      
      const auditoria = auditorias.find(a => a.id === id);
      if (auditoria) {
        auditoria.cumplimiento = cumplimiento;
        auditoria.no_conformidades = noConformidades;
        log(`🔄 Copia local actualizada: auditoría ${id}`);
      }
      
      renderTablaAuditorias();
      actualizarMetricasAuditoria();
      
    } catch (error) {
      logError('Error actualizando auditoría:', error);
      mostrarErrorToast(error.message);
    } finally {
      actualizando = false;
    }
  }

  async function cerrarAuditoria() {
    if (!auditoriaActiva) {
      alert('No hay una auditoría activa para cerrar');
      return;
    }
    
    const stats = calcularEstadisticasChecklist(checklistActual);
    const { cumplimiento, noConformidades, done, total } = stats;
    
    log(`📊 Cerrando auditoría ${auditoriaActiva.codigo}: ${cumplimiento}% cumplimiento, ${noConformidades} NC`);
    
    if (done < total) {
      if (!confirm(`Quedan ${total - done} ítems sin responder. ¿Deseas cerrar de todas formas?`)) {
        return;
      }
    }
    
    try {
      const response = await fetch(`${API_URL}/auditorias/${auditoriaActiva.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cumplimiento: cumplimiento,
          no_conformidades: noConformidades,
          estado: 'Cerrada'
        })
      });
      
      log(`📥 Respuesta PUT cierre: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        logError('Error cerrando auditoría:', errorText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      logSuccess('Auditoría cerrada:', data);
      
      alert(`Auditoría ${auditoriaActiva.codigo} cerrada correctamente.\nCumplimiento: ${cumplimiento}%\nNo conformidades: ${noConformidades}`);
      
      if (auditoriaActiva) {
        localStorage.removeItem(`checklist_${auditoriaActiva.id}`);
      }
      
      auditoriaActiva = null;
      checklistEstado = {};
      
      await cargarAuditorias({});
      renderChecklist(checklistActual);
      
    } catch (error) {
      logError('Error cerrando auditoría:', error);
      alert(error.message || 'No se pudo cerrar la auditoría');
    }
  }

  /* ================================================================
     5. RENDERIZADO (UI)
  ================================================================ */

  function actualizarMetricasAuditoria() {
    const total = auditorias.length;
    const enCurso = auditorias.filter(a => a.estado === 'En proceso').length;
    
    const cerradas = auditorias.filter(a => a.estado === 'Cerrada');
    const cumplimientoPromedio = cerradas.length > 0 
      ? Math.round(cerradas.reduce((sum, a) => sum + a.cumplimiento, 0) / cerradas.length) 
      : 0;
    
    const totalNC = auditorias.reduce((sum, a) => sum + a.no_conformidades, 0);
    const acciones = auditorias.filter(a => a.estado === 'En proceso' && a.no_conformidades > 0).length;

    const cntAuditorias = document.getElementById('cnt-auditorias');
    if (cntAuditorias) cntAuditorias.textContent = total;
    
    const cntCumplimiento = document.getElementById('cnt-cumplimiento');
    if (cntCumplimiento) cntCumplimiento.textContent = cumplimientoPromedio + '%';
    
    const cntNc = document.getElementById('cnt-nc');
    if (cntNc) cntNc.textContent = totalNC;
    
    const cntAcciones = document.getElementById('cnt-acciones');
    if (cntAcciones) cntAcciones.textContent = acciones;

    const subEnCurso = document.getElementById('sub-en-curso');
    if (subEnCurso) subEnCurso.textContent = `${enCurso} en curso`;
    
    const subCumplimiento = document.getElementById('sub-cumplimiento');
    if (subCumplimiento) {
      subCumplimiento.textContent = `${cumplimientoPromedio}% promedio`;
    }
    
    const subNc = document.getElementById('sub-nc');
    if (subNc) {
      const criticas = auditorias.filter(a => a.no_conformidades > 0 && a.estado === 'En proceso').length;
      subNc.textContent = `${criticas} críticas abiertas`;
    }
    
    const subAcciones = document.getElementById('sub-acciones');
    if (subAcciones) {
      subAcciones.textContent = `${acciones} en seguimiento`;
    }

    const badgeNc = document.getElementById('badge-nc-count');
    if (badgeNc) badgeNc.textContent = totalNC;
  }

  function actualizarAuditoriaEnTabla(id, datos) {
    const rows = document.querySelectorAll('#tabla-aud tr');
    rows.forEach(row => {
      const firstCell = row.querySelector('td');
      if (firstCell && firstCell.textContent == id) {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 6) {
          const pctColor = datos.cumplimiento >= 90 ? 'var(--success)' : datos.cumplimiento >= 75 ? 'var(--warning)' : 'var(--danger)';
          cells[5].textContent = datos.cumplimiento + '%';
          cells[5].style.color = pctColor;
        }
        if (cells.length >= 7) {
          cells[6].textContent = datos.no_conformidades > 0 ? datos.no_conformidades : '—';
          if (datos.no_conformidades > 0) {
            cells[6].innerHTML = `<span style="color:var(--danger);font-weight:600">${datos.no_conformidades}</span>`;
          }
        }
      }
    });
  }

  function renderTablaAuditorias() {
    const tbody = document.getElementById('tabla-aud');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (auditorias.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center;padding:2rem;color:var(--text-muted)">
            <i class="ti ti-inbox" style="font-size:1.5rem;margin-right:0.5rem"></i>
            No hay auditorías registradas
          </td>
        </tr>
      `;
      return;
    }
    
    auditorias.forEach((a, i) => {
      const tr = document.createElement('tr');
      tr.style.animationDelay = `${0.05 * i}s`;
      
      const pctColor = a.cumplimiento >= 90 ? 'var(--success)' : a.cumplimiento >= 75 ? 'var(--warning)' : 'var(--danger)';
      const estBadge = a.estado === 'Cerrada' ? 'badge-success' : 'badge-info';
      
      tr.innerHTML = `
        <td class="font-mono" style="font-size:12px">
          <span class="badge badge-info">${a.codigo || a.id}</span>
        </td>
        <td>${a.tipo}</td>
        <td>${a.area}</td>
        <td>${a.auditor}</td>
        <td style="font-size:12px">${a.norma}</td>
        <td style="font-weight:600;color:${pctColor};font-family:var(--font-mono)">${a.cumplimiento}%</td>
        <td style="text-align:center">${a.no_conformidades > 0 ? `<span style="color:var(--danger);font-weight:600">${a.no_conformidades}</span>` : '—'}</td>
        <td><span class="badge ${estBadge}">${a.estado}</span></td>
        <td class="text-muted text-sm">${a.fecha_registro}</td>
        <td>
          <div class="flex gap-1" style="gap:4px;flex-wrap:nowrap">
            <button class="btn btn-success btn-xs" onclick="window.descargarReporte(${a.id}, 'excel')" title="Descargar Excel" style="padding:2px 6px;font-size:11px">
              <i class="ti ti-file-spreadsheet"></i>
            </button>
            <button class="btn btn-danger btn-xs" onclick="window.descargarReporte(${a.id}, 'pdf')" title="Descargar PDF" style="padding:2px 6px;font-size:11px">
              <i class="ti ti-file-pdf"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderNoConformidades() {
    const cont = document.getElementById('nc-list');
    if (!cont) return;
    
    cont.innerHTML = '';
    
    const ncItems = auditorias
      .filter(a => a.no_conformidades > 0)
      .slice(0, 5);
    
    if (ncItems.length === 0) {
      cont.innerHTML = `
        <div style="padding:1.5rem;text-align:center;color:var(--text-muted)">
          <i class="ti ti-circle-check" style="font-size:2rem;display:block;margin-bottom:0.5rem"></i>
          No hay no conformidades registradas
        </div>
      `;
      return;
    }
    
    ncItems.forEach((nc, i) => {
      const div = document.createElement('div');
      div.className = 'nc-item';
      div.style.animationDelay = `${0.08 * i}s`;
      
      const clase = nc.no_conformidades > 2 ? 'Crítico' : nc.no_conformidades > 0 ? 'Mayor' : 'Menor';
      const clsBadge = clase === 'Crítico' ? 'badge-danger' : clase === 'Mayor' ? 'badge-warning' : 'badge-info';
      
      div.innerHTML = `
        <div class="nc-header">
          <span class="nc-title">${nc.codigo || nc.id} - ${nc.tipo}</span>
          <span class="badge ${clsBadge}">${nc.no_conformidades} NC</span>
        </div>
        <div class="nc-meta">
          <span><i class="ti ti-user" style="font-size:12px"></i> ${nc.auditor}</span>
          <span><i class="ti ti-calendar" style="font-size:12px"></i> ${nc.fecha_registro}</span>
          <span style="color:${nc.estado === 'En proceso' ? 'var(--danger)' : 'var(--success)'}">
            ${nc.estado === 'En proceso' ? '● Abierta' : '✓ Cerrada'}
          </span>
        </div>
      `;
      cont.appendChild(div);
    });
  }

  function mostrarErrorToast(mensaje) {
    const toast = document.getElementById('toast-aud');
    if (toast) {
      toast.textContent = `❌ Error: ${mensaje}`;
      toast.style.background = '#dc3545';
      toast.style.color = 'white';
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        toast.textContent = '✅ Auditoría iniciada correctamente';
        toast.style.background = '';
        toast.style.color = '';
      }, 5000);
    }
  }

  /* ================================================================
     6. EXPORTACIÓN DE REPORTES
  ================================================================ */

  function exportarCSV() {
    if (auditorias.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    const headers = ['Código', 'Tipo', 'Área', 'Auditor', 'Norma', 'Cumplimiento', 'NC', 'Estado', 'Fecha'];
    const rows = auditorias.map(a => [
      a.codigo || a.id,
      a.tipo,
      a.area,
      a.auditor,
      a.norma,
      a.cumplimiento + '%',
      a.no_conformidades,
      a.estado,
      a.fecha_registro
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `auditorias_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function descargarReporteExcel() {
    if (auditorias.length === 0) {
      alert('No hay auditorías para exportar');
      return;
    }
    window.open(`${API_URL}/reportes/auditorias/excel`, '_blank');
  }

  function descargarReportePDF() {
    if (auditorias.length === 0) {
      alert('No hay auditorías para exportar');
      return;
    }
    window.open(`${API_URL}/reportes/auditorias/pdf`, '_blank');
  }

  /* Función global para descargar reportes individuales */
  window.descargarReporte = function(id, tipo) {
    if (!id) {
      alert('ID de auditoría no válido');
      return;
    }
    const url = `${API_URL}/reportes/${tipo}/${id}`;
    window.open(url, '_blank');
  };

  /* ================================================================
     7. EVENTOS
  ================================================================ */

  function inicializarEventos() {
    // Selector de checklist
    document.getElementById('sel-checklist')?.addEventListener('change', e => {
      renderChecklist(e.target.value);
    });

    // Resetear checklist
    document.getElementById('btn-reset-chk')?.addEventListener('click', () => {
      if (!confirm('¿Deseas reiniciar el checklist? Se perderá el progreso actual.')) return;
      
      const key = document.getElementById('sel-checklist').value;
      const ids = CHECKLISTS[key].flatMap(s => s.items.map(i => i.id));
      ids.forEach(id => delete checklistEstado[id]);
      
      if (auditoriaActiva) {
        localStorage.removeItem(`checklist_${auditoriaActiva.id}`);
        actualizarAuditoriaBackend(auditoriaActiva.id, 0, 0);
      }
      
      renderChecklist(key);
    });

    // Cerrar auditoría
    document.getElementById('btn-cerrar-aud')?.addEventListener('click', cerrarAuditoria);

    // Nueva auditoría
    document.getElementById('btn-nueva-aud')?.addEventListener('click', async () => {
      const tipo = document.getElementById('a-tipo')?.value;
      const area = document.getElementById('a-area')?.value;
      const auditor = document.getElementById('a-auditor')?.value.trim();
      const norma = document.getElementById('a-norma')?.value;
      const observaciones = document.getElementById('a-obs')?.value.trim();

      if (!auditor) {
        alert('Ingresa el nombre del auditor.');
        return;
      }

      await crearAuditoria({
        tipo_auditoria: tipo,
        area: area,
        auditor: auditor,
        norma: norma,
        observaciones: observaciones || null,
        cumplimiento: 0,
        no_conformidades: 0,
        estado: 'En proceso'
      });
    });

    // Exportar CSV
    document.getElementById('btn-exportar-aud')?.addEventListener('click', exportarCSV);

    // Exportar Excel (todas)
    document.getElementById('btn-reporte-excel')?.addEventListener('click', descargarReporteExcel);

    // Exportar PDF (todas)
    document.getElementById('btn-reporte-pdf')?.addEventListener('click', descargarReportePDF);

    // Botones de filtros
    document.getElementById('btn-aplicar-filtros')?.addEventListener('click', aplicarFiltros);
    document.getElementById('btn-limpiar-filtros')?.addEventListener('click', limpiarFiltros);
    
    // Aplicar filtros con Enter en campos de texto
    document.getElementById('filtro-codigo')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') aplicarFiltros();
    });
    
    // Aplicar filtros al cambiar fecha
    document.getElementById('filtro-fecha-desde')?.addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-fecha-hasta')?.addEventListener('change', aplicarFiltros);
  }

  /* ================================================================
     8. INICIALIZACIÓN
  ================================================================ */

  function init() {
    log('🚀 Iniciando auditoria.js...');
    renderChecklist('proceso');
    inicializarEventos();
    
    // Cargar opciones de filtros
    cargarOpcionesFiltros();
    
    // Cargar auditorías sin filtros
    cargarAuditorias({}).then(() => {
      log('💡 Para prueba manual, ejecuta en consola: window.actualizarForzado()');
      log('✅ auditoria.js iniciado correctamente');
    }).catch(error => {
      logError('Error en la inicialización:', error);
    });
  }

  /* Función de prueba manual (global) */
  window.actualizarForzado = async function() {
    if (!auditoriaActiva) {
      logError('No hay auditoría activa');
      alert('No hay auditoría activa');
      return;
    }
    
    const stats = calcularEstadisticasChecklist(checklistActual);
    log('📊 Forzando actualización:', stats);
    
    try {
      const response = await fetch(`${API_URL}/auditorias/${auditoriaActiva.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cumplimiento: stats.cumplimiento,
          no_conformidades: stats.noConformidades
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      logSuccess('✅ Actualización forzada exitosa:', data);
      alert(`✅ Actualizado: Cumplimiento ${stats.cumplimiento}%, NC ${stats.noConformidades}`);
      
      await cargarAuditorias({});
      
    } catch (error) {
      logError('❌ Error en actualización forzada:', error);
      alert('Error: ' + error.message);
    }
  };

  // Iniciar
  init();

})();