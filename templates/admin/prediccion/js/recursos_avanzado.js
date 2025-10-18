/**
 * ============================================================================
 * MÓDULO DE GESTIÓN Y ASIGNACIÓN DE RECURSOS MUNICIPALES - VERSIÓN ESTABLE
 * ============================================================================
 * 
 * 100% DINÁMICO - Sin hardcode excepto nombres en config.js
 * - Ratios operativos: configuracion_ratios (BD)
 * - Inventario: recursos_municipales (BD)
 * - Nombres: config.js (DENUNCIAS_MAP, EMERGENCIAS_MAP)
 * 
 * @version 3.0.1 ESTABLE
 * ============================================================================
 */

// ============================================================================
// CONFIGURACIÓN Y CACHE
// ============================================================================

let RATIOS_OPERATIVOS = {};
let recursosActualesCache = null;
let ultimoFetchRecursos = null;
const CACHE_TTL = 5 * 60 * 1000;

window.chartRecursos = null;
window.chartDistEmergencias = null;

// ============================================================================
// CARGA DE RATIOS OPERATIVOS
// ============================================================================

async function cargarRatiosOperativos() {
  try {
    console.log('→ Cargando ratios desde configuracion_ratios...');
    const res = await fetch('/api/configuracion/ratios');
    const result = await res.json();
    if (result.success) {
      RATIOS_OPERATIVOS = result.data;
      console.log('✅ RATIOS_OPERATIVOS cargados');
      return true;
    }
    console.error('❌ Error al obtener ratios:', result.error);
    return false;
  } catch (error) {
    console.error('❌ Error de conexión:', error);
    return false;
  }
}

// ============================================================================
// OBTENER RECURSOS ACTUALES
// ============================================================================

