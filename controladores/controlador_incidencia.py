from utils.database import obtenerconexion as obtener_conexion

def obtener_denuncias_por_usuario_pendiente(id_usuario,ic_incidencia):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT i.ubicacion,i.descripcion,i.nivel_incidencia,
            i.estado, i.fecha, i.hora, i.id_incidencia AS id
            FROM incidencia i
            INNER JOIN tipo_incidencia ti ON ti.id_tipo_incidencia = i.id_tipo_incidencia
            WHERE i.id_usuario = %s AND i.estado = 1 AND i.id_tipo_incidencia = %s"""
    cursor.execute(sql, (id_usuario,ic_incidencia))
    denuncias = cursor.fetchall()
    cursor.close()
    conexion.close()
    return denuncias

def obtener_denuncias_por_usuario_pendiente_dos(id_usuario, ic_incidencia):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT i.ubicacion,eme.nombre_emergencia AS descripcion,i.nivel_incidencia,
            i.estado, i.fecha, i.hora, i.id_incidencia AS id
            FROM incidencia i
            INNER JOIN tipo_incidencia ti ON ti.id_tipo_incidencia = i.id_tipo_incidencia
            INNER JOIN emergencia eme ON eme.id_numero_emergencia = i.id_numero_emergencia
            WHERE i.id_usuario = %s AND i.estado = 1 AND i.id_tipo_incidencia = %s"""
    cursor.execute(sql, (id_usuario,ic_incidencia))
    denuncias = cursor.fetchall()
    cursor.close()
    conexion.close()
    return denuncias


def obtener_denuncias_por_usuario_resuelto(id_usuario, ic_incidencia):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT i.ubicacion,i.descripcion,i.nivel_incidencia,
            i.estado, i.fecha, i.hora, i.id_incidencia AS id
            FROM incidencia i
            INNER JOIN tipo_incidencia ti ON ti.id_tipo_incidencia = i.id_tipo_incidencia
            WHERE i.id_usuario = %s AND (i.estado = 2 OR i.estado = 3) AND i.id_tipo_incidencia = %s"""
    cursor.execute(sql, (id_usuario,ic_incidencia))
    denuncias = cursor.fetchall()
    cursor.close()
    conexion.close()
    return denuncias



def obtener_denuncias_por_usuario_resuelto_dos(id_usuario, ic_incidencia):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT i.ubicacion,eme.nombre_emergencia AS descripcion,i.nivel_incidencia,
            i.estado, i.fecha, i.hora, i.id_incidencia AS id
            FROM incidencia i
            INNER JOIN tipo_incidencia ti ON ti.id_tipo_incidencia = i.id_tipo_incidencia
            INNER JOIN emergencia eme ON eme.id_numero_emergencia = i.id_numero_emergencia
            WHERE i.id_usuario = %s AND (i.estado = 2 OR i.estado = 3) AND i.id_tipo_incidencia = %s"""
    cursor.execute(sql, (id_usuario,ic_incidencia))
    denuncias = cursor.fetchall()
    cursor.close()
    conexion.close()
    return denuncias
