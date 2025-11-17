// gestion_historial.js - Gestión del historial de cambios

// gestion_historial.js - Gestión del historial de cambios

// ❌ NO declarar aquí si ya existe
// let historialData = [];  // ELIMINAR ESTA LÍNEA

// ✅ Verificar si existe, si no, crear
if (typeof historialData === 'undefined') {
    var historialData = [];
}

if (typeof paginaActual === 'undefined') {
    var paginaActual = 1;
}

if (typeof registrosPorPagina === 'undefined') {
    const registrosPorPagina = 20;
}

// Resto del código...
/**
 * Carga el historial desde el servidor
 */
async function cargarHistorial() {
    console.log('🔍 Iniciando cargarHistorial()...');
    
    try {
        const tipo = document.getElementById('filtroTipoHistorial').value;
        const limite = document.getElementById('limiteHistorial').value;
        
        console.log('📊 Filtros:', { tipo, limite });
        
        mostrarLoading('Cargando historial...');
        
        let url = `${API_URL}/api/recursos/historial?limit=${limite}`;
        
        if (tipo) {
            if (tipo === 'CONFIGURACION') {
                url = `${API_URL}/api/configuracion/historial?limit=${limite}`;
            } else {
                url += `&tipo=${tipo}`;
            }
        }
        
        console.log('🌐 URL:', url);
        
        const response = await realizarPeticion(url, 'GET');
        
        console.log('📥 Respuesta del servidor:', response);
        
        ocultarLoading();

        if (response.success && response.data) {
            historialData = response.data;
            console.log('✅ Datos cargados:', historialData.length, 'registros');
            paginaActual = 1;
            mostrarTablaHistorial();
            generarPaginacion();
        } else {
            console.error('❌ Error en respuesta:', response);
            mostrarToast('Error al cargar historial', 'error');
            historialData = [];
            mostrarTablaHistorial();
        }
    } catch (error) {
        console.error('💥 Error en cargarHistorial():', error);
        ocultarLoading();
        mostrarToast('Error de conexión al cargar historial', 'error');
        historialData = [];
        mostrarTablaHistorial();
    }
}

/**
 * Muestra el historial en la tabla con paginación
 */
