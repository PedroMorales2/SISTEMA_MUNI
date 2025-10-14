// ==========================================
// PREDICCIÓN ESPACIAL - ARCHIVO LIMPIO
// ==========================================

// Variables globales espaciales (declarar solo si no existen)
if (typeof cuadrantesLayer === 'undefined') {
  var cuadrantesLayer = null;
  var cuadrantesData = null;
  var prediccionEspacialActual = null;
  var heatmapLayer = null;
  var filtroActual = 'todos';
}

/**
 * Inicializa el sistema de cuadrantes
 */
async function inicializarMapaCuadrantes() {
  try {
    console.log('🗺️ Cargando cuadrantes...');
    const response = await fetch(`${API_URL}/api/modelo/espacial/cuadrantes`);
    const data = await response.json();

    if (data.success) {
      cuadrantesData = data.data;
      console.log(`✅ ${cuadrantesData.cuadrantes.length} cuadrantes cargados`);
      
      const infoElement = document.getElementById('infoCuadrantes');
      if (infoElement) {
        const gridRows = cuadrantesData.grid_size[0];
        const gridCols = cuadrantesData.grid_size[1];
        const totalCuad = cuadrantesData.cuadrantes.length;
        
        infoElement.innerHTML = `
          <div style="text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #667eea;">${totalCuad}</div>
            <div style="font-size: 12px; color: #666; margin-top: 3px;">Grilla ${gridRows}×${gridCols}</div>
          </div>
        `;
      }
    } else {
      console.warn('⚠️ Modelo espacial no disponible:', data.error);
      const infoElement = document.getElementById('infoCuadrantes');
      if (infoElement) {
        infoElement.innerHTML = `
          <div style="text-align: center;">
            <div style="font-size: 18px; font-weight: bold; color: #f44336;">-</div>
            <div style="font-size: 11px; color: #f44336; margin-top: 3px;">No disponible</div>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('❌ Error cargando cuadrantes:', error);
  }
}

/**
 * Predice incidencias por cuadrante
 */
async function predecirEspacial() {
  const yearInput = document.getElementById('yearInputEspacial');
  const monthInput = document.getElementById('monthInputEspacial');
  
  if (!yearInput || !monthInput) {
    showToast('Error: No se encontraron los campos de entrada', 'error');
    return;
  }
  
  const year = parseInt(yearInput.value);
  const month = parseInt(monthInput.value);
  
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    showToast('Por favor ingresa valores válidos', 'error');
    return;
  }
  
  showProgress('Calculando Predicción Espacial', 'Analizando patrones geográficos...');
  const progressInterval = simulateProgress(8000);

  try {
    updateProgress(20, 'Consultando modelo LSTM...');
    
    const response = await fetch(`${API_URL}/api/modelo/espacial/predecir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month })
    });

    updateProgress(60, 'Distribuyendo predicciones por cuadrantes...');
    const data = await response.json();

    if (data.success) {
      clearInterval(progressInterval);
      updateProgress(90, 'Generando visualización en mapa...');
      
      prediccionEspacialActual = data.data;
      filtroActual = 'todos';
      
      mostrarCuadrantesEnMapa(data.data, 'todos');
      mostrarResumenEspacial(data.data);
      
      updateProgress(100, '¡Predicción completada!');
      
      setTimeout(() => {
        hideProgress();
        showToast(`Predicción espacial generada para ${year}-${month.toString().padStart(2, '0')}`, 'success');
      }, 500);
      
    } else {
      clearInterval(progressInterval);
      hideProgress();
      showToast('Error: ' + data.error, 'error');
    }
  } catch (error) {
    clearInterval(progressInterval);
    hideProgress();
    console.error('Error completo:', error);
    showToast('Error de conexión: ' + error.message, 'error');
  }
}

/**
 * Muestra cuadrantes en el mapa con filtros
 */
