/* ==========================================
   VENVIDRIO - PRODUCCIÓN
   produccion.js - Versión Definitiva (Registrables y Autenticación)
   ========================================= */

(function () {
  'use strict';

  const API_URL = "http://127.0.0.1:8000";

  let lotes = [];
  let intervaloCarga = null;
  let filtrosActivos = {};
  let temporizadorInactividad = null;
  let TIEMPO_INACTIVIDAD = 5 * 60 * 1000; // 5 minutos
  let tiempoRestante = TIEMPO_INACTIVIDAD / 1000;
  let intervaloContador = null;
  let sesionActiva = true;

  // ==========================================
  // CONTROL DE SESIÓN - USUARIO
  // ==========================================

  function cargarUsuarioNav() {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        const avatar = document.getElementById('navAvatar');
        const username = document.getElementById('navUsername');
        const dropdownAvatar = document.getElementById('dropdownAvatar');
        const dropdownName = document.getElementById('dropdownName');
        const dropdownEmail = document.getElementById('dropdownEmail');

        const iniciales = user.nombre ? user.nombre.substring(0, 2).toUpperCase() : 'US';
        if (avatar) avatar.textContent = iniciales;
        if (username) username.textContent = user.nombre || 'Usuario';
        if (dropdownAvatar) dropdownAvatar.textContent = iniciales;
        if (dropdownName) dropdownName.textContent = user.nombre || 'Usuario';
        if (dropdownEmail) dropdownEmail.textContent = user.correo || 'usuario@email.com';
      } catch (e) {
        console.error('Error cargando usuario:', e);
      }
    }
  }

  function verificarSesion() {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '../public/login.html';
      return;
    }

    fetch(`${API_URL}/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Token inválido');
      }
      return response.json();
    })
    .then(() => {
      cargarUsuarioNav();
      iniciarControlInactividad();
      init();
    })
    .catch(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('role');
      window.location.href = '../public/login.html';
    });
  }

  function iniciarControlInactividad() {
    const eventos = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart', 'touchmove'];
    eventos.forEach(evento => {
      document.addEventListener(evento, function() {
        if (sesionActiva) {
          reiniciarTemporizador();
        }
      });
    });

    reiniciarTemporizador();
    iniciarContador();
  }

  function iniciarContador() {
    if (intervaloContador) {
      clearInterval(intervaloContador);
    }

    tiempoRestante = TIEMPO_INACTIVIDAD / 1000;

    intervaloContador = setInterval(function() {
      tiempoRestante--;
      actualizarTimerDisplay();

      if (tiempoRestante <= 0) {
        clearInterval(intervaloContador);
        intervaloContador = null;
      }
    }, 1000);
  }

  function actualizarTimerDisplay() {
    const timerDisplay = document.getElementById('timerDisplay');
    const timerBadge = document.getElementById('timerBadge');
    
    if (timerDisplay) {
      const minutos = Math.floor(tiempoRestante / 60);
      const segundos = Math.floor(tiempoRestante % 60);
      timerDisplay.textContent = String(minutos).padStart(2, '0') + ':' + String(segundos).padStart(2, '0');
    }

    if (timerBadge) {
      if (tiempoRestante > 120) {
        timerBadge.className = 'badge-timer';
        timerBadge.textContent = 'Activo';
      } else if (tiempoRestante > 60) {
        timerBadge.className = 'badge-timer warning';
        timerBadge.textContent = '⚠️ Cerca de expirar';
      } else {
        timerBadge.className = 'badge-timer danger';
        timerBadge.textContent = '🔴 Expirando';
      }
    }
  }

  function reiniciarTemporizador() {
    if (!sesionActiva) return;

    if (temporizadorInactividad) {
      clearTimeout(temporizadorInactividad);
    }

    tiempoRestante = TIEMPO_INACTIVIDAD / 1000;
    actualizarTimerDisplay();

    temporizadorInactividad = setTimeout(function() {
      cerrarSesion('⏳ Tu sesión ha expirado por inactividad.');
    }, TIEMPO_INACTIVIDAD);
  }

  function cerrarSesion(mensaje) {
    sesionActiva = false;

    if (temporizadorInactividad) {
      clearTimeout(temporizadorInactividad);
      temporizadorInactividad = null;
    }

    if (intervaloContador) {
      clearInterval(intervaloContador);
      intervaloContador = null;
    }

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');

    if (mensaje) {
      alert(mensaje);
    }

    window.location.href = '../public/login.html';
  }

  function initUserControls() {
    const container = document.getElementById('navUserContainer');
    const dropdown = document.getElementById('userDropdown');
    const logoutBtn = document.getElementById('dropdownLogout');

    if (container) {
      container.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.classList.toggle('show');
      });
    }

    document.addEventListener('click', function() {
      dropdown.classList.remove('show');
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        dropdown.classList.remove('show');
      }
      if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        cerrarSesion('👋 Sesión cerrada manualmente.');
      }
    });

    if (logoutBtn) {
      logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
          cerrarSesion('👋 Sesión cerrada exitosamente.');
        }
      });
    }
  }

  // ==========================================
  // UTILIDADES Y LOGS
  // ==========================================

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

  // ==========================================
  // SKELETON LOADING
  // ==========================================

  function mostrarSkeleton() {
    const elementos = ['cnt-lotes', 'cnt-unidades', 'cnt-eficiencia', 'cnt-rechazos'];
    elementos.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = `<span class="skeleton"></span>`;
      }
    });
  }

  // ==========================================
  // ACTUALIZAR TIMESTAMP
  // ==========================================

  function actualizarTimestamp() {
    const now = new Date();
    const el = document.getElementById('ultima-actualizacion');
    if (el) {
      el.textContent = now.toLocaleTimeString();
    }
  }

  // ==========================================
  // CARGAR PRODUCCIÓN DESDE API
  // ==========================================

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

      const cacheBuster = `t=${Date.now()}`;
      
      let url;
      if (params.toString()) {
        url = `${API_URL}/produccion?${params.toString()}&${cacheBuster}`;
      } else {
        url = `${API_URL}/produccion?${cacheBuster}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          cerrarSesion('⏳ Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
          return;
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // ==========================================
      // MAPEO DE DATOS (Incluye nuevos campos)
      // ==========================================
      lotes = data.map(p => ({
        id: p.id,
        codigo: p.codigo_lote,
        prod: p.tipo_producto,
        linea: p.linea_produccion,
        op: p.operador,
        uds: p.cantidad,
        turno: p.turno,
        paletas: p.paletas || 0,
        gruesas: p.gruesas || 0,
        cliente: p.cliente || 'Sin asignar',
        fecha: new Date(p.fecha_registro).toLocaleString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      }));

      actualizarKPIs(lotes);
      renderTabla();
      actualizarTimestamp();

      const resultadoEl = document.getElementById('filtro-resultados');
      if (resultadoEl) {
        const filtrosActivosCount = Object.values(filtros).filter(v => v).length;
        if (filtrosActivosCount > 0) {
          resultadoEl.textContent = `🔍 Filtros aplicados: ${filtrosActivosCount} | ${data.length} resultados`;
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

  // ==========================================
  // ACTUALIZAR KPIs
  // ==========================================

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
      const esCero = tendencia === 0;

      let color = 'var(--text-hint)';
      let flecha = '→';
      let claseTendencia = 'neutral';

      if (!esCero) {
        color = tendencia > 0 ? 'var(--success)' : 'var(--danger)';
        flecha = tendencia > 0 ? '↑' : '↓';
        claseTendencia = tendencia > 0 ? 'up' : 'down';
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

  // ==========================================
  // GENERAR CÓDIGO DE LOTE
  // ==========================================

  function generarCodigoLote() {
    const año = new Date().getFullYear();
    const count = lotes.length + 1;
    return `PROD-${año}-${String(count).padStart(4, '0')}`;
  }

  // ==========================================
  // RENDER TABLA (Con nuevos campos)
  // ==========================================

  function renderTabla(filtro = '') {
    const tbody = document.getElementById('tabla-lotes');
    if (!tbody) return;

    const data = filtro
      ? lotes.filter(l =>
          l.codigo.toLowerCase().includes(filtro) ||
          l.prod.toLowerCase().includes(filtro) ||
          l.linea.toLowerCase().includes(filtro) ||
          l.op.toLowerCase().includes(filtro)
        )
      : lotes;

    tbody.innerHTML = '';

    if (data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center;padding:2rem;color:var(--text-muted)">
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

      // AGREGUÉ PALETAS Y GRUESAS A LA TABLA
      tr.innerHTML = `
        <td class="font-mono" style="font-size:12px">
          <span class="badge badge-info">${l.codigo}</span>
        </td>
        <td>${l.prod}</td>
        <td>${l.linea}</td>
        <td>${l.op}</td>
        <td style="text-align:center">${l.uds}</td>
        <td><span class="badge badge-info">${l.turno}</span></td>
        <td style="text-align:center">${l.paletas}</td>
        <td style="text-align:center">${l.gruesas}</td>
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

  // ==========================================
  // ELIMINAR LOTE
  // ==========================================

  window.eliminarLote = async function(id) {
    if (!confirm('¿Estás seguro de eliminar este lote? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/produccion/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          cerrarSesion('⏳ Tu sesión ha expirado.');
          return;
        }
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

  // ==========================================
  // EXPORTAR LOTE
  // ==========================================

  window.exportarLoteIndividual = function(id) {
    if (!id) {
      alert('ID de lote no válido');
      return;
    }
    log(`📤 Exportando lote ${id} a Excel Individual...`);
    window.open(`${API_URL}/reportes/produccion/excel/individual/${id}?token=${localStorage.getItem('token')}`, '_blank');
  };

  window.exportarLoteGeneral = function(id) {
    if (!id) {
      alert('ID de lote no válido');
      return;
    }
    log(`📤 Exportando lote ${id} a Excel General (Sábana)...`);
    window.open(`${API_URL}/reportes/produccion/excel/general/${id}?token=${localStorage.getItem('token')}`, '_blank');
  };

  // ==========================================
  // REGISTRAR PRODUCCIÓN (Actualizado con nuevos campos)
  // ==========================================

  const btnRegistrar = document.getElementById('btn-registrar');

  if (btnRegistrar) {
    btnRegistrar.addEventListener('click', async () => {
      const linea = document.getElementById('linea').value.trim();
      const prod = document.getElementById('producto').value.trim();
      const cant = document.getElementById('cantidad').value;
      const op = document.getElementById('operador').value.trim();
      const turno = document.getElementById('turno').value.trim();
      const fecha = document.getElementById('fecha-prod').value;
      const cliente = document.getElementById('cliente').value.trim();
      const paletas = document.getElementById('paletas').value;
      const gruesas = document.getElementById('gruesas').value;

      if (!linea || !prod || !cant || !op || !turno || !cliente) {
        alert('Completa todos los campos obligatorios (Línea, Molde, Cantidad, Operador, Turno, Cliente).');
        return;
      }

      const codigo = generarCodigoLote();

      // CONSTRUCCIÓN DEL BODY CON LOS NUEVOS CAMPOS
      const body = {
        codigo_lote: codigo,
        linea_produccion: linea,
        tipo_producto: prod,
        cantidad: parseInt(cant) || 0,
        operador: op,
        turno: turno,
        cliente: cliente,
        paletas: parseInt(paletas) || 0,
        gruesas: parseFloat(gruesas) || 0,
        observaciones: document.getElementById('obs-prod').value || null
      };

      if (fecha) {
        body.fecha_produccion = new Date(fecha).toISOString();
      }

      try {
        const response = await fetch(`${API_URL}/produccion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          if (response.status === 401) {
            cerrarSesion('⏳ Tu sesión ha expirado.');
            return;
          }
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

  // ==========================================
  // LIMPIAR FORMULARIO
  // ==========================================

  const btnLimpiar = document.getElementById('btn-limpiar');

  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', () => {
      ['lote-id', 'cantidad', 'operador', 'obs-prod', 'fecha-prod', 'paletas', 'gruesas'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });

      ['linea', 'producto', 'turno', 'cliente'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });

      const loteInput = document.getElementById('lote-id');
      if (loteInput) {
        loteInput.placeholder = `PROD-${new Date().getFullYear()}-${String(lotes.length + 1).padStart(4, '0')}`;
      }
    });
  }

  // ==========================================
  // FILTROS
  // ==========================================

  function aplicarFiltros() {
    filtrosActivos = {
      codigo: document.getElementById('filtro-codigo')?.value.trim() || '',
      producto: document.getElementById('filtro-producto')?.value.trim() || '',
      linea: document.getElementById('filtro-linea')?.value.trim() || '',
      operador: document.getElementById('filtro-operador')?.value.trim() || '',
      turno: document.getElementById('filtro-turno')?.value.trim() || '',
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

  // ==========================================
  // CARGAR OPCIONES DE FILTROS Y DATALISTS (Registrables)
  // ==========================================

  async function cargarOpcionesRegistradas() {
    try {
      const response = await fetch(`${API_URL}/produccion/opciones`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Error cargando opciones');

      const data = await response.json();

      // ACTUALIZAR FILTROS
      const filtros = [
        { id: 'filtro-producto', opciones: data.productos || [] },
        { id: 'filtro-linea', opciones: data.lineas || [] },
        { id: 'filtro-operador', opciones: data.operadores || [] },
        { id: 'filtro-turno', opciones: data.turnos || [] }
      ];

      filtros.forEach(({ id, opciones }) => {
        const select = document.getElementById(id);
        if (!select) return;

        while (select.options.length > 0) {
          select.remove(0);
        }

        const optTodos = document.createElement('option');
        optTodos.value = '';
        optTodos.textContent = 'Todos';
        select.appendChild(optTodos);

        [...new Set(opciones)].sort().forEach(val => {
          if (val) {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            select.appendChild(opt);
          }
        });
      });

      // ACTUALIZAR DATALISTS (Para el formulario registrable)
      const datalists = [
        { id: 'lista-lineas', opciones: data.lineas || [] },
        { id: 'lista-moldes', opciones: data.productos || [] },
        { id: 'lista-turnos', opciones: data.turnos || [] },
        { id: 'lista-operadores', opciones: data.operadores || [] },
        { id: 'lista-clientes', opciones: data.clientes || [] }
      ];

      datalists.forEach(({ id, opciones }) => {
        const datalist = document.getElementById(id);
        if (!datalist) return;

        datalist.innerHTML = '';
        [...new Set(opciones)].sort().forEach(val => {
          if (val) {
            const opt = document.createElement('option');
            opt.value = val;
            datalist.appendChild(opt);
          }
        });
      });

      log('✅ Opciones registradas cargadas');

    } catch (error) {
      logError('Error cargando opciones registradas:', error);
    }
  }

  // ==========================================
  // BUSCADOR RÁPIDO
  // ==========================================

  const buscar = document.getElementById('buscar-lote');

  if (buscar) {
    buscar.addEventListener('input', e => {
      renderTabla(e.target.value.toLowerCase().trim());
    });
  }

  // ==========================================
  // EXPORTAR A CSV
  // ==========================================

  function exportarCSV() {
    if (lotes.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    const headers = ['Código', 'Producto', 'Línea', 'Operador', 'Unidades', 'Turno', 'Paletas', 'Gruesas', 'Fecha', 'Cliente'];
    const rows = lotes.map(l => [
      l.codigo,
      l.prod,
      l.linea,
      l.op,
      l.uds,
      l.turno,
      l.paletas,
      l.gruesas,
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

  // ==========================================
  // EXPORTAR TODOS A EXCEL Y PDF
  // ==========================================

  function exportarExcel() {
    if (lotes.length === 0) {
      alert('No hay datos para exportar');
      return;
    }
    window.open(`${API_URL}/reportes/produccion/excel/general/${lotes[0].id}?token=${localStorage.getItem('token')}`, '_blank');
  }

  function exportarPDF() {
    if (lotes.length === 0) {
      alert('No hay datos para exportar');
      return;
    }
    window.open(`${API_URL}/reportes/produccion/pdf/general/${lotes[0].id}?token=${localStorage.getItem('token')}`, '_blank');
  }

  // ==========================================
  // RECARGAR MANUAL
  // ==========================================

  window.recargarProduccion = function() {
    log('🔄 Recargando producción manualmente...');
    cargarProduccion(filtrosActivos);
  };

  // ==========================================
  // MOSTRAR ERROR
  // ==========================================

  function mostrarError() {
    const tbody = document.getElementById('tabla-lotes');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center;padding:2rem;color:var(--text-muted)">
            <i class="ti ti-alert-circle" style="font-size:1.5rem;margin-right:0.5rem"></i>
            Error al cargar datos. Verifica que el servidor esté corriendo en ${API_URL}
          </td>
        </tr>
      `;
    }
  }

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================

  function init() {
    log('🚀 Producción iniciado');

    mostrarSkeleton();

    // Cargar opciones registradas (para datalists y filtros)
    cargarOpcionesRegistradas();

    // Event listeners
    document.getElementById('btn-aplicar-filtros')?.addEventListener('click', aplicarFiltros);
    document.getElementById('btn-limpiar-filtros')?.addEventListener('click', limpiarFiltros);

    document.getElementById('filtro-codigo')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') aplicarFiltros();
    });

    document.getElementById('btn-exportar-csv')?.addEventListener('click', exportarCSV);
    document.getElementById('btn-exportar-excel')?.addEventListener('click', exportarExcel);
    document.getElementById('btn-exportar-pdf')?.addEventListener('click', exportarPDF);

    cargarProduccion({});

    // Auto-refresh
    if (intervaloCarga) {
      clearInterval(intervaloCarga);
    }

    intervaloCarga = setInterval(() => {
      log('🔄 Auto-actualización de producción...');
      cargarProduccion(filtrosActivos);
    }, 30000);

    // Inicializar controles de usuario
    initUserControls();

    log('✅ Producción iniciado correctamente');
  }

  // ==========================================
  // INICIO - Verificar sesión primero
  // ==========================================

  log('🔐 Verificando sesión...');
  verificarSesion();

})();