function mostrarTablaHistorial() {
    const tbody = document.getElementById('bodyTablaHistorial');
    
    console.log('🎨 Mostrando tabla con', historialData?.length || 0, 'registros');
    
    if (!historialData || historialData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 50px; color: #999;">
                    <i class="fas fa-history" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p style="margin: 0;">No hay registros en el historial</p>
                </td>
            </tr>
        `;
        return;
    }

    // Calcular registros para la página actual
    const inicio = (paginaActual - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;
    const registrosPagina = historialData.slice(inicio, fin);

    console.log('📄 Mostrando página', paginaActual, '- Registros:', registrosPagina.length);

    tbody.innerHTML = registrosPagina.map(item => {
        // ✅ SOLUCIÓN: Verificar si existe tipo_registro, si no, usar "RECURSO" por defecto
        const tipoRegistro = item.tipo_registro || 'RECURSO';
        
        const tipoBadge = tipoRegistro === 'RECURSO' 
            ? '<span class="badge bg-primary">RECURSO</span>'
            : '<span class="badge bg-info">CONFIGURACIÓN</span>';
        
        const valorAnterior = item.valor_anterior 
            ? `<span style="color: #f44336; text-decoration: line-through;">${truncarTexto(item.valor_anterior, 30)}</span>`
            : '<em style="color: #999;">N/A</em>';
        
        const valorNuevo = item.valor_nuevo === 'ELIMINADO'
            ? '<span style="color: #f44336; font-weight: 600;">ELIMINADO</span>'
            : `<span style="color: #4caf50; font-weight: 600;">${truncarTexto(item.valor_nuevo || 'N/A', 30)}</span>`;

        return `
            <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 12px; font-weight: 600;">${item.id_historial}</td>
                <td style="padding: 12px;">${tipoBadge}</td>
                <td style="padding: 12px; text-align: center;">${item.id_registro}</td>
                <td style="padding: 12px;">
                    <span style="background: #f0f0f0; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                        ${item.campo_modificado}
                    </span>
                </td>
                <td style="padding: 12px; font-size: 13px;">${valorAnterior}</td>
                <td style="padding: 12px; font-size: 13px;">${valorNuevo}</td>
                <td style="padding: 12px; font-size: 13px;">
                    <i class="fas fa-user" style="color: #666; margin-right: 5px;"></i>
                    ${item.usuario || '<em style="color: #999;">Sistema</em>'}
                </td>
                <td style="padding: 12px; font-size: 13px;">
                    ${item.motivo ? truncarTexto(item.motivo, 50) : '<em style="color: #999;">Sin motivo</em>'}
                </td>
                <td style="padding: 12px; font-size: 13px; color: #666;">
                    ${formatearFecha(item.fecha_cambio)}
                </td>
            </tr>
        `;
    }).join('');
    
    console.log('✅ Tabla actualizada correctamente');
}

/**
 * Trunca un texto a un número máximo de caracteres
 */
function truncarTexto(texto, maxLength) {
    if (!texto) return '';
    if (texto.length <= maxLength) return texto;
    return texto.substring(0, maxLength) + '...';
}

/**
 * Genera la paginación
 */
function generarPaginacion() {
    const totalPaginas = Math.ceil(historialData.length / registrosPorPagina);
    const contenedor = document.getElementById('paginacionHistorial');
    
    if (totalPaginas <= 1) {
        contenedor.innerHTML = '';
        return;
    }

    let html = '<nav><ul class="pagination">';
    
    // Botón anterior
    html += `
        <li class="page-item ${paginaActual === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="cambiarPagina(${paginaActual - 1}); return false;">
                <i class="fas fa-chevron-left"></i>
            </a>
        </li>
    `;
    
    // Páginas
    for (let i = 1; i <= totalPaginas; i++) {
        // Mostrar solo páginas cercanas a la actual
        if (i === 1 || i === totalPaginas || (i >= paginaActual - 2 && i <= paginaActual + 2)) {
            html += `
                <li class="page-item ${i === paginaActual ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="cambiarPagina(${i}); return false;">${i}</a>
                </li>
            `;
        } else if (i === paginaActual - 3 || i === paginaActual + 3) {
            html += '<li class="page-item disabled"><a class="page-link">...</a></li>';
        }
    }
    
    // Botón siguiente
    html += `
        <li class="page-item ${paginaActual === totalPaginas ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="cambiarPagina(${paginaActual + 1}); return false;">
                <i class="fas fa-chevron-right"></i>
            </a>
        </li>
    `;
    
    html += '</ul></nav>';
    contenedor.innerHTML = html;
}

/**
 * Cambia la página del historial
 */
function cambiarPagina(nuevaPagina) {
    const totalPaginas = Math.ceil(historialData.length / registrosPorPagina);
    
    if (nuevaPagina < 1 || nuevaPagina > totalPaginas) return;
    
    paginaActual = nuevaPagina;
    mostrarTablaHistorial();
    generarPaginacion();
    
    // Scroll al inicio de la tabla
    document.getElementById('tablaHistorial').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Exporta el historial a CSV
 */
async function exportarHistorial() {
    try {
        if (historialData.length === 0) {
            mostrarToast('No hay datos para exportar', 'warning');
            return;
        }

        mostrarLoading('Generando archivo CSV...');
        
        let csv = 'ID,Tipo,ID Registro,Campo,Valor Anterior,Valor Nuevo,Usuario,Motivo,Fecha\n';
        
        historialData.forEach(item => {
            const motivo = (item.motivo || '').replace(/"/g, '""');
            const valorAnterior = (item.valor_anterior || 'N/A').replace(/"/g, '""');
            const valorNuevo = item.valor_nuevo.replace(/"/g, '""');
            const fecha = formatearFecha(item.fecha_cambio);
            
            csv += `${item.id_historial},"${item.tipo_registro}",${item.id_registro},"${item.campo_modificado}","${valorAnterior}","${valorNuevo}","${item.usuario || 'Sistema'}","${motivo}","${fecha}"\n`;
        });

        ocultarLoading();

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const fecha = new Date().toISOString().slice(0,10);
        link.setAttribute('href', url);
        link.setAttribute('download', `historial_cambios_${fecha}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        mostrarToast('Historial exportado exitosamente', 'success');
    } catch (error) {
        ocultarLoading();
        console.error('Error:', error);
        mostrarToast('Error al exportar historial', 'error');
    }
}

console.log('✓ Módulo de Gestión de Historial cargado');