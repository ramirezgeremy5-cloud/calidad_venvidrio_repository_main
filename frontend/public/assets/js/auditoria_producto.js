/* ==========================================================
   VENVIDRIO - AUDITORÍA DE PRODUCTO NO CONFORME
   Conectado al módulo de Defectos
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================================
  // DETECCIÓN DE ENTORNO (URL CORRECTA)
  // ==========================================================
  const API_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
    ? "http://127.0.0.1:8000"
    : "https://calidad-venvidrio-repository-main.onrender.com";   // 👈 URL CORRECTA

  const token = localStorage.getItem('token');
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  let lotesRetenidos = [];
  let usuarioActual = null;

  // ==========================================================
  // 1. CARGAR LOTES RETENIDOS (Estatus 300)
  // ==========================================================
  async function cargarLotesRetenidos() {
    const selectLote = document.getElementById('lote_id');
    if (!selectLote) return;

    selectLote.innerHTML = '<option value="">Cargando lotes...</option>';

    try {
      const res = await fetch(`${API_URL}/produccion?estatus=300&limit=500`, { headers });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      lotesRetenidos = await res.json();
      selectLote.innerHTML = '<option value="">-- Seleccione un lote retenido --</option>';

      if (!lotesRetenidos.length) {
        selectLote.innerHTML = '<option value="">No hay lotes retenidos pendientes de auditoría</option>';
        return;
      }

      lotesRetenidos.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.id;
        const ticket = l.ticket_carga ? `${l.ticket_carga} - ` : '';
        opt.textContent = `${ticket}${l.codigo_lote} | ${l.tipo_producto || '—'} (${l.cliente || '—'})`;
        selectLote.appendChild(opt);
      });
    } catch (e) {
      console.error("Error cargando lotes:", e);
      selectLote.innerHTML = '<option value="">Error al cargar lotes</option>';
    }
  }

  // ==========================================================
  // 2. AUTOCOMPLETAR AL SELECCIONAR LOTE
  // ==========================================================
  const selectLoteEl = document.getElementById('lote_id');
  if (selectLoteEl) {
    selectLoteEl.addEventListener('change', async (e) => {
      const id = parseInt(e.target.value, 10);
      const defectosSelect = document.getElementById('defectos');
      if (defectosSelect) defectosSelect.innerHTML = '';

      if (!id) {
        document.getElementById('maquina').value = '';
        document.getElementById('item').value = '';
        document.getElementById('producto_cliente').value = '';
        return;
      }

      const lote = lotesRetenidos.find(l => l.id === id);
      if (!lote) return;

      document.getElementById('maquina').value = lote.maquina || '—';
      document.getElementById('item').value = `${lote.item || '—'} (EV: ${lote.molde || '—'})`;
      document.getElementById('producto_cliente').value =
        `${lote.tipo_producto || '—'} | Cliente: ${lote.cliente || '—'}`;

      const user = JSON.parse(localStorage.getItem('user') || 'null');
      if (user) document.getElementById('responsable').value = user.nombre || '';

      await cargarDefectosDelLote(lote.id);
    });
  }

  // ==========================================================
  // 3. CARGAR DEFECTOS REGISTRADOS DEL LOTE
  // ==========================================================
  async function cargarDefectosDelLote(loteId) {
    const selectDefectos = document.getElementById('defectos');
    if (!selectDefectos) return;

    selectDefectos.innerHTML = '<option value="">Cargando defectos del lote...</option>';

    try {
      const res = await fetch(`${API_URL}/defectos?lote_id=${loteId}`, { headers });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const defectos = await res.json();
      selectDefectos.innerHTML = '';

      if (!defectos.length) {
        selectDefectos.innerHTML = '<option value="">No se encontraron defectos registrados</option>';
        return;
      }

      defectos.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.tipo_defecto;
        opt.textContent = `${d.tipo_defecto} (${d.clasificacion} - ${d.cantidad_piezas || 0} pzas)`;
        opt.selected = true;
        selectDefectos.appendChild(opt);
      });
    } catch (e) {
      console.error("Error al cargar defectos:", e);
      selectDefectos.innerHTML = '<option value="">Error al cargar defectos</option>';
    }
  }

  // ==========================================================
  // 4. CÁLCULOS AUTOMÁTICOS
  // ==========================================================
  const inputInspeccionadas = document.getElementById('paletas_inspeccionadas');
  const inputRechazadas = document.getElementById('paletas_rechazadas');
  const inputAprobadas = document.getElementById('paletas_aprobadas');

  function calcularAprobadas() {
    const inspeccionadas = parseInt(inputInspeccionadas.value, 10) || 0;
    const rechazadas = parseInt(inputRechazadas.value, 10) || 0;
    inputAprobadas.value = Math.max(0, inspeccionadas - rechazadas);
  }

  inputInspeccionadas?.addEventListener('input', calcularAprobadas);
  inputRechazadas?.addEventListener('input', calcularAprobadas);

  // ==========================================================
  // 5. GUARDAR AUDITORÍA
  // ==========================================================
  document.getElementById('btn-guardar')?.addEventListener('click', async (e) => {
    e.preventDefault();

    const loteId = document.getElementById('lote_id').value;
    const paletasInspeccionadas = parseInt(inputInspeccionadas.value, 10) || 0;
    const paletasRechazadas = parseInt(inputRechazadas.value, 10) || 0;
    const paletasAprobadas = parseInt(inputAprobadas.value, 10) || 0;
    const movimiento = document.getElementById('movimiento').value;
    const observaciones = document.getElementById('observaciones').value.trim();

    const selectDefectos = document.getElementById('defectos');
    const defectosSeleccionados = Array.from(selectDefectos.selectedOptions).map(o => o.value).join(', ');

    // Validaciones
    if (!loteId) return alert("Debe seleccionar un lote.");
    if (paletasInspeccionadas <= 0) return alert("Las paletas inspeccionadas deben ser mayores a 0.");
    if (paletasRechazadas > paletasInspeccionadas) return alert("Las paletas rechazadas no pueden superar las inspeccionadas.");
    if (!movimiento) return alert("Debe seleccionar una acción (Disposición).");

    const btn = e.target;
    btn.disabled = true;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 1s linear infinite;"></i> Guardando...';

    try {
      // 1. Registrar auditoría
      const payload = {
        produccion_id: parseInt(loteId, 10),      // 👈 IMPORTANTE: el backend espera produccion_id
        fecha_auditoria: new Date().toISOString().split('T')[0],
        paletas_inspeccionadas: paletasInspeccionadas,
        paletas_aprobadas: paletasAprobadas,
        paletas_rechazadas: paletasRechazadas,
        observaciones: observaciones,
        defectos_ids: []                          // El backend de auditoria_producto espera defectos_ids
      };

      const resAuditoria = await fetch(`${API_URL}/auditoria-producto/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!resAuditoria.ok) {
        const err = await resAuditoria.json().catch(() => ({}));
        throw new Error(err.detail || "Error al guardar la auditoría");
      }

      // 2. Actualizar estatus del lote
      let nuevoEstatus = "300";
      if (movimiento.includes("Reseleccion")) nuevoEstatus = "950";
      if (movimiento.includes("Desecho")) nuevoEstatus = "999";
      if (movimiento.includes("Aprobado")) nuevoEstatus = "200";

      await fetch(`${API_URL}/produccion/${loteId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          estatus: nuevoEstatus,
          observaciones: `Auditoría: ${movimiento}. ${observaciones}`
        })
      });

      // 3. Toast de éxito
      const toast = document.getElementById('toast-msg');
      if (toast) {
        toast.style.display = 'flex';
        setTimeout(() => { toast.style.display = 'none'; }, 3000);
      } else {
        alert("Auditoría registrada correctamente");
      }

      limpiarFormulario();
      await cargarLotesRetenidos();

    } catch (error) {
      console.error("Error:", error);
      alert("Error al guardar: " + error.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  });

  // ==========================================================
  // 6. LIMPIAR FORMULARIO
  // ==========================================================
  function limpiarFormulario() {
    document.getElementById('lote_id').value = '';
    document.getElementById('maquina').value = '';
    document.getElementById('item').value = '';
    document.getElementById('producto_cliente').value = '';
    inputInspeccionadas.value = '';
    inputRechazadas.value = '';
    inputAprobadas.value = '';
    document.getElementById('movimiento').value = '';
    document.getElementById('defectos').innerHTML = '';
    document.getElementById('observaciones').value = '';
    document.getElementById('responsable').value = '';
  }

  document.getElementById('btn-limpiar')?.addEventListener('click', limpiarFormulario);

  // ==========================================================
  // 7. INICIALIZACIÓN
  // ==========================================================
  cargarLotesRetenidos();
});