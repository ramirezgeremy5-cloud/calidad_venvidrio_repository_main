/* ==========================================================
   VENVIDRIO - AUDITORÍA DE PRODUCTO NO CONFORME
   Conectado al módulo de Defectos
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {
  
  // Detectar URL de la API
  const API_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') 
    ? "http://127.0.0.1:8000" 
    : `http://${window.location.hostname}:8000`;

  const token = localStorage.getItem('token');
  const headers = { 
    'Authorization': `Bearer ${token}`, 
    'Content-Type': 'application/json' 
  };

  let lotesRetenidos = [];
  let usuarioActual = null;

  // ==========================================
  // 1. CARGAR LOTES RETENIDOS (Estatus 300)
  // ==========================================
  async function cargarLotesRetenidos() {
    try {
      const selectLote = document.getElementById('lote_id');
      selectLote.innerHTML = '<option value="">Cargando lotes...</option>';

      // Buscamos los lotes que fueron rechazados en el módulo de defectos (estatus 300)
      const res = await fetch(`${API_URL}/produccion?estatus=300&limit=500`, { headers });
      
      if (!res.ok) throw new Error("Error al cargar lotes");

      lotesRetenidos = await res.json();
      
      selectLote.innerHTML = '<option value="">-- Seleccione un lote retenido --</option>';
      
      if (lotesRetenidos.length === 0) {
        selectLote.innerHTML = '<option value="">No hay lotes retenidos pendientes de auditoría</option>';
        return;
      }

      lotesRetenidos.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.id;
        // Formato: Ticket - Código - Producto (Cliente)
        const ticket = l.ticket_carga ? `${l.ticket_carga} - ` : '';
        opt.textContent = `${ticket}${l.codigo_lote} | ${l.tipo_producto} (${l.cliente})`;
        selectLote.appendChild(opt);
      });

    } catch (e) {
      console.error("Error:", e);
      document.getElementById('lote_id').innerHTML = '<option value="">Error al cargar lotes</option>';
    }
  }

  // ==========================================
  // 2. AUTOCOMPLETAR DATOS AL SELECCIONAR LOTE
  // ==========================================
  document.getElementById('lote_id').addEventListener('change', async (e) => {
    const id = parseInt(e.target.value);
    const defectosSelect = document.getElementById('defectos');
    
    // Limpiar defectos anteriores
    defectosSelect.innerHTML = '';

    if (!id) {
      document.getElementById('maquina').value = '';
      document.getElementById('item').value = '';
      document.getElementById('producto_cliente').value = '';
      return;
    }

    const lote = lotesRetenidos.find(l => l.id === id);
    
    if (lote) {
      // Autocompletar campos de solo lectura
      document.getElementById('maquina').value = lote.maquina || '—';
      document.getElementById('item').value = `${lote.item || '—'} (EV: ${lote.molde || '—'})`;
      document.getElementById('producto_cliente').value = `${lote.tipo_producto || '—'} | Cliente: ${lote.cliente || '—'}`;
      
      // Autocompletar el responsable con el usuario logueado
      const user = JSON.parse(localStorage.getItem('user'));
      if (user) document.getElementById('responsable').value = user.nombre || '';
      
      // 👇 OBTENER DEFECTOS REGISTRADOS PARA ESTE LOTE (Módulo Defectos)
      await cargarDefectosDelLote(lote.id);
    }
  });

  // ==========================================
  // 3. CARGAR DEFECTOS REGISTRADOS (Módulo Defectos)
  // ==========================================
  async function cargarDefectosDelLote(loteId) {
    const selectDefectos = document.getElementById('defectos');
    selectDefectos.innerHTML = '<option value="">Cargando defectos del lote...</option>';

    try {
      // Consultamos a la API de defectos filtrando por el lote_id
      const res = await fetch(`${API_URL}/defectos?lote_id=${loteId}`, { headers });
      
      if (res.ok) {
        const defectos = await res.json();
        
        selectDefectos.innerHTML = '';
        
        if (defectos.length === 0) {
          selectDefectos.innerHTML = '<option value="">No se encontraron defectos registrados (Error de trazabilidad)</option>';
          return;
        }

        // Mostramos los defectos reales que se registraron en el módulo de Defectos
        defectos.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.tipo_defecto;
          // Formato: Cuello Torcido (Crítico - 150 pzas)
          opt.textContent = `${d.tipo_defecto} (${d.clasificacion} - ${d.cantidad_piezas || 0} pzas)`;
          // Marcamos como seleccionado por defecto
          opt.selected = true; 
          selectDefectos.appendChild(opt);
        });
      } else {
        throw new Error("No se pudieron cargar los defectos");
      }
    } catch (e) {
      console.error("Error al cargar defectos:", e);
      selectDefectos.innerHTML = '<option value="">Error al cargar defectos</option>';
    }
  }

  // ==========================================
  // 4. CÁLCULOS AUTOMÁTICOS
  // ==========================================
  const inputInspeccionadas = document.getElementById('paletas_inspeccionadas');
  const inputRechazadas = document.getElementById('paletas_rechazadas');
  const inputAprobadas = document.getElementById('paletas_aprobadas');

  function calcularAprobadas() {
    const inspeccionadas = parseInt(inputInspeccionadas.value) || 0;
    const rechazadas = parseInt(inputRechazadas.value) || 0;
    
    // Aprobadas = Total Inspeccionadas - Rechazadas (Si es negativo, lo forzamos a 0)
    const aprobadas = Math.max(0, inspeccionadas - rechazadas);
    inputAprobadas.value = aprobadas;
  }

  inputInspeccionadas.addEventListener('input', calcularAprobadas);
  inputRechazadas.addEventListener('input', calcularAprobadas);

  // ==========================================
  // 5. GUARDAR LA AUDITORÍA
  // ==========================================
  document.getElementById('btn-guardar').addEventListener('click', async (e) => {
    e.preventDefault();

    const loteId = document.getElementById('lote_id').value;
    const paletasInspeccionadas = parseInt(inputInspeccionadas.value) || 0;
    const paletasRechazadas = parseInt(inputRechazadas.value) || 0;
    const paletasAprobadas = parseInt(inputAprobadas.value) || 0;
    const movimiento = document.getElementById('movimiento').value;
    const observaciones = document.getElementById('observaciones').value.trim();

    // Obtener los defectos seleccionados
    const selectDefectos = document.getElementById('defectos');
    const defectosSeleccionados = Array.from(selectDefectos.selectedOptions).map(opt => opt.value).join(', ');

    // Validaciones básicas
    if (!loteId) return alert("Debe seleccionar un lote.");
    if (paletasInspeccionadas <= 0) return alert("Las paletas inspeccionadas deben ser mayores a 0.");
    if (paletasRechazadas > paletasInspeccionadas) return alert("Las paletas rechazadas no pueden superar las inspeccionadas.");
    if (!movimiento) return alert("Debe seleccionar una acción (Disposición).");

    const btn = e.target;
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 1s linear infinite;"></i> Guardando...';

    try {
      // 1. Registrar la auditoría de producto
      const payload = {
        lote_id: parseInt(loteId),
        fecha_auditoria: new Date().toISOString().split('T')[0], // Fecha actual
        maquina: document.getElementById('maquina').value,
        item: document.getElementById('item').value.split(' (EV:')[0], // Extraemos solo el Item
        ev: document.getElementById('item').value.split('(EV: ')[1]?.replace(')', '') || '',
        paletas_inspeccionadas: paletasInspeccionadas,
        paletas_aprobadas: paletasAprobadas,
        paletas_rechazadas: paletasRechazadas,
        defectos_encontrados: defectosSeleccionados || "Ninguno especificado",
        observaciones: observaciones,
        movimiento: movimiento // Dependiendo de tu backend, esto actualiza el estatus
      };

      const resAuditoria = await fetch(`${API_URL}/auditorias/producto`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (!resAuditoria.ok) {
        const err = await resAuditoria.json();
        throw new Error(err.detail || "Error al guardar la auditoría");
      }

      // 2. Actualizar el estatus del lote en Producción
      // Si el movimiento es "Desecho", cambia a 999. Si es "Aprobado por Desviación", cambia a 200. 
      // Si va a reselección, se queda en 300 (o pasa a 950 dependiendo tu flujo).
      let nuevoEstatus = "300"; // Por defecto sigue retenido
      if (movimiento.includes("Reseleccion")) nuevoEstatus = "950";
      if (movimiento.includes("Desecho")) nuevoEstatus = "999";
      if (movimiento.includes("Aprobado")) nuevoEstatus = "200";

      // Actualizamos el lote
      await fetch(`${API_URL}/produccion/${loteId}`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify({ 
          estatus: nuevoEstatus,
          observaciones: `Auditoría: ${movimiento}. ${observaciones}`
        })
      });

      // 3. Mostrar éxito y limpiar
      const toast = document.getElementById('toast-msg');
      toast.style.display = 'flex';
      setTimeout(() => { toast.style.display = 'none'; }, 3000);

      limpiarFormulario();
      await cargarLotesRetenidos(); // Recargar la lista de lotes

    } catch (error) {
      console.error("Error:", error);
      alert("Error al guardar: " + error.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-device-floppy"></i> Registrar Auditoría';
    }
  });

  // ==========================================
  // 6. LIMPIAR FORMULARIO
  // ==========================================
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

  document.getElementById('btn-limpiar').addEventListener('click', limpiarFormulario);

  // ==========================================
  // 7. INICIALIZACIÓN
  // ==========================================
  cargarLotesRetenidos();

});