function mostrarCuadrantesEnMapa(prediccionData, filtro = 'todos') {
  if (typeof map === 'undefined' || !map) {
    console.error('❌ Mapa no inicializado');
    if (typeof inicializarMapa === 'function') {
      map = inicializarMapa();
      if (!map) {
        alert('Error: El mapa no está disponible. Por favor recarga la página.');
        return;
      }
    } else {
      alert('Error: El mapa no está inicializado.');
      return;
    }
  }

  console.log(`🗺️ Mostrando cuadrantes (filtro: ${filtro})...`);

  if (cuadrantesLayer) {
    map.removeLayer(cuadrantesLayer);
  }

  const features = [];

  prediccionData.cuadrantes.forEach(cuad => {
    const bounds = cuad.bounds;
    const coordinates = [
      [bounds.lon_min, bounds.lat_min],
      [bounds.lon_max, bounds.lat_min],
      [bounds.lon_max, bounds.lat_max],
      [bounds.lon_min, bounds.lat_max],
      [bounds.lon_min, bounds.lat_min]
    ];

    const denuncias_pred = Object.values(cuad.prediccion.denuncias).reduce((a, b) => a + b, 0);
    const emergencias_pred = Object.values(cuad.prediccion.emergencias).reduce((a, b) => a + b, 0);
    
    let total_mostrar = cuad.prediccion.total;
    if (filtro === 'denuncias') total_mostrar = denuncias_pred;
    else if (filtro === 'emergencias') total_mostrar = emergencias_pred;
    
    let color = cuad.color;
    let nivel = cuad.nivel_criticidad;
    
    if (total_mostrar >= 50) { color = '#d32f2f'; nivel = 'alto'; }
    else if (total_mostrar >= 20) { color = '#f57c00'; nivel = 'medio'; }
    else if (total_mostrar >= 5) { color = '#fbc02d'; nivel = 'bajo'; }
    else { color = '#388e3c'; nivel = 'muy_bajo'; }

    let tipoDominante = 'Sin predicciones';
    let iconoDominante = '📊';
    
    if (filtro === 'todos' || filtro === 'denuncias') {
      if (Object.keys(cuad.prediccion.denuncias).length > 0) {
        const maxTipoDen = Object.entries(cuad.prediccion.denuncias).sort((a, b) => b[1] - a[1])[0];
        if (maxTipoDen) {
          tipoDominante = DENUNCIAS_MAP[maxTipoDen[0]] || `Tipo ${maxTipoDen[0]}`;
          iconoDominante = '📋';
        }
      }
    }
    
    if ((filtro === 'todos' || filtro === 'emergencias') && Object.keys(cuad.prediccion.emergencias).length > 0) {
      const maxTipoEme = Object.entries(cuad.prediccion.emergencias).sort((a, b) => b[1] - a[1])[0];
      if (maxTipoEme && (filtro === 'emergencias' || emergencias_pred > denuncias_pred)) {
        tipoDominante = EMERGENCIAS_MAP[maxTipoEme[0]] || `Tipo ${maxTipoEme[0]}`;
        iconoDominante = '🚨';
      }
    }

    features.push({
      type: 'Feature',
      properties: {
        cuadrante_id: cuad.cuadrante_id,
        total: total_mostrar,
        nivel: nivel,
        color: color,
        tipo_dominante: tipoDominante,
        icono_dominante: iconoDominante,
        denuncias_pred: denuncias_pred,
        emergencias_pred: emergencias_pred,
        historico_den: cuad.historico.total_denuncias,
        historico_eme: cuad.historico.total_emergencias,
        filtro: filtro
      },
      geometry: { type: 'Polygon', coordinates: [coordinates] }
    });
  });

  cuadrantesLayer = L.geoJSON({ type: 'FeatureCollection', features: features }, {
    style: function(feature) {
      return {
        fillColor: feature.properties.color,
        fillOpacity: 0.4,
        color: feature.properties.color,
        weight: 2,
        opacity: 0.9
      };
    },
    onEachFeature: function(feature, layer) {
      const props = feature.properties;
      
      const popupContent = `
        <div style="min-width: 280px;">
          <h4 style="margin: 0 0 10px 0; color: ${props.color}; font-size: 16px;">
            ${props.icono_dominante} Cuadrante #${props.cuadrante_id}
          </h4>
          
          <div style="background: ${props.color}; color: white; padding: 12px; border-radius: 6px; margin-bottom: 12px; text-align: center;">
            <div style="font-size: 28px; font-weight: bold; margin-bottom: 5px;">${props.total}</div>
            <div style="font-size: 13px; opacity: 0.95;">
              ${props.filtro === 'todos' ? 'Total Predicho' : props.filtro === 'denuncias' ? 'Denuncias Predichas' : 'Emergencias Predichas'}
            </div>
            <div style="font-size: 11px; opacity: 0.8; margin-top: 3px; text-transform: uppercase;">Nivel: ${props.nivel.replace('_', ' ')}</div>
          </div>
          
          <div style="margin-bottom: 12px; padding: 10px; background: #f5f5f5; border-radius: 6px;">
            <strong>🎯 Tipo Dominante Predicho:</strong><br/>
            <span style="color: #555; font-size: 14px;">${props.tipo_dominante}</span>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 12px; border-radius: 6px; text-align: center;">
              <div style="font-size: 11px; color: #1565c0; font-weight: bold; margin-bottom: 5px;">📋 DENUNCIAS</div>
              <div style="font-size: 24px; font-weight: bold; color: #1565c0;">${props.denuncias_pred}</div>
              <div style="font-size: 10px; color: #666; margin-top: 3px;">predichas</div>
            </div>
            <div style="background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%); padding: 12px; border-radius: 6px; text-align: center;">
              <div style="font-size: 11px; color: #c62828; font-weight: bold; margin-bottom: 5px;">🚨 EMERGENCIAS</div>
              <div style="font-size: 24px; font-weight: bold; color: #c62828;">${props.emergencias_pred}</div>
              <div style="font-size: 10px; color: #666; margin-top: 3px;">predichas</div>
            </div>
          </div>
          
          <div style="margin-top: 12px; padding: 10px; background: #fff3e0; border-radius: 6px; border-left: 3px solid #ff9800;">
            <div style="font-size: 11px; color: #e65100; font-weight: bold; margin-bottom: 5px;">📊 Comparación con Histórico</div>
            <div style="font-size: 11px; color: #666;">
              Denuncias históricas: ${props.historico_den} casos<br/>
              Emergencias históricas: ${props.historico_eme} casos
            </div>
          </div>
          
          <button onclick="verDetalleCuadrante(${props.cuadrante_id})" 
                  style="width: 100%; margin-top: 12px; padding: 10px; background: ${props.color}; 
                         color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px;">
            📊 Ver Análisis Completo
          </button>
        </div>
      `;
      
      layer.bindPopup(popupContent, { maxWidth: 320 });
      layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.7, weight: 3 }));
      layer.on('mouseout', () => layer.setStyle({ fillOpacity: 0.4, weight: 2 }));
    }
  }).addTo(map);

  if (cuadrantesData && cuadrantesData.grid_bounds) {
    const bounds = cuadrantesData.grid_bounds;
    map.fitBounds([
      [bounds.lat_min, bounds.lon_min],
      [bounds.lat_max, bounds.lon_max]
    ], { padding: [50, 50] });
  }

  console.log(`✅ ${prediccionData.cuadrantes.length} cuadrantes visualizados`);
}

