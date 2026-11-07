/* ==========================================
   VENVIDRIO - DEFECTOS
   JS v16 - Cálculo automático de muestra (10%) 
            + Mensajes de sugerencia y error corregidos
   ========================================== */

(function () {
  'use strict';

  // ==========================================
  // CONFIGURACIÓN DINÁMICA DE API
  // ==========================================
  const hostname = window.location.hostname;
  let API_URL;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    API_URL = 'http://127.0.0.1:8000';
  } else {
    API_URL = 'https://calidad-venvidrio-repository-main.onrender.com';
  }

  // ==========================================
  // ESTADO GLOBAL
  // ==========================================
  let todosLosLotes = [];
  let lotesPendientes = [];
  let defectos = [];
  let usuarioActual = null;
  let evaluacionSeleccionada = 'no';
  let cargandoTipos = false;
  let claseActiva = '';

  let bandejaGrupo = [];
  let gruposAgregados = [];
  let loteEditando = null;

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const CLASE_BADGE = {
    "Crítico": "critico",
    "Mayor B+": "mayor-bplus",
    "Mayor B-": "mayor-bminus",
    "Menor": "menor"
  };

  const CLASE_COLOR_BAR = {
    "Crítico": "#dc3545",
    "Mayor B+": "#e65100",
    "Mayor B-": "#f57f17",
    "Menor": "#1565c0"
  };

  const ESTATUS_LABELS = {
    "100": "Ticket Generado", "200": "Apto", "300": "Retenido",
    "600": "Despachado", "910": "Decorado", "950": "Reseleccionado", "999": "Sobrante"
  };

  const cacheTipos = {};

  // ==========================================
  // UTILIDADES
  // ==========================================
  function log(msg, data = null) { console.log(`[${new Date().toLocaleTimeString()}] 🔍 ${msg}`, data || ''); }
  function logError(msg, err = null) { console.error(`[${new Date().toLocaleTimeString()}] ❌ ${msg}`, err || ''); }
  function logSuccess(msg, data = null) { console.log(`[${new Date().toLocaleTimeString()}] ✅ ${msg}`, data || ''); }

  function obtenerUrlFoto(fotoUrl) {
    if (!fotoUrl) return null;
    if (fotoUrl.startsWith('http://') || fotoUrl.startsWith('https://')) {
      return fotoUrl.replace(/^(https?)\/\//, '$1://');
    }
    return `${API_URL}${fotoUrl}`;
  }

  function val(id) {
    const el = document.getElementById(id);
    return el ? String(el.value).trim() : '';
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function authHeaders() {
    return {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    };
  }

  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtFecha(fecha) {
    if (!fecha) return '—';
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES');
  }

  function keyMes(fecha) {
    if (!fecha) return '';
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function labelMes(clave) {
    if (!clave) return '';
    const [anio, mes] = clave.split('-');
    return `${MESES[parseInt(mes, 10) - 1]} ${anio}`;
  }

  function clsBadge(clase) {
    return CLASE_BADGE[clase] || 'menor';
  }

  function ordenarPorTicketYLote(a, b) {
    const ta = a.ticket_carga || '';
    const tb = b.ticket_carga || '';
    if (ta !== tb) {
      if (!ta) return 1;
      if (!tb) return -1;
      return ta.localeCompare(tb, 'es', { numeric: true });
    }
    return String(a.codigo_lote || '').localeCompare(String(b.codigo_lote || ''), 'es', { numeric: true });
  }

  function scrollSuave(elemento) {
    if (!elemento) return;
    try {
      elemento.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      elemento.scrollIntoView();
    }
  }

  // ==========================================
  // TOAST
  // ==========================================
  function mostrarToast(mensaje) {
    const toast = document.getElementById('toast-def');
    if (toast) {
      toast.innerHTML = '';
      const icon = document.createElement('i');
      icon.className = 'ti ti-circle-check';
      toast.appendChild(icon);
      toast.appendChild(document.createTextNode(' ' + mensaje));
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2600);
    } else {
      logSuccess(mensaje);
    }
  }

  // ==========================================
  // POBLAR DATALIST
  // ==========================================
  function poblarDatalist(id, valores) {
    const datalist = document.getElementById(id);
    if (!datalist) return;
    datalist.innerHTML = '';
    [...new Set(valores.filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), 'es'))
      .forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        datalist.appendChild(opt);
      });
  }

  // ==========================================
  // SESIÓN Y USUARIO
  // ==========================================
  function cargarUsuarioNav() {
    const userData = localStorage.getItem('user');
    if (!userData) return;
    try {
      const user = JSON.parse(userData);
      usuarioActual = user;
      
      let avatarHtml = '';
      if (user.foto_url) {
        const urlFoto = obtenerUrlFoto(user.foto_url);
        avatarHtml = `<img src="${urlFoto}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
      } else {
        avatarHtml = user.nombre ? user.nombre.substring(0, 2).toUpperCase() : 'US';
      }

      const navAvatar = document.getElementById('navAvatar');
      if (navAvatar) navAvatar.innerHTML = avatarHtml;
      
      const dropdownAvatar = document.getElementById('dropdownAvatar');
      if (dropdownAvatar) dropdownAvatar.innerHTML = avatarHtml;

      setText('navUsername', user.nombre || 'Usuario');
      setText('dropdownName', user.nombre || 'Usuario');
      setText('dropdownEmail', user.correo || 'usuario@email.com');
    } catch (e) {
      logError('Error cargando usuario:', e);
    }
  }

  function mostrarEnlaceUsuarios() {
    const rol = parseInt(localStorage.getItem('role'));
    const link = document.getElementById('navUsuariosLink');
    if (link && rol === 3) link.style.display = 'flex';
  }

  // VERIFICACIÓN DE SESIÓN CORREGIDA
  async function verificarSesion() {
    const token = localStorage.getItem('token');
    if (!token) { 
      window.location.href = '../public/login.html'; 
      return; 
    }

    const fetchConTimeout = async (url, options, timeout = 15000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
      } catch (error) {
        clearTimeout(id);
        throw error;
      }
    };

    try {
      let response;
      try {
        response = await fetchConTimeout(`${API_URL}/auth/verify`, { headers: { 'Authorization': `Bearer ${token}` } }, 15000);
      } catch (err) {
        // Pantalla de carga si Render duerme o falla la red
        document.body.insertAdjacentHTML('beforeend', `
          <div id="render-wake-up" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.9);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;">
            <div style="border: 4px solid #f3f3f3; border-top: 4px solid #1a237e; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
            <h2 style="color:#1a237e;margin-bottom:10px;">Conectando con el servidor...</h2>
            <p style="color:#64748b;">El servidor estaba en reposo. Reintentando...</p>
            <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
          </div>
        `);

        await new Promise(r => setTimeout(r, 5000));
        response = await fetchConTimeout(`${API_URL}/auth/verify`, { headers: { 'Authorization': `Bearer ${token}` } }, 30000); 
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error('UNAUTHORIZED'); // Token realmente inválido
      }
      
      if (!response.ok) {
        throw new Error('SERVER_ERROR');
      }

      // Todo OK
      cargarUsuarioNav();
      mostrarEnlaceUsuarios();
      initUserControls();
      init();

    } catch (error) {
      logError('Error en verificación de sesión:', error);
      
      const loader = document.getElementById('render-wake-up');
      if (loader) loader.remove();

      if (error.message === 'UNAUTHORIZED') {
        cerrarSesion('Sesión expirada. Por favor, vuelve a iniciar sesión.');
        return;
      }

      // Si es un fallo de conexión (Mixed Content, red, etc.), NO borramos el token para no bloquear Supabase.
      alert('No se pudo conectar con el servidor (Error de red o bloqueo del navegador). Revisa tu conexión. La aplicación intentará cargar de todos modos.');
      
      // Forzamos la carga de la UI para no dejar la pantalla en blanco
      cargarUsuarioNav();
      initUserControls();
      init();
    }
  }

  // Cierre de sesión limpio para Supabase
  async function cerrarSesion(mensaje) {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => {}); 
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
    const container = document.getElementById('navUserContainer');
    const dropdown = document.getElementById('userDropdown');
    const logoutBtn = document.getElementById('dropdownLogout');

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

  // ==========================================
  // CARGAR LOTES
  // ==========================================
  async function cargarLotes() {
    try {
      const response = await fetch(`${API_URL}/produccion?limit=1000&t=${Date.now()}`, { headers: authHeaders() });
      if (!response.ok) {
        if (response.status === 401) { cerrarSesion('Sesión expirada'); return; }
        throw new Error(`Error ${response.status}`);
      }
      todosLosLotes = await response.json();
      lotesPendientes = todosLosLotes.filter(l => String(l.estatus || '100') === '100');

      poblarSelectorLotes();
      renderPendientes();
      poblarFiltrosSabana();
      renderSabana();
      actualizarStatsLotes();
    } catch (error) {
      logError('Error cargando lotes:', error);
    }
  }

  function poblarSelectorLotes() {
    const select = document.getElementById('d-lote');
    if (!select) return;
    const anterior = select.value;
    select.innerHTML = '<option value="">-- Seleccione un lote pendiente --</option>';

    const ordenados = [...lotesPendientes].sort(ordenarPorTicketYLote);
    if (ordenados.length === 0) {
      select.innerHTML = '<option value="" disabled>No hay lotes pendientes</option>';
      return;
    }

    ordenados.forEach(lote => {
      const opt = document.createElement('option');
      opt.value = lote.id;
      const ticket = lote.ticket_carga ? `${lote.ticket_carga} · ` : '';
      opt.textContent = `${ticket}${lote.codigo_lote} | ${lote.tipo_producto || lote.molde || 's/p'}`;
      select.appendChild(opt);
    });
    if (anterior && ordenados.some(l => String(l.id) === anterior)) select.value = anterior;
  }

  // ==========================================
  // TABLA DE PENDIENTES
  // ==========================================
  function renderPendientes() {
    const tbody = document.getElementById('tabla-pendientes');
    if (!tbody) return;
    const q = val('buscar-lote-pendiente').toLowerCase();
    const lista = [...lotesPendientes]
      .filter(l => !q || String(l.codigo_lote || '').toLowerCase().includes(q) || String(l.ticket_carga || '').toLowerCase().includes(q))
      .sort(ordenarPorTicketYLote);

    if (lista.length === 0) {
      tbody.innerHTML = `<tr class="fila-vacia"><td colspan="9">No hay lotes pendientes</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(l => `
      <tr>
        <td class="cell-ticket">${esc(l.ticket_carga || '—')}</td>
        <td class="cell-lote">${esc(l.codigo_lote)}</td>
        <td>${esc(l.tipo_producto || '—')}</td>
        <td>${esc(l.cliente || '—')}</td>
        <td>${(l.cantidad || 0).toLocaleString('es-VE')}</td>
        <td>${esc(l.linea_produccion || l.linea || '—')}</td>
        <td>${esc(l.turno || '—')}</td>
        <td style="font-size:12px;color:var(--text-muted)">${fmtFecha(l.fecha_produccion)}</td>
        <td style="text-align:center">
          <button class="btn-evaluar" data-evaluar="${esc(l.id)}" type="button">
            <i class="ti ti-clipboard-check"></i> Evaluar
          </button>
        </td>
      </tr>`).join('');
  }

  function initPendientes() {
    const tbody = document.getElementById('tabla-pendientes');
    if (tbody) {
      let lastTouch = 0;
      const handler = (e) => {
        const now = Date.now();
        if (e.type === 'touchend') { lastTouch = now; }
        else if (now - lastTouch < 400) { return; }
        const btn = e.target.closest('[data-evaluar]');
        if (!btn) return;
        e.preventDefault();
        seleccionarParaEvaluar(btn.dataset.evaluar);
      };
      tbody.addEventListener('click', handler);
      tbody.addEventListener('touchend', handler, { passive: false });
    }

    const buscar = document.getElementById('buscar-lote-pendiente');
    if (buscar) {
      buscar.addEventListener('input', renderPendientes);
      buscar.addEventListener('change', renderPendientes);
    }

    const btnRef = document.getElementById('btn-refrescar-pendientes');
    if (btnRef) {
      let lastTouchRef = 0;
      const handlerRef = async (e) => {
        const now = Date.now();
        if (e.type === 'touchend') { lastTouchRef = now; }
        else if (now - lastTouchRef < 400) { return; }
        e.preventDefault();
        await Promise.all([cargarLotes(), cargarDefectos()]);
        mostrarToast('Datos actualizados');
      };
      btnRef.addEventListener('click', handlerRef);
      btnRef.addEventListener('touchend', handlerRef, { passive: false });
    }
  }

  function seleccionarParaEvaluar(loteId) {
    const select = document.getElementById('d-lote');
    if (!select) return;
    loteEditando = null;
    select.value = String(loteId);
    select.dispatchEvent(new Event('change'));
    const card = select.closest('.card');
    if (card) scrollSuave(card);
  }

  // ==========================================
  // PANEL DE INFO DEL LOTE Y MUESTRA
  // ==========================================
  function initLoteSelector() {
    const select = document.getElementById('d-lote');
    if (!select) return;

    const inputCanastas = document.getElementById('d-canastas');
    if (inputCanastas) {
      inputCanastas.addEventListener('input', calcularTamanoMuestra);
      inputCanastas.addEventListener('change', calcularTamanoMuestra);
    }

    select.addEventListener('change', async () => {
      const panel = document.getElementById('lote-info-panel');
      const muestraPanel = document.getElementById('muestra-panel');
      if (!panel || !muestraPanel) return;

      if (!loteEditando) {
        bandejaGrupo = [];
        gruposAgregados = [];
        renderBandejaGrupo();
        renderGruposAgregados();
      }

      const lote = lotesPendientes.find(l => String(l.id) === String(select.value))
                || todosLosLotes.find(l => String(l.id) === String(select.value));

      if (!lote) {
        panel.style.display = 'none';
        muestraPanel.style.display = 'none';
        limpiarFormulario(false);
        return;
      }

      setText('lote-info-ticket', lote.ticket_carga || 'Sin ticket');
      setText('lote-info-producto', lote.tipo_producto || '—');
      setText('lote-info-cliente', lote.cliente || '—');
      setText('lote-info-cantidad', `${(lote.cantidad || 0).toLocaleString('es-VE')} unidades`);
      setText('lote-info-operador', lote.operador || '—');
      setText('lote-info-obs-produccion', lote.observaciones || 'Sin observaciones');

      const insp = document.getElementById('d-inspector');
      if (insp) insp.value = lote.inspector || lote.operador || (usuarioActual ? usuarioActual.nombre : '');

      const setVal = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.value = v !== undefined && v !== null ? v : 0;
      };

      setVal('d-paletas', lote.paletas);
      setVal('d-botellas-paleta', lote.bot_por_paleta);
      setVal('d-botellas-caja', lote.bot_por_canada || lote.bpc || lote.bot_por_caja);
      setVal('d-tam-poblacion', lote.cantidad);
      setVal('d-gruesas-paleta', lote.gruesas_por_paleta);

      actualizarDisplayMuestra();

      // Al cambiar de lote, reseteamos el input a 1 y recalculamos
      if (inputCanastas) inputCanastas.value = 1;
      calcularTamanoMuestra();

      panel.style.display = 'block';
      muestraPanel.style.display = 'block';

      if (!loteEditando) setEvaluacion('no');
    });
  }

  function actualizarDisplayMuestra() {
    setText('d-tam-poblacion-display', val('d-tam-poblacion') || '—');
    setText('d-botellas-caja-display', val('d-botellas-caja') || '—');
    setText('d-botellas-paleta-display', val('d-botellas-paleta') || '—');
    setText('d-gruesas-paleta-display', val('d-gruesas-paleta') || '—');
    setText('d-tam-muestra-display', val('d-tam-muestra') || '0');
  }

  // ==========================================
  // CÁLCULO AUTOMÁTICO DE MUESTRA (10% del lote)
  // ==========================================
  function calcularTamanoMuestra() {
    const botellasCaja = parseFloat(document.getElementById('d-botellas-caja')?.value) || 0;
    const poblacionTotal = parseFloat(document.getElementById('d-tam-poblacion')?.value) || 0;
    const inputCanastas = document.getElementById('d-canastas');
    const inputMuestra = document.getElementById('d-tam-muestra');
    const textoSugerencia = document.getElementById('sugerencia-muestra');

    if (!inputCanastas || !inputMuestra || !textoSugerencia) return;

    // 1. Si faltan datos para el cálculo, mostrar advertencia
    if (botellasCaja <= 0) {
      textoSugerencia.innerHTML = `<i class="ti ti-alert-triangle"></i> Falta configurar "Bot. por Caja" en producción.`;
      textoSugerencia.style.color = '#dc3545'; // Rojo
    } else if (poblacionTotal <= 0) {
      textoSugerencia.innerHTML = `<i class="ti ti-alert-triangle"></i> Falta la cantidad total producida.`;
      textoSugerencia.style.color = '#dc3545'; // Rojo
    } else {
      // 2. Calcular el 10% de las canastas del lote
      const totalCanastasLote = poblacionTotal / botellasCaja;
      const porcentajeARevisar = totalCanastasLote * 0.10; 
      
      // Redondear hacia arriba y mínimo 1 canasta
      const canastasSugeridas = Math.max(1, Math.ceil(porcentajeARevisar));
      
      textoSugerencia.innerHTML = `<i class="ti ti-info-circle"></i> Sugerido: ${canastasSugeridas} canasta(s) (10% del lote)`;
      textoSugerencia.style.color = 'var(--brand-2)'; // Azul normal

      // Si el input está en 1 (valor por defecto), poner la sugerencia automáticamente
      if (inputCanastas.value === '1' && canastasSugeridas > 1) {
        inputCanastas.value = canastasSugeridas;
      }
    }

    // 3. Calcular la muestra final basada en lo que esté en el input
    const canastasFinales = parseFloat(inputCanastas.value) || 0;
    const muestra = canastasFinales * botellasCaja;

    inputMuestra.value = muestra;
    setText('d-tam-muestra-display', muestra);
  }

  // ==========================================
  // TOGGLE APTO / RETENIDO
  // ==========================================
  function initToggleEvaluacion() {
    const btnApto = document.getElementById('btn-apto');
    const btnRetenido = document.getElementById('btn-retenido');
    if (btnApto) btnApto.addEventListener('click', () => setEvaluacion('no'));
    if (btnRetenido) btnRetenido.addEventListener('click', () => setEvaluacion('si'));
    setEvaluacion('no');
  }

  function setEvaluacion(valor) {
    evaluacionSeleccionada = valor;
    const campos = document.getElementById('campos-defecto');
    const badge = document.getElementById('badge-evaluacion');
    const obsInput = document.getElementById('d-observaciones');
    const btnApto = document.getElementById('btn-apto');
    const btnRetenido = document.getElementById('btn-retenido');

    if (btnApto) btnApto.classList.toggle('active', valor === 'no');
    if (btnRetenido) btnRetenido.classList.toggle('active', valor === 'si');

    if (valor === 'si') {
      if (campos) campos.style.display = 'block';
      if (badge) { badge.textContent = 'Retenido'; badge.className = 'badge badge-danger'; }
      if (obsInput) {
        obsInput.readOnly = false;
        obsInput.style.backgroundColor = 'white';
        obsInput.style.cursor = 'text';
      }
    } else {
      if (campos) campos.style.display = 'none';
      if (badge) { badge.textContent = 'Apto'; badge.className = 'badge badge-success'; }
      if (obsInput) {
        obsInput.readOnly = true;
        obsInput.style.backgroundColor = '#f8f9fa';
        obsInput.style.cursor = 'not-allowed';
      }
      ocultarCatalogoTipos();
    }
  }

  // ==========================================
  // CHIPS DE CLASIFICACIÓN
  // ==========================================
  function initChipsClasificacion() {
    const contenedor = document.getElementById('chips-clasificacion');
    if (!contenedor) return;

    let lastTouchChip = 0;
    const handler = async (e) => {
      const now = Date.now();
      if (e.type === 'touchend') { lastTouchChip = now; }
      else if (now - lastTouchChip < 400) { return; }

      const chip = e.target.closest('.chip-clase');
      if (!chip) return;
      e.preventDefault();

      const clase = chip.dataset.clase;
      if (!clase) return;

      document.querySelectorAll('#chips-clasificacion .chip-clase').forEach(c => {
        c.classList.toggle('active', c === chip);
      });

      claseActiva = clase;

      const tipos = await cargarTiposPorClasificacion(clase);
      renderCatalogoTipos(clase, tipos);
    };

    contenedor.addEventListener('click', handler);
    contenedor.addEventListener('touchend', handler, { passive: false });
  }

  function ocultarCatalogoTipos() {
    claseActiva = '';
    document.querySelectorAll('#chips-clasificacion .chip-clase').forEach(c => c.classList.remove('active'));

    const panel = document.getElementById('panel-tipos-clasificacion');
    if (panel) panel.style.display = 'none';

    const placeholder = document.getElementById('catalogo-placeholder');
    if (placeholder) placeholder.style.display = 'flex';

    const badge = document.getElementById('catalogo-clase-activa');
    if (badge) { badge.style.display = 'none'; badge.textContent = ''; badge.className = 'badge-clase-activa'; }

    const inputManual = document.getElementById('d-tipo-manual');
    const btnManual = document.getElementById('btn-agregar-tipo-manual');
    if (inputManual) { inputManual.disabled = true; inputManual.value = ''; }
    if (btnManual) btnManual.disabled = true;

    const datalist = document.getElementById('lista-tipos-defecto');
    if (datalist) datalist.innerHTML = '';
  }

  // ==========================================
  // CATÁLOGO DE TIPOS
  // ==========================================
  function renderCatalogoTipos(clase, tipos) {
    const panel = document.getElementById('panel-tipos-clasificacion');
    const contenedor = document.getElementById('lista-tipos-agrupada');
    const placeholder = document.getElementById('catalogo-placeholder');
    const badge = document.getElementById('catalogo-clase-activa');
    if (!panel || !contenedor) return;

    if (badge) {
      badge.style.display = 'inline-block';
      badge.textContent = clase;
      badge.className = `badge-clase-activa ${clsBadge(clase)}`;
    }

    if (tipos.length === 0) {
      contenedor.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);">Sin tipos registrados para esta clasificación</div>';
    } else {
      contenedor.innerHTML = tipos.map(tipo => {
        const yaEnBandeja = bandejaGrupo.some(d => d.tipo === tipo && d.clase === clase);
        return `<div class="tipo-item${yaEnBandeja ? ' ya-agregado' : ''}" data-tipo="${esc(tipo)}">${esc(tipo)}</div>`;
      }).join('');
    }

    panel.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';

    poblarDatalist('lista-tipos-defecto', tipos);
    const inputManual = document.getElementById('d-tipo-manual');
    const btnManual = document.getElementById('btn-agregar-tipo-manual');
    if (inputManual) { inputManual.disabled = false; inputManual.value = ''; }
    if (btnManual) btnManual.disabled = true;

    const buscador = document.getElementById('buscar-tipos-clasificacion');
    if (buscador) buscador.value = '';
  }

  function initClickItemsTipos() {
    const contenedor = document.getElementById('lista-tipos-agrupada');
    if (!contenedor) return;

    let lastTouchTipo = 0;
    const handler = (e) => {
      const now = Date.now();
      if (e.type === 'touchend') { lastTouchTipo = now; }
      else if (now - lastTouchTipo < 400) { return; }

      const item = e.target.closest('.tipo-item');
      if (!item) return;
      e.preventDefault();

      const tipo = item.dataset.tipo;
      const clase = claseActiva;
      const zona = val('d-zona');
      const desc = val('d-desc');

      if (!clase) {
        alert('Seleccione una clasificación primero.');
        return;
      }
      if (!tipo) return;

      const existente = bandejaGrupo.find(d => d.tipo === tipo && d.clase === clase);
      if (existente) {
        mostrarToast(`"${tipo}" ya está en el grupo actual.`);
        return;
      }

      bandejaGrupo.push({ clase, tipo, zona, desc });

      item.classList.add('adding', 'ya-agregado');
      setTimeout(() => item.classList.remove('adding'), 400);

      ['d-zona', 'd-desc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });

      renderBandejaGrupo();
      mostrarToast(`"${tipo}" agregado al grupo actual.`);
    };

    contenedor.addEventListener('click', handler);
    contenedor.addEventListener('touchend', handler, { passive: false });
  }

  // ==========================================
  // AGREGAR TIPO MANUAL + PERSISTIR EN CATÁLOGO
  // ==========================================
  async function agregarTipoManual() {
    const input = document.getElementById('d-tipo-manual');
    const btn = document.getElementById('btn-agregar-tipo-manual');
    if (!input) return;

    const tipo = input.value.trim();
    const clase = claseActiva;
    const zona = val('d-zona');
    const desc = val('d-desc');

    if (!clase) {
      alert('Seleccione primero una clasificación.');
      return;
    }
    if (!tipo) {
      alert('Escriba el nombre del tipo de defecto.');
      input.focus();
      return;
    }

    const existente = bandejaGrupo.find(d => d.tipo === tipo && d.clase === clase);
    if (existente) {
      mostrarToast(`"${tipo}" ya está en el grupo actual.`);
      input.value = '';
      return;
    }

    const tiposDeClase = cacheTipos[clase] || [];
    const existeEnCatalogo = tiposDeClase.some(t =>
      String(t).toLowerCase() === tipo.toLowerCase()
    );

    let persistido = true;
    if (!existeEnCatalogo) {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="ti ti-loader"></i>';
      }

      try {
        const response = await fetch(`${API_URL}/defectos/tipos`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            tipo_defecto: tipo,
            clasificacion: clase
          })
        });

        if (response.ok || response.status === 201) {
          logSuccess(`Tipo "${tipo}" (${clase}) guardado en catálogo.`);
        } else if (response.status === 409) {
          log('Tipo ya existía en el catálogo (409), se reutiliza.');
        } else {
          throw new Error(`Error ${response.status}`);
        }
      } catch (err) {
        logError('No se pudo guardar el tipo en el catálogo:', err);
        persistido = false;
        mostrarToast(`⚠️ "${tipo}" se agregará al grupo, pero no se pudo guardar en el catálogo.`);
      } finally {
        if (btn) {
          btn.disabled = !input.value.trim();
          btn.innerHTML = '<i class="ti ti-plus"></i>';
        }
      }
    }

    if (persistido && !existeEnCatalogo) {
      if (!cacheTipos[clase]) cacheTipos[clase] = [];
      const yaEnCache = cacheTipos[clase].some(t => String(t).toLowerCase() === tipo.toLowerCase());
      if (!yaEnCache) {
        cacheTipos[clase].push(tipo);
        cacheTipos[clase].sort((a, b) => a.localeCompare(b, 'es'));
      }

      renderCatalogoTipos(clase, cacheTipos[clase]);
      poblarDatalist('lista-tipos-defecto', cacheTipos[clase]);
    }

    bandejaGrupo.push({ clase, tipo, zona, desc });

    input.value = '';
    ['d-zona', 'd-desc'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    if (btn) btn.disabled = true;

    renderBandejaGrupo();

    document.querySelectorAll('#lista-tipos-agrupada .tipo-item').forEach(item => {
      if (item.dataset.tipo === tipo) item.classList.add('ya-agregado');
    });

    const msg = existeEnCatalogo
      ? `"${tipo}" agregado al grupo (${clase}).`
      : `"${tipo}" (${clase}) agregado al grupo y guardado en el catálogo.`;
    mostrarToast(msg);

    input.focus();
  }

  function initAgregarTipoManual() {
    const input = document.getElementById('d-tipo-manual');
    const btn = document.getElementById('btn-agregar-tipo-manual');
    if (!input || !btn) return;

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      await agregarTipoManual();
    });

    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await agregarTipoManual();
      }
    });

    input.addEventListener('input', () => {
      btn.disabled = !input.value.trim();
    });
  }

  function initBuscadorTipos() {
    const buscador = document.getElementById('buscar-tipos-clasificacion');
    if (!buscador) return;
    const handler = () => {
      const query = buscador.value.toLowerCase().trim();
      document.querySelectorAll('#lista-tipos-agrupada .tipo-item').forEach(item => {
        item.style.display = item.dataset.tipo.toLowerCase().includes(query) ? 'flex' : 'none';
      });
    };
    buscador.addEventListener('input', handler);
    buscador.addEventListener('change', handler);
  }

  async function cargarTiposPorClasificacion(clase) {
    if (cacheTipos[clase]) return cacheTipos[clase];
    if (cargandoTipos) return [];
    cargandoTipos = true;
    let tipos = [];
    try {
      const response = await fetch(`${API_URL}/defectos/tipos?clasificacion=${encodeURIComponent(clase)}&t=${Date.now()}`, { headers: authHeaders() });
      if (response.ok) {
        const data = await response.json();
        const lista = Array.isArray(data) ? data : (data.tipos || []);
        tipos = lista.map(t => typeof t === 'string' ? t : t.tipo_defecto).filter(Boolean);
      }
    } catch (error) {
      logError('Error cargando tipos:', error);
    } finally {
      cargandoTipos = false;
    }
    cacheTipos[clase] = [...new Set(tipos)].sort();
    return cacheTipos[clase];
  }

  // ==========================================
  // BANDEJA DEL GRUPO ACTUAL
  // ==========================================
  function renderBandejaGrupo() {
    const cont = document.getElementById('lista-grupo-actual');
    const contador = document.getElementById('contador-grupo');
    if (!cont) return;

    if (contador) {
      contador.textContent = bandejaGrupo.length;
      contador.classList.toggle('tiene-defectos', bandejaGrupo.length > 0);
    }

    if (bandejaGrupo.length === 0) {
      cont.innerHTML = `<div class="bandeja-vacia">
        <i class="ti ti-inbox"></i>
        <span>Aún no hay defectos en este grupo. Elija un tipo del catálogo o escríbalo manualmente y pulse <kbd>Enter</kbd>.</span>
      </div>`;
      return;
    }

    cont.innerHTML = bandejaGrupo.map((d, idx) => `
      <div class="bandeja-item">
        <span class="mini-badge ${clsBadge(d.clase)}">${esc(d.clase)}</span>
        <span class="bandeja-tipo">${esc(d.tipo)}</span>
        <span class="bandeja-zona">${esc(d.zona || '—')}</span>
        <button type="button" class="btn-quitar-defecto" onclick="window.quitarDeBandeja(${idx})" title="Quitar">
          <i class="ti ti-x"></i>
        </button>
      </div>
    `).join('');
  }

  window.quitarDeBandeja = function (idx) {
    const d = bandejaGrupo[idx];
    if (!d) return;
    bandejaGrupo.splice(idx, 1);
    renderBandejaGrupo();
    if (claseActiva) {
      document.querySelectorAll('#lista-tipos-agrupada .tipo-item').forEach(item => {
        const tipo = item.dataset.tipo;
        const sigue = bandejaGrupo.some(x => x.tipo === tipo && x.clase === claseActiva);
        item.classList.toggle('ya-agregado', sigue);
      });
    }
    mostrarToast(`"${d.tipo}" eliminado del grupo.`);
  };

  function initVaciarGrupo() {
    const btn = document.getElementById('btn-vaciar-grupo');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (bandejaGrupo.length === 0) return;
      if (!confirm(`¿Vaciar los ${bandejaGrupo.length} defecto(s) del grupo actual?`)) return;
      bandejaGrupo = [];
      renderBandejaGrupo();
      if (claseActiva) {
        document.querySelectorAll('#lista-tipos-agrupada .tipo-item').forEach(item => item.classList.remove('ya-agregado'));
      }
      mostrarToast('Grupo actual vaciado.');
    });
  }

  // ==========================================
  // AGREGAR GRUPO A LA EVALUACIÓN
  // ==========================================
  function initAgregarGrupo() {
    const btn = document.getElementById('btn-agregar-grupo');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const piezas = parseInt(val('d-piezas-grupo'), 10);
      if (!piezas || piezas < 1) {
        alert('Indique la cantidad de piezas que comparten estos defectos (mínimo 1).');
        return;
      }
      if (bandejaGrupo.length === 0) {
        alert('Agregue al menos un defecto al grupo antes de guardarlo.');
        return;
      }

      gruposAgregados.push({
        piezas,
        defectos: bandejaGrupo.map(d => ({ ...d }))
      });

      bandejaGrupo = [];
      const piezasInput = document.getElementById('d-piezas-grupo');
      if (piezasInput) piezasInput.value = '1';
      ['d-zona', 'd-desc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const inputManual = document.getElementById('d-tipo-manual');
      if (inputManual) inputManual.value = '';
      ocultarCatalogoTipos();

      renderBandejaGrupo();
      renderGruposAgregados();
      mostrarToast(`Grupo de ${piezas} pieza(s) agregado a la evaluación.`);
    });
  }

  // ==========================================
  // GRUPOS AGREGADOS A LA EVALUACIÓN
  // ==========================================
  function renderGruposAgregados() {
    const cont = document.getElementById('lista-grupos-agregados');
    const contador = document.getElementById('contador-grupos');
    if (!cont) return;

    const totalPiezas = gruposAgregados.reduce((a, g) => a + g.piezas, 0);
    const totalDefectos = gruposAgregados.reduce((a, g) => a + g.defectos.length, 0);

    if (contador) {
      contador.textContent = `${gruposAgregados.length} grupo${gruposAgregados.length === 1 ? '' : 's'}`;
      contador.classList.toggle('tiene-defectos', gruposAgregados.length > 0);
    }

    if (gruposAgregados.length === 0) {
      cont.innerHTML = `<div class="grupos-vacio">
        <i class="ti ti-packages"></i>
        <span>Aún no hay grupos agregados. Complete un grupo y pulse "Agregar grupo a la evaluación".</span>
      </div>`;
      return;
    }

    let html = '';
    gruposAgregados.forEach((g, gIdx) => {
      const defHtml = g.defectos.map(d =>
        `<span class="grupo-def-chip">
           <span class="mini-badge ${clsBadge(d.clase)}">${esc(d.clase)}</span>
           ${esc(d.tipo)}
         </span>`
      ).join('');

      html += `
        <div class="grupo-card">
          <div class="grupo-card-header">
            <div class="grupo-card-titulo">
              <span class="grupo-num">#${gIdx + 1}</span>
              <span class="grupo-piezas"><strong>${g.piezas}</strong> pieza${g.piezas === 1 ? '' : 's'}</span>
              <span class="grupo-defectos-count">${g.defectos.length} defecto${g.defectos.length === 1 ? '' : 's'}</span>
            </div>
            <button type="button" class="btn-quitar-defecto" onclick="window.eliminarGrupoAgregado(${gIdx})" title="Quitar grupo">
              <i class="ti ti-trash"></i>
            </button>
          </div>
          <div class="grupo-card-body">
            ${defHtml}
          </div>
        </div>
      `;
    });

    html += `
      <div class="grupos-resumen">
        <div><strong>${totalPiezas}</strong> pieza(s) afectada(s) en total</div>
        <div><strong>${totalDefectos}</strong> defecto(s) registrado(s) en total</div>
      </div>
    `;

    cont.innerHTML = html;
  }

  window.eliminarGrupoAgregado = function (idx) {
    const g = gruposAgregados[idx];
    if (!g) return;
    if (!confirm(`¿Eliminar el grupo #${idx + 1} (${g.piezas} pieza(s), ${g.defectos.length} defecto(s))?`)) return;
    gruposAgregados.splice(idx, 1);
    renderGruposAgregados();
    mostrarToast('Grupo eliminado de la evaluación.');
  };

  function initLimpiarEvaluacion() {
    const btn = document.getElementById('btn-limpiar-evaluacion');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (gruposAgregados.length === 0) return;
      if (!confirm(`¿Vaciar TODOS los ${gruposAgregados.length} grupo(s) de la evaluación?`)) return;
      gruposAgregados = [];
      renderGruposAgregados();
      mostrarToast('Evaluación limpiada.');
    });
  }

  // ==========================================
  // CARGAR DEFECTOS EXISTENTES
  // ==========================================
  async function cargarDefectos() {
    try {
      const response = await fetch(`${API_URL}/defectos?t=${Date.now()}`, { headers: authHeaders() });
      if (response.ok) {
        const data = await response.json();
        defectos = data.map(d => ({
          id: d.id,
          lote: d.codigo_lote || d.lote || '',
          lote_id: d.lote_id || null,
          grupo_id: d.grupo_id || null,
          tipo: d.tipo_defecto || '—',
          clase: d.clasificacion || 'Menor',
          piezas: parseInt(d.cantidad_piezas, 10) || 0,
          zona: d.zona_deteccion || '',
          inspector: d.inspector || '',
          descripcion: d.descripcion || ''
        }));
        actualizarStatsDefectos();
        renderDist();
        renderTop();
        renderSabana();
        poblarZonas();
      }
    } catch (error) {
      logError('Error cargando defectos:', error);
    }
  }

  function poblarZonas() {
    const zonas = defectos.map(d => d.zona).filter(Boolean);
    poblarDatalist('lista-zonas', zonas);
  }

  function defectosDeLote(lote) {
    const id = String(lote.id);
    const codigo = String(lote.codigo_lote || '').toLowerCase();
    const porFK = defectos.filter(d => d.lote_id && String(d.lote_id) === id);
    if (porFK.length > 0) return porFK;
    return defectos.filter(d => !d.lote_id && codigo && String(d.lote).toLowerCase() === codigo);
  }

  function actualizarStatsDefectos() {
    setText('total-defectos', defectos.length);
    setText('defectos-criticos', defectos.filter(d => d.clase === 'Crítico').length);
    setText('defectos-mayores-bplus', defectos.filter(d => d.clase === 'Mayor B+').length);
    setText('defectos-mayores-bminus', defectos.filter(d => d.clase === 'Mayor B-').length);
    setText('defectos-menores', defectos.filter(d => d.clase === 'Menor').length);
  }

  function actualizarStatsLotes() {
    setText('lotes-apto', todosLosLotes.filter(l => String(l.estatus) === '200').length);
    setText('lotes-retenidos', todosLosLotes.filter(l => String(l.estatus) === '300').length);
  }

  // ==========================================
  // DISTRIBUCIÓN Y TOP
  // ==========================================
  function agruparPorTipo() {
    const grupos = {};
    defectos.forEach(d => {
      const clave = `${d.tipo}||${d.clase}`;
      if (!grupos[clave]) grupos[clave] = { tipo: d.tipo, clase: d.clase, piezas: 0, registros: 0 };
      grupos[clave].piezas += d.piezas;
      grupos[clave].registros += 1;
    });
    return Object.values(grupos);
  }

  function renderDist() {
    const cont = document.getElementById('dist-bars');
    if (!cont) return;
    const grupos = agruparPorTipo();
    const total = grupos.reduce((a, g) => a + g.piezas, 0);
    if (grupos.length === 0) { cont.innerHTML = '<div class="empty-state">Sin defectos</div>'; return; }

    cont.innerHTML = grupos.sort((a, b) => b.piezas - a.piezas).slice(0, 8).map(g => {
      const pct = total ? Math.round((g.piezas / total) * 100) : 0;
      const color = CLASE_COLOR_BAR[g.clase] || 'var(--navy)';
      return `<div class="dist-bar-item">
        <div class="dist-bar-label"><span>${esc(g.tipo)}</span><span>${g.piezas} uds</span></div>
        <div class="dist-track"><div class="dist-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>`;
    }).join('');
  }

  function renderTop() {
    const cont = document.getElementById('top-defectos');
    if (!cont) return;
    const grupos = agruparPorTipo();
    const total = grupos.reduce((a, g) => a + g.piezas, 0);
    if (grupos.length === 0) { cont.innerHTML = '<div class="empty-state">Sin defectos</div>'; return; }

    cont.innerHTML = grupos.sort((a, b) => b.piezas - a.piezas).slice(0, 10).map((g, i) => {
      const pct = total ? Math.round((g.piezas / total) * 100) : 0;
      return `<div class="top-item">
        <div class="top-rank">${i + 1}</div>
        <div class="top-info">
          <div class="top-name">${esc(g.tipo)}</div>
          <div class="top-count">${g.piezas} piezas</div>
        </div>
        <div class="top-pct">${pct}%</div>
      </div>`;
    }).join('');
  }

  // ==========================================
  // SÁBANA
  // ==========================================
  function poblarFiltrosSabana() {
    const selectMes = document.getElementById('sabana-mes');
    const selectCliente = document.getElementById('sabana-cliente');
    if (selectMes) {
      const actual = selectMes.value;
      const meses = [...new Set(todosLosLotes.map(l => keyMes(l.fecha_produccion)).filter(Boolean))].sort().reverse();
      selectMes.innerHTML = '<option value="">Todos los meses</option>';
      meses.forEach(m => selectMes.appendChild(new Option(labelMes(m), m)));
      if (actual) selectMes.value = actual;
    }
    if (selectCliente) {
      const actual = selectCliente.value;
      const clientes = [...new Set(todosLosLotes.map(l => l.cliente).filter(Boolean))].sort();
      selectCliente.innerHTML = '<option value="">Todos los clientes</option>';
      clientes.forEach(c => selectCliente.appendChild(new Option(c, c)));
      if (actual) selectCliente.value = actual;
    }
  }

  function filtradosSabana() {
    const mes = val('sabana-mes');
    const cliente = val('sabana-cliente');
    const q = val('sabana-buscar').toLowerCase();
    return todosLosLotes.filter(l => {
      const est = String(l.estatus || '100');
      if (est !== '200' && est !== '300') return false;
      if (mes && keyMes(l.fecha_produccion) !== mes) return false;
      if (cliente && String(l.cliente || '') !== cliente) return false;
      if (q && !`${l.codigo_lote} ${l.ticket_carga} ${l.tipo_producto}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort(ordenarPorTicketYLote);
  }

  function renderSabana() {
    const evaluados = filtradosSabana();
    const aptos = evaluados.filter(l => String(l.estatus) === '200');
    const retenidos = evaluados.filter(l => String(l.estatus) === '300');

    renderSeccionApto(aptos);
    renderSeccionRetenido(retenidos);
    setText('count-apto', aptos.length);
    setText('count-retenido', retenidos.length);

    const vacioApto = document.getElementById('vacio-apto');
    const vacioRet = document.getElementById('vacio-retenido');
    if (vacioApto) vacioApto.style.display = aptos.length === 0 ? 'flex' : 'none';
    if (vacioRet) vacioRet.style.display = retenidos.length === 0 ? 'flex' : 'none';
  }

  function renderSeccionApto(lotes) {
    const tbody = document.getElementById('tabla-apto');
    if (!tbody) return;
    if (lotes.length === 0) { tbody.innerHTML = ''; return; }
    tbody.innerHTML = lotes.map(l => `
      <tr>
        <td class="cell-ticket">${esc(l.ticket_carga || '—')}</td>
        <td class="cell-lote">${esc(l.codigo_lote)}</td>
        <td>${esc(l.tipo_producto || '—')}</td>
        <td>${esc(l.cliente || '—')}</td>
        <td>${(l.cantidad || 0).toLocaleString('es-VE')}</td>
        <td>${esc(l.turno || '—')} / ${esc(l.grupo || '—')}</td>
        <td>${fmtFecha(l.fecha_produccion)}</td>
        <td style="text-align:center"><button class="btn-ver" data-ver="${esc(l.id)}"><i class="ti ti-eye"></i></button></td>
      </tr>`).join('');
  }

  function renderSeccionRetenido(lotes) {
    const tbody = document.getElementById('tabla-retenido');
    if (!tbody) return;
    if (lotes.length === 0) { tbody.innerHTML = ''; return; }

    tbody.innerHTML = lotes.map(l => {
      const defs = defectosDeLote(l);

      let piezasRet = 0;
      const gruposSumados = new Set();

      defs.forEach(d => {
        const claveGrupo = d.grupo_id || `grupo_${d.piezas}`;
        if (!gruposSumados.has(claveGrupo)) {
          piezasRet += d.piezas;
          gruposSumados.add(claveGrupo);
        }
      });

      const tiposHtml = defs.length ? defs.map(d => `<span class="def-item">${esc(d.tipo)} (${d.piezas})</span>`).join('') : 'Sin catalogación';

      return `
        <tr>
          <td class="cell-ticket">${esc(l.ticket_carga || '—')}</td>
          <td class="cell-lote">${esc(l.codigo_lote)}</td>
          <td>${esc(l.tipo_producto || '—')}</td>
          <td>${esc(l.cliente || '—')}</td>
          <td class="celda-defectos">${tiposHtml}</td>
          <td>${[...new Set(defs.map(d => d.clase))].map(c => `<span class="mini-badge ${clsBadge(c)}">${esc(c)}</span>`).join('') || '—'}</td>
          <td class="cell-ret">${piezasRet}</td>
          <td style="text-align:center; display:flex; gap:4px; justify-content:center;">
            <button class="btn-ver" data-ver="${esc(l.id)}" title="Ver"><i class="ti ti-eye"></i></button>
            <button class="btn-ver" data-editar="${esc(l.id)}" title="Editar Defectos" style="color:#f57c00; border-color:#f57c00;"><i class="ti ti-pencil"></i></button>
            <button class="btn-ver" data-eliminar="${esc(l.id)}" title="Devolver a Evaluación" style="color:#dc3545; border-color:#dc3545;"><i class="ti ti-refresh"></i></button>
          </td>
        </tr>`;
    }).join('');
  }

  function initSabana() {
    ['sabana-mes', 'sabana-cliente', 'sabana-buscar'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', renderSabana);
        el.addEventListener('change', renderSabana);
      }
    });

    const btnLimpiar = document.getElementById('btn-limpiar-sabana');
    if (btnLimpiar) {
      btnLimpiar.addEventListener('click', () => {
        ['sabana-mes', 'sabana-cliente', 'sabana-buscar'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        renderSabana();
      });
    }

    const tablaApto = document.getElementById('tabla-apto');
    if (tablaApto) {
      let lastTouchApto = 0;
      const handler = (e) => {
        const now = Date.now();
        if (e.type === 'touchend') { lastTouchApto = now; }
        else if (now - lastTouchApto < 400) { return; }
        const btnVer = e.target.closest('[data-ver]');
        if (btnVer) { e.preventDefault(); verLote(btnVer.dataset.ver); }
      };
      tablaApto.addEventListener('click', handler);
      tablaApto.addEventListener('touchend', handler, { passive: false });
    }

    const tablaRetenido = document.getElementById('tabla-retenido');
    if (tablaRetenido) {
      let lastTouchRet = 0;
      const handler = async (e) => {
        const now = Date.now();
        if (e.type === 'touchend') { lastTouchRet = now; }
        else if (now - lastTouchRet < 400) { return; }

        const btnVer = e.target.closest('[data-ver]');
        const btnEditar = e.target.closest('[data-editar]');
        const btnEliminar = e.target.closest('[data-eliminar]');

        if (btnVer) {
          e.preventDefault();
          verLote(btnVer.dataset.ver);
        } else if (btnEditar) {
          e.preventDefault();
          const id = btnEditar.dataset.editar;
          const lote = todosLosLotes.find(l => String(l.id) === String(id));
          if (!lote) return;

          loteEditando = lote.id;
          setEvaluacion('si');

          const select = document.getElementById('d-lote');
          select.value = String(id);
          select.dispatchEvent(new Event('change'));

          setTimeout(() => {
            const defs = defectosDeLote(lote);
            const mapaGrupos = {};
            defs.forEach(d => {
              const piezas = d.piezas;
              if (!mapaGrupos[piezas]) mapaGrupos[piezas] = [];
              mapaGrupos[piezas].push({
                clase: d.clase,
                tipo: d.tipo,
                zona: d.zona,
                desc: d.descripcion
              });
            });
            gruposAgregados = Object.entries(mapaGrupos).map(([piezas, defsGrupo]) => ({
              piezas: parseInt(piezas, 10),
              defectos: defsGrupo
            }));

            renderGruposAgregados();
            renderBandejaGrupo();
            setEvaluacion('si');

            const obsInput = document.getElementById('d-observaciones');
            if (obsInput) obsInput.value = lote.observaciones || '';

            const layout = document.querySelector('.def-layout');
            if (layout) scrollSuave(layout);
          }, 150);

        } else if (btnEliminar) {
          e.preventDefault();
          if (!confirm('¿Estás seguro de devolver este lote a evaluación? Se eliminarán todos los defectos registrados.')) return;
          const id = btnEliminar.dataset.eliminar;

          try {
            const resDel = await fetch(`${API_URL}/defectos/lote/${id}`, { method: 'DELETE', headers: authHeaders() });
            if (!resDel.ok && resDel.status !== 404) throw new Error('Error al eliminar defectos');

            await fetch(`${API_URL}/produccion/${id}`, {
              method: 'PUT',
              headers: authHeaders(),
              body: JSON.stringify({ estatus: "100", estado_auditoria: "pendiente", observaciones: "" })
            });

            mostrarToast('Lote devuelto a evaluación (Estatus 100)');
            await refrescar();
          } catch (err) {
            logError('Error al devolver lote:', err);
            alert('No se pudo devolver el lote. Revisa la consola.');
          }
        }
      };
      tablaRetenido.addEventListener('click', handler);
      tablaRetenido.addEventListener('touchend', handler, { passive: false });
    }
  }

  // ==========================================
  // MODAL DE VER DETALLE
  // ==========================================
  async function verLote(loteId) {
    const modal = document.getElementById('modal-ver-lote');
    if (!modal) return;
    try {
      const response = await fetch(`${API_URL}/produccion/${loteId}`, { headers: authHeaders() });
      const lote = await response.json();
      const set = (id, v) => setText(id, v || '—');

      setText('modal-lote-codigo', lote.codigo_lote);
      set('detail-planta', lote.planta);
      set('detail-fecha', fmtFecha(lote.fecha_produccion));
      set('detail-turno', lote.turno);
      set('detail-producto', lote.tipo_producto);
      set('detail-cliente', lote.cliente);
      set('detail-cantidad', lote.cantidad ? `${lote.cantidad} uds` : '—');

      const est = String(lote.estatus || '100');
      set('detail-estatus', `${est} — ${ESTATUS_LABELS[est] || 'Desconocido'}`);

      set('detail-canastas', lote.canastas_inspeccionadas || lote.paletas);
      set('detail-muestra', lote.tamano_muestra);
      set('detail-inspector', lote.operador || lote.inspector);
      set('detail-observaciones', lote.observaciones);

      const defs = defectosDeLote(lote);

      let piezasRet = 0;
      const gruposSumados = new Set();

      defs.forEach(d => {
        const claveGrupo = d.grupo_id || `grupo_${d.piezas}`;
        if (!gruposSumados.has(claveGrupo)) {
          piezasRet += d.piezas;
          gruposSumados.add(claveGrupo);
        }
      });

      set('detail-retenidas', piezasRet ? `${piezasRet} uds` : '0 uds');

      const secDef = document.getElementById('modal-seccion-defectos');
      const tbodyDef = document.getElementById('modal-defectos');

      if (defs.length > 0) {
        if (secDef) secDef.style.display = 'block';

        const gruposMap = {};
        defs.forEach(d => {
          const key = d.grupo_id || `grupo_piezas_${d.piezas}`;
          if (!gruposMap[key]) {
            gruposMap[key] = { piezas: d.piezas, defectos: [] };
          }
          gruposMap[key].defectos.push(d);
        });

        const gruposArray = Object.values(gruposMap);

        if (tbodyDef) tbodyDef.innerHTML = gruposArray.map((g) => {
          const chipsDefectos = g.defectos.map(d =>
            `<span class="grupo-def-chip" style="margin:2px;">
               <span class="mini-badge ${clsBadge(d.clase)}">${esc(d.clase)}</span>
               ${esc(d.tipo)}
             </span>`
          ).join('');

          return `<tr>
            <td style="font-weight:700; color:var(--navy); vertical-align:top; padding-top:10px;">${g.piezas} pza(s)</td>
            <td colspan="4">
              <div style="display:flex; flex-wrap:wrap; gap:4px;">${chipsDefectos}</div>
            </td>
          </tr>`;
        }).join('');
      } else {
        if (secDef) secDef.style.display = 'none';
      }
      modal.style.display = 'flex';
      modal.scrollTop = 0;
    } catch (error) {
      alert('No se pudo cargar el detalle del lote');
    }
  }

  function initModal() {
    const modal = document.getElementById('modal-ver-lote');
    if (!modal) return;

    if (modal) {
      modal.style.overflowY = 'auto';
      modal.style.webkitOverflowScrolling = 'touch';
    }

    const cerrar = () => { modal.style.display = 'none'; };
    const btnCerrar1 = document.getElementById('btn-cerrar-modal-lote');
    const btnCerrar2 = document.getElementById('btn-cerrar-modal-lote-footer');
    if (btnCerrar1) btnCerrar1.addEventListener('click', cerrar);
    if (btnCerrar2) btnCerrar2.addEventListener('click', cerrar);

    let lastTouchModal = 0;
    const handler = (e) => {
      const now = Date.now();
      if (e.type === 'touchend') { lastTouchModal = now; }
      else if (now - lastTouchModal < 400) { return; }
      if (e.target === modal) cerrar();
    };
    modal.addEventListener('click', handler);
    modal.addEventListener('touchend', handler, { passive: false });
  }

  // ==========================================
  // GUARDAR EVALUACIÓN
  // ==========================================
  function initGuardarEvaluacion() {
    const btn = document.getElementById('btn-def');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const loteId = val('d-lote');
      if (!loteId) return alert('Seleccione un lote.');

      const lote = lotesPendientes.find(l => String(l.id) === String(loteId))
                || todosLosLotes.find(l => String(l.id) === String(loteId));
      if (!lote) return alert('Lote no encontrado.');

      const canastas = parseFloat(document.getElementById('d-canastas')?.value) || 0;
      const tamanoMuestra = parseFloat(document.getElementById('d-tam-muestra')?.value) || 0;
      if (canastas <= 0) return alert('Indique las canastas a revisar.');

      btn.disabled = true;

      try {
        if (evaluacionSeleccionada === 'no') {
          await marcarApto(lote, canastas, tamanoMuestra);
        } else {
          await marcarRetenidoMulti(lote, canastas, tamanoMuestra);
        }
      } finally {
        btn.disabled = false;
      }
    });
  }

  async function marcarApto(lote, canastas, tamanoMuestra) {
    try {
      const obs = val('d-observaciones');
      const response = await fetch(`${API_URL}/defectos/lote/${lote.id}/apto`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ observaciones: obs || null, canastas_inspeccionadas: canastas, tamano_muestra: tamanoMuestra })
      });

      if (!response.ok) throw new Error('Error al marcar APTO');

      mostrarToast(`Lote ${lote.codigo_lote} APTO`);
      await refrescar();
      limpiarFormulario(true);
    } catch (error) {
      alert('Error: ' + error.message);
    }
  }

  async function marcarRetenidoMulti(lote, canastas, tamanoMuestra) {
    if (gruposAgregados.length === 0) return alert('Debe agregar al menos un grupo de piezas con defectos.');

    const obs = val('d-observaciones');
    if (!obs) return alert('Escriba las observaciones generales del lote.');

    const inspector = val('d-inspector');
    const tamanoPoblacion = parseFloat(document.getElementById('d-tam-poblacion')?.value) || 0;
    const botellasCaja = parseFloat(document.getElementById('d-botellas-caja')?.value) || 0;
    const botellasPaleta = parseFloat(document.getElementById('d-botellas-paleta')?.value) || 0;
    const gruesasPaleta = parseFloat(document.getElementById('d-gruesas-paleta')?.value) || 0;

    const payload = [];
    gruposAgregados.forEach((g, gIdx) => {
      const grupoId = `${lote.id}-${Date.now()}-${gIdx}`;

      g.defectos.forEach(d => {
        payload.push({
          lote_id: lote.id,
          codigo_lote: lote.codigo_lote,
          grupo_id: grupoId,
          tipo_defecto: d.tipo,
          clasificacion: d.clase,
          cantidad_piezas: g.piezas,
          zona_deteccion: d.zona || null,
          descripcion: d.desc || null,
          inspector: inspector,
          observaciones: obs,
          resultado_lote: "RETENIDO",
          canastas_inspeccionadas: canastas,
          tamano_muestra: tamanoMuestra,
          tamano_poblacion: tamanoPoblacion,
          botellas_por_caja: botellasCaja,
          botellas_por_paleta: botellasPaleta,
          gruesas_por_paleta: gruesasPaleta
        });
      });
    });

    try {
      if (loteEditando) {
        await fetch(`${API_URL}/defectos/lote/${lote.id}`, { method: 'DELETE', headers: authHeaders() });
      }

      const response = await fetch(`${API_URL}/defectos/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Error al guardar los defectos');

      mostrarToast(`Lote ${lote.codigo_lote} RETENIDO (${gruposAgregados.length} grupo(s), ${payload.length} defectos)`);
      loteEditando = null;
      await refrescar();
      limpiarFormulario(true);

    } catch (error) {
      alert('Error al guardar defectos: ' + error.message);
    }
  }

  async function refrescar() {
    await Promise.all([cargarLotes(), cargarDefectos()]);
  }

  // ==========================================
  // LIMPIAR FORMULARIO
  // ==========================================
  function limpiarFormulario(resetSelect = true) {
    if (resetSelect) {
      const select = document.getElementById('d-lote');
      if (select) select.selectedIndex = 0;
    }
    loteEditando = null;
    bandejaGrupo = [];
    gruposAgregados = [];
    renderBandejaGrupo();
    renderGruposAgregados();

    ['d-piezas-grupo', 'd-zona', 'd-desc', 'd-observaciones', 'd-canastas', 'd-tipo-manual'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    const piezasInput = document.getElementById('d-piezas-grupo');
    if (piezasInput) piezasInput.value = '1';

    ocultarCatalogoTipos();
    setEvaluacion('no');

    const panel = document.getElementById('lote-info-panel');
    if (panel) panel.style.display = 'none';

    const muestraPanel = document.getElementById('muestra-panel');
    if (muestraPanel) muestraPanel.style.display = 'none';

    setText('badge-evaluacion', 'Pendiente');
    const badge = document.getElementById('badge-evaluacion');
    if (badge) badge.className = 'badge badge-info';

    ['d-paletas', 'd-botellas-paleta', 'd-botellas-caja', 'd-tam-muestra', 'd-tam-poblacion', 'd-gruesas-paleta'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = 0;
    });

    actualizarDisplayMuestra();
    
    if (document.getElementById('sugerencia-muestra')) {
      document.getElementById('sugerencia-muestra').innerHTML = 'Calculando muestra sugerida...';
      document.getElementById('sugerencia-muestra').style.color = 'var(--brand-2)';
    }
  }

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================
  function init() {
    initToggleEvaluacion();
    initChipsClasificacion();
    initBuscadorTipos();
    initClickItemsTipos();
    initAgregarTipoManual();
    initLoteSelector();
    initPendientes();
    initSabana();
    initModal();
    initVaciarGrupo();
    initAgregarGrupo();
    initLimpiarEvaluacion();
    initGuardarEvaluacion();

    const btnLimpiar = document.getElementById('btn-def-clear');
    if (btnLimpiar) btnLimpiar.addEventListener('click', () => limpiarFormulario(true));

    renderBandejaGrupo();
    renderGruposAgregados();
    ocultarCatalogoTipos();

    cargarLotes();
    cargarDefectos();
  }

  window.verLote = verLote;
  window.recargarDefectos = refrescar;

  verificarSesion();
})();