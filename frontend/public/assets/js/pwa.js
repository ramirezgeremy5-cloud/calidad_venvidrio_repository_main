// ==========================================
// CONFIGURACIÓN PWA (Progressive Web App)
// ==========================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Busca el sw.js en la raíz de la carpeta frontend
    // Usamos '../' porque este script se carga desde una subcarpeta
    const swPath = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/public/') 
      ? '../sw.js' 
      : './sw.js';

    navigator.serviceWorker.register(swPath)
      .then(registration => {
        console.log('✅ PWA: ServiceWorker registrado con éxito.');
      })
      .catch(error => {
        console.log('❌ PWA: Fallo al registrar ServiceWorker:', error);
      });
  });
}