/**
 * Muestra resumen espacial
 */
function mostrarResumenEspacial(prediccionData) {
  const resumen = prediccionData.resumen;
  const contenedor = document.getElementById('resumenEspacial');
  if (!contenedor) return;

  const totalDenunciasPred = prediccionData.cuadrantes.reduce((sum, c) => 
    sum + Object.values(c.prediccion.denuncias).reduce((a, b) => a + b, 0), 0
  );
  const totalEmergenciasPred = prediccionData.cuadrantes.reduce((sum, c) => 
    sum + Object.values(c.prediccion.emergencias).reduce((a, b) => a + b, 0), 0
  );

  const html = `
    <div class="control-panel">
        <span style="font-size: 32px;">🗺️</span>
        <span>Resumen de Predicción Espacial - ${prediccionData.fecha_prediccion}</span>
      </h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-top: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; color: white;">
          <div style="font-size: 13px; opacity: 0.9; margin-bottom: 5px;">Total Predicho</div>
          <div style="font-size: 36px; font-weight: bold;">${resumen.total_incidencias_predichas}</div>
          <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">Todas las zonas</div>
        </div>
        <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 20px; border-radius: 10px; color: white;">
          <div style="font-size: 13px; opacity: 0.9; margin-bottom: 5px;">Denuncias Predichas</div>
          <div style="font-size: 36px; font-weight: bold;">${totalDenunciasPred}</div>
          <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">En ${prediccionData.cuadrantes.length} cuadrantes</div>
        </div>
        <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 20px; border-radius: 10px; color: white;">
          <div style="font-size: 13px; opacity: 0.9; margin-bottom: 5px;">Emergencias Predichas</div>
          <div style="font-size: 36px; font-weight: bold;">${totalEmergenciasPred}</div>
          <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">Llamadas de emergencia</div>
        </div>
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 10px; color: white;">
          <div style="font-size: 13px; opacity: 0.9; margin-bottom: 5px;">Zona Más Crítica</div>
          <div style="font-size: 36px; font-weight: bold;">Cuad. #${resumen.cuadrante_mas_critico.id}</div>
          <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">${resumen.cuadrante_mas_critico.total} incidencias</div>
        </div>
      </div>
      
      <div class="control-panel">
        <h4 style="margin: 0 0 15px 0; color: #333;">📍 Distribución por Nivel de Criticidad</h4>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; text-align: center;">
          <div><div style="color: #d32f2f; font-size: 32px; font-weight: bold;">${resumen.distribucion_niveles.alto}</div><div style="font-size: 12px; color: #666; margin-top: 5px;">Alto (≥50)</div></div>
          <div><div style="color: #f57c00; font-size: 32px; font-weight: bold;">${resumen.distribucion_niveles.medio}</div><div style="font-size: 12px; color: #666; margin-top: 5px;">Medio (20-49)</div></div>
          <div><div style="color: #fbc02d; font-size: 32px; font-weight: bold;">${resumen.distribucion_niveles.bajo}</div><div style="font-size: 12px; color: #666; margin-top: 5px;">Bajo (5-19)</div></div>
          <div><div style="color: #388e3c; font-size: 32px; font-weight: bold;">${resumen.distribucion_niveles.muy_bajo}</div><div style="font-size: 12px; color: #666; margin-top: 5px;">Muy Bajo (&lt;5)</div></div>
        </div>
      </div>
      
      <div class="control-panel">
        <h4 style="margin: 0 0 15px 0; color: #1565c0;">🎛️ Filtros de Visualización</h4>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button onclick="filtrarMapa('todos')" id="btnFiltroTodos" class="btn-filtro active" 
                  style="flex: 1; min-width: 120px; padding: 12px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: all 0.3s;">📊 Mostrar Todos</button>
          <button onclick="filtrarMapa('denuncias')" id="btnFiltroDenuncias" class="btn-filtro"
                  style="flex: 1; min-width: 120px; padding: 12px; background: #4facfe; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: all 0.3s;">📋 Solo Denuncias</button>
          <button onclick="filtrarMapa('emergencias')" id="btnFiltroEmergencias" class="btn-filtro"
                  style="flex: 1; min-width: 120px; padding: 12px; background: #f093fb; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: all 0.3s;">🚨 Solo Emergencias</button>
          <button onclick="toggleHeatmapWrapper()" id="btnHeatmap" class="btn-filtro"
                  style="flex: 1; min-width: 120px; padding: 12px; background: #ff6b6b; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: all 0.3s;">🔥 Mapa de Calor</button>
        </div>
      </div>
      
      <div style="margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
        <button onclick="exportarPrediccionEspacialCSV()" class="btn btn-success" style="flex: 1; min-width: 150px;">📥 Exportar a CSV</button>
        <button onclick="verEstadisticasDetalladas()" class="btn" style="flex: 1; min-width: 150px; background: #9c27b0; color: white;">📊 Estadísticas Detalladas</button>
      </div>
    </div>
    <style>.btn-filtro:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.2)}.btn-filtro.active{box-shadow:0 0 0 3px rgba(255,255,255,0.5),0 4px 12px rgba(0,0,0,0.3);transform:scale(1.05)}</style>
  `;

  contenedor.innerHTML = html;
  contenedor.style.display = 'block';
}