async function obtenerRecursosActuales() {
  try {
    const ahora = Date.now();
    if (recursosActualesCache && ultimoFetchRecursos &&
        (ahora - ultimoFetchRecursos) < CACHE_TTL) {
      console.log('✓ Usando recursos desde cache');
      return recursosActualesCache;
    }

    console.log('→ Consultando recursos_municipales...');
    const response = await fetch(`${API_URL}/api/recursos/inventario`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    if (data.success && data.data) {
      recursosActualesCache = data.data;
      ultimoFetchRecursos = ahora;
      console.log('✓ Recursos obtenidos');
      return recursosActualesCache;
    }
    return null;
  } catch (error) {
    console.error('✗ Error obteniendo recursos:', error);
    return recursosActualesCache;
  }
}

// ============================================================================
// FUNCIÓN PRINCIPAL: CALCULAR RECURSOS
// ============================================================================

async function calcularRecursos() {
  const mesPlan = document.getElementById('mesPlanificacion')?.value;
  if (!mesPlan) return mostrarAlerta('Por favor, seleccione un mes', 'warning');

  const [year, month] = mesPlan.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return mostrarAlerta('Formato de fecha inválido', 'error');
  }

  showProgress('Calculando Asignación de Recursos', 'Procesando...');

  try {
    if (!RATIOS_OPERATIVOS || Object.keys(RATIOS_OPERATIVOS).length === 0) {
      const cargado = await cargarRatiosOperativos();
      if (!cargado) throw new Error('No se pudieron cargar los ratios operativos');
    }

    const [recursosExistentes, prediccionResponse] = await Promise.all([
      obtenerRecursosActuales(),
      fetch(`${API_URL}/api/modelo/prediccion/predecir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month })
      }).then(res => res.ok ? res.json() : Promise.reject(`HTTP ${res.status}`))
    ]);

    hideProgress();

    if (!prediccionResponse.success || !prediccionResponse.data) {
      throw new Error(prediccionResponse.error || 'Predicción no disponible');
    }

    generarPlanCompleto(prediccionResponse.data, recursosExistentes);

  } catch (error) {
    hideProgress();
    console.error('✗ Error:', error);
    mostrarAlerta(`Error: ${error.message || error}`, 'error');
  }
}

// ============================================================================
// CÁLCULO DE RECURSOS NECESARIOS
// ============================================================================

function calcularRecursosNecesarios(prediccion) {
  const totalDenuncias = Object.values(prediccion.denuncias || {}).reduce((s, v) => s + v, 0);
  const totalEmergencias = Object.values(prediccion.emergencias || {}).reduce((s, v) => s + v, 0);

  const emergenciasPorServicio = {
    policia: prediccion.emergencias?.[2] || 0,
    serenazgo: prediccion.emergencias?.[3] || 0,
    ambulancia: prediccion.emergencias?.[4] || 0,
    bomberos: (prediccion.emergencias?.[5] || 0) + (prediccion.emergencias?.[6] || 0)
  };

  const personalNecesario = {
    serenos: Math.ceil(emergenciasPorServicio.serenazgo / RATIOS_OPERATIVOS.SERENO.llamadas_mes),
    policias: Math.ceil(emergenciasPorServicio.policia / RATIOS_OPERATIVOS.POLICIA.llamadas_mes),
    bomberos: Math.ceil(emergenciasPorServicio.bomberos / RATIOS_OPERATIVOS.BOMBERO.llamadas_mes),
    personal_denuncias: Math.ceil(totalDenuncias / RATIOS_OPERATIVOS.SERENO.casos_mes)
  };

  const vehiculosNecesarios = {
    vehiculos_serenazgo: Math.ceil(emergenciasPorServicio.serenazgo / RATIOS_OPERATIVOS.VEHICULO_SERENAZGO.llamadas_mes),
    vehiculos_policia: Math.ceil(emergenciasPorServicio.policia / RATIOS_OPERATIVOS.VEHICULO_POLICIA.llamadas_mes),
    vehiculos_bomberos: Math.ceil(emergenciasPorServicio.bomberos / RATIOS_OPERATIVOS.VEHICULO_BOMBEROS.llamadas_mes),
    ambulancias: Math.ceil(emergenciasPorServicio.ambulancia / RATIOS_OPERATIVOS.AMBULANCIA.llamadas_mes)
  };

  const totalCasos = totalDenuncias + totalEmergencias;
  const presupuesto = Math.round(totalCasos * RATIOS_OPERATIVOS.PRESUPUESTO.costo_caso * RATIOS_OPERATIVOS.PRESUPUESTO.overhead);
  const horasHombre = totalCasos * RATIOS_OPERATIVOS.TIEMPO.horas_caso;

  return { personal: personalNecesario, vehiculos: vehiculosNecesarios, emergencias_por_servicio: emergenciasPorServicio,
           metricas: { total_personal: Object.values(personalNecesario).reduce((s, v) => s+v,0),
                       total_vehiculos: Object.values(vehiculosNecesarios).reduce((s,v)=>s+v,0),
                       presupuesto_mensual: presupuesto, horas_hombre: horasHombre, casos_totales: totalCasos }};
}

// ============================================================================
// ANÁLISIS GAP
// ============================================================================

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

  const totalGapPersonal = Object.values(gaps.personal).reduce((s,v)=>s+v,0);
  const totalGapVehiculos = Object.values(gaps.vehiculos).reduce((s,v)=>s+v,0);
  const deficitsCriticos = [];

  Object.entries(gaps.personal).forEach(([tipo, gap]) => {
    const pct = (gap / necesarios.personal[tipo]) * 100;
    if (pct < -20) deficitsCriticos.push({ categoria: 'Personal', tipo: tipo.charAt(0).toUpperCase()+tipo.slice(1), deficit: Math.abs(gap), actual: existentes[tipo], necesario: necesarios.personal[tipo], porcentaje: Math.abs(pct).toFixed(1)});
  });

  Object.entries(gaps.vehiculos).forEach(([tipo, gap]) => {
    const pct = (gap / necesarios.vehiculos[tipo]) * 100;
    if (pct < -20) deficitsCriticos.push({ categoria: 'Vehículos', tipo: tipo.replace('vehiculos_','').replace('_',' ').toUpperCase(), deficit: Math.abs(gap), actual: existentes[tipo], necesario: necesarios.vehiculos[tipo], porcentaje: Math.abs(pct).toFixed(1)});
  });

  return { gaps, totales: { personal: totalGapPersonal, vehiculos: totalGapVehiculos },
           estado: totalGapPersonal >= 0 && totalGapVehiculos >= 0 ? 'suficiente':'deficit',
           deficits_criticos: deficitsCriticos };
}

// ============================================================================
// GENERACIÓN PLAN COMPLETO
// ============================================================================

function generarPlanCompleto(prediccion, recursosExistentes) {
  const contenedor = document.getElementById('resultadoRecursos');
  if (contenedor) contenedor.style.display = 'block';

  const recursosCalculados = calcularRecursosNecesarios(prediccion);
  const gapAnalysis = calcularAnalisisGap(recursosCalculados, recursosExistentes);

  actualizarMetricasGenerales(recursosCalculados, recursosExistentes, gapAnalysis);
  generarVisualizaciones(recursosCalculados, recursosExistentes, prediccion);
  generarRecomendacionesEstrategicas(prediccion, recursosCalculados, recursosExistentes, gapAnalysis);

  contenedor?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  console.log('✓ Plan generado exitosamente');
}
// ============================================================================
// ACTUALIZACIÓN DE UI
// ============================================================================

function actualizarMetricasGenerales(calculados, existentes, gaps) {
  actualizarElemento('personalRequerido', generarHTMLPersonal(calculados, existentes, gaps), true);
  actualizarElemento('vehiculosNecesarios', generarHTMLVehiculos(calculados, existentes, gaps), true);
  actualizarElemento('presupuestoEstimado', formatearMoneda(calculados.metricas.presupuesto_mensual));
  actualizarElemento('horasTrabajo', calculados.metricas.horas_hombre.toLocaleString('es-PE'));
}

function generarHTMLPersonal(calculados, existentes, gaps) {
  let html = `<strong>${calculados.metricas.total_personal}</strong>`;
  
  if (existentes && gaps) {
    const actual = existentes.serenos + existentes.policias + existentes.bomberos;
    const icon = gaps.totales.personal >= 0 ? '✅' : '⚠️';
    const color = gaps.totales.personal >= 0 ? '#4caf50' : '#ff9800';
    const dif = gaps.totales.personal;
    
    html += `<br><small style="font-size: 13px; opacity: 0.85; color: ${color};">
      Actuales: ${actual} ${icon} ${dif !== 0 ? `(${dif > 0 ? '+' : ''}${dif})` : ''}
    </small>`;
  }
  
  return html;
}

function generarHTMLVehiculos(calculados, existentes, gaps) {
  let html = `<strong>${calculados.metricas.total_vehiculos}</strong>`;
  
  if (existentes && gaps) {
    const actual = existentes.vehiculos_serenazgo + existentes.vehiculos_policia + 
                   existentes.vehiculos_bomberos + existentes.ambulancias;
    const icon = gaps.totales.vehiculos >= 0 ? '✅' : '⚠️';
    const color = gaps.totales.vehiculos >= 0 ? '#4caf50' : '#ff9800';
    const dif = gaps.totales.vehiculos;
    
    html += `<br><small style="font-size: 13px; opacity: 0.85; color: ${color};">
      Actuales: ${actual} ${icon} ${dif !== 0 ? `(${dif > 0 ? '+' : ''}${dif})` : ''}
    </small>`;
  }
  
  return html;
}

// ============================================================================
// VISUALIZACIONES (GRÁFICOS)
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
  if (window.chartRecursos) window.chartRecursos.destroy();
  
  const ctx = document.getElementById('chartRecursos');
  if (!ctx) return;
  
  window.chartRecursos = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Serenos', 'Policías', 'Bomberos', 'Personal\nDenuncias', 
               'Veh. Serenazgo', 'Veh. Policía', 'Veh. Bomberos', 'Ambulancias'],
      datasets: [
        {
          label: 'Disponibles',
          data: [existentes.serenos, existentes.policias, existentes.bomberos, 0,
                 existentes.vehiculos_serenazgo, existentes.vehiculos_policia,
                 existentes.vehiculos_bomberos, existentes.ambulancias],
          backgroundColor: 'rgba(76, 175, 80, 0.75)',
          borderColor: 'rgba(76, 175, 80, 1)',
          borderWidth: 2
        },
        {
          label: 'Requeridos',
          data: [calculados.personal.serenos, calculados.personal.policias, 
                 calculados.personal.bomberos, calculados.personal.personal_denuncias,
                 calculados.vehiculos.vehiculos_serenazgo, calculados.vehiculos.vehiculos_policia,
                 calculados.vehiculos.vehiculos_bomberos, calculados.vehiculos.ambulancias],
          backgroundColor: 'rgba(33, 150, 243, 0.75)',
          borderColor: 'rgba(33, 150, 243, 1)',
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: 'Recursos Disponibles vs Requeridos' },
        legend: { position: 'top' }
      },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function crearGraficoRecursosNecesarios(calculados) {
  if (window.chartRecursos) window.chartRecursos.destroy();
  
  const ctx = document.getElementById('chartRecursos');
  if (!ctx) return;
  
  window.chartRecursos = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Serenos', 'Policías', 'Bomberos', 'Ambulancias'],
      datasets: [{
        label: 'Recursos Requeridos',
        data: [calculados.personal.serenos, calculados.personal.policias,
               calculados.personal.bomberos, calculados.vehiculos.ambulancias],
        backgroundColor: 'rgba(33, 150, 243, 0.75)'
      }]
    },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: 'Recursos Necesarios' } },
      scales: { y: { beginAtZero: true } }
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
      const hr = document.createElement('hr');
      hr.style.cssText = 'margin: 30px 0; border: none; border-top: 2px solid rgba(0,0,0,0.1);';
      container.appendChild(hr);
      container.appendChild(canvas);
    }
  }
  
  if (window.chartDistEmergencias) window.chartDistEmergencias.destroy();
  
  const nombres = {
    'policia': 'Policía Nacional',
    'serenazgo': 'Serenazgo Municipal',
    'ambulancia': 'Servicio Médico',
    'bomberos': 'Cuerpo de Bomberos'
  };
  
  window.chartDistEmergencias = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: Object.keys(emergenciasPorServicio).map(k => nombres[k] || k),
      datasets: [{
        data: Object.values(emergenciasPorServicio),
        backgroundColor: ['rgba(76, 175, 80, 0.85)', 'rgba(255, 152, 0, 0.85)',
                         'rgba(33, 150, 243, 0.85)', 'rgba(244, 67, 54, 0.85)']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: 'Distribución de Emergencias por Servicio' },
        legend: { position: 'bottom' }
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
      <h4 style="margin: 0 0 10px 0; font-size: 18px; color: #ffff;">
        📋 Plan Estratégico de Asignación de Recursos
      </h4>
      <p style="margin: 0; font-size: 13px; opacity: 0.7;">
        Mes: <strong>${prediccion.fecha_prediccion}</strong> | 
        Casos: <strong>${calculados.metricas.casos_totales}</strong>
      </p>
    </div>
  `;

  html += generarSeccionEstadoGeneral(gaps, existentes);

  if (gaps?.deficits_criticos?.length > 0) {
    html += generarTablaDeficitsCriticos(gaps.deficits_criticos);
  }

  html += generarResumenEjecutivo(calculados, existentes);
  html += generarIndicadoresDesempeno(calculados, gaps);

  actualizarElemento('planAccion', html, true);
}

function generarSeccionEstadoGeneral(gaps, existentes) {
  if (!gaps || !existentes) {
    return `<div class="alert alert-warning" style="margin: 20px 0; padding: 16px;">
      ℹ️ Inventario no disponible
    </div>`;
  }

  const cfg = gaps.estado === 'suficiente' ? 
    { icon: '✅', color: '#4caf50', titulo: 'Recursos Suficientes' } :
    { icon: '⚠️', color: '#ff9800', titulo: 'Déficit Detectado' };

  return `<div style="margin: 20px 0; padding: 16px; border-left: 4px solid ${cfg.color}; background: ${cfg.color}22;">
    <strong>${cfg.icon} ${cfg.titulo}</strong>
    <div style="margin-top: 10px; font-size: 12px;">
      Balance Personal: <span style="color: ${gaps.totales.personal >= 0 ? '#4caf50' : '#f44336'};">
        ${gaps.totales.personal >= 0 ? '+' : ''}${gaps.totales.personal}
      </span> |
      Balance Vehículos: <span style="color: ${gaps.totales.vehiculos >= 0 ? '#4caf50' : '#f44336'};">
        ${gaps.totales.vehiculos >= 0 ? '+' : ''}${gaps.totales.vehiculos}
      </span>
    </div>
  </div>`;
}

function generarTablaDeficitsCriticos(deficits) {
  return `
    <div style="margin: 25px 0;">
      <h5 style="color: #f44336;">🚨 Déficits Críticos (${deficits.length})</h5>
      <table style="width: 100%; font-size: 13px;">
        <thead>
          <tr style="background: rgba(244, 67, 54, 0.08);">
            <th style="padding: 10px;">Recurso</th>
            <th style="text-align: center;">Disponible</th>
            <th style="text-align: center;">Necesario</th>
            <th style="text-align: center;">Déficit</th>
          </tr>
        </thead>
        <tbody>
          ${deficits.map(d => `
            <tr>
              <td style="padding: 10px;"><strong>${d.tipo}</strong></td>
              <td style="text-align: center;">${d.actual}</td>
              <td style="text-align: center;">${d.necesario}</td>
              <td style="text-align: center; color: #f44336; font-weight: 600;">-${d.deficit}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function generarResumenEjecutivo(calculados, existentes) {
  return `
    <div style="margin: 25px 0;">
      <h5>📊 Resumen Ejecutivo</h5>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
        <div style="padding: 15px; background: rgba(74, 144, 226, 0.05); border-left: 3px solid #4a90e2;">
          <div style="font-size: 12px; color: #4a90e2;">👥 PERSONAL</div>
          <div style="font-size: 14px; font-weight: 600;">
            ${calculados.personal.serenos} serenos<br>
            ${calculados.personal.policias} policías<br>
            ${calculados.personal.bomberos} bomberos
          </div>
        </div>
        <div style="padding: 15px; background: rgba(74, 144, 226, 0.05); border-left: 3px solid #4a90e2;">
          <div style="font-size: 12px; color: #4a90e2;">🚗 VEHÍCULOS</div>
          <div style="font-size: 14px; font-weight: 600;">
            ${calculados.vehiculos.vehiculos_serenazgo + calculados.vehiculos.vehiculos_policia} patrullas<br>
            ${calculados.vehiculos.ambulancias} ambulancias<br>
            ${calculados.vehiculos.vehiculos_bomberos} unidades bomberos
          </div>
        </div>
        <div style="padding: 15px; background: rgba(74, 144, 226, 0.05); border-left: 3px solid #4a90e2;">
          <div style="font-size: 12px; color: #4a90e2;">💰 PRESUPUESTO</div>
          <div style="font-size: 14px; font-weight: 600;">
            ${formatearMoneda(calculados.metricas.presupuesto_mensual)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function generarIndicadoresDesempeno(calculados, gaps) {
  let efPersonal = 85, efVehiculos = 85;
  
  if (gaps?.totales) {
    const pDisp = calculados.metricas.total_personal + gaps.totales.personal;
    const vDisp = calculados.metricas.total_vehiculos + gaps.totales.vehiculos;
    efPersonal = Math.min(100, (pDisp / calculados.metricas.total_personal) * 100);
    efVehiculos = Math.min(100, (vDisp / calculados.metricas.total_vehiculos) * 100);
  }

  const capacidad = ((efPersonal + efVehiculos) / 2).toFixed(1);
  const colorCap = capacidad >= 90 ? '#4caf50' : capacidad >= 75 ? '#ff9800' : '#f44336';

  return `
    <div style="margin: 25px 0; padding: 20px; background: linear-gradient(135deg, rgba(74, 144, 226, 0.08), rgba(33, 150, 243, 0.08)); border-radius: 8px;">
      <h5 style="margin: 0 0 15px 0;">📈 Indicadores Clave (KPIs)</h5>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; text-align: center;">
        <div>
          <div style="font-size: 11px; text-transform: uppercase; color: #666;">Capacidad Respuesta</div>
          <div style="font-size: 24px; font-weight: 700; color: ${colorCap};">${capacidad}%</div>
        </div>
        <div>
          <div style="font-size: 11px; text-transform: uppercase; color: #666;">Eficiencia Personal</div>
          <div style="font-size: 24px; font-weight: 700; color: ${efPersonal >= 90 ? '#4caf50' : '#ff9800'};">${efPersonal.toFixed(1)}%</div>
        </div>
        <div>
          <div style="font-size: 11px; text-transform: uppercase; color: #666;">Cobertura Vehicular</div>
          <div style="font-size: 24px; font-weight: 700; color: ${efVehiculos >= 90 ? '#4caf50' : '#ff9800'};">${efVehiculos.toFixed(1)}%</div>
        </div>
        <div>
          <div style="font-size: 11px; text-transform: uppercase; color: #666;">Casos por Personal</div>
          <div style="font-size: 24px; font-weight: 700; color: #4a90e2;">${(calculados.metricas.casos_totales / calculados.metricas.total_personal).toFixed(1)}</div>
        </div>
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
    position: fixed; top: 20px; right: 20px; max-width: 400px;
    padding: 16px 20px; background: ${config.bg};
    border-left: 4px solid ${config.border}; border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `;

  alerta.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 20px;">${config.icon}</span>
      <div style="flex: 1; font-size: 14px;">${mensaje}</div>
      <button onclick="this.parentElement.parentElement.remove()" 
              style="background: none; border: none; font-size: 20px; cursor: pointer; opacity: 0.5;">×</button>
    </div>
  `;

  document.body.appendChild(alerta);

  setTimeout(() => {
    alerta.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => alerta.remove(), 300);
  }, 6000);
}

// Agregar animaciones CSS
if (!document.getElementById('recursos-animations-style')) {
  const style = document.createElement('style');
  style.id = 'recursos-animations-style';
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

console.log('✓ Módulo de Recursos cargado (100% dinámico desde BD)');