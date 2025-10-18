"""
controladores/controlador_emergencia.py
Controlador para gestión de emergencias
"""
from utils.database import obtenerconexion as obtener_conexion


def registrar_emergencia(ubicacion, descripcion, nivel_incidencia, estado, fecha, hora, 
                        id_tipo_incidencia, id_usuario, id_numero_emergencia, ruta_audio=None):
    """Registra una nueva emergencia (sin audio inicialmente)"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()

    try:
        # Insertamos la emergencia en la tabla incidencia
        sql_incidencia = """INSERT INTO incidencia 
                (ubicacion, descripcion, nivel_incidencia, estado, fecha, hora, 
                 id_tipo_incidencia, id_usuario, id_numero_emergencia) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)"""
        
        cursor.execute(sql_incidencia, (ubicacion, descripcion, nivel_incidencia, estado, 
                                        fecha, hora, id_tipo_incidencia, id_usuario, 
                                        id_numero_emergencia))
        
        id_emergencia = cursor.lastrowid

        # Hacemos commit
        conexion.commit()

        cursor.close()
        conexion.close()

        return id_emergencia
        
    except Exception as e:
        conexion.rollback()
        cursor.close()
        conexion.close()
        print(f"Error al registrar emergencia: {str(e)}")
        return None


def registrar_audio(ubicacion_audio, id_incidencia):
    """Registra el audio asociado a una incidencia"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()

    try:
        sql_audio = """INSERT INTO audio (ubicacion_audio, id_incidencia) 
                      VALUES (%s, %s)"""
        cursor.execute(sql_audio, (ubicacion_audio, id_incidencia))
        
        conexion.commit()
        
        cursor.close()
        conexion.close()
        
        return True
        
    except Exception as e:
        conexion.rollback()
        cursor.close()
        conexion.close()
        print(f"Error al registrar audio: {str(e)}")
        return False


def obtener_emergencias_por_usuario_pendiente(id_usuario):
    """Obtiene emergencias pendientes de un usuario con su audio"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT i.id_incidencia, i.ubicacion, i.descripcion, i.nivel_incidencia,
            i.estado, i.fecha, i.hora, a.ubicacion_audio, a.id_audio
            FROM incidencia i
            INNER JOIN tipo_incidencia ti ON ti.id_tipo_incidencia = i.id_tipo_incidencia
            LEFT JOIN audio a ON a.id_incidencia = i.id_incidencia
            WHERE i.id_usuario = %s AND i.estado = 1"""
    cursor.execute(sql, (id_usuario,))
    emergencias = cursor.fetchall()
    cursor.close()
    conexion.close()
    return emergencias


def obtener_emergencias_por_usuario_resuelto(id_usuario):
    """Obtiene emergencias resueltas de un usuario con su audio"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT i.id_incidencia, i.ubicacion, i.descripcion, i.nivel_incidencia,
            i.estado, i.fecha, i.hora, a.ubicacion_audio, a.id_audio
            FROM incidencia i
            INNER JOIN tipo_incidencia ti ON ti.id_tipo_incidencia = i.id_tipo_incidencia
            LEFT JOIN audio a ON a.id_incidencia = i.id_incidencia
            WHERE i.id_usuario = %s AND i.estado = 2"""
    cursor.execute(sql, (id_usuario,))
    emergencias = cursor.fetchall()
    cursor.close()
    conexion.close()
    return emergencias


def obtener_audio_por_incidencia(id_incidencia):
    """Obtiene el audio asociado a una incidencia específica"""
    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor()
        
        sql = "SELECT id_audio, ubicacion_audio FROM audio WHERE id_incidencia = %s"
        cursor.execute(sql, (id_incidencia,))
        
        resultado = cursor.fetchone()
        
        cursor.close()
        conexion.close()
        
        return resultado if resultado else None
        
    except Exception as e:
        print(f"Error al obtener audio: {str(e)}")
        return None


def obtener_ruta_audio(id_audio):
    """Obtiene la ruta del audio por su ID"""
    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor()
        
        sql = "SELECT ubicacion_audio FROM audio WHERE id_audio = %s"
        cursor.execute(sql, (id_audio,))
        
        resultado = cursor.fetchone()
        
        cursor.close()
        conexion.close()
        
        return resultado['ubicacion_audio'] if resultado else None
        
    except Exception as e:
        print(f"Error al obtener ruta de audio: {str(e)}")
        return None


def listar_todas_emergencias():
    """Lista todas las emergencias del sistema con sus audios"""
    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor()
        
        sql = """
            SELECT i.id_incidencia, i.ubicacion, i.descripcion, i.nivel_incidencia,
                   i.estado, i.fecha, i.hora,
                   u.nombres, u.apellidos,
                   n.nombre as nombre_emergencia,
                   ti.nombre as tipo_incidencia,
                   a.id_audio, a.ubicacion_audio
            FROM incidencia i
            LEFT JOIN usuario u ON i.id_usuario = u.id_usuario
            LEFT JOIN numero_emergencia n ON i.id_numero_emergencia = n.id_numero_emergencia
            LEFT JOIN tipo_incidencia ti ON i.id_tipo_incidencia = ti.id_tipo_incidencia
            LEFT JOIN audio a ON a.id_incidencia = i.id_incidencia
            WHERE i.id_tipo_incidencia = 1
            ORDER BY i.fecha DESC, i.hora DESC
        """
        
        cursor.execute(sql)
        emergencias = cursor.fetchall()
        
        cursor.close()
        conexion.close()
        
        return emergencias
        
    except Exception as e:
        print(f"Error al listar emergencias: {str(e)}")
        return []


def eliminar_audio(id_audio):
    """Elimina un registro de audio de la base de datos"""
    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor()
        
        sql = "DELETE FROM audio WHERE id_audio = %s"
        cursor.execute(sql, (id_audio,))
        
        conexion.commit()
        
        cursor.close()
        conexion.close()
        
        return True
        
    except Exception as e:
        print(f"Error al eliminar audio: {str(e)}")
        return False