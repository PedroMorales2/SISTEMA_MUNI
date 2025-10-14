// gestion_estadisticas.js - Gestión de estadísticas y reportes

// Verificar si las variables ya existen
if (typeof chartDistribucion === 'undefined') {
    var chartDistribucion = null;
}
if (typeof chartConfiguraciones === 'undefined') {
    var chartConfiguraciones = null;
}

/**
 * Carga todas las estadísticas
 */
async function cargarEstadisticas() {
    try {
        mostrarLoading('Cargando estadísticas...');
        
        // Cargar en paralelo
        const [statsRecursos, statsConfiguracion, recursos, configuraciones, historial] = await Promise.all([
            realizarPeticion(`${API_URL}/api/recursos/estadisticas`, 'GET'),
            realizarPeticion(`${API_URL}/api/configuracion/estadisticas`, 'GET'),
            realizarPeticion(`${API_URL}/api/recursos/listar`, 'GET'),
            realizarPeticion(`${API_URL}/api/configuracion/listar`, 'GET'),
            realizarPeticion(`${API_URL}/api/recursos/historial?limit=100`, 'GET')
        ]);
        
        ocultarLoading();

        // Actualizar cards de métricas
        actualizarMetricasPrincipales(statsRecursos, statsConfiguracion, historial);
        
        // Generar gráficos
        if (recursos.success && recursos.data) {
            generarGraficoDistribucionRecursos(recursos.data);
        }
        
        if (statsConfiguracion.success && statsConfiguracion.data) {
            generarGraficoConfiguracionesPorCategoria(statsConfiguracion.data);
        }
        
        // Generar tabla resumen
        if (recursos.success && recursos.data) {
            generarTablaResumenRecursos(recursos.data);
        }
        
        console.log('✓ Estadísticas cargadas correctamente');
        
    } catch (error) {
        ocultarLoading();
        console.error('Error cargando estadísticas:', error);
        mostrarToast('Error al cargar estadísticas', 'error');
    }
}

// Resto del código...

/**
 * Actualiza las métricas principales (cards superiores)
 */
function actualizarMetricasPrincipales(statsRecursos, statsConfiguracion, historial) {
    // Total recursos
    if (statsRecursos.success && statsRecursos.data) {
        document.getElementById('statTotalRecursos').textContent = 
            formatearNumero(statsRecursos.data.total_tipos);
    }
    
    // Total configuraciones
    if (statsConfiguracion.success && statsConfiguracion.data) {
        const totalConfigs = statsConfiguracion.data.reduce((sum, cat) => sum + cat.total_parametros, 0);
        document.getElementById('statTotalConfiguraciones').textContent = formatearNumero(totalConfigs);
    }
    
    // Cambios hoy
    if (historial.success && historial.data) {
        const hoy = new Date().toISOString().split('T')[0];
        const cambiosHoy = historial.data.filter(item => {
            const fechaItem = new Date(item.fecha_cambio).toISOString().split('T')[0];
            return fechaItem === hoy;
        }).length;
        document.getElementById('statCambiosHoy').textContent = formatearNumero(cambiosHoy);
    }
    
    // Total unidades
    if (statsRecursos.success && statsRecursos.data) {
        document.getElementById('statTotalUnidades').textContent = 
            formatearNumero(statsRecursos.data.total_recursos);
    }
}

/**
 * Genera el gráfico de distribución de recursos
 */
