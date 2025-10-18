// ==========================================
// NAVEGACIÓN ENTRE TABS
// ==========================================

/**
 * Cambia entre tabs
 * @param {string} tabName - Nombre del tab a activar
 */
function switchTab(tabName) {
  console.log(`📑 Cambiando a tab: ${tabName}`);
  
  // Ocultar todos los tabs
  const allTabs = document.querySelectorAll('.tab-content');
  allTabs.forEach(tab => {
    tab.classList.remove('active');
    tab.style.display = 'none';
  });
  
  // Desactivar todos los botones
  const allButtons = document.querySelectorAll('.tab-btn');
  allButtons.forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Activar el tab seleccionado
  const selectedTab = document.getElementById(`tab-${tabName}`);
  if (selectedTab) {
    selectedTab.classList.add('active');
    selectedTab.style.display = 'block';
  } else {
    console.warn(`⚠️ Tab no encontrado: tab-${tabName}`);
  }
  
  // Activar el botón correspondiente
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(btn => {
    if (btn.getAttribute('onclick')?.includes(tabName)) {
      btn.classList.add('active');
    }
  });
  
  // Si es el tab espacial, inicializar el mapa la primera vez
  if (tabName === 'espacial') {
    setTimeout(() => {
      // Si el mapa no existe, inicializarlo
      if (!map && typeof inicializarMapa === 'function') {
        console.log('🗺️ Inicializando mapa por primera vez...');
        inicializarMapa();
      } else if (map && typeof map.invalidateSize === 'function') {
        // Si ya existe, solo recalcular tamaño
        map.invalidateSize();
        console.log('🗺️ Mapa actualizado');
      }
    }, 150);
  }
  
  // Scroll al inicio
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Obtiene el tab activo actual
 */
function getActiveTab() {
  const activeTab = document.querySelector('.tab-content.active');
  if (activeTab) {
    return activeTab.id.replace('tab-', '');
  }
  return null;
}

/**
 * Verifica si un tab existe
 */
function tabExists(tabName) {
  return document.getElementById(`tab-${tabName}`) !== null;
}

/**
 * Navega al tab anterior
 */
function previousTab() {
  const tabs = ['prediccion', 'espacial', 'analisis', 'metricas', 'comparacion', 'recursos', 'exportar', 'configuracion'];
  const currentTab = getActiveTab();
  const currentIndex = tabs.indexOf(currentTab);
  
  if (currentIndex > 0) {
    switchTab(tabs[currentIndex - 1]);
  }
}

/**
 * Navega al siguiente tab
 */
function nextTab() {
  const tabs = ['prediccion', 'espacial', 'analisis', 'metricas', 'comparacion', 'recursos', 'exportar', 'configuracion'];
  const currentTab = getActiveTab();
  const currentIndex = tabs.indexOf(currentTab);
  
  if (currentIndex < tabs.length - 1) {
    switchTab(tabs[currentIndex + 1]);
  }
}

/**
 * Atajos de teclado para navegación
 */
document.addEventListener('keydown', function(e) {
  // Alt + Left Arrow: Tab anterior
  if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault();
    previousTab();
  }
  
  // Alt + Right Arrow: Siguiente tab
  if (e.altKey && e.key === 'ArrowRight') {
    e.preventDefault();
    nextTab();
  }
  
  // Alt + 1-8: Ir directamente a un tab
  if (e.altKey && e.key >= '1' && e.key <= '8') {
    e.preventDefault();
    const tabs = ['prediccion', 'espacial', 'analisis', 'metricas', 'comparacion', 'recursos', 'exportar', 'configuracion'];
    const index = parseInt(e.key) - 1;
    if (tabs[index]) {
      switchTab(tabs[index]);
    }
  }
});

/**
 * Muestra una pista de navegación
 */
function showNavigationHint() {
  const hint = document.createElement('div');
  hint.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 13px;
    z-index: 9999;
    animation: fadeInOut 3s ease;
  `;
  hint.innerHTML = `
    <strong>💡 Atajos de teclado:</strong><br>
    Alt + ← / → para cambiar tabs
  `;
  
  document.body.appendChild(hint);
  
  setTimeout(() => {
    hint.remove();
  }, 3000);
}

// Agregar animación CSS si no existe
if (!document.getElementById('navigation-animations')) {
  const style = document.createElement('style');
  style.id = 'navigation-animations';
  style.textContent = `
    @keyframes fadeInOut {
      0% { opacity: 0; transform: translateY(10px); }
      10% { opacity: 1; transform: translateY(0); }
      90% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(10px); }
    }
  `;
  document.head.appendChild(style);
}

// Mostrar hint al cargar (solo una vez)
if (!sessionStorage.getItem('navigationHintShown')) {
  setTimeout(() => {
    showNavigationHint();
    sessionStorage.setItem('navigationHintShown', 'true');
  }, 2000);
}