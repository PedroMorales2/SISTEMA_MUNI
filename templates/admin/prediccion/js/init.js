// Inicialización cuando carga el DOM
document.addEventListener('DOMContentLoaded', () => {
  cargarInfoModelo();
  cargarMetricas();
  
  // Detectar modo oscuro del sistema
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark');
  }
});