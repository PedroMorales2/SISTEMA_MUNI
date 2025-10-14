// gestion_recursos.js - Gestión del inventario de recursos

// Verificar si las variables ya existen
if (typeof recursosData === 'undefined') {
    var recursosData = [];
}
if (typeof recursosFiltrados === 'undefined') {
    var recursosFiltrados = [];
}

// Resto del código...
/**
 * Carga todos los recursos desde el servidor
 */
async function cargarRecursos() {
    try {
        mostrarLoading('Cargando recursos...');
        
        const response = await realizarPeticion(`${API_URL}/api/recursos/listar`, 'GET');
        
        ocultarLoading();

        if (response.success && response.data) {
            recursosData = response.data;
            recursosFiltrados = [...recursosData];
            mostrarTablaRecursos(recursosFiltrados);
            
            // Actualizar badge
            document.getElementById('badgeTotalRecursos').textContent = 
                `${response.total} recurso${response.total !== 1 ? 's' : ''}`;
            
            console.log(`✓ ${response.total} recursos cargados`);
        } else {
            mostrarToast('Error al cargar recursos', 'error');
        }
    } catch (error) {
        ocultarLoading();
        console.error('Error cargando recursos:', error);
        mostrarToast('Error de conexión al cargar recursos', 'error');
        mostrarTablaRecursos([]);
    }
}

/**
 * Muestra los recursos en la tabla
 */