function generarGraficoDistribucionRecursos(recursos) {
    const ctx = document.getElementById('chartDistribucionRecursos');
    if (!ctx) return;
    
    // Destruir gráfico anterior si existe
    if (chartDistribucion) {
        chartDistribucion.destroy();
    }
    
    // Preparar datos
    const labels = [];
    const data = [];
    const colores = [];
    
    const paletaColores = [
        '#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a',
        '#feca57', '#ff6b6b', '#a29bfe', '#fd79a8', '#fdcb6e'
    ];
    
    recursos.forEach((recurso, index) => {
        labels.push(formatearNombreRecurso(recurso.nombre));
        data.push(recurso.cantidad || 0);
        colores.push(paletaColores[index % paletaColores.length]);
    });
    
    // Crear gráfico
    chartDistribucion = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colores,
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        },
                        generateLabels: function(chart) {
                            const data = chart.data;
                            const total = data.datasets[0].data.reduce((sum, val) => sum + val, 0);
                            
                            return data.labels.map((label, i) => {
                                const value = data.datasets[0].data[i];
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return {
                                    text: `${label}: ${formatearNumero(value)} (${percentage}%)`,
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
                    titleFont: { size: 14, weight: '600' },
                    bodyFont: { size: 13 },
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${formatearNumero(value)} unidades (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Genera el gráfico de configuraciones por categoría
 */
function generarGraficoConfiguracionesPorCategoria(stats) {
    const ctx = document.getElementById('chartConfiguracionesPorCategoria');
    if (!ctx) return;
    
    // Destruir gráfico anterior si existe
    if (chartConfiguraciones) {
        chartConfiguraciones.destroy();
    }
    
    // Preparar datos
    const labels = stats.map(item => item.categoria);
    const dataEditables = stats.map(item => item.editables);
    const dataNoEditables = stats.map(item => item.no_editables);
    
    // Crear gráfico
    chartConfiguraciones = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Editables',
                    data: dataEditables,
                    backgroundColor: 'rgba(76, 175, 80, 0.7)',
                    borderColor: 'rgba(76, 175, 80, 1)',
                    borderWidth: 2,
                    borderRadius: 4
                },
                {
                    label: 'No Editables',
                    data: dataNoEditables,
                    backgroundColor: 'rgba(158, 158, 158, 0.7)',
                    borderColor: 'rgba(158, 158, 158, 1)',
                    borderWidth: 2,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        padding: 15,
                        font: { size: 12 },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 13, weight: '600' },
                    bodyFont: { size: 12 },
                    callbacks: {
                        afterLabel: function(context) {
                            const dataIndex = context.dataIndex;
                            const editables = dataEditables[dataIndex];
                            const noEditables = dataNoEditables[dataIndex];
                            const total = editables + noEditables;
                            return `Total: ${total} parámetros`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: { size: 10 },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                        font: { size: 11 }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        }
    });
}

/**
 * Genera la tabla resumen de recursos
 */
function generarTablaResumenRecursos(recursos) {
    const tbody = document.getElementById('bodyResumenRecursos');
    
    if (!recursos || recursos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 30px; color: #999;">
                    No hay datos disponibles
                </td>
            </tr>
        `;
        return;
    }
    
    // Ordenar por cantidad descendente
    recursos.sort((a, b) => (b.cantidad || 0) - (a.cantidad || 0));
    
    tbody.innerHTML = recursos.map(recurso => {
        const icono = obtenerIconoRecurso(recurso.nombre);
        const nombreFormateado = formatearNombreRecurso(recurso.nombre);
        const cantidad = recurso.cantidad || 0;
        
        // Determinar estado según cantidad
        let estadoBadge;
        if (cantidad === 0) {
            estadoBadge = '<span class="badge bg-danger">Sin Stock</span>';
        } else if (cantidad < 5) {
            estadoBadge = '<span class="badge bg-warning">Stock Bajo</span>';
        } else if (cantidad < 20) {
            estadoBadge = '<span class="badge bg-info">Stock Normal</span>';
        } else {
            estadoBadge = '<span class="badge bg-success">Stock Alto</span>';
        }
        
        const descripcion = recurso.descripcion || '<em style="color: #999;">Sin descripción</em>';
        
        return `
            <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 24px;">${icono}</span>
                        <div>
                            <strong style="display: block; font-size: 14px;">${nombreFormateado}</strong>
                            <small style="color: #666; font-size: 12px;">${recurso.nombre}</small>
                        </div>
                    </div>
                </td>
                <td style="padding: 12px; text-align: center;">
                    <span style="background: #e3f2fd; color: #1976d2; padding: 6px 16px; border-radius: 20px; font-weight: 600; font-size: 14px;">
                        ${formatearNumero(cantidad)}
                    </span>
                </td>
                <td style="padding: 12px; font-size: 13px;">${descripcion}</td>
                <td style="padding: 12px; text-align: center;">${estadoBadge}</td>
            </tr>
        `;
    }).join('');
}

console.log('✓ Módulo de Gestión de Estadísticas cargado');