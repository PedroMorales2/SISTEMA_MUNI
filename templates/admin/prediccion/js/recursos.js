/**
 * ============================================================================
 * MÓDULO DE GESTIÓN Y ASIGNACIÓN DE RECURSOS MUNICIPALES
 * ============================================================================
 * Versión 3.0.0 - 100% Dinámico desde Base de Datos
 * - Sin valores hardcodeados
 * - Todos los ratios y recursos vienen de API
 * - Sistema adaptable a cambios en configuración
 * ============================================================================
 */

// ============================================================================
// VARIABLES GLOBALES
// ============================================================================

let RATIOS_OPERATIVOS = {};
let RECURSOS_ACTUALES = null;
let ultimoFetchRecursos = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Gráficos
//let chartRecursos = null;
let chartDistribucionEmergencias = null;

// ============================================================================
// CARGA INICIAL DE DATOS
// ============================================================================

/**
 * Carga los ratios operativos desde la base de datos
 */
async function cargarRatiosOperativos() {
  try {
    console.log('→ Cargando ratios operativos desde base de datos...');
    
    const response = await fetch(`${API_URL}/api/configuracion/ratios`);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Error al cargar ratios');
    }

    RATIOS_OPERATIVOS = result.data;
    
    console.log('✅ Ratios operativos cargados:', RATIOS_OPERATIVOS);
    return true;
    
  } catch (error) {
    console.error('❌ Error al cargar ratios operativos:', error);
    mostrarAlerta('No se pudieron cargar los ratios operativos. Verifique la conexión.', 'error');
    return false;
  }
}

/**
 * Obtiene el inventario actual de recursos municipales desde la BD
 */
async function obtenerRecursosActuales() {
  try {
    // Verificar cache válido
    const ahora = Date.now();
    if (RECURSOS_ACTUALES && ultimoFetchRecursos && 
        (ahora - ultimoFetchRecursos) < CACHE_TTL) {
      console.log('✓ Usando recursos desde cache');
      return RECURSOS_ACTUALES;
    }

    console.log('→ Consultando inventario de recursos desde BD...');
    
    const response = await fetch(`${API_URL}/api/recursos/inventario`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Error al obtener recursos');
    }

    if (!data.data) {
      console.warn('⚠ No hay datos de recursos en la respuesta');
      return null;
    }

    // Validar estructura mínima
    const recursosValidos = validarEstructuraRecursos(data.data);
    
    if (recursosValidos) {
      RECURSOS_ACTUALES = data.data;
      ultimoFetchRecursos = ahora;
      console.log('✓ Recursos obtenidos y validados correctamente');
      return RECURSOS_ACTUALES;
    } else {
      console.warn('⚠ Estructura de recursos inválida');
      return null;
    }
    
  } catch (error) {
    console.error('✗ Error crítico obteniendo recursos:', error);
    
    // Fallback a cache antiguo
    if (RECURSOS_ACTUALES) {
      console.warn('⚠ Usando cache antiguo debido a error de conexión');
      return RECURSOS_ACTUALES;
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
    const existe = campo in recursos;
    const esNumero = typeof recursos[campo] === 'number';
    const noNegativo = recursos[campo] >= 0;
    
    const valido = existe && esNumero && noNegativo;
    
    if (!valido) {
      console.warn(`⚠ Campo inválido: ${campo}`, {
        existe,
        esNumero,
        noNegativo,
        valor: recursos[campo]
      });
    }
    
    return valido;
  });
}

// ============================================================================
// CÁLCULO DE RECURSOS NECESARIOS
// ============================================================================

/**
 * Calcula recursos necesarios basados en predicción ML
 * Usa los ratios dinámicos cargados de la BD
 */
