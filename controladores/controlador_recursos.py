# controladores/controlador_recursos.py
from utils.database import obtenerconexion as obtener_conexion
from datetime import datetime

# ============================================================================
# CRUD DE RECURSOS MUNICIPALES
# ============================================================================

def obtener_todos_recursos():
    """Obtiene todos los recursos del municipio"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT id_recursos_municipales, nombre, cantidad, descripcion, 
             ultima_actualizacion 
             FROM recursos_municipales 
             ORDER BY nombre ASC"""
    cursor.execute(sql)
    recursos = cursor.fetchall()
    cursor.close()
    conexion.close()
    return recursos


def obtener_recurso_por_id(id_recurso):
    """Obtiene un recurso específico por ID"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT id_recursos_municipales, nombre, cantidad, descripcion, 
             ultima_actualizacion 
             FROM recursos_municipales 
             WHERE id_recursos_municipales = %s"""
    cursor.execute(sql, (id_recurso,))
    recurso = cursor.fetchone()
    cursor.close()
    conexion.close()
    return recurso


def obtener_recurso_por_nombre(nombre):
    """Obtiene un recurso específico por nombre"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT id_recursos_municipales, nombre, cantidad, descripcion, 
             ultima_actualizacion 
             FROM recursos_municipales 
             WHERE nombre = %s"""
    cursor.execute(sql, (nombre,))
    recurso = cursor.fetchone()
    cursor.close()
    conexion.close()
    return recurso


def crear_recurso(nombre, cantidad, descripcion=None, usuario=None):
    """Crea un nuevo recurso"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """INSERT INTO recursos_municipales (nombre, cantidad, descripcion) 
             VALUES (%s, %s, %s)"""
    cursor.execute(sql, (nombre, cantidad, descripcion))
    conexion.commit()
    id_nuevo = cursor.lastrowid
    
    # Registrar en historial
    registrar_cambio_historial(
        'RECURSO', id_nuevo, 'creacion', None, 
        f'cantidad={cantidad}', usuario, 'Creación de nuevo recurso'
    )
    
    cursor.close()
    conexion.close()
    return id_nuevo


def actualizar_recurso(id_recurso, nombre=None, cantidad=None, descripcion=None, usuario=None):
    """Actualiza un recurso existente"""
    # Obtener valores actuales para historial
    recurso_actual = obtener_recurso_por_id(id_recurso)
    if not recurso_actual:
        return False
    
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    
    campos = []
    valores = []
    
    if nombre is not None:
        campos.append("nombre = %s")
        valores.append(nombre)
        if nombre != recurso_actual['nombre']:
            registrar_cambio_historial(
                'RECURSO', id_recurso, 'nombre', 
                recurso_actual['nombre'], nombre, usuario, 'Cambio de nombre'
            )
    
    if cantidad is not None:
        campos.append("cantidad = %s")
        valores.append(cantidad)
        if cantidad != recurso_actual['cantidad']:
            registrar_cambio_historial(
                'RECURSO', id_recurso, 'cantidad', 
                str(recurso_actual['cantidad']), str(cantidad), usuario, 'Actualización de cantidad'
            )
    
    if descripcion is not None:
        campos.append("descripcion = %s")
        valores.append(descripcion)
    
    if not campos:
        cursor.close()
        conexion.close()
        return False
    
    valores.append(id_recurso)
    sql = f"UPDATE recursos_municipales SET {', '.join(campos)} WHERE id_recursos_municipales = %s"
    
    cursor.execute(sql, tuple(valores))
    conexion.commit()
    filas_afectadas = cursor.rowcount
    cursor.close()
    conexion.close()
    
    return filas_afectadas > 0


def eliminar_recurso(id_recurso, usuario=None):
    """Elimina un recurso"""
    recurso = obtener_recurso_por_id(id_recurso)
    if not recurso:
        return False
    
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    
    # Registrar en historial antes de eliminar
    registrar_cambio_historial(
        'RECURSO', id_recurso, 'eliminacion', 
        f"{recurso['nombre']} (cantidad: {recurso['cantidad']})", 
        'ELIMINADO', usuario, 'Eliminación de recurso'
    )
    
    sql = "DELETE FROM recursos_municipales WHERE id_recursos_municipales = %s"
    cursor.execute(sql, (id_recurso,))
    conexion.commit()
    filas_afectadas = cursor.rowcount
    cursor.close()
    conexion.close()
    return filas_afectadas > 0


def obtener_inventario_completo():
    """Obtiene el inventario en formato estructurado para el frontend"""
    recursos = obtener_todos_recursos()
    
    inventario = {}
    
    for recurso in recursos:
        nombre = recurso['nombre']
        cantidad = recurso['cantidad'] if recurso['cantidad'] is not None else 0
        inventario[nombre] = cantidad
    
    return inventario


def actualizar_cantidad_masiva(actualizaciones, usuario=None):
    """
    Actualiza múltiples recursos a la vez
    actualizaciones: lista de dicts {'nombre': 'serenos', 'cantidad': 150}
    """
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    
    sql_select = "SELECT cantidad FROM recursos_municipales WHERE nombre = %s"
    sql_update = "UPDATE recursos_municipales SET cantidad = %s WHERE nombre = %s"
    
    try:
        for item in actualizaciones:
            nombre = item['nombre']
            cantidad_nueva = item['cantidad']
            
            # Obtener cantidad anterior
            cursor.execute(sql_select, (nombre,))
            resultado = cursor.fetchone()
            
            if resultado:
                cantidad_anterior = resultado['cantidad']
                
                # Actualizar
                cursor.execute(sql_update, (cantidad_nueva, nombre))
                
                # Registrar en historial
                if cantidad_anterior != cantidad_nueva:
                    cursor.execute(
                        "SELECT id_recursos_municipales FROM recursos_municipales WHERE nombre = %s",
                        (nombre,)
                    )
                    id_recurso = cursor.fetchone()['id_recursos_municipales']
                    
                    registrar_cambio_historial(
                        'RECURSO', id_recurso, 'cantidad',
                        str(cantidad_anterior), str(cantidad_nueva),
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


def obtener_estadisticas_recursos():
    """Obtiene estadísticas generales de recursos"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    
    sql = """
    SELECT 
        COUNT(*) as total_tipos,
        SUM(cantidad) as total_recursos,
        AVG(cantidad) as promedio_cantidad,
        MAX(cantidad) as maximo,
        MIN(cantidad) as minimo
    FROM recursos_municipales
    WHERE cantidad IS NOT NULL
    """
    
    cursor.execute(sql)
    stats = cursor.fetchone()
    cursor.close()
    conexion.close()
    return stats


