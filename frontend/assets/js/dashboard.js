/* ==========================================
   VENVIDRIO - DASHBOARD
   dashboard.js - Versión Completa con Control de Sesión y Logout Backend
   ========================================= */

const API_URL = "http://127.0.0.1:8000";

let productionChart = null;
let defectosChart = null;
let lineasChart = null;
let eficienciaChart = null;
let intervaloCarga = null;
let datosDashboard = null;
let periodoActual = 7;
let filtroGrafico = 'ambos';

// Variables de control de sesión
let temporizadorInactividad = null;
let TIEMPO_INACTIVIDAD = 5 * 60 * 1000; // 5 minutos
let tiempoRestante = TIEMPO_INACTIVIDAD / 1000;
let intervaloContador = null;
let sesionActiva = true;

/* ==========================================
   UTILIDADES Y LOGS
========================================== */

function log(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    if (data) {
        console.log(`[${timestamp}] 📊 ${message}`, data);
    } else {
        console.log(`[${timestamp}] 📊 ${message}`);
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
   CONTROL DE SESIÓN - USUARIO
========================================== */

// Cargar datos del usuario en el navbar
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
            const nombre = user.nombre || 'Usuario';
            const correo = user.correo || 'usuario@email.com';

            if (avatar) avatar.textContent = iniciales;
            if (username) username.textContent = nombre;
            if (dropdownAvatar) dropdownAvatar.textContent = iniciales;
            if (dropdownName) dropdownName.textContent = nombre;
            if (dropdownEmail) dropdownEmail.textContent = correo;

            logSuccess('Usuario cargado en navbar:', nombre);
        } catch (e) {
            logError('Error parseando usuario:', e);
        }
    }
}

// Verificar sesión activa
function verificarSesion() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
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
    .then(data => {
        logSuccess('Sesión verificada');
        cargarUsuarioNav();
        iniciarControlInactividad();
    })
    .catch(error => {
        logError('Error verificando sesión:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        window.location.href = 'login.html';
    });
}

// Iniciar control de inactividad
function iniciarControlInactividad() {
    // Detectar actividad del usuario
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

// Iniciar contador de tiempo
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

// Actualizar display del timer
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

// Reiniciar temporizador de inactividad
function reiniciarTemporizador() {
    if (!sesionActiva) return;

    if (temporizadorInactividad) {
        clearTimeout(temporizadorInactividad);
    }

    tiempoRestante = TIEMPO_INACTIVIDAD / 1000;
    actualizarTimerDisplay();

    temporizadorInactividad = setTimeout(function() {
        cerrarSesion('⏳ Tu sesión ha expirado por inactividad. Por favor, inicia sesión nuevamente.');
    }, TIEMPO_INACTIVIDAD);
}

// ==========================================================
// ✅ CERRAR SESIÓN (CORREGIDO: LLAMA AL BACKEND)
// ==========================================================
function cerrarSesion(mensaje) {
    sesionActiva = false;

    // Detener temporizadores locales
    if (temporizadorInactividad) {
        clearTimeout(temporizadorInactividad);
        temporizadorInactividad = null;
    }

    if (intervaloContador) {
        clearInterval(intervaloContador);
        intervaloContador = null;
    }

    // 1. Obtener el token actual
    const token = localStorage.getItem('token');

    // 2. Intentar avisar al backend para que borre el token_activo
    if (token) {
        fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .catch(error => {
            // Solo logueamos el error, no bloqueamos el cierre de sesión
            console.warn('⚠️ No se pudo comunicar con el backend al cerrar sesión:', error);
        })
        .finally(() => {
            // 3. Siempre limpiar el localStorage y redirigir, haya funcionado o no el backend
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('role');
            localStorage.removeItem('login_time');
            
            if (mensaje) {
                alert(mensaje);
            }

            window.location.href = 'login.html';
        });
    } else {
        // Si no hay token, simplemente redirigir
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        localStorage.removeItem('login_time');

        if (mensaje) {
            alert(mensaje);
        }

        window.location.href = 'login.html';
    }
}

// Cerrar sesión manual (desde dropdown)
function logoutManual() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        cerrarSesion('👋 Sesión cerrada exitosamente.');
    }
}