function mostrarTablaRecursos(recursos) {
    const tbody = document.getElementById('bodyTablaRecursos');
    
    if (!recursos || recursos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 50px; color: #999;">
                    <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p style="margin: 0;">No hay recursos registrados</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = recursos.map(recurso => {
        const icono = obtenerIconoRecurso(recurso.nombre);
        const nombreFormateado = formatearNombreRecurso(recurso.nombre);
        const descripcion = recurso.descripcion || '<em style="color: #999;">Sin descripción</em>';
        const fecha = formatearFecha(recurso.ultima_actualizacion);

        return `
            <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 15px; font-weight: 600;">${recurso.id_recursos_municipales}</td>
                <td style="padding: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 24px;">${icono}</span>
                        <div>
                            <strong style="display: block; font-size: 15px;">${nombreFormateado}</strong>
                            <small style="color: #666; font-size: 12px;">${recurso.nombre}</small>
                        </div>
                    </div>
                </td>
                <td style="padding: 15px; text-align: center;">
                    <span style="background: #e3f2fd; color: #1976d2; padding: 6px 16px; border-radius: 20px; font-weight: 600; font-size: 14px;">
                        ${formatearNumero(recurso.cantidad)}
                    </span>
                </td>
                <td style="padding: 15px; font-size: 13px;">${descripcion}</td>
                <td style="padding: 15px; font-size: 13px; color: #666;">${fecha}</td>
                <td style="padding: 15px; text-align: center;">
                    <button class="btn btn-sm btn-primary" onclick="editarRecurso(${recurso.id_recursos_municipales})" 
                            title="Editar recurso" style="margin-right: 5px;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-info" onclick="verHistorialRecurso(${recurso.id_recursos_municipales})" 
                            title="Ver historial">
                        <i class="fas fa-history"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="confirmarEliminarRecurso(${recurso.id_recursos_municipales}, '${recurso.nombre}')" 
                            title="Eliminar recurso" style="margin-left: 5px;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Filtra los recursos según el buscador
 */
function filtrarRecursos() {
    const busqueda = document.getElementById('buscarRecurso').value.toLowerCase().trim();
    
    if (!busqueda) {
        recursosFiltrados = [...recursosData];
    } else {
        recursosFiltrados = recursosData.filter(recurso => {
            const nombre = recurso.nombre.toLowerCase();
            const descripcion = (recurso.descripcion || '').toLowerCase();
            return nombre.includes(busqueda) || descripcion.includes(busqueda);
        });
    }
    
    mostrarTablaRecursos(recursosFiltrados);
}

/**
 * Muestra el modal para crear un nuevo recurso
 */
function mostrarModalNuevoRecurso() {
    document.getElementById('tituloModalRecurso').textContent = 'Agregar Nuevo Recurso';
    document.getElementById('idRecursoEdit').value = '';
    limpiarFormulario('formRecurso');
    
    // Habilitar edición del nombre
    document.getElementById('nombreRecurso').disabled = false;
    
    abrirModal('modalRecurso');
}

/**
 * Edita un recurso existente
 */
async function editarRecurso(id) {
    try {
        mostrarLoading('Cargando recurso...');
        
        const response = await realizarPeticion(`${API_URL}/api/recursos/obtener/${id}`, 'GET');
        
        ocultarLoading();

        if (response.success && response.data) {
            document.getElementById('tituloModalRecurso').textContent = 'Editar Recurso';
            document.getElementById('idRecursoEdit').value = response.data.id_recursos_municipales;
            document.getElementById('nombreRecurso').value = response.data.nombre;
            document.getElementById('cantidadRecurso').value = response.data.cantidad || 0;
            document.getElementById('descripcionRecurso').value = response.data.descripcion || '';
            
            // Deshabilitar edición del nombre
            document.getElementById('nombreRecurso').disabled = true;
            
            abrirModal('modalRecurso');
        } else {
            mostrarToast('Error al cargar el recurso', 'error');
        }
    } catch (error) {
        ocultarLoading();
        console.error('Error:', error);
        mostrarToast('Error de conexión', 'error');
    }
}

/**
 * Guarda un recurso (crear o actualizar)
 */
async function guardarRecurso() {
    if (!validarFormulario('formRecurso')) {
        mostrarToast('Por favor complete todos los campos requeridos', 'warning');
        return;
    }

    const id = document.getElementById('idRecursoEdit').value;
    const nombre = document.getElementById('nombreRecurso').value.trim();
    const cantidad = parseInt(document.getElementById('cantidadRecurso').value);
    const descripcion = document.getElementById('descripcionRecurso').value.trim();

    // Validaciones adicionales
    if (cantidad < 0) {
        mostrarToast('La cantidad no puede ser negativa', 'warning');
        return;
    }

    try {
        mostrarLoading('Guardando...');

        let url, method;
        const data = { nombre, cantidad, descripcion, usuario: 'admin' };

        if (id) {
            // Actualizar
            url = `${API_URL}/api/recursos/actualizar/${id}`;
            method = 'PUT';
        } else {
            // Crear
            url = `${API_URL}/api/recursos/crear`;
            method = 'POST';
        }

        const response = await realizarPeticion(url, method, data);
        
        ocultarLoading();

        if (response.success) {
            mostrarToast(response.message, 'success');
            cerrarModal('modalRecurso');
            cargarRecursos(); // Recargar la tabla
        } else {
            mostrarToast(response.error || 'Error al guardar el recurso', 'error');
        }
    } catch (error) {
        ocultarLoading();
        console.error('Error:', error);
        mostrarToast('Error de conexión al guardar', 'error');
    }
}

/**
 * Confirma la eliminación de un recurso
 */
function confirmarEliminarRecurso(id, nombre) {
    const nombreFormateado = formatearNombreRecurso(nombre);
    document.getElementById('mensajeConfirmacion').innerHTML = `
        ¿Está seguro de que desea eliminar el recurso <strong>"${nombreFormateado}"</strong>?
        <br><br>
        Esta acción eliminará permanentemente este registro del sistema.
    `;
    
    document.getElementById('btnConfirmarEliminacion').onclick = () => eliminarRecurso(id);
    
    abrirModal('modalConfirmacion');
}

/**
 * Elimina un recurso
 */
async function eliminarRecurso(id) {
    try {
        mostrarLoading('Eliminando...');

        const response = await realizarPeticion(
            `${API_URL}/api/recursos/eliminar/${id}?usuario=admin`, 
            'DELETE'
        );
        
        ocultarLoading();

        if (response.success) {
            mostrarToast(response.message, 'success');
            cerrarModal('modalConfirmacion');
            cargarRecursos(); // Recargar la tabla
        } else {
            mostrarToast(response.error || 'Error al eliminar el recurso', 'error');
        }
    } catch (error) {
        ocultarLoading();
        console.error('Error:', error);
        mostrarToast('Error de conexión al eliminar', 'error');
    }
}

/**
 * Muestra el modal de actualización masiva
 */
async function mostrarModalActualizacionMasiva() {
    try {
        mostrarLoading('Cargando recursos...');
        
        const response = await realizarPeticion(`${API_URL}/api/recursos/listar`, 'GET');
        
        ocultarLoading();

        if (response.success && response.data) {
            const contenedor = document.getElementById('contenedorActualizacionMasiva');
            
            contenedor.innerHTML = `
                <div style="max-height: 500px; overflow-y: auto;">
                    <table class="table table-striped">
                        <thead style="position: sticky; top: 0; background: white; z-index: 1;">
                            <tr>
                                <th style="width: 50%;">Recurso</th>
                                <th style="width: 50%;">Nueva Cantidad</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.data.map(recurso => {
                                const icono = obtenerIconoRecurso(recurso.nombre);
                                const nombreFormateado = formatearNombreRecurso(recurso.nombre);
                                
                                return `
                                    <tr>
                                        <td>
                                            <div style="display: flex; align-items: center; gap: 10px;">
                                                <span style="font-size: 20px;">${icono}</span>
                                                <div>
                                                    <strong>${nombreFormateado}</strong>
                                                    <br>
                                                    <small style="color: #666;">Actual: ${formatearNumero(recurso.cantidad)}</small>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <input type="number" 
                                                   class="form-control" 
                                                   id="cantidad_${recurso.nombre}" 
                                                   value="${recurso.cantidad}" 
                                                   min="0"
                                                   data-nombre="${recurso.nombre}"
                                                   style="max-width: 200px;">
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            
            abrirModal('modalActualizacionMasiva');
        }
    } catch (error) {
        ocultarLoading();
        console.error('Error:', error);
        mostrarToast('Error al cargar recursos', 'error');
    }
}

/**
 * Guarda la actualización masiva
 */
async function guardarActualizacionMasiva() {
    const inputs = document.querySelectorAll('#contenedorActualizacionMasiva input[type="number"]');
    const actualizaciones = [];
    
    inputs.forEach(input => {
        const nombre = input.dataset.nombre;
        const cantidad = parseInt(input.value);
        
        if (!isNaN(cantidad) && cantidad >= 0) {
            actualizaciones.push({ nombre, cantidad });
        }
    });
    
    if (actualizaciones.length === 0) {
        mostrarToast('No hay cambios para aplicar', 'warning');
        return;
    }
    
    try {
        mostrarLoading('Actualizando recursos...');
        
        const response = await realizarPeticion(
            `${API_URL}/api/recursos/actualizar-masivo`,
            'PUT',
            { recursos: actualizaciones, usuario: 'admin' }
        );
        
        ocultarLoading();
        
        if (response.success) {
            mostrarToast(response.message, 'success');
            cerrarModal('modalActualizacionMasiva');
            cargarRecursos();
        } else {
            mostrarToast(response.error || 'Error al actualizar recursos', 'error');
        }
    } catch (error) {
        ocultarLoading();
        console.error('Error:', error);
        mostrarToast('Error de conexión al actualizar', 'error');
    }
}

/**
 * Exporta los recursos a CSV
 */
async function exportarRecursos() {
    try {
        mostrarLoading('Generando archivo CSV...');
        
        const response = await realizarPeticion(`${API_URL}/api/recursos/listar`, 'GET');
        
        ocultarLoading();

        if (response.success && response.data) {
            let csv = 'ID,Nombre,Nombre Formateado,Cantidad,Descripción,Última Actualización\n';
            
            response.data.forEach(recurso => {
                const nombreFormateado = formatearNombreRecurso(recurso.nombre);
                const descripcion = (recurso.descripcion || '').replace(/"/g, '""');
                const fecha = formatearFecha(recurso.ultima_actualizacion);
                
                csv += `${recurso.id_recursos_municipales},"${recurso.nombre}","${nombreFormateado}",${recurso.cantidad || 0},"${descripcion}","${fecha}"\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            const fecha = new Date().toISOString().slice(0,10);
            link.setAttribute('href', url);
            link.setAttribute('download', `recursos_municipales_${fecha}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            mostrarToast('Recursos exportados exitosamente', 'success');
        }
    } catch (error) {
        ocultarLoading();
        console.error('Error:', error);
        mostrarToast('Error al exportar recursos', 'error');
    }
}

/**
 * Ver historial de un recurso específico
 */
async function verHistorialRecurso(id) {
    try {
        mostrarLoading('Cargando historial...');
        
        const response = await realizarPeticion(
            `${API_URL}/api/recursos/historial?id_recurso=${id}&limit=20`,
            'GET'
        );
        
        ocultarLoading();

        if (response.success && response.data) {
            const contenedor = document.getElementById('contenedorHistorialItem');
            
            if (response.data.length === 0) {
                contenedor.innerHTML = `
                    <div style="text-align: center; padding: 30px; color: #999;">
                        <i class="fas fa-history" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                        <p>No hay historial para este recurso</p>
                    </div>
                `;
            } else {
                contenedor.innerHTML = `
                    <div class="timeline">
                        ${response.data.map(item => `
                            <div class="timeline-item" style="border-left: 3px solid #2196f3; padding-left: 20px; margin-bottom: 20px; position: relative;">
                                <div style="position: absolute; left: -8px; top: 0; width: 12px; height: 12px; border-radius: 50%; background: #2196f3;"></div>
                                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                                    <strong style="color: #2196f3;">${item.campo_modificado}</strong>
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
            
            document.getElementById('tituloModalHistorialItem').textContent = 'Historial del Recurso';
            abrirModal('modalHistorialItem');
        }
    } catch (error) {
        ocultarLoading();
        console.error('Error:', error);
        mostrarToast('Error al cargar historial', 'error');
    }
}

console.log('✓ Módulo de Gestión de Recursos cargado');