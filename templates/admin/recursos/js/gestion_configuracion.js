// gestion_configuracion.js - Gestión de configuraciones y ratios operativos

// gestion_configuracion.js - Gestión de configuraciones y ratios operativos

// Verificar si las variables ya existen
if (typeof configuracionesData === 'undefined') {
    var configuracionesData = [];
}
if (typeof configuracionesFiltradas === 'undefined') {
    var configuracionesFiltradas = [];
}
if (typeof subcategoriasDisponibles === 'undefined') {
    var subcategoriasDisponibles = new Set();
}

// Resto del código...
/**
 * Carga todas las configuraciones desde el servidor
 */
async function cargarConfiguraciones() {
    try {
        mostrarLoading('Cargando configuraciones...');
        
        const response = await realizarPeticion(`${API_URL}/api/configuracion/listar`, 'GET');
        
        ocultarLoading();

        if (response.success && response.data) {
            configuracionesData = response.data;
            configuracionesFiltradas = [...configuracionesData];
            
            // Extraer subcategorías únicas
            subcategoriasDisponibles.clear();
            configuracionesData.forEach(config => {
                subcategoriasDisponibles.add(config.subcategoria);
            });
            
            mostrarTablaConfiguraciones(configuracionesFiltradas);
            
            // Actualizar badge
            document.getElementById('badgeTotalConfiguraciones').textContent = 
                `${response.total} parámetro${response.total !== 1 ? 's' : ''}`;
            
            console.log(`✓ ${response.total} configuraciones cargadas`);
        } else {
            mostrarToast('Error al cargar configuraciones', 'error');
        }
    } catch (error) {
        ocultarLoading();
        console.error('Error cargando configuraciones:', error);
        mostrarToast('Error de conexión al cargar configuraciones', 'error');
        mostrarTablaConfiguraciones([]);
    }
}

/**
 * Muestra las configuraciones en la tabla
 */
