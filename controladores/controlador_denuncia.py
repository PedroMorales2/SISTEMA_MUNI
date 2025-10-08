from utils.database import obtenerconexion as obtener_conexion

def registrar_denuncia(ubicacion, descripcion, nivel_incidencia, estado, fecha, hora, id_tipo_incidencia, id_usuario, id_denuncia):
    conexion = obtener_conexion()
    cursor = conexion.cursor()

    # Insertamos la emergencia en la tabla incidencia
    sql = """INSERT INTO incidencia (ubicacion, descripcion, nivel_incidencia, estado, fecha, hora, id_tipo_incidencia, id_usuario, id_denuncia)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)"""
    cursor.execute(sql, (ubicacion, descripcion, nivel_incidencia, estado, fecha, hora, id_tipo_incidencia, id_usuario, id_denuncia))
    id_denuncias = cursor.lastrowid

    # Hacemos un solo commit después de insertar la emergencia
    conexion.commit()

    # Cerramos la conexión
    cursor.close()
    conexion.close()

    # Retornamos el último ID de la emergencia
    return id_denuncias



def registrar_foto(id_denuncia, foto):
    conexion = obtener_conexion()
    cursor = conexion.cursor()

    # Inserta la foto
    sql = """INSERT INTO foto (id_incidencia, ubicacion_foto) VALUES (%s, %s)"""
    cursor.execute(sql, (id_denuncia, foto))
    conexion.commit()  # Realizamos commit una vez después de la inserción inicial

    # Cerramos la conexión
    cursor.close()
    conexion.close()

def registrar_audio(id_denuncia, audio):
    conexion = obtener_conexion()
    cursor = conexion.cursor()

    # Inserta el audio
    sql = """INSERT INTO audio (id_incidencia, ubicacion_audio) VALUES (%s, %s)"""
    cursor.execute(sql, (id_denuncia, audio))
    conexion.commit()  # Realizamos commit una vez después de la inserción inicial

    # Cerramos la conexión
    cursor.close()
    conexion.close()












def registrar_video(id_denuncia, video):
    conexion = obtener_conexion()
    cursor = conexion.cursor()

    # Inserta el video
    sql = """INSERT INTO video (id_incidencia, ubicacion_video) VALUES (%s, %s)"""
    cursor.execute(sql, (id_denuncia, video))
    conexion.commit()  # Realizamos commit una vez después de la inserción inicial

    # Cerramos la conexión
    cursor.close()
    conexion.close()




def obtener_correo_denuncia(id):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT co.correo, co.nombre_area FROM denuncia_correo dc
                INNER JOIN denuncia de ON de.id_denuncia = dc.id_denuncia
                INNER JOIN correo_institucional co ON co.id_correo = dc.id_correo
                WHERE dc.estado = 1 AND de.id_denuncia = %s"""
    cursor.execute(sql, (id,))
    datos = cursor.fetchall()
    cursor.close()
    conexion.close()
    return datos