// Toggle dropdown de usuario
function toggleDropdown() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

// Cerrar dropdown
function cerrarDropdown() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
}

// Inicializar controles de usuario
function initUserControls() {
    const container = document.getElementById('navUserContainer');
    const logoutBtn = document.getElementById('dropdownLogout');

    // Click en avatar para abrir/cerrar dropdown
    if (container) {
        container.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleDropdown();
        });
    }

    // Cerrar dropdown al hacer click fuera
    document.addEventListener('click', function() {
        cerrarDropdown();
    });

    // Cerrar dropdown con ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            cerrarDropdown();
        }
    });

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            logoutManual();
        });
    }

    // Ctrl+Shift+L para logout rápido
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
            e.preventDefault();
            logoutManual();
        }
    });

    log('Controles de usuario inicializados');
}

/* ==========================================
   SKELETON LOADING
========================================== */

function mostrarSkeleton() {
    const elementos = ['dash-lotes', 'dash-unidades', 'dash-defectos', 'dash-eficiencia'];
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
   CARGAR DASHBOARD COMPLETO
========================================== */

async function cargarDashboard() {
    try {
        log('Cargando dashboard completo...');
        
        mostrarSkeleton();

        async function fetchData(url, fallback = null) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    console.warn(`⚠️ Error ${response.status} en ${url}`);
                    return fallback;
                }
                return await response.json();
            } catch (e) {
                console.warn(`⚠️ Error en fetch ${url}:`, e);
                return fallback;
            }
        }

        const stats = await fetchData(`${API_URL}/dashboard/stats`, { lotes: 0, unidades: 0, defectos: 0, eficiencia: '0%' });

        const tendencias = await fetchData(`${API_URL}/dashboard/tendencias`, { 
            tendencia: { lotes: 0, unidades: 0, defectos: 0, eficiencia: 0 },
            periodo: { actual: { desde: '--', hasta: '--' } }
        });

        const prodGrafico = await fetchData(`${API_URL}/dashboard/grafico/produccion?dias=${periodoActual}`, { labels: [], unidades: [], lotes: [] });

        const defGrafico = await fetchData(`${API_URL}/dashboard/grafico/defectos`, { labels: ['Críticos', 'Mayores', 'Menores'], values: [0, 0, 0], colors: ['#dc3545', '#ffc107', '#17a2b8'] });

        const lineas = await fetchData(`${API_URL}/dashboard/grafico/lineas`, { lineas: [] });

        const eficiencia = await fetchData(`${API_URL}/dashboard/grafico/eficiencia?meses=6`, { labels: [], valores: [] });

        const topDefectos = await fetchData(`${API_URL}/dashboard/top/defectos`, []);

        const auditorias = await fetchData(`${API_URL}/dashboard/auditorias/pendientes`, { total: 0, en_proceso: 0, cerradas: 0, con_nc: 0, criticas: 0 });

        datosDashboard = { stats, tendencias, prodGrafico, defGrafico, lineas, eficiencia, topDefectos, auditorias };

        actualizarKPIsConTendencias(stats, tendencias);
        actualizarAuditoriasPendientes(auditorias);
        actualizarTopDefectos(topDefectos);

        crearGraficaProduccion(prodGrafico);
        crearGraficaDefectos(defGrafico);
        crearGraficaLineas(lineas);
        crearGraficaEficiencia(eficiencia);

        actualizarTimestamp();

        logSuccess('Dashboard actualizado correctamente');

    } catch (error) {
        logError('Error cargando dashboard:', error);
        mostrarErrorKPI();
    }
}

/* ==========================================
   ACTUALIZAR KPIs CON TENDENCIAS
========================================== */