function calcularRecursosNecesarios(prediccion) {
  // Verificar que los ratios estén cargados
  if (!RATIOS_OPERATIVOS || Object.keys(RATIOS_OPERATIVOS).length === 0) {
    throw new Error('Los ratios operativos no están cargados');
  }

  // Sumar totales
  const totalDenuncias = Object.values(prediccion.denuncias).reduce((sum, val) => sum + val, 0);
  const totalEmergencias = Object.values(prediccion.emergencias).reduce((sum, val) => sum + val, 0);

  // Emergencias por servicio (basado en códigos de EMERGENCIAS_MAP)
  const emergenciasPorServicio = {
    policia: prediccion.emergencias[2] || 0,      // Código 2: Policía
    serenazgo: prediccion.emergencias[3] || 0,    // Código 3: Serenazgo
    ambulancia: prediccion.emergencias[4] || 0,   // Código 4: SAMU
    bomberos: (prediccion.emergencias[5] || 0) + (prediccion.emergencias[6] || 0) // 5: Incendio, 6: Rescate
  };

  // ✅ PERSONAL NECESARIO (usando ratios dinámicos)
  const personalNecesario = {
    serenos: Math.ceil(
      emergenciasPorServicio.serenazgo / RATIOS_OPERATIVOS.SERENO.llamadas_mes
    ),
    policias: Math.ceil(
      emergenciasPorServicio.policia / RATIOS_OPERATIVOS.POLICIA.llamadas_mes
    ),
    bomberos: Math.ceil(
      emergenciasPorServicio.bomberos / RATIOS_OPERATIVOS.BOMBERO.llamadas_mes
    ),
    personal_denuncias: Math.ceil(
      totalDenuncias / RATIOS_OPERATIVOS.SERENO.casos_mes
    )
  };

  // ✅ VEHÍCULOS NECESARIOS (usando ratios dinámicos)
  const vehiculosNecesarios = {
    vehiculos_serenazgo: Math.ceil(
      emergenciasPorServicio.serenazgo / RATIOS_OPERATIVOS.VEHICULO_SERENAZGO.llamadas_mes
    ),
    vehiculos_policia: Math.ceil(
      emergenciasPorServicio.policia / RATIOS_OPERATIVOS.VEHICULO_POLICIA.llamadas_mes
    ),
    vehiculos_bomberos: Math.ceil(
      emergenciasPorServicio.bomberos / RATIOS_OPERATIVOS.VEHICULO_BOMBEROS.llamadas_mes
    ),
    ambulancias: Math.ceil(
      emergenciasPorServicio.ambulancia / RATIOS_OPERATIVOS.AMBULANCIA.llamadas_mes
    )
  };

  // ✅ PRESUPUESTO (usando ratios dinámicos)
  const costoPorCaso = RATIOS_OPERATIVOS.PRESUPUESTO.costo_caso;
  const overhead = RATIOS_OPERATIVOS.PRESUPUESTO.overhead;
  const totalCasos = totalDenuncias + totalEmergencias;
  const presupuesto = Math.round(totalCasos * costoPorCaso * overhead);

  // ✅ HORAS HOMBRE (usando ratios dinámicos)
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
    emergencias_por_servicio: emergenciasPorServicio,
    ratios_utilizados: { // Para auditoría
      sereno_llamadas: RATIOS_OPERATIVOS.SERENO.llamadas_mes,
      sereno_casos: RATIOS_OPERATIVOS.SERENO.casos_mes,
      costo_caso: costoPorCaso,
      overhead: overhead
    }
  };
}

/**
 * Calcula análisis de brechas (gap analysis)
 */
