// ==========================================
// UTILIDADES - SISTEMA DE PROGRESO
// ==========================================

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