# ============================================================================
# HISTORIAL DE CAMBIOS
# ============================================================================

def registrar_cambio_historial(tipo_registro, id_registro, campo, valor_anterior, 
                                valor_nuevo, usuario=None, motivo=None):
    """Registra un cambio en el historial"""
    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor()
        
        sql = """INSERT INTO historial_cambios 
                 (tipo_registro, id_registro, campo_modificado, valor_anterior, 
                  valor_nuevo, usuario, motivo) 
                 VALUES (%s, %s, %s, %s, %s, %s, %s)"""
        
        cursor.execute(sql, (tipo_registro, id_registro, campo, valor_anterior, 
                             valor_nuevo, usuario, motivo))
        conexion.commit()
        cursor.close()
        conexion.close()
        return True
    except Exception as e:
        print(f"Error registrando historial: {e}")
        return False


def obtener_historial(tipo_registro=None, id_registro=None, limit=50):
    """Obtiene el historial de cambios"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    
    sql = """SELECT id_historial, tipo_registro, id_registro, campo_modificado,
             valor_anterior, valor_nuevo, usuario, motivo, fecha_cambio
             FROM historial_cambios"""
    
    condiciones = []
    valores = []
    
    if tipo_registro:
        condiciones.append("tipo_registro = %s")
        valores.append(tipo_registro)
    
    if id_registro:
        condiciones.append("id_registro = %s")
        valores.append(id_registro)
    
    if condiciones:
        sql += " WHERE " + " AND ".join(condiciones)
    
    sql += " ORDER BY fecha_cambio DESC LIMIT %s"
    valores.append(limit)
    
    cursor.execute(sql, tuple(valores))
    historial = cursor.fetchall()
    cursor.close()
    conexion.close()
    return historial


def obtener_historial_recurso(id_recurso, limit=20):
    """Obtiene el historial de un recurso específico"""
    return obtener_historial('RECURSO', id_recurso, limit)


def obtener_historial_configuracion(id_config, limit=20):
    """Obtiene el historial de una configuración específica"""
    return obtener_historial('CONFIGURACION', id_config, limit)