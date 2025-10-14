/**
 * ============================================================================
 * MÓDULO DE GESTIÓN Y ASIGNACIÓN DE RECURSOS MUNICIPALES - VERSIÓN 2.0
 * ============================================================================
 * 
 * Integrado con las APIs de gestión de recursos y configuración
 * Usa valores reales de la base de datos en lugar de constantes fijas
 * 
 * @module recursos_avanzado
 * @version 2.0.0
 * ============================================================================
 */

// ============================================================================
// CONFIGURACIÓN Y VARIABLES GLOBALES
// ============================================================================

/**
 * Cache de configuraciones operativas desde la BD
 * @type {Object|null}
 */
let configuracionesOperativasCache = null;

/**
 * Cache de recursos municipales actuales
 * @type {Object|null}
 */
let recursosInventarioCache = null;

/**
 * Timestamp del último fetch de configuraciones
 * @type {number|null}
 */
let ultimoFetchConfiguraciones = null;

/**
 * Timestamp del último fetch de recursos
 * @type {number|null}
 */
let ultimoFetchInventario = null;

/**
 * Tiempo de vida del cache (5 minutos)
 * @type {number}
 */
const CACHE_TTL_CONFIG = 5 * 60 * 1000;

/**
 * Variable para el gráfico de recursos
 */
let chartRecursosAsignacion = null;

// ============================================================================
// FUNCIONES DE CARGA DE DATOS DESDE APIs
// ============================================================================

/**
 * Obtiene las configuraciones operativas desde la API
 * Reemplaza las constantes fijas por valores dinámicos de la BD
 */
async function obtenerConfiguracionesOperativas() {
    try {
        const ahora = Date.now();
        
        // Verificar cache válido
        if (configuracionesOperativasCache && ultimoFetchConfiguraciones && 
            (ahora - ultimoFetchConfiguraciones) < CACHE_TTL_CONFIG) {
            console.log('✓ Usando configuraciones desde cache');
            return configuracionesOperativasCache;
        }

        console.log('→ Obteniendo configuraciones operativas desde API...');
        
        const response = await realizarPeticion(`${API_URL}/api/configuracion/listar`, 'GET');
        
        if (!response.success || !response.data) {
            throw new Error('No se pudieron obtener las configuraciones');
        }

        // Transformar el array de configuraciones en un objeto estructurado
        const configs = {};
        response.data.forEach(config => {
            if (!configs[config.categoria]) {
                configs[config.categoria] = {};
            }
            if (!configs[config.categoria][config.subcategoria]) {
                configs[config.categoria][config.subcategoria] = {};
            }
            configs[config.categoria][config.subcategoria][config.nombre_parametro] = {
                valor: config.valor,
                unidad: config.unidad,
                descripcion: config.descripcion
            };
        });

        configuracionesOperativasCache = configs;
        ultimoFetchConfiguraciones = ahora;
        
        console.log('✓ Configuraciones operativas obtenidas:', Object.keys(configs).length, 'categorías');
        return configuracionesOperativasCache;
        
    } catch (error) {
        console.error('✗ Error obteniendo configuraciones:', error);
        
        // Si hay cache antiguo, usarlo
        if (configuracionesOperativasCache) {
            console.warn('⚠ Usando configuraciones en cache (antiguas)');
            return configuracionesOperativasCache;
        }
        
        // Si no hay cache, usar valores por defecto
        return obtenerConfiguracionesPorDefecto();
    }
}

/**
 * Configuraciones por defecto si falla la API
 */
function obtenerConfiguracionesPorDefecto() {
    return {
        SERENO: {
            CAPACIDAD: {
                llamadas_mes: { valor: 15, unidad: 'llamadas/mes' },
                casos_mes: { valor: 8, unidad: 'casos/mes' }
            }
        },
        POLICIA: {
            CAPACIDAD: {
                llamadas_mes: { valor: 20, unidad: 'llamadas/mes' },
                casos_mes: { valor: 12, unidad: 'casos/mes' }
            }
        },
        BOMBERO: {
            CAPACIDAD: {
                llamadas_mes: { valor: 30, unidad: 'llamadas/mes' },
                casos_mes: { valor: 5, unidad: 'casos/mes' }
            }
        },
        AMBULANCIA: {
            CAPACIDAD: {
                llamadas_mes: { valor: 25, unidad: 'llamadas/mes' },
                turnos_dia: { valor: 3, unidad: 'turnos' }
            }
        },
        VEHICULO_SERENAZGO: {
            CAPACIDAD: {
                llamadas_mes: { valor: 50, unidad: 'llamadas/mes' }
            }
        },
        VEHICULO_POLICIA: {
            CAPACIDAD: {
                llamadas_mes: { valor: 60, unidad: 'llamadas/mes' }
            }
        },
        VEHICULO_BOMBEROS: {
            CAPACIDAD: {
                llamadas_mes: { valor: 40, unidad: 'llamadas/mes' }
            }
        },
        PRESUPUESTO: {
            OPERATIVO: {
                costo_caso: { valor: 50, unidad: 'soles' },
                overhead: { valor: 1.15, unidad: 'multiplicador' }
            }
        },
        TIEMPO: {
            OPERATIVO: {
                horas_caso: { valor: 2, unidad: 'horas' },
                dias_laborables: { valor: 22, unidad: 'días' }
            }
        }
    };
}

