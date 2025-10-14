// modales.js - Sistema de Modales Nativo (Sin Bootstrap)

/**
 * Abre un modal
 */
function abrirModal(idModal) {
    const modal = document.getElementById(idModal);
    if (!modal) {
        console.error(`❌ Modal no encontrado: ${idModal}`);
        return;
    }
    
    modal.style.display = 'flex';
    
    // Animación de entrada
    setTimeout(() => {
        modal.classList.add('show');
        const contenido = modal.querySelector('.modal-dialog');
        if (contenido) {
            contenido.classList.add('show');
        }
    }, 10);
    
    // Prevenir scroll del body
    document.body.style.overflow = 'hidden';
    
    console.log(`✓ Modal abierto: ${idModal}`);
}

/**
 * Cierra un modal
 */
function cerrarModal(idModal) {
    const modal = document.getElementById(idModal);
    if (!modal) {
        console.error(`❌ Modal no encontrado: ${idModal}`);
        return;
    }
    
    // Animación de salida
    modal.classList.remove('show');
    const contenido = modal.querySelector('.modal-dialog');
    if (contenido) {
        contenido.classList.remove('show');
    }
    
    // Esperar a que termine la animación antes de ocultar
    setTimeout(() => {
        modal.style.display = 'none';
        // Restaurar scroll del body
        document.body.style.overflow = '';
    }, 300);
    
    console.log(`✓ Modal cerrado: ${idModal}`);
}

/**
 * Cierra el modal más cercano al elemento
 */
function cerrarModalCercano(elemento) {
    const modal = elemento.closest('.modal');
    if (modal) {
        cerrarModal(modal.id);
    }
}

/**
 * Inicializa todos los modales
 */
function inicializarModales() {
    console.log('🔧 Inicializando sistema de modales...');
    
    // Obtener todos los modales
    const modales = document.querySelectorAll('.modal');
    
    if (modales.length === 0) {
        console.warn('⚠️ No se encontraron modales');
        return;
    }
    
    console.log(`✓ ${modales.length} modales encontrados`);
    
    modales.forEach(modal => {
        // Click en el overlay para cerrar
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                cerrarModal(this.id);
            }
        });
        
        // Botones de cerrar
        const botonesCerrar = modal.querySelectorAll('[data-dismiss="modal"], .btn-close');
        botonesCerrar.forEach(boton => {
            boton.addEventListener('click', function() {
                cerrarModalCercano(this);
            });
        });
    });
    
    // Cerrar modal con tecla ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modalAbierto = document.querySelector('.modal.show');
            if (modalAbierto) {
                cerrarModal(modalAbierto.id);
            }
        }
    });
    
    console.log('✓ Sistema de modales inicializado correctamente');
}

/**
 * Muestra el modal para nuevo recurso
 */
function mostrarModalNuevoRecurso() {
    document.getElementById('tituloModalRecurso').textContent = 'Agregar Nuevo Recurso';
    document.getElementById('idRecursoEdit').value = '';
    limpiarFormulario('formRecurso');
    
    // Habilitar edición del nombre
    const campoNombre = document.getElementById('nombreRecurso');
    if (campoNombre) {
        campoNombre.disabled = false;
    }
    
    abrirModal('modalRecurso');
}

/**
 * Muestra el modal para nueva configuración
 */
function mostrarModalNuevaConfiguracion() {
    document.getElementById('tituloModalConfiguracion').textContent = 'Agregar Nueva Configuración';
    document.getElementById('idConfiguracionEdit').value = '';
    limpiarFormulario('formConfiguracion');
    
    // Habilitar todos los campos
    document.getElementById('categoriaConfiguracion').disabled = false;
    document.getElementById('subcategoriaConfiguracion').disabled = false;
    document.getElementById('nombreParametro').disabled = false;
    
    abrirModal('modalConfiguracion');
}

/**
 * Muestra el modal de actualización masiva
 */
function mostrarModalActualizacionMasiva() {
    // La función ya existe en gestion_recursos.js
    // Solo abrimos el modal después de cargar los datos
    abrirModal('modalActualizacionMasiva');
}

/**
 * Muestra el modal de confirmación
 */
function mostrarModalConfirmacion() {
    abrirModal('modalConfirmacion');
}

/**
 * Muestra el modal de historial de item
 */
function mostrarModalHistorialItem() {
    abrirModal('modalHistorialItem');
}

/**
 * Muestra el modal de reset de configuraciones
 */
function mostrarModalResetConfiguraciones() {
    abrirModal('modalResetConfiguraciones');
}

console.log('✓ Módulo de Modales cargado');