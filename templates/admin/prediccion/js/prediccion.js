// Cargar información del modelo
async function cargarInfoModelo() {
  try {
    const response = await fetch(`${API_URL}/api/modelo/prediccion/info`);
    const data = await response.json();

    if (data.success) {
      modeloInfo = data.data;
      
      // Actualizar badge de estado
      const badge = document.getElementById('statusBadge');
      if (modeloInfo.calidad_global) {
        const score = Math.min(
          modeloInfo.calidad_global.denuncias.score,
          modeloInfo.calidad_global.emergencias.score
        );
        
        if (score >= 75) {
          badge.className = 'status-badge success';
          badge.innerHTML = '<span>●</span> Modelo Óptimo';
        } else if (score >= 60) {
          badge.className = 'status-badge warning';
          badge.innerHTML = '<span>●</span> Modelo Aceptable';
        }
      }

      // Actualizar info en configuración
      document.getElementById('infoArquitectura').textContent = modeloInfo.modelo.arquitectura;
      document.getElementById('infoTiposDen').textContent = modeloInfo.datos.denuncias.tipos_unicos;
      document.getElementById('infoTiposEme').textContent = modeloInfo.datos.emergencias.tipos_unicos;
      document.getElementById('infoUltimoMes').textContent = modeloInfo.datos.denuncias.ultimo_mes;
      document.getElementById('infoLookback').textContent = modeloInfo.modelo.lookback_meses;
    }
  } catch (error) {
    console.error('Error cargando info del modelo:', error);
    document.getElementById('statusBadge').className = 'status-badge warning';
    document.getElementById('statusBadge').innerHTML = '<span>●</span> Error de Conexión';
  }
}

// Guardar última predicción
function guardarUltimaPrediccion(year, month, data) {
  ultimaPrediccion = {
    year: year,
    month: month,
    fecha: data.fecha_prediccion,
    denuncias: data.denuncias,
    emergencias: data.emergencias,
    totalDenuncias: Object.values(data.denuncias).reduce((a, b) => a + b, 0),
    totalEmergencias: Object.values(data.emergencias).reduce((a, b) => a + b, 0)
  };
  
  const maxDen = Math.max(...Object.values(data.denuncias));
  const tipoMaxId = Object.keys(data.denuncias).find(k => data.denuncias[k] === maxDen);
  ultimaPrediccion.tipoMasFrecuente = DENUNCIAS_MAP[tipoMaxId] || `Tipo ${tipoMaxId}`;
  
  if (modeloInfo) {
    const precision = 100 - modeloInfo.metricas_agregadas.denuncias.mae_promedio * 2;
    ultimaPrediccion.confianzaModelo = `${Math.round(precision)}%`;
  }
}