function filtrarMapa(tipo) {
  if (!prediccionEspacialActual) {
    showToast('Primero realiza una predicción espacial', 'warning');
    return;
  }
  filtroActual = tipo;
  document.querySelectorAll('.btn-filtro').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`btnFiltro${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`

)?.classList.add('active');
  if (tipo === 'todos') document.getElementById('btnFiltroTodos')?.classList.add('active');
  mostrarCuadrantesEnMapa(prediccionEspacialActual, tipo);
  showToast(`Mostrando: ${tipo === 'todos' ? 'Todos' : tipo === 'denuncias' ? 'Solo Denuncias' : 'Solo Emergencias'}`, 'info', 2000);
}

function toggleHeatmapWrapper() {
  if (!prediccionEspacialActual) {
    showToast('Primero realiza una predicción espacial', 'warning');
    return;
  }
  const btn = document.getElementById('btnHeatmap');
  if (heatmapLayer) {
    map.removeLayer(heatmapLayer);
    heatmapLayer = null;
    btn.textContent = '🔥 Mapa de Calor';
    btn.style.background = '#ff6b6b';
    btn.classList.remove('active');
    if (cuadrantesLayer) cuadrantesLayer.setStyle({ fillOpacity: 0.4, opacity: 0.9 });
    showToast('Mapa de calor desactivado', 'info', 2000);
    return;
  }
  const heatPoints = [];
  prediccionEspacialActual.cuadrantes.forEach(cuad => {
    let intensity = filtroActual === 'denuncias' ? Object.values(cuad.prediccion.denuncias).reduce((a, b) => a + b, 0) :
                     filtroActual === 'emergencias' ? Object.values(cuad.prediccion.emergencias).reduce((a, b) => a + b, 0) :
                     cuad.prediccion.total;
    const normalizado = Math.min(intensity / 100, 1);
    const numPuntos = Math.max(1, Math.floor(intensity / 5));
    for (let i = 0; i < numPuntos; i++) {
      heatPoints.push([cuad.centro.lat, cuad.centro.lon, normalizado]);
    }
  });
  heatmapLayer = L.heatLayer(heatPoints, {
    radius: 60, blur: 40, maxZoom: 17, max: 1.0, minOpacity: 0.3,
    gradient: { 0.0: '#00ff00', 0.2: '#90ee90', 0.4: '#ffff00', 0.6: '#ffa500', 0.8: '#ff4500', 1.0: '#ff0000' }
  }).addTo(map);
  if (cuadrantesLayer) cuadrantesLayer.setStyle({ fillOpacity: 0.1, opacity: 0.3 });
  btn.textContent = '❌ Desactivar Calor';
  btn.style.background = '#333';
  btn.classList.add('active');
  showToast(`Mapa de calor activado (${filtroActual})`, 'success', 2000);
}

