# controladores/controlador_configuracion.py
from utils.database import obtenerconexion as obtener_conexion
from controladores.controlador_recursos import registrar_cambio_historial

# ============================================================================
# CRUD DE CONFIGURACIONES
# ============================================================================

def obtener_todas_configuraciones():
    """Obtiene todas las configuraciones de ratios"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT id_config, categoria, subcategoria, nombre_parametro, 
             valor, descripcion, unidad, editable, fecha_actualizacion 
             FROM configuracion_ratios 
             ORDER BY categoria, subcategoria, nombre_parametro"""
    cursor.execute(sql)
    configuraciones = cursor.fetchall()
    cursor.close()
    conexion.close()
    return configuraciones


def obtener_configuracion_por_id(id_config):
    """Obtiene una configuración específica por ID"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT id_config, categoria, subcategoria, nombre_parametro, 
             valor, descripcion, unidad, editable, fecha_actualizacion 
             FROM configuracion_ratios 
             WHERE id_config = %s"""
    cursor.execute(sql, (id_config,))
    config = cursor.fetchone()
    cursor.close()
    conexion.close()
    return config


def obtener_configuracion_por_parametro(categoria, subcategoria, nombre_parametro):
    """Obtiene una configuración específica por sus parámetros"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT id_config, categoria, subcategoria, nombre_parametro, 
             valor, descripcion, unidad, editable, fecha_actualizacion 
             FROM configuracion_ratios 
             WHERE categoria = %s AND subcategoria = %s AND nombre_parametro = %s"""
    cursor.execute(sql, (categoria, subcategoria, nombre_parametro))
    config = cursor.fetchone()
    cursor.close()
    conexion.close()
    return config


def obtener_configuraciones_por_categoria(categoria):
    """Obtiene todas las configuraciones de una categoría"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT id_config, categoria, subcategoria, nombre_parametro, 
             valor, descripcion, unidad, editable, fecha_actualizacion 
             FROM configuracion_ratios 
             WHERE categoria = %s
             ORDER BY subcategoria, nombre_parametro"""
    cursor.execute(sql, (categoria,))
    configs = cursor.fetchall()
    cursor.close()
    conexion.close()
    return configs