function mostrarTablaConfiguraciones(configuraciones) {
    const tbody = document.getElementById('bodyTablaConfiguraciones');
    
    if (!configuraciones || configuraciones.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 50px; color: #999;">
                    <i class="fas fa-cog" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p style="margin: 0;">No se encontraron configuraciones</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = configuraciones.map(config => {
        const editable = config.editable === 1;
        const badgeEditable = editable 
            ? '<span class="badge bg-success" style="font-size: 11px;">SÍ</span>'
            : '<span class="badge bg-secondary" style="font-size: 11px;">NO</span>';
        
        const descripcion = config.descripcion || '<em style="color: #999;">Sin descripción</em>';
        
        // Determinar color de categoría
        const coloresCategoria = {
            'SERENO': '#667eea',
            'POLICIA': '#4facfe',
            'BOMBERO': '#f093fb',
            'AMBULANCIA': '#43e97b',
            'VEHICULO_SERENAZGO': '#fa709a',
            'VEHICULO_POLICIA': '#feca57',
            'VEHICULO_BOMBEROS': '#ff6b6b',
            'PRESUPUESTO': '#feca57',
            'TIEMPO': '#4facfe',
            'INFRAESTRUCTURA': '#667eea'
        };
        
        const colorCategoria = coloresCategoria[config.categoria] || '#999';

        return `
            <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 15px; font-weight: 600;">${config.id_config}</td>
                <td style="padding: 15px;">
                    <span style="background: ${colorCategoria}; color: white; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                        ${config.categoria}
                    </span>
                </td>
                <td style="padding: 15px;">
                    <span style="background: #f0f0f0; padding: 4px 10px; border-radius: 4px; font-size: 12px;">
                        ${config.subcategoria}
                    </span>
                </td>
                <td style="padding: 15px;">
                    <strong style="font-size: 14px;">${config.nombre_parametro}</strong>
                </td>
                <td style="padding: 15px; text-align: center;">
                    <span style="background: #e3f2fd; color: #1976d2; padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 14px;">
                        ${formatearNumero(config.valor)}
                    </span>
                </td>
                <td style="padding: 15px; font-size: 13px; color: #666;">
                    ${config.unidad || '-'}
                </td>
                <td style="padding: 15px; font-size: 13px;">${descripcion}</td>
                <td style="padding: 15px; text-align: center;">${badgeEditable}</td>
                <td style="padding: 15px; text-align: center;">
                    <button class="btn btn-sm btn-primary" onclick="editarConfiguracion(${config.id_config})" 
                            title="Editar configuración" style="margin-right: 5px;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-info" onclick="verHistorialConfiguracion(${config.id_config})" 
                            title="Ver historial">
                        <i class="fas fa-history"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="confirmarEliminarConfiguracion(${config.id_config}, '${config.nombre_parametro}')" 
                            title="Eliminar configuración" style="margin-left: 5px;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Filtra las configuraciones según los criterios seleccionados
 */
function filtrarConfiguraciones() {
    const categoria = document.getElementById('filtroCategoria').value;
    const subcategoria = document.getElementById('filtroSubcategoria').value;
    const busqueda = document.getElementById('buscarConfiguracion').value.toLowerCase().trim();
    
    configuracionesFiltradas = configuracionesData.filter(config => {
        const cumpleCategoria = !categoria || config.categoria === categoria;
        const cumpleSubcategoria = !subcategoria || config.subcategoria === subcategoria;
        const cumpleBusqueda = !busqueda || 
            config.nombre_parametro.toLowerCase().includes(busqueda) ||
            (config.descripcion && config.descripcion.toLowerCase().includes(busqueda));
        
        return cumpleCategoria && cumpleSubcategoria && cumpleBusqueda;
    });
    
    mostrarTablaConfiguraciones(configuracionesFiltradas);
    
    // Actualizar subcategorías disponibles según la categoría seleccionada
    if (categoria) {
        actualizarSubcategorias(categoria);
    }
}

/**
 * Actualiza el select de subcategorías según la categoría seleccionada
 */
function actualizarSubcategorias(categoria) {
    const selectSubcategoria = document.getElementById('filtroSubcategoria');
    const subcategorias = new Set();
    
    configuracionesData.forEach(config => {
        if (config.categoria === categoria) {
            subcategorias.add(config.subcategoria);
        }
    });
    
    selectSubcategoria.innerHTML = '<option value="">Todas las subcategorías</option>';
    
    Array.from(subcategorias).sort().forEach(sub => {
        const option = document.createElement('option');
        option.value = sub;
        option.textContent = sub;
        selectSubcategoria.appendChild(option);
    });
}

/**
 * Muestra el modal para crear una nueva configuración
 */
function mostrarModalNuevaConfiguracion() {
    document.getElementById('tituloModalConfiguracion').textContent = 'Agregar Nueva Configuración';
    document.getElementById('idConfiguracionEdit').value = '';
    limpiarFormulario('formConfiguracion');
    
    // Habilitar todos los campos
    document.getElementById('categoriaConfiguracion').disabled = false;
    document.getElementById('subcategoriaConfiguracion').disabled = false;
    document.getElementById('nombreParametro').disabled = false;

    abrirModal('modalConfiguracion');
}

/**
 * Edita una configuración existente
 */
async function editarConfiguracion(id) {
    try {
        mostrarLoading('Cargando configuración...');
        
        const response = await realizarPeticion(`${API_URL}/api/configuracion/obtener/${id}`, 'GET');
        
        ocultarLoading();

        if (response.success && response.data) {
            const config = response.data;
            
            document.getElementById('tituloModalConfiguracion').textContent = 'Editar Configuración';
            document.getElementById('idConfiguracionEdit').value = config.id_config;
            document.getElementById('categoriaConfiguracion').value = config.categoria;
            document.getElementById('subcategoriaConfiguracion').value = config.subcategoria;
            document.getElementById('nombreParametro').value = config.nombre_parametro;
            document.getElementById('valorConfiguracion').value = config.valor;
            document.getElementById('unidadConfiguracion').value = config.unidad || '';
            document.getElementById('descripcionConfiguracion').value = config.descripcion || '';
            document.getElementById('editableConfiguracion').checked = config.editable === 1;
            
            // Deshabilitar edición de campos clave
            document.getElementById('categoriaConfiguracion').disabled = true;
            document.getElementById('subcategoriaConfiguracion').disabled = true;
            document.getElementById('nombreParametro').disabled = true;

            abrirModal('modalConfiguracion');
        } else {
            mostrarToast('Error al cargar la configuración', 'error');
        }
    } catch (error) {
        ocultarLoading();
        console.error('Error:', error);
        mostrarToast('Error de conexión', 'error');
    }
}

/**
 * Guarda una configuración (crear o actualizar)
 */
async function guardarConfiguracion() {
    if (!validarFormulario('formConfiguracion')) {
        mostrarToast('Por favor complete todos los campos requeridos', 'warning');
        return;
    }

    const id = document.getElementById('idConfiguracionEdit').value;
    const categoria = document.getElementById('categoriaConfiguracion').value.trim();
    const subcategoria = document.getElementById('subcategoriaConfiguracion').value.trim();
    const nombre_parametro = document.getElementById('nombreParametro').value.trim();
    const valor = parseFloat(document.getElementById('valorConfiguracion').value);
    const unidad = document.getElementById('unidadConfiguracion').value.trim();
    const descripcion = document.getElementById('descripcionConfiguracion').value.trim();
    const editable = document.getElementById('editableConfiguracion').checked ? 1 : 0;

    // Validaciones adicionales
    if (isNaN(valor)) {
        mostrarToast('El valor debe ser un número válido', 'warning');
        return;
    }

    try {
        mostrarLoading('Guardando...');

        let url, method, data;

        if (id) {
            // Actualizar (solo se puede cambiar valor, unidad, descripción y editable)
            url = `${API_URL}/api/configuracion/actualizar/${id}`;
            method = 'PUT';
            data = { valor, unidad, descripcion, editable, usuario: 'admin' };
        } else {
            // Crear
            url = `${API_URL}/api/configuracion/crear`;
            method = 'POST';
            data = { 
                categoria, 
                subcategoria, 
                nombre_parametro, 
                valor, 
                unidad, 
                descripcion, 
                editable, 
                usuario: 'admin' 
            };
        }

        const response = await realizarPeticion(url, method, data);
        
        ocultarLoading();

        if (response.success) {
            mostrarToast(response.message, 'success');
            cerrarModal('modalConfiguracion');
            cargarConfiguraciones(); // Recargar la tabla
        } else {
            mostrarToast(response.error || 'Error al guardar la configuración', 'error');
        }
    } catch (error) {
        ocultarLoading();
        console.error('Error:', error);
        mostrarToast('Error de conexión al guardar', 'error');
    }
}

/**
 * Confirma la eliminación de una configuración
 */
function confirmarEliminarConfiguracion(id, nombre) {
    document.getElementById('mensajeConfirmacion').innerHTML = `
        ¿Está seguro de que desea eliminar la configuración <strong>"${nombre}"</strong>?
        <br><br>
        Esta acción puede afectar los cálculos del sistema.
    `;
    
    document.getElementById('btnConfirmarEliminacion').onclick = () => eliminarConfiguracion(id);

    const modal = abrirModal('modalConfirmacion');
}

/**
 * Elimina una configuración
 */
async function eliminarConfiguracion(id) {
    try {
        mostrarLoading('Eliminando...');

        const response = await realizarPeticion(
            `${API_URL}/api/configuracion/eliminar/${id}?usuario=admin`, 
            'DELETE'
        );
        
        ocultarLoading();

        if (response.success) {
            mostrarToast(response.message, 'success');
            cerrarModal('modalConfirmacion');
            cargarConfiguraciones(); // Recargar la tabla
        } else {
            mostrarToast(response.error || 'Error al eliminar la configuración', 'error');
        }
    } catch (error) {
        ocultarLoading();
        console.error('Error:', error);
        mostrarToast('Error de conexión al eliminar', 'error');
    }
}

/**
 * Confirma el reset de configuraciones
 */
function confirmarResetConfiguraciones() {
    abrirModal('modalResetConfiguraciones');
}

/**
 * Resetea todas las configuraciones a valores por defecto
 */
async function resetearConfiguraciones() {
    try {
        mostrarLoading('Restableciendo configuraciones...');

        const response = await realizarPeticion(
            `${API_URL}/api/configuracion/resetear`,
            'POST',
            { usuario: 'admin' }
        );
        
        ocultarLoading();

        if (response.success) {
            mostrarToast(response.message, 'success');
            cerrarModal('modalResetConfiguraciones');
            cargarConfiguraciones(); // Recargar la tabla
        } else {
            mostrarToast(response.error || 'Error al resetear configuraciones', 'error');
        }
    } catch (error) {
        ocultarLoading();
        console.error('Error:', error);
        mostrarToast('Error de conexión al resetear', 'error');
    }
}

/**
 * Exporta las configuraciones a CSV
 */
async function exportarConfiguraciones() {
    try {
        mostrarLoading('Generando archivo CSV...');
        
        const response = await realizarPeticion(`${API_URL}/api/configuracion/listar`, 'GET');
        
        ocultarLoading();

        if (response.success && response.data) {
            let csv = 'ID,Categoría,Subcategoría,Parámetro,Valor,Unidad,Descripción,Editable,Fecha Actualización\n';
            
            response.data.forEach(config => {
                const descripcion = (config.descripcion || '').replace(/"/g, '""');
                const fecha = formatearFecha(config.fecha_actualizacion);
                const editable = config.editable === 1 ? 'Sí' : 'No';
                
                csv += `${config.id_config},"${config.categoria}","${config.subcategoria}","${config.nombre_parametro}",${config.valor},"${config.unidad || ''}","${descripcion}","${editable}","${fecha}"\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            const fecha = new Date().toISOString().slice(0,10);
            link.setAttribute('href', url);
            link.setAttribute('download', `configuraciones_${fecha}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            mostrarToast('Configuraciones exportadas exitosamente', 'success');
        }
    } catch (error) {
        ocultarLoading();
        console.error('Error:', error);
        mostrarToast('Error al exportar configuraciones', 'error');
    }
}

/**
 * Ver historial de una configuración específica
 */
async function verHistorialConfiguracion(id) {
    try {
        mostrarLoading('Cargando historial...');
        
        const response = await realizarPeticion(
            `${API_URL}/api/configuracion/historial?id_config=${id}&limit=20`,
            'GET'
        );
        
        ocultarLoading();

        if (response.success && response.data) {
            const contenedor = document.getElementById('contenedorHistorialItem');
            
            if (response.data.length === 0) {
                contenedor.innerHTML = `
                    <div style="text-align: center; padding: 30px; color: #999;">
                        <i class="fas fa-history" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                        <p>No hay historial para esta configuración</p>
                    </div>
                `;
            } else {
                contenedor.innerHTML = `
                    <div class="timeline">
                        ${response.data.map(item => `
                            <div class="timeline-item" style="border-left: 3px solid #f093fb; padding-left: 20px; margin-bottom: 20px; position: relative;">
                                <div style="position: absolute; left: -8px; top: 0; width: 12px; height: 12px; border-radius: 50%; background: #f093fb;"></div>
                                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                                    <strong style="color: #f093fb;">${item.campo_modificado}</strong>
                                    <div style="margin: 10px 0; font-size: 14px;">
                                        <span style="color: #f44336; text-decoration: line-through;">${item.valor_anterior || 'N/A'}</span>
                                        <i class="fas fa-arrow-right" style="margin: 0 10px; color: #999;"></i>
                                        <span style="color: #4caf50; font-weight: 600;">${item.valor_nuevo}</span>
                                    </div>
                                    <small style="color: #666;">
                                        <i class="fas fa-user"></i> ${item.usuario || 'Sistema'} • 
                                        <i class="fas fa-clock"></i> ${formatearFecha(item.fecha_cambio)}
                                    </small>
                                    ${item.motivo ? `<div style="margin-top: 8px; font-style: italic; color: #666; font-size: 13px;">"${item.motivo}"</div>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
            
            document.getElementById('tituloModalHistorialItem').textContent = 'Historial de la Configuración';
            abrirModal('modalHistorialItem');
        }
    } catch (error) {
        ocultarLoading();
        console.error('Error:', error);
        mostrarToast('Error al cargar historial', 'error');
    }
}

console.log('✓ Módulo de Gestión de Configuración cargado');