/**
 * Obtiene el inventario actual de recursos desde la API
 */
async function obtenerInventarioRecursos() {
    try {
        const ahora = Date.now();
        
        // Verificar cache válido
        if (recursosInventarioCache && ultimoFetchInventario && 
            (ahora - ultimoFetchInventario) < CACHE_TTL_CONFIG) {
            console.log('✓ Usando inventario desde cache');
            return recursosInventarioCache;
        }

        console.log('→ Obteniendo inventario de recursos desde API...');
        
        const response = await realizarPeticion(`${API_URL}/api/recursos/listar`, 'GET');
        
        if (!response.success || !response.data) {
            throw new Error('No se pudo obtener el inventario');
        }

        // Transformar array a objeto con claves por nombre
        const inventario = {};
        response.data.forEach(recurso => {
            inventario[recurso.nombre] = recurso.cantidad || 0;
        });

        recursosInventarioCache = inventario;
        ultimoFetchInventario = ahora;
        
        console.log('✓ Inventario obtenido:', Object.keys(inventario).length, 'tipos de recursos');
        return recursosInventarioCache;
        
    } catch (error) {
        console.error('✗ Error obteniendo inventario:', error);
        
        if (recursosInventarioCache) {
            console.warn('⚠ Usando inventario en cache (antiguo)');
            return recursosInventarioCache;
        }
        
        return null;
    }
}

// ============================================================================
// FUNCIÓN PRINCIPAL: CALCULAR RECURSOS
// ============================================================================

/**
 * Punto de entrada principal para calcular recursos necesarios
 */
async function calcularRecursosAsignacion() {
    const mesPlan = document.getElementById('mesPlanAsignacion')?.value;
    
    if (!mesPlan) {
        mostrarToast('Por favor, seleccione un mes para planificar', 'warning');
        return;
    }

    const [year, month] = mesPlan.split('-').map(Number);
    
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        mostrarToast('Formato de fecha inválido', 'error');
        return;
    }

    mostrarLoading('Calculando asignación de recursos...');
    
    try {
        // Cargar datos en paralelo
        const [configuraciones, inventario, prediccionResponse] = await Promise.all([
            obtenerConfiguracionesOperativas(),
            obtenerInventarioRecursos(),
            realizarPeticion(`${API_URL}/api/modelo/prediccion/predecir`, 'POST', { year, month })
        ]);

        ocultarLoading();

        if (!prediccionResponse.success || !prediccionResponse.data) {
            throw new Error(prediccionResponse.error || 'Predicción no disponible');
        }

        // Generar plan completo
        generarPlanRecursosCompleto(
            prediccionResponse.data,
            configuraciones,
            inventario
        );
        
        console.log('✓ Plan de recursos generado exitosamente');
        
    } catch (error) {
        ocultarLoading();
        console.error('✗ Error calculando recursos:', error);
        mostrarToast(
            `Error al calcular recursos: ${error.message}`,
            'error'
        );
    }
}

// ============================================================================
// LÓGICA DE CÁLCULO CON CONFIGURACIONES DINÁMICAS
// ============================================================================

/**
 * Calcula recursos necesarios usando configuraciones de la BD
 */
