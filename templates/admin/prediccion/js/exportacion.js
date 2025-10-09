// Exportar predicción en diferentes formatos
async function exportarPrediccion(formato) {
  if (!ultimaPrediccion) {
    alert('Primero realiza una predicción antes de exportar');
    return;
  }

  showProgress(`Exportando a ${formato.toUpperCase()}...`, 'Generando documento en el servidor');
  const progressTimer = simulateProgress(3000);

  try {
    const payload = {
      year: ultimaPrediccion.year,
      month: ultimaPrediccion.month,
      metricas: document.getElementById('incluirMetricas').checked
    };

    const response = await fetch(`${API_URL}/api/exportar/${formato}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    clearInterval(progressTimer);
    updateProgress(95);

    if (response.ok) {
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        hideProgress();
        alert('Error: ' + (errorData.error || 'Error desconocido'));
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const extensiones = {
        'excel': 'xlsx',
        'pdf': 'pdf',
        'csv': 'csv',
        'json': 'json'
      };
      
      a.download = `prediccion_${ultimaPrediccion.year}_${ultimaPrediccion.month.toString().padStart(2, '0')}.${extensiones[formato]}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      updateProgress(100);
      
      // Registrar en historial
      registrarExportacion(formato);

      setTimeout(hideProgress, 500);
    } else {
      hideProgress();
      try {
        const errorData = await response.json();
        alert('Error al exportar: ' + (errorData.error || response.statusText));
      } catch {
        alert('Error al exportar: ' + response.statusText);
      }
    }
  } catch (error) {
    clearInterval(progressTimer);
    hideProgress();
    alert('Error de conexión: ' + error.message);
    console.error('Error completo:', error);
  }
}

// Exportar reporte ejecutivo completo
async function exportarReporteCompleto() {
  if (!ultimaPrediccion) {
    alert('Primero realiza una predicción antes de exportar el reporte completo');
    return;
  }

  const confirmacion = confirm(
    '¿Desea generar el Reporte Ejecutivo Completo?\n\n' +
    'Este reporte incluye:\n' +
    '• Predicciones para 6 meses\n' +
    '• Todos los gráficos y análisis\n' +
    '• Métricas de calidad detalladas\n' +
    '• Recomendaciones operativas\n' +
    '• Análisis de tendencias\n\n' +
    'El proceso puede tardar 30-60 segundos.'
  );

  if (!confirmacion) return;

  showProgress('Generando Reporte Ejecutivo Completo...', 'Procesando análisis avanzado (esto puede tardar)');
  const progressTimer = simulateProgress(8000);

  try {
    const payload = {
      year: ultimaPrediccion.year,
      month: ultimaPrediccion.month,
      metricas: true,
      graficos: true,
      analisis: true
    };

    const response = await fetch(`${API_URL}/api/exportar/completo`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    clearInterval(progressTimer);
    updateProgress(95);

    if (response.ok) {
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        hideProgress();
        alert('Error: ' + (errorData.error || 'Error desconocido'));
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_completo_${ultimaPrediccion.year}_${ultimaPrediccion.month.toString().padStart(2, '0')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      updateProgress(100);
      
      // Registrar en historial
      registrarExportacion('Reporte Completo', true);

      setTimeout(() => {
        hideProgress();
        alert('✅ Reporte Ejecutivo Completo generado exitosamente!\n\nEl documento incluye análisis detallado de 6 meses con gráficos y recomendaciones.');
      }, 500);
    } else {
      hideProgress();
      try {
        const errorData = await response.json();
        alert('Error al exportar: ' + (errorData.error || response.statusText));
      } catch {
        alert('Error al exportar: ' + response.statusText);
      }
    }
  } catch (error) {
    clearInterval(progressTimer);
    hideProgress();
    alert('Error de conexión: ' + error.message);
    console.error('Error completo:', error);
  }
}

// Registrar exportación en historial
function registrarExportacion(formato, esCompleto = false) {
  const ahora = new Date().toLocaleString('es-PE');
  const historial = document.getElementById('historialExportaciones');
  const nuevoRegistro = document.createElement('div');
  
  if (esCompleto) {
    nuevoRegistro.style.cssText = 'padding: 10px; background: rgba(74, 144, 226, 0.1); border-left: 4px solid #4a90e2; border-radius: 5px; margin-bottom: 10px;';
    nuevoRegistro.innerHTML = `📊 <strong>${formato}</strong> generado el ${ahora}`;
  } else {
    nuevoRegistro.style.cssText = 'padding: 10px; background: rgba(76, 175, 80, 0.1); border-radius: 5px; margin-bottom: 10px;';
    nuevoRegistro.innerHTML = `✅ Exportado a ${formato.toUpperCase()} el ${ahora}`;
  }
  
  historial.insertBefore(nuevoRegistro, historial.firstChild);
  
  // Limitar historial a 5 registros
  while (historial.children.length > 5) {
    historial.removeChild(historial.lastChild);
  }
}