// utils.js - Funciones auxiliares compartidas

// Verificar si API_URL ya está definido
if (typeof API_URL === 'undefined') {
    var API_URL = '{{ BASE_URL }}';
}

/**
 * Muestra el overlay de carga
 */
function mostrarLoading(mensaje) {
    mensaje = mensaje || 'Procesando...';
    const loadingMessage = document.getElementById('loadingMessage');
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    if (loadingMessage) {
        loadingMessage.textContent = mensaje;
    }
    
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

/**
 * Oculta el overlay de carga
 */
function ocultarLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}
/**
 * Muestra un toast de notificación
 */
function mostrarToast(mensaje, tipo = 'info') {
    const colores = {
        success: '#4caf50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#2196f3'
    };

    const iconos = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        border-left: 4px solid ${colores[tipo]};
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 300px;
        max-width: 500px;
        animation: slideInRight 0.3s ease-out;
    `;

    toast.innerHTML = `
        <i class="fas ${iconos[tipo]}" style="color: ${colores[tipo]}; font-size: 20px;"></i>
        <div style="flex: 1; font-size: 14px; line-height: 1.5;">${mensaje}</div>
        <button onclick="this.parentElement.remove()" 
                style="background: none; border: none; font-size: 20px; cursor: pointer; opacity: 0.5; padding: 0;">
            ×
        </button>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

/**
 * Formatea una fecha
 */
/**
 * Formatea una fecha de manera segura
 */
function formatearFecha(fecha) {
    try {
        if (!fecha) return 'N/A';
        const d = new Date(fecha);
        if (isNaN(d.getTime())) return fecha; // Si no es válida, devolver original
        
        const opciones = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        };
        return d.toLocaleString('es-ES', opciones);
    } catch (error) {
        console.error('Error formateando fecha:', fecha, error);
        return fecha || 'N/A';
    }
}

/**
 * Formatea un número
 */
function formatearNumero(numero) {
    if (numero === null || numero === undefined) return '-';
    return new Intl.NumberFormat('es-PE').format(numero);
}

/**
 * Formatea moneda
 */
function formatearMoneda(cantidad) {
    if (cantidad === null || cantidad === undefined) return '-';
    return 'S/ ' + new Intl.NumberFormat('es-PE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(cantidad);
}

/**
 * Obtiene icono según tipo de recurso
 */
function obtenerIconoRecurso(nombre) {
    const iconos = {
        'serenos': '👮',
        'policias': '🚓',
        'bomberos': '🚒',
        'ambulancias': '🚑',
        'vehiculos_serenazgo': '🚗',
        'vehiculos_policia': '🚔',
        'vehiculos_bomberos': '🚒',
        'comisarias': '🏛️',
        'estaciones_bomberos': '🏢',
        'centros_salud': '🏥'
    };
    return iconos[nombre] || '📦';
}

/**
 * Formatea nombre de recurso para mostrar
 */
function formatearNombreRecurso(nombre) {
    const nombres = {
        'serenos': 'Serenos',
        'policias': 'Policías',
        'bomberos': 'Bomberos',
        'ambulancias': 'Ambulancias',
        'vehiculos_serenazgo': 'Vehículos de Serenazgo',
        'vehiculos_policia': 'Vehículos de Policía',
        'vehiculos_bomberos': 'Vehículos de Bomberos',
        'comisarias': 'Comisarías',
        'estaciones_bomberos': 'Estaciones de Bomberos',
        'centros_salud': 'Centros de Salud'
    };
    return nombres[nombre] || nombre.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Exporta una tabla a CSV
 */
function exportarTablaCSV(tabla, nombreArchivo) {
    let csv = [];
    const rows = tabla.querySelectorAll('tr');
    
    for (let i = 0; i < rows.length; i++) {
        const row = [];
        const cols = rows[i].querySelectorAll('td, th');
        
        for (let j = 0; j < cols.length; j++) {
            let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, ' ').replace(/"/g, '""');
            row.push('"' + data + '"');
        }
        
        csv.push(row.join(','));
    }
    
    const csvString = csv.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', nombreArchivo);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Valida un formulario
 */
function validarFormulario(formId) {
    const form = document.getElementById(formId);
    if (!form) return false;
    
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
    let valido = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            input.classList.add('is-invalid');
            valido = false;
        } else {
            input.classList.remove('is-invalid');
        }
    });
    
    return valido;
}

/**
 * Limpia un formulario
 */
function limpiarFormulario(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.reset();
        form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    }
}

/**
 * Realiza una petición HTTP
 */
async function realizarPeticion(url, method = 'GET', data = null) {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(url, options);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || `HTTP ${response.status}`);
        }
        
        return result;
    } catch (error) {
        console.error('Error en petición:', error);
        throw error;
    }
}

// Agregar estilos de animación
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
    
    .is-invalid {
        border-color: #dc3545 !important;
    }
`;
document.head.appendChild(style);

console.log('✓ Utilidades cargadas correctamente');