function calcularRecursosNecesariosConConfiguracion(prediccion, configuraciones) {
    // Obtener valores de configuración
    const getConfig = (categoria, subcategoria, parametro, valorDefault = 1) => {
        try {
            return configuraciones[categoria]?.[subcategoria]?.[parametro]?.valor || valorDefault;
        } catch {
            return valorDefault;
        }
    };

    // Calcular totales de denuncias y emergencias
    const totalDenuncias = Object.values(prediccion.denuncias || {}).reduce((sum, val) => sum + val, 0);
    const totalEmergencias = Object.values(prediccion.emergencias || {}).reduce((sum, val) => sum + val, 0);
    
    // Distribución de emergencias por servicio
    const emergenciasPorServicio = {
        policia: prediccion.emergencias?.[2] || 0,
        serenazgo: prediccion.emergencias?.[3] || 0,
        ambulancia: prediccion.emergencias?.[4] || 0,
        bomberos: (prediccion.emergencias?.[5] || 0) + (prediccion.emergencias?.[6] || 0)
    };
    
    // CÁLCULO DE PERSONAL NECESARIO usando configuraciones de BD
    const llamadasPorSereno = getConfig('SERENO', 'CAPACIDAD', 'llamadas_mes', 15);
    const llamadasPorPolicia = getConfig('POLICIA', 'CAPACIDAD', 'llamadas_mes', 20);
    const llamadasPorBombero = getConfig('BOMBERO', 'CAPACIDAD', 'llamadas_mes', 30);
    const casosPorPersonal = getConfig('SERENO', 'CAPACIDAD', 'casos_mes', 8);
    
    const personalNecesario = {
        serenos: Math.ceil(emergenciasPorServicio.serenazgo / llamadasPorSereno),
        policias: Math.ceil(emergenciasPorServicio.policia / llamadasPorPolicia),
        bomberos: Math.ceil(emergenciasPorServicio.bomberos / llamadasPorBombero),
        personal_denuncias: Math.ceil(totalDenuncias / casosPorPersonal)
    };
    
    // CÁLCULO DE VEHÍCULOS NECESARIOS usando configuraciones de BD
    const llamadasPorVehiculoSerenazgo = getConfig('VEHICULO_SERENAZGO', 'CAPACIDAD', 'llamadas_mes', 50);
    const llamadasPorVehiculoPolicia = getConfig('VEHICULO_POLICIA', 'CAPACIDAD', 'llamadas_mes', 60);
    const llamadasPorVehiculoBomberos = getConfig('VEHICULO_BOMBEROS', 'CAPACIDAD', 'llamadas_mes', 40);
    const llamadasPorAmbulancia = getConfig('AMBULANCIA', 'CAPACIDAD', 'llamadas_mes', 25);
    
    const vehiculosNecesarios = {
        vehiculos_serenazgo: Math.ceil(emergenciasPorServicio.serenazgo / llamadasPorVehiculoSerenazgo),
        vehiculos_policia: Math.ceil(emergenciasPorServicio.policia / llamadasPorVehiculoPolicia),
        vehiculos_bomberos: Math.ceil(emergenciasPorServicio.bomberos / llamadasPorVehiculoBomberos),
        ambulancias: Math.ceil(emergenciasPorServicio.ambulancia / llamadasPorAmbulancia)
    };
    
    // CÁLCULO DE PRESUPUESTO Y TIEMPO usando configuraciones de BD
    const costoPorCaso = getConfig('PRESUPUESTO', 'OPERATIVO', 'costo_caso', 50);
    const overhead = getConfig('PRESUPUESTO', 'OPERATIVO', 'overhead', 1.15);
    const horasPorCaso = getConfig('TIEMPO', 'OPERATIVO', 'horas_caso', 2);
    
    const totalCasos = totalDenuncias + totalEmergencias;
    const presupuesto = Math.round(totalCasos * costoPorCaso * overhead);
    const horasHombre = totalCasos * horasPorCaso;
    
    return {
        personal: personalNecesario,
        vehiculos: vehiculosNecesarios,
        metricas: {
            total_personal: Object.values(personalNecesario).reduce((sum, val) => sum + val, 0),
            total_vehiculos: Object.values(vehiculosNecesarios).reduce((sum, val) => sum + val, 0),
            presupuesto_mensual: presupuesto,
            horas_hombre: horasHombre,
            casos_totales: totalCasos,
            total_denuncias: totalDenuncias,
            total_emergencias: totalEmergencias
        },
        emergencias_por_servicio: emergenciasPorServicio,
        configuraciones_usadas: {
            llamadas_por_sereno: llamadasPorSereno,
            llamadas_por_policia: llamadasPorPolicia,
            llamadas_por_bombero: llamadasPorBombero,
            costo_por_caso: costoPorCaso,
            overhead: overhead
        }
    };
}

/**
 * Calcula análisis de brechas (gap analysis) con inventario real
 */