function verEstadisticasDetalladas() {
  if (!prediccionEspacialActual) {
    showToast('No hay predicción espacial disponible', 'warning');
    return;
  }
  const cuadrantes = prediccionEspacialActual.cuadrantes;
  const stats = { total_cuadrantes: cuadrantes.length, total_denuncias: 0, total_emergencias: 0, cuadrantes_criticos: [], distribucion_tipos_den: {}, distribucion_tipos_eme: {} };
  cuadrantes.forEach(cuad => {
    const denTotal = Object.values(cuad.prediccion.denuncias).reduce((a, b) => a + b, 0);
    const emeTotal = Object.values(cuad.prediccion.emergencias).reduce((a, b) => a + b, 0);
    stats.total_denuncias += denTotal;
    stats.total_emergencias += emeTotal;
    if (cuad.nivel_criticidad === 'alto' || cuad.nivel_criticidad === 'medio') {
      stats.cuadrantes_criticos.push({ id: cuad.cuadrante_id, total: cuad.prediccion.total, nivel: cuad.nivel_criticidad });
    }
    Object.entries(cuad.prediccion.denuncias).forEach(([tipo, cant]) => { stats.distribucion_tipos_den[tipo] = (stats.distribucion_tipos_den[tipo] || 0) + cant; });
    Object.entries(cuad.prediccion.emergencias).forEach(([tipo, cant]) => { stats.distribucion_tipos_eme[tipo] = (stats.distribucion_tipos_eme[tipo] || 0) + cant; });
  });
  const topDenuncias = Object.entries(stats.distribucion_tipos_den).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, cant]) => `
    <div style="display: flex; justify-content: space-between; padding: 8px; background: #f5f5f5; border-radius: 4px; margin-bottom: 5px;">
      <span style="color: #333;">${DENUNCIAS_MAP[id] || `Tipo ${id}`}</span>
      <strong style="color: #1565c0;">${cant} casos</strong>
    </div>`).join('');
  const topEmergencias = Object.entries(stats.distribucion_tipos_eme).sort((a, b) => b[1] - a[1]).map(([id, cant]) => `
    <div style="display: flex; justify-content: space-between; padding: 8px; background: #f5f5f5; border-radius: 4px; margin-bottom: 5px;">
      <span style="color: #333;">${EMERGENCIAS_MAP[id] || `Tipo ${id}`}</span>
      <strong style="color: #c62828;">${cant} llamadas</strong>
    </div>`).join('');
  let modal = document.getElementById('modalEstadisticas');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalEstadisticas';
    modal.style.cssText = 'display:none;position:fixed;z-index:10000;left:0;top:0;width:100%;height:100%;background-color:rgba(0,0,0,0.5);overflow:auto;padding:20px';
    document.body.appendChild(modal);
  }
  const html = `
    <div style="background:white;margin:0 auto;padding:30px;max-width:1000px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.3);position:relative">
      <button onclick="document.getElementById('modalEstadisticas').style.display='none'" 
              style="position:absolute;right:20px;top:20px;background:#f44336;color:white;border:none;width:35px;height:35px;border-radius:50%;cursor:pointer;font-size:20px;font-weight:bold">×</button>
      <h2 style="margin-top:0;color:#333">📊 Estadísticas Detalladas - ${prediccionEspacialActual.fecha_prediccion}</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin:20px 0">
        <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:20px;border-radius:10px;color:white;text-align:center">
          <div style="font-size:14px;opacity:0.9">Total Cuadrantes</div>
          <div style="font-size:36px;font-weight:bold">${stats.total_cuadrantes}</div>
        </div>
        <div style="background:linear-gradient(135deg,#4facfe 0%,#00f2fe 100%);padding:20px;border-radius:10px;color:white;text-align:center">
          <div style="font-size:14px;opacity:0.9">Total Denuncias</div>
          <div style="font-size:36px;font-weight:bold">${stats.total_denuncias}</div>
        </div>
        <div style="background:linear-gradient(135deg,#fa709a 0%,#fee140 100%);padding:20px;border-radius:10px;color:white;text-align:center">
          <div style="font-size:14px;opacity:0.9">Total Emergencias</div>
          <div style="font-size:36px;font-weight:bold">${stats.total_emergencias}</div>
        </div>
        <div style="background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);padding:20px;border-radius:10px;color:white;text-align:center">
          <div style="font-size:14px;opacity:0.9">Zonas Críticas</div>
          <div style="font-size:36px;font-weight:bold">${stats.cuadrantes_criticos.length}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:25px">
        <div><h3 style="color:#1565c0;margin-top:0">📋 Top 5 Tipos de Denuncia</h3>${topDenuncias || '<p style="color:#999">Sin datos</p>'}</div>
        <div><h3 style="color:#c62828;margin-top:0">🚨 Tipos de Emergencia</h3>${topEmergencias || '<p style="color:#999">Sin datos</p>'}</div>
      </div>
      ${stats.cuadrantes_criticos.length > 0 ? `
        <div style="margin-top:25px;padding:20px;background:#fff3e0;border-radius:10px;border-left:4px solid #ff9800">
          <h3 style="color:#e65100;margin-top:0">⚠️ Cuadrantes que Requieren Atención</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">
            ${stats.cuadrantes_criticos.map(c => `
              <div style="background:white;padding:12px;border-radius:6px;text-align:center;border:2px solid ${c.nivel === 'alto' ? '#d32f2f' : '#f57c00'}">
                <div style="font-weight:bold;color:#333">Cuadrante #${c.id}</div>
                <div style="font-size:24px;font-weight:bold;color:${c.nivel === 'alto' ? '#d32f2f' : '#f57c00'}">${c.total}</div>
                <div style="font-size:11px;color:#666;text-transform:uppercase">${c.nivel}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
  modal.innerHTML = html;
  modal.style.display = 'block';
}

async function verDetalleCuadrante(cuadranteId) {
  showProgress('Cargando Detalles', 'Obteniendo información del cuadrante...');
  try {
    const response = await fetch(`${API_URL}/api/modelo/espacial/cuadrante/${cuadranteId}`);
    const data = await response.json();
    hideProgress();
    if (data.success) {
      mostrarModalDetalleCuadrante(data.data);
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (error) {
    hideProgress();
    console.error('Error obteniendo detalle:', error);
    showToast('Error de conexión', 'error');
  }
}

function mostrarModalDetalleCuadrante(cuadranteData) {
  let modal = document.getElementById('modalDetalleCuadrante');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalDetalleCuadrante';
    modal.style.cssText = 'display:none;position:fixed;z-index:10000;left:0;top:0;width:100%;height:100%;background-color:rgba(0,0,0,0.5);overflow:auto;padding:20px';
    document.body.appendChild(modal);
  }
  const topDenuncias = Object.entries(cuadranteData.distribucion_historica.denuncias || {}).sort((a, b) => b[1].porcentaje - a[1].porcentaje).slice(0, 5).map(([id, info]) => `
    <tr><td style="padding:10px;border-bottom:1px solid #eee">${DENUNCIAS_MAP[id] || `Tipo ${id}`}</td>
    <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;font-weight:bold">${info.count}</td>
    <td style="padding:10px;border-bottom:1px solid #eee;text-align:right">${info.porcentaje}%</td></tr>
  `).join('');
  const topEmergencias = Object.entries(cuadranteData.distribucion_historica.emergencias || {}).sort((a, b) => b[1].porcentaje - a[1].porcentaje).map(([id, info]) => `
    <tr><td style="padding:10px;border-bottom:1px solid #eee">${EMERGENCIAS_MAP[id] || `Tipo ${id}`}</td>
    <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;font-weight:bold">${info.count}</td>
    <td style="padding:10px;border-bottom:1px solid #eee;text-align:right">${info.porcentaje}%</td></tr>
  `).join('');
  const html = `
    <div style="background:white;margin:0 auto;padding:30px;max-width:900px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.3);position:relative">
      <button onclick="cerrarModalDetalle()" style="position:absolute;right:20px;top:20px;background:#f44336;color:white;border:none;width:35px;height:35px;border-radius:50%;cursor:pointer;font-size:20px;font-weight:bold">×</button>
      <h2 style="margin-top:0;color:#333">📍 Cuadrante #${cuadranteData.cuadrante_id} - Análisis Detallado</h2>
      <div style="background:#f5f5f5;padding:15px;border-radius:8px;margin-bottom:20px">
        <h3 style="margin:0 0 10px 0;font-size:16px">📍 Ubicación Geográfica</h3>
        <div style="font-family:monospace;font-size:13px;color:#555">
          <div>Latitud: ${cuadranteData.bounds.lat_min.toFixed(6)} - ${cuadranteData.bounds.lat_max.toFixed(6)}</div>
          <div>Longitud: ${cuadranteData.bounds.lon_min.toFixed(6)} - ${cuadranteData.bounds.lon_max.toFixed(6)}</div>
          <div style="margin-top:8px">Centro: (${cuadranteData.centro.lat.toFixed(6)}, ${cuadranteData.centro.lon.toFixed(6)})</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
        <div>
          <h3 style="color:#1976d2;margin-top:0">📋 Denuncias Históricas</h3>
          <div style="background:#e3f2fd;padding:15px;border-radius:8px;text-align:center;margin-bottom:15px">
            <div style="font-size:36px;font-weight:bold;color:#1565c0">${cuadranteData.totales_historicos.denuncias || 0}</div>
            <div style="font-size:12px;color:#666">Total de denuncias</div>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="background:#1976d2;color:white">
              <th style="padding:10px;text-align:left">Tipo</th>
              <th style="padding:10px;text-align:right">Casos</th>
              <th style="padding:10px;text-align:right">%</th>
            </tr></thead>
            <tbody>${topDenuncias || '<tr><td colspan="3" style="padding:15px;text-align:center;color:#999">Sin datos</td></tr>'}</tbody>
          </table>
        </div>
        <div>
          <h3 style="color:#c62828;margin-top:0">🚨 Emergencias Históricas</h3>
          <div style="background:#ffebee;padding:15px;border-radius:8px;text-align:center;margin-bottom:15px">
            <div style="font-size:36px;font-weight:bold;color:#b71c1c">${cuadranteData.totales_historicos.emergencias || 0}</div>
            <div style="font-size:12px;color:#666">Total de emergencias</div>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="background:#c62828;color:white">
              <th style="padding:10px;text-align:left">Tipo</th>
              <th style="padding:10px;text-align:right">Llamadas</th>
              <th style="padding:10px;text-align:right">%</th>
            </tr></thead>
            <tbody>${topEmergencias || '<tr><td colspan="3" style="padding:15px;text-align:center;color:#999">Sin datos</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      <div style="background:#fff3e0;padding:15px;border-radius:8px;border-left:4px solid #ff9800">
        <h4 style="margin:0 0 10px 0;color:#e65100">💡 Recomendaciones</h4>
        <ul style="margin:0;padding-left:20px;color:#555">
          ${cuadranteData.totales_historicos.total > 100 ? '<li>Zona de alta actividad - Considera asignar más recursos preventivos</li>' : ''}
          ${cuadranteData.totales_historicos.denuncias > cuadranteData.totales_historicos.emergencias ? '<li>Predominan denuncias ciudadanas - Enfocar en mejora de servicios básicos</li>' : '<li>Alta frecuencia de emergencias - Priorizar unidades de respuesta rápida</li>'}
          <li>Analiza patrones temporales para optimizar patrullaje</li>
        </ul>
      </div>
    </div>
  `;
  modal.innerHTML = html;
  modal.style.display = 'block';
}

function cerrarModalDetalle() {
  const modal = document.getElementById('modalDetalleCuadrante');
  if (modal) modal.style.display = 'none';
}

function exportarPrediccionEspacialCSV() {
  if (!prediccionEspacialActual) {
    showToast('No hay predicción espacial para exportar', 'warning');
    return;
  }
  const cuadrantes = prediccionEspacialActual.cuadrantes;
  let csv = 'Cuadrante,Fila,Columna,Centro_Lat,Centro_Lon,Total_Predicho,Denuncias,Emergencias,Nivel_Criticidad,Tipo_Dominante\n';
  cuadrantes.forEach(cuad => {
    const totalDen = Object.values(cuad.prediccion.denuncias).reduce((a, b) => a + b, 0);
    const totalEme = Object.values(cuad.prediccion.emergencias).reduce((a, b) => a + b, 0);
    let tipoDominante = 'N/A';
    if (cuad.tipo_dominante.denuncia) {
      tipoDominante = DENUNCIAS_MAP[cuad.tipo_dominante.denuncia.tipo_id] || 'Denuncia';
    } else if (cuad.tipo_dominante.emergencia) {
      tipoDominante = EMERGENCIAS_MAP[cuad.tipo_dominante.emergencia.tipo_id] || 'Emergencia';
    }
    csv += `${cuad.cuadrante_id},${cuad.fila},${cuad.columna},${cuad.centro.lat},${cuad.centro.lon},${cuad.prediccion.total},${totalDen},${totalEme},${cuad.nivel_criticidad},"${tipoDominante}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `prediccion_espacial_${prediccionEspacialActual.fecha_prediccion}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('CSV exportado exitosamente', 'success');
}

function limpiarCuadrantes() {
  if (cuadrantesLayer) {
    map.removeLayer(cuadrantesLayer);
    cuadrantesLayer = null;
  }
  if (heatmapLayer) {
    map.removeLayer(heatmapLayer);
    heatmapLayer = null;
    const btn = document.getElementById('btnHeatmap');
    if (btn) {
      btn.textContent = '🔥 Mapa de Calor';
      btn.style.background = '#ff6b6b';
      btn.classList.remove('active');
    }
  }
  const resumen = document.getElementById('resumenEspacial');
  if (resumen) resumen.style.display = 'none';
  filtroActual = 'todos';
  document.querySelectorAll('.btn-filtro').forEach(btn => btn.classList.remove('active'));
  prediccionEspacialActual = null;
  showToast('Cuadrantes limpiados del mapa', 'success');
}

async function entrenarModeloEspacial() {
  const nFilas = parseInt(prompt('Número de filas en la grilla:', '5'));
  const nCols = parseInt(prompt('Número de columnas en la grilla:', '5'));
  if (!nFilas || !nCols || nFilas < 2 || nCols < 2 || nFilas > 20 || nCols > 20) {
    showToast('Valores inválidos. Usa entre 2 y 20 para filas y columnas.', 'error');
    return;
  }
  const confirmacion = confirm(`¿Entrenar modelo espacial con grilla ${nFilas}x${nCols} (${nFilas * nCols} cuadrantes)?\n\nEsto puede tomar varios minutos.`);
  if (!confirmacion) return;
  showProgress('Entrenando Modelo Espacial', 'Este proceso puede tardar varios minutos...');
  const progressInterval = simulateProgress(15000);
  try {
    const response = await fetch(`${API_URL}/api/modelo/espacial/entrenar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ n_filas: nFilas, n_cols: nCols })
    });
    const data = await response.json();
    clearInterval(progressInterval);
    if (data.success) {
      updateProgress(100, 'Entrenamiento completado');
      setTimeout(() => {
        hideProgress();
        showToast(`✅ ${data.message}\n\nCuadrantes creados: ${data.cuadrantes_creados}`, 'success', 5000);
        inicializarMapaCuadrantes();
      }, 500);
    } else {
      hideProgress();
      showToast('Error: ' + data.error, 'error');
    }
  } catch (error) {
    clearInterval(progressInterval);
    hideProgress();
    showToast('Error de conexión: ' + error.message, 'error');
  }
}