function actualizarKPIsConTendencias(stats, tendencias) {
    const kpis = [
        {
            id: 'dash-lotes',
            valor: stats.lotes || 0,
            tendencia: tendencias.tendencia?.lotes || 0,
            label: 'Lotes registrados',
            formato: 'numero',
            clase: 'lotes'
        },
        {
            id: 'dash-unidades',
            valor: stats.unidades || 0,
            tendencia: tendencias.tendencia?.unidades || 0,
            label: 'Unidades producidas',
            formato: 'numero',
            clase: 'produccion'
        },
        {
            id: 'dash-defectos',
            valor: stats.defectos || 0,
            tendencia: tendencias.tendencia?.defectos || 0,
            label: 'Defectos',
            formato: 'numero',
            invertir: true,
            clase: 'defectos'
        },
        {
            id: 'dash-eficiencia',
            valor: stats.eficiencia || '0%',
            tendencia: tendencias.tendencia?.eficiencia || 0,
            label: 'Eficiencia',
            formato: 'porcentaje',
            clase: 'eficiencia'
        }
    ];

    kpis.forEach(kpi => {
        const el = document.getElementById(kpi.id);
        if (!el) return;

        const esPositiva = kpi.invertir ? kpi.tendencia < 0 : kpi.tendencia > 0;
        const esCero = kpi.tendencia === 0;

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
            valorFormateado = kpi.valor;
        } else {
            valorFormateado = typeof kpi.valor === 'number' 
                ? kpi.valor.toLocaleString() 
                : kpi.valor;
        }

        let colorValor = '';
        if (kpi.id === 'dash-defectos' && kpi.valor > 0) {
            colorValor = 'danger';
        } else if (kpi.id === 'dash-defectos' && kpi.valor === 0) {
            colorValor = 'success';
        }

        const tendenciaHTML = !esCero ? `
            <span class="tendencia ${claseTendencia}">
                ${flecha} ${Math.abs(kpi.tendencia)}%
            </span>
        ` : '';

        el.innerHTML = `
            ${valorFormateado}
            ${tendenciaHTML}
        `;

        if (colorValor) {
            el.classList.add(colorValor);
        } else {
            el.classList.remove('danger', 'success');
        }

        const card = el.closest('.kpi-card');
        if (card) {
            card.className = `kpi-card ${kpi.clase} anim-card`;
            
            const metaEl = card.querySelector('.kpi-meta');
            if (metaEl) {
                const periodo = tendencias.periodo?.actual;
                if (periodo) {
                    metaEl.textContent = `${kpi.label} · ${periodo.desde} - ${periodo.hasta}`;
                } else {
                    metaEl.textContent = kpi.label;
                }
            }
        }
    });
}

function mostrarErrorKPI() {
    const elementos = ['dash-lotes', 'dash-unidades', 'dash-defectos', 'dash-eficiencia'];
    elementos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '⚠️ Error';
    });
}

/* ==========================================
   ACTUALIZAR AUDITORÍAS PENDIENTES
========================================== */

