/* ==========================================
   VENVIDRIO - PRODUCCIÓN (MoonDRAGO)
   produccion.js - v7 (Lógica completa restaurada)
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

  const VALOR_NUEVO = "__NUEVO__";
  const BOTELLAS_POR_GRUESA = 12;

  let lotes = [];
  let intervaloCarga = null;
  let filtrosActivos = {};
  
  let modoNuevoProducto = false;
  let modoNuevoCliente = false;
  let productosCache = {};

  let geometriaActual = 'cilindrico';
  let timeoutBusqueda = null;

  const MAQUINA_LINEA_MAP = {
    'A1': 'Línea A', 'A2': 'Línea A', 'A3': 'Línea A', 'A4': 'Línea A',
    'B1': 'Línea B', 'B2': 'Línea B', 'B3': 'Línea B', 'B4': 'Línea B',
    'C1': 'Línea C', 'C2': 'Línea C', 'C3': 'Línea C', 'C4': 'Línea C'
  };

  const ESTATUS_CLASES = {
    "100": "estatus-100", "200": "estatus-200", "300": "estatus-300",
    "600": "estatus-600", "910": "estatus-910", "950": "estatus-950", "999": "estatus-999"
  };

  const ESTATUS_LABELS = {
    "100": "100 (Ticket Generado)", "200": "200 (Apto)", "300": "300 (Retenido)",
    "600": "600 (Despachado)", "910": "910 (Decorado)",
    "950": "950 (Reseleccionado)", "999": "999 (Sobrante)"
  };

  const PLANTA_CLASES = {
    "Valera": "planta-valera",
    "Los Guayos": "planta-guayos"
  };

  // ==========================================
  // UTILIDADES
  // ==========================================
  function tokenHeader() { return { 'Authorization': `Bearer ${localStorage.getItem('token')}` }; }
  function jsonHeader() { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }; }
  function obtenerUrlFoto(fotoUrl) {
    if (!fotoUrl) return null;
    if (fotoUrl.startsWith('http')) return fotoUrl;
    return `${API_URL}${fotoUrl}`;
  }
  function parseNumero(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    const n = parseFloat(valor);
    return isNaN(n) ? null : n;
  }
  function formatearNumero(n, decimales = 2) {
    if (n === null || n === undefined || isNaN(n)) return '';
    return Number(n.toFixed(decimales)).toString();
  }

  // ==========================================
  // CONTROL DE SESIÓN
  // ==========================================
  function cargarUsuarioNav() {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
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

        ['navUsername', 'dropdownName'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.textContent = user.nombre || 'Usuario';
        });
        const emailEl = document.getElementById('dropdownEmail');
        if (emailEl) emailEl.textContent = user.correo || 'usuario@email.com';

        const operadorInput = document.getElementById('operador');
        if (operadorInput && !operadorInput.value) {
          operadorInput.value = user.nombre || '';
        }
      } catch (e) { console.error('Error cargando usuario:', e); }
    }
  }

  function mostrarEnlaceUsuarios() {
    const rol = parseInt(localStorage.getItem('role'));
    const link = document.getElementById('navUsuariosLink');
    if (link && rol === 3) link.style.display = 'flex';
  }

  function verificarSesion() {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '../public/login.html'; return; }

    fetch(`${API_URL}/auth/verify`, { headers: tokenHeader() })
      .then(r => { if (!r.ok) throw new Error('Token inválido - Status: ' + r.status); return r.json(); })
      .then(() => {
        cargarUsuarioNav();
        mostrarEnlaceUsuarios();
        try { init(); } catch (e) { console.error('❌ Error en init():', e); }
      })
      .catch((error) => {
        if (error.message && (error.message.includes('Token') || error.message.includes('401'))) {
          localStorage.clear();
          window.location.href = '../public/login.html';
        }
      });
  }

  function initUserControls() {
    const container = document.getElementById('navUserContainer');
    const dropdown = document.getElementById('userDropdown');
    const logoutBtn = document.getElementById('dropdownLogout');

    if (container && dropdown) {
      container.addEventListener('click', function (e) {
        e.stopPropagation();
        dropdown.classList.toggle('show');
      });
    }
    if (dropdown) {
      document.addEventListener('click', () => dropdown.classList.remove('show'));
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') dropdown.classList.remove('show');
      });
    }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
          localStorage.clear();
          window.location.href = '../public/login.html';
        }
      });
    }
  }

  // ==========================================
  // TABS
  // ==========================================
  function inicializarTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const panels = document.querySelectorAll('.tab-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const targetId = tab.getAttribute('data-tab');
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) targetPanel.classList.add('active');
      });
    });
  }

  // ==========================================
  // LOGS
  // ==========================================
  function log(msg, d = null) { console.log(`[${new Date().toLocaleTimeString()}]  ${msg}`, d || ''); }
  function logError(msg, e = null) { console.error(`[${new Date().toLocaleTimeString()}] ❌ ${msg}`, e || ''); }
  function logSuccess(msg, d = null) { console.log(`[${new Date().toLocaleTimeString()}] ✅ ${msg}`, d || ''); }

  // ==========================================
  // CAPACIDAD
  // ==========================================
  function unidadActual() { return document.getElementById('capacidad_unidad')?.value === 'l' ? 'l' : 'ml'; }
  
  function capacidadMlActual() {
    const valor = parseNumero(document.getElementById('capacidad')?.value);
    if (valor === null) return null;
    return unidadActual() === 'l' ? parseFloat((valor * 1000).toFixed(2)) : parseFloat(valor.toFixed(2));
  }

  function escribirCapacidadEnMl(ml) {
    const cap = document.getElementById('capacidad');
    const unidad = document.getElementById('capacidad_unidad');
    const valor = parseNumero(ml);
    if (!cap) return;
    if (valor === null) { cap.value = ''; if (unidad) unidad.value = 'ml'; return; }
    if (unidad && unidad.value === 'l') { cap.value = formatearNumero(valor / 1000, 3); } else { cap.value = formatearNumero(valor, 3); }
  }

  function etiquetaCapacidad(ml, unidad) {
    const valor = parseNumero(ml);
    if (valor === null) return '';
    return unidad === 'l' ? `${formatearNumero(valor / 1000, 3).replace('.', ',')} L` : `${formatearNumero(valor, 3)} ml`;
  }

  function configurarCapacidad() {
    const unidad = document.getElementById('capacidad_unidad');
    const cap = document.getElementById('capacidad');
    if (!unidad || !cap) return;
    unidad.addEventListener('change', () => {
      const valor = parseNumero(cap.value);
      if (valor === null) return;
      cap.value = unidad.value === 'l' ? formatearNumero(valor / 1000, 3) : formatearNumero(valor * 1000, 3);
    });
  }

  // ==========================================
  // GEOMETRÍA Y DIMENSIONES
  // ==========================================
  function cambiarGeometria(tipo) {
    geometriaActual = tipo;
    document.querySelectorAll('.geo-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.geo === tipo));
    const panelCil = document.getElementById('dim-cilindrico');
    const panelRect = document.getElementById('dim-rectangular');
    if (panelCil) panelCil.style.display = tipo === 'cilindrico' ? 'block' : 'none';
    if (panelRect) panelRect.style.display = tipo === 'rectangular' ? 'block' : 'none';
    actualizarPreviewDimensiones();
  }

  function obtenerDimensiones() {
    if (geometriaActual === 'cilindrico') {
      const d = document.getElementById('dim_diametro')?.value?.trim() || '';
      const h = document.getElementById('dim_altura_cil')?.value?.trim() || '';
      if (!d && !h) return null;
      const dFmt = d ? (/cm|mm|pulg/i.test(d) ? d : `${d} cm`) : '';
      const hFmt = h ? (/cm|mm|pulg/i.test(h) ? h : `${h} cm`) : '';
      return `Ø ${dFmt} × H ${hFmt}`.trim();
    } else {
      const l = document.getElementById('dim_largo')?.value?.trim() || '';
      const a = document.getElementById('dim_ancho')?.value?.trim() || '';
      const h = document.getElementById('dim_alto')?.value?.trim() || '';
      if (!l && !a && !h) return null;
      const lFmt = l ? (/cm|mm|pulg/i.test(l) ? l : `${l} cm`) : '';
      const aFmt = a ? (/cm|mm|pulg/i.test(a) ? a : `${a} cm`) : '';
      const hFmt = h ? (/cm|mm|pulg/i.test(h) ? h : `${h} cm`) : '';
      return `L ${lFmt} × A ${aFmt} × H ${hFmt}`.trim();
    }
  }

  function actualizarPreviewDimensiones() {
    const preview = document.getElementById('dim-preview');
    const previewText = document.getElementById('dim-preview-text');
    if (!preview || !previewText) return;
    const dim = obtenerDimensiones();
    if (dim) { previewText.textContent = dim; preview.style.display = 'flex'; } else { preview.style.display = 'none'; }
  }

  function configurarEventosDimensiones() {
    document.querySelectorAll('.geo-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.preventDefault(); cambiarGeometria(btn.dataset.geo); });
    });
    ['dim_diametro', 'dim_altura_cil', 'dim_largo', 'dim_ancho', 'dim_alto'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', actualizarPreviewDimensiones);
    });
    cambiarGeometria('cilindrico');
  }

  function aplicarDimensionesDesdeString(dimensiones) {
    if (!dimensiones || typeof dimensiones !== 'string') return;
    const str = dimensiones.trim();
    if (!str) return;
    const esRectangular = /^L\s/i.test(str) || /^L\d/i.test(str);
    if (esRectangular) {
      cambiarGeometria('rectangular');
      const lMatch = str.match(/L\s*([\d.,]+\s*(?:cm|mm|pulg)?)/i);
      const aMatch = str.match(/A\s*([\d.,]+\s*(?:cm|mm|pulg)?)/i);
      const hMatch = str.match(/H\s*([\d.,]+\s*(?:cm|mm|pulg)?)/i);
      if (document.getElementById('dim_largo') && lMatch) document.getElementById('dim_largo').value = lMatch[1].trim();
      if (document.getElementById('dim_ancho') && aMatch) document.getElementById('dim_ancho').value = aMatch[1].trim();
      if (document.getElementById('dim_alto') && hMatch) document.getElementById('dim_alto').value = hMatch[1].trim();
    } else {
      cambiarGeometria('cilindrico');
      const dMatch = str.match(/[ØDø]\s*([\d.,]+\s*(?:cm|mm|pulg)?)/i);
      const hMatch = str.match(/H\s*([\d.,]+\s*(?:cm|mm|pulg)?)/i);
      if (document.getElementById('dim_diametro') && dMatch) document.getElementById('dim_diametro').value = dMatch[1].trim();
      if (document.getElementById('dim_altura_cil') && hMatch) document.getElementById('dim_altura_cil').value = hMatch[1].trim();
    }
    actualizarPreviewDimensiones();
  }

  // ==========================================
  // PRODUCTOS Y CLIENTES
  // ==========================================
  function activarModoEdicionLibre(activo) {
    const camposTecnicos = ['item', 'acabado', 'material', 'tipo_boca', 'juego_envases', 'capacidad'];
    camposTecnicos.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const fieldWrapper = el.closest('.field-auto');
      if (fieldWrapper) {
        fieldWrapper.classList.toggle('editando', activo);
        fieldWrapper.style.background = activo ? 'transparent' : '';
      }
      if (activo) {
        el.removeAttribute('readonly');
        el.style.background = '#ffffff'; 
        if (el.getAttribute('placeholder') === 'Se carga del producto') el.setAttribute('placeholder', ''); 
      } else {
        el.setAttribute('readonly', 'readonly');
        el.style.background = ''; 
        el.setAttribute('placeholder', 'Se carga del producto'); 
      }
    });
    const fieldDim = document.getElementById('field-dimensiones');
    if (fieldDim) fieldDim.style.display = activo ? 'block' : 'none';
    const aviso = document.getElementById('aviso-nuevo-producto');
    if (aviso) aviso.style.display = activo ? 'flex' : 'none';
    const chkWrap = document.getElementById('guardar-en-catalogo-wrapper');
    if (chkWrap) chkWrap.style.display = activo ? 'block' : 'none';
  }

  function limpiarFichaTecnica() {
    ['item', 'acabado', 'material', 'tipo_boca', 'juego_envases', 'capacidad'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const unidad = document.getElementById('capacidad_unidad'); if (unidad) unidad.value = 'ml';
    ['dim_diametro', 'dim_altura_cil', 'dim_largo', 'dim_ancho', 'dim_alto'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    cambiarGeometria('cilindrico'); actualizarPreviewDimensiones();
  }

  function autocompletarFichaTecnica(producto) {
    if (!producto) return;
    if (document.getElementById('item')) document.getElementById('item').value = producto.item || '';
    if (document.getElementById('acabado')) document.getElementById('acabado').value = producto.acabado || '';
    if (document.getElementById('material')) document.getElementById('material').value = producto.material || '';
    if (document.getElementById('tipo_boca')) document.getElementById('tipo_boca').value = producto.tipo_boca || '';
    if (document.getElementById('juego_envases')) document.getElementById('juego_envases').value = producto.juego_envases || '';
    if (document.getElementById('bpp')) document.getElementById('bpp').value = (producto.bpp !== null && producto.bpp !== undefined) ? producto.bpp : '';
    
    if (document.getElementById('capacidad_unidad')) document.getElementById('capacidad_unidad').value = 'ml';
    escribirCapacidadEnMl(producto.capacidad_ml ?? null);
    if (producto.dimensiones) aplicarDimensionesDesdeString(producto.dimensiones);
    recalcularTodo();
  }

  function toggleNuevoProducto(forzarActivo) {
    modoNuevoProducto = (forzarActivo === true) ? true : !modoNuevoProducto;
    const wrapper = document.getElementById('producto-nuevo-wrapper');
    const input = document.getElementById('producto-nuevo');
    const searchInput = document.getElementById('producto-select');
    const btn = document.getElementById('btn-nuevo-producto');
    const hint = document.getElementById('producto-hint');

    if (modoNuevoProducto) {
      if (wrapper) wrapper.style.display = 'flex';
      if (input) { input.value = ''; input.focus(); }
      if (searchInput) searchInput.disabled = true;
      if (btn) { btn.classList.add('active'); btn.innerHTML = '<i class="ti ti-x"></i> Cancelar'; }
      if (hint) hint.textContent = 'Escriba el nombre del nuevo producto.';
      activarModoEdicionLibre(true);
      document.getElementById('capacidad')?.focus();
    } else {
      if (wrapper) wrapper.style.display = 'none';
      if (input) input.value = '';
      if (searchInput) { searchInput.disabled = false; searchInput.value = ''; }
      if (btn) { btn.classList.remove('active'); btn.innerHTML = '<i class="ti ti-plus"></i> Nuevo'; }
      if (hint) hint.textContent = 'Seleccione un producto o cree uno nuevo';
      activarModoEdicionLibre(false);
      limpiarFichaTecnica();
    }
  }

  function toggleNuevoCliente(forzarActivo) {
    modoNuevoCliente = (forzarActivo === true) ? true : !modoNuevoCliente;
    const wrapper = document.getElementById('cliente-nuevo-wrapper');
    const input = document.getElementById('cliente-nuevo');
    const searchInput = document.getElementById('cliente-select');
    const btn = document.getElementById('btn-nuevo-cliente');

    if (modoNuevoCliente) {
      if (wrapper) wrapper.style.display = 'flex';
      if (input) { input.value = ''; input.focus(); }
      if (searchInput) searchInput.disabled = true;
      if (btn) { btn.classList.add('active'); btn.innerHTML = '<i class="ti ti-x"></i> Cancelar'; }
    } else {
      if (wrapper) wrapper.style.display = 'none';
      if (input) input.value = '';
      if (searchInput) { searchInput.disabled = false; searchInput.value = ''; }
      if (btn) { btn.classList.remove('active'); btn.innerHTML = '<i class="ti ti-plus"></i> Nuevo'; }
    }
  }

  function obtenerProducto() { return modoNuevoProducto ? (document.getElementById('producto-nuevo')?.value?.trim() || '').toUpperCase() : (document.getElementById('producto-select')?.value?.trim() || '').toUpperCase(); }
  function obtenerCliente() { return modoNuevoCliente ? (document.getElementById('cliente-nuevo')?.value?.trim() || '').toUpperCase() : (document.getElementById('cliente-select')?.value?.trim() || '').toUpperCase(); }

  function configurarListenersSelectores() {
    const prodInput = document.getElementById('producto-select');
    if (prodInput) {
      prodInput.addEventListener('change', (e) => {
        const val = e.target.value.trim();
        if (val === VALOR_NUEVO) { if (!modoNuevoProducto) toggleNuevoProducto(true); return; }
        if (modoNuevoProducto) toggleNuevoProducto(false);
        if (!val) { limpiarFichaTecnica(); return; }
        const upperVal = val.toUpperCase();
        const productoEncontrado = Object.entries(productosCache).find(([nombre]) => nombre.toUpperCase() === upperVal);
        if (productoEncontrado) { prodInput.value = productoEncontrado[0]; autocompletarFichaTecnica(productoEncontrado[1]); } else { limpiarFichaTecnica(); }
      });
    }
    const cliInput = document.getElementById('cliente-select');
    if (cliInput) {
      cliInput.addEventListener('change', (e) => {
        const val = e.target.value.trim();
        if (val === VALOR_NUEVO) { if (!modoNuevoCliente) toggleNuevoCliente(true); return; }
        if (modoNuevoCliente) toggleNuevoCliente(false);
        if (val) cliInput.value = val.toUpperCase();
      });
    }
    document.getElementById('btn-cancelar-producto')?.addEventListener('click', (e) => { e.preventDefault(); if (modoNuevoProducto) toggleNuevoProducto(false); });
    document.getElementById('btn-cancelar-cliente')?.addEventListener('click', (e) => { e.preventDefault(); if (modoNuevoCliente) toggleNuevoCliente(false); });
    document.getElementById('btn-nuevo-producto')?.addEventListener('click', (e) => { e.preventDefault(); toggleNuevoProducto(); });
    document.getElementById('btn-nuevo-cliente')?.addEventListener('click', (e) => { e.preventDefault(); toggleNuevoCliente(); });
  }

  // ==========================================
  // GENERACIÓN DE CÓDIGO Y CÁLCULOS
  // ==========================================
  function generarCodigoLoteLocal() {
    const fechaInput = document.getElementById('fecha-prod');
    const maquinaInput = document.getElementById('maquina');
    const loteInput = document.getElementById('lote-id');
    if (!fechaInput || !maquinaInput || !loteInput) return;
    const fecha = fechaInput.value; const maquina = (maquinaInput.value || '').trim();
    if (!fecha || !maquina) { loteInput.value = ''; return; }
    loteInput.value = `${fecha.replace(/-/g, '')}${maquina.replace(/\s+/g, '').toUpperCase()}`;
  }

  function configurarGeneracionCodigo() {
    document.getElementById('fecha-prod')?.addEventListener('change', generarCodigoLoteLocal);
    document.getElementById('maquina')?.addEventListener('change', () => { generarCodigoLoteLocal(); autocompletarLineaPorMaquina(); });
    generarCodigoLoteLocal();
  }

  function autocompletarLineaPorMaquina() {
    const maquina = document.getElementById('maquina')?.value || '';
    const lineaEl = document.getElementById('linea');
    if (lineaEl && maquina && MAQUINA_LINEA_MAP[maquina]) lineaEl.value = MAQUINA_LINEA_MAP[maquina];
  }

  function recalcularTodo() {
    const cantidad = parseNumero(document.getElementById('cantidad')?.value);
    const bpp = parseNumero(document.getElementById('bpp')?.value);
    const bpc = parseNumero(document.getElementById('bpc')?.value);
    const paletasEl = document.getElementById('paletas');
    const cajasEl = document.getElementById('cajas_producidas');
    const gruesasEl = document.getElementById('gruesas');
    const gruesasPaletaEl = document.getElementById('gruesas_paleta');

    if (cantidad && bpp && bpp > 0 && paletasEl) paletasEl.value = formatearNumero(cantidad / bpp, 2); else if (paletasEl) paletasEl.value = '';
    if (cantidad && bpc && bpc > 0 && cajasEl) cajasEl.value = formatearNumero(cantidad / bpc, 2); else if (cajasEl) cajasEl.value = '';
    if (cantidad && gruesasEl) gruesasEl.value = formatearNumero(cantidad / BOTELLAS_POR_GRUESA, 2); else if (gruesasEl) gruesasEl.value = '';
    if (bpp && bpp > 0 && gruesasPaletaEl) gruesasPaletaEl.value = formatearNumero(bpp / BOTELLAS_POR_GRUESA, 2); else if (gruesasPaletaEl) gruesasPaletaEl.value = '';
  }

  function configurarAutoCalculos() {
    ['cantidad', 'bpp', 'bpc'].forEach(id => document.getElementById(id)?.addEventListener('input', recalcularTodo));
  }

  // ==========================================
  // CARGA DE DATOS
  // ==========================================
  function mostrarSkeleton() {
    ['cnt-lotes', 'cnt-unidades', 'cnt-eficiencia', 'cnt-rechazos'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<span class="skeleton"></span>`;
    });
  }

  function actualizarTimestamp() {
    const el = document.getElementById('ultima-actualizacion');
    if (el) el.textContent = new Date().toLocaleTimeString();
  }

  async function cargarProduccion(filtros = {}) {
    try {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([k, v]) => { if (v) params.append(k, v); });
      const url = `${API_URL}/produccion?${params.toString()}&t=${Date.now()}`;
      const response = await fetch(url, { headers: tokenHeader() });
      if (!response.ok) { if (response.status === 401) { window.location.href = '../public/login.html'; return; } throw new Error(`Error ${response.status}`); }
      const data = await response.json();

      lotes = data.map(p => ({
        id: p.id, codigo: p.codigo_lote, ticket_carga: p.ticket_carga || '—', prod: p.tipo_producto, molde: p.molde || p.tipo_producto,
        item: p.item || '—', acabado: p.acabado || '—', material: p.material || '', tipo_boca: p.tipo_boca || '', maquina: p.maquina || '—',
        grupo: p.grupo || '—', bpp: p.bpp || 0, bpc: p.bot_por_caja || p.bpc || 0, cajas_producidas: p.cajas_producidas || 0,
        capacidad_ml: p.capacidad_ml ?? p.capacidad ?? null, unidad_capacidad: (p.unidad_capacidad === 'l' || p.unidad_capacidad === 'L') ? 'l' : 'ml',
        orden: p.orden || '—', linea: p.linea_produccion, planta: p.planta || 'Valera', op: p.operador, uds: p.cantidad, turno: p.turno,
        paletas: p.paletas || 0, gruesas: p.gruesas || 0, juego_envases: p.juego_envases || '', tamano_muestra: p.tamano_muestra || '',
        bot_por_canada: p.bot_por_canada || 0, bot_por_paleta: p.bot_por_paleta || 0, gruesas_por_paleta: p.gruesas_por_paleta || 0,
        cliente: p.cliente || 'Sin asignar', estatus: p.estatus || '100', estado_auditoria: p.estado_auditoria || 'Pendiente',
        observaciones: p.observaciones || '', fecha_prod: p.fecha_produccion || '',
        fecha: new Date(p.fecha_registro).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      }));

      actualizarKPIs(lotes);
      renderTabla();
      actualizarTimestamp();

      const resultadoEl = document.getElementById('filtro-resultados');
      if (resultadoEl) {
        const filtrosActivosCount = Object.values(filtros).filter(v => v).length;
        resultadoEl.textContent = filtrosActivosCount > 0 ? `🔍 Filtros aplicados: ${filtrosActivosCount} | ${data.length} resultados` : ` Mostrando ${data.length} lotes`;
      }
    } catch (error) {
      console.error('Error cargando producción:', error);
      mostrarError();
    }
  }

  function actualizarKPIs(lotesData) {
    const totalLotes = lotesData.length;
    const totalUnidades = lotesData.reduce((sum, l) => sum + (l.uds || 0), 0);
    const totalPendientes = lotesData.filter(l => l.estado_auditoria === 'Pendiente').length;
    const pctPendientes = totalLotes > 0 ? Math.round((totalPendientes / totalLotes) * 100) : 0;

    const kpis = [
      { id: 'cnt-lotes', valor: totalLotes, formato: 'numero', sub: `${totalLotes} lotes registrados` },
      { id: 'cnt-unidades', valor: totalUnidades, formato: 'numero', sub: `${totalUnidades.toLocaleString()} unidades totales` },
      { id: 'cnt-eficiencia', valor: calcularEficiencia(lotesData), formato: 'porcentaje', sub: 'Promedio general' },
      { id: 'cnt-rechazos', valor: totalPendientes, formato: 'numero', sub: `${pctPendientes}% pendientes` }
    ];

    kpis.forEach(kpi => {
      const el = document.getElementById(kpi.id);
      if (!el) return;
      el.innerHTML = kpi.formato === 'porcentaje' ? `${kpi.valor}%` : kpi.valor.toLocaleString();
      const card = el.closest('.stat-card');
      if (card) { const subEl = card.querySelector('.stat-sub'); if (subEl) subEl.textContent = kpi.sub; }
    });
  }

  function calcularEficiencia(lotesData) {
    if (lotesData.length === 0) return 0;
    const totalUnidades = lotesData.reduce((sum, l) => sum + (l.uds || 0), 0);
    return Math.min(Math.round(((totalUnidades / lotesData.length) / 100) * 100), 100);
  }

  // ==========================================
  // MODAL Y TABLA
  // ==========================================
  function setTexto(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = (valor !== null && valor !== undefined && valor !== '') ? valor : '—';
  }

  function formatearFechaProd(fechaStr) {
    if (!fechaStr) return '—';
    try { const d = new Date(fechaStr + 'T00:00:00'); return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (e) { return fechaStr; }
  }

  window.verLote = function (id) {
    const lote = lotes.find(l => l.id === id);
    if (!lote) return;

    setTexto('modal-lote-codigo', lote.codigo);
    setTexto('detail-planta', lote.planta);
    setTexto('detail-fecha', formatearFechaProd(lote.fecha_prod));
    setTexto('detail-turno', lote.turno);
    setTexto('detail-producto', lote.prod);
    setTexto('detail-item', lote.item);
    setTexto('detail-material', lote.material);
    setTexto('detail-tipo-boca', lote.tipo_boca);
    setTexto('detail-capacidad', etiquetaCapacidad(lote.capacidad_ml, lote.unidad_capacidad));
    setTexto('detail-bpp', lote.bpp);
    setTexto('detail-acabado', lote.acabado);
    setTexto('detail-juego-envases', lote.juego_envases);
    
    let dimensionesMostrar = '—';
    if (productosCache[lote.prod] && productosCache[lote.prod].dimensiones) dimensionesMostrar = productosCache[lote.prod].dimensiones;
    else if (lote.tamano_muestra && typeof lote.tamano_muestra === 'string' && lote.tamano_muestra.includes('cm')) dimensionesMostrar = lote.tamano_muestra;
    setTexto('detail-dimensiones', dimensionesMostrar);

    let bpcMostrar = lote.bpc || lote.bot_por_canada || 0;
    if (bpcMostrar === 0 && productosCache[lote.prod]) bpcMostrar = productosCache[lote.prod].bpc || 0;
    setTexto('detail-bpc', bpcMostrar || '—');
    setTexto('detail-maquina', lote.maquina);
    setTexto('detail-linea', lote.linea);
    setTexto('detail-molde', lote.molde);
    setTexto('detail-grupo', lote.grupo);
    setTexto('detail-operador', lote.op);
    setTexto('detail-orden', lote.orden);
    setTexto('detail-ticket', lote.ticket_carga);
    setTexto('detail-cantidad', lote.uds ? lote.uds.toLocaleString() : '—');
    setTexto('detail-paletas', lote.paletas);

    let cajasMostrar = '—';
    if (lote.cajas_producidas > 0) cajasMostrar = formatearNumero(lote.cajas_producidas, 2);
    else if (lote.uds > 0 && bpcMostrar > 0) cajasMostrar = formatearNumero(lote.uds / bpcMostrar, 2);
    setTexto('detail-cajas', cajasMostrar);

    setTexto('detail-gruesas', lote.gruesas);
    setTexto('detail-gruesas-paleta', lote.gruesas_por_paleta);
    setTexto('detail-cliente', lote.cliente);
    setTexto('detail-estatus', ESTATUS_LABELS[lote.estatus] || lote.estatus);
    
    let estadoAuditoria = lote.estado_auditoria || 'Pendiente';
    if (lote.estatus === '200' || lote.estatus === '300') estadoAuditoria = 'Evaluado por Calidad';
    setTexto('detail-estado-auditoria', estadoAuditoria);
    setTexto('detail-observaciones', lote.observaciones);

    document.getElementById('modal-ver-lote').style.display = 'flex';
  };

  function configurarModalLote() {
    document.getElementById('btn-cerrar-modal-lote')?.addEventListener('click', () => document.getElementById('modal-ver-lote').style.display = 'none');
    document.getElementById('btn-cerrar-modal-lote-footer')?.addEventListener('click', () => document.getElementById('modal-ver-lote').style.display = 'none');
    document.getElementById('modal-ver-lote')?.addEventListener('click', (e) => { if (e.target.id === 'modal-ver-lote') e.target.style.display = 'none'; });
  }

  function renderTabla(filtro = '') {
    const tbody = document.getElementById('tabla-lotes');
    if (!tbody) return;

    const data = filtro ? lotes.filter(l => l.codigo.toLowerCase().includes(filtro) || l.ticket_carga.toLowerCase().includes(filtro) || (l.prod || '').toLowerCase().includes(filtro) || (l.linea || '').toLowerCase().includes(filtro) || (l.op || '').toLowerCase().includes(filtro) || (l.cliente || '').toLowerCase().includes(filtro)) : lotes;
    tbody.innerHTML = '';

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="14" style="text-align:center;padding:2rem;color:var(--text-muted)"><i class="ti ti-inbox" style="font-size:1.5rem;margin-right:0.5rem"></i> No hay lotes registrados</td></tr>`;
      return;
    }

    data.forEach((l, i) => {
      const tr = document.createElement('tr');
      tr.style.animationDelay = `${0.04 * i}s`;
      const estatusClass = ESTATUS_CLASES[l.estatus] || 'estatus-100';
      const plantaClass = PLANTA_CLASES[l.planta] || 'planta-valera';
      const estatusTexto = ESTATUS_LABELS[l.estatus] || l.estatus;
      const capacidadTexto = etiquetaCapacidad(l.capacidad_ml, l.unidad_capacidad);

      tr.innerHTML = `
        <td class="font-mono" style="font-size:12px"><span class="badge badge-info">${l.codigo}</span></td>
        <td style="font-family:'Courier New',monospace;font-size:11px">${l.ticket_carga}</td>
        <td><span class="planta-badge ${plantaClass}">${l.planta}</span></td>
        <td>${l.molde}</td>
        <td>${l.maquina}</td>
        <td>${l.linea}</td>
        <td>${l.op}</td>
        <td style="text-align:center"><span class="cell-capacidad">${capacidadTexto || '—'}</span></td>
        <td style="text-align:center">${l.uds}</td>
        <td><span class="badge badge-info">${l.turno}</span></td>
        <td style="text-align:center"><span class="estatus-badge ${estatusClass}">${estatusTexto}</span></td>
        <td><span style="display:block;font-weight:600;color:var(--navy);">${l.cliente}</span></td>
        <td class="text-muted text-sm">${l.fecha}</td>
        <td><div style="display:flex;gap:4px;justify-content:center;"><button type="button" class="btn btn-primary btn-xs" onclick="verLote(${l.id})"><i class="ti ti-eye"></i></button><button type="button" class="btn btn-danger btn-xs" onclick="eliminarLote(${l.id})"><i class="ti ti-trash"></i></button></div></td>
      `;
      tbody.appendChild(tr);
    });
  }

  window.eliminarLote = async function (id) {
    if (!confirm('¿Estás seguro de eliminar este lote?')) return;
    try {
      const response = await fetch(`${API_URL}/produccion/${id}`, { method: 'DELETE', headers: tokenHeader() });
      if (!response.ok) throw new Error('Error al eliminar');
      await cargarProduccion(filtrosActivos);
      generarCodigoLoteLocal();
      const toast = document.getElementById('toast-prod');
      if (toast) { toast.textContent = '✅ Lote eliminado'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); }
    } catch (error) { alert('No se pudo eliminar el lote'); }
  };

  // ==========================================
  // ESCÁNER: CONEXIÓN CON EL MÓDULO
  // ==========================================
  function initEscanerGlobal() {
    // 1. Inicializar la UI del escáner con los IDs del HTML
    EscanerApp.init(
      'reader-container-global', 
      'btn-escanear-global', 
      'btn-cerrar-camara-global', 
      'reader-global'
    );

    // 2. Definir qué hacer cuando se lea un código
    EscanerApp.onScanSuccess(async (codigoEscaneado) => {
      try {
        const response = await fetch(`${API_URL}/escaner/buscar/${encodeURIComponent(codigoEscaneado)}`, { headers: tokenHeader() });

        if (response.ok) {
          const lote = await response.json();

          // Llenar Contexto
          document.getElementById('planta').value = lote.planta || '';
          document.getElementById('turno').value = lote.turno || '';
          if (lote.fecha_produccion) document.getElementById('fecha-prod').value = lote.fecha_produccion.split('T')[0];

          // Llenar Producto
          const prodSelect = document.getElementById('producto-select');
          if (prodSelect && lote.tipo_producto) {
            const match = Array.from(prodSelect.options).find(o => o.value.toUpperCase() === lote.tipo_producto.toUpperCase());
            if (match) { prodSelect.value = match.value; prodSelect.dispatchEvent(new Event('change')); }
          }
          document.getElementById('molde').value = lote.molde || '';
          const cliSelect = document.getElementById('cliente-select');
          if (cliSelect && lote.cliente) {
            const matchCli = Array.from(cliSelect.options).find(o => o.value.toUpperCase() === lote.cliente.toUpperCase());
            if (matchCli) cliSelect.value = matchCli.value;
          }
          document.getElementById('bpp').value = lote.bpp || '';
          document.getElementById('bpc').value = lote.bpc || lote.bot_por_canada || '';

          // Llenar Trazabilidad
          document.getElementById('maquina').value = lote.maquina || '';
          document.getElementById('ticket_carga').value = lote.ticket_carga || codigoEscaneado;
          document.getElementById('grupo').value = lote.grupo || '';
          document.getElementById('linea').value = lote.linea_produccion || '';
          document.getElementById('operador').value = lote.operador || '';
          document.getElementById('orden').value = lote.orden || '';

          // Llenar Cantidades
          document.getElementById('cantidad').value = lote.cantidad || '';
          document.getElementById('paletas').value = lote.paletas || '';
          document.getElementById('cajas_producidas').value = lote.cajas_producidas || '';
          document.getElementById('gruesas').value = lote.gruesas || '';
          document.getElementById('gruesas_paleta').value = lote.gruesas_por_paleta || '';
          document.getElementById('obs-prod').value = lote.observaciones || '';

          document.getElementById('maquina').dispatchEvent(new Event('change'));
          document.getElementById('fecha-prod').dispatchEvent(new Event('change'));

          const tabContexto = document.querySelector('[data-tab="tab-contexto"]');
          if (tabContexto) tabContexto.click();

          alert(`✅ Lote ${lote.codigo_lote} encontrado y autocompletado.`);
        } else if (response.status === 404) {
          document.getElementById('ticket_carga').value = codigoEscaneado;
          const tabTrazabilidad = document.querySelector('[data-tab="tab-trazabilidad"]');
          if (tabTrazabilidad) tabTrazabilidad.click();
          alert(`Ticket ${codigoEscaneado} no encontrado. Complete los datos.`);
        }
      } catch (error) {
        console.error("Error buscando lote escaneado:", error);
        alert("Error de conexión al buscar el lote.");
      }
    });
  }

  // ==========================================
  // REGISTRAR
  // ==========================================
  function initFormularioRegistro() {
    const btnRegistrar = document.getElementById('btn-registrar');
    if (btnRegistrar) {
      btnRegistrar.addEventListener('click', async (e) => {
        e.preventDefault();

        const ticket_carga = document.getElementById('ticket_carga').value.trim();
        const planta = document.getElementById('planta').value;
        const maquina = document.getElementById('maquina').value;
        const turno = document.getElementById('turno').value; 
        const grupo = document.getElementById('grupo').value.trim();
        const linea = document.getElementById('linea').value.trim();
        const operador = document.getElementById('operador').value.trim();
        const orden = document.getElementById('orden').value.trim();
        const acabado = document.getElementById('acabado').value.trim();
        const item = document.getElementById('item').value.trim();
        const material = document.getElementById('material')?.value?.trim() || '';
        const tipo_boca = document.getElementById('tipo_boca')?.value?.trim() || '';
        const molde = document.getElementById('molde').value.trim();
        const bpp = document.getElementById('bpp').value;
        const bpc = document.getElementById('bpc')?.value;
        const capacidadValor = parseNumero(document.getElementById('capacidad')?.value);
        const capacidadUnidad = unidadActual();
        const capacidadMl = capacidadMlActual();
        const cant = document.getElementById('cantidad').value;
        const paletas = document.getElementById('paletas').value;
        const cajas_producidas = document.getElementById('cajas_producidas').value;
        const gruesas = document.getElementById('gruesas').value;
        const gruesas_paleta = document.getElementById('gruesas_paleta').value;
        const fecha = document.getElementById('fecha-prod').value;
        const estatus = document.getElementById('estatus').value;
        const observaciones = document.getElementById('obs-prod').value.trim();

        const prod = obtenerProducto();
        const cliente = obtenerCliente();
        const juego_envases = document.getElementById('juego_envases')?.value?.trim() || null;
        const dimensiones = obtenerDimensiones();
        const guardarEnCatalogo = document.getElementById('guardar-en-catalogo')?.checked || false;

        if (!planta) { alert('Selecciona una planta.'); return; }
        if (!maquina) { alert('Selecciona una máquina.'); return; }
        if (!turno) { alert('Selecciona un turno.'); return; }
        if (!operador) { alert('Ingresa el operador.'); return; }
        if (!molde) { alert('Ingresa el molde.'); return; }
        if (!prod) { alert('Selecciona o crea un producto.'); return; }
        if (!cliente) { alert('Selecciona o crea un cliente.'); return; }
        if (!cant || parseInt(cant) <= 0) { alert('La cantidad debe ser mayor a 0.'); return; }
        if (capacidadValor !== null && capacidadValor <= 0) { alert('El volumen debe ser mayor a 0.'); return; }

        const body = {
          ticket_carga: ticket_carga || null,
          planta: planta,
          maquina: maquina || null,
          turno: turno,
          grupo: grupo || null,
          linea_produccion: linea || null,
          operador: operador,
          orden: orden || null,
          tipo_producto: prod,
          acabado: acabado || null,
          material: material || null,
          tipo_boca: tipo_boca || null,
          item: item || null,
          molde: molde || null,
          bpp: bpp ? parseFloat(bpp) : null,
          bpc: bpc ? parseInt(bpc) : null,
          capacidad: capacidadMl,
          capacidad_ml: capacidadMl,
          unidad_capacidad: capacidadUnidad,
          cantidad: parseInt(cant) || 0,
          paletas: paletas ? parseFloat(paletas) : null,
          cajas_producidas: cajas_producidas ? parseFloat(cajas_producidas) : null,
          gruesas: gruesas ? parseFloat(gruesas) : null,
          juego_envases: juego_envases,
          tamano_muestra: dimensiones,
          bot_por_canada: bpc ? parseInt(bpc) : null,
          bot_por_paleta: bpp ? parseFloat(bpp) : null,
          gruesas_por_paleta: gruesas_paleta ? parseFloat(gruesas_paleta) : null,
          cliente: cliente,
          estatus: estatus,
          observaciones: observaciones || null
        };

        if (fecha) body.fecha_produccion = fecha;

        try {
          if (modoNuevoProducto && prod && guardarEnCatalogo) {
            const productBody = { nombre: prod, item: item || null, acabado: acabado || null, capacidad_ml: capacidadMl !== null ? Math.round(capacidadMl) : null, bpp: bpp ? parseFloat(bpp) : null, bpc: bpc ? parseInt(bpc) : null, juego_envases: juego_envases || null, material: material || null, tipo_boca: tipo_boca || null, dimensiones: dimensiones || null };
            const resProd = await fetch(`${API_URL}/productos`, { method: 'POST', headers: jsonHeader(), body: JSON.stringify(productBody) });
            if (!resProd.ok) {
              const err = await resProd.json().catch(() => ({}));
              if (resProd.status === 400 || resProd.status === 409) alert(`El producto "${prod}" ya existe. Se guardará el lote igual.`);
              else throw new Error(err.detail || `Error ${resProd.status} guardando producto`);
            }
          }

          if (modoNuevoCliente && cliente) {
            const resCli = await fetch(`${API_URL}/clientes`, { method: 'POST', headers: jsonHeader(), body: JSON.stringify({ nombre: cliente }) });
            if (!resCli.ok) {
              const err = await resCli.json().catch(() => ({}));
              if (resCli.status === 400 || resCli.status === 409) alert(`El cliente "${cliente}" ya existe. Se guardará el lote igual.`);
              else throw new Error(err.detail || `Error ${resCli.status} guardando cliente`);
            }
          }

          const response = await fetch(`${API_URL}/produccion`, { method: 'POST', headers: jsonHeader(), body: JSON.stringify(body) });
          if (!response.ok) {
            if (response.status === 401) { window.location.href = '../public/login.html'; return; }
            const errorData = await response.json().catch(() => ({}));
            let errorMsg = errorData.detail || `Error ${response.status} guardando lote`;
            if (Array.isArray(errorMsg)) errorMsg = errorMsg.map(err => `${err.loc.join('.')}: ${err.msg}`).join('\n');
            throw new Error(errorMsg);
          }

          await cargarProductosYClientes();
          await cargarOpcionesRegistradas();
          await cargarProduccion(filtrosActivos);

          if (modoNuevoProducto && prod) {
            const sp = document.getElementById('producto-select');
            if (sp) { const match = Array.from(sp.options).find(o => o.value.toUpperCase() === prod.toUpperCase()); if (match) sp.value = match.value; }
          }
          if (modoNuevoCliente && cliente) {
            const sc = document.getElementById('cliente-select');
            if (sc) { const match = Array.from(sc.options).find(o => o.value.toUpperCase() === cliente.toUpperCase()); if (match) sc.value = match.value; }
          }

          const toast = document.getElementById('toast-prod');
          if (toast) { toast.textContent = '✅ Lote registrado correctamente'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); }

          document.getElementById('btn-limpiar').click();

        } catch (error) {
          logError('Error registrando producción:', error);
          alert(error.message || 'No se pudo registrar la producción');
        }
      });
    }
  }

  // ==========================================
  // LIMPIAR
  // ==========================================
  function initLimpiar() {
    const btnLimpiar = document.getElementById('btn-limpiar');
    if (!btnLimpiar) return;
    btnLimpiar.addEventListener('click', async (e) => {
      e.preventDefault();

      const campos = ['ticket_carga', 'grupo', 'linea', 'orden', 'acabado', 'item', 'material', 'tipo_boca', 'molde', 'bpp', 'bpc', 'cantidad', 'paletas', 'cajas_producidas', 'gruesas', 'juego_envases', 'capacidad', 'dim_diametro', 'dim_altura_cil', 'dim_largo', 'dim_ancho', 'dim_alto', 'gruesas_paleta', 'obs-prod'];

      campos.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      ['planta', 'maquina', 'turno'].forEach(id => { const el = document.getElementById(id); if (el) el.selectedIndex = 0; });

      const unidad = document.getElementById('capacidad_unidad'); if (unidad) unidad.value = 'ml';
      const estatusEl = document.getElementById('estatus'); if (estatusEl) estatusEl.value = '100';

      const prodSelect = document.getElementById('producto-select'); if (prodSelect) prodSelect.value = '';
      if (modoNuevoProducto) toggleNuevoProducto(false);

      const cliSelect = document.getElementById('cliente-select'); if (cliSelect) cliSelect.value = '';
      if (modoNuevoCliente) toggleNuevoCliente(false);

      const chk = document.getElementById('guardar-en-catalogo'); if (chk) chk.checked = true;
      const fechaInput = document.getElementById('fecha-prod'); if (fechaInput) fechaInput.value = new Date().toISOString().split('T')[0];

      activarModoEdicionLibre(false);
      limpiarFichaTecnica();
      generarCodigoLoteLocal();
      recalcularTodo();
    });
  }

  // ==========================================
  // CARGAR PRODUCTOS Y CLIENTES
  // ==========================================
  async function cargarProductosYClientes() {
    try {
      const resProd = await fetch(`${API_URL}/productos`, { headers: tokenHeader() });
      const selectProd = document.getElementById('producto-select');
      if (resProd.ok && selectProd) {
        const productos = await resProd.json();
        const valorActual = selectProd.value;
        productosCache = {};
        productos.forEach(p => { productosCache[p.nombre] = p; });

        selectProd.innerHTML = '<option value="">-- Seleccione un producto --</option>';
        productos.forEach(p => {
          const cap = etiquetaCapacidad(p.capacidad_ml, 'ml');
          const opt = document.createElement('option');
          opt.value = p.nombre;
          opt.textContent = p.nombre + (cap ? ` (${cap})` : '');
          selectProd.appendChild(opt);
        });

        const optNuevo = document.createElement('option');
        optNuevo.value = VALOR_NUEVO;
        optNuevo.className = 'option-nuevo';
        optNuevo.textContent = '➕ Registrar nuevo producto / Prototipo';
        selectProd.appendChild(optNuevo);
        if (valorActual) selectProd.value = valorActual;
      }
    } catch (e) { logError('Error de red cargando productos:', e); }

    try {
      const resCli = await fetch(`${API_URL}/clientes`, { headers: tokenHeader() });
      const selectCli = document.getElementById('cliente-select');
      if (resCli.ok && selectCli) {
        const clientes = await resCli.json();
        const valorActual = selectCli.value;
        selectCli.innerHTML = '<option value="">-- Seleccione un cliente --</option>';
        clientes.forEach(c => {
          if (!c.nombre) return;
          const opt = document.createElement('option');
          opt.value = c.nombre;
          opt.textContent = c.nombre;
          selectCli.appendChild(opt);
        });
        const optNuevoCli = document.createElement('option');
        optNuevoCli.value = VALOR_NUEVO;
        optNuevoCli.className = 'option-nuevo';
        optNuevoCli.textContent = '➕ Registrar nuevo cliente';
        selectCli.appendChild(optNuevoCli);
        if (valorActual) selectCli.value = valorActual;
      }
    } catch (e) { logError('Error de red cargando clientes:', e); }
  }

  // ==========================================
  // FILTROS
  // ==========================================
  function aplicarFiltros() {
    filtrosActivos = {
      codigo: document.getElementById('filtro-codigo')?.value.trim() || '',
      ticket: document.getElementById('filtro-ticket')?.value.trim() || '',
      molde: document.getElementById('filtro-molde')?.value.trim() || '',
      maquina: document.getElementById('filtro-maquina')?.value.trim() || '',
      operador: document.getElementById('filtro-operador')?.value.trim() || '',
      turno: document.getElementById('filtro-turno')?.value || '',
      estatus: document.getElementById('filtro-estatus')?.value || '',
      fecha_desde: document.getElementById('filtro-fecha-desde')?.value || '',
      fecha_hasta: document.getElementById('filtro-fecha-hasta')?.value || ''
    };
    cargarProduccion(filtrosActivos);
  }

  function limpiarFiltros() {
    ['filtro-codigo', 'filtro-ticket', 'filtro-molde', 'filtro-maquina', 'filtro-operador', 'filtro-fecha-desde', 'filtro-fecha-hasta', 'buscar-lote'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    ['filtro-turno', 'filtro-estatus'].forEach(id => {
      const el = document.getElementById(id); if (el) el.selectedIndex = 0;
    });
    filtrosActivos = {};
    cargarProduccion({});
  }

  // ==========================================
  // OPCIONES
  // ==========================================
  async function cargarOpcionesRegistradas() {
    try {
      const response = await fetch(`${API_URL}/produccion/opciones`, { headers: tokenHeader() });
      if (!response.ok) throw new Error('Error cargando opciones');
      const data = await response.json();

      const datalists = [
        { id: 'lista-lineas', opciones: data.lineas || [] },
        { id: 'lista-maquinas', opciones: data.maquinas || [] },
        { id: 'lista-operadores', opciones: data.operadores || [] },
        { id: 'lista-items', opciones: data.items || [] },
        { id: 'lista-moldes', opciones: data.moldes || [] },
        { id: 'lista-acabados', opciones: data.acabados || [] },
        { id: 'lista-grupos', opciones: data.grupos || [] },
        { id: 'lista-ordenes', opciones: data.ordenes || [] },
        { id: 'filtro-lista-moldes', opciones: data.moldes || [] },
        { id: 'filtro-lista-maquinas', opciones: data.maquinas || [] },
        { id: 'filtro-lista-operadores', opciones: data.operadores || [] }
      ];

      datalists.forEach(({ id, opciones }) => {
        const datalist = document.getElementById(id);
        if (!datalist) return;
        datalist.innerHTML = '';
        [...new Set(opciones)].sort().forEach(val => {
          if (val) { const opt = document.createElement('option'); opt.value = val; datalist.appendChild(opt); }
        });
      });
    } catch (error) { logError('Error cargando opciones registradas:', error); }
  }

  // ==========================================
  // BUSCADOR
  // ==========================================
  const buscar = document.getElementById('buscar-lote');
  if (buscar) {
    buscar.addEventListener('input', e => {
      clearTimeout(timeoutBusqueda);
      timeoutBusqueda = setTimeout(() => { renderTabla(e.target.value.toLowerCase().trim()); }, 300);
    });
  }

  // ==========================================
  // RECARGAR Y ERROR
  // ==========================================
  window.recargarProduccion = function () {
    cargarProduccion(filtrosActivos);
    cargarOpcionesRegistradas();
    cargarProductosYClientes();
    generarCodigoLoteLocal();
  };

  function mostrarError() {
    const tbody = document.getElementById('tabla-lotes');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="14" style="text-align:center;padding:2rem;color:var(--text-muted)"><i class="ti ti-alert-circle" style="font-size:1.5rem;margin-right:0.5rem"></i> Error al cargar datos. Verifica que el servidor esté corriendo en ${API_URL}</td></tr>`;
    }
  }

  // ==========================================
  // INICIALIZACIÓN GENERAL
  // ==========================================
  function init() {
    mostrarSkeleton();
    cargarOpcionesRegistradas();
    cargarProductosYClientes();
    inicializarTabs();
    configurarGeneracionCodigo();
    configurarAutoCalculos();
    configurarCapacidad();
    configurarListenersSelectores();
    configurarEventosDimensiones();
    configurarModalLote();
    
    // Iniciar Escáner, Formulario y Limpiar
    initEscanerGlobal(); 
    initFormularioRegistro();
    initLimpiar();

    toggleNuevoProducto(false);
    toggleNuevoCliente(false);
    activarModoEdicionLibre(false);

    const fechaInput = document.getElementById('fecha-prod');
    if (fechaInput) fechaInput.value = new Date().toISOString().split('T')[0];

    const selectorMes = document.getElementById('selector-mes');
    if (selectorMes) {
      const hoy = new Date();
      const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
      selectorMes.value = mesActual;
    }

    document.getElementById('btn-aplicar-mes')?.addEventListener('click', (e) => {
      e.preventDefault();
      const mes = document.getElementById('selector-mes')?.value || '';
      if (!mes) { alert('Selecciona un mes'); return; }
      const [year, month] = mes.split('-');
      const ultimoDia = new Date(parseInt(year), parseInt(month), 0).getDate();
      const desdeEl = document.getElementById('filtro-fecha-desde');
      const hastaEl = document.getElementById('filtro-fecha-hasta');
      if (desdeEl) desdeEl.value = `${mes}-01`;
      if (hastaEl) hastaEl.value = `${mes}-${String(ultimoDia).padStart(2, '0')}`;
      aplicarFiltros();
    });

    document.getElementById('btn-aplicar-filtros')?.addEventListener('click', (e) => { e.preventDefault(); aplicarFiltros(); });
    document.getElementById('btn-limpiar-filtros')?.addEventListener('click', (e) => { e.preventDefault(); limpiarFiltros(); });
    document.getElementById('filtro-codigo')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); aplicarFiltros(); } });

    cargarProduccion({});

    if (intervaloCarga) clearInterval(intervaloCarga);
    intervaloCarga = setInterval(() => cargarProduccion(filtrosActivos), 30000);

    initUserControls();
  }

  verificarSesion();

})();