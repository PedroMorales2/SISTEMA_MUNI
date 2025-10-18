// ==========================================
// INICIALIZACIÓN DEL SISTEMA
// ==========================================

// Variable global del mapa (declarar solo si no existe)
if (typeof map === 'undefined') {
  var map = null;
}

/**
 * Inicializa el mapa de Leaflet
 */
function inicializarMapa() {
  // Buscar el contenedor del mapa
  let mapContainer = document.getElementById('map');
  
  // Si no existe, crearlo
  if (!mapContainer) {
    console.log('📍 Creando contenedor del mapa...');
    mapContainer = document.createElement('div');
    mapContainer.id = 'map';
    mapContainer.style.cssText = `
      width: 100%;
      height: 600px;
      border-radius: 12px;
      box-shadow: 0 2px 16px rgba(0,0,0,0.1);
      margin-bottom: 30px;
      z-index: 1;
      display: none;
    `;
    
    // Insertar en el tab espacial
    const tabEspacial = document.getElementById('tab-espacial');
    if (tabEspacial) {
      const controlPanel = tabEspacial.querySelector('.control-panel');
      if (controlPanel) {
        controlPanel.parentNode.insertBefore(mapContainer, controlPanel.nextSibling);
      } else {
        tabEspacial.appendChild(mapContainer);
      }
    }
  }

  // Inicializar mapa si no existe
  if (!map) {
    try {
      console.log('🗺️ Inicializando mapa de Leaflet...');
      
      // Mostrar contenedor
      mapContainer.style.display = 'block';
      
      // Coordenadas de Chiclayo/Reque (ajusta según tu zona)
      const defaultLat = -6.8691;
      const defaultLon = -79.8197;
      
      map = L.map('map', {
        center: [defaultLat, defaultLon],
        zoom: 13,
        zoomControl: true,
        scrollWheelZoom: true
      });

      // Agregar capa de mapa (OpenStreetMap)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      // Agregar marcador inicial (opcional)
      const marker = L.marker([defaultLat, defaultLon]).addTo(map);
      marker.bindPopup('<b>REQUE</b><br>Sistema de Predicción de Incidencias').openPopup();

      console.log('✅ Mapa inicializado correctamente');
      
      // Forzar recalculación del tamaño
      setTimeout(() => {
        if (map && typeof map.invalidateSize === 'function') {
          map.invalidateSize();
        }
      }, 300);
      
    } catch (error) {
      console.error('❌ Error inicializando mapa:', error);
      if (typeof showToast !== 'undefined') {
        showToast('Error al inicializar el mapa', 'error');
      }
    }
  } else {
    // Si ya existe, solo mostrarlo y recalcular tamaño
    mapContainer.style.display = 'block';
    setTimeout(() => {
      if (map && typeof map.invalidateSize === 'function') {
        map.invalidateSize();
      }
    }, 100);
  }
  
  return map;
}

/**
 * Inicializa el sistema completo
 */
async function inicializarSistema() {
  console.log('🚀 Inicializando sistema de predicción...');
  
  try {
    // 1. Cargar información del modelo
    await cargarInfoModelo();
    
    // 2. Inicializar mapa (esperar a que el DOM esté listo)
    setTimeout(() => {
      inicializarMapa();
    }, 500);
    
    // 3. Cargar cuadrantes espaciales
    setTimeout(() => {
      inicializarMapaCuadrantes();
    }, 1000);

    // 4. Cargar métricas del modelo
    await cargarMetricas();

    // 5. Cargar recursos
    await cargarRatiosOperativos();
    
    console.log('✅ Sistema inicializado correctamente');
    
  } catch (error) {
    console.error('❌ Error en inicialización:', error);
  }
}

/**
 * Espera a que el DOM esté completamente cargado
 */
document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 DOM cargado, iniciando sistema...');
  
  // Inicializar sistema
  inicializarSistema();
  
  // Si hay un tab activo, asegurarse que se vea
  const activeTab = document.querySelector('.tab-content.active');
  if (activeTab) {
    activeTab.style.display = 'block';
  }
});

/**
 * Reinicializar mapa cuando se cambia de tab
 */
function reinicializarMapaSiEsNecesario() {
  if (map && typeof map.invalidateSize === 'function') {
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }
}

// Agregar listener para cambios de tab
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('tab-btn')) {
    setTimeout(reinicializarMapaSiEsNecesario, 200);
  }
});