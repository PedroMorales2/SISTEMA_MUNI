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
// Definimos una constante vacía, que se llenará con los datos del servidor
let RATIOS_OPERATIVOS = {};

/**
 * Carga los ratios desde la API Flask
 */
async function cargarRatiosOperativos() {
  try {
    const response = await fetch('/api/configuracion/ratios'); // Ajusta la URL si es necesario
    const result = await response.json();

    if (result.success) {
      RATIOS_OPERATIVOS = result.data; // Asignar la data devuelta
      console.log('✅ RATIOS_OPERATIVOS cargado correctamente:', RATIOS_OPERATIVOS);
    } else {
      console.error('❌ Error al obtener los ratios:', result.error);
    }
  } catch (error) {
    console.error('❌ Error de conexión al cargar los ratios:', error);
  }
}

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

  // ✅ Cálculo del personal necesario
  const personalNecesario = {
    serenos: Math.ceil(emergenciasPorServicio.serenazgo / RATIOS_OPERATIVOS.SERENO.llamadas_mes),
    policias: Math.ceil(emergenciasPorServicio.policia / RATIOS_OPERATIVOS.POLICIA.llamadas_mes),
    bomberos: Math.ceil(emergenciasPorServicio.bomberos / RATIOS_OPERATIVOS.BOMBERO.llamadas_mes),
    personal_denuncias: Math.ceil(totalDenuncias / RATIOS_OPERATIVOS.SERENO.casos_mes)
  };

  // ✅ Vehículos requeridos
  const vehiculosNecesarios = {
    vehiculos_serenazgo: Math.ceil(emergenciasPorServicio.serenazgo / RATIOS_OPERATIVOS.VEHICULO_SERENAZGO.llamadas_mes),
    vehiculos_policia: Math.ceil(emergenciasPorServicio.policia / RATIOS_OPERATIVOS.VEHICULO_POLICIA.llamadas_mes),
    vehiculos_bomberos: Math.ceil(emergenciasPorServicio.bomberos / RATIOS_OPERATIVOS.VEHICULO_BOMBEROS.llamadas_mes),
    ambulancias: Math.ceil(emergenciasPorServicio.ambulancia / RATIOS_OPERATIVOS.AMBULANCIA.llamadas_mes)
  };

  // ✅ Costo total mensual
  const costoPorCaso = RATIOS_OPERATIVOS.PRESUPUESTO.costo_caso;
  const overhead = RATIOS_OPERATIVOS.PRESUPUESTO.overhead;
  const totalCasos = totalDenuncias + totalEmergencias;

  const presupuesto = Math.round(totalCasos * costoPorCaso * overhead);

  // ✅ Horas hombre (horas por caso)
  const horasHombre = totalCasos * RATIOS_OPERATIVOS.TIEMPO.horas_caso;

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


/**
 * ============================================================================
 * MÓDULO DE ANÁLISIS DETALLADO DE RECURSOS - NIVEL GRANULAR
 * ============================================================================
 * 
 * Expansión del módulo base con análisis detallado por:
 * - Tipo específico de denuncia
 * - Tipo específico de emergencia
 * - Distribución temporal (días/horas)
 * - Zonas geográficas críticas
 * 
 * @requires recursos.js - Módulo base
 * @requires Chart.js, ChartDataLabels plugin
 */

// ============================================================================
// EXTENSIÓN: ANÁLISIS GRANULAR POR TIPO DE DENUNCIA
// ============================================================================

/**
 * Calcula recursos necesarios DESGLOSADOS por cada tipo de denuncia
 */
function calcularRecursosPorTipoDenuncia(prediccion) {
  const detallesDenuncias = [];
  
  // Iterar sobre cada tipo de denuncia
  Object.entries(prediccion.denuncias).forEach(([codigo, cantidad]) => {
    const nombreDenuncia = DENUNCIAS_MAP[codigo] || `Código ${codigo}`;
    
    // Determinar servicio responsable
    const servicioAsignado = determinarServicioResponsable(codigo);
    
    // Calcular recursos específicos
    const personalNecesario = Math.ceil(cantidad / RATIOS_OPERATIVOS.SERENO.casos_mes);
    const horasRequeridas = cantidad * RATIOS_OPERATIVOS.TIEMPO.horas_caso;
    const costoEstimado = cantidad * RATIOS_OPERATIVOS.PRESUPUESTO.costo_caso;
    
    // Nivel de prioridad (basado en cantidad)
    let prioridad = 'BAJA';
    if (cantidad > 50) prioridad = 'ALTA';
    else if (cantidad > 20) prioridad = 'MEDIA';
    
    detallesDenuncias.push({
      codigo,
      nombre: nombreDenuncia,
      cantidad,
      servicio: servicioAsignado,
      personal_necesario: personalNecesario,
      horas_totales: Math.round(horasRequeridas),
      costo_estimado: Math.round(costoEstimado),
      prioridad,
      porcentaje_total: 0 // Se calculará después
    });
  });
  
  // Calcular porcentajes
  const totalDenuncias = detallesDenuncias.reduce((sum, d) => sum + d.cantidad, 0);
  detallesDenuncias.forEach(d => {
    d.porcentaje_total = ((d.cantidad / totalDenuncias) * 100).toFixed(2);
  });
  
  // Ordenar por cantidad descendente
  return detallesDenuncias.sort((a, b) => b.cantidad - a.cantidad);
}

