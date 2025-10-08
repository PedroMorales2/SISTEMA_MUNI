from utils.database import obtenerconexion as obtener_conexion

def registrar_emergencia(ubicacion, descripcion, nivel_incidencia, estado, fecha, hora, id_tipo_incidencia, id_usuario, id_numero_emergencia):
    conexion = obtener_conexion()
    cursor = conexion.cursor()

    # Insertamos la emergencia en la tabla incidencia
    sql = """INSERT INTO incidencia (ubicacion, descripcion, nivel_incidencia, estado, fecha, hora, id_tipo_incidencia, id_usuario, id_numero_emergencia) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)"""
    cursor.execute(sql, (ubicacion, descripcion, nivel_incidencia, estado, fecha, hora, id_tipo_incidencia, id_usuario, id_numero_emergencia))
    id_emergencia = cursor.lastrowid

    # Hacemos un solo commit después de insertar la emergencia
    conexion.commit()

    # Cerramos la conexión
    cursor.close()
    conexion.close()

    # Retornamos el último ID de la emergencia
    return id_emergencia

def obtener_emergencias_por_usuario_pendiente(id_usuario):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT i.ubicacion,i.descripcion,i.nivel_incidencia,
            i.estado, i.fecha, i.hora
            FROM incidencia i
            INNER JOIN tipo_incidencia ti ON ti.id_tipo_incidencia = i.id_tipo_incidencia
            WHERE i.id_usuario = %s AND i.estado = 1"""
    cursor.execute(sql, (id_usuario,))
    emergencias = cursor.fetchall()
    cursor.close()
    conexion.close()
    return emergencias

def obtener_emergencias_por_usuario_resuelto(id_usuario):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT i.ubicacion,i.descripcion,i.nivel_incidencia,
            i.estado, i.fecha, i.hora
            FROM incidencia i
            INNER JOIN tipo_incidencia ti ON ti.id_tipo_incidencia = i.id_tipo_incidencia
            WHERE i.id_usuario = %s AND i.estado = 2"""
    cursor.execute(sql, (id_usuario,))
    emergencias = cursor.fetchall()
    cursor.close()
    conexion.close()
    return emergencias