function calcularAnalisisGapConInventario(necesarios, inventario) {
    if (!inventario) {
        console.warn('⚠ No hay inventario disponible para análisis de gaps');
        return null;
    }
    
    // Mapear nombres del inventario a categorías
    const serenos = inventario.serenos || 0;
    const policias = inventario.policias || 0;
    const bomberos = inventario.bomberos || 0;
    const vehiculosSerenazgo = inventario.vehiculos_serenazgo || 0;
    const vehiculosPolicia = inventario.vehiculos_policia || 0;
    const vehiculosBomberos = inventario.vehiculos_bomberos || 0;
    const ambulancias = inventario.ambulancias || 0;
    
    const gaps = {
        personal: {
            serenos: serenos - necesarios.personal.serenos,
            policias: policias - necesarios.personal.policias,
            bomberos: bomberos - necesarios.personal.bomberos
        },
        vehiculos: {
            vehiculos_serenazgo: vehiculosSerenazgo - necesarios.vehiculos.vehiculos_serenazgo,
            vehiculos_policia: vehiculosPolicia - necesarios.vehiculos.vehiculos_policia,
            vehiculos_bomberos: vehiculosBomberos - necesarios.vehiculos.vehiculos_bomberos,
            ambulancias: ambulancias - necesarios.vehiculos.ambulancias
        }
    };
    
    const totalGapPersonal = Object.values(gaps.personal).reduce((sum, val) => sum + val, 0);
    const totalGapVehiculos = Object.values(gaps.vehiculos).reduce((sum, val) => sum + val, 0);
    
    // Identificar déficits críticos (>20%)
    const deficitsCriticos = [];
    
    Object.entries(gaps.personal).forEach(([tipo, gap]) => {
        if (necesarios.personal[tipo] === 0) return;
        const porcentajeDeficit = (gap / necesarios.personal[tipo]) * 100;
        if (porcentajeDeficit < -20) {
            deficitsCriticos.push({
                categoria: 'Personal',
                tipo: formatearNombreRecurso(tipo),
                deficit: Math.abs(gap),
                actual: inventario[tipo] || 0,
                necesario: necesarios.personal[tipo],
                porcentaje: Math.abs(porcentajeDeficit).toFixed(1)
            });
        }
    });
    
    Object.entries(gaps.vehiculos).forEach(([tipo, gap]) => {
        if (necesarios.vehiculos[tipo] === 0) return;
        const porcentajeDeficit = (gap / necesarios.vehiculos[tipo]) * 100;
        if (porcentajeDeficit < -20) {
            deficitsCriticos.push({
                categoria: 'Vehículos',
                tipo: formatearNombreRecurso(tipo),
                deficit: Math.abs(gap),
                actual: inventario[tipo] || 0,
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
        inventario: {
            personal_total: serenos + policias + bomberos,
            vehiculos_total: vehiculosSerenazgo + vehiculosPolicia + vehiculosBomberos + ambulancias
        },
        estado: totalGapPersonal >= 0 && totalGapVehiculos >= 0 ? 'suficiente' : 'deficit',
        deficits_criticos: deficitsCriticos
    };
}

// ============================================================================
// GENERACIÓN DEL PLAN COMPLETO
// ============================================================================

/**
 * Genera el plan completo de recursos
 */
function generarPlanRecursosCompleto(prediccion, configuraciones, inventario) {
    console.log('→ Generando plan completo de recursos...');
    
    // Mostrar contenedor de resultados
    const contenedor = document.getElementById('resultadoAsignacionRecursos');
    if (contenedor) {
        contenedor.style.display = 'block';
    }
    
    // Calcular recursos necesarios
    const recursosCalculados = calcularRecursosNecesariosConConfiguracion(prediccion, configuraciones);
    const gapAnalysis = calcularAnalisisGapConInventario(recursosCalculados, inventario);
    
    // Actualizar interfaz
    actualizarMetricasAsignacion(recursosCalculados, inventario, gapAnalysis);
    generarVisualizacionesAsignacion(recursosCalculados, inventario, prediccion);
    generarRecomendacionesAsignacion(prediccion, recursosCalculados, inventario, gapAnalysis);
    
    // Scroll suave al resultado
    contenedor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    console.log('✓ Plan de recursos generado exitosamente');
}

// ============================================================================
// ACTUALIZACIÓN DE INTERFAZ
// ============================================================================

/**
 * Actualiza las métricas principales en la interfaz
 */
function actualizarMetricasAsignacion(calculados, inventario, gaps) {
    // Personal requerido
    const personalHTML = generarHTMLPersonalAsignacion(calculados, inventario, gaps);
    const elemPersonal = document.getElementById('personalRequeridoAsignacion');
    if (elemPersonal) elemPersonal.innerHTML = personalHTML;
    
    // Vehículos necesarios
    const vehiculosHTML = generarHTMLVehiculosAsignacion(calculados, inventario, gaps);
    const elemVehiculos = document.getElementById('vehiculosNecesariosAsignacion');
    if (elemVehiculos) elemVehiculos.innerHTML = vehiculosHTML;
    
    // Presupuesto
    const presupuestoHTML = formatearMoneda(calculados.metricas.presupuesto_mensual);
    const elemPresupuesto = document.getElementById('presupuestoEstimadoAsignacion');
    if (elemPresupuesto) elemPresupuesto.innerHTML = presupuestoHTML;
    
    // Horas de trabajo
    const horasHTML = calculados.metricas.horas_hombre.toLocaleString('es-PE') + ' horas';
    const elemHoras = document.getElementById('horasTrabajoAsignacion');
    if (elemHoras) elemHoras.innerHTML = horasHTML;
}

/**
 * Genera HTML para mostrar personal con comparación
 */
function generarHTMLPersonalAsignacion(calculados, inventario, gaps) {
    const necesario = calculados.metricas.total_personal;
    let html = `<strong style="font-size: 20px;">${necesario}</strong>`;
    
    if (inventario && gaps) {
        const actual = gaps.inventario.personal_total;
        const statusIcon = gaps.totales.personal >= 0 ? '✅' : '⚠️';
        const statusColor = gaps.totales.personal >= 0 ? '#4caf50' : '#ff9800';
        const diferencia = gaps.totales.personal;
        
        html += `
            <br>
            <small style="font-size: 13px; opacity: 0.85; color: ${statusColor};">
                ${statusIcon} Disponibles: ${actual}
                ${diferencia !== 0 ? `(${diferencia > 0 ? '+' : ''}${diferencia})` : ''}
            </small>
        `;
    }
    
    return html;
}

/**
 * Genera HTML para mostrar vehículos con comparación
 */
function generarHTMLVehiculosAsignacion(calculados, inventario, gaps) {
    const necesario = calculados.metricas.total_vehiculos;
    let html = `<strong style="font-size: 20px;">${necesario}</strong>`;
    
    if (inventario && gaps) {
        const actual = gaps.inventario.vehiculos_total;
        const statusIcon = gaps.totales.vehiculos >= 0 ? '✅' : '⚠️';
        const statusColor = gaps.totales.vehiculos >= 0 ? '#4caf50' : '#ff9800';
        const diferencia = gaps.totales.vehiculos;
        
        html += `
            <br>
            <small style="font-size: 13px; opacity: 0.85; color: ${statusColor};">
                ${statusIcon} Disponibles: ${actual}
                ${diferencia !== 0 ? `(${diferencia > 0 ? '+' : ''}${diferencia})` : ''}
            </small>
        `;
    }
    
    return html;
}

// ============================================================================
// VISUALIZACIONES
// ============================================================================

/**
 * Genera los gráficos de visualización
 */
function generarVisualizacionesAsignacion(calculados, inventario, prediccion) {
    if (inventario) {
        crearGraficoComparativoAsignacion(calculados, inventario);
    } else {
        crearGraficoRecursosSimple(calculados);
    }
    
    crearGraficoDistribucionEmergenciasAsignacion(calculados.emergencias_por_servicio);
}

/**
 * Crea gráfico comparativo de recursos necesarios vs disponibles
 */
function crearGraficoComparativoAsignacion(calculados, inventario) {
    // Destruir gráfico anterior
    if (chartRecursosAsignacion) {
        chartRecursosAsignacion.destroy();
    }
    
    const labels = [
        'Serenos',
        'Policías', 
        'Bomberos',
        'Veh. Serenazgo',
        'Veh. Policía',
        'Veh. Bomberos',
        'Ambulancias'
    ];
    
    const datosNecesarios = [
        calculados.personal.serenos,
        calculados.personal.policias,
        calculados.personal.bomberos,
        calculados.vehiculos.vehiculos_serenazgo,
        calculados.vehiculos.vehiculos_policia,
        calculados.vehiculos.vehiculos_bomberos,
        calculados.vehiculos.ambulancias
    ];
    
    const datosDisponibles = [
        inventario.serenos || 0,
        inventario.policias || 0,
        inventario.bomberos || 0,
        inventario.vehiculos_serenazgo || 0,
        inventario.vehiculos_policia || 0,
        inventario.vehiculos_bomberos || 0,
        inventario.ambulancias || 0
    ];
    
    const ctx = document.getElementById('chartRecursosAsignacion');
    if (!ctx) {
        console.error('✗ Canvas chartRecursosAsignacion no encontrado');
        return;
    }
    
    chartRecursosAsignacion = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Disponibles Actualmente',
                    data: datosDisponibles,
                    backgroundColor: 'rgba(76, 175, 80, 0.75)',
                    borderColor: 'rgba(76, 175, 80, 1)',
                    borderWidth: 2,
                    borderRadius: 4
                },
                {
                    label: 'Requeridos (Predicción)',
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
            maintainAspectRatio: false,
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
                            const disponible = datosDisponibles[idx];
                            const requerido = datosNecesarios[idx];
                            const diferencia = disponible - requerido;
                            
                            if (diferencia >= 0) {
                                return `✓ Suficiente (${diferencia > 0 ? '+' + diferencia : 'exacto'})`;
                            } else {
                                const deficit = Math.abs(diferencia);
                                const porcentaje = ((deficit / requerido) * 100).toFixed(1);
                                return `⚠ Déficit: ${deficit} (${porcentaje}%)`;
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
                    }
                },
                x: {
                    ticks: {
                        font: { size: 10 },
                        maxRotation: 45
                    }
                }
            }
        }
    });
}