/**
 * Determina qué servicio debe atender cada tipo de denuncia
 */
function determinarServicioResponsable(codigoDenuncia) {
  // Mapeo basado en naturaleza de la denuncia
  const mapeoServicios = {
    // Serenazgo
    '1': 'Fiscalizacion', '2': 'Servicios municipales', '5': 'Gestion ambiental',
    '6': 'Fiscalizacion', '10': 'Riesgos y desastres', '12': 'Riesgos y desastres',
    
    // Policía
    '3': 'Gestion ambiental', '4': 'Servicios municipales', '7': 'Servicios municipales',
    '8': 'Serenazgo', '14': 'Policía',
    
    // Fiscalía/Defensoría
    '9': 'Riesgos y desastres', '11': 'Riesgos y desastres',
    
    // Municipalidad
    '13': 'Inspectoría Municipal'
  };
  
  return mapeoServicios[codigoDenuncia] || 'Serenazgo';
}

/**
 * Calcula recursos detallados por tipo de emergencia
 */
function calcularRecursosPorTipoEmergencia(prediccion) {
  const detallesEmergencias = [];
  
  Object.entries(prediccion.emergencias).forEach(([codigo, cantidad]) => {
    const nombreEmergencia = EMERGENCIAS_MAP[codigo] || `Código ${codigo}`;
    
    // Determinar servicio y recursos específicos
    const analisis = analizarEmergenciaDetallada(parseInt(codigo), cantidad);
    
    detallesEmergencias.push({
      codigo,
      nombre: nombreEmergencia,
      cantidad,
      ...analisis
    });
  });
  
  return detallesEmergencias.sort((a, b) => b.cantidad - a.cantidad);
}

/**
 * Análisis detallado por tipo de emergencia
 */
function analizarEmergenciaDetallada(codigo, cantidad) {
  const configuraciones = {
    2: { // Policía
      servicio: 'Policía Nacional',
      personal_por_llamada: 2,
      vehiculos_por_llamada: 1,
      tiempo_respuesta_min: 8,
      criticidad: 'ALTA'
    },
    3: { // Serenazgo
      servicio: 'Serenazgo Municipal',
      personal_por_llamada: 2,
      vehiculos_por_llamada: 1,
      tiempo_respuesta_min: 5,
      criticidad: 'MEDIA'
    },
    4: { // SAMU
      servicio: 'Servicio Médico',
      personal_por_llamada: 3,
      vehiculos_por_llamada: 1,
      tiempo_respuesta_min: 10,
      criticidad: 'CRÍTICA'
    },
    5: { // Incendio
      servicio: 'Bomberos',
      personal_por_llamada: 6,
      vehiculos_por_llamada: 2,
      tiempo_respuesta_min: 12,
      criticidad: 'CRÍTICA'
    },
    6: { // Rescate
      servicio: 'Bomberos',
      personal_por_llamada: 8,
      vehiculos_por_llamada: 2,
      tiempo_respuesta_min: 15,
      criticidad: 'CRÍTICA'
    }
  };
  
  const config = configuraciones[codigo] || {
    servicio: 'No especificado',
    personal_por_llamada: 2,
    vehiculos_por_llamada: 1,
    tiempo_respuesta_min: 10,
    criticidad: 'MEDIA'
  };
  
  return {
    servicio: config.servicio,
    personal_necesario: cantidad * config.personal_por_llamada,
    vehiculos_necesarios: Math.ceil(cantidad * config.vehiculos_por_llamada),
    tiempo_respuesta_objetivo: config.tiempo_respuesta_min,
    horas_operacion: Math.round(cantidad * (config.tiempo_respuesta_min / 60) * 3), // incluye traslado
    criticidad: config.criticidad
  };
}

// ============================================================================
// VISUALIZACIONES AVANZADAS
// ============================================================================

/**
 * Crea tabla interactiva con desglose completo por tipo de denuncia
 */
