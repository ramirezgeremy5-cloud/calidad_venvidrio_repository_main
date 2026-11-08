/* ==========================================
   VENVIDRIO - LANDING PAGE
   landing.js - Interactividad del Index
   ========================================== */

document.addEventListener("DOMContentLoaded", () => {
  'use strict';

  // ===============================
  // 1. MENÚ HAMBURGUESA (RESPONSIVE)
  // ===============================
  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");

  if (menuToggle && navLinks) {
    // Abrir/Cerrar menú
    menuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      navLinks.classList.toggle("active");
      
      // Cambiar el ícono (opcional, si usas Tabler Icons)
      const icon = menuToggle.querySelector("i");
      if (icon) {
        const isOpen = navLinks.classList.contains("active");
        icon.className = isOpen ? "ti ti-x" : "ti ti-menu-2";
        menuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      }
    });

    // Cerrar menú al hacer clic en un enlace (útil en móviles)
    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        if (window.innerWidth <= 900) {
          navLinks.classList.remove("active");
          const icon = menuToggle.querySelector("i");
          if (icon) icon.className = "ti ti-menu-2";
          menuToggle.setAttribute("aria-expanded", "false");
        }
      });
    });

    // Cerrar menú al hacer clic fuera de él
    document.addEventListener("click", (e) => {
      if (
        window.innerWidth <= 900 &&
        navLinks.classList.contains("active") &&
        !navLinks.contains(e.target) &&
        !menuToggle.contains(e.target)
      ) {
        navLinks.classList.remove("active");
        const icon = menuToggle.querySelector("i");
        if (icon) icon.className = "ti ti-menu-2";
        menuToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // ===============================
  // 2. REDIRECT AUTOMÁTICO (OPCIONAL)
  // ===============================
  // Descomenta este bloque si quieres que la página redirija sola al login
  // después de unos segundos (como en tu versión anterior).
  /*
  setTimeout(() => {
    window.location.href = "login.html";
  }, 800);
  */

});