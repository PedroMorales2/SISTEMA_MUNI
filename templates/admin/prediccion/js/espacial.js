// ==========================================
// PREDICCIÓN ESPACIAL POR SECTORES
// ==========================================

let sectoresLayer = null;
let sectoresData = [];
let filtroActual = 'todos';

/**
 * Inicializa el mapa de sectores
 */
async function inicializarMapaSectores() {
  console.log('🗺️ Inicializando mapa de sectores...');
  
  try {
    if (!map) {
      setTimeout(inicializarMapaSectores, 500);
      return;
    }

    const response = await fetch(`${API_URL}/api/modelo/espacial/info`);
    const data = await response.json();

    if (data.success) {
      console.log(`✅ ${data.data.sectores_activos} sectores activos`);
      
      if (document.getElementById('infoSectores')) {
        document.getElementById('infoSectores').textContent = data.data.sectores_activos;
      }
      
      if (data.data.sectores_activos === 0) {
        showToast('No hay sectores definidos', 'warning');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
    showToast('Error al cargar sectores', 'error');
  }
}

/**
 * Predice espacialmente
 */
async function predecirEspacial() {
  const year = parseInt(document.getElementById('yearInputEspacial').value);
  const month = parseInt(document.getElementById('monthInputEspacial').value);

  if (!year || !month) {
    showToast('Selecciona año y mes', 'warning');
    return;
  }

  if (!map) {
    showToast('Mapa no disponible', 'error');
    return;
  }

  showProgress('Generando predicción espacial...');

  try {
    const response = await fetch(`${API_URL}/api/modelo/espacial/predecir/${year}/${month}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        incluir_detalles: true,
        recalcular_densidad: false
      })
    });

    const data = await response.json();

    if (data.success) {
      sectoresData = data.data.sectores;
      
      console.log('📊 Predicción recibida:', data.data);
      
      mostrarSectoresEnMapa(sectoresData, 'todos');
      mostrarResumenEspacial(data.data.resumen, data.data.year, data.data.month);
      
      const total = data.data.resumen.prediccion.total_incidencias;
      showToast(`Predicción: ${total.toFixed(0)} incidencias para ${year}-${month.toString().padStart(2, '0')}`, 'success');
      
      hideProgress();
    } else {
      throw new Error(data.error || 'Error en predicción');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    showToast(`Error: ${error.message}`, 'error');
    hideProgress();
  }
}

/**
 * Muestra sectores en mapa con filtro
 */
function mostrarSectoresEnMapa(sectores, filtro = 'todos') {
  console.log(`🎨 Dibujando ${sectores.length} sectores (filtro: ${filtro})`);

  if (!map) {
    showToast('Mapa no disponible', 'error');
    return;
  }

  if (sectoresLayer) {
    map.removeLayer(sectoresLayer);
  }

  sectoresLayer = L.layerGroup();

  let sectoresDibujados = 0;

  sectores.forEach(sector => {
    // Aplicar filtro
    let mostrar = true;
    if (filtro === 'denuncias' && sector.prediccion.denuncias === 0) mostrar = false;
    if (filtro === 'emergencias' && sector.prediccion.emergencias === 0) mostrar = false;
    
    if (!mostrar) return;

    if (sector.poligono && sector.poligono.geometry) {
      try {
        const coords = sector.poligono.geometry.coordinates[0].map(
          coord => [coord[1], coord[0]]
        );

        const poligono = L.polygon(coords, {
          color: sector.color,
          fillColor: sector.color,
          fillOpacity: filtro === 'todos' ? 0.4 : 0.5,
          weight: 3
        });

        // Popup con tipos detallados
        const popupContent = crearPopupSector(sector, filtro);
        poligono.bindPopup(popupContent, {maxWidth: 400});

        // Tooltip
        const tooltipText = filtro === 'todos' 
          ? `<strong>${sector.nombre}</strong><br>${sector.prediccion.total.toFixed(0)} incidencias`
          : filtro === 'denuncias'
            ? `<strong>${sector.nombre}</strong><br>${sector.prediccion.denuncias.toFixed(0)} denuncias`
            : `<strong>${sector.nombre}</strong><br>${sector.prediccion.emergencias.toFixed(0)} emergencias`;
        
        poligono.bindTooltip(tooltipText, {
          permanent: false,
          direction: 'top'
        });

        poligono.on('click', function() {
          sectoresLayer.eachLayer(layer => layer.setStyle({weight: 3}));
          this.setStyle({weight: 5});
        });

        poligono.addTo(sectoresLayer);
        sectoresDibujados++;

      } catch (error) {
        console.error(`❌ Error en ${sector.codigo_sector}:`, error);
      }
    }
  });

  sectoresLayer.addTo(map);

  if (sectoresDibujados > 0) {
    try {
      const bounds = sectoresLayer.getBounds();
      map.fitBounds(bounds, {padding: [50, 50], maxZoom: 15});
    } catch (e) {}
  }

  console.log(`✅ ${sectoresDibujados} sectores dibujados`);
}

/**
 * Crea popup HTML detallado para un sector CON TIPOS
 */
function crearPopupSector(sector, filtro) {
  const pred = sector.prediccion;
  const hist = sector.historico;
  
  return `
    <div style="min-width: 320px; max-height: 500px; overflow-y: auto; font-family: 'Segoe UI', sans-serif;">
      <h4 style="margin: 0 0 12px 0; color: ${sector.color}; border-bottom: 2px solid ${sector.color}; padding-bottom: 8px;">
        📍 ${sector.nombre}
      </h4>
      
      <!-- Predicción -->
      <div style="background: ${sector.color}15; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
        <div style="font-size: 12px; color: #666; margin-bottom: 8px; text-transform: uppercase; font-weight: bold;">
          📈 PREDICCIÓN
        </div>
        
        ${filtro === 'todos' || filtro === 'denuncias' ? `
        <div style="margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <strong style="color: #1976d2;">📋 Denuncias:</strong>
            <strong style="color: #1976d2; font-size: 16px;">${pred.denuncias.toFixed(1)}</strong>
          </div>
          ${Object.keys(pred.denuncias_por_tipo || {}).length > 0 ? `
          <div style="font-size: 12px; padding-left: 10px; color: #666;">
            ${Object.entries(pred.denuncias_por_tipo)
              .sort((a, b) => b[1].cantidad - a[1].cantidad)
              .slice(0, 5)
              .map(([tipo, data]) => `
                <div style="display: flex; justify-content: space-between; padding: 2px 0;">
                  <span>• ${tipo}</span>
                  <span style="font-weight: bold;">${data.cantidad.toFixed(1)}</span>
                </div>
              `).join('')}
            ${Object.keys(pred.denuncias_por_tipo).length > 5 ? `<div style="color: #999; font-style: italic;">+ ${Object.keys(pred.denuncias_por_tipo).length - 5} más...</div>` : ''}
          </div>
          ` : '<div style="font-size: 11px; color: #999; padding-left: 10px;">Sin detalles por tipo</div>'}
        </div>
        ` : ''}
        
        ${filtro === 'todos' || filtro === 'emergencias' ? `
        <div style="margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <strong style="color: #d32f2f;">🚨 Emergencias:</strong>
            <strong style="color: #d32f2f; font-size: 16px;">${pred.emergencias.toFixed(1)}</strong>
          </div>
          ${Object.keys(pred.emergencias_por_tipo || {}).length > 0 ? `
          <div style="font-size: 12px; padding-left: 10px; color: #666;">
            ${Object.entries(pred.emergencias_por_tipo)
              .sort((a, b) => b[1].cantidad - a[1].cantidad)
              .slice(0, 5)
              .map(([tipo, data]) => `
                <div style="display: flex; justify-content: space-between; padding: 2px 0;">
                  <span>• ${tipo}</span>
                  <span style="font-weight: bold;">${data.cantidad.toFixed(1)}</span>
                </div>
              `).join('')}
            ${Object.keys(pred.emergencias_por_tipo).length > 5 ? `<div style="color: #999; font-style: italic;">+ ${Object.keys(pred.emergencias_por_tipo).length - 5} más...</div>` : ''}
          </div>
          ` : '<div style="font-size: 11px; color: #999; padding-left: 10px;">Sin detalles por tipo</div>'}
        </div>
        ` : ''}
        
        ${filtro === 'todos' ? `
        <div style="border-top: 1px solid ${sector.color}40; padding-top: 8px; margin-top: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong>TOTAL:</strong>
            <strong style="color: ${sector.color}; font-size: 18px;">${pred.total.toFixed(1)}</strong>
          </div>
        </div>
        ` : ''}
      </div>
      
      <!-- Histórico -->
      <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
        <div style="font-size: 12px; color: #666; margin-bottom: 8px; text-transform: uppercase; font-weight: bold;">
          📊 HISTÓRICO REAL
        </div>
        
        ${filtro === 'todos' || filtro === 'denuncias' ? `
        <div style="margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <strong style="color: #1976d2;">📋 Denuncias:</strong>
            <strong style="color: #1976d2; font-size: 16px;">${hist.denuncias}</strong>
          </div>
          ${Object.keys(hist.denuncias_por_tipo || {}).length > 0 ? `
          <div style="font-size: 12px; padding-left: 10px; color: #666;">
            ${Object.entries(hist.denuncias_por_tipo)
              .sort((a, b) => b[1].cantidad - a[1].cantidad)
              .slice(0, 5)
              .map(([tipo, data]) => `
                <div style="display: flex; justify-content: space-between; padding: 2px 0;">
                  <span>• ${tipo}</span>
                  <span style="font-weight: bold;">${data.cantidad}</span>
                </div>
              `).join('')}
            ${Object.keys(hist.denuncias_por_tipo).length > 5 ? `<div style="color: #999; font-style: italic;">+ ${Object.keys(hist.denuncias_por_tipo).length - 5} más...</div>` : ''}
          </div>
          ` : '<div style="font-size: 11px; color: #999; padding-left: 10px;">Sin registros históricos</div>'}
        </div>
        ` : ''}
        
        ${filtro === 'todos' || filtro === 'emergencias' ? `
        <div style="margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <strong style="color: #d32f2f;">🚨 Emergencias:</strong>
            <strong style="color: #d32f2f; font-size: 16px;">${hist.emergencias}</strong>
          </div>
          ${Object.keys(hist.emergencias_por_tipo || {}).length > 0 ? `
          <div style="font-size: 12px; padding-left: 10px; color: #666;">
            ${Object.entries(hist.emergencias_por_tipo)
              .sort((a, b) => b[1].cantidad - a[1].cantidad)
              .slice(0, 5)
              .map(([tipo, data]) => `
                <div style="display: flex; justify-content: space-between; padding: 2px 0;">
                  <span>• ${tipo}</span>
                  <span style="font-weight: bold;">${data.cantidad}</span>
                </div>
              `).join('')}
            ${Object.keys(hist.emergencias_por_tipo).length > 5 ? `<div style="color: #999; font-style: italic;">+ ${Object.keys(hist.emergencias_por_tipo).length - 5} más...</div>` : ''}
          </div>
          ` : '<div style="font-size: 11px; color: #999; padding-left: 10px;">Sin registros históricos</div>'}
        </div>
        ` : ''}
        
        ${filtro === 'todos' ? `
        <div style="border-top: 1px solid #ddd; padding-top: 8px; margin-top: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong>TOTAL:</strong>
            <strong style="font-size: 18px;">${hist.total}</strong>
          </div>
        </div>
        ` : ''}
      </div>
      
      <!-- Info adicional -->
      <div style="font-size: 12px; color: #666; padding: 8px; background: #fafafa; border-radius: 6px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Nivel:</span>
          <strong style="color: ${sector.color}; text-transform: uppercase;">${sector.nivel_criticidad.replace('_', ' ')}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Densidad histórica:</span>
          <strong>${sector.densidad_historica.toFixed(1)}%</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Código:</span>
          <strong>${sector.codigo_sector}</strong>
        </div>
      </div>
    </div>
  `;
}

/**
 * Muestra resumen espacial
 */
function mostrarResumenEspacial(resumen, year, month) {
  console.log('📊 Resumen:', resumen);

  const container = document.getElementById('resumenEspacial');
  if (!container) return;

  const pred = resumen.prediccion;
  const hist = resumen.historico;
  const dist = resumen.distribucion_niveles;

  container.innerHTML = `
    <div class="control-panel" style="margin-top: 20px;">
      <h3 style="margin: 0 0 20px 0; color: #1565c0;">
        📊 Resumen de Predicción Espacial - ${year}/${month.toString().padStart(2, '0')}
      </h3>
      
      <!-- Comparativa Global -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; color: white; text-align: center;">
          <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">📈 PREDICCIÓN</div>
          <div style="font-size: 36px; font-weight: bold;">${pred.total_incidencias.toFixed(0)}</div>
          <div style="font-size: 13px; opacity: 0.9; margin-top: 8px;">
            ${pred.total_denuncias.toFixed(0)} denuncias<br>
            ${pred.total_emergencias.toFixed(0)} emergencias
          </div>
        </div>
        
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 10px; color: white; text-align: center;">
          <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">📊 HISTÓRICO REAL</div>
          <div style="font-size: 36px; font-weight: bold;">${hist.total_incidencias}</div>
          <div style="font-size: 13px; opacity: 0.9; margin-top: 8px;">
            ${hist.total_denuncias} denuncias<br>
            ${hist.total_emergencias} emergencias
          </div>
        </div>
        
        <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 20px; border-radius: 10px; color: white; text-align: center;">
          <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">🗺️ SECTORES</div>
          <div style="font-size: 36px; font-weight: bold;">${resumen.sectores_con_prediccion}</div>
          <div style="font-size: 13px; opacity: 0.9; margin-top: 8px;">
            con predicción<br>
            de ${resumen.total_sectores} totales
          </div>
        </div>
      </div>
      
      <!-- Distribución de Niveles -->
      <h4 style="margin: 20px 0 15px 0; color: #333;">📊 Distribución por Criticidad</h4>
      <div style="display: flex; gap: 15px; flex-wrap: wrap; justify-content: center; margin-bottom: 20px;">
        <div style="text-align: center; flex: 1; min-width: 100px;">
          <div style="font-size: 40px; color: #d32f2f; font-weight: bold;">${dist.muy_alto}</div>
          <div style="font-size: 12px; color: #666; text-transform: uppercase;">Muy Alto</div>
        </div>
        <div style="text-align: center; flex: 1; min-width: 100px;">
          <div style="font-size: 40px; color: #f44336; font-weight: bold;">${dist.alto}</div>
          <div style="font-size: 12px; color: #666; text-transform: uppercase;">Alto</div>
        </div>
        <div style="text-align: center; flex: 1; min-width: 100px;">
          <div style="font-size: 40px; color: #ff9800; font-weight: bold;">${dist.medio}</div>
          <div style="font-size: 12px; color: #666; text-transform: uppercase;">Medio</div>
        </div>
        <div style="text-align: center; flex: 1; min-width: 100px;">
          <div style="font-size: 40px; color: #ffc107; font-weight: bold;">${dist.bajo}</div>
          <div style="font-size: 12px; color: #666; text-transform: uppercase;">Bajo</div>
        </div>
        <div style="text-align: center; flex: 1; min-width: 100px;">
          <div style="font-size: 40px; color: #4caf50; font-weight: bold;">${dist.muy_bajo}</div>
          <div style="font-size: 12px; color: #666; text-transform: uppercase;">Muy Bajo</div>
        </div>
      </div>
      
      <!-- Top 5 Críticos -->
      ${resumen.top_5_criticos && resumen.top_5_criticos.length > 0 ? `
      <h4 style="margin: 20px 0 15px 0; color: #333;">🔥 Top 5 Sectores Más Críticos</h4>
      ${resumen.top_5_criticos.map((s, i) => `
        <div style="padding: 12px; background: ${i === 0 ? '#ffebee' : '#f5f5f5'}; 
                    border-radius: 8px; margin-bottom: 10px; 
                    border-left: 4px solid ${getColorNivel(s.nivel)};
                    transition: all 0.2s;"
             onmouseover="this.style.transform='translateX(5px)'"
             onmouseout="this.style.transform='translateX(0)'">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong style="font-size: 15px;">#${i + 1} ${s.nombre}</strong><br>
              <small style="color: #666;">${s.codigo}</small>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 28px; font-weight: bold; color: ${getColorNivel(s.nivel)};">
                ${s.total.toFixed(0)}
              </div>
              <small style="color: #666; text-transform: uppercase; font-size: 11px;">${s.nivel.replace('_', ' ')}</small>
            </div>
          </div>
        </div>
      `).join('')}
      ` : ''}
    </div>
  `;

  container.style.display = 'block';
}

/**
 * Filtra mapa
 */
function filtrarMapa(filtro) {
  console.log(`🔍 Aplicando filtro: ${filtro}`);

  if (!sectoresData || sectoresData.length === 0) {
    showToast('Primero genera una predicción', 'warning');
    return;
  }

  filtroActual = filtro;

  // Actualizar botones
  document.querySelectorAll('.btn-filtro').forEach(btn => btn.classList.remove('active'));
  
  const btnIds = {
    'todos': 'btnFiltroTodos',
    'denuncias': 'btnFiltroDenuncias',
    'emergencias': 'btnFiltroEmergencias'
  };
  
  const btn = document.getElementById(btnIds[filtro]);
  if (btn) btn.classList.add('active');

  // Redibujar mapa
  mostrarSectoresEnMapa(sectoresData, filtro);

  const mensajes = {
    'todos': 'Mostrando todos los sectores',
    'denuncias': 'Mostrando solo denuncias',
    'emergencias': 'Mostrando solo emergencias'
  };
  
  showToast(mensajes[filtro], 'info');
}

/**
 * Limpia mapa
 */
function limpiarSectores() {
  if (sectoresLayer && map) {
    map.removeLayer(sectoresLayer);
    sectoresLayer = null;
    sectoresData = [];
    
    const container = document.getElementById('resumenEspacial');
    if (container) {
      container.style.display = 'none';
      container.innerHTML = '';
    }
    
    // Reset filtro
    filtroActual = 'todos';
    document.querySelectorAll('.btn-filtro').forEach(btn => btn.classList.remove('active'));
    const btnTodos = document.getElementById('btnFiltroTodos');
    if (btnTodos) btnTodos.classList.add('active');
    
    showToast('Mapa limpiado', 'info');
  }
}

/**
 * Color por nivel
 */
function getColorNivel(nivel) {
  const colores = {
    'muy_alto': '#d32f2f',
    'alto': '#f44336',
    'medio': '#ff9800',
    'bajo': '#ffc107',
    'muy_bajo': '#4caf50'
  };
  return colores[nivel] || '#999';
}

// Inicializar
document.addEventListener('DOMContentLoaded', function() {
  console.log('📍 Módulo espacial cargado');
  setTimeout(inicializarMapaSectores, 1500);
});

// Exponer funciones globales
window.predecirEspacial = predecirEspacial;
window.filtrarMapa = filtrarMapa;
window.limpiarSectores = limpiarSectores;
window.inicializarMapaSectores = inicializarMapaSectores;