/**
 * ============================================================================
 * MÓDULO DE GESTIÓN Y ASIGNACIÓN DE RECURSOS MUNICIPALES
 * ============================================================================
 * 
 * Este módulo provee funcionalidad avanzada para:
 * - Calcular recursos necesarios basados en predicciones de ML
 * - Comparar con inventario actual del municipio
 * - Generar análisis de brechas (gap analysis)
 * - Producir recomendaciones estratégicas de asignación
 * 
 * @module recursos
 * @requires config.js - Configuración global (API_URL, DENUNCIAS_MAP, EMERGENCIAS_MAP)
 * @requires Chart.js - Librería de visualización de datos
 * @requires utils.js - Funciones auxiliares (showProgress, hideProgress)
 * 
 * @author Sistema de Gestión Municipal
 * @version 2.0.0
 * ============================================================================
 */

// ============================================================================
// CONFIGURACIÓN Y CONSTANTES DEL MÓDULO
// ============================================================================

/**
 * Ratios de eficiencia operativa (casos o llamadas por recurso/mes)
 * Estos valores pueden ajustarse según estándares municipales específicos
 */
const RATIOS_OPERATIVOS = {
  SERENO: {
    llamadas: 15,           // Llamadas que puede atender un sereno al mes
    casos: 8                // Casos de denuncia que puede gestionar
  },
  POLICIA: {
    llamadas: 20,           // Llamadas de emergencia por policía
    casos: 12               // Casos administrativos
  },
  BOMBERO: {
    llamadas: 30,           // Llamadas por bombero (trabajan en brigadas)
    casos: 5                // Casos de prevención
  },
  AMBULANCIA: {
    llamadas: 25,           // Llamadas médicas por ambulancia
    turnos: 3               // Turnos diarios de 8 horas
  },
  VEHICULO: {
    serenazgo: 50,          // Llamadas por vehículo de serenazgo
    policia: 60,            // Llamadas por patrulla policial
    bomberos: 40,           // Emergencias por camión de bomberos
    vida_util: 120          // Meses de vida útil promedio
  },
  PRESUPUESTO: {
    costo_por_caso: 50,     // Soles por caso atendido
    overhead: 1.15          // 15% de overhead operativo
  },
  TIEMPO: {
    horas_por_caso: 2,      // Horas-hombre por caso
    dias_laborables: 22     // Días laborables por mes
  }
};

/**
 * Cache de recursos actuales del municipio
 * @type {Object|null}
 */
let recursosActualesCache = null;

/**
 * Timestamp del último fetch exitoso
 * @type {number|null}
 */
let ultimoFetchRecursos = null;

/**
 * Tiempo de vida del cache en milisegundos (5 minutos)
 * @type {number}
 */
const CACHE_TTL = 5 * 60 * 1000;

// ============================================================================
// FUNCIONES PRINCIPALES
// ============================================================================

/**
 * Obtiene el inventario actual de recursos municipales
 * Implementa cache para reducir llamadas al servidor
 * 
 * @async
 * @returns {Promise<Object|null>} Objeto con recursos o null si falla
 * @throws {Error} Si la petición al servidor falla
 */
async function obtenerRecursosActuales() {
  try {
    // Verificar cache válido
    const ahora = Date.now();
    if (recursosActualesCache && ultimoFetchRecursos && 
        (ahora - ultimoFetchRecursos) < CACHE_TTL) {
      console.log('✓ Usando recursos desde cache');
      return recursosActualesCache;
    }

    console.log('→ Consultando inventario de recursos al servidor...');
    const response = await fetch(`${API_URL}/api/recursos/inventario`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success && data.data) {
      const recursosValidos = validarEstructuraRecursos(data.data);
      
      if (recursosValidos) {
        recursosActualesCache = data.data;
        ultimoFetchRecursos = ahora;
        console.log('✓ Recursos obtenidos y validados correctamente');
        return recursosActualesCache;
      } else {
        console.warn('⚠ Estructura de recursos inválida');
        return null;
      }
    } else {
      console.warn('⚠ Respuesta sin datos válidos:', data.error || 'Error desconocido');
      return null;
    }
  } catch (error) {
    console.error('✗ Error crítico obteniendo recursos:', error);
    if (recursosActualesCache) {
      console.warn('⚠ Usando cache antiguo debido a error de conexión');
      return recursosActualesCache;
    }
    return null;
  }
}

/**
 * Valida que el objeto de recursos tenga la estructura correcta
 */
function validarEstructuraRecursos(recursos) {
  const camposRequeridos = [
    'serenos', 'policias', 'bomberos',
    'vehiculos_serenazgo', 'vehiculos_policia', 'vehiculos_bomberos',
    'ambulancias', 'comisarias', 'estaciones_bomberos', 'centros_salud'
  ];

  return camposRequeridos.every(campo => {
    const valido = typeof recursos[campo] === 'number' && recursos[campo] >= 0;
    if (!valido) {
      console.warn(`⚠ Campo inválido o faltante: ${campo}`);
    }
    return valido;
  });
}

/**
 * Punto de entrada principal: Calcula recursos necesarios para un mes específico
 */