function actualizarAuditoriasPendientes(auditorias) {
    const el = document.getElementById('auditorias-pendientes');
    if (!el) return;

    const items = [
        { valor: auditorias.total || 0, label: 'Total', clase: 'azul' },
        { valor: auditorias.en_proceso || 0, label: 'En proceso', clase: 'naranja' },
        { valor: auditorias.cerradas || 0, label: 'Cerradas', clase: 'verde' },
        { valor: auditorias.con_nc || 0, label: 'Con NC', clase: 'rojo' },
        { valor: auditorias.criticas || 0, label: 'Críticas', clase: 'critico' }
    ];

    el.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;text-align:center;">
            ${items.map(item => `
                <div style="padding:8px 4px;border-radius:var(--radius-sm);background:var(--off-white);transition:background var(--transition);">
                    <div style="font-size:20px;font-weight:700;font-family:var(--font-mono);color:${item.clase === 'azul' ? 'var(--navy)' : item.clase === 'verde' ? 'var(--success)' : item.clase === 'naranja' ? 'var(--warning)' : item.clase === 'rojo' ? 'var(--danger)' : '#dc3545'}">${item.valor}</div>
                    <div style="font-size:10px;color:var(--text-hint);margin-top:2px;">${item.label}</div>
                </div>
            `).join('')}
        </div>
    `;
}

/* ==========================================
   ACTUALIZAR TOP DEFECTOS
========================================== */

function actualizarTopDefectos(topDefectos) {
    const el = document.getElementById('top-defectos');
    if (!el) return;

    if (!topDefectos || topDefectos.length === 0) {
        el.innerHTML = `
            <div style="text-align:center;color:var(--text-muted);padding:10px 0;">
                <i class="ti ti-circle-check" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;color:var(--success)"></i>
                No hay defectos registrados
            </div>
        `;
        return;
    }

    el.innerHTML = topDefectos.map((item, index) => `
        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);">
            <span style="font-weight:700;color:var(--text-hint);width:20px;">${index + 1}</span>
            <span style="flex:1;font-size:13px;">${item.producto}</span>
            <span style="font-size:12px;color:var(--danger);font-weight:600;">${item.defectos}</span>
            <span style="font-size:11px;color:var(--text-hint);">${item.tasa}%</span>
        </div>
    `).join('');
}

/* ==========================================
   GRÁFICA DE PRODUCCIÓN
========================================== */

function crearGraficaProduccion(data) {
    const canvas = document.getElementById("productionChart");
    if (!canvas) {
        logError('Canvas de gráfica de producción no encontrado');
        return;
    }

    if (productionChart) {
        productionChart.destroy();
        productionChart = null;
    }

    const labels = data.labels || [];
    const unidades = data.unidades || [];
    const lotes = data.lotes || [];

    let datasets = [];
    
    if (filtroGrafico === 'unidades' || filtroGrafico === 'ambos') {
        datasets.push({
            label: 'Unidades',
            data: unidades,
            backgroundColor: 'rgba(26, 35, 126, 0.75)',
            borderColor: 'rgba(26, 35, 126, 1)',
            borderWidth: 2,
            borderRadius: 6,
            order: 1
        });
    }
    
    if (filtroGrafico === 'lotes' || filtroGrafico === 'ambos') {
        datasets.push({
            label: 'Lotes',
            data: lotes,
            backgroundColor: 'rgba(76, 175, 80, 0.75)',
            borderColor: 'rgba(76, 175, 80, 1)',
            borderWidth: 2,
            borderRadius: 6,
            order: 2
        });
    }

    productionChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { size: 12, weight: '500' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    titleColor: '#1a237e',
                    bodyColor: '#333',
                    borderColor: '#e0e0e0',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12
                }
            },
            onClick: function(event, elements) {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const fecha = this.data.labels[index];
                    const unidadesVal = this.data.datasets[0]?.data[index] || 0;
                    const lotesVal = this.data.datasets[1]?.data[index] || 0;
                    alert(`📊 Detalles del día ${fecha}:\n\n📦 Unidades: ${unidadesVal.toLocaleString()}\n📋 Lotes: ${lotesVal}`);
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.06)', drawBorder: false },
                    ticks: { font: { size: 11 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11, weight: '500' } }
                }
            },
            animation: { duration: 800, easing: 'easeOutQuart' }
        }
    });

    log('Gráfica de producción creada');
}

/* ==========================================
   GRÁFICA DE DEFECTOS POR TIPO
========================================== */

function crearGraficaDefectos(data) {
    const canvas = document.getElementById("defectosChart");
    if (!canvas) {
        logError('Canvas de gráfica de defectos no encontrado');
        return;
    }

    if (defectosChart) {
        defectosChart.destroy();
        defectosChart = null;
    }

    const labels = data.labels || ['Críticos', 'Mayores', 'Menores'];
    const values = data.values || [0, 0, 0];
    const colors = data.colors || ['#dc3545', '#ffc107', '#17a2b8'];

    const total = values.reduce((a, b) => a + b, 0);

    defectosChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors.map(c => c + 'CC'),
                borderColor: colors,
                borderWidth: 3,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: { size: 12, weight: '500' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    titleColor: '#1a237e',
                    bodyColor: '#333',
                    borderColor: '#e0e0e0',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            let value = context.raw || 0;
                            let percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            },
            animation: { animateRotate: true, duration: 1000, easing: 'easeOutQuart' }
        }
    });

    const badge = document.getElementById('total-defectos-badge');
    if (badge) {
        badge.textContent = `Total: ${total}`;
    }

    log('Gráfica de defectos creada');
}

/* ==========================================
   GRÁFICA DE PRODUCCIÓN POR LÍNEA
========================================== */

function crearGraficaLineas(data) {
    const canvas = document.getElementById("lineasChart");
    if (!canvas) {
        logError('Canvas de gráfica de líneas no encontrado');
        return;
    }

    if (lineasChart) {
        lineasChart.destroy();
        lineasChart = null;
    }

    const lineas = data.lineas || [];
    const labels = lineas.map(l => l.linea);
    const valores = lineas.map(l => l.unidades);
    const porcentajes = lineas.map(l => l.porcentaje);

    const colores = [
        'rgba(26, 35, 126, 0.8)',
        'rgba(76, 175, 80, 0.8)',
        'rgba(255, 152, 0, 0.8)',
        'rgba(220, 53, 69, 0.8)',
        'rgba(23, 162, 184, 0.8)'
    ];

    lineasChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
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
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    titleColor: '#1a237e',
                    bodyColor: '#333',
                    borderColor: '#e0e0e0',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const porcentaje = porcentajes[index] || 0;
                            return `${context.raw.toLocaleString()} unidades (${porcentaje}%)`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.06)', drawBorder: false },
                    ticks: { font: { size: 11 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10, weight: '500' } }
                }
            },
            animation: { duration: 800, easing: 'easeOutQuart' }
        }
    });

    log('Gráfica de líneas creada');
}

/* ==========================================
   GRÁFICA DE EFICIENCIA MENSUAL
========================================== */

function crearGraficaEficiencia(data) {
    const canvas = document.getElementById("eficienciaChart");
    if (!canvas) {
        logError('Canvas de gráfica de eficiencia no encontrado');
        return;
    }

    if (eficienciaChart) {
        eficienciaChart.destroy();
        eficienciaChart = null;
    }

    const labels = data.labels || [];
    const valores = data.valores || [];

    eficienciaChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
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
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    titleColor: '#1a237e',
                    bodyColor: '#333',
                    borderColor: '#e0e0e0',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            return `${context.raw}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(0,0,0,0.06)', drawBorder: false },
                    ticks: { font: { size: 11 }, callback: function(v) { return v + '%'; } }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11, weight: '500' } }
                }
            },
            animation: { duration: 800, easing: 'easeOutQuart' }
        }
    });

    log('Gráfica de eficiencia creada');
}

