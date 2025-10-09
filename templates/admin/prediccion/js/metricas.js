// Cargar métricas del modelo
async function cargarMetricas() {
  try {
    const response = await fetch(`${API_URL}/api/modelo/prediccion/info`);
    const data = await response.json();

    if (data.success) {
      const info = data.data;
      
      if (!info.calidad_global || !info.metricas_agregadas) {
        console.warn('Estructura de datos incompleta:', info);
        return;
      }
      
      // Actualizar cards de calidad
      const precisionDen = Math.max(0, 100 - info.metricas_agregadas.denuncias.mae_promedio * 2);
      const precisionEme = Math.max(0, 100 - info.metricas_agregadas.emergencias.mae_promedio * 2);
      
      document.getElementById('scoreDenuncias').textContent = `${Math.round(precisionDen)}%`;
      document.getElementById('scoreEmergencias').textContent = `${Math.round(precisionEme)}%`;
      
      let nivelDen = precisionDen >= 90 ? 'Excelente' : precisionDen >= 80 ? 'Muy Bueno' : precisionDen >= 70 ? 'Bueno' : 'Aceptable';
      let nivelEme = precisionEme >= 90 ? 'Excelente' : precisionEme >= 80 ? 'Muy Bueno' : precisionEme >= 70 ? 'Bueno' : 'Aceptable';
      
      document.getElementById('nivelDenuncias').textContent = nivelDen;
      document.getElementById('nivelEmergencias').textContent = nivelEme;
      document.getElementById('progressDenuncias').style.width = `${precisionDen}%`;
      document.getElementById('progressEmergencias').style.width = `${precisionEme}%`;
      
      document.getElementById('maeDenuncias').textContent = `±${info.metricas_agregadas.denuncias.mae_promedio.toFixed(1)}`;
      document.getElementById('maeEmergencias').textContent = `±${info.metricas_agregadas.emergencias.mae_promedio.toFixed(1)}`;
      
      if (!info.precision_por_tipo || !info.precision_por_tipo.denuncias) {
        console.warn('precision_por_tipo no disponible');
        return;
      }
      
      crearGraficoMetricas(info);
      mostrarRecomendaciones(info);
      
      if (info.datos) {
        document.getElementById('infoPeriodoDatos').textContent = info.datos.denuncias.periodo_datos;
      }
    }
  } catch (error) {
    console.error('Error cargando métricas:', error);
  }
}

// Crear gráfico de métricas por tipo
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
  
  if (chartMetricas) chartMetricas.destroy();
  
  chartMetricas = new Chart(document.getElementById('chartMetricas'), {
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
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Precisión por Tipo de Denuncia (mayor es mejor)',
          font: { size: 14, weight: 'bold' }
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
          }
        }
      }
    }
  });
}

// Mostrar recomendaciones
function mostrarRecomendaciones(info) {
  const recHtml = info.recomendaciones.map(rec => {
    const iconos = {
      'success': '✅',
      'warning': '⚠️',
      'info': 'ℹ️',
      'tip': '💡'
    };
    const clase = rec.tipo === 'warning' ? 'alert-warning' : 
                  rec.tipo === 'success' ? 'alert-success' : 'alert-warning';
    
    return `
      <div class="alert ${clase}" style="margin-bottom: 10px;">
        <span>${iconos[rec.tipo]}</span>
        <div>
          <strong>${rec.mensaje}</strong><br>
          <small style="opacity: 0.8;">${rec.accion}</small>
        </div>
      </div>
    `;
  }).join('');
  
  document.getElementById('listaRecomendaciones').innerHTML = recHtml;
}