async function calcularRecursos() {
  const mesPlan = document.getElementById('mesPlanificacion')?.value;
  
  if (!mesPlan) {
    mostrarAlerta('Por favor, seleccione un mes para planificar', 'warning');
    return;
  }

  const [year, month] = mesPlan.split('-').map(Number);
  
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    mostrarAlerta('Formato de fecha inválido', 'error');
    return;
  }

  showProgress(
    'Calculando Asignación de Recursos',
    'Obteniendo predicciones y consultando inventario municipal...'
  );
  
  try {
    const [recursosExistentes, prediccionResponse] = await Promise.all([
      obtenerRecursosActuales(),
      fetch(`${API_URL}/api/modelo/prediccion/predecir`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ year, month })
      }).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
    ]);

    hideProgress();

    if (!prediccionResponse.success || !prediccionResponse.data) {
      throw new Error(prediccionResponse.error || 'Predicción no disponible');
    }

    generarPlanCompleto(prediccionResponse.data, recursosExistentes);
    
  } catch (error) {
    hideProgress();
    console.error('✗ Error en cálculo de recursos:', error);
    mostrarAlerta(
      `Error al calcular recursos: ${error.message}. Verifique la conexión con el servidor.`,
      'error'
    );
  }
}

// ============================================================================
// LÓGICA DE CÁLCULO DE RECURSOS NECESARIOS
// ============================================================================

function calcularRecursosNecesarios(prediccion) {
  const totalDenuncias = Object.values(prediccion.denuncias).reduce((sum, val) => sum + val, 0);
  const totalEmergencias = Object.values(prediccion.emergencias).reduce((sum, val) => sum + val, 0);
  
  const emergenciasPorServicio = {
    policia: prediccion.emergencias[2] || 0,
    serenazgo: prediccion.emergencias[3] || 0,
    ambulancia: prediccion.emergencias[4] || 0,
    bomberos: (prediccion.emergencias[5] || 0) + (prediccion.emergencias[6] || 0)
  };
  
  const personalNecesario = {
    serenos: Math.ceil(emergenciasPorServicio.serenazgo / RATIOS_OPERATIVOS.SERENO.llamadas),
    policias: Math.ceil(emergenciasPorServicio.policia / RATIOS_OPERATIVOS.POLICIA.llamadas),
    bomberos: Math.ceil(emergenciasPorServicio.bomberos / RATIOS_OPERATIVOS.BOMBERO.llamadas),
    personal_denuncias: Math.ceil(totalDenuncias / RATIOS_OPERATIVOS.SERENO.casos)
  };
  
  const vehiculosNecesarios = {
    vehiculos_serenazgo: Math.ceil(emergenciasPorServicio.serenazgo / RATIOS_OPERATIVOS.VEHICULO.serenazgo),
    vehiculos_policia: Math.ceil(emergenciasPorServicio.policia / RATIOS_OPERATIVOS.VEHICULO.policia),
    vehiculos_bomberos: Math.ceil(emergenciasPorServicio.bomberos / RATIOS_OPERATIVOS.VEHICULO.bomberos),
    ambulancias: Math.ceil(emergenciasPorServicio.ambulancia / RATIOS_OPERATIVOS.AMBULANCIA.llamadas)
  };
  
  const totalCasos = totalDenuncias + totalEmergencias;
  const presupuesto = Math.round(totalCasos * RATIOS_OPERATIVOS.PRESUPUESTO.costo_por_caso * 
                                 RATIOS_OPERATIVOS.PRESUPUESTO.overhead);
  const horasHombre = totalCasos * RATIOS_OPERATIVOS.TIEMPO.horas_por_caso;
  
  return {
    personal: personalNecesario,
    vehiculos: vehiculosNecesarios,
    metricas: {
      total_personal: Object.values(personalNecesario).reduce((sum, val) => sum + val, 0),
      total_vehiculos: Object.values(vehiculosNecesarios).reduce((sum, val) => sum + val, 0),
      presupuesto_mensual: presupuesto,
      horas_hombre: horasHombre,
      casos_totales: totalCasos
    },
    emergencias_por_servicio: emergenciasPorServicio
  };
}

