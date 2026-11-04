/**
 * =============================================
 * LANDING.JS - Funcionalidad completa para 
 * la página de inicio de Venvidrio (Solo Login)
 * =============================================
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Landing Page Venvidrio cargada correctamente');

    // =============================================
    // 1. MENÚ MÓVIL (Hamburguesa)
    // =============================================
    
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            const isOpen = navLinks.classList.toggle('nav-open');
            // Cambiamos el icono entre menú y cerrar
            menuToggle.innerHTML = isOpen 
                ? '<i class="ti ti-x"></i>' 
                : '<i class="ti ti-menu-2"></i>';
        });

        // Al hacer clic en un enlace del menú móvil, se cierra automáticamente
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    navLinks.classList.remove('nav-open');
                    menuToggle.innerHTML = '<i class="ti ti-menu-2"></i>';
                }
            });
        });
    }

    // =============================================
    // 2. ANIMACIÓN DE APARICIÓN (HÉROE)
    // =============================================

    const heroContent = document.querySelector('.hero-content');

    // El héroe aparece con un pequeño retraso al cargar la página
    if (heroContent) {
        setTimeout(() => {
            heroContent.classList.add('visible');
        }, 300); // 300ms de retraso para un efecto suave
    }

    // =============================================
    // 3. DESPLAZAMIENTO SUAVE (SCROLL SMOOTH)
    // =============================================

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === "#" || href === "") return;

            e.preventDefault();
            const targetElement = document.querySelector(href);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // =============================================
    // 4. INTERACCIÓN DEL BOTÓN DE INICIO DE SESIÓN
    // =============================================

    const btnLogin = document.querySelector('a[href="/login.html"]');

    if (btnLogin) {
        btnLogin.addEventListener('click', (e) => {
            // Si estás en desarrollo local y no tienes el backend aún,
            // esto te mostrará un mensaje para pruebas.
            // Cuando tengas el backend, borra las líneas del alert y el preventDefault.
            
            // e.preventDefault(); // <-- DESCOMENTA ESTO SI NO TIENES BACKEND AÚN
            console.log('🔐 Redirigiendo a la página de Inicio de Sesión...');
            // alert('🚀 Redirigiendo al Login...'); // <-- BORRAR ESTO EN PRODUCCIÓN
            
            // Cuando tengas el backend, solo déjalo así:
            // window.location.href = '/login';
        });
    }

    // =============================================
    // 5. EFECTO DE RELLENO DEL NAVBAR AL HACER SCROLL
    // =============================================

    const navbar = document.querySelector('.navbar');
    
    if (navbar) {
        window.addEventListener('scroll', () => {
            // Cuando el usuario baja más de 50px, se activa el estilo oscuro
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

});