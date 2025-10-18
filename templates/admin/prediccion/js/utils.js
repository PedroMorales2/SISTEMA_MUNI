// ==========================================
// UTILIDADES - SISTEMA DE PROGRESO
// ==========================================

// Declarar variables globales solo si no existen
if (typeof progressModal === 'undefined') {
  var progressModal = null;
  var progressBar = null;
  var progressMessage = null;
}

// Mostrar barra de progreso
function showProgress(titulo = "Procesando...", mensaje = "Por favor espere") {
  if (!progressModal) {
    progressModal = document.createElement('div');
    progressModal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.4); display: flex;
      justify-content: center; align-items: center;
      z-index: 99999; backdrop-filter: blur(2px);
    `;
    progressModal.innerHTML = `
      <div style="background: white; border-radius: 10px; padding: 25px; width: 360px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.3)">
        <h3 id="progress-title" style="margin-bottom: 10px;">${titulo}</h3>
        <p id="progress-message" style="font-size: 14px; color: #555;">${mensaje}</p>
        <div style="background: #eee; height: 8px; border-radius: 4px; overflow: hidden; margin-top: 10px;">
          <div id="progress-bar" style="height: 8px; width: 0%; background: #4CAF50; transition: width 0.3s ease;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(progressModal);
    progressBar = document.getElementById('progress-bar');
    progressMessage = document.getElementById('progress-message');
  } else {
    document.getElementById('progress-title').textContent = titulo;
    progressMessage.textContent = mensaje;
    progressBar.style.width = '0%';
    progressModal.style.display = 'flex';
  }
}

// Actualizar progreso
function updateProgress(porcentaje, mensaje = null) {
  if (progressBar) {
    progressBar.style.width = `${porcentaje}%`;
  }
  if (mensaje && progressMessage) {
    progressMessage.textContent = mensaje;
  }
}

// Ocultar progreso
function hideProgress() {
  if (progressModal) {
    progressModal.style.display = 'none';
  }
}

// Simular progreso gradual
function simulateProgress(duracion = 4000) {
  let progreso = 0;
  const interval = setInterval(() => {
    progreso += Math.random() * 10;
    if (progreso >= 90) {
      progreso = 90;
      clearInterval(interval);
    }
    updateProgress(Math.round(progreso));
  }, duracion / 20);
  return interval;
}


// ==========================================
// SISTEMA DE NOTIFICACIONES TOAST
// ==========================================

let toastContainer = null;

/**
 * Muestra una notificación toast
 * @param {string} mensaje - Mensaje a mostrar
 * @param {string} tipo - Tipo: 'success', 'error', 'warning', 'info'
 * @param {number} duracion - Duración en milisegundos (default: 3000)
 */
function showToast(mensaje, tipo = 'info', duracion = 3000) {
  // Crear contenedor si no existe
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 100000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(toastContainer);
  }

  // Definir colores según tipo
  const colores = {
    success: { bg: '#4caf50', icon: '✓' },
    error: { bg: '#f44336', icon: '✕' },
    warning: { bg: '#ff9800', icon: '⚠' },
    info: { bg: '#2196f3', icon: 'ℹ' }
  };

  const config = colores[tipo] || colores.info;

  // Crear toast
  const toast = document.createElement('div');
  toast.style.cssText = `
    background: ${config.bg};
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 280px;
    max-width: 400px;
    animation: slideInRight 0.3s ease;
    font-size: 14px;
    font-weight: 500;
  `;

  toast.innerHTML = `
    <div style="font-size: 20px; font-weight: bold;">${config.icon}</div>
    <div style="flex: 1;">${mensaje}</div>
    <button onclick="this.parentElement.remove()" 
            style="background: none; border: none; color: white; font-size: 20px; 
                   cursor: pointer; padding: 0; width: 24px; height: 24px; 
                   display: flex; align-items: center; justify-content: center;">
      ×
    </button>
  `;

  toastContainer.appendChild(toast);

  // Auto-remover después de la duración
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duracion);
}

// Agregar animaciones CSS si no existen
if (!document.getElementById('toast-animations')) {
  const style = document.createElement('style');
  style.id = 'toast-animations';
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
  `;
  document.head.appendChild(style);
}


// ==========================================
// UTILIDADES GENERALES
// ==========================================

/**
 * Formatea un número con separadores de miles
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Formatea una fecha
 */
function formatDate(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('es-ES', options);
}

/**
 * Descarga un archivo
 */
function downloadFile(content, filename, contentType = 'text/plain') {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copia texto al portapapeles
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copiado al portapapeles', 'success');
  } catch (err) {
    console.error('Error al copiar:', err);
    showToast('Error al copiar al portapapeles', 'error');
  }
}

/**
 * Obtiene el nombre del mes
 */
function getMonthName(monthNumber) {
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return meses[monthNumber - 1] || '';
}

/**
 * Valida que un valor esté en un rango
 */
function inRange(value, min, max) {
  return value >= min && value <= max;
}

/**
 * Debounce function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Obtiene parámetros de URL
 */
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

/**
 * Scroll suave a un elemento
 */
function smoothScrollTo(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Genera un ID único
 */
function generateUniqueId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Espera un tiempo determinado (para usar con async/await)
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}