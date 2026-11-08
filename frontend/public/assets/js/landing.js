/**
 * =============================================
 * LANDING.JS - Funcionalidad completa para 
 * la página de inicio de Venvidrio
 * =============================================
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Landing Page Venvidrio cargada correctamente');

    // =============================================
    // 1. MENÚ MÓVIL (Hamburguesa)
    // =============================================
    
    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = navLinks.classList.toggle('active');
            
            // Cambiamos el icono entre menú y cerrar
            menuToggle.innerHTML = isOpen 
                ? '<i class="ti ti-x"></i>' 
                : '<i class="ti ti-menu-2"></i>';
            
            // Actualizamos el atributo aria-expanded para accesibilidad
            menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        // Al hacer clic en un enlace del menú móvil, se cierra automáticamente
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 900) {
                    navLinks.classList.remove('active');
                    menuToggle.innerHTML = '<i class="ti ti-menu-2"></i>';
                    menuToggle.setAttribute('aria-expanded', 'false');
                }
            });
        });

        // Cerrar el menú al hacer clic fuera de él
        document.addEventListener('click', (e) => {
            if (
                window.innerWidth <= 900 &&
                navLinks.classList.contains('active') &&
                !navLinks.contains(e.target) &&
                !menuToggle.contains(e.target)
            ) {
                navLinks.classList.remove('active');
                menuToggle.innerHTML = '<i class="ti ti-menu-2"></i>';
                menuToggle.setAttribute('aria-expanded', 'false');
            }
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
        }, 300);
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
    // 4. EFECTO DEL NAVBAR AL HACER SCROLL
    // =============================================

    const navbar = document.querySelector('.navbar');
    
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }
});