/**
 * Crea gráfico simple de recursos (sin comparación)
 */
function crearGraficoRecursosSimple(calculados) {
    if (chartRecursosAsignacion) {
        chartRecursosAsignacion.destroy();
    }
    
    const ctx = document.getElementById('chartRecursosAsignacion');
    if (!ctx) return;
    
    chartRecursosAsignacion = new Chart(ctx, {
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
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Recursos Necesarios Según Predicción',
                    font: { size: 16, weight: '600' }
                }
            },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } }
            }
        }
    });
}

/**
 * Crea gráfico de distribución de emergencias
 */
function crearGraficoDistribucionEmergenciasAsignacion(emergenciasPorServicio) {
    const canvas = document.getElementById('chartDistribucionEmergenciasAsignacion');
    if (!canvas) return;
    
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
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Distribución de Emergencias por Servicio',
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
// RECOMENDACIONES ESTRATÉGICAS
// ============================================================================

/**
 * Genera recomendaciones estratégicas completas
 */
function generarRecomendacionesAsignacion(prediccion, calculados, inventario, gaps) {
    let html = `
        <div class="recomendaciones-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; color: white; margin-bottom: 20px;">
            <h4 style="margin: 0 0 10px 0; font-size: 18px;">
                📋 Plan Estratégico de Asignación de Recursos
            </h4>
            <p style="margin: 0; font-size: 13px; opacity: 0.9; line-height: 1.6;">
                Mes objetivo: <strong>${prediccion.fecha_prediccion || 'N/A'}</strong> | 
                Casos proyectados: <strong>${calculados.metricas.casos_totales}</strong>
                (${calculados.metricas.total_denuncias} denuncias + ${calculados.metricas.total_emergencias} emergencias)
            </p>
        </div>
    `;

    // Estado general
    html += generarSeccionEstadoGeneralAsignacion(gaps, inventario);

    // Tabla de déficits críticos si existen
    if (gaps && gaps.deficits_criticos && gaps.deficits_criticos.length > 0) {
        html += generarTablaDeficitsCriticosAsignacion(gaps.deficits_criticos);
    }

    // Resumen ejecutivo
    html += generarResumenEjecutivoAsignacion(calculados, inventario, gaps);

    // Recomendaciones operativas
    html += generarRecomendacionesOperativasAsignacion(calculados, inventario, gaps);

    // KPIs
    html += generarIndicadoresDesempenoAsignacion(calculados, gaps);

    // Configuraciones usadas
    if (calculados.configuraciones_usadas) {
        html += generarSeccionConfiguracionesUsadas(calculados.configuraciones_usadas);
    }

    const contenedor = document.getElementById('planAccionAsignacion');
    if (contenedor) {
        contenedor.innerHTML = html;
    }
}

/**
 * Genera sección de estado general
 */
function generarSeccionEstadoGeneralAsignacion(gaps, inventario) {
    if (!gaps || !inventario) {
        return `
            <div class="alert alert-warning" style="margin: 20px 0; padding: 16px; border-left: 4px solid #ff9800; background: rgba(255, 152, 0, 0.08); border-radius: 6px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 24px;">ℹ️</span>
                    <div>
                        <strong style="font-size: 14px;">Inventario No Disponible</strong>
                        <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;">
                            No se pudo cargar el inventario municipal. Los cálculos se basan únicamente en predicciones.
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    const estado = gaps.estado;
    const isDeficit = estado === 'deficit';
    
    const config = {
        icon: isDeficit ? '⚠️' : '✅',
        color: isDeficit ? '#ff9800' : '#4caf50',
        bg: isDeficit ? 'rgba(255, 152, 0, 0.08)' : 'rgba(76, 175, 80, 0.08)',
        titulo: isDeficit ? 'Atención Requerida - Déficit Detectado' : 'Estado Óptimo - Recursos Suficientes',
        mensaje: isDeficit 
            ? 'Se identificaron brechas en la disponibilidad de recursos. Es necesario implementar medidas correctivas.'
            : 'Los recursos actuales son suficientes para atender la demanda proyectada.'
    };

    return `
        <div class="alert" style="margin: 20px 0; padding: 16px; border-left: 4px solid ${config.color}; background: ${config.bg}; border-radius: 6px;">
            <div style="display: flex; align-items: flex-start; gap: 12px;">
                <span style="font-size: 26px;">${config.icon}</span>
                <div style="flex: 1;">
                    <strong style="font-size: 14px; color: ${config.color};">${config.titulo}</strong>
                    <p style="margin: 8px 0 0 0; font-size: 13px; line-height: 1.6;">
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

/**
 * Genera tabla de déficits críticos
 */
function generarTablaDeficitsCriticosAsignacion(deficits) {
    return `
        <div style="margin: 25px 0;">
            <h5 style="color: #f44336; margin: 0 0 15px 0; font-size: 15px; display: flex; align-items: center; gap: 8px;">
                🚨 Déficits Críticos (>20%)
                <span style="background: #f44336; color: white; font-size: 11px; padding: 2px 8px; border-radius: 12px;">
                    ${deficits.length} alerta${deficits.length > 1 ? 's' : ''}
                </span>
            </h5>
            <div style="overflow-x: auto; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <thead>
                        <tr style="background: rgba(244, 67, 54, 0.08);">
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0;">Recurso</th>
                            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e0e0e0;">Disponible</th>
                            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e0e0e0;">Requerido</th>
                            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e0e0e0;">Déficit</th>
                            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e0e0e0;">Criticidad</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${deficits.map((d, index) => {
                            const nivelCriticidad = parseFloat(d.porcentaje) > 50 ? 'ALTA' : 
                                                   parseFloat(d.porcentaje) > 30 ? 'MEDIA' : 'BAJA';
                            const colorCriticidad = nivelCriticidad === 'ALTA' ? '#d32f2f' : 
                                                   nivelCriticidad === 'MEDIA' ? '#f57c00' : '#fbc02d';
                            
                            return `
                                <tr style="border-bottom: 1px solid #e0e0e0; ${index % 2 === 0 ? 'background: #fafafa;' : ''}">
                                    <td style="padding: 12px;">
                                        <strong>${d.tipo}</strong>
                                        <br><small style="opacity: 0.6;">${d.categoria}</small>
                                    </td>
                                    <td style="padding: 12px; text-align: center;">${d.actual}</td>
                                    <td style="padding: 12px; text-align: center;">${d.necesario}</td>
                                    <td style="padding: 12px; text-align: center; color: #f44336; font-weight: 600;">
                                        -${d.deficit}
                                    </td>
                                    <td style="padding: 12px; text-align: center;">
                                        <span style="background: ${colorCriticidad}; color: white; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                                            ${nivelCriticidad}
                                        </span>
                                        <br><small style="opacity: 0.7;">${d.porcentaje}%</small>
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
 * Genera resumen ejecutivo
 */
function generarResumenEjecutivoAsignacion(calculados, inventario, gaps) {
    const hasDatos = !!inventario;
    
    return `
        <div style="margin: 25px 0;">
            <h5 style="margin: 0 0 15px 0; font-size: 15px; color: #2c3e50;">
                📊 Resumen Ejecutivo
            </h5>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                ${generarCardResumenAsignacion('👥 Personal de Campo', 
                    `${calculados.personal.serenos} serenos<br>
                     ${calculados.personal.policias} policías<br>
                     ${calculados.personal.bomberos} bomberos`,
                    hasDatos && gaps ? `${gaps.inventario.personal_total} disponibles` : null)}
                
                ${generarCardResumenAsignacion('🚗 Flota Vehicular', 
                    `${calculados.vehiculos.vehiculos_serenazgo} veh. serenazgo<br>
                     ${calculados.vehiculos.vehiculos_policia} veh. policía<br>
                     ${calculados.vehiculos.vehiculos_bomberos} veh. bomberos<br>
                     ${calculados.vehiculos.ambulancias} ambulancias`,
                    hasDatos && gaps ? `${gaps.inventario.vehiculos_total} disponibles` : null)}
                
                ${generarCardResumenAsignacion('💰 Presupuesto Mensual', 
                    formatearMoneda(calculados.metricas.presupuesto_mensual),
                    'Incluye overhead operativo')}
                
                ${generarCardResumenAsignacion('⏱️ Carga Operativa', 
                    `${calculados.metricas.horas_hombre.toLocaleString('es-PE')} horas-hombre`,
                    `${(calculados.metricas.horas_hombre / 22).toFixed(0)} horas/día promedio`)}
            </div>
        </div>
    `;
}

/**
 * Genera card de resumen
 */
function generarCardResumenAsignacion(titulo, contenido, footer) {
    return `
        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 3px solid #4a90e2; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <div style="font-size: 12px; font-weight: 600; color: #4a90e2; margin-bottom: 8px; text-transform: uppercase;">
                ${titulo}
            </div>
            <div style="font-size: 14px; font-weight: 600; line-height: 1.5; margin-bottom: 8px;">
                ${contenido}
            </div>
            ${footer ? `<div style="font-size: 11px; opacity: 0.7; margin-top: 6px;">${footer}</div>` : ''}
        </div>
    `;
}

/**
 * Genera recomendaciones operativas
 */
function generarRecomendacionesOperativasAsignacion(calculados, inventario, gaps) {
    const tieneDeficit = gaps && gaps.estado === 'deficit';
    
    return `
        <div style="margin: 25px 0;">
            <h5 style="margin: 0 0 15px 0; font-size: 15px; color: #2c3e50;">
                💡 Recomendaciones Operativas
            </h5>
            <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <ol style="margin: 0; padding-left: 20px; line-height: 2; font-size: 13px;">
                    <li>
                        <strong>Distribución de Personal:</strong> 
                        Asignar ${calculados.personal.serenos} serenos en zonas de alta incidencia. 
                        Coordinar turnos rotativos de 8 horas para cobertura 24/7.
                        ${tieneDeficit && gaps.totales.personal < 0 ? 
                          '<br><span style="color: #f44336;">⚠️ Considerar contratación temporal o redistribución.</span>' : ''}
                    </li>
                    <li>
                        <strong>Gestión de Flota:</strong> 
                        Mantener ${calculados.metricas.total_vehiculos} unidades móviles con disponibilidad inmediata. 
                        Programar mantenimiento preventivo mensual.
                        ${tieneDeficit && gaps.totales.vehiculos < 0 ? 
                          '<br><span style="color: #f44336;">⚠️ Considerar alquiler de vehículos adicionales.</span>' : ''}
                    </li>
                    <li>
                        <strong>Protocolos de Respuesta:</strong> 
                        Emergencias críticas (5 min), urgencias (15 min), casos regulares (60 min).
                    </li>
                    <li>
                        <strong>Presupuesto:</strong> 
                        Asignar ${formatearMoneda(calculados.metricas.presupuesto_mensual)} mensuales 
                        (${formatearMoneda(calculados.metricas.presupuesto_mensual / calculados.metricas.casos_totales)} por caso).
                    </li>
                    <li>
                        <strong>Monitoreo:</strong> 
                        Revisar semanalmente desempeño y ajustar recursos según demanda real vs proyectada.
                    </li>
                </ol>
            </div>
        </div>
    `;
}

/**
 * Genera indicadores de desempeño (KPIs)
 */
function generarIndicadoresDesempenoAsignacion(calculados, gaps) {
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
    const colorCapacidad = capacidadRespuesta >= 90 ? '#4caf50' : capacidadRespuesta >= 75 ? '#ff9800' : '#f44336';
    const casosPorPersonal = (calculados.metricas.casos_totales / calculados.metricas.total_personal).toFixed(1);

    return `
        <div style="margin: 25px 0; padding: 20px; background: linear-gradient(135deg, rgba(74, 144, 226, 0.08) 0%, rgba(33, 150, 243, 0.08) 100%); border-radius: 8px; border: 1px solid rgba(74, 144, 226, 0.2);">
            <h5 style="margin: 0 0 15px 0; font-size: 15px; color: #2c3e50;">
                📈 Indicadores Clave de Desempeño (KPIs)
            </h5>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; text-align: center;">
                ${generarKPIAsignacion('Capacidad de Respuesta', `${capacidadRespuesta}%`, colorCapacidad)}
                ${generarKPIAsignacion('Eficiencia Personal', `${eficienciaPersonal.toFixed(1)}%`, 
                    eficienciaPersonal >= 90 ? '#4caf50' : eficienciaPersonal >= 75 ? '#ff9800' : '#f44336')}
                ${generarKPIAsignacion('Cobertura Vehicular', `${coberturaVehicular.toFixed(1)}%`, 
                    coberturaVehicular >= 90 ? '#4caf50' : coberturaVehicular >= 75 ? '#ff9800' : '#f44336')}
                ${generarKPIAsignacion('Casos por Personal', casosPorPersonal, '#4a90e2')}
            </div>
        </div>
    `;
}

/**
 * Genera un KPI individual
 */
function generarKPIAsignacion(titulo, valor, color) {
    return `
        <div style="background: white; padding: 15px; border-radius: 8px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #666; margin-bottom: 5px; font-weight: 600;">
                ${titulo}
            </div>
            <div style="font-size: 24px; font-weight: 700; color: ${color};">
                ${valor}
            </div>
        </div>
    `;
}

/**
 * Genera sección de configuraciones usadas
 */
function generarSeccionConfiguracionesUsadas(configs) {
    return `
        <div style="margin: 25px 0; padding: 15px; background: rgba(0,0,0,0.02); border-radius: 8px; border: 1px dashed #ccc;">
            <h6 style="margin: 0 0 10px 0; font-size: 13px; color: #666; text-transform: uppercase;">
                ⚙️ Parámetros de Configuración Utilizados
            </h6>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 12px;">
                <div>📞 <strong>Llamadas/Sereno:</strong> ${configs.llamadas_por_sereno}</div>
                <div>🚔 <strong>Llamadas/Policía:</strong> ${configs.llamadas_por_policia}</div>
                <div>🚒 <strong>Llamadas/Bombero:</strong> ${configs.llamadas_por_bombero}</div>
                <div>💰 <strong>Costo/Caso:</strong> S/ ${configs.costo_por_caso}</div>
                <div>📊 <strong>Overhead:</strong> ${((configs.overhead - 1) * 100).toFixed(0)}%</div>
            </div>
            <p style="margin: 10px 0 0 0; font-size: 11px; opacity: 0.7;">
                Los valores se obtienen de la tabla <code>configuraciones_operativas</code> de la base de datos.
            </p>
        </div>
    `;
}

console.log('✓ Módulo de Asignación de Recursos con APIs integradas cargado correctamente');