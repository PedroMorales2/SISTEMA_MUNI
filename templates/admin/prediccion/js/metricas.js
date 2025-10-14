// ==========================================
// MÉTRICAS DEL MODELO
// ==========================================

/**
 * Cargar métricas del modelo
 */
async function cargarMetricas() {
  try {
    console.log('📊 Cargando métricas del modelo...');
    const response = await fetch(`${API_URL}/api/modelo/prediccion/info`);
    const data = await response.json();

    if (data.success) {
      const info = data.data;
      
      if (!info.calidad_global || !info.metricas_agregadas) {
        console.warn('⚠️ Estructura de datos incompleta:', info);
        return;
      }
      
      // Actualizar cards de calidad
      const precisionDen = Math.max(0, 100 - info.metricas_agregadas.denuncias.mae_promedio * 2);
      const precisionEme = Math.max(0, 100 - info.metricas_agregadas.emergencias.mae_promedio * 2);
      
      const scoreDenElement = document.getElementById('scoreDenuncias');
      const scoreEmeElement = document.getElementById('scoreEmergencias');
      
      if (scoreDenElement) scoreDenElement.textContent = `${Math.round(precisionDen)}%`;
      if (scoreEmeElement) scoreEmeElement.textContent = `${Math.round(precisionEme)}%`;
      
      let nivelDen = precisionDen >= 90 ? 'Excelente' : precisionDen >= 80 ? 'Muy Bueno' : precisionDen >= 70 ? 'Bueno' : 'Aceptable';
      let nivelEme = precisionEme >= 90 ? 'Excelente' : precisionEme >= 80 ? 'Muy Bueno' : precisionEme >= 70 ? 'Bueno' : 'Aceptable';
      
      const nivelDenElement = document.getElementById('nivelDenuncias');
      const nivelEmeElement = document.getElementById('nivelEmergencias');
      const progressDenElement = document.getElementById('progressDenuncias');
      const progressEmeElement = document.getElementById('progressEmergencias');
      
      if (nivelDenElement) nivelDenElement.textContent = nivelDen;
      if (nivelEmeElement) nivelEmeElement.textContent = nivelEme;
      if (progressDenElement) progressDenElement.style.width = `${precisionDen}%`;
      if (progressEmeElement) progressEmeElement.style.width = `${precisionEme}%`;
      
      const maeDenElement = document.getElementById('maeDenuncias');
      const maeEmeElement = document.getElementById('maeEmergencias');
      
      if (maeDenElement) maeDenElement.textContent = `±${info.metricas_agregadas.denuncias.mae_promedio.toFixed(1)}`;
      if (maeEmeElement) maeEmeElement.textContent = `±${info.metricas_agregadas.emergencias.mae_promedio.toFixed(1)}`;
      
      if (!info.precision_por_tipo || !info.precision_por_tipo.denuncias) {
        console.warn('⚠️ precision_por_tipo no disponible');
        return;
      }
      
      crearGraficoMetricas(info);
      mostrarRecomendaciones(info);
      
      if (info.datos) {
        const infoPeriodo = document.getElementById('infoPeriodoDatos');
        if (infoPeriodo) {
          infoPeriodo.textContent = info.datos.denuncias.periodo_datos;
        }
      }
      
      console.log('✅ Métricas cargadas correctamente');
    } else {
      console.error('❌ Error en respuesta:', data.error);
      showToast('Error al cargar métricas: ' + data.error, 'error');
    }
  } catch (error) {
    console.error('❌ Error cargando métricas:', error);
    showToast('Error de conexión al cargar métricas', 'error');
  }
}

/**
 * Crear gráfico de métricas por tipo
 */
function crearGraficoMetricas(info) {
  const precisionPorTipoDen = Object.entries(info.precision_por_tipo.denuncias).map(([id, data]) => ({
    nombre: DENUNCIAS_MAP[id] || `Tipo ${id}`,
    precision: data.precision_porcentaje,
    mae: data.mae
  })).sort((a, b) => b.precision - a.precision);
  
  const labels = precisionPorTipoDen.map(d => d.nombre);
  const precisionValues = precisionPorTipoDen.map(d => d.precision);
  
  const colores = precisionValues.map(p => {
    if (p >= 90) return 'rgba(76, 175, 80, 0.8)';
    if (p >= 80) return 'rgba(139, 195, 74, 0.8)';
    if (p >= 70) return 'rgba(255, 193, 7, 0.8)';
    return 'rgba(255, 152, 0, 0.8)';
  });
  
  const chartElement = document.getElementById('chartMetricas');
  if (!chartElement) {
    console.warn('⚠️ Elemento chartMetricas no encontrado');
    return;
  }
  
  if (chartMetricas) chartMetricas.destroy();
  
  chartMetricas = new Chart(chartElement, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Precisión del Modelo (%)',
        data: precisionValues,
        backgroundColor: colores,
        borderColor: colores.map(c => c.replace('0.8', '1')),
        borderWidth: 2
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Precisión por Tipo de Denuncia (mayor es mejor)',
          font: { size: 14, weight: 'bold' }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const item = precisionPorTipoDen[context.dataIndex];
              return [
                `Precisión: ${context.parsed.x.toFixed(1)}%`,
                `Error promedio: ±${item.mae.toFixed(1)} casos`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          min: 0,
          max: 100,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          },
          title: {
            display: true,
            text: 'Precisión del Modelo (%)'
          }
        },
        y: {
          ticks: {
            font: { size: 11 }
          }
        }
      }
    }
  });
  
  console.log('✅ Gráfico de métricas creado');
}

/**
 * Mostrar recomendaciones
 */
function mostrarRecomendaciones(info) {
  const listaElement = document.getElementById('listaRecomendaciones');
  if (!listaElement) {
    console.warn('⚠️ Elemento listaRecomendaciones no encontrado');
    return;
  }
  
  if (!info.recomendaciones || info.recomendaciones.length === 0) {
    listaElement.innerHTML = '<p style="color: #999;">No hay recomendaciones disponibles</p>';
    return;
  }
  
  const iconos = {
    'success': '✅',
    'warning': '⚠️',
    'info': 'ℹ️',
    'tip': '💡'
  };
  
  const recHtml = info.recomendaciones.map(rec => {
    const clase = rec.tipo === 'warning' ? 'alert-warning' : 
                  rec.tipo === 'success' ? 'alert-success' : 
                  rec.tipo === 'info' ? 'alert-warning' : 'alert-warning';
    
    return `
      <div class="alert ${clase}" style="margin-bottom: 10px;">
        <span style="font-size: 20px;">${iconos[rec.tipo] || 'ℹ️'}</span>
        <div style="flex: 1;">
          <strong>${rec.mensaje}</strong><br>
          <small style="opacity: 0.8;">${rec.accion}</small>
        </div>
      </div>
    `;
  }).join('');
  
  listaElement.innerHTML = recHtml;
  console.log('✅ Recomendaciones mostradas');
}

/**
 * Exportar métricas a CSV
 */
function exportarMetricasCSV() {
  if (!chartMetricas || !chartMetricas.data) {
    showToast('No hay métricas para exportar', 'warning');
    return;
  }
  
  let csv = 'Tipo_Denuncia,Precision_Porcentaje,Error_MAE\n';
  
  const labels = chartMetricas.data.labels;
  const precisionValues = chartMetricas.data.datasets[0].data;
  
  labels.forEach((label, index) => {
    csv += `"${label}",${precisionValues[index].toFixed(2)}\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `metricas_modelo_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast('Métricas exportadas exitosamente', 'success');
}