/* ==========================================
   CARGAR ÚLTIMOS REGISTROS
========================================== */

async function cargarUltimos() {
    try {
        const response = await fetch(`${API_URL}/dashboard/ultimos`);

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const registros = await response.json();

        const tabla = document.getElementById("dashboard-table");
        if (!tabla) return;

        tabla.innerHTML = "";

        if (registros.length === 0) {
            tabla.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center;padding:2rem;color:var(--text-muted);">
                        <i class="ti ti-inbox" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>
                        No hay registros recientes
                    </td>
                </tr>
            `;
            return;
        }

        registros.forEach(registro => {
            const fila = document.createElement("tr");
            fila.innerHTML = `
                <td>${registro.fecha || '--'}</td>
                <td>${registro.linea || '--'}</td>
                <td>${registro.producto || '--'}</td>
                <td><span class="badge badge-success">${registro.estado || 'OK'}</span></td>
            `;
            tabla.appendChild(fila);
        });

        const badge = document.getElementById('total-registros-badge');
        if (badge) {
            badge.textContent = `${registros.length} registros`;
        }

    } catch (error) {
        logError('Error cargando últimos registros:', error);
        const tabla = document.getElementById("dashboard-table");
        if (tabla) {
            tabla.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center;padding:2rem;color:var(--danger);">
                        <i class="ti ti-alert-circle" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>
                        Error cargando registros
                    </td>
                </tr>
            `;
        }
    }
}

/* ==========================================
   CARGAR ALERTAS DEL SISTEMA
========================================== */

