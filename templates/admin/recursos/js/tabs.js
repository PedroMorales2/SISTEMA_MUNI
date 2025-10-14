// tabs.js - Sistema de Tabs Nativo

/**
 * Inicializa el sistema de tabs
 */
function inicializarTabs() {
    console.log('🔧 Inicializando sistema de tabs...');
    
    // Obtener todos los botones de tabs
    const tabButtons = document.querySelectorAll('.tab-button');
    
    if (tabButtons.length === 0) {
        console.error('❌ No se encontraron botones de tabs');
        return;
    }
    
    console.log(`✓ ${tabButtons.length} tabs encontrados`);
    
    // Agregar evento click a cada botón
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            cambiarTab(tabName);
        });
    });
    
    // Mostrar el primer tab por defecto
    const primerTab = tabButtons[0].getAttribute('data-tab');
    mostrarTab(primerTab, false);
    
    console.log('✓ Sistema de tabs inicializado correctamente');
}

/**
 * Cambia a un tab específico
 */
function cambiarTab(tabName) {
    console.log(`🔄 Cambiando a tab: ${tabName}`);
    
    // Desactivar todos los botones
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Ocultar todos los paneles
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // Activar el botón seleccionado
    const botonActivo = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
    if (botonActivo) {
        botonActivo.classList.add('active');
    }
    
    // Mostrar el panel seleccionado
    const panelActivo = document.querySelector(`.tab-panel[data-tab="${tabName}"]`);
    if (panelActivo) {
        panelActivo.classList.add('active');
        console.log(`✓ Tab activado: ${tabName}`);
        
        // Cargar datos según el tab
        cargarDatosTab(tabName);
    } else {
        console.error(`❌ No se encontró el panel: ${tabName}`);
    }
}

/**
 * Muestra un tab (usado para inicialización)
 */
function mostrarTab(tabName, cargarDatos = true) {
    const panel = document.querySelector(`.tab-panel[data-tab="${tabName}"]`);
    const button = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
    
    if (panel) panel.classList.add('active');
    if (button) button.classList.add('active');
    
    if (cargarDatos) {
        cargarDatosTab(tabName);
    }
}

/**
 * Carga los datos según el tab activo
 */
function cargarDatosTab(tabName) {
    switch(tabName) {
        case 'inventario':
            // Los recursos se cargan al inicio
            console.log('📦 Tab Inventario activo');
            break;
            
        case 'configuracion':
            if (!window.configuracionesCargadas) {
                console.log('⚙️ Cargando configuraciones...');
                try {
                    if (typeof cargarConfiguraciones === 'function') {
                        cargarConfiguraciones();
                        window.configuracionesCargadas = true;
                    } else {
                        console.error('❌ Función cargarConfiguraciones no está definida');
                    }
                } catch (error) {
                    console.error('❌ Error al cargar configuraciones:', error);
                }
            } else {
                console.log('⚙️ Configuraciones ya cargadas');
            }
            break;
            
        case 'historial':
            if (!window.historialCargado) {
                console.log('📜 Cargando historial...');
                try {
                    if (typeof cargarHistorial === 'function') {
                        cargarHistorial();
                        window.historialCargado = true;
                    } else {
                        console.error('❌ Función cargarHistorial no está definida');
                    }
                } catch (error) {
                    console.error('❌ Error al cargar historial:', error);
                }
            } else {
                console.log('📜 Historial ya cargado');
            }
            break;
            
        case 'estadisticas':
            console.log('📊 Cargando estadísticas...');
            try {
                if (typeof cargarEstadisticas === 'function') {
                    cargarEstadisticas();
                } else {
                    console.error('❌ Función cargarEstadisticas no está definida');
                }
            } catch (error) {
                console.error('❌ Error al cargar estadísticas:', error);
            }
            break;
            
        default:
            console.warn(`⚠️ Tab desconocido: ${tabName}`);
    }
}

/**
 * Obtiene el tab activo actual
 */
function obtenerTabActivo() {
    const panelActivo = document.querySelector('.tab-panel.active');
    if (panelActivo) {
        return panelActivo.getAttribute('data-tab');
    }
    return null;
}

/**
 * Navega al tab anterior
 */
function tabAnterior() {
    const tabActual = obtenerTabActivo();
    const todosLosTabs = ['inventario', 'configuracion', 'historial', 'estadisticas'];
    const indiceActual = todosLosTabs.indexOf(tabActual);
    
    if (indiceActual > 0) {
        cambiarTab(todosLosTabs[indiceActual - 1]);
    }
}

/**
 * Navega al tab siguiente
 */
function tabSiguiente() {
    const tabActual = obtenerTabActivo();
    const todosLosTabs = ['inventario', 'configuracion', 'historial', 'estadisticas'];
    const indiceActual = todosLosTabs.indexOf(tabActual);
    
    if (indiceActual < todosLosTabs.length - 1) {
        cambiarTab(todosLosTabs[indiceActual + 1]);
    }
}

// Atajos de teclado para navegar entre tabs
document.addEventListener('keydown', function(e) {
    // Alt + flecha izquierda: tab anterior
    if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        tabAnterior();
    }
    
    // Alt + flecha derecha: tab siguiente
    if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        tabSiguiente();
    }
    
    // Alt + número: ir a tab específico
    if (e.altKey && e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const tabs = ['inventario', 'configuracion', 'historial', 'estadisticas'];
        cambiarTab(tabs[parseInt(e.key) - 1]);
    }
});

console.log('✓ Módulo de Tabs cargado');