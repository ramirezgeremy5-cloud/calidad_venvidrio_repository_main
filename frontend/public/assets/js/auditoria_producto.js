/* ==========================================================
   VENVIDRIO - AUDITORÍA DE PRODUCTO NO CONFORME
   auditoria_producto.js - v3 (Defectos dinámicos desde BD)
   Compatible con el HTML mejorado (checklist de defectos,
   select-search, file-upload, stepper, toast global)
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // ==========================================================
  // 0. CONFIGURACIÓN
  // ==========================================================
  const API_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
    ? 'http://127.0.0.1:8000'
    : 'https://calidad-venvidrio-repository-main.onrender.com';

  const TIMEOUT_MS = 15000;
  const TIMEOUT_WAKE_MS = 30000;

  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '../public/login.html';
    return;
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Estado local
  let lotesRetenidos = [];
  let loteActual = null;
  let usuarioActual = null;
  let archivoEvidencia = null;
  let catalogoDefectos = { clasificaciones: {}, tipos: [] };

  // ==========================================================
  // 1. UTILIDADES
  // ==========================================================
  const $  = (id) => document.getElementById(id);
  const val = (id) => ($(id) ? String($(id).value).trim() : '');
  const setText = (id, t) => { const el = $(id); if (el) el.textContent = t; };
  const setVal  = (id, v) => { const el = $(id); if (el) el.value = v; };

  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
      <div id="render-wake-up" style="position:fixed;inset:0;background:rgba(255,255,255,0.95);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;">
        <div style="border:4px solid #f3f3f3;border-top:4px solid #1e3a8a;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin-bottom:20px;"></div>
        <h2 style="color:#1e3a8a;margin:0 0 10px;">Conectando con el servidor...</h2>
        <p style="color:#64748b;margin:0;">El servidor estaba en reposo. Reintentando...</p>
        <style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
      </div>
    `);
  }
  function ocultarPantallaConexion() {
    const el = $('render-wake-up');
    if (el) el.remove();
  }

  // ==========================================================
  // 2. TOAST GLOBAL
  // ==========================================================
  let toastTimer = null;
  function mostrarToast(mensaje, tipo = 'success') {
    const toast = $('toast-auditoria');
    if (!toast) {
      alert(mensaje);
      return;
    }
    toast.classList.remove('show', 'error', 'warning');
    if (tipo === 'error') toast.classList.add('error');
    if (tipo === 'warning') toast.classList.add('warning');

    const span = toast.querySelector('span');
    if (span) span.textContent = mensaje;

    void toast.offsetWidth;
    toast.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // ==========================================================
  // 3. USUARIO / RESPONSABLE
  // ==========================================================
  function cargarUsuario() {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) return;
      usuarioActual = JSON.parse(userData);
      setVal('responsable', usuarioActual.nombre || '');
    } catch (e) {
      console.warn('No se pudo leer usuario:', e);
    }
  }

  // ==========================================================
  // 4. CARGAR LOTES (estatus 100 o 300)
  // ==========================================================
  async function cargarLotes() {
    const selectLote = $('lote_id');
    if (!selectLote) return;

    selectLote.innerHTML = '<option value="">Cargando lotes...</option>';

    try {
      const [res100, res300] = await Promise.all([
        fetchConRetry(`${API_URL}/produccion?estatus=100&limit=500`, { headers }),
        fetchConRetry(`${API_URL}/produccion?estatus=300&limit=500`, { headers })
      ]);

      const lista100 = res100.ok ? await res100.json() : [];
      const lista300 = res300.ok ? await res300.json() : [];

      lotesRetenidos = [...lista300, ...lista100];
      lotesRetenidos.sort((a, b) => {
        const ta = a.ticket_carga || '';
        const tb = b.ticket_carga || '';
        if (ta !== tb) return ta.localeCompare(tb, 'es', { numeric: true });
        return String(a.codigo_lote || '').localeCompare(String(b.codigo_lote || ''), 'es', { numeric: true });
      });

      renderOpcionesLotes('');

      if (!lotesRetenidos.length) {
        selectLote.innerHTML = '<option value="">No hay lotes pendientes de auditoría</option>';
      }

      console.log(`✅ ${lotesRetenidos.length} lotes cargados (${lista100.length} pendientes + ${lista300.length} retenidos)`);
    } catch (e) {
      console.error('Error cargando lotes:', e);
      selectLote.innerHTML = '<option value="">Error al cargar lotes. Revisa tu conexión.</option>';
      mostrarToast('No se pudieron cargar los lotes.', 'error');
    }
  }

  function renderOpcionesLotes(filtro = '') {
    const selectLote = $('lote_id');
    if (!selectLote) return;

    const q = filtro.toLowerCase().trim();
    const lista = q
      ? lotesRetenidos.filter(l =>
          String(l.codigo_lote || '').toLowerCase().includes(q) ||
          String(l.ticket_carga || '').toLowerCase().includes(q) ||
          String(l.tipo_producto || '').toLowerCase().includes(q) ||
          String(l.cliente || '').toLowerCase().includes(q)
        )
      : lotesRetenidos;

    const actual = selectLote.value;

    selectLote.innerHTML = '<option value="">-- Seleccione un lote --</option>';

    if (!lista.length) {
      selectLote.innerHTML = '<option value="">Sin coincidencias</option>';
      return;
    }

    lista.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id;
      const estatus = String(l.estatus) === '300' ? ' 🔴' : ' 🟢';
      const ticket = l.ticket_carga ? `${l.ticket_carga} · ` : '';
      opt.textContent = `${estatus} ${ticket}${l.codigo_lote} | ${l.tipo_producto || '—'} (${l.cliente || '—'})`;
      selectLote.appendChild(opt);
    });

    if (actual && lista.some(l => String(l.id) === actual)) {
      selectLote.value = actual;
    }
  }

  // ==========================================================
  // 5. AUTOCOMPLETAR AL SELECCIONAR LOTE
  // ==========================================================
  function initSelectorLote() {
    const selectLote = $('lote_id');
    if (!selectLote) return;

    selectLote.addEventListener('change', async (e) => {
      const id = e.target.value;
      resetChecklistDefectos();

      if (!id) {
        loteActual = null;
        setVal('maquina', '');
        setVal('item', '');
        setVal('producto_cliente', '');
        actualizarStepper(1);
        return;
      }

      loteActual = lotesRetenidos.find(l => String(l.id) === String(id));
      if (!loteActual) return;

      setVal('maquina', loteActual.maquina || loteActual.linea_produccion || '—');
      setVal('item', loteActual.item
        ? `${loteActual.item} (EV: ${loteActual.molde || '—'})`
        : (loteActual.molde ? `EV: ${loteActual.molde}` : '—'));
      setVal('producto_cliente',
        `${loteActual.tipo_producto || '—'} | Cliente: ${loteActual.cliente || '—'}`);

      if (usuarioActual?.nombre) {
        setVal('responsable', usuarioActual.nombre);
      } else if (loteActual.operador) {
        setVal('responsable', loteActual.operador);
      }

      actualizarStepper(2);

      await cargarDefectosDelLote(loteActual.id);
    });

    const searchInput = $('lote_search');
    if (searchInput) {
      let debounceId;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceId);
        debounceId = setTimeout(() => renderOpcionesLotes(searchInput.value), 200);
      });
    }
  }

  // ==========================================================
  // 6. CARGAR Y MARCAR DEFECTOS PREVIOS DEL LOTE
  // ==========================================================
  async function cargarDefectosDelLote(loteId) {
    try {
      const res = await fetchConTimeout(
        `${API_URL}/defectos?lote_id=${loteId}&t=${Date.now()}`,
        { headers }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const defectos = await res.json();

      if (!Array.isArray(defectos) || !defectos.length) {
        console.log('ℹ️ Lote sin defectos previos registrados');
        return;
      }

      // 👇 Marcar por clasificación + nombre (evita colisiones entre clases)
      const pares = new Set(
        defectos.map(d => {
          const clase = String(
            d.clasificacion || d.tipo_defecto_clasificacion || d.clase || ''
          ).trim().toLowerCase();
          const tipo = String(d.tipo_defecto || d.nombre || '').trim().toLowerCase();
          return `${clase}||${tipo}`;
        })
      );

      document.querySelectorAll('#defectos-list input[type="checkbox"]').forEach(cb => {
        const clase = String(cb.dataset.clase || '').trim().toLowerCase();
        const tipo  = String(cb.value || '').trim().toLowerCase();
        if (pares.has(`${clase}||${tipo}`)) cb.checked = true;
      });

      actualizarContadorDefectos();
      console.log(`✅ ${defectos.length} defectos previos marcados`);
    } catch (e) {
      console.warn('No se pudieron cargar defectos previos:', e);
    }
  }

  // ==========================================================
  // 7. CATÁLOGO DE DEFECTOS DESDE LA BASE DE DATOS
  // ==========================================================
  async function cargarCatalogoDefectos() {
    const container = $('defectos-list');
    if (!container) return;

    container.innerHTML = '<p style="color:#64748b;font-size:13px;">Cargando defectos...</p>';

    try {
      const res = await fetchConRetry(`${API_URL}/defectos/tipos?t=${Date.now()}`, { headers });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const agrupado = data?.clasificaciones || {};

      catalogoDefectos = {
        clasificaciones: agrupado,
        tipos: Array.isArray(data?.tipos) ? data.tipos : []
      };

      if (!Object.keys(agrupado).length) {
        container.innerHTML = '<p style="color:#64748b;font-size:13px;">No hay tipos de defectos registrados en el sistema.</p>';
        return;
      }

      const ordenClases = ['Crítico', 'Mayor B+', 'Mayor B-', 'Menor'];
      const clases = Object.keys(agrupado).sort((a, b) => {
        const ia = ordenClases.indexOf(a);
        const ib = ordenClases.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });

      container.innerHTML = clases.map(clase => {
        const tipos = agrupado[clase] || [];
        if (!tipos.length) return '';

        const chips = tipos.map(tipo => `
          <label class="defecto-chip" data-clase="${esc(clase)}">
            <input type="checkbox" value="${esc(tipo)}" data-clase="${esc(clase)}">
            <span>${esc(tipo)}</span>
          </label>
        `).join('');

        return `
          <div class="defecto-grupo" data-clase="${esc(clase)}" style="margin-bottom:14px;">
            <h4 style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#475569;">
              ${esc(clase)} <span style="color:#94a3b8;font-weight:400;">(${tipos.length})</span>
            </h4>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">${chips}</div>
          </div>
        `;
      }).join('');

      console.log(`✅ Catálogo de defectos cargado: ${catalogoDefectos.tipos.length} tipos`);
    } catch (e) {
      console.error('Error cargando catálogo de defectos:', e);
      container.innerHTML = '<p style="color:#dc2626;font-size:13px;">No se pudieron cargar los tipos de defectos. Revisa tu conexión.</p>';
      mostrarToast('No se pudo cargar el catálogo de defectos.', 'error');
    }
  }

  // ==========================================================
  // 8. CHECKLIST DE DEFECTOS (interacción)
  // ==========================================================
  function initChecklistDefectos() {
    const container = $('defectos-list');
    if (!container) return;

    // Delegación: el listener se mantiene aunque el DOM se regenere
    container.addEventListener('change', (e) => {
      if (e.target && e.target.matches('input[type="checkbox"]')) {
        actualizarContadorDefectos();
      }
    });

    const search = $('defecto_search');
    if (search) {
      search.addEventListener('input', () => {
        const q = search.value.toLowerCase().trim();
        container.querySelectorAll('.defecto-chip').forEach(chip => {
          const texto = chip.textContent.toLowerCase();
          chip.hidden = q && !texto.includes(q);
        });
        container.querySelectorAll('.defecto-grupo').forEach(grupo => {
          const visibles = Array.from(grupo.querySelectorAll('.defecto-chip'))
            .filter(c => !c.hidden);
          grupo.hidden = visibles.length === 0;
        });
      });
    }

    const btnClear = $('defectos-clear');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        actualizarContadorDefectos();
      });
    }
  }

  function actualizarContadorDefectos() {
    const seleccionados = document.querySelectorAll('#defectos-list input[type="checkbox"]:checked');
    const count = seleccionados.length;
    const badge = $('defectos-count');
    if (badge) {
      badge.textContent = `${count} seleccionado${count === 1 ? '' : 's'}`;
      badge.classList.toggle('badge-success', count > 0);
      badge.classList.toggle('badge-info', count === 0);
    }
    const btnClear = $('defectos-clear');
    if (btnClear) btnClear.style.display = count > 0 ? 'inline-flex' : 'none';

    if (count > 0) actualizarStepper(3);
  }

  function getDefectosSeleccionados() {
    return Array.from(
      document.querySelectorAll('#defectos-list input[type="checkbox"]:checked')
    ).map(cb => ({
      tipo_defecto: cb.value,
      clasificacion: cb.dataset.clase || ''
    }));
  }

  function resetChecklistDefectos() {
    document.querySelectorAll('#defectos-list input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });
    actualizarContadorDefectos();
    const search = $('defecto_search');
    if (search) {
      search.value = '';
      document.querySelectorAll('.defecto-chip').forEach(chip => { chip.hidden = false; });
      document.querySelectorAll('.defecto-grupo').forEach(g => { g.hidden = false; });
    }
  }

  // ==========================================================
  // 9. FILE UPLOAD CON PREVIEW
  // ==========================================================
  function initFileUpload() {
    const input = $('evidencia_foto');
    const fileName = $('file-name');
    const preview = $('file-preview');
    const previewImg = $('file-preview-img');
    const btnClear = $('file-clear');
    const uploadBtn = document.querySelector('.file-upload-btn');

    if (!input) return;

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        archivoEvidencia = null;
        if (fileName) fileName.textContent = 'Seleccionar imagen';
        if (preview) preview.hidden = true;
        if (btnClear) btnClear.style.display = 'none';
        uploadBtn?.classList.remove('has-file');
        return;
      }

      if (!file.type.startsWith('image/')) {
        mostrarToast('Solo se permiten archivos de imagen.', 'error');
        input.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        mostrarToast('La imagen supera los 5 MB.', 'error');
        input.value = '';
        return;
      }

      archivoEvidencia = file;
      if (fileName) fileName.textContent = file.name;
      uploadBtn?.classList.add('has-file');
      if (btnClear) btnClear.style.display = 'inline-flex';

      const reader = new FileReader();
      reader.onload = (ev) => {
        if (previewImg) previewImg.src = ev.target.result;
        if (preview) preview.hidden = false;
      };
      reader.readAsDataURL(file);
    });

    btnClear?.addEventListener('click', () => {
      input.value = '';
      archivoEvidencia = null;
      if (fileName) fileName.textContent = 'Seleccionar imagen';
      if (preview) preview.hidden = true;
      if (btnClear) btnClear.style.display = 'none';
      uploadBtn?.classList.remove('has-file');
    });
  }

  // ==========================================================
  // 10. CÁLCULOS AUTOMÁTICOS
  // ==========================================================
  function initCalculos() {
    const insp = $('paletas_inspeccionadas');
    const rech = $('paletas_rechazadas');
    const aprob = $('paletas_aprobadas');

    function recalcular() {
      const i = parseInt(insp?.value, 10) || 0;
      const r = parseInt(rech?.value, 10) || 0;
      if (aprob) aprob.value = Math.max(0, i - r);
      if (i > 0) actualizarStepper(2);
    }

    insp?.addEventListener('input', recalcular);
    rech?.addEventListener('input', recalcular);
  }

  // ==========================================================
  // 11. CONTADOR DE OBSERVACIONES
  // ==========================================================
  function initContadorObs() {
    const obs = $('observaciones');
    const count = $('obs-count');
    if (!obs || !count) return;
    obs.addEventListener('input', () => {
      count.textContent = obs.value.length;
    });
  }

  // ==========================================================
  // 12. STEPPER
  // ==========================================================
  function actualizarStepper(pasoActivo) {
    document.querySelectorAll('.aud-stepper .step').forEach(step => {
      const n = parseInt(step.dataset.step, 10);
      step.classList.remove('is-active', 'is-done');
      if (n < pasoActivo) step.classList.add('is-done');
      else if (n === pasoActivo) step.classList.add('is-active');
    });
  }

  // ==========================================================
  // 13. GUARDAR AUDITORÍA
  // ==========================================================
  function initGuardar() {
    const btn = $('btn-guardar');
    if (!btn) return;

    btn.addEventListener('click', async (e) => {
      e.preventDefault();

      const loteId = val('lote_id');
      const paletasInsp = parseInt($('paletas_inspeccionadas')?.value, 10) || 0;
      const paletasRech = parseInt($('paletas_rechazadas')?.value, 10) || 0;
      const paletasAprob = parseInt($('paletas_aprobadas')?.value, 10) || 0;
      const movimiento = val('movimiento');
      const observaciones = val('observaciones');
      const defectos = getDefectosSeleccionados();

      if (!loteId) {
        mostrarToast('Debe seleccionar un lote.', 'error');
        $('lote_id')?.focus();
        return;
      }
      if (paletasInsp <= 0) {
        mostrarToast('Las paletas inspeccionadas deben ser mayores a 0.', 'error');
        $('paletas_inspeccionadas')?.focus();
        return;
      }
      if (paletasRech > paletasInsp) {
        mostrarToast('Las paletas rechazadas no pueden superar las inspeccionadas.', 'error');
        $('paletas_rechazadas')?.focus();
        return;
      }
      if (!movimiento) {
        mostrarToast('Debe seleccionar una disposición.', 'error');
        $('movimiento')?.focus();
        return;
      }
      if (defectos.length === 0) {
        mostrarToast('Debe marcar al menos un defecto detectado.', 'error');
        return;
      }

      const originalHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 1s linear infinite;display:inline-block;"></i> Guardando...';

      try {
        // === 1. Registrar auditoría ===
        // Se envía array de objetos { tipo_defecto, clasificacion }
        const payload = {
          produccion_id: parseInt(loteId, 10),
          fecha_auditoria: new Date().toISOString().split('T')[0],
          paletas_inspeccionadas: paletasInsp,
          paletas_aprobadas: paletasAprob,
          paletas_rechazadas: paletasRech,
          movimiento,
          observaciones,
          defectos,
          evidencia_nombre: archivoEvidencia?.name || null
        };

        const resAud = await fetchConRetry(`${API_URL}/auditoria-producto/`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        }, 2);

        if (!resAud.ok) {
          const err = await resAud.json().catch(() => ({}));
          throw new Error(err.detail || `Error ${resAud.status} al guardar auditoría`);
        }

        const dataAud = await resAud.json().catch(() => ({}));

        // === 2. Subir evidencia (si existe) ===
        if (archivoEvidencia && dataAud?.id) {
          try {
            const formData = new FormData();
            formData.append('file', archivoEvidencia);
            await fetchConTimeout(
              `${API_URL}/auditoria-producto/${dataAud.id}/evidencia`,
              {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
              },
              TIMEOUT_WAKE_MS
            );
          } catch (e) {
            console.warn('No se pudo subir la evidencia:', e);
            mostrarToast('Auditoría guardada, pero la evidencia no se subió.', 'warning');
          }
        }

        // === 3. Actualizar estatus del lote ===
        let nuevoEstatus = '300';
        if (movimiento.includes('Reseleccion')) nuevoEstatus = '950';
        else if (movimiento.includes('Desecho')) nuevoEstatus = '999';
        else if (movimiento.includes('Aprobado')) nuevoEstatus = '200';
        else if (movimiento.includes('Reempaque')) nuevoEstatus = '910';

        const resPut = await fetchConTimeout(`${API_URL}/produccion/${loteId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            estatus: nuevoEstatus,
            estado_auditoria: 'completada',
            observaciones: `Auditoría: ${movimiento}. ${observaciones}`.trim()
          })
        }, TIMEOUT_WAKE_MS);

        if (!resPut.ok) {
          console.warn(`No se pudo actualizar estatus a ${nuevoEstatus}`);
        }

        // === 4. Éxito ===
        actualizarStepper(5);
        mostrarToast(`Auditoría registrada. Lote → estatus ${nuevoEstatus}.`);
        limpiarFormulario();
        await cargarLotes();

      } catch (error) {
        console.error('Error guardando auditoría:', error);
        mostrarToast(error.message || 'Error al guardar la auditoría.', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
      }
    });
  }

  // ==========================================================
  // 14. LIMPIAR FORMULARIO
  // ==========================================================
  function limpiarFormulario() {
    loteActual = null;
    archivoEvidencia = null;

    setVal('lote_id', '');
    setVal('maquina', '');
    setVal('item', '');
    setVal('producto_cliente', '');
    setVal('paletas_inspeccionadas', '');
    setVal('paletas_rechazadas', '');
    setVal('paletas_aprobadas', '');
    setVal('movimiento', '');
    setVal('observaciones', '');
    setVal('responsable', usuarioActual?.nombre || '');

    const searchLote = $('lote_search');
    if (searchLote) searchLote.value = '';

    resetChecklistDefectos();

    const fileInput = $('evidencia_foto');
    if (fileInput) fileInput.value = '';
    const fileName = $('file-name');
    if (fileName) fileName.textContent = 'Seleccionar imagen';
    const preview = $('file-preview');
    if (preview) preview.hidden = true;
    const btnClear = $('file-clear');
    if (btnClear) btnClear.style.display = 'none';
    document.querySelector('.file-upload-btn')?.classList.remove('has-file');

    setText('obs-count', '0');
    actualizarStepper(1);
    renderOpcionesLotes('');
  }

  function initLimpiar() {
    $('btn-limpiar')?.addEventListener('click', () => {
      if (confirm('¿Limpiar el formulario? Se perderán los datos no guardados.')) {
        limpiarFormulario();
        mostrarToast('Formulario limpiado');
      }
    });
  }

  // ==========================================================
  // 15. INICIALIZACIÓN
  // ==========================================================
  function init() {
    cargarUsuario();
    initSelectorLote();
    initChecklistDefectos();
    cargarCatalogoDefectos();   // 👈 Carga los tipos desde la BD
    initFileUpload();
    initCalculos();
    initContadorObs();
    initGuardar();
    initLimpiar();
    actualizarStepper(1);

    cargarLotes();
  }

  init();
});