def crear_configuracion(categoria, subcategoria, nombre_parametro, valor, 
                        descripcion=None, unidad=None, editable=1, usuario=None):
    """Crea una nueva configuración"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """INSERT INTO configuracion_ratios 
             (categoria, subcategoria, nombre_parametro, valor, descripcion, unidad, editable) 
             VALUES (%s, %s, %s, %s, %s, %s, %s)"""
    cursor.execute(sql, (categoria, subcategoria, nombre_parametro, valor, 
                         descripcion, unidad, editable))
    conexion.commit()
    id_nuevo = cursor.lastrowid
    
    # Registrar en historial
    registrar_cambio_historial(
        'CONFIGURACION', id_nuevo, 'creacion', None, 
        f'valor={valor}', usuario, 'Creación de nueva configuración'
    )
    
    cursor.close()
    conexion.close()
    return id_nuevo


def actualizar_configuracion(id_config, valor=None, descripcion=None, 
                             unidad=None, editable=None, usuario=None):
    """Actualiza una configuración existente"""
    # Obtener valores actuales para historial
    config_actual = obtener_configuracion_por_id(id_config)
    if not config_actual:
        return False
    
    # Verificar si es editable
    if config_actual['editable'] == 0 and valor is not None:
        print(f"Advertencia: Configuración {id_config} marcada como no editable")
    
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    
    campos = []
    valores = []
    
    if valor is not None:
        campos.append("valor = %s")
        valores.append(valor)
        if float(valor) != float(config_actual['valor']):
            registrar_cambio_historial(
                'CONFIGURACION', id_config, 'valor',
                str(config_actual['valor']), str(valor), 
                usuario, 'Actualización de valor'
            )
    
    if descripcion is not None:
        campos.append("descripcion = %s")
        valores.append(descripcion)
    
    if unidad is not None:
        campos.append("unidad = %s")
        valores.append(unidad)
    
    if editable is not None:
        campos.append("editable = %s")
        valores.append(editable)
    
    if not campos:
        cursor.close()
        conexion.close()
        return False
    
    valores.append(id_config)
    sql = f"UPDATE configuracion_ratios SET {', '.join(campos)} WHERE id_config = %s"
    
    cursor.execute(sql, tuple(valores))
    conexion.commit()
    filas_afectadas = cursor.rowcount
    cursor.close()
    conexion.close()
    
    return filas_afectadas > 0


def eliminar_configuracion(id_config, usuario=None):
    """Elimina una configuración"""
    config = obtener_configuracion_por_id(id_config)
    if not config:
        return False
    
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    
    # Registrar en historial antes de eliminar
    registrar_cambio_historial(
        'CONFIGURACION', id_config, 'eliminacion',
        f"{config['categoria']}.{config['nombre_parametro']} = {config['valor']}",
        'ELIMINADO', usuario, 'Eliminación de configuración'
    )
    
    sql = "DELETE FROM configuracion_ratios WHERE id_config = %s"
    cursor.execute(sql, (id_config,))
    conexion.commit()
    filas_afectadas = cursor.rowcount
    cursor.close()
    conexion.close()
    return filas_afectadas > 0


def actualizar_configuracion_masiva(actualizaciones, usuario=None):
    """
    Actualiza múltiples configuraciones a la vez
    actualizaciones: lista de dicts {'id_config': 1, 'valor': 15}
    """
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    
    sql_select = "SELECT valor FROM configuracion_ratios WHERE id_config = %s"
    sql_update = "UPDATE configuracion_ratios SET valor = %s WHERE id_config = %s"
    
    try:
        for item in actualizaciones:
            id_config = item['id_config']
            valor_nuevo = item['valor']
            
            # Obtener valor anterior
            cursor.execute(sql_select, (id_config,))
            resultado = cursor.fetchone()
            
            if resultado:
                valor_anterior = resultado['valor']
                
                # Actualizar
                cursor.execute(sql_update, (valor_nuevo, id_config))
                
                # Registrar en historial si cambió
                if float(valor_anterior) != float(valor_nuevo):
                    registrar_cambio_historial(
                        'CONFIGURACION', id_config, 'valor',
                        str(valor_anterior), str(valor_nuevo),
                        usuario, 'Actualización masiva'
                    )
        
        conexion.commit()
        cursor.close()
        conexion.close()
        return True
    except Exception as e:
        conexion.rollback()
        cursor.close()
        conexion.close()
        print(f"Error en actualización masiva: {e}")
        return False


# ============================================================================
# FUNCIONES ESPECIALES PARA FRONTEND
# ============================================================================

def obtener_ratios_para_javascript():
    """
    Obtiene todos los ratios en formato compatible con JavaScript
    Retorna estructura similar a RATIOS_OPERATIVOS
    """
    configuraciones = obtener_todas_configuraciones()
    
    ratios = {}
    
    for config in configuraciones:
        categoria = config['categoria']
        parametro = config['nombre_parametro']
        valor = float(config['valor'])
        
        if categoria not in ratios:
            ratios[categoria] = {}
        
        ratios[categoria][parametro] = valor
    
    return ratios


def obtener_configuraciones_agrupadas():
    """Obtiene configuraciones agrupadas por categoría y subcategoría"""
    configuraciones = obtener_todas_configuraciones()
    
    agrupado = {}
    
    for config in configuraciones:
        categoria = config['categoria']
        subcategoria = config['subcategoria']
        
        if categoria not in agrupado:
            agrupado[categoria] = {}
        
        if subcategoria not in agrupado[categoria]:
            agrupado[categoria][subcategoria] = []
        
        agrupado[categoria][subcategoria].append(config)
    
    return agrupado


def resetear_configuraciones_default(usuario=None):
    """Resetea todas las configuraciones a valores por defecto"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    
    try:
        # Registrar en historial
        registrar_cambio_historial(
            'CONFIGURACION', 0, 'reset_general', 
            'configuraciones_personalizadas', 'valores_default',
            usuario, 'Reset completo de configuraciones'
        )
        
        # Eliminar todas
        cursor.execute("DELETE FROM configuracion_ratios")
        
        # Insertar valores por defecto
        sql = """INSERT INTO configuracion_ratios 
                 (categoria, subcategoria, nombre_parametro, valor, descripcion, unidad, editable) 
                 VALUES (%s, %s, %s, %s, %s, %s, %s)"""
        
        datos_default = [
            # SERENO
            ('SERENO', 'CAPACIDAD', 'llamadas_mes', 15.00, 'Número de llamadas de emergencia que puede atender un sereno al mes', 'llamadas/mes', 1),
            ('SERENO', 'CAPACIDAD', 'casos_mes', 8.00, 'Número de casos de denuncia que puede gestionar un sereno al mes', 'casos/mes', 1),
            
            # POLICIA
            ('POLICIA', 'CAPACIDAD', 'llamadas_mes', 20.00, 'Número de llamadas de emergencia que puede atender un policía al mes', 'llamadas/mes', 1),
            ('POLICIA', 'CAPACIDAD', 'casos_mes', 12.00, 'Número de casos administrativos que puede gestionar un policía al mes', 'casos/mes', 1),
            
            # BOMBERO
            ('BOMBERO', 'CAPACIDAD', 'llamadas_mes', 30.00, 'Número de llamadas que puede atender un bombero al mes', 'llamadas/mes', 1),
            ('BOMBERO', 'CAPACIDAD', 'casos_mes', 5.00, 'Número de casos de prevención que puede gestionar un bombero al mes', 'casos/mes', 1),
            
            # AMBULANCIA
            ('AMBULANCIA', 'CAPACIDAD', 'llamadas_mes', 25.00, 'Número de llamadas médicas que puede atender una ambulancia al mes', 'llamadas/mes', 1),
            ('AMBULANCIA', 'OPERACION', 'turnos_dia', 3.00, 'Número de turnos diarios de 8 horas por ambulancia', 'turnos/día', 1),
            
            # VEHICULOS
            ('VEHICULO_SERENAZGO', 'CAPACIDAD', 'llamadas_mes', 50.00, 'Número de llamadas que puede cubrir un vehículo de serenazgo al mes', 'llamadas/mes', 1),
            ('VEHICULO_SERENAZGO', 'MANTENIMIENTO', 'vida_util_meses', 120.00, 'Vida útil promedio de un vehículo de serenazgo', 'meses', 1),
            ('VEHICULO_POLICIA', 'CAPACIDAD', 'llamadas_mes', 60.00, 'Número de llamadas que puede cubrir una patrulla policial al mes', 'llamadas/mes', 1),
            ('VEHICULO_POLICIA', 'MANTENIMIENTO', 'vida_util_meses', 120.00, 'Vida útil promedio de una patrulla policial', 'meses', 1),
            ('VEHICULO_BOMBEROS', 'CAPACIDAD', 'llamadas_mes', 40.00, 'Número de emergencias que puede atender un camión de bomberos al mes', 'llamadas/mes', 1),
            ('VEHICULO_BOMBEROS', 'MANTENIMIENTO', 'vida_util_meses', 180.00, 'Vida útil promedio de un vehículo de bomberos', 'meses', 1),
            
            # PRESUPUESTO
            ('PRESUPUESTO', 'OPERATIVO', 'costo_caso', 50.00, 'Costo operativo promedio por caso atendido', 'soles/caso', 1),
            ('PRESUPUESTO', 'OPERATIVO', 'overhead', 1.15, 'Factor de overhead operativo (15%)', 'multiplicador', 1),
            ('PRESUPUESTO', 'SALARIOS', 'salario_sereno_mensual', 1500.00, 'Salario mensual promedio de un sereno', 'soles/mes', 1),
            ('PRESUPUESTO', 'SALARIOS', 'salario_policia_mensual', 2500.00, 'Salario mensual promedio de un policía', 'soles/mes', 1),
            ('PRESUPUESTO', 'SALARIOS', 'salario_bombero_mensual', 2200.00, 'Salario mensual promedio de un bombero', 'soles/mes', 1),
            ('PRESUPUESTO', 'VEHICULOS', 'costo_vehiculo_serenazgo', 80000.00, 'Costo de adquisición de un vehículo de serenazgo', 'soles', 1),
            ('PRESUPUESTO', 'VEHICULOS', 'costo_vehiculo_policia', 120000.00, 'Costo de adquisición de una patrulla policial', 'soles', 1),
            ('PRESUPUESTO', 'VEHICULOS', 'costo_vehiculo_bomberos', 500000.00, 'Costo de adquisición de un camión de bomberos', 'soles', 1),
            ('PRESUPUESTO', 'VEHICULOS', 'costo_ambulancia', 150000.00, 'Costo de adquisición de una ambulancia equipada', 'soles', 1),
            ('PRESUPUESTO', 'MANTENIMIENTO', 'costo_vehiculo_mes', 800.00, 'Costo promedio de mantenimiento vehicular mensual', 'soles/mes', 1),
            ('PRESUPUESTO', 'MANTENIMIENTO', 'costo_combustible_mes', 500.00, 'Costo promedio de combustible por vehículo al mes', 'soles/mes', 1),
            
            # TIEMPO
            ('TIEMPO', 'LABORAL', 'horas_caso', 2.00, 'Horas-hombre promedio necesarias por caso', 'horas/caso', 1),
            ('TIEMPO', 'LABORAL', 'dias_laborables_mes', 22.00, 'Número de días laborables al mes', 'días/mes', 1),
            ('TIEMPO', 'LABORAL', 'horas_turno', 8.00, 'Horas por turno de trabajo', 'horas/turno', 1),
            ('TIEMPO', 'RESPUESTA', 'tiempo_critico_minutos', 5.00, 'Tiempo máximo de respuesta para emergencias críticas', 'minutos', 1),
            ('TIEMPO', 'RESPUESTA', 'tiempo_urgente_minutos', 15.00, 'Tiempo máximo de respuesta para urgencias', 'minutos', 1),
            ('TIEMPO', 'RESPUESTA', 'tiempo_regular_minutos', 60.00, 'Tiempo máximo de respuesta para casos regulares', 'minutos', 1),
            
            # INFRAESTRUCTURA
            ('INFRAESTRUCTURA', 'COMISARIA', 'personal_maximo', 15.00, 'Capacidad máxima de personal por comisaría', 'personas', 1),
            ('INFRAESTRUCTURA', 'ESTACION_BOMBEROS', 'personal_maximo', 20.00, 'Capacidad máxima de personal por estación de bomberos', 'personas', 1),
            ('INFRAESTRUCTURA', 'CENTRO_SALUD', 'personal_maximo', 10.00, 'Capacidad máxima de personal por centro de salud', 'personas', 1)
        ]
        
        cursor.executemany(sql, datos_default)
        conexion.commit()
        cursor.close()
        conexion.close()
        return True
    except Exception as e:
        conexion.rollback()
        cursor.close()
        conexion.close()
        print(f"Error reseteando configuraciones: {e}")
        return False


def obtener_estadisticas_configuracion():
    """Obtiene estadísticas de las configuraciones"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    
    sql = """
    SELECT 
        categoria,
        COUNT(*) as total_parametros,
        SUM(CASE WHEN editable = 1 THEN 1 ELSE 0 END) as editables,
        SUM(CASE WHEN editable = 0 THEN 1 ELSE 0 END) as no_editables
    FROM configuracion_ratios
    GROUP BY categoria
    ORDER BY categoria
    """
    
    cursor.execute(sql)
    stats = cursor.fetchall()
    cursor.close()
    conexion.close()
    return stats