async function cargarAlertas() {
    try {
        log('Cargando alertas...');

        const response = await fetch(`${API_URL}/dashboard/alerts`);

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const alertas = await response.json();

        const lista = document.getElementById("dashboard-alerts");
        if (!lista) return;

        lista.innerHTML = "";

        if (alertas.length === 0 || (alertas.length === 1 && alertas[0].tipo === 'success')) {
            lista.innerHTML = `
                <li style="display:flex;align-items:center;gap:10px;padding:12px 0;color:var(--text-muted);">
                    <i class="ti ti-circle-check" style="font-size:1.2rem;color:var(--success);"></i>
                    ✅ Todas las alertas están resueltas
                </li>
            `;
            return;
        }

        alertas.forEach(alerta => {
            const li = document.createElement("li");
            
            let icono = 'ti ti-info-circle';
            let color = 'var(--info)';

            if (alerta.tipo === 'warning') {
                icono = 'ti ti-alert-triangle';
                color = 'var(--warning)';
            } else if (alerta.tipo === 'danger') {
                icono = 'ti ti-alert-circle';
                color = 'var(--danger)';
            } else if (alerta.tipo === 'success') {
                icono = 'ti ti-circle-check';
                color = 'var(--success)';
            }

            li.innerHTML = `
                <i class="${icono}" style="font-size:1.2rem;color:${color};"></i>
                <div style="flex:1;">
                    <div style="font-size:13px;color:var(--text-main);">${alerta.mensaje}</div>
                </div>
                ${alerta.tipo === 'danger' ? `<span class="badge badge-danger">Crítico</span>` : ''}
                ${alerta.tipo === 'warning' ? `<span class="badge badge-warning">Atención</span>` : ''}
            `;
            li.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);';

            lista.appendChild(li);
        });

    } catch (error) {
        logError('Error cargando alertas:', error);
        const lista = document.getElementById("dashboard-alerts");
        if (lista) {
            lista.innerHTML = `
                <li style="color:var(--danger);padding:10px 0;">
                    <i class="ti ti-alert-circle"></i> Error cargando alertas
                </li>
            `;
        }
    }
}

/* ==========================================
   FILTROS DE TIEMPO
========================================== */

function initFiltrosTiempo() {
    document.querySelectorAll('.filtro-tiempo').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filtro-tiempo').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const dias = parseInt(this.dataset.dias);
            if (dias) {
                periodoActual = dias;
                log(`🔄 Cambiando período a ${dias} días`);
                cargarDashboard();
            } else {
                periodoActual = 365;
                log('🔄 Mostrando todos los datos');
                cargarDashboard();
            }
        });
    });
}

/* ==========================================
   FILTROS DE GRÁFICO
========================================== */

function initFiltrosGrafico() {
    document.querySelectorAll('.filtro-grafico').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filtro-grafico').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            filtroGrafico = this.dataset.filtro;
            log(`🔄 Cambiando filtro de gráfico a: ${filtroGrafico}`);
            
            if (datosDashboard?.prodGrafico) {
                crearGraficaProduccion(datosDashboard.prodGrafico);
            }
        });
    });
}

/* ==========================================
   EXPORTAR DASHBOARD A PDF
========================================== */

function exportarDashboardPDF() {
    log('📤 Exportando dashboard a PDF...');
    window.open(`${API_URL}/dashboard/exportar/pdf`, '_blank');
}

/* ==========================================
   SHORTCUTS DE TECLADO
========================================== */

function initShortcuts() {
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            log('⌨️ Recargando dashboard (Ctrl+R)');
            recargarDashboard();
        }
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            log('⌨️ Exportando dashboard (Ctrl+E)');
            exportarDashboardPDF();
        }
    });
}

/* ==========================================
   RECARGAR MANUAL
========================================== */

function recargarDashboard() {
    log('🔄 Recargando dashboard manualmente...');
    cargarDashboard();
    cargarUltimos();
    cargarAlertas();
}

/* ==========================================
   INICIALIZACIÓN
========================================== */

