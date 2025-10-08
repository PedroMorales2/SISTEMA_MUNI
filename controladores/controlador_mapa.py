from utils.database import obtenerconexion as obtenerconexion

def obtener_denuncias_pendientes():
    conexion = None
    cursor = None
    try:
        conexion = obtenerconexion()
        cursor = conexion.cursor()

        sql = """
            SELECT
                inc.id_incidencia,
                inc.ubicacion,
                CASE
                    WHEN inc.nivel_incidencia = 'A' THEN 'Alto'
                    WHEN inc.nivel_incidencia = 'B' THEN 'Medio'
                    WHEN inc.nivel_incidencia = 'C' THEN 'Bajo'
                    ELSE 'Desconocido'
                END AS nivel_incidencia,
                CONCAT(inc.fecha, ' ', inc.hora) AS fecha_hora,
                inc.descripcion
            FROM incidencia inc
            WHERE inc.id_tipo_incidencia = 3;


        """
        cursor.execute(sql)
        resultados = cursor.fetchall()

        # data = []
        # for ubicacion, nivel, fecha_hora, descripcion in resultados:
        #     data.append({
        #         'ubicacion': ubicacion,
        #         'nivel_incidencia': nivel,
        #         'fecha': fecha_hora,
        #         'descripcion': descripcion
        #     })

        return resultados

    except Exception as e:
        raise Exception(f"Database error: {str(e)}")

    finally:
        if cursor:
            cursor.close()
        if conexion:
            conexion.close()



def obtener_emergencias_pendientes():
    conexion = None
    cursor = None
    try:
        conexion = obtenerconexion()
        cursor = conexion.cursor()

        sql = """
            SELECT
                inc.id_incidencia,
                inc.ubicacion,
                CASE
				        WHEN inc.nivel_incidencia = '3' THEN 'Alto'
				        WHEN inc.nivel_incidencia = 'A' THEN 'Alto'
				        WHEN inc.nivel_incidencia = '2' THEN 'Medio'
				        WHEN inc.nivel_incidencia = '1' THEN 'Bajo'
				        ELSE 'Desconocido'
				    END AS nivel_incidencia,
                CONCAT(inc.fecha, ' ', inc.hora) AS fecha_hora,
                eme.nombre_emergencia AS descripcion
            FROM incidencia inc
            INNER JOIN emergencia eme ON eme.id_numero_emergencia = inc.id_numero_emergencia
            WHERE inc.id_tipo_incidencia = 4;

        """
        cursor.execute(sql)
        resultados = cursor.fetchall()

        # data = []
        # for ubicacion, nivel, fecha_hora, descripcion in resultados:
        #     data.append({
        #         'ubicacion': ubicacion,
        #         'nivel_incidencia': nivel,
        #         'fecha': fecha_hora,
        #         'descripcion': descripcion
        #     })

        return resultados

    except Exception as e:
        raise Exception(f"Database error: {str(e)}")

    finally:
        if cursor:
            cursor.close()
        if conexion:
            conexion.close()



def obtener_fotos_por_denuncia(id_denuncia):
    conexion = None
    cursor = None
    try:
        conexion = obtenerconexion()
        cursor = conexion.cursor()

        sql = """
            SELECT ubicacion_foto
            FROM foto
            WHERE id_incidencia = %s;
        """
        cursor.execute(sql, (id_denuncia,))
        resultados = cursor.fetchall()
        return resultados
    except Exception as e:
        raise Exception(f"Database error: {str(e)}")

    finally:
        if cursor:
            cursor.close()
        if conexion:
            conexion.close()



def obtener_x_mes_denuncia_emergencia(id_usuario):
    conexion = obtenerconexion()
    cursor = conexion.cursor()

    sql_denuncias = """
        SELECT COUNT(*) as denuncia FROM incidencia inc
        WHERE inc.id_usuario = %s
          AND inc.fecha >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
          AND inc.id_tipo_incidencia = 3;
    """

    sql_emergencias = """
        SELECT COUNT(*) as emergencia FROM incidencia inc
        WHERE inc.id_usuario = %s
          AND inc.fecha >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
          AND inc.id_tipo_incidencia = 4;
    """

    try:
        cursor.execute(sql_denuncias, (id_usuario,))
        denuncias = cursor.fetchone()['denuncia']  # obtener el valor entero del COUNT(*)

        cursor.execute(sql_emergencias, (id_usuario,))
        emergencias = cursor.fetchone()['emergencia']  # obtener el valor entero del COUNT(*)

        return {
            "denuncias": denuncias,
            "emergencias": emergencias
        }

    except Exception as e:
        print("Error al obtener datos:", e)
        return None

    finally:
        cursor.close()
        conexion.close()