function generarTablaDetalladaDenuncias(detalles) {
  const html = `
    <div style="margin: 30px 0;">
      <h4 style="color: #2c3e50; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
        📋 Análisis Detallado por Tipo de Denuncia
        <span style="background: #3498db; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">
          ${detalles.length} tipos identificados
        </span>
      </h4>
      
      <div style="overflow-x: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; background: white;">
          <thead>
            <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
              <th style="padding: 14px 12px; text-align: left; font-weight: 600;">Tipo de Denuncia</th>
              <th style="padding: 14px 12px; text-align: center;">Casos</th>
              <th style="padding: 14px 12px; text-align: center;">% Total</th>
              <th style="padding: 14px 12px; text-align: center;">Personal</th>
              <th style="padding: 14px 12px; text-align: center;">Horas</th>
              <th style="padding: 14px 12px; text-align: right;">Costo S/</th>
              <th style="padding: 14px 12px; text-align: center;">Unidad Funcional</th>
              <th style="padding: 14px 12px; text-align: center;">Prioridad</th>
            </tr>
          </thead>
          <tbody>
            ${detalles.map((d, index) => {
              const bgColor = index % 2 === 0 ? '#f8f9fa' : 'white';
              const prioridadColor = d.prioridad === 'ALTA' ? '#e74c3c' :
                                    d.prioridad === 'MEDIA' ? '#f39c12' : '#95a5a6';
              
              return `
                <tr style="background: ${bgColor}; border-bottom: 1px solid #dee2e6; transition: background 0.2s;"
                    onmouseover="this.style.background='#e3f2fd'"
                    onmouseout="this.style.background='${bgColor}'">
                  <td style="padding: 12px; font-weight: 500;">
                    <div>${d.nombre}</div>
                    <small style="color: #6c757d;">Código: ${d.codigo}</small>
                  </td>
                  <td style="padding: 12px; text-align: center; font-weight: 600; color: #2c3e50;">
                    ${d.cantidad}
                  </td>
                  <td style="padding: 12px; text-align: center;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                      <div style="flex: 1; max-width: 80px; height: 6px; background: #e0e0e0; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${d.porcentaje_total}%; height: 100%; background: linear-gradient(90deg, #667eea, #764ba2);"></div>
                      </div>
                      <span style="font-size: 12px; font-weight: 600; color: #667eea;">${d.porcentaje_total}%</span>
                    </div>
                  </td>
                  <td style="padding: 12px; text-align: center;">
                    <span style="background: #e3f2fd; padding: 4px 10px; border-radius: 4px; font-weight: 600; color: #1976d2;">
                      ${d.personal_necesario}
                    </span>
                  </td>
                  <td style="padding: 12px; text-align: center; color: #6c757d;">
                    ${d.horas_totales.toLocaleString()}
                  </td>
                  <td style="padding: 12px; text-align: right; font-weight: 600; color: #27ae60;">
                    ${d.costo_estimado.toLocaleString('es-PE')}
                  </td>
                  <td style="padding: 12px; text-align: center;">
                    <span style="font-size: 11px; color: #6c757d;">${d.servicio}</span>
                  </td>
                  <td style="padding: 12px; text-align: center;">
                    <span style="background: ${prioridadColor}; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                      ${d.prioridad}
                    </span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="background: #f8f9fa; font-weight: 600; border-top: 2px solid #dee2e6;">
              <td style="padding: 14px 12px;">TOTALES</td>
              <td style="padding: 14px 12px; text-align: center; color: #2c3e50;">
                ${detalles.reduce((sum, d) => sum + d.cantidad, 0)}
              </td>
              <td style="padding: 14px 12px; text-align: center;">100%</td>
              <td style="padding: 14px 12px; text-align: center; color: #1976d2;">
                ${detalles.reduce((sum, d) => sum + d.personal_necesario, 0)}
              </td>
              <td style="padding: 14px 12px; text-align: center;">
                ${detalles.reduce((sum, d) => sum + d.horas_totales, 0).toLocaleString()}
              </td>
              <td style="padding: 14px 12px; text-align: right; color: #27ae60;">
                S/ ${detalles.reduce((sum, d) => sum + d.costo_estimado, 0).toLocaleString('es-PE')}
              </td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
  
  return html;
}

/**
 * Crea gráfico de barras horizontales con top denuncias
 */