function calcularAnalisisGap(necesarios, existentes) {
  if (!existentes) return null;
  
  const gaps = {
    personal: {
      serenos: existentes.serenos - necesarios.personal.serenos,
      policias: existentes.policias - necesarios.personal.policias,
      bomberos: existentes.bomberos - necesarios.personal.bomberos
    },
    vehiculos: {
      vehiculos_serenazgo: existentes.vehiculos_serenazgo - necesarios.vehiculos.vehiculos_serenazgo,
      vehiculos_policia: existentes.vehiculos_policia - necesarios.vehiculos.vehiculos_policia,
      vehiculos_bomberos: existentes.vehiculos_bomberos - necesarios.vehiculos.vehiculos_bomberos,
      ambulancias: existentes.ambulancias - necesarios.vehiculos.ambulancias
    }
  };
  
  const totalGapPersonal = Object.values(gaps.personal).reduce((sum, val) => sum + val, 0);
  const totalGapVehiculos = Object.values(gaps.vehiculos).reduce((sum, val) => sum + val, 0);
  
  const deficitsCriticos = [];
  
  Object.entries(gaps.personal).forEach(([tipo, gap]) => {
    const porcentajeDeficit = (gap / necesarios.personal[tipo]) * 100;
    if (porcentajeDeficit < -20) {
      deficitsCriticos.push({
        categoria: 'Personal',
        tipo: tipo.charAt(0).toUpperCase() + tipo.slice(1),
        deficit: Math.abs(gap),
        actual: existentes[tipo],
        necesario: necesarios.personal[tipo],
        porcentaje: Math.abs(porcentajeDeficit).toFixed(1)
      });
    }
  });
  
  Object.entries(gaps.vehiculos).forEach(([tipo, gap]) => {
    const porcentajeDeficit = (gap / necesarios.vehiculos[tipo]) * 100;
    if (porcentajeDeficit < -20) {
      deficitsCriticos.push({
        categoria: 'Vehículos',
        tipo: tipo.replace('vehiculos_', '').replace('_', ' ').toUpperCase(),
        deficit: Math.abs(gap),
        actual: existentes[tipo],
        necesario: necesarios.vehiculos[tipo],
        porcentaje: Math.abs(porcentajeDeficit).toFixed(1)
      });
    }
  });
  
  return {
    gaps,
    totales: {
      personal: totalGapPersonal,
      vehiculos: totalGapVehiculos
    },
    estado: totalGapPersonal >= 0 && totalGapVehiculos >= 0 ? 'suficiente' : 'deficit',
    deficits_criticos: deficitsCriticos
  };
}

// ============================================================================
// GENERACIÓN DEL PLAN COMPLETO
// ============================================================================

function generarPlanCompleto(prediccion, recursosExistentes) {
  console.log('→ Generando plan completo de recursos...');
  
  const contenedor = document.getElementById('resultadoRecursos');
  if (contenedor) {
    contenedor.style.display = 'block';
  }
  
  const recursosCalculados = calcularRecursosNecesarios(prediccion);
  const gapAnalysis = calcularAnalisisGap(recursosCalculados, recursosExistentes);
  
  actualizarMetricasGenerales(recursosCalculados, recursosExistentes, gapAnalysis);
  generarVisualizaciones(recursosCalculados, recursosExistentes, prediccion);
  generarRecomendacionesEstrategicas(prediccion, recursosCalculados, recursosExistentes, gapAnalysis);
  
  contenedor?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  
  console.log('✓ Plan de recursos generado exitosamente');
}

// ============================================================================
// ACTUALIZACIÓN DE INTERFAZ DE USUARIO
// ============================================================================

function actualizarMetricasGenerales(calculados, existentes, gaps) {
  const personalHTML = generarHTMLPersonal(calculados, existentes, gaps);
  actualizarElemento('personalRequerido', personalHTML, true);
  
  const vehiculosHTML = generarHTMLVehiculos(calculados, existentes, gaps);
  actualizarElemento('vehiculosNecesarios', vehiculosHTML, true);
  
  const presupuestoFormatted = formatearMoneda(calculados.metricas.presupuesto_mensual);
  actualizarElemento('presupuestoEstimado', presupuestoFormatted);
  
  const horasFormatted = calculados.metricas.horas_hombre.toLocaleString('es-PE');
  actualizarElemento('horasTrabajo', horasFormatted);
}

function generarHTMLPersonal(calculados, existentes, gaps) {
  const necesario = calculados.metricas.total_personal;
  let html = `<strong>${necesario}</strong>`;
  
  if (existentes && gaps) {
    const actual = existentes.serenos + existentes.policias + existentes.bomberos;
    const statusIcon = gaps.totales.personal >= 0 ? '✅' : '⚠️';
    const statusColor = gaps.totales.personal >= 0 ? '#4caf50' : '#ff9800';
    const diferencia = gaps.totales.personal;
    
    html += `
      <br>
      <small style="font-size: 13px; opacity: 0.85; color: ${statusColor};">
        Actuales: ${actual} ${statusIcon}
        ${diferencia !== 0 ? `(${diferencia > 0 ? '+' : ''}${diferencia})` : ''}
      </small>
    `;
  }
  
  return html;
}

function generarHTMLVehiculos(calculados, existentes, gaps) {
  const necesario = calculados.metricas.total_vehiculos;
  let html = `<strong>${necesario}</strong>`;
  
  if (existentes && gaps) {
    const actual = existentes.vehiculos_serenazgo + existentes.vehiculos_policia + 
                   existentes.vehiculos_bomberos + existentes.ambulancias;
    const statusIcon = gaps.totales.vehiculos >= 0 ? '✅' : '⚠️';
    const statusColor = gaps.totales.vehiculos >= 0 ? '#4caf50' : '#ff9800';
    const diferencia = gaps.totales.vehiculos;
    
    html += `
      <br>
      <small style="font-size: 13px; opacity: 0.85; color: ${statusColor};">
        Actuales: ${actual} ${statusIcon}
        ${diferencia !== 0 ? `(${diferencia > 0 ? '+' : ''}${diferencia})` : ''}
      </small>
    `;
  }
  
  return html;
}

// ============================================================================
// VISUALIZACIONES Y GRÁFICOS
// ============================================================================