function iniciarDashboard() {
    log('🚀 Dashboard Venvidrio iniciado');

    // Verificar sesión primero
    verificarSesion();

    // Inicializar controles de usuario
    initUserControls();

    // Inicializar filtros y shortcuts
    initFiltrosTiempo();
    initFiltrosGrafico();
    initShortcuts();

    // Botones
    document.getElementById('btn-exportar-pdf')?.addEventListener('click', exportarDashboardPDF);
    document.querySelector('.btn-refresh')?.addEventListener('click', recargarDashboard);

    // Cargar datos
    cargarDashboard();
    cargarUltimos();
    cargarAlertas();

    // Auto-actualización
    if (intervaloCarga) {
        clearInterval(intervaloCarga);
    }

    intervaloCarga = setInterval(() => {
        log('🔄 Auto-actualización del dashboard...');
        cargarDashboard();
        cargarUltimos();
        cargarAlertas();
    }, 30000);

    // Click en KPI recarga
    document.querySelectorAll('.kpi-card').forEach((card) => {
        card.addEventListener('click', () => {
            log('🔄 Recarga manual solicitada');
            recargarDashboard();
        });
    });

    logSuccess('Dashboard inicializado correctamente');
}

/* ==========================================
   EVENTO DOMContentLoaded
========================================== */

document.addEventListener("DOMContentLoaded", iniciarDashboard);

/* ==========================================
   LIMPIEZA AL SALIR
========================================== */

window.addEventListener('beforeunload', function() {
    if (intervaloCarga) {
        clearInterval(intervaloCarga);
        intervaloCarga = null;
    }
    if (temporizadorInactividad) {
        clearTimeout(temporizadorInactividad);
        temporizadorInactividad = null;
    }
    if (intervaloContador) {
        clearInterval(intervaloContador);
        intervaloContador = null;
    }
    if (productionChart) {
        productionChart.destroy();
        productionChart = null;
    }
    if (defectosChart) {
        defectosChart.destroy();
        defectosChart = null;
    }
    if (lineasChart) {
        lineasChart.destroy();
        lineasChart = null;
    }
    if (eficienciaChart) {
        eficienciaChart.destroy();
        eficienciaChart = null;
    }
});

/* ==========================================
   FUNCIONES DE PRUEBA (Consola)
========================================== */

window.recargarDashboard = recargarDashboard;
window.exportarDashboardPDF = exportarDashboardPDF;
window.cerrarSesion = cerrarSesion;

window.verEstadoDashboard = function() {
    console.log('📊 Estado del Dashboard:');
    console.log('  - Gráfica Producción:', productionChart ? 'Cargada ✅' : 'No cargada ❌');
    console.log('  - Gráfica Defectos:', defectosChart ? 'Cargada ✅' : 'No cargada ❌');
    console.log('  - Gráfica Líneas:', lineasChart ? 'Cargada ✅' : 'No cargada ❌');
    console.log('  - Gráfica Eficiencia:', eficienciaChart ? 'Cargada ✅' : 'No cargada ❌');
    console.log('  - Auto-actualización:', intervaloCarga ? 'Activa ✅' : 'Inactiva ❌');
    console.log('  - API:', API_URL);
    console.log('  - Datos:', datosDashboard ? 'Cargados ✅' : 'No cargados ❌');
    console.log('  - Período:', periodoActual + ' días');
    console.log('  - Filtro gráfico:', filtroGrafico);
    console.log('  - Sesión:', sesionActiva ? 'Activa ✅' : 'Inactiva ❌');
    console.log('  - Tiempo restante:', Math.floor(tiempoRestante / 60) + ':' + String(Math.floor(tiempoRestante % 60)).padStart(2, '0'));
};

console.log('🔐 Dashboard con control de sesión cargado');
console.log('📋 Comandos disponibles:');
console.log('  - recargarDashboard() - Recargar datos');
console.log('  - exportarDashboardPDF() - Exportar a PDF');
console.log('  - cerrarSesion() - Cerrar sesión manual');
console.log('  - verEstadoDashboard() - Ver estado actual');
console.log('⌨️ Atajos: Ctrl+R (recargar), Ctrl+E (exportar), Ctrl+Shift+L (logout)');