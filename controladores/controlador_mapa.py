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
            WHERE inc.id_tipo_incidencia = 3 AND inc.estado = 1;
        """
        cursor.execute(sql)
        resultados = cursor.fetchall()

        # ESTO ES CRÍTICO: Convertir tuplas a diccionarios
        data = []
        for row in resultados:
            id_incidencia = row['id_incidencia']
            ubicacion = row['ubicacion']
            nivel = row['nivel_incidencia']
            fecha_hora = row['fecha_hora']
            descripcion = row['descripcion']

            latitud, longitud = None, None
            if ubicacion:
                try:
                    coords = ubicacion.strip().split(",")
                    if len(coords) == 2:
                        latitud = float(coords[0].strip())
                        longitud = float(coords[1].strip())
                    else:
                        raise ValueError(f"Ubicacion inválida: {ubicacion}")
                except Exception as e:
                    print(f"Error parsing ubicacion '{ubicacion}': {e}")
                    latitud = -6.865187
                    longitud = -79.818437
            else:
                latitud = -6.865187
                longitud = -79.818437

            data.append({
                'id_incidencia': id_incidencia,
                'latitud': latitud,
                'longitud': longitud,
                'nivel_incidencia': nivel,
                'fecha_hora': fecha_hora,
                'descripcion': descripcion or "Sin descripción"
            })


        return data

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
            WHERE inc.id_tipo_incidencia = 4 AND inc.estado = 1;
        """
        cursor.execute(sql)
        resultados = cursor.fetchall()

        data = []
        for row in resultados:
            id_incidencia = row['id_incidencia']
            ubicacion = row['ubicacion']
            nivel = row['nivel_incidencia']
            fecha_hora = row['fecha_hora']
            descripcion = row['descripcion']
                
            try:
                coords = ubicacion.replace(" ", "").split(",")
                latitud = float(coords[0])
                longitud = float(coords[1])
            except:
                latitud = -6.865187
                longitud = -79.818437
            
            data.append({
                'id_incidencia': id_incidencia,
                'latitud': latitud,
                'longitud': longitud,
                'nivel_incidencia': nivel,
                'fecha_hora': fecha_hora,
                'descripcion': descripcion or "Sin descripción"
            })

        return data

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