// Predecir un mes específico
async function predecirMes() {
  const year = parseInt(document.getElementById('yearInput').value);
  const month = parseInt(document.getElementById('monthInput').value);
  
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '⏳ Prediciendo...';

  try {
    const response = await fetch(`${API_URL}/api/modelo/prediccion/predecir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month })
    });

    const data = await response.json();

    if (data.success) {
      guardarUltimaPrediccion(year, month, data.data);
      mostrarPrediccion(data.data);
    } else {
      alert('Error: ' + data.error);
    }
  } catch (error) {
    alert('Error de conexión: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔮 Predecir Mes';
  }
}

// Predecir rango de meses
async function predecirRango() {
  const year = parseInt(document.getElementById('yearInput').value);
  const month = parseInt(document.getElementById('monthInput').value);
  const meses = parseInt(document.getElementById('rangoMeses').value);
  
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '⏳ Prediciendo...';

  try {
    const response = await fetch(`${API_URL}/api/modelo/prediccion/predecir/rango`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        year_inicio: year, 
        month_inicio: month, 
        meses: meses 
      })
    });

    const data = await response.json();

    if (data.success) {
      mostrarPrediccionRango(data.data);
    } else {
      alert('Error: ' + data.error);
    }
  } catch (error) {
    alert('Error de conexión: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '📅 Predecir Rango';
  }
}

// Mostrar resultados de predicción de un mes
function mostrarPrediccion(data) {
  document.getElementById('resultadoPrediccion').style.display = 'block';
  
  const totalDen = Object.values(data.denuncias).reduce((a, b) => a + b, 0);
  const totalEme = Object.values(data.emergencias).reduce((a, b) => a + b, 0);
  
  const maxDen = Math.max(...Object.values(data.denuncias));
  const tipoMaxId = Object.keys(data.denuncias).find(k => data.denuncias[k] === maxDen);
  const tipoMaxNombre = DENUNCIAS_MAP[tipoMaxId] || `Tipo ${tipoMaxId}`;
  
  document.getElementById('totalDenuncias').textContent = totalDen;
  document.getElementById('totalEmergencias').textContent = totalEme;
  document.getElementById('tipoMasFrecuente').textContent = tipoMaxNombre;
  document.getElementById('tipoMasFrecuente').style.fontSize = '16px';
  
  if (modeloInfo && modeloInfo.metricas_agregadas) {
    const precision = 100 - modeloInfo.metricas_agregadas.denuncias.mae_promedio * 2;
    document.getElementById('confianzaModelo').textContent = `${Math.round(precision)}%`;
  }

  // Crear gráficos
  crearGraficoDenuncias(data, totalDen);
  crearGraficoEmergencias(data, totalEme);

  document.getElementById('resultadoPrediccion').scrollIntoView({ 
    behavior: 'smooth', 
    block: 'nearest' 
  });
}

// Crear gráfico de denuncias
function crearGraficoDenuncias(data, totalDen) {
  const denunciasData = Object.entries(data.denuncias).map(([id, valor]) => ({
    nombre: DENUNCIAS_MAP[id] || `Tipo ${id}`,
    valor: valor,
    id: id
  })).sort((a, b) => b.valor - a.valor);

  const labelsDen = denunciasData.map(d => d.nombre);
  const valuesDen = denunciasData.map(d => d.valor);
  
  const coloresDen = denunciasData.map(d => {
    if (['9', '10', '11', '12'].includes(d.id)) return 'rgba(244, 67, 54, 0.8)';
    if (['2', '8'].includes(d.id)) return 'rgba(255, 152, 0, 0.8)';
    if (['1', '3', '6'].includes(d.id)) return 'rgba(255, 193, 7, 0.8)';
    return 'rgba(74, 144, 226, 0.8)';
  });
  
  if (chartDenuncias) chartDenuncias.destroy();
  
  chartDenuncias = new Chart(document.getElementById('chartDenuncias'), {
    type: 'bar',
    data: {
      labels: labelsDen,
      datasets: [{
        label: 'Casos Predichos',
        data: valuesDen,
        backgroundColor: coloresDen,
        borderColor: coloresDen.map(c => c.replace('0.8', '1')),
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `📊 Predicción para ${data.fecha_prediccion} - Denuncias Ciudadanas`,
          font: { size: 16, weight: 'bold' }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const porcentaje = ((context.parsed.y / totalDen) * 100).toFixed(1);
              return `${context.parsed.y} casos (${porcentaje}% del total)`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { 
            precision: 0,
            callback: function(value) {
              return value + ' casos';
            }
          },
          title: {
            display: true,
            text: 'Cantidad de Casos Esperados'
          }
        },
        x: {
          ticks: {
            autoSkip: false,
            maxRotation: 45,
            minRotation: 45,
            font: { size: 11 }
          }
        }
      }
    }
  });
}

// Crear gráfico de emergencias
function crearGraficoEmergencias(data, totalEme) {
  const emergenciasData = Object.entries(data.emergencias)
    .filter(([id]) => id in EMERGENCIAS_MAP)
    .map(([id, valor]) => ({
      nombre: EMERGENCIAS_MAP[id],
      valor: valor
    }))
    .sort((a, b) => b.valor - a.valor);

  const labelsEme = emergenciasData.map(d => d.nombre);
  const valuesEme = emergenciasData.map(d => d.valor);
  
  const coloresEme = emergenciasData.map(d => {
    if (d.nombre.includes('Bomberos')) return 'rgba(244, 67, 54, 0.8)';
    if (d.nombre.includes('Ambulancia')) return 'rgba(33, 150, 243, 0.8)';
    if (d.nombre.includes('Policía')) return 'rgba(76, 175, 80, 0.8)';
    if (d.nombre.includes('Serenazgo')) return 'rgba(255, 152, 0, 0.8)';
    return 'rgba(156, 39, 176, 0.8)';
  });
  
  if (chartEmergencias) chartEmergencias.destroy();
  
  chartEmergencias = new Chart(document.getElementById('chartEmergencias'), {
    type: 'bar',
    data: {
      labels: labelsEme,
      datasets: [{
        label: 'Llamadas Predichas',
        data: valuesEme,
        backgroundColor: coloresEme,
        borderColor: coloresEme.map(c => c.replace('0.8', '1')),
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `🚨 Predicción para ${data.fecha_prediccion} - Llamadas de Emergencia`,
          font: { size: 16, weight: 'bold' }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const porcentaje = ((context.parsed.y / totalEme) * 100).toFixed(1);
              return `${context.parsed.y} llamadas (${porcentaje}% del total)`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { 
            precision: 0,
            callback: function(value) {
              return value + ' llamadas';
            }
          },
          title: {
            display: true,
            text: 'Cantidad de Llamadas Esperadas'
          }
        },
        x: {
          ticks: {
            font: { size: 12 }
          }
        }
      }
    }
  });
}

// Mostrar predicción de rango de meses
function mostrarPrediccionRango(data) {
  document.getElementById('resultadoPrediccion').style.display = 'block';
  
  const labels = data.map(d => d.fecha_prediccion);
  const totalDenPorMes = data.map(d => Object.values(d.denuncias).reduce((a, b) => a + b, 0));
  const totalEmePorMes = data.map(d => Object.values(d.emergencias).reduce((a, b) => a + b, 0));
  
  const avgDen = Math.round(totalDenPorMes.reduce((a, b) => a + b, 0) / totalDenPorMes.length);
  const avgEme = Math.round(totalEmePorMes.reduce((a, b) => a + b, 0) / totalEmePorMes.length);
  
  document.getElementById('totalDenuncias').innerHTML = `${avgDen}<br><small style="font-size: 14px; opacity: 0.7;">Promedio mensual</small>`;
  document.getElementById('totalEmergencias').innerHTML = `${avgEme}<br><small style="font-size: 14px; opacity: 0.7;">Promedio mensual</small>`;
  document.getElementById('tipoMasFrecuente').innerHTML = `${data.length} meses<br><small style="font-size: 14px; opacity: 0.7;">Analizados</small>`;
  document.getElementById('tipoMasFrecuente').style.fontSize = '18px';
  
  if (modeloInfo && modeloInfo.metricas_agregadas) {
    const precision = 100 - modeloInfo.metricas_agregadas.denuncias.mae_promedio * 2;
    document.getElementById('confianzaModelo').textContent = `${Math.round(precision)}%`;
  }
  
  crearGraficoRango(labels, totalDenPorMes, totalEmePorMes, data);
  crearGraficoBarrasApiladas(labels, data);
  
  document.getElementById('resultadoPrediccion').scrollIntoView({ 
    behavior: 'smooth', 
    block: 'nearest' 
  });
}

// Crear gráfico de línea para rango
function crearGraficoRango(labels, totalDenPorMes, totalEmePorMes, data) {
  if (chartDenuncias) chartDenuncias.destroy();
  
  chartDenuncias = new Chart(document.getElementById('chartDenuncias'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Denuncias Totales',
          data: totalDenPorMes,
          borderColor: 'rgba(74, 144, 226, 1)',
          backgroundColor: 'rgba(74, 144, 226, 0.2)',
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7
        },
        {
          label: 'Emergencias Totales',
          data: totalEmePorMes,
          borderColor: 'rgba(244, 67, 54, 1)',
          backgroundColor: 'rgba(244, 67, 54, 0.2)',
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Evolución Temporal de Incidencias',
          font: { size: 16, weight: 'bold' }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  });
}

// Crear gráfico de barras apiladas
function crearGraficoBarrasApiladas(labels, data) {
  const tiposTop = {};
  data.forEach(mes => {
    Object.entries(mes.denuncias).forEach(([tipo, valor]) => {
      if (!tiposTop[tipo]) tiposTop[tipo] = 0;
      tiposTop[tipo] += valor;
    });
  });
  
  const tiposOrdenados = Object.entries(tiposTop)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tipo]) => tipo);
  
  const datasets = tiposOrdenados.map((tipo, idx) => ({
    label: DENUNCIAS_MAP[tipo] || `Tipo ${tipo}`,
    data: data.map(d => d.denuncias[tipo] || 0),
    backgroundColor: `hsla(${idx * 60}, 70%, 60%, 0.8)`,
    borderWidth: 1
  }));

  if (chartEmergencias) chartEmergencias.destroy();
  
  chartEmergencias = new Chart(document.getElementById('chartEmergencias'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Top 6 Tipos de Denuncia - Distribución Mensual',
          font: { size: 16, weight: 'bold' }
        }
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true }
      }
    }
  });
}