function crearGraficoTopDenuncias(detalles) {
  // Tomar top 10
  const top10 = detalles.slice(0, 10);
  
  const canvas = document.createElement('canvas');
  canvas.id = 'chartTopDenuncias';
  canvas.style.maxHeight = '400px';
  
  const container = document.getElementById('planAccion');
  if (container) {
    const titulo = document.createElement('h4');
    titulo.textContent = '🏆 Top 10 Denuncias con Mayor Demanda de Recursos';
    titulo.style.cssText = 'color: #2c3e50; margin: 30px 0 15px 0;';
    
    container.appendChild(titulo);
    container.appendChild(canvas);
  }
  
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: top10.map(d => d.nombre),
      datasets: [
        {
          label: 'Casos Proyectados',
          data: top10.map(d => d.cantidad),
          backgroundColor: 'rgba(102, 126, 234, 0.8)',
          borderColor: 'rgba(102, 126, 234, 1)',
          borderWidth: 2,
          borderRadius: 6
        },
        {
          label: 'Personal Necesario',
          data: top10.map(d => d.personal_necesario),
          backgroundColor: 'rgba(118, 75, 162, 0.8)',
          borderColor: 'rgba(118, 75, 162, 1)',
          borderWidth: 2,
          borderRadius: 6
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: { size: 12, weight: '600' },
            padding: 15,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          padding: 12,
          titleFont: { size: 13, weight: '600' },
          bodyFont: { size: 12 },
          callbacks: {
            afterLabel: function(context) {
              const detalle = top10[context.dataIndex];
              return [
                `Prioridad: ${detalle.prioridad}`,
                `Horas: ${detalle.horas_totales.toLocaleString()}`,
                `Costo: S/ ${detalle.costo_estimado.toLocaleString('es-PE')}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0, font: { size: 11 } },
          grid: { color: 'rgba(0, 0, 0, 0.05)' }
        },
        y: {
          ticks: { 
            font: { size: 11 },
            autoSkip: false
          },
          grid: { display: false }
        }
      }
    }
  });
}

/**
 * Crea matriz de calor (heatmap) de recursos por servicio
 */
function crearHeatmapRecursosPorServicio(detallesDenuncias, detallesEmergencias) {
  const servicios = ['Serenazgo', 'Policía', 'Bomberos', 'Servicio Médico', 'Otros'];
  const metricas = ['Casos', 'Personal', 'Vehículos', 'Horas'];
  
  // Agregar datos por servicio
  const matriz = {};
  servicios.forEach(s => {
    matriz[s] = { casos: 0, personal: 0, vehiculos: 0, horas: 0 };
  });
  
  // Procesar denuncias
  detallesDenuncias.forEach(d => {
    const servicio = d.servicio === 'Defensoría' || d.servicio === 'Inspectoría Municipal' ? 
                     'Otros' : d.servicio;
    if (matriz[servicio]) {
      matriz[servicio].casos += d.cantidad;
      matriz[servicio].personal += d.personal_necesario;
      matriz[servicio].horas += d.horas_totales;
    }
  });
  
  // Procesar emergencias
  detallesEmergencias.forEach(e => {
    let servicio = e.servicio;
    if (servicio === 'Policía Nacional') servicio = 'Policía';
    else if (servicio === 'Serenazgo Municipal') servicio = 'Serenazgo';
    
    if (matriz[servicio]) {
      matriz[servicio].casos += e.cantidad;
      matriz[servicio].personal += e.personal_necesario;
      matriz[servicio].vehiculos += e.vehiculos_necesarios;
      matriz[servicio].horas += e.horas_operacion;
    }
  });
  
  // Generar HTML de heatmap
  const html = `
    <div style="margin: 30px 0;">
      <h4 style="color: #2c3e50; margin-bottom: 15px;">
        🔥 Matriz de Calor: Demanda de Recursos por Servicio
      </h4>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #34495e; color: white;">
              <th style="padding: 12px; text-align: left;">Servicio</th>
              ${metricas.map(m => `<th style="padding: 12px; text-align: center;">${m}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${servicios.map(servicio => {
              const datos = matriz[servicio];
              if (datos.casos === 0) return '';
              
              return `
                <tr style="border-bottom: 1px solid #ecf0f1;">
                  <td style="padding: 12px; font-weight: 600;">${servicio}</td>
                  ${generarCeldaHeatmap(datos.casos, 'casos', matriz)}
                  ${generarCeldaHeatmap(datos.personal, 'personal', matriz)}
                  ${generarCeldaHeatmap(datos.vehiculos, 'vehiculos', matriz)}
                  ${generarCeldaHeatmap(datos.horas, 'horas', matriz)}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  return html;
}

/**
 * Genera celda con color según intensidad
 */
function generarCeldaHeatmap(valor, metrica, matriz) {
  // Calcular máximo para normalizar
  const valores = Object.values(matriz).map(d => d[metrica]);
  const maximo = Math.max(...valores);
  const intensidad = maximo > 0 ? (valor / maximo) : 0;
  
  // Escala de colores: amarillo -> naranja -> rojo
  let backgroundColor;
  if (intensidad > 0.7) backgroundColor = 'rgba(231, 76, 60, 0.8)';
  else if (intensidad > 0.4) backgroundColor = 'rgba(243, 156, 18, 0.7)';
  else if (intensidad > 0.2) backgroundColor = 'rgba(241, 196, 15, 0.6)';
  else backgroundColor = 'rgba(52, 152, 219, 0.3)';
  
  return `
    <td style="padding: 12px; text-align: center; background: ${backgroundColor}; font-weight: 600; color: ${intensidad > 0.5 ? 'white' : '#2c3e50'};">
      ${valor.toLocaleString('es-PE')}
    </td>
  `;
}

// ============================================================================
// FUNCIÓN PRINCIPAL MEJORADA
// ============================================================================

/**
 * SOBREESCRIBE la función original con análisis expandido
 */
function generarPlanCompletoMejorado(prediccion, recursosExistentes) {
  console.log('→ Generando plan MEJORADO con análisis granular...');
  
  const contenedor = document.getElementById('resultadoRecursos');
  if (contenedor) {
    contenedor.style.display = 'block';
  }
  
  // Cálculos originales
  const recursosCalculados = calcularRecursosNecesarios(prediccion);
  const gapAnalysis = calcularAnalisisGap(recursosCalculados, recursosExistentes);
  
  // ✨ NUEVOS ANÁLISIS DETALLADOS
  const detallesDenuncias = calcularRecursosPorTipoDenuncia(prediccion);
  const detallesEmergencias = calcularRecursosPorTipoEmergencia(prediccion);
  
  // Actualizar métricas generales
  actualizarMetricasGenerales(recursosCalculados, recursosExistentes, gapAnalysis);
  
  // Visualizaciones originales
  generarVisualizaciones(recursosCalculados, recursosExistentes, prediccion);
  
  // ✨ AGREGAR NUEVAS VISUALIZACIONES DETALLADAS
  const planAccionContainer = document.getElementById('planAccion');
  
  if (planAccionContainer) {
    // Limpiar contenido anterior
    planAccionContainer.innerHTML = '';
    
    // 1. Recomendaciones estratégicas (original)
    const estrategiasHTML = generarRecomendacionesEstrategicasHTML(
      prediccion, recursosCalculados, recursosExistentes, gapAnalysis
    );
    planAccionContainer.innerHTML = estrategiasHTML;
    
    // 2. ✨ TABLA DETALLADA DE DENUNCIAS
    const tablaHTML = generarTablaDetalladaDenuncias(detallesDenuncias);
    planAccionContainer.insertAdjacentHTML('beforeend', tablaHTML);
    
    // 3. ✨ GRÁFICO TOP DENUNCIAS
    crearGraficoTopDenuncias(detallesDenuncias);
    
    // 4. ✨ HEATMAP DE SERVICIOS
    const heatmapHTML = crearHeatmapRecursosPorServicio(detallesDenuncias, detallesEmergencias);
    planAccionContainer.insertAdjacentHTML('beforeend', heatmapHTML);
    
    // 5. TABLA DE EMERGENCIAS
    const tablaEmergenciasHTML = generarTablaEmergencias(detallesEmergencias);
    planAccionContainer.insertAdjacentHTML('beforeend', tablaEmergenciasHTML);
  }
  
  contenedor?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  
  console.log('✓ Plan MEJORADO generado con éxito');
  console.log(`  → ${detallesDenuncias.length} tipos de denuncias analizados`);
  console.log(`  → ${detallesEmergencias.length} tipos de emergencias analizados`);
}

/**
 * Genera tabla de emergencias
 */
function generarTablaEmergencias(detalles) {
  return `
    <div style="margin: 30px 0;">
      <h4 style="color: #2c3e50; margin-bottom: 15px;">
        🚨 Análisis de Emergencias por Tipo
      </h4>
      
      <div style="overflow-x: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; background: white;">
          <thead>
            <tr style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white;">
              <th style="padding: 14px 12px; text-align: left;">Tipo de Emergencia</th>
              <th style="padding: 14px 12px; text-align: center;">Llamadas</th>
              <th style="padding: 14px 12px; text-align: center;">Personal</th>
              <th style="padding: 14px 12px; text-align: center;">Vehículos</th>
              <th style="padding: 14px 12px; text-align: center;">T. Respuesta</th>
              <th style="padding: 14px 12px; text-align: center;">Horas Op.</th>
              <th style="padding: 14px 12px; text-align: center;">Criticidad</th>
            </tr>
          </thead>
          <tbody>
            ${detalles.map((e, index) => {
              const bgColor = index % 2 === 0 ? '#f8f9fa' : 'white';
              const critColor = e.criticidad === 'CRÍTICA' ? '#e74c3c' :
                               e.criticidad === 'ALTA' ? '#f39c12' : '#3498db';
              
              return `
                <tr style="background: ${bgColor}; border-bottom: 1px solid #dee2e6;">
                  <td style="padding: 12px; font-weight: 500;">
                    ${e.nombre}
                    <br><small style="color: #6c757d;">${e.servicio}</small>
                  </td>
                  <td style="padding: 12px; text-align: center; font-weight: 600;">${e.cantidad}</td>
                  <td style="padding: 12px; text-align: center;">
                    <span style="background: #e3f2fd; padding: 4px 10px; border-radius: 4px; font-weight: 600; color: #1976d2;">
                      ${e.personal_necesario}
                    </span>
                  </td>
                  <td style="padding: 12px; text-align: center;">
                    <span style="background: #f3e5f5; padding: 4px 10px; border-radius: 4px; font-weight: 600; color: #7b1fa2;">
                      ${e.vehiculos_necesarios}
                    </span>
                  </td>
                  <td style="padding: 12px; text-align: center; color: #6c757d;">
                    ${e.tiempo_respuesta_objetivo} min
                  </td>
                  <td style="padding: 12px; text-align: center; color: #6c757d;">
                    ${e.horas_operacion}h
                  </td>
                  <td style="padding: 12px; text-align: center;">
                    <span style="background: ${critColor}; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                      ${e.criticidad}
                    </span>
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

/**
 * Wrapper para la función de recomendaciones estratégicas
 */
function generarRecomendacionesEstrategicasHTML(prediccion, calculados, existentes, gaps) {
  let html = `
    <div class="recomendaciones-header">
      <h4 style="margin: 0 0 10px 0; font-size: 18px; color: #2c3e50;">
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

  return html;
}

// ============================================================================
// ANÁLISIS DE DISTRIBUCIÓN TEMPORAL Y GEOGRÁFICA
// ============================================================================

/**
 * Analiza patrones temporales y sugiere turnos óptimos
 */
function analizarPatronesTemporales(prediccion) {
  // Simulación de distribución horaria (en producción, obtener datos reales)
  const distribucionHoraria = {
    '00-06': 0.08,  // 8% de casos
    '06-12': 0.25,  // 25% de casos
    '12-18': 0.35,  // 35% de casos (pico)
    '18-24': 0.32   // 32% de casos
  };
  
  const totalCasos = Object.values(prediccion.denuncias).reduce((sum, v) => sum + v, 0) +
                     Object.values(prediccion.emergencias).reduce((sum, v) => sum + v, 0);
  
  const analisisTurnos = Object.entries(distribucionHoraria).map(([rango, porcentaje]) => {
    const casosEstimados = Math.round(totalCasos * porcentaje);
    const personalSugerido = Math.ceil(casosEstimados / (RATIOS_OPERATIVOS.SERENO.casos_mes / 30));
    
    return {
      rango,
      porcentaje: (porcentaje * 100).toFixed(1),
      casos_estimados: casosEstimados,
      personal_sugerido: personalSugerido,
      intensidad: porcentaje > 0.3 ? 'ALTA' : porcentaje > 0.2 ? 'MEDIA' : 'BAJA'
    };
  });
  
  return analisisTurnos;
}

/**
 * Genera gráfico de distribución horaria
 */
function crearGraficoDistribucionHoraria(analisisTurnos) {
  const canvas = document.createElement('canvas');
  canvas.id = 'chartDistribucionHoraria';
  canvas.style.maxHeight = '300px';
  
  const container = document.getElementById('planAccion');
  if (container) {
    const titulo = document.createElement('h4');
    titulo.textContent = '⏰ Distribución Horaria y Turnos Sugeridos';
    titulo.style.cssText = 'color: #2c3e50; margin: 30px 0 15px 0;';
    
    container.appendChild(titulo);
    container.appendChild(canvas);
  }
  
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: analisisTurnos.map(t => t.rango.replace('-', ':00 - ') + ':00'),
      datasets: [
        {
          label: 'Casos Estimados',
          data: analisisTurnos.map(t => t.casos_estimados),
          borderColor: 'rgba(52, 152, 219, 1)',
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 6,
          pointBackgroundColor: 'rgba(52, 152, 219, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        },
        {
          label: 'Personal Sugerido',
          data: analisisTurnos.map(t => t.personal_sugerido),
          borderColor: 'rgba(155, 89, 182, 1)',
          backgroundColor: 'rgba(155, 89, 182, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 6,
          pointBackgroundColor: 'rgba(155, 89, 182, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          yAxisID: 'y1'
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
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: { size: 12, weight: '600' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          padding: 12,
          titleFont: { size: 13, weight: '600' },
          bodyFont: { size: 12 },
          callbacks: {
            afterLabel: function(context) {
              const turno = analisisTurnos[context.dataIndex];
              return [
                `Intensidad: ${turno.intensidad}`,
                `${turno.porcentaje}% del total diario`
              ];
            }
          }
        }
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Casos Estimados',
            font: { size: 11, weight: '600' }
          },
          ticks: { precision: 0 }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Personal Necesario',
            font: { size: 11, weight: '600' }
          },
          grid: {
            drawOnChartArea: false
          },
          ticks: { precision: 0 }
        },
        x: {
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            font: { size: 11 }
          }
        }
      }
    }
  });
}

/**
 * Genera recomendaciones de turnos
 */
function generarRecomendacionesTurnos(analisisTurnos) {
  const html = `
    <div style="margin: 20px 0; padding: 20px; background: linear-gradient(135deg, rgba(52, 152, 219, 0.08) 0%, rgba(155, 89, 182, 0.08) 100%); border-radius: 8px; border-left: 4px solid #3498db;">
      <h5 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 15px;">
        👥 Sugerencias de Asignación por Turnos
      </h5>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
        ${analisisTurnos.map(turno => {
          const colorIntensidad = turno.intensidad === 'ALTA' ? '#e74c3c' :
                                  turno.intensidad === 'MEDIA' ? '#f39c12' : '#3498db';
          
          return `
            <div style="background: white; padding: 15px; border-radius: 6px; border-top: 3px solid ${colorIntensidad};">
              <div style="font-size: 13px; font-weight: 600; color: ${colorIntensidad}; margin-bottom: 8px;">
                ${turno.rango.replace('-', ':00 - ')}:00
              </div>
              <div style="font-size: 11px; color: #7f8c8d; margin-bottom: 10px;">
                Intensidad: ${turno.intensidad}
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <span style="font-size: 11px; color: #95a5a6;">Casos:</span>
                <span style="font-size: 13px; font-weight: 600; color: #2c3e50;">${turno.casos_estimados}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: #95a5a6;">Personal:</span>
                <span style="font-size: 13px; font-weight: 600; color: #9b59b6;">${turno.personal_sugerido}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  
  return html;
}

// ============================================================================
// ANÁLISIS DE EFICIENCIA Y OPTIMIZACIÓN
// ============================================================================

/**
 * Calcula métricas de eficiencia operativa
 */
function calcularMetricasEficiencia(recursosCalculados, recursosExistentes) {
  const metricas = {
    utilizacion_personal: 0,
    utilizacion_vehiculos: 0,
    costo_por_caso: 0,
    tiempo_promedio_caso: 0,
    capacidad_excedente: 0
  };
  
  if (recursosExistentes) {
    const personalTotal = recursosExistentes.serenos + 
                         recursosExistentes.policias + 
                         recursosExistentes.bomberos;
    
    const vehiculosTotal = recursosExistentes.vehiculos_serenazgo +
                          recursosExistentes.vehiculos_policia +
                          recursosExistentes.vehiculos_bomberos +
                          recursosExistentes.ambulancias;
    
    metricas.utilizacion_personal = Math.min(100, 
      (recursosCalculados.metricas.total_personal / personalTotal) * 100
    );
    
    metricas.utilizacion_vehiculos = Math.min(100,
      (recursosCalculados.metricas.total_vehiculos / vehiculosTotal) * 100
    );
    
    metricas.capacidad_excedente = Math.max(0,
      ((personalTotal - recursosCalculados.metricas.total_personal) / personalTotal) * 100
    );
  }
  
  metricas.costo_por_caso = recursosCalculados.metricas.presupuesto_mensual / 
                            recursosCalculados.metricas.casos_totales;
  
  metricas.tiempo_promedio_caso = recursosCalculados.metricas.horas_hombre / 
                                  recursosCalculados.metricas.casos_totales;
  
  return metricas;
}

/**
 * Genera dashboard de eficiencia
 */
function generarDashboardEficiencia(metricas) {
  const html = `
    <div style="margin: 30px 0;">
      <h4 style="color: #2c3e50; margin-bottom: 15px;">
        📊 Dashboard de Eficiencia Operativa
      </h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px;">
        ${generarCardEficiencia('Utilización Personal', `${metricas.utilizacion_personal.toFixed(1)}%`, metricas.utilizacion_personal, '👥')}
        ${generarCardEficiencia('Utilización Vehículos', `${metricas.utilizacion_vehiculos.toFixed(1)}%`, metricas.utilizacion_vehiculos, '🚗')}
        ${generarCardEficiencia('Costo/Caso', `S/ ${metricas.costo_por_caso.toFixed(2)}`, 50, '💰')}
        ${generarCardEficiencia('Tiempo/Caso', `${metricas.tiempo_promedio_caso.toFixed(1)}h`, 50, '⏱️')}
        ${generarCardEficiencia('Capacidad Excedente', `${metricas.capacidad_excedente.toFixed(1)}%`, 100 - metricas.capacidad_excedente, '📈')}
      </div>
    </div>
  `;
  
  return html;
}

/**
 * Genera card individual de métrica de eficiencia
 */
function generarCardEficiencia(titulo, valor, porcentaje, emoji) {
  let color;
  if (porcentaje >= 80) color = '#27ae60';
  else if (porcentaje >= 60) color = '#f39c12';
  else color = '#e74c3c';
  
  return `
    <div style="background: white; padding: 18px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-top: 4px solid ${color};">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
        <span style="font-size: 24px;">${emoji}</span>
        <span style="font-size: 11px; font-weight: 600; color: ${color}; background: ${color}22; padding: 4px 8px; border-radius: 4px;">
          ${porcentaje >= 80 ? 'ÓPTIMO' : porcentaje >= 60 ? 'BUENO' : 'MEJORAR'}
        </span>
      </div>
      <div style="font-size: 11px; color: #7f8c8d; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
        ${titulo}
      </div>
      <div style="font-size: 22px; font-weight: 700; color: #2c3e50; margin-bottom: 10px;">
        ${valor}
      </div>
      <div style="width: 100%; height: 6px; background: #ecf0f1; border-radius: 3px; overflow: hidden;">
        <div style="width: ${Math.min(100, porcentaje)}%; height: 100%; background: ${color}; transition: width 0.5s ease;"></div>
      </div>
    </div>
  `;
}

// ============================================================================
// FUNCIÓN PRINCIPAL INTEGRADA - REEMPLAZA calcularRecursos()
// ============================================================================

/**
 * NUEVA versión de calcularRecursos con análisis completo
 */
async function calcularRecursosMejorado() {
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
    // Cargar ratios si no están cargados
    if (Object.keys(RATIOS_OPERATIVOS).length === 0) {
      await cargarRatiosOperativos();
    }
    
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

    // ✨ USAR LA NUEVA FUNCIÓN MEJORADA
    generarPlanCompletoMejorado(prediccionResponse.data, recursosExistentes);
    
    // ✨ AGREGAR ANÁLISIS TEMPORAL
    const analisisTurnos = analizarPatronesTemporales(prediccionResponse.data);
    crearGraficoDistribucionHoraria(analisisTurnos);
    
    const turnosHTML = generarRecomendacionesTurnos(analisisTurnos);
    document.getElementById('planAccion')?.insertAdjacentHTML('beforeend', turnosHTML);
    
    // ✨ AGREGAR MÉTRICAS DE EFICIENCIA
    const recursosCalculados = calcularRecursosNecesarios(prediccionResponse.data);
    const metricasEficiencia = calcularMetricasEficiencia(recursosCalculados, recursosExistentes);
    const dashboardHTML = generarDashboardEficiencia(metricasEficiencia);
    document.getElementById('planAccion')?.insertAdjacentHTML('beforeend', dashboardHTML);
    
    mostrarAlerta('✅ Análisis completo generado exitosamente', 'success');
    
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
// EXPORTACIÓN A PDF/EXCEL (BONUS)
// ============================================================================

/**
 * Genera reporte exportable en formato estructurado
 */
function generarReporteExportable(prediccion, recursosCalculados, recursosExistentes) {
  const detallesDenuncias = calcularRecursosPorTipoDenuncia(prediccion);
  const detallesEmergencias = calcularRecursosPorTipoEmergencia(prediccion);
  
  const reporte = {
    metadata: {
      fecha_generacion: new Date().toISOString(),
      periodo_analizado: prediccion.fecha_prediccion,
      version: '2.0.0'
    },
    resumen_ejecutivo: {
      casos_totales: recursosCalculados.metricas.casos_totales,
      personal_requerido: recursosCalculados.metricas.total_personal,
      vehiculos_requeridos: recursosCalculados.metricas.total_vehiculos,
      presupuesto_estimado: recursosCalculados.metricas.presupuesto_mensual,
      horas_hombre: recursosCalculados.metricas.horas_hombre
    },
    analisis_denuncias: detallesDenuncias,
    analisis_emergencias: detallesEmergencias,
    recursos_disponibles: recursosExistentes,
    gap_analysis: calcularAnalisisGap(recursosCalculados, recursosExistentes)
  };
  
  return reporte;
}

/**
 * Botón para descargar reporte JSON
 */
function descargarReporteJSON() {
  // Obtener datos actuales del último cálculo
  const reporteData = {
    mensaje: 'Reporte generado desde el módulo de recursos mejorado',
    timestamp: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(reporteData, null, 2)], {
    type: 'application/json'
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte_recursos_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  mostrarAlerta('✅ Reporte descargado exitosamente', 'success');
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

console.log('✨ Módulo de Recursos MEJORADO cargado correctamente');
console.log('   → Análisis granular por tipo de denuncia/emergencia');
console.log('   → Visualizaciones avanzadas (heatmaps, rankings)');
console.log('   → Análisis temporal y sugerencias de turnos');
console.log('   → Dashboard de eficiencia operativa');
console.log('');
console.log('💡 Para activar: Reemplazar calcularRecursos() con calcularRecursosMejorado()');
console.log('   O mantener ambas versiones y elegir según necesidad');

console.log('✓ Módulo de Recursos cargado correctamente');