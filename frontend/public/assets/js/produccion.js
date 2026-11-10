/* ==========================================
   VENVIDRIO - PRODUCCIÓN (MoonDRAGO)
   produccion.js - v30 (Hora automática del sistema + Turnos)
   ========================================== */

(function () {
  'use strict';

  const hostname = window.location.hostname;
  let API_URL;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    API_URL = 'http://127.0.0.1:8000';
  } else {
    API_URL = 'https://calidad-venvidrio-repository-main.onrender.com';
  }

  const VALOR_NUEVO = "__NUEVO__";
  
  const BOTELLAS_POR_GRUESA = 144;  // 12 docenas = 144 botellas
  const BOTELLAS_POR_DOCENA = 12;   // 1 docena

  // 👇 Mapeo de turnos para mostrar texto legible
  const TURNOS_MAP = {
    '1': 'Matutino',
    '2': 'Vespertino',
    '3': 'Nocturno'
  };

  let lotes = [];
  let intervaloCarga = null;
  let filtrosActivos = {};
  
  let modoNuevoProducto = false;
  let modoNuevoCliente = false;
  let productosCache = {};

  let timeoutBusqueda = null;
  let timeoutsHint = {};

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
  
  function parseNumero(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    const n = parseFloat(valor);
    return isNaN(n) ? null : n;
  }
  
  function formatearNumero(n, decimales = 2) {
    if (n === null || n === undefined || isNaN(n)) return '';
    return Number(n.toFixed(decimales)).toString();
  }

  // 🔥 NUEVO: separa un timestamp ISO/string en fecha y hora legibles locales
  function separarFechaHora(timestamp) {
    if (!timestamp) return { fecha: '—', hora: '—' };
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return { fecha: '—', hora: '—' };
      return {
        fecha: d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        hora:  d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
    } catch (e) {
      return { fecha: '—', hora: '—' };
    }
  }

  function mostrarToast(mensaje, esError = false) {
    const toast = document.getElementById('toast-prod');
    if (toast) {
      toast.innerHTML = `<i class="ti ${esError ? 'ti-alert-circle' : 'ti-circle-check'}"></i> ${mensaje}`;
      toast.style.background = esError ? '#fee2e2' : '#d1fae5';
      toast.style.color = esError ? '#b91c1c' : '#065f46';
      toast.style.borderLeftColor = esError ? '#ef4444' : '#10b981';
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 4000);
    }
  }

  function mostrarHint(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (timeoutsHint[id]) clearTimeout(timeoutsHint[id]);
    el.style.display = 'block';
    timeoutsHint[id] = setTimeout(() => { el.style.display = 'none'; }, 3000);
  }

  function ocultarHint(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }

  function actualizarResumen(bppCalculado = null) {
    const resumenEl = document.getElementById('resumen-lote');
    const resumenTexto = document.getElementById('resumen-texto');
    if (!resumenEl || !resumenTexto) return;

    const loteCode = document.getElementById('lote-id')?.value || '';
    const cantidad = parseNumero(document.getElementById('cantidad')?.value);
    const paletas = parseNumero(document.getElementById('paletas')?.value);
    const bpc = parseNumero(document.getElementById('bpc')?.value);
    const camadasPaleta = parseNumero(document.getElementById('camadas_paleta')?.value);

    let bpp = bppCalculado;
    if (!bpp && bpc && camadasPaleta && bpc > 0 && camadasPaleta > 0) {
      bpp = bpc * camadasPaleta;
    }

    if (!loteCode && !cantidad && !paletas) {
      resumenEl.style.display = 'none';
      return;
    }

    const partes = [];
    if (loteCode) partes.push(`Lote: <strong>${loteCode}</strong>`);
    if (cantidad) {
      partes.push(`<strong>${cantidad.toLocaleString()}</strong> unidades`);
      const docenas = cantidad / BOTELLAS_POR_DOCENA;
      const gruesas = cantidad / BOTELLAS_POR_GRUESA;
      partes.push(`<strong>${formatearNumero(docenas, 0)}</strong> docenas`);
      partes.push(`<strong>${formatearNumero(gruesas, 2)}</strong> gruesas`);
    }
    if (paletas) partes.push(`<strong>${paletas}</strong> paletas`);
    if (bpp) partes.push(`BPP: <strong>${bpp}</strong>`);

    resumenTexto.innerHTML = partes.join(' | ');
    resumenEl.style.display = 'flex';
  }

  // ==========================================
  // CONTROL DE SESIÓN
  // ==========================================
  function cargarUsuarioNav() {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        let avatarHtml = 'US';
        if (user.foto_url) {
          const fullUrl = user.foto_url.startsWith('http') ? user.foto_url : `${API_URL}${user.foto_url}`;
          avatarHtml = `<img src="${fullUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        } else if (user.nombre) {
          avatarHtml = user.nombre.substring(0, 2).toUpperCase();
        }

        if (document.getElementById('navAvatar')) document.getElementById('navAvatar').innerHTML = avatarHtml;
        if (document.getElementById('dropdownAvatar')) document.getElementById('dropdownAvatar').innerHTML = avatarHtml;
        ['navUsername', 'dropdownName'].forEach(id => { if (document.getElementById(id)) document.getElementById(id).textContent = user.nombre || 'Usuario'; });
        if (document.getElementById('dropdownEmail')) document.getElementById('dropdownEmail').textContent = user.correo || 'usuario@email.com';
        
        const operadorInput = document.getElementById('operador');
        if (operadorInput && !operadorInput.value) operadorInput.value = user.nombre || '';
      } catch (e) { console.error(e); }
    }
  }

  function verificarSesion() {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '../public/login.html'; return; }

    fetch(`${API_URL}/auth/verify`, { headers: tokenHeader() })
      .then(r => { if (!r.ok) throw new Error('Token inválido'); return r.json(); })
      .then(() => {
        cargarUsuarioNav();
        if (parseInt(localStorage.getItem('role')) === 3) {
          const link = document.getElementById('navUsuariosLink');
          if (link) link.style.display = 'flex';
        }
        try { init(); } catch (e) { console.error('❌ Error en init():', e); }
      })
      .catch(() => {
        localStorage.clear();
        window.location.href = '../public/login.html';
      });
  }

  function initUserControls() {
    const container = document.getElementById('navUserContainer');
    const dropdown = document.getElementById('userDropdown');
    if (container && dropdown) {
      container.addEventListener('click', function (e) { e.stopPropagation(); dropdown.classList.toggle('show'); });
    }
    document.addEventListener('click', () => { if (dropdown) dropdown.classList.remove('show'); });
    document.getElementById('dropdownLogout')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('¿Cerrar sesión?')) { localStorage.clear(); window.location.href = '../public/login.html'; }
    });
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
        const targetPanel = document.getElementById(tab.getAttribute('data-tab'));
        if (targetPanel) targetPanel.classList.add('active');
      });
    });
  }

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
  // DIMENSIONES (SOLO ALTURA)
  // ==========================================
  function obtenerDimensiones() {
    const h = document.getElementById('dim_altura_cil')?.value?.trim() || '';
    if (!h) return null;
    const hFmt = /cm|mm|pulg|"/i.test(h) ? h : `${h} pulg`;
    return `H ${hFmt}`.trim();
  }

  function actualizarPreviewDimensiones() {
    const preview = document.getElementById('dim-preview');
    const previewText = document.getElementById('dim-preview-text');
    if (!preview || !previewText) return;
    const dim = obtenerDimensiones();
    if (dim) { previewText.textContent = dim; preview.style.display = 'flex'; } else { preview.style.display = 'none'; }
  }

  function configurarEventosDimensiones() {
    document.getElementById('dim_altura_cil')?.addEventListener('input', actualizarPreviewDimensiones);
  }

  function aplicarDimensionesDesdeString(dimensiones) {
    if (!dimensiones || typeof dimensiones !== 'string') return;
    const str = dimensiones.trim();
    if (!str) return;
    const hMatch = str.match(/H\s*([\d.,]+\s*(?:cm|mm|pulg|")?)/i);
    if (document.getElementById('dim_altura_cil') && hMatch) {
      document.getElementById('dim_altura_cil').value = hMatch[1].trim();
    }
    actualizarPreviewDimensiones();
  }

  // ==========================================
  // PRODUCTOS Y CLIENTES
  // ==========================================
  function activarModoEdicionLibre(activo) {
    const camposTecnicos = ['item', 'acabado', 'material', 'tipo_boca', 'capacidad'];
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
        el.removeAttribute('placeholder'); 
      } else {
        el.setAttribute('readonly', 'readonly');
        el.style.background = ''; 
        el.setAttribute('placeholder', 'SE CARGA DEL PRODUCTO'); 
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
    ['item', 'acabado', 'material', 'tipo_boca', 'capacidad'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const unidad = document.getElementById('capacidad_unidad'); if (unidad) unidad.value = 'ml';
    const alturaInput = document.getElementById('dim_altura_cil'); if (alturaInput) alturaInput.value = '';
    actualizarPreviewDimensiones();
  }

  function autocompletarFichaTecnica(producto) {
    if (!producto) return;
    if (document.getElementById('item')) document.getElementById('item').value = producto.item || '';
    if (document.getElementById('acabado')) document.getElementById('acabado').value = producto.acabado || '';
    if (document.getElementById('material')) document.getElementById('material').value = producto.material || '';
    if (document.getElementById('tipo_boca')) document.getElementById('tipo_boca').value = producto.tipo_boca || '';
    
    if (document.getElementById('bpc')) document.getElementById('bpc').value = (producto.bpc !== null && producto.bpc !== undefined) ? producto.bpc : '';
    if (document.getElementById('camadas_paleta')) document.getElementById('camadas_paleta').value = (producto.camadas_por_paleta !== null && producto.camadas_por_paleta !== undefined) ? producto.camadas_por_paleta : '';
    
    if (document.getElementById('capacidad_unidad')) document.getElementById('capacidad_unidad').value = 'ml';
    escribirCapacidadEnMl(producto.capacidad_ml ?? null);
    if (producto.dimensiones) aplicarDimensionesDesdeString(producto.dimensiones);
    recalcularTodo('cantidad');
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
      if (searchInput) { searchInput.disabled = true; searchInput.value = ''; }
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
      if (searchInput) { searchInput.disabled = true; searchInput.value = ''; }
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
    
    const fechaVal = fechaInput.value; 
    const maquina = (maquinaInput.value || '').trim();
    
    if (!fechaVal || !maquina) { 
      loteInput.value = ''; 
      return; 
    }
    
    loteInput.value = `${fechaVal.replace(/-/g, '')}${maquina.replace(/\s+/g, '').toUpperCase()}`;
    actualizarResumen();
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

  // ==========================================
  // CÁLCULO BIDIRECCIONAL (Unidades ↔ Paletas) con Feedback
  // ==========================================
  function recalcularTodo(origen = 'cantidad') {
    const cantidadEl = document.getElementById('cantidad');
    const paletasEl = document.getElementById('paletas');
    const bppEl = document.getElementById('bpp');
    const bpcEl = document.getElementById('bpc');
    const camadasEl = document.getElementById('camadas_paleta');
    const cajasEl = document.getElementById('cajas_producidas');
    const gruesasEl = document.getElementById('gruesas');
    const gruesasPaletaEl = document.getElementById('gruesas_paleta');
    const hintBpp = document.getElementById('calc-hint-bpp');

    const cantidad = parseNumero(cantidadEl?.value);
    const paletasInput = parseNumero(paletasEl?.value);
    const bpc = parseNumero(bpcEl?.value);
    const camadasPaleta = parseNumero(camadasEl?.value);

    // 1. Calcular BPP
    let bppCalculado = null;
    if (bpc && camadasPaleta && bpc > 0 && camadasPaleta > 0) {
      bppCalculado = bpc * camadasPaleta;
      if (bppEl) {
        bppEl.value = formatearNumero(bppCalculado, 0);
        bppEl.style.color = '';
      }
      if (hintBpp) hintBpp.style.display = 'none';
    } else {
      if (bppEl) {
        bppEl.value = '';
      }
      if (hintBpp) {
        if ((bpc !== null || camadasPaleta !== null) && (bpc === 0 || camadasPaleta === 0)) {
          hintBpp.innerHTML = '<i class="ti ti-alert-triangle"></i> Escribe valores mayores a 0';
          hintBpp.style.color = 'var(--danger)';
          hintBpp.style.display = 'block';
        } else {
          hintBpp.style.display = 'none';
        }
      }
    }

    // 2. Lógica bidireccional
    let cantidadFinal = cantidad;
    let paletasFinal = paletasInput;

    if (origen === 'paletas' && paletasInput && bppCalculado) {
      cantidadFinal = paletasInput * bppCalculado;
      if (cantidadEl) cantidadEl.value = formatearNumero(cantidadFinal, 0);
      mostrarHint('calc-hint-cantidad');
    } else if (origen === 'cantidad' && cantidad && bppCalculado) {
      paletasFinal = cantidad / bppCalculado;
      if (paletasEl) paletasEl.value = formatearNumero(paletasFinal, 2);
      mostrarHint('calc-hint-paletas');
    }

    // 3. Cajas / Canastas
    if (cantidadFinal && bpc && bpc > 0 && cajasEl) {
      cajasEl.value = formatearNumero(cantidadFinal / bpc, 2);
    } else if (cajasEl) {
      cajasEl.value = '';
    }

    // 4. Gruesas (ahora con 144)
    if (cantidadFinal && gruesasEl) {
      gruesasEl.value = formatearNumero(cantidadFinal / BOTELLAS_POR_GRUESA, 2);
    } else if (gruesasEl) {
      gruesasEl.value = '';
    }

    // 5. Gruesas por Paleta (ahora con 144)
    if (bppCalculado && gruesasPaletaEl) {
      gruesasPaletaEl.value = formatearNumero(bppCalculado / BOTELLAS_POR_GRUESA, 2);
    } else if (gruesasPaletaEl) {
      gruesasPaletaEl.value = '';
    }

    // 6. Docenas
    const docenasEl = document.getElementById('docenas');
    if (docenasEl) {
      if (cantidadFinal) {
        docenasEl.value = formatearNumero(cantidadFinal / BOTELLAS_POR_DOCENA, 0);
      } else {
        docenasEl.value = '';
      }
    }

    actualizarResumen(bppCalculado);
  }

  function configurarAutoCalculos() {
    document.getElementById('cantidad')?.addEventListener('input', () => recalcularTodo('cantidad'));
    document.getElementById('paletas')?.addEventListener('input', () => recalcularTodo('paletas'));
    document.getElementById('bpc')?.addEventListener('input', () => recalcularTodo('cantidad'));
    document.getElementById('camadas_paleta')?.addEventListener('input', () => recalcularTodo('cantidad'));
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

      lotes = data.map(p => {
        // 🔥 HORA AUTOMÁTICA DEL SISTEMA (desde fecha_registro del backend)
        const { fecha, hora } = separarFechaHora(p.fecha_registro);

        return {
          id: p.id, codigo: p.codigo_lote, ticket_carga: p.ticket_carga || '—', prod: p.tipo_producto, molde: p.molde || p.tipo_producto,
          item: p.item || '—', acabado: p.acabado || '—', material: p.material || '', tipo_boca: p.tipo_boca || '', maquina: p.maquina || '—',
          grupo: p.grupo || '—', bpp: p.bpp || 0, 
          bpc: p.bot_por_caja || p.bpc || 0, 
          camadas_paleta: p.camadas_por_paleta || 0,
          cajas_producidas: p.cajas_producidas || 0,
          capacidad_ml: p.capacidad_ml ?? p.capacidad ?? null, unidad_capacidad: (p.unidad_capacidad === 'l' || p.unidad_capacidad === 'L') ? 'l' : 'ml',
          linea: p.linea_produccion, planta: p.planta || 'Valera', op: p.operador, uds: p.cantidad, turno: p.turno,
          paletas: p.paletas || 0, 
          gruesas: p.gruesas || 0, 
          docenas: p.docenas || 0,
          tamano_muestra: p.tamano_muestra || '',
          bot_por_canada: p.bot_por_canada || 0, bot_por_paleta: p.bot_por_paleta || 0, gruesas_por_paleta: p.gruesas_por_paleta || 0,
          cliente: p.cliente || 'Sin asignar', estatus: p.estatus || '100', estado_auditoria: p.estado_auditoria || 'Pendiente',
          observaciones: p.observaciones || '', fecha_prod: p.fecha_produccion || '',
          fecha: fecha,   // ✅ solo fecha (dd/mm/yyyy)
          hora: hora      // ✅ solo hora (hh:mm:ss) automática del sistema
        };
      });

      actualizarKPIs(lotes);
      renderTabla();
      actualizarTimestamp();

      const resultadoEl = document.getElementById('filtro-resultados');
      if (resultadoEl) {
        const filtrosActivosCount = Object.values(filtros).filter(v => v).length;
        resultadoEl.textContent = filtrosActivosCount > 0 ? `🔍 Filtros aplicados: ${filtrosActivosCount} | ${data.length} resultados` : ` Mostrando ${data.length} lotes`;
      }
    } catch (error) { console.error(error); mostrarError(); }
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

  function descargarEtiquetaJPG() {
    const elementoCaptura = document.getElementById("ticket-para-captura");
    if (!elementoCaptura) return;

    const btn = document.getElementById("btn-descargar-jpg");
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="ti ti-loader"></i> Generando...';
    btn.disabled = true;

    elementoCaptura.style.width = '420px';

    setTimeout(() => {
      html2canvas(elementoCaptura, { 
        scale: 3, useCORS: true, backgroundColor: '#ffffff', width: 420
      }).then(canvas => {
        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        const enlace = document.createElement('a');
        enlace.href = imgData;
        enlace.download = "etiqueta_lote_" + (document.getElementById("modal-lote-codigo").innerText || "sin_id") + ".jpg";
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      }).catch(err => { 
        console.error(err); mostrarToast("Error al generar la imagen", true); 
        btn.innerHTML = originalHtml; btn.disabled = false;
      });
    }, 100);
  }

  function descargarEtiquetaPDF() {
    const elementoCaptura = document.getElementById("ticket-para-captura");
    if (!elementoCaptura) return;

    const btn = document.getElementById("btn-descargar-pdf");
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="ti ti-loader"></i> Generando...';
    btn.disabled = true;

    elementoCaptura.style.width = '420px';

    setTimeout(() => {
      html2canvas(elementoCaptura, { 
        scale: 3, useCORS: true, backgroundColor: '#ffffff', width: 420
      }).then(canvas => {
        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 190; 
        const imgHeight = (canvas.height * imgWidth) / canvas.width; 
        pdf.addImage(imgData, 'JPEG', 10, 10, imgWidth, imgHeight);
        pdf.save("etiqueta_lote_" + (document.getElementById("modal-lote-codigo").innerText || "sin_id") + ".pdf");
        
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      }).catch(err => { 
        console.error(err); mostrarToast("Error al generar el PDF", true); 
        btn.innerHTML = originalHtml; btn.disabled = false;
      });
    }, 100);
  }

  window.verLote = function (id) {
    const lote = lotes.find(l => l.id === id);
    if (!lote) return;

    setTexto('modal-lote-codigo', lote.codigo);
    setTexto('detail-planta', lote.planta);
    // 🔥 Mostrar fecha + hora automática del sistema en el modal
    setTexto('detail-fecha', `${formatearFechaProd(lote.fecha_prod)} · ${lote.hora}`);
    
    // TURNOS: Mostrar el nombre en lugar del número (tolerante a string/número)
    setTexto('detail-turno', TURNOS_MAP[String(lote.turno)] || lote.turno || '—');
    
    setTexto('detail-producto', lote.prod);
    setTexto('detail-item', lote.item);
    setTexto('detail-material', lote.material);
    setTexto('detail-tipo-boca', lote.tipo_boca);
    setTexto('detail-capacidad', etiquetaCapacidad(lote.capacidad_ml, lote.unidad_capacidad));
    setTexto('detail-bpp', lote.bpp);
    setTexto('detail-acabado', lote.acabado);
    setTexto('detail-dimensiones', lote.tamano_muestra || '—');

    let bpcMostrar = lote.bpc || lote.bot_por_canada || 0;
    if (bpcMostrar === 0 && productosCache[lote.prod]) bpcMostrar = productosCache[lote.prod].bpc || 0;
    setTexto('detail-bpc', bpcMostrar || '—');
    
    setTexto('detail-camadas-paleta', lote.camadas_paleta || '—');
    setTexto('detail-maquina', lote.maquina);
    setTexto('detail-linea', lote.linea);
    setTexto('detail-molde', lote.molde);
    setTexto('detail-grupo', lote.grupo);
    setTexto('detail-operador', lote.op);
    setTexto('detail-ticket', lote.ticket_carga);
    setTexto('detail-cantidad', lote.uds ? lote.uds.toLocaleString() : '—');
    setTexto('detail-paletas', lote.paletas);

    let cajasMostrar = '—';
    if (lote.cajas_producidas > 0) cajasMostrar = formatearNumero(lote.cajas_producidas, 2);
    else if (lote.uds > 0 && bpcMostrar > 0) cajasMostrar = formatearNumero(lote.uds / bpcMostrar, 2);
    setTexto('detail-cajas', cajasMostrar);

    let docenasMostrar = '—';
    if (lote.docenas && Number(lote.docenas) > 0) {
      docenasMostrar = formatearNumero(lote.docenas, 0);
    } else if (lote.uds > 0) {
      docenasMostrar = formatearNumero(lote.uds / BOTELLAS_POR_DOCENA, 0);
    }
    setTexto('detail-docenas', docenasMostrar);

    setTexto('detail-gruesas', lote.gruesas);
    setTexto('detail-gruesas-paleta', lote.gruesas_por_paleta);
    setTexto('detail-cliente', lote.cliente);
    setTexto('detail-estatus', ESTATUS_LABELS[String(lote.estatus)] || lote.estatus);
    
    let estadoAuditoria = lote.estado_auditoria || 'Pendiente';
    if (lote.estatus === '200' || lote.estatus === '300') estadoAuditoria = 'Evaluado por Calidad';
    setTexto('detail-estado-auditoria', estadoAuditoria);
    setTexto('detail-observaciones', lote.observaciones);

    const qrContainer = document.getElementById('modal-qr-container');
    if (qrContainer) {
      qrContainer.innerHTML = ''; 
      const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
      const urlEtiqueta = `${baseUrl}/etiqueta.html?lote=${encodeURIComponent(lote.codigo)}`;

      if (typeof QRCode !== 'undefined') {
        new QRCode(qrContainer, {
          text: urlEtiqueta, width: 128, height: 128,
          colorDark : "#1e3a8a", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H
        });
      } else {
        qrContainer.innerHTML = '<span style="font-size:12px;color:#ef4444;">Error: Librería QR no cargada.</span>';
      }
    }

    const setInText = (id, valor, defecto) => {
      const el = document.getElementById(id);
      if (el) el.innerText = valor || defecto;
    };

    setInText("ticket-title-code", lote.ticket_carga, "TICKET-PRUEBA-123");
    setInText("ticket-planta", `VENVIDRIO ${lote.planta.toUpperCase()}`, "VENVIDRIO VALERA");
    setInText("ticket-cliente", lote.cliente, "CLIENTE STOCK");
    setInText("ticket-obs", lote.observaciones, "NO APLICA"); 
    // 🔥 Fecha + hora automática en el ticket
    setInText("ticket-fecha", `${formatearFechaProd(lote.fecha_prod)} · ${lote.hora}`, "07/11/2026");
    
    // TURNOS: nombre legible en el ticket
    const turnoNombre = TURNOS_MAP[String(lote.turno)] || lote.turno || "1";
    const maquinaStr = `${lote.maquina || "A1"}   ${turnoNombre}   ${lote.grupo || "A"}`;
    setInText("ticket-maquina", maquinaStr, "A1   1   A");
    
    setInText("ticket-producto", lote.prod, "BOTELLA PRUEBA 500ML");
    setInText("ticket-acabado", lote.acabado, "26-600-BEAD");
    setInText("ticket-item-code", lote.item, "V-TEST-001");
    setInText("ticket-molde", lote.molde, "MOLDE-PRUEBA-01");
    setInText("ticket-lote", lote.codigo, "20261107A1001");
    setInText("ticket-bpp", lote.bpp, "—");
    setInText("ticket-cap", etiquetaCapacidad(lote.capacidad_ml, lote.unidad_capacidad), "—");
    setInText("ticket-barcode-text", lote.ticket_carga, "TICKET-PRUEBA-123");

    if (typeof JsBarcode !== 'undefined' && document.getElementById("barcode-svg")) {
        JsBarcode("#barcode-svg", lote.ticket_carga || lote.codigo, {
            format: "CODE128", lineColor: "#000", width: 2, height: 60, displayValue: false
        });
    }

    const btnJPG = document.getElementById("btn-descargar-jpg");
    const btnPDF = document.getElementById("btn-descargar-pdf");
    
    if (btnJPG) {
      const nuevoBtnJPG = btnJPG.cloneNode(true);
      btnJPG.parentNode.replaceChild(nuevoBtnJPG, btnJPG);
      nuevoBtnJPG.addEventListener("click", descargarEtiquetaJPG);
    }
    if (btnPDF) {
      const nuevoBtnPDF = btnPDF.cloneNode(true);
      btnPDF.parentNode.replaceChild(nuevoBtnPDF, btnPDF);
      nuevoBtnPDF.addEventListener("click", descargarEtiquetaPDF);
    }

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
      // 🔥 colspan 15 (15 columnas reales incluyendo Hora)
      tbody.innerHTML = `<tr><td colspan="15" style="text-align:center;padding:2rem;color:var(--text-muted)"><i class="ti ti-inbox" style="font-size:1.5rem;margin-right:0.5rem"></i> No hay lotes registrados</td></tr>`;
      return;
    }

    data.forEach((l, i) => {
      const tr = document.createElement('tr');
      tr.style.animationDelay = `${0.04 * i}s`;
      const estatusClass = ESTATUS_CLASES[String(l.estatus)] || 'estatus-100';
      const plantaClass = PLANTA_CLASES[l.planta] || 'planta-valera';
      const estatusTexto = ESTATUS_LABELS[String(l.estatus)] || l.estatus;
      const capacidadTexto = etiquetaCapacidad(l.capacidad_ml, l.unidad_capacidad);

      // TURNOS: nombre legible (tolerante a string/número)
      const turnoTexto = TURNOS_MAP[String(l.turno)] || l.turno || '—';

      // 🔥 15 columnas: incluye la HORA automática del sistema
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
        <td><span class="badge badge-info">${turnoTexto}</span></td>
        <td style="text-align:center"><span class="estatus-badge ${estatusClass}">${estatusTexto}</span></td>
        <td><span style="display:block;font-weight:600;color:var(--navy);">${l.cliente}</span></td>
        <td class="text-muted text-sm">${l.fecha}</td>
        <td class="text-muted text-sm" style="text-align:center;font-family:'Courier New',monospace;">${l.hora}</td>
        <td><div style="display:flex;gap:4px;justify-content:center;">
          <button type="button" class="btn btn-primary btn-xs" onclick="verLote(${l.id})"><i class="ti ti-eye"></i></button>
          <button type="button" class="btn btn-danger btn-xs" onclick="eliminarLote(${l.id})"><i class="ti ti-trash"></i></button>
        </div></td>
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
      mostrarToast('✅ Lote eliminado correctamente');
    } catch (error) { mostrarToast('No se pudo eliminar el lote', true); }
  };

  // ==========================================
  // ESCÁNER
  // ==========================================
  function initEscanerGlobal() {
    EscanerApp.init(
      'reader-container-global', 
      'btn-escanear-global', 
      'btn-cerrar-camara-global', 
      'reader-global'
    );

    EscanerApp.onScanSuccess(async (codigoEscaneado) => {
      try {
        const response = await fetch(`${API_URL}/escaner/buscar/${encodeURIComponent(codigoEscaneado)}`, { headers: tokenHeader() });

        if (response.ok) {
          const lote = await response.json();

          document.getElementById('planta').value = lote.planta || '';
          document.getElementById('turno').value = lote.turno || '';
          if (lote.fecha_produccion) document.getElementById('fecha-prod').value = lote.fecha_produccion.split('T')[0];

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
          
          if (document.getElementById('bpc')) document.getElementById('bpc').value = lote.bpc || lote.bot_por_canada || '';
          if (document.getElementById('camadas_paleta')) document.getElementById('camadas_paleta').value = lote.camadas_por_paleta || '';

          document.getElementById('maquina').value = lote.maquina || '';
          document.getElementById('ticket_carga').value = lote.ticket_carga || codigoEscaneado;
          document.getElementById('grupo').value = lote.grupo || '';
          document.getElementById('linea').value = lote.linea_produccion || '';
          document.getElementById('operador').value = lote.operador || '';

          document.getElementById('cantidad').value = lote.cantidad || '';
          document.getElementById('paletas').value = lote.paletas || '';
          document.getElementById('cajas_producidas').value = lote.cajas_producidas || '';
          document.getElementById('gruesas').value = lote.gruesas || '';
          document.getElementById('gruesas_paleta').value = lote.gruesas_por_paleta || '';
          document.getElementById('obs-prod').value = lote.observaciones || '';

          document.getElementById('maquina').dispatchEvent(new Event('change'));
          document.getElementById('fecha-prod').dispatchEvent(new Event('change'));
          
          if (lote.cantidad) recalcularTodo('cantidad');
          else if (lote.paletas) recalcularTodo('paletas');

          const tabContexto = document.querySelector('[data-tab="tab-contexto"]');
          if (tabContexto) tabContexto.click();

          mostrarToast(`✅ Lote ${lote.codigo_lote} encontrado y autocompletado.`);

        } else if (response.status === 404) {
          document.getElementById('ticket_carga').value = codigoEscaneado;
          document.getElementById('fecha-prod').value = new Date().toISOString().split('T')[0];
          
          const userData = localStorage.getItem('user');
          if (userData) {
            const user = JSON.parse(userData);
            document.getElementById('operador').value = user.nombre || '';
          }

          if (codigoEscaneado === '05-003104461' || codigoEscaneado.includes('05-003104461')) {
              document.getElementById('planta').value = 'Valera';
              document.getElementById('maquina').value = 'A1';
              document.getElementById('turno').value = '1';
              document.getElementById('grupo').value = 'B';
              document.getElementById('molde').value = 'EV01838';
              
              const prodSelect = document.getElementById('producto-select');
              if (prodSelect) {
                const match = Array.from(prodSelect.options).find(o => o.value.toUpperCase().includes('SALSA INGLESA'));
                if (match) { prodSelect.value = match.value; prodSelect.dispatchEvent(new Event('change')); }
              }
              
              const cliSelect = document.getElementById('cliente-select');
              if (cliSelect) {
                const matchCli = Array.from(cliSelect.options).find(o => o.value.toUpperCase().includes('CLIENTE STOCK'));
                if (matchCli) cliSelect.value = matchCli.value;
              }
          }

          const tabContexto = document.querySelector('[data-tab="tab-contexto"]');
          if (tabContexto) tabContexto.click();

          mostrarToast(`Ticket ${codigoEscaneado} listo. Verifique los datos y guarde.`, false);
        }
      } catch (error) {
        console.error("Error buscando lote escaneado:", error);
        mostrarToast("Error de conexión al buscar el lote.", true);
      }
    });
  }

  // ==========================================
  // REGISTRAR
  // ==========================================
  function initFormularioRegistro() {
    const btnRegistrar = document.getElementById('btn-registrar');
    if (!btnRegistrar) return;

    btnRegistrar.addEventListener('click', async (e) => {
      e.preventDefault();

      const btn = e.currentTarget;
      const originalHtml = btn.innerHTML;

      const ticket_carga = document.getElementById('ticket_carga').value.trim();
      const planta = document.getElementById('planta').value;
      const maquina = document.getElementById('maquina').value;
      const turno = document.getElementById('turno').value; 
      const grupo = document.getElementById('grupo').value.trim();
      const linea = document.getElementById('linea').value.trim();
      const operador = document.getElementById('operador').value.trim();
      const acabado = document.getElementById('acabado').value.trim();
      const item = document.getElementById('item').value.trim();
      const material = document.getElementById('material')?.value?.trim() || '';
      const tipo_boca = document.getElementById('tipo_boca')?.value?.trim() || '';
      const molde = document.getElementById('molde').value.trim();
      const bpp = document.getElementById('bpp').value;
      const bpc = document.getElementById('bpc')?.value;
      const camadas_paleta = document.getElementById('camadas_paleta')?.value;
      const capacidadValor = parseNumero(document.getElementById('capacidad')?.value);
      const capacidadUnidad = unidadActual();
      const capacidadMl = capacidadMlActual();
      const cant = document.getElementById('cantidad').value;
      const paletas = document.getElementById('paletas').value;
      const cajas_producidas = document.getElementById('cajas_producidas').value;
      const gruesas = document.getElementById('gruesas').value;
      const gruesas_paleta = document.getElementById('gruesas_paleta').value;
      const docenas = document.getElementById('docenas')?.value;
      const fecha = document.getElementById('fecha-prod').value;
      const estatus = document.getElementById('estatus').value;
      const observaciones = document.getElementById('obs-prod').value.trim();

      const prod = obtenerProducto();
      const cliente = obtenerCliente();
      const dimensiones = obtenerDimensiones();
      const guardarEnCatalogo = document.getElementById('guardar-en-catalogo')?.checked || false;

      if (!planta) { mostrarToast('Selecciona una planta.', true); return; }
      if (!maquina) { mostrarToast('Selecciona una máquina.', true); return; }
      if (!turno) { mostrarToast('Selecciona un turno.', true); return; }
      if (!operador) { mostrarToast('Ingresa el operador.', true); return; }
      if (!molde) { mostrarToast('Ingresa el molde.', true); return; }
      if (!prod) { mostrarToast('Selecciona o crea un producto.', true); return; }
      if (!cliente) { mostrarToast('Selecciona o crea un cliente.', true); return; }
      if (!cant || parseInt(cant) <= 0) { mostrarToast('La cantidad debe ser mayor a 0.', true); return; }
      if (capacidadValor !== null && capacidadValor <= 0) { mostrarToast('El volumen debe ser mayor a 0.', true); return; }

      btn.innerHTML = '<i class="ti ti-loader"></i> Guardando...';
      btn.disabled = true;

      // 🔥 NOTA: NO enviamos "hora" ni "fecha_registro". El backend la genera
      // automáticamente con datetime.now() al crear el registro. El frontend
      // solo la lee después en cargarProduccion().
      const body = {
        ticket_carga: ticket_carga || null,
        planta: planta,
        maquina: maquina || null,
        turno: turno,
        grupo: grupo || null,
        linea_produccion: linea || null,
        operador: operador,
        tipo_producto: prod,
        acabado: acabado || null,
        material: material || null,
        tipo_boca: tipo_boca || null,
        item: item || null,
        molde: molde || null,
        bpp: bpp ? parseFloat(bpp) : null,
        bpc: bpc ? parseInt(bpc) : null,
        camadas_por_paleta: camadas_paleta ? parseInt(camadas_paleta) : null,
        capacidad: capacidadMl,
        capacidad_ml: capacidadMl,
        unidad_capacidad: capacidadUnidad,
        cantidad: parseInt(cant) || 0,
        paletas: paletas ? parseFloat(paletas) : null,
        cajas_producidas: cajas_producidas ? parseFloat(cajas_producidas) : null,
        gruesas: gruesas ? parseFloat(gruesas) : null,
        docenas: docenas ? parseFloat(docenas) : null,
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
          const productBody = { 
            nombre: prod, item: item || null, acabado: acabado || null, 
            capacidad_ml: capacidadMl !== null ? Math.round(capacidadMl) : null, 
            bpp: bpp ? parseFloat(bpp) : null, bpc: bpc ? parseInt(bpc) : null,
            camadas_por_paleta: camadas_paleta ? parseInt(camadas_paleta) : null,
            material: material || null, 
            tipo_boca: tipo_boca || null, dimensiones: dimensiones || null 
          };
          const resProd = await fetch(`${API_URL}/productos`, { method: 'POST', headers: jsonHeader(), body: JSON.stringify(productBody) });
          if (!resProd.ok) {
            const err = await resProd.json().catch(() => ({}));
            if (resProd.status === 400 || resProd.status === 409) mostrarToast(`El producto "${prod}" ya existe. Se guardará el lote igual.`, true);
            else throw new Error(err.detail || `Error ${resProd.status} guardando producto`);
          }
        }

        if (modoNuevoCliente && cliente) {
          const resCli = await fetch(`${API_URL}/clientes`, { method: 'POST', headers: jsonHeader(), body: JSON.stringify({ nombre: cliente }) });
          if (!resCli.ok) {
            const err = await resCli.json().catch(() => ({}));
            if (resCli.status === 400 || resCli.status === 409) mostrarToast(`El cliente "${cliente}" ya existe. Se guardará el lote igual.`, true);
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

        mostrarToast('✅ Lote registrado correctamente');
        document.getElementById('btn-limpiar').click();

      } catch (error) {
        console.error('Error registrando producción:', error);
        mostrarToast(error.message || 'No se pudo registrar la producción', true);
      } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      }
    });
  }

  // ==========================================
  // LIMPIAR
  // ==========================================
  function initLimpiar() {
    const btnLimpiar = document.getElementById('btn-limpiar');
    if (!btnLimpiar) return;
    btnLimpiar.addEventListener('click', async (e) => {
      e.preventDefault();

      const campos = ['ticket_carga', 'grupo', 'linea', 'acabado', 'item', 'material', 'tipo_boca', 'molde', 'bpp', 'bpc', 'camadas_paleta', 'cantidad', 'paletas', 'cajas_producidas', 'gruesas', 'capacidad', 'dim_altura_cil', 'gruesas_paleta', 'docenas', 'obs-prod'];

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
      recalcularTodo('cantidad');

      ocultarHint('calc-hint-cantidad');
      ocultarHint('calc-hint-paletas');
      ocultarHint('calc-hint-bpp');
      const resumenEl = document.getElementById('resumen-lote');
      if (resumenEl) resumenEl.style.display = 'none';
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
    } catch (e) { console.error('Error de red cargando productos:', e); }

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
    } catch (e) { console.error('Error de red cargando clientes:', e); }
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
    } catch (error) { console.error('Error cargando opciones registradas:', error); }
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
      // 🔥 colspan 15
      tbody.innerHTML = `<tr><td colspan="15" style="text-align:center;padding:2rem;color:var(--text-muted)"><i class="ti ti-alert-circle" style="font-size:1.5rem;margin-right:0.5rem"></i> Error al cargar datos. Verifica que el servidor esté corriendo en ${API_URL}</td></tr>`;
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
      if (!mes) { mostrarToast('Selecciona un mes', true); return; }
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