function generarVisualizaciones(calculados, existentes, prediccion) {
  if (existentes) {
    crearGraficoComparativoRecursos(calculados, existentes);
  } else {
    crearGraficoRecursosNecesarios(calculados);
  }
  
  crearGraficoDistribucionEmergencias(calculados.emergencias_por_servicio);
}

function crearGraficoComparativoRecursos(calculados, existentes) {
  if (chartRecursos) chartRecursos.destroy();
  
  const labels = [
    'Serenos', 'Policías', 'Bomberos', 'Personal\nDenuncias',
    'Veh. Serenazgo', 'Veh. Policía', 'Veh. Bomberos', 'Ambulancias'
  ];
  
  const datosNecesarios = [
    calculados.personal.serenos,
    calculados.personal.policias,
    calculados.personal.bomberos,
    calculados.personal.personal_denuncias,
    calculados.vehiculos.vehiculos_serenazgo,
    calculados.vehiculos.vehiculos_policia,
    calculados.vehiculos.vehiculos_bomberos,
    calculados.vehiculos.ambulancias
  ];
  
  const datosExistentes = [
    existentes.serenos,
    existentes.policias,
    existentes.bomberos,
    0,
    existentes.vehiculos_serenazgo,
    existentes.vehiculos_policia,
    existentes.vehiculos_bomberos,
    existentes.ambulancias
  ];
  
  const ctx = document.getElementById('chartRecursos');
  if (!ctx) {
    console.error('✗ Canvas chartRecursos no encontrado');
    return;
  }
  
  chartRecursos = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Disponibles Actualmente',
          data: datosExistentes,
          backgroundColor: 'rgba(76, 175, 80, 0.75)',
          borderColor: 'rgba(76, 175, 80, 1)',
          borderWidth: 2,
          borderRadius: 4
        },
        {
          label: 'Requeridos Según Predicción',
          data: datosNecesarios,
          backgroundColor: 'rgba(33, 150, 243, 0.75)',
          borderColor: 'rgba(33, 150, 243, 1)',
          borderWidth: 2,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        title: {
          display: true,
          text: 'Análisis Comparativo: Recursos Disponibles vs Requeridos',
          font: { size: 16, weight: '600' },
          padding: { top: 10, bottom: 20 }
        },
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: { size: 13, weight: '600' },
          bodyFont: { size: 12 },
          callbacks: {
            afterLabel: function(context) {
              const idx = context.dataIndex;
              if (idx === 3) return '';
              
              const disponible = datosExistentes[idx];
              const requerido = datosNecesarios[idx];
              const diferencia = disponible - requerido;
              
              if (diferencia >= 0) {
                return `✓ Suficiente (${diferencia > 0 ? '+' + diferencia : 'exacto'})`;
              } else {
                const deficit = Math.abs(diferencia);
                const porcentaje = ((deficit / requerido) * 100).toFixed(1);
                return `⚠ Déficit: ${deficit} unidades (${porcentaje}%)`;
              }
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { 
            precision: 0,
            font: { size: 11 }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: { size: 10 },
            maxRotation: 45,
            minRotation: 0
          }
        }
      }
    }
  });
}

