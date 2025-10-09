// Función para cambiar entre tabs
function switchTab(tabName) {
  // Ocultar todos los tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Mostrar tab seleccionado
  document.getElementById(`tab-${tabName}`).classList.add('active');
  event.target.classList.add('active');

  // Cargar datos específicos del tab
  if (tabName === 'metricas') {
    cargarMetricas();
  } else if (tabName === 'exportar') {
    verificarPrediccionParaExportar();
  }
}

// Verificar si hay predicción disponible al entrar a exportar
function verificarPrediccionParaExportar() {
  if (!ultimaPrediccion) {
    setTimeout(() => {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'alert alert-warning';
      msgDiv.style.marginBottom = '20px';
      msgDiv.innerHTML = `
        <span>ℹ️</span>
        <div>
          <strong>Información:</strong> No hay ninguna predicción activa.<br>
          <small>Ve a la pestaña "Predicción" y realiza una predicción primero. Luego podrás exportar los resultados aquí.</small>
        </div>
      `;
      
      const tabExportar = document.getElementById('tab-exportar');
      const controlPanel = tabExportar.querySelector('.control-panel');
      if (controlPanel && !controlPanel.querySelector('.alert')) {
        controlPanel.insertBefore(msgDiv, controlPanel.firstChild);
      }
    }, 100);
  }
}