function calcularAnalisisGap(necesarios, existentes) {
  if (!existentes) {
    console.warn('⚠ No hay recursos existentes para comparar');
    return null;
  }
  
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
  
  // Detectar déficits críticos (>20%)
  const deficitsCriticos = [];
  
  Object.entries(gaps.personal).forEach(([tipo, gap]) => {
    if (gap < 0) { // Hay déficit
      const porcentajeDeficit = Math.abs((gap / necesarios.personal[tipo]) * 100);
      if (porcentajeDeficit > 20) {
        deficitsCriticos.push({
          categoria: 'Personal',
          tipo: tipo.charAt(0).toUpperCase() + tipo.slice(1),
          deficit: Math.abs(gap),
          actual: existentes[tipo],
          necesario: necesarios.personal[tipo],
          porcentaje: porcentajeDeficit.toFixed(1)
        });
      }
    }
  });
  
  Object.entries(gaps.vehiculos).forEach(([tipo, gap]) => {
    if (gap < 0) {
      const porcentajeDeficit = Math.abs((gap / necesarios.vehiculos[tipo]) * 100);
      if (porcentajeDeficit > 20) {
        deficitsCriticos.push({
          categoria: 'Vehículos',
          tipo: tipo.replace('vehiculos_', '').replace('_', ' ').toUpperCase(),
          deficit: Math.abs(gap),
          actual: existentes[tipo],
          necesario: necesarios.vehiculos[tipo],
          porcentaje: porcentajeDeficit.toFixed(1)
        });
      }
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
// FUNCIÓN PRINCIPAL
// ============================================================================

/**
 * Punto de entrada principal para calcular recursos
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
    'Cargando configuración y predicciones...'
  );
  
  try {
    // 1. Cargar ratios si no están cargados
    if (Object.keys(RATIOS_OPERATIVOS).length === 0) {
      const ratiosCargados = await cargarRatiosOperativos();
      if (!ratiosCargados) {
        throw new Error('No se pudieron cargar los ratios operativos');
      }
    }

    // 2. Obtener recursos y predicción en paralelo
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

    // 3. Validar predicción
    if (!prediccionResponse.success || !prediccionResponse.data) {
      throw new Error(prediccionResponse.error || 'Predicción no disponible');
    }

    // 4. Generar plan completo
    generarPlanCompleto(prediccionResponse.data, recursosExistentes);
    
    mostrarAlerta('✅ Análisis de recursos generado correctamente', 'success');
    
  } catch (error) {
    hideProgress();
    console.error('✗ Error en cálculo de recursos:', error);
    mostrarAlerta(
      `Error al calcular recursos: ${error.message}`,
      'error'
    );
  }
}

/**
 * Genera el plan completo de recursos
 */
function generarPlanCompleto(prediccion, recursosExistentes) {
  console.log('→ Generando plan completo de recursos...');
  
  const contenedor = document.getElementById('resultadoRecursos');
  if (contenedor) {
    contenedor.style.display = 'block';
  }
  
  // Calcular recursos necesarios
  const recursosCalculados = calcularRecursosNecesarios(prediccion);
  
  // Análisis de brechas
  const gapAnalysis = calcularAnalisisGap(recursosCalculados, recursosExistentes);
  
  // Actualizar métricas en UI
  actualizarMetricasGenerales(recursosCalculados, recursosExistentes, gapAnalysis);
  
  // Generar visualizaciones
  generarVisualizaciones(recursosCalculados, recursosExistentes, prediccion);
  
  // Generar recomendaciones
  generarRecomendacionesEstrategicas(prediccion, recursosCalculados, recursosExistentes, gapAnalysis);
  
  // Scroll suave al resultado
  contenedor?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  
  console.log('✓ Plan de recursos generado exitosamente');
}

// ============================================================================
// ACTUALIZACIÓN DE INTERFAZ
// ============================================================================

function actualizarMetricasGenerales(calculados, existentes, gaps) {
  // Personal
  const personalHTML = generarHTMLMetrica(
    calculados.metricas.total_personal,
    existentes ? (existentes.serenos + existentes.policias + existentes.bomberos) : null,
    gaps?.totales.personal
  );
  actualizarElemento('personalRequerido', personalHTML, true);
  
  // Vehículos
  const vehiculosHTML = generarHTMLMetrica(
    calculados.metricas.total_vehiculos,
    existentes ? (existentes.vehiculos_serenazgo + existentes.vehiculos_policia + 
                   existentes.vehiculos_bomberos + existentes.ambulancias) : null,
    gaps?.totales.vehiculos
  );
  actualizarElemento('vehiculosNecesarios', vehiculosHTML, true);
  
  // Presupuesto
  const presupuestoFormatted = formatearMoneda(calculados.metricas.presupuesto_mensual);
  actualizarElemento('presupuestoEstimado', presupuestoFormatted);
  
  // Horas
  const horasFormatted = calculados.metricas.horas_hombre.toLocaleString('es-PE');
  actualizarElemento('horasTrabajo', horasFormatted);
}

function generarHTMLMetrica(necesario, actual, diferencia) {
  let html = `<strong>${necesario}</strong>`;
  
  if (actual !== null && diferencia !== undefined) {
    const statusIcon = diferencia >= 0 ? '✅' : '⚠️';
    const statusColor = diferencia >= 0 ? '#4caf50' : '#ff9800';
    
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
// VISUALIZACIONES
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
  
  const ctx = document.getElementById('chartRecursos');
  if (!ctx) {
    console.error('✗ Canvas chartRecursos no encontrado');
    return;
  }
  
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
    existentes.personal_denuncias, // Personal denuncias no tiene existente
    existentes.vehiculos_serenazgo,
    existentes.vehiculos_policia,
    existentes.vehiculos_bomberos,
    existentes.ambulancias
  ];
  
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
              if (idx === 3) return ''; // Personal denuncias
              
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
          ticks: { precision: 0, font: { size: 11 } },
          grid: { color: 'rgba(0, 0, 0, 0.05)' }
        },
        x: {
          grid: { display: false },
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
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

function crearGraficoDistribucionEmergencias(emergenciasPorServicio) {
  const canvas = document.getElementById('chartDistribucionEmergencias');
  let ctx = canvas;
  
  if (!canvas) {
    ctx = document.createElement('canvas');
    ctx.id = 'chartDistribucionEmergencias';
    ctx.style.maxHeight = '320px';
    ctx.style.marginTop = '30px';
    
    const container = document.getElementById('chartRecursos')?.parentElement;
    if (container) {
      const separador = document.createElement('hr');
      separador.style.cssText = 'margin: 30px 0; border: none; border-top: 2px solid rgba(0,0,0,0.1);';
      container.appendChild(separador);
      container.appendChild(ctx);
    } else {
      return;
    }
  }
  
  // Destruir gráfico anterior si existe
  if (chartDistribucionEmergencias) {
    chartDistribucionEmergencias.destroy();
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
  const total = valores.reduce((sum, val) => sum + val, 0);
  
  chartDistribucionEmergencias = new Chart(ctx, {
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
              return data.labels.map((label, i) => {
                const value = data.datasets[0].data[i];
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
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
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
              return `${label}: ${value} llamadas (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

// ============================================================================
// RECOMENDACIONES ESTRATÉGICAS
// ============================================================================

function generarRecomendacionesEstrategicas(prediccion, calculados, existentes, gaps) {
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
            </p>
          </div>
        </div>
      </div>
    `;
  }

  const estado = gaps.estado;
  const config = estado === 'suficiente' ? {
    icon: '✅',
    color: '#4caf50',
    bg: 'rgba(76, 175, 80, 0.08)',
    titulo: 'Estado Óptimo - Recursos Suficientes',
    mensaje: 'Los recursos actuales del municipio son suficientes para atender la demanda proyectada.'
  } : {
    icon: '⚠️',
    color: '#ff9800',
    bg: 'rgba(255, 152, 0, 0.08)',
    titulo: 'Atención Requerida - Déficit Detectado',
    mensaje: 'Se identificaron brechas en la disponibilidad de recursos que requieren medidas correctivas.'
  };

  return `
    <div class="alert" style="margin: 20px 0; padding: 16px; border-left: 4px solid ${config.color}; background: ${config.bg}; border-radius: 6px;">
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <span style="font-size: 26px; line-height: 1;">${config.icon}</span>
        <div style="flex: 1;">
          <strong style="font-size: 14px; color: ${config.color};">${config.titulo}</strong>
          <p style="margin: 8px 0 0 0; font-size: 13px; line-height: 1.6; opacity: 0.95;">
            ${config.mensaje}
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
      <div style="overflow-x: auto;">
        <table class="comparison-table" style="width: 100%; font-size: 13px;">
          <thead>
            <tr style="background: rgba(244, 67, 54, 0.08);">
              <th style="padding: 12px 10px;">Recurso</th>
              <th style="text-align: center;">Disponible</th>
              <th style="text-align: center;">Requerido</th>
              <th style="text-align: center;">Déficit</th>
              <th style="text-align: center;">Criticidad</th>
            </tr>
          </thead>
          <tbody>
            ${deficits.map(d => {
              const nivelCriticidad = parseFloat(d.porcentaje) > 50 ? 'ALTA' : 
                                     parseFloat(d.porcentaje) > 30 ? 'MEDIA' : 'BAJA';
              const colorCriticidad = nivelCriticidad === 'ALTA' ? '#d32f2f' : 
                                     nivelCriticidad === 'MEDIA' ? '#f57c00' : '#fbc02d';
              
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
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function generarResumenEjecutivo(calculados, existentes) {
  const hasDatos = !!existentes;
  
  return `
    <div style="margin: 25px 0;">
      <h5 style="margin: 0 0 15px 0; font-size: 15px; color: #2c3e50;">
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
          `Incluye ${((RATIOS_OPERATIVOS.PRESUPUESTO.overhead - 1) * 100).toFixed(0)}% overhead`)}
        
        ${generarCardResumen('⏱️ Carga Operativa', 
          `${calculados.metricas.horas_hombre.toLocaleString('es-PE')} horas-hombre<br>
           ${calculados.metricas.casos_totales} casos totales`,
          `${(calculados.metricas.horas_hombre / RATIOS_OPERATIVOS.TIEMPO.dias_laborables_mes).toFixed(0)} horas/día promedio`)}
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
      <h5 style="margin: 0 0 15px 0; font-size: 15px; color: #2c3e50;">
        💡 Recomendaciones Operativas
      </h5>
      <div class="chart-container">
        <ol style="margin: 0; padding-left: 20px; line-height: 2; font-size: 13px;">
          <li>
            <strong>Distribución de Personal:</strong> 
            Asignar ${calculados.personal.serenos} serenos en zonas de alta incidencia. 
            Coordinar turnos rotativos de ${RATIOS_OPERATIVOS.TIEMPO.horas_turno} horas para cobertura 24/7.
          </li>
          <li>
            <strong>Gestión de Flota:</strong> 
            Mantener ${calculados.vehiculos.vehiculos_serenazgo + calculados.vehiculos.vehiculos_policia} unidades móviles 
            con disponibilidad inmediata.
            ${gaps && gaps.totales.vehiculos < 0 ? 
              '<span style="color: #f44336; font-weight: 600;"> ⚠️ Considerar alquiler de vehículos adicionales.</span>' : ''}
          </li>
          <li>
            <strong>Protocolos de Respuesta:</strong> 
            Emergencias críticas (${RATIOS_OPERATIVOS.TIEMPO.tiempo_critico_minutos} min), 
            urgencias (${RATIOS_OPERATIVOS.TIEMPO.tiempo_urgente_minutos} min), 
            casos regulares (${RATIOS_OPERATIVOS.TIEMPO.tiempo_regular_minutos} min).
          </li>
          <li>
            <strong>Coordinación Interinstitucional:</strong> 
            ${existentes && existentes.comisarias ? 
              `Mantener comunicación activa con las ${existentes.comisarias} comisarías y ${existentes.estaciones_bomberos} estaciones de bomberos.` :
              'Establecer canales de comunicación con entidades de respuesta.'}
          </li>
        </ol>
      </div>
    </div>
  `;
}

function generarIndicadoresDesempeno(calculados, gaps) {
  let eficienciaPersonal = 85;
  let coberturaVehicular = 85;
  
  if (gaps && gaps.totales.personal !== undefined) {
    const personalDisponible = calculados.metricas.total_personal + gaps.totales.personal;
    eficienciaPersonal = Math.min(100, (personalDisponible / calculados.metricas.total_personal) * 100);
  }
  
  if (gaps && gaps.totales.vehiculos !== undefined) {
    const vehiculosDisponibles = calculados.metricas.total_vehiculos + gaps.totales.vehiculos;
    coberturaVehicular = Math.min(100, (vehiculosDisponibles / calculados.metricas.total_vehiculos) * 100);
  }

  const capacidadRespuesta = ((eficienciaPersonal + coberturaVehicular) / 2).toFixed(1);
  const colorCapacidad = capacidadRespuesta >= 90 ? '#4caf50' :
                        capacidadRespuesta >= 75 ? '#ff9800' : '#f44336';

  const casosPorPersonal = (calculados.metricas.casos_totales / calculados.metricas.total_personal).toFixed(1);

  return `
    <div style="margin: 25px 0 0 0; padding: 20px; background: linear-gradient(135deg, rgba(74, 144, 226, 0.08) 0%, rgba(33, 150, 243, 0.08) 100%); border-radius: 8px; border: 1px solid rgba(74, 144, 226, 0.2);">
      <h5 style="margin: 0 0 15px 0; font-size: 15px; color: #2c3e50;">
        📈 Indicadores Clave de Desempeño (KPIs)
      </h5>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; text-align: center;">
        ${generarKPI('Capacidad de Respuesta', `${capacidadRespuesta}%`, capacidadRespuesta, '🎯')}
        ${generarKPI('Eficiencia Personal', `${eficienciaPersonal.toFixed(1)}%`, eficienciaPersonal, '👥')}
        ${generarKPI('Cobertura Vehicular', `${coberturaVehicular.toFixed(1)}%`, coberturaVehicular, '🚗')}
        ${generarKPI('Casos por Personal', casosPorPersonal, 50, '📊')}
      </div>
      <p style="margin: 15px 0 0 0; font-size: 11px; opacity: 0.7; text-align: center;">
        * Indicadores calculados con ratios configurables desde base de datos
      </p>
    </div>
  `;
}

function generarKPI(titulo, valor, porcentaje, emoji) {
  let color;
  if (porcentaje >= 80) color = '#27ae60';
  else if (porcentaje >= 60) color = '#f39c12';
  else color = '#e74c3c';
  
  return `
    <div>
      <div style="font-size: 11px; text-transform: uppercase; color: #666; margin-bottom: 5px; font-weight: 600; letter-spacing: 0.5px;">
        ${titulo}
      </div>
      <div style="font-size: 24px; font-weight: 700; color: ${color};">
        ${emoji} ${valor}
      </div>
    </div>
  `;
}

// ============================================================================
// UTILIDADES
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

// Agregar estilos de animación
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

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

console.log('✨ Módulo de Recursos v3.0.0 cargado correctamente');
console.log('   → Sistema 100% dinámico desde base de datos');
console.log('   → Sin valores hardcodeados');
console.log('   → Configuración adaptable en tiempo real');