function crearGraficoRecursosNecesarios(calculados) {
  if (chartRecursos) chartRecursos.destroy();
  
  const ctx = document.getElementById('chartRecursos');
  if (!ctx) return;
  
  chartRecursos = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Serenos', 'Policías', 'Bomberos', 'Ambulancias'],
      datasets: [{
        label: 'Recursos Requeridos',
        data: [
          calculados.personal.serenos,
          calculados.personal.policias,
          calculados.personal.bomberos,
          calculados.vehiculos.ambulancias
        ],
        backgroundColor: 'rgba(33, 150, 243, 0.75)',
        borderColor: 'rgba(33, 150, 243, 1)',
        borderWidth: 2,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Recursos Necesarios Según Predicción',
          font: { size: 16, weight: '600' }
        },
        legend: { display: false }
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

function crearGraficoDistribucionEmergencias(emergenciasPorServicio) {
  let canvas = document.getElementById('chartDistribucionEmergencias');
  
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'chartDistribucionEmergencias';
    canvas.style.maxHeight = '320px';
    canvas.style.marginTop = '30px';
    
    const container = document.getElementById('chartRecursos')?.parentElement;
    if (container) {
      const separador = document.createElement('hr');
      separador.style.cssText = 'margin: 30px 0; border: none; border-top: 2px solid rgba(0,0,0,0.1);';
      container.appendChild(separador);
      container.appendChild(canvas);
    }
  }
  
  const labels = Object.keys(emergenciasPorServicio).map(key => {
    const nombres = {
      'policia': 'Policía Nacional',
      'serenazgo': 'Serenazgo Municipal',
      'ambulancia': 'Servicio Médico',
      'bomberos': 'Cuerpo de Bomberos'
    };
    return nombres[key] || key;
  });
  
  const valores = Object.values(emergenciasPorServicio);
  
  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: valores,
        backgroundColor: [
          'rgba(76, 175, 80, 0.85)',
          'rgba(255, 152, 0, 0.85)',
          'rgba(33, 150, 243, 0.85)',
          'rgba(244, 67, 54, 0.85)'
        ],
        borderColor: '#ffffff',
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        title: {
          display: true,
          text: 'Distribución de Llamadas de Emergencia por Servicio',
          font: { size: 15, weight: '600' },
          padding: { top: 10, bottom: 15 }
        },
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            font: { size: 12 },
            generateLabels: function(chart) {
              const data = chart.data;
              const total = valores.reduce((sum, val) => sum + val, 0);
              
              return data.labels.map((label, i) => {
                const value = data.datasets[0].data[i];
                const percentage = ((value / total) * 100).toFixed(1);
                return {
                  text: `${label}: ${value} (${percentage}%)`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  hidden: false,
                  index: i
                };
              });
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed;
              const total = valores.reduce((sum, val) => sum + val, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value} llamadas (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

// ============================================================================
// GENERACIÓN DE RECOMENDACIONES ESTRATÉGICAS
// ============================================================================

function generarRecomendacionesEstrategicas(prediccion, calculados, existentes, gaps) {
  let html = `
    <div class="recomendaciones-header">
      <h4 style="margin: 0 0 10px 0; font-size: 18px; color: #ffff;">
        📋 Plan Estratégico de Asignación de Recursos
      </h4>
      <p style="margin: 0; font-size: 13px; opacity: 0.7; line-height: 1.6;">
        Mes objetivo: <strong>${prediccion.fecha_prediccion}</strong> | 
        Casos totales proyectados: <strong>${calculados.metricas.casos_totales}</strong>
      </p>
    </div>
  `;

  html += generarSeccionEstadoGeneral(gaps, existentes);

  if (gaps && gaps.deficits_criticos && gaps.deficits_criticos.length > 0) {
    html += generarTablaDeficitsCriticos(gaps.deficits_criticos);
  }

  html += generarResumenEjecutivo(calculados, existentes);
  html += generarRecomendacionesOperativas(calculados, existentes, gaps);
  html += generarIndicadoresDesempeno(calculados, gaps);

  actualizarElemento('planAccion', html, true);
}

function generarSeccionEstadoGeneral(gaps, existentes) {
  if (!gaps || !existentes) {
    return `
      <div class="alert alert-warning" style="margin: 20px 0; padding: 16px; border-left: 4px solid #ff9800; background: rgba(255, 152, 0, 0.08); border-radius: 6px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 24px;">ℹ️</span>
          <div>
            <strong style="font-size: 14px;">Inventario No Disponible</strong>
            <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;">
              No se pudo conectar con el sistema de inventario municipal. 
              Los cálculos se basan únicamente en las predicciones del modelo.
              <br><small>Verifique la conexión con el endpoint: <code>/api/recursos/inventario</code></small>
            </p>
          </div>
        </div>
      </div>
    `;
  }

  const estado = gaps.estado;
  const config = {
    suficiente: {
      icon: '✅',
      color: '#4caf50',
      bg: 'rgba(76, 175, 80, 0.08)',
      titulo: 'Estado Óptimo - Recursos Suficientes',
      mensaje: 'Los recursos actuales del municipio son suficientes para atender la demanda proyectada. Se recomienda mantener el nivel operativo actual y estar preparados para variaciones.'
    },
    deficit: {
      icon: '⚠️',
      color: '#ff9800',
      bg: 'rgba(255, 152, 0, 0.08)',
      titulo: 'Atención Requerida - Déficit Detectado',
      mensaje: 'Se identificaron brechas en la disponibilidad de recursos. Es necesario implementar medidas correctivas para garantizar una respuesta efectiva ante la demanda proyectada.'
    }
  };

  const cfg = config[estado];

  return `
    <div class="alert" style="margin: 20px 0; padding: 16px; border-left: 4px solid ${cfg.color}; background: ${cfg.bg}; border-radius: 6px;">
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <span style="font-size: 26px; line-height: 1;">${cfg.icon}</span>
        <div style="flex: 1;">
          <strong style="font-size: 14px; color: ${cfg.color};">${cfg.titulo}</strong>
          <p style="margin: 8px 0 0 0; font-size: 13px; line-height: 1.6; opacity: 0.95;">
            ${cfg.mensaje}
          </p>
          <div style="margin-top: 12px; display: flex; gap: 20px; font-size: 12px;">
            <span>
              <strong>Balance Personal:</strong> 
              <span style="color: ${gaps.totales.personal >= 0 ? '#4caf50' : '#f44336'};">
                ${gaps.totales.personal >= 0 ? '+' : ''}${gaps.totales.personal}
              </span>
            </span>
            <span>
              <strong>Balance Vehículos:</strong> 
              <span style="color: ${gaps.totales.vehiculos >= 0 ? '#4caf50' : '#f44336'};">
                ${gaps.totales.vehiculos >= 0 ? '+' : ''}${gaps.totales.vehiculos}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function generarTablaDeficitsCriticos(deficits) {
  return `
    <div style="margin: 25px 0;">
      <h5 style="color: #f44336; margin: 0 0 15px 0; font-size: 15px; display: flex; align-items: center; gap: 8px;">
        🚨 Déficits Críticos Identificados
        <span style="background: #f44336; color: white; font-size: 11px; padding: 2px 8px; border-radius: 12px;">
          ${deficits.length} alerta${deficits.length > 1 ? 's' : ''}
        </span>
      </h5>
      <p style="margin: 0 0 15px 0; font-size: 13px; opacity: 0.7; line-height: 1.5;">
        Los siguientes recursos presentan déficits superiores al 20%, lo que puede comprometer 
        la capacidad de respuesta del sistema municipal.
      </p>
      <div style="overflow-x: auto;">
        <table class="comparison-table" style="width: 100%; font-size: 13px;">
          <thead>
            <tr style="background: rgba(244, 67, 54, 0.08);">
              <th style="padding: 12px 10px;">Recurso</th>
              <th style="text-align: center;">Disponible</th>
              <th style="text-align: center;">Requerido</th>
              <th style="text-align: center;">Déficit</th>
              <th style="text-align: center;">Criticidad</th>
              <th>Acción Recomendada</th>
            </tr>
          </thead>
          <tbody>
            ${deficits.map(d => {
              const nivelCriticidad = parseFloat(d.porcentaje) > 50 ? 'ALTA' : 
                                     parseFloat(d.porcentaje) > 30 ? 'MEDIA' : 'BAJA';
              const colorCriticidad = nivelCriticidad === 'ALTA' ? '#d32f2f' : 
                                     nivelCriticidad === 'MEDIA' ? '#f57c00' : '#fbc02d';
              
              const accion = obtenerAccionRecomendada(d.tipo, d.categoria);
              
              return `
                <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
                  <td style="padding: 12px 10px;">
                    <strong>${d.tipo}</strong>
                    <br><small style="opacity: 0.6;">${d.categoria}</small>
                  </td>
                  <td style="text-align: center; padding: 12px 10px;">${d.actual}</td>
                  <td style="text-align: center; padding: 12px 10px;">${d.necesario}</td>
                  <td style="text-align: center; padding: 12px 10px; color: #f44336; font-weight: 600;">
                    -${d.deficit}
                  </td>
                  <td style="text-align: center; padding: 12px 10px;">
                    <span style="background: ${colorCriticidad}; color: white; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                      ${nivelCriticidad}
                    </span>
                    <br><small style="opacity: 0.7; font-size: 11px;">${d.porcentaje}%</small>
                  </td>
                  <td style="padding: 12px 10px; font-size: 12px; line-height: 1.5;">
                    ${accion}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function obtenerAccionRecomendada(tipo, categoria) {
  const acciones = {
    'Serenos': '• Contratar personal temporal<br>• Activar horas extras<br>• Coordinar con policía municipal',
    'Policías': '• Solicitar refuerzos a comisarías vecinas<br>• Redistribuir turnos<br>• Activar protocolo de emergencia',
    'Bomberos': '• Coordinar con estaciones cercanas<br>• Activar voluntarios capacitados<br>• Solicitar apoyo regional',
    'Ambulancias': '• Alquilar unidades móviles<br>• Convenio con clínicas privadas<br>• Optimizar rutas de respuesta',
    'SERENAZGO': '• Alquiler a corto plazo<br>• Reasignar de otras áreas<br>• Mantenimiento urgente de unidades',
    'POLICIA': '• Coordinación interinstitucional<br>• Uso de vehículos de respaldo<br>• Priorizar zonas críticas',
    'BOMBEROS': '• Solicitar préstamo a municipios vecinos<br>• Activar unidades de reserva<br>• Convenios de ayuda mutua'
  };

  return acciones[tipo] || acciones[tipo.toUpperCase()] || '• Evaluar opciones disponibles<br>• Consultar con área de logística';
}

function generarResumenEjecutivo(calculados, existentes) {
  const hasDatos = !!existentes;
  
  return `
    <div style="margin: 25px 0;">
      <h5 style="margin: 0 0 15px 0; font-size: 15px; color: #ffff;">
        📊 Resumen Ejecutivo de Recursos
      </h5>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
        ${generarCardResumen('👥 Personal de Campo', 
          `${calculados.personal.serenos} serenos<br>
           ${calculados.personal.policias} policías<br>
           ${calculados.personal.bomberos} bomberos`,
          hasDatos ? `${existentes.serenos + existentes.policias + existentes.bomberos} disponibles` : null)}
        
        ${generarCardResumen('🚗 Flota Vehicular', 
          `${calculados.vehiculos.vehiculos_serenazgo + calculados.vehiculos.vehiculos_policia} patrullas<br>
           ${calculados.vehiculos.ambulancias} ambulancias<br>
           ${calculados.vehiculos.vehiculos_bomberos} unidades de bomberos`,
          hasDatos ? `${existentes.vehiculos_serenazgo + existentes.vehiculos_policia + existentes.ambulancias + existentes.vehiculos_bomberos} disponibles` : null)}
        
        ${generarCardResumen('💰 Presupuesto Mensual', 
          formatearMoneda(calculados.metricas.presupuesto_mensual),
          'Incluye 15% overhead')}
        
        ${generarCardResumen('⏱️ Carga Operativa', 
          `${calculados.metricas.horas_hombre.toLocaleString('es-PE')} horas-hombre<br>
           ${calculados.metricas.casos_totales} casos totales`,
          `${(calculados.metricas.horas_hombre / RATIOS_OPERATIVOS.TIEMPO.dias_laborables).toFixed(0)} horas/día promedio`)}
      </div>
    </div>
  `;
}

function generarCardResumen(titulo, contenido, footer) {
  return `
    <div style="background: rgba(74, 144, 226, 0.05); padding: 15px; border-radius: 8px; border-left: 3px solid #4a90e2;">
      <div style="font-size: 12px; font-weight: 600; color: #4a90e2; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
        ${titulo}
      </div>
      <div style="font-size: 14px; font-weight: 600; line-height: 1.5; margin-bottom: 8px;">
        ${contenido}
      </div>
      ${footer ? `<div style="font-size: 11px; opacity: 0.7; margin-top: 6px;">${footer}</div>` : ''}
    </div>
  `;
}

function generarRecomendacionesOperativas(calculados, existentes, gaps) {
  return `
    <div style="margin: 25px 0;">
      <h5 style="margin: 0 0 15px 0; font-size: 15px; color: #ffff;">
        💡 Recomendaciones Operativas
      </h5>
      <div class="chart-container">
        <ol style="margin: 0; padding-left: 20px; line-height: 2; font-size: 13px;">
          <li>
            <strong>Distribución de Personal:</strong> 
            Asignar ${calculados.personal.serenos} serenos en zonas de alta incidencia según mapa de calor. 
            Coordinar turnos rotativos de 8 horas para cobertura 24/7.
          </li>
          <li>
            <strong>Gestión de Flota:</strong> 
            Mantener ${calculados.vehiculos.vehiculos_serenazgo + calculados.vehiculos.vehiculos_policia} unidades móviles 
            con disponibilidad inmediata. Programar mantenimiento preventivo mensual.
            ${gaps && gaps.totales.vehiculos < 0 ? 
              '<span style="color: #f44336; font-weight: 600;"> ⚠️ Considerar alquiler de vehículos adicionales.</span>' : ''}
          </li>
          <li>
            <strong>Protocolos de Respuesta:</strong> 
            Establecer tiempos máximos de respuesta: Emergencias críticas (5 min), 
            urgencias (15 min), casos regulares (60 min).
          </li>
          <li>
            <strong>Coordinación Interinstitucional:</strong> 
            ${existentes && existentes.comisarias ? 
              `Mantener comunicación activa con las ${existentes.comisarias} comisarías y ${existentes.estaciones_bomberos} estaciones de bomberos.` :
              'Establecer canales de comunicación con entidades de respuesta.'}
          </li>
          <li>
            <strong>Monitoreo y Ajustes:</strong> 
            Revisar semanalmente el desempeño operativo y ajustar asignación de recursos según demanda real vs proyectada.
          </li>
        </ol>
      </div>
    </div>
  `;
}

/**
 * Genera indicadores de desempeño (KPIs) correctamente calculados
 * 
 * FÓRMULAS CORREGIDAS:
 * - Eficiencia = (Disponibles / Necesarios) * 100
 * - Si hay déficit, el porcentaje será < 100%
 * - Si hay superávit, el porcentaje será >= 100% (tope en 100%)
 */
function generarIndicadoresDesempeno(calculados, gaps) {
  let eficienciaPersonal = 85;  // Valor por defecto
  let coberturaVehicular = 85;  // Valor por defecto
  
  // CÁLCULO CORRECTO DE EFICIENCIA PERSONAL
  if (gaps && gaps.totales.personal !== undefined) {
    // Disponibles = Necesarios + Gap
    const personalDisponible = calculados.metricas.total_personal + gaps.totales.personal;
    const personalNecesario = calculados.metricas.total_personal;
    
    // Eficiencia = (Disponibles / Necesarios) * 100
    eficienciaPersonal = (personalDisponible / personalNecesario) * 100;
    
    // Limitar a 100% máximo (no mostrar >100% aunque haya exceso)
    eficienciaPersonal = Math.min(100, eficienciaPersonal);
  }
  
  // CÁLCULO CORRECTO DE COBERTURA VEHICULAR
  if (gaps && gaps.totales.vehiculos !== undefined) {
    const vehiculosDisponibles = calculados.metricas.total_vehiculos + gaps.totales.vehiculos;
    const vehiculosNecesarios = calculados.metricas.total_vehiculos;
    
    coberturaVehicular = (vehiculosDisponibles / vehiculosNecesarios) * 100;
    coberturaVehicular = Math.min(100, coberturaVehicular);
  }

  // CAPACIDAD DE RESPUESTA (Promedio de ambos)
  const capacidadRespuesta = ((eficienciaPersonal + coberturaVehicular) / 2).toFixed(1);
  
  // COLOR SEGÚN NIVEL
  const colorCapacidad = capacidadRespuesta >= 90 ? '#4caf50' :   // Verde
                        capacidadRespuesta >= 75 ? '#ff9800' :   // Naranja
                        '#f44336';                               // Rojo

  // CASOS POR PERSONAL (Carga de trabajo)
  const casosPorPersonal = (calculados.metricas.casos_totales / calculados.metricas.total_personal).toFixed(1);

  return `
    <div style="margin: 25px 0 0 0; padding: 20px; background: linear-gradient(135deg, rgba(74, 144, 226, 0.08) 0%, rgba(33, 150, 243, 0.08) 100%); border-radius: 8px; border: 1px solid rgba(74, 144, 226, 0.2);">
      <h5 style="margin: 0 0 15px 0; font-size: 15px; color: #ffffffff;">
        📈 Indicadores Clave de Desempeño (KPIs)
      </h5>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; text-align: center;">
        ${generarKPI('Capacidad de Respuesta', `${capacidadRespuesta}%`, colorCapacidad)}
        ${generarKPI('Eficiencia Personal', `${eficienciaPersonal.toFixed(1)}%`, eficienciaPersonal >= 90 ? '#4caf50' : eficienciaPersonal >= 75 ? '#ff9800' : '#f44336')}
        ${generarKPI('Cobertura Vehicular', `${coberturaVehicular.toFixed(1)}%`, coberturaVehicular >= 90 ? '#4caf50' : coberturaVehicular >= 75 ? '#ff9800' : '#f44336')}
        ${generarKPI('Casos por Personal', casosPorPersonal, '#4a90e2')}
      </div>
      <p style="margin: 15px 0 0 0; font-size: 11px; opacity: 0.7; text-align: center; line-height: 1.5;">
        * Indicadores calculados con base en predicción del modelo ML y recursos disponibles actuales
      </p>
    </div>
  `;
}

function generarKPI(titulo, valor, color) {
  return `
    <div>
      <div style="font-size: 11px; text-transform: uppercase; color: #666; margin-bottom: 5px; font-weight: 600; letter-spacing: 0.5px;">
        ${titulo}
      </div>
      <div style="font-size: 24px; font-weight: 700; color: ${color};">
        ${valor}
      </div>
    </div>
  `;
}

// ============================================================================
// EJEMPLOS DE CÁLCULO PARA ENTENDER
// ============================================================================

/**
 * EJEMPLO 1: SUPERÁVIT (Tenemos MÁS recursos de los necesarios)
 * ─────────────────────────────────────────────────────────────
 * Necesarios: 39 personas
 * Disponibles: 275 personas
 * Gap: 275 - 39 = +236 (SUPERÁVIT)
 * 
 * Cálculo:
 * eficiencia = (275 / 39) * 100 = 705.12%
 * eficiencia = Math.min(100, 705.12) = 100% ✅
 * 
 * Interpretación: Tenemos 100% de cobertura (más que suficiente)
 */

/**
 * EJEMPLO 2: DÉFICIT (Nos FALTAN recursos)
 * ─────────────────────────────────────────
 * Necesarios: 39 personas
 * Disponibles: 30 personas
 * Gap: 30 - 39 = -9 (DÉFICIT)
 * 
 * Cálculo:
 * eficiencia = (30 / 39) * 100 = 76.92% ⚠️
 * 
 * Interpretación: Solo tenemos 76.92% de cobertura (nos faltan recursos)
 */

/**
 * EJEMPLO 3: EXACTO (Tenemos EXACTAMENTE lo necesario)
 * ────────────────────────────────────────────────────
 * Necesarios: 39 personas
 * Disponibles: 39 personas
 * Gap: 39 - 39 = 0 (EXACTO)
 * 
 * Cálculo:
 * eficiencia = (39 / 39) * 100 = 100% ✅
 * 
 * Interpretación: Cobertura perfecta
 */

// ============================================================================
// UTILIDADES Y FUNCIONES AUXILIARES
// ============================================================================

function formatearMoneda(cantidad) {
  return `S/ ${cantidad.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function actualizarElemento(id, contenido, isHTML = false) {
  const elemento = document.getElementById(id);
  if (elemento) {
    if (isHTML) {
      elemento.innerHTML = contenido;
    } else {
      elemento.textContent = contenido;
    }
  } else {
    console.warn(`⚠ Elemento #${id} no encontrado en el DOM`);
  }
}

function mostrarAlerta(mensaje, tipo = 'info') {
  const colores = {
    success: { bg: 'rgba(76, 175, 80, 0.1)', border: '#4caf50', icon: '✅' },
    warning: { bg: 'rgba(255, 152, 0, 0.1)', border: '#ff9800', icon: '⚠️' },
    error: { bg: 'rgba(244, 67, 54, 0.1)', border: '#f44336', icon: '❌' },
    info: { bg: 'rgba(33, 150, 243, 0.1)', border: '#2196f3', icon: 'ℹ️' }
  };

  const config = colores[tipo] || colores.info;

  const alerta = document.createElement('div');
  alerta.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 400px;
    padding: 16px 20px;
    background: ${config.bg};
    border-left: 4px solid ${config.border};
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `;

  alerta.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 20px;">${config.icon}</span>
      <div style="flex: 1; font-size: 14px; line-height: 1.5;">${mensaje}</div>
      <button onclick="this.parentElement.parentElement.remove()" 
              style="background: none; border: none; font-size: 20px; cursor: pointer; opacity: 0.5; padding: 0; width: 24px; height: 24px;">
        ×
      </button>
    </div>
  `;

  document.body.appendChild(alerta);

  setTimeout(() => {
    alerta.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => alerta.remove(), 300);
  }, 6000);
}

// Agregar animaciones CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
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

console.log('✓ Módulo de Recursos cargado correctamente');