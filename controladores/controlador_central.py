from utils.database import obtenerconexion as obtener_conexion
import datetime
from flask import session

def obtener_denuncias_pendientes_central(id_correo):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT inci.id_incidencia, de.nombre AS denuncia,
               CONCAT(pes.nombre, ' ', pes.apellidos) AS persona,
               tip.nombre AS tipo_incidencia,
               inci.ubicacion,
               inci.descripcion,
               inci.nivel_incidencia,
               inci.estado,
               inci.fecha,
               inci.hora
        FROM incidencia inci
        INNER JOIN tipo_incidencia tip ON tip.id_tipo_incidencia = inci.id_tipo_incidencia
        INNER JOIN usuario us ON us.id_usuario = inci.id_usuario
        INNER JOIN persona pes ON us.id_persona = pes.id_persona
        INNER JOIN denuncia de ON de.id_denuncia = inci.id_denuncia
        INNER JOIN denuncia_correo den ON den.id_denuncia = de.id_denuncia
        WHERE tip.id_tipo_incidencia = 3 AND inci.estado = '1' AND den.id_correo = %s;
    """
    cursor.execute(sql, (id_correo,))
    denuncias = cursor.fetchall()

    # Convertir fecha/hora a string si es necesario
    for denuncia in denuncias:
        for key in ['fecha', 'hora']:
            if key in denuncia and isinstance(denuncia[key], (datetime.date, datetime.time, datetime.timedelta)):
                denuncia[key] = str(denuncia[key])

    cursor.close()
    conexion.close()
    return denuncias




def obtener_denuncias_aceptadas_central(id):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT inci.id_incidencia, de.nombre AS denuncia,
               CONCAT(pes.nombre, ' ', pes.apellidos) AS persona,
               tip.nombre AS tipo_incidencia,
               inci.ubicacion,
               inci.descripcion,
               inci.nivel_incidencia,
               inci.estado,
               inci.fecha,
               inci.hora
        FROM incidencia inci
        INNER JOIN tipo_incidencia tip ON tip.id_tipo_incidencia = inci.id_tipo_incidencia
        INNER JOIN usuario us ON us.id_usuario = inci.id_usuario
        INNER JOIN persona pes ON us.id_persona = pes.id_persona
        INNER JOIN denuncia de ON de.id_denuncia = inci.id_denuncia
        INNER JOIN denuncia_correo den ON den.id_denuncia = de.id_denuncia
        WHERE tip.id_tipo_incidencia = 3 AND inci.estado = '2' AND den.id_correo = %s;
    """
    cursor.execute(sql,(id,))
    denuncias = cursor.fetchall()  # ✅ esto será una lista de tuplas
    for denuncia in denuncias:
        for key in ['fecha', 'hora']:
            if key in denuncia and isinstance(denuncia[key], (datetime.date, datetime.time, datetime.timedelta)):
                denuncia[key] = str(denuncia[key])
    cursor.close()
    conexion.close()
    return denuncias

def obtener_denuncias_rechazadas_central(id):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT inci.id_incidencia, de.nombre AS denuncia,
               CONCAT(pes.nombre, ' ', pes.apellidos) AS persona,
               tip.nombre AS tipo_incidencia,
               inci.ubicacion,
               inci.descripcion,
               inci.nivel_incidencia,
               inci.estado,
               inci.fecha,
               inci.hora
        FROM incidencia inci
        INNER JOIN tipo_incidencia tip ON tip.id_tipo_incidencia = inci.id_tipo_incidencia
        INNER JOIN usuario us ON us.id_usuario = inci.id_usuario
        INNER JOIN persona pes ON us.id_persona = pes.id_persona
        INNER JOIN denuncia de ON de.id_denuncia = inci.id_denuncia
        INNER JOIN denuncia_correo den ON den.id_denuncia = de.id_denuncia
        WHERE tip.id_tipo_incidencia = 3 AND inci.estado = '3' AND den.id_correo = %s;
    """
    cursor.execute(sql,(id,))
    denuncias = cursor.fetchall()  # ✅ esto será una lista de tuplas
    for denuncia in denuncias:
        for key in ['fecha', 'hora']:
            if key in denuncia and isinstance(denuncia[key], (datetime.date, datetime.time, datetime.timedelta)):
                denuncia[key] = str(denuncia[key])
    cursor.close()
    conexion.close()
    return denuncias


def obtener_emergencias_pendientes_central(id):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT inci.id_incidencia, em.nombre_emergencia,CONCAT(pes.nombre,' ',pes.apellidos) as persona,tip.nombre,
        inci.ubicacion, inci.descripcion,
        inci.nivel_incidencia, inci.estado,
        inci.fecha, inci.hora
        FROM incidencia inci
        INNER JOIN tipo_incidencia tip ON tip.id_tipo_incidencia = inci.id_tipo_incidencia
        INNER JOIN usuario us ON us.id_usuario = inci.id_usuario
        INNER JOIN persona pes ON us.id_persona = pes.id_persona
        INNER JOIN emergencia em ON em.id_numero_emergencia = inci.id_numero_emergencia
        INNER JOIN emergencia_correo emer ON emer.id_numero_emergencia = em.id_numero_emergencia
        INNER JOIN correo_institucional cor ON cor.id_correo = emer.id_correo
        WHERE tip.id_tipo_incidencia = 4 and inci.estado = '1' AND cor.id_correo = %s;
    """
    cursor.execute(sql,(id,))
    denuncias = cursor.fetchall()  # ✅ esto será una lista de tuplas
    for denuncia in denuncias:
        for key in ['fecha', 'hora']:
            if key in denuncia and isinstance(denuncia[key], (datetime.date, datetime.time, datetime.timedelta)):
                denuncia[key] = str(denuncia[key])
    cursor.close()
    conexion.close()
    return denuncias

def obtener_emergencias_aceptadas_central(id):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT inci.id_incidencia, em.nombre_emergencia,CONCAT(pes.nombre,' ',pes.apellidos) as persona,tip.nombre,
        inci.ubicacion, inci.descripcion,
        inci.nivel_incidencia, inci.estado,
        inci.fecha, inci.hora
        FROM incidencia inci
        INNER JOIN tipo_incidencia tip ON tip.id_tipo_incidencia = inci.id_tipo_incidencia
        INNER JOIN usuario us ON us.id_usuario = inci.id_usuario
        INNER JOIN persona pes ON us.id_persona = pes.id_persona
        INNER JOIN emergencia em ON em.id_numero_emergencia = inci.id_numero_emergencia
        INNER JOIN emergencia_correo emer ON emer.id_numero_emergencia = em.id_numero_emergencia
        INNER JOIN correo_institucional cor ON cor.id_correo = emer.id_correo
        WHERE tip.id_tipo_incidencia = 4 and inci.estado = '2' AND cor.id_correo = %s;
    """
    cursor.execute(sql,(id,))
    denuncias = cursor.fetchall()  # ✅ esto será una lista de tuplas
    for denuncia in denuncias:
        for key in ['fecha', 'hora']:
            if key in denuncia and isinstance(denuncia[key], (datetime.date, datetime.time, datetime.timedelta)):
                denuncia[key] = str(denuncia[key])
    cursor.close()
    conexion.close()
    return denuncias


def obtener_emergencias_rechazadas_central(id):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT inci.id_incidencia, em.nombre_emergencia,CONCAT(pes.nombre,' ',pes.apellidos) as persona,tip.nombre,
        inci.ubicacion, inci.descripcion,
        inci.nivel_incidencia, inci.estado,
        inci.fecha, inci.hora
        FROM incidencia inci
        INNER JOIN tipo_incidencia tip ON tip.id_tipo_incidencia = inci.id_tipo_incidencia
        INNER JOIN usuario us ON us.id_usuario = inci.id_usuario
        INNER JOIN persona pes ON us.id_persona = pes.id_persona
        INNER JOIN emergencia em ON em.id_numero_emergencia = inci.id_numero_emergencia
        INNER JOIN emergencia_correo emer ON emer.id_numero_emergencia = em.id_numero_emergencia
        INNER JOIN correo_institucional cor ON cor.id_correo = emer.id_correo
        WHERE tip.id_tipo_incidencia = 4 and inci.estado = '3' AND cor.id_correo = %s;
    """
    cursor.execute(sql,(id,))
    denuncias = cursor.fetchall()  # ✅ esto será una lista de tuplas
    for denuncia in denuncias:
        for key in ['fecha', 'hora']:
            if key in denuncia and isinstance(denuncia[key], (datetime.date, datetime.time, datetime.timedelta)):
                denuncia[key] = str(denuncia[key])
    cursor.close()
    conexion.close()
    return denuncias

def obtener_riesgos_pendientes_central():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT
        inci.id_incidencia, de.nombre,CONCAT(pes.nombre,' ',pes.apellidos) as persona,tip.nombre as tipo,
        inci.ubicacion, inci.descripcion,
        inci.nivel_incidencia, inci.estado,
        inci.fecha, inci.hora
        FROM incidencia inci
        INNER JOIN tipo_incidencia tip ON tip.id_tipo_incidencia = inci.id_tipo_incidencia
        INNER JOIN usuario us ON us.id_usuario = inci.id_usuario
        INNER JOIN persona pes ON us.id_persona = pes.id_persona
        INNER JOIN denuncia de ON de.id_denuncia = inci.id_denuncia
        WHERE tip.id_tipo_incidencia = 4 and inci.estado = '1';
    """
    cursor.execute(sql)
    denuncias = cursor.fetchall()  # ✅ esto será una lista de tuplas
    for denuncia in denuncias:
        for key in ['fecha', 'hora']:
            if key in denuncia and isinstance(denuncia[key], (datetime.date, datetime.time, datetime.timedelta)):
                denuncia[key] = str(denuncia[key])
    cursor.close()
    conexion.close()
    return denuncias

def obtener_riesgos_aceptadas_central():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT
        inci.id_incidencia, de.nombre,CONCAT(pes.nombre,' ',pes.apellidos) as persona,tip.nombre as tipo,
        inci.ubicacion, inci.descripcion,
        inci.nivel_incidencia, inci.estado,
        inci.fecha, inci.hora
        FROM incidencia inci
        INNER JOIN tipo_incidencia tip ON tip.id_tipo_incidencia = inci.id_tipo_incidencia
        INNER JOIN usuario us ON us.id_usuario = inci.id_usuario
        INNER JOIN persona pes ON us.id_persona = pes.id_persona
        INNER JOIN denuncia de ON de.id_denuncia = inci.id_denuncia
        WHERE tip.id_tipo_incidencia = 4 and inci.estado = '2';
    """
    cursor.execute(sql)
    denuncias = cursor.fetchall()  # ✅ esto será una lista de tuplas
    for denuncia in denuncias:
        for key in ['fecha', 'hora']:
            if key in denuncia and isinstance(denuncia[key], (datetime.date, datetime.time, datetime.timedelta)):
                denuncia[key] = str(denuncia[key])
    cursor.close()
    conexion.close()
    return denuncias

def obtener_riesgos_rechazadas_central():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT
        inci.id_incidencia, de.nombre,CONCAT(pes.nombre,' ',pes.apellidos) as persona,tip.nombre as tipo,
        inci.ubicacion, inci.descripcion,
        inci.nivel_incidencia, inci.estado,
        inci.fecha, inci.hora
        FROM incidencia inci
        INNER JOIN tipo_incidencia tip ON tip.id_tipo_incidencia = inci.id_tipo_incidencia
        INNER JOIN usuario us ON us.id_usuario = inci.id_usuario
        INNER JOIN persona pes ON us.id_persona = pes.id_persona
        INNER JOIN denuncia de ON de.id_denuncia = inci.id_denuncia
        WHERE tip.id_tipo_incidencia = 4 and inci.estado = '3';
    """
    cursor.execute(sql)
    denuncias = cursor.fetchall()  # ✅ esto será una lista de tuplas
    for denuncia in denuncias:
        for key in ['fecha', 'hora']:
            if key in denuncia and isinstance(denuncia[key], (datetime.date, datetime.time, datetime.timedelta)):
                denuncia[key] = str(denuncia[key])
    cursor.close()
    conexion.close()
    return denuncias


def obtener_denuncias_por_id(id):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT
            inci.id_incidencia, de.nombre AS denuncia_nombre,
            CONCAT(pes.nombre, ' ', pes.apellidos) AS nombre_completo,
            tip.nombre AS tipo_incidencia,
            inci.ubicacion,
            inci.descripcion,
            inci.nivel_incidencia,
            inci.estado,
            inci.fecha,
            inci.hora,
            pes.numero_celular
        FROM incidencia inci
        INNER JOIN tipo_incidencia tip ON tip.id_tipo_incidencia = inci.id_tipo_incidencia
        INNER JOIN usuario us ON us.id_usuario = inci.id_usuario
        INNER JOIN persona pes ON us.id_persona = pes.id_persona
        INNER JOIN denuncia de ON de.id_denuncia = inci.id_denuncia
        WHERE tip.id_tipo_incidencia = 3 AND inci.id_incidencia = %s;
    """
    cursor.execute(sql, (id,))
    denuncia = cursor.fetchone()

    # Convertir fecha/hora a string si existen
    if denuncia:
        if isinstance(denuncia.get('fecha'), (datetime.date, datetime.datetime)):
            denuncia['fecha'] = str(denuncia['fecha'])
        if isinstance(denuncia.get('hora'), (datetime.time, datetime.timedelta)):
            denuncia['hora'] = str(denuncia['hora'])

    cursor.close()
    conexion.close()
    return denuncia


def obtener_riesgo_por_id(id):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT
            inci.id_incidencia, de.nombre AS denuncia_nombre,
            CONCAT(pes.nombre, ' ', pes.apellidos) AS nombre_completo,
            tip.nombre AS tipo_incidencia,
            inci.ubicacion,
            inci.descripcion,
            inci.nivel_incidencia,
            inci.estado,
            inci.fecha,
            inci.hora,
            pes.numero_celular
        FROM incidencia inci
        INNER JOIN tipo_incidencia tip ON tip.id_tipo_incidencia = inci.id_tipo_incidencia
        INNER JOIN usuario us ON us.id_usuario = inci.id_usuario
        INNER JOIN persona pes ON us.id_persona = pes.id_persona
        INNER JOIN denuncia de ON de.id_denuncia = inci.id_denuncia
        WHERE tip.id_tipo_incidencia = 4 AND inci.id_incidencia = %s;
    """
    cursor.execute(sql, (id,))
    denuncia = cursor.fetchone()

    # Convertir fecha/hora a string si existen
    if denuncia:
        if isinstance(denuncia.get('fecha'), (datetime.date, datetime.datetime)):
            denuncia['fecha'] = str(denuncia['fecha'])
        if isinstance(denuncia.get('hora'), (datetime.time, datetime.timedelta)):
            denuncia['hora'] = str(denuncia['hora'])

    cursor.close()
    conexion.close()
    return denuncia


def aceptar_denuncia(id_incidencia):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        UPDATE incidencia
        SET estado = '2'
        WHERE id_incidencia = %s;
    """
    cursor.execute(sql, (id_incidencia,))
    conexion.commit()
    cursor.close()
    conexion.close()
    return True

def rechazar_denuncia(id_incidencia):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        UPDATE incidencia
        SET estado = '3'
        WHERE id_incidencia = %s;
    """
    cursor.execute(sql, (id_incidencia,))
    conexion.commit()
    cursor.close()
    conexion.close()
    return True

def insertar_descripcion(id_incidencia, descripcion, archivo_adjunto):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        INSERT INTO motivo_incidencia(descripcion, archivo_adjunto, id_incidencia, fecha_aceptacion, id_correo)
        VALUES (%s, %s, %s, %s, %s);
    """
    # Convertir cadena vacía a None si es necesario
    if archivo_adjunto == '':
        archivo_adjunto = None

    cursor.execute(sql, (descripcion, archivo_adjunto, id_incidencia, datetime.date.today(), session['id_usuario'])) 
    conexion.commit()
    cursor.close()
    conexion.close()
    return True



# BASE_URL = "https://munireque.pythonanywhere.com/"

def obtener_fotos(id):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "SELECT ubicacion_foto FROM foto WHERE id_incidencia = %s;"
    cursor.execute(sql, (id,))
    fotos = cursor.fetchall()
    cursor.close()
    conexion.close()
    return [fila['ubicacion_foto'] for fila in fotos]

def obtener_videos(id):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "SELECT ubicacion_video FROM video WHERE id_incidencia = %s;"
    cursor.execute(sql, (id,))
    videos = cursor.fetchall()
    cursor.close()
    conexion.close()
    return [fila['ubicacion_video'] for fila in videos]

def obtener_audio(id):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "SELECT ubicacion_audio FROM audio WHERE id_incidencia = %s;"
    cursor.execute(sql, (id,))
    audios = cursor.fetchall()
    cursor.close()
    conexion.close()
    return [fila['ubicacion_audio'] for fila in audios]


def iniciar_sesion(usuario, contraseña):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "SELECT nombre_area, id_correo FROM correo_institucional WHERE correo = %s AND contra = %s"
    cursor.execute(sql, (usuario, contraseña))
    usuario = cursor.fetchone()
    cursor.close()
    conexion.close()
    return usuario


def consultar_correo_institucional():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "select id_correo, nombre_area, correo, contra from correo_institucional;"
    cursor.execute(sql)
    correo = cursor.fetchall()
    cursor.close()
    conexion.close()
    return correo


def obtener_denuncia():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "SELECT id_denuncia, nombre   FROM denuncia   ORDER BY id_denuncia ASC   LIMIT 8;"
    cursor.execute(sql)
    correo = cursor.fetchall()
    cursor.close()
    conexion.close()
    return correo

def obtener_emergencia():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "SELECT id_numero_emergencia, nombre_emergencia as nombre  FROM emergencia   ORDER BY id_numero_emergencia ASC;"
    cursor.execute(sql)
    correo = cursor.fetchall()
    cursor.close()
    conexion.close()
    return correo

def obtener_riesgos():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "SELECT id_denuncia, nombre   FROM denuncia   ORDER BY id_denuncia desc   LIMIT 4;"
    cursor.execute(sql)
    correo = cursor.fetchall()
    cursor.close()
    conexion.close()
    return correo




def insertar_correo(correo, nombre_area, contra):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "INSERT INTO correo_institucional (correo, nombre_area, contra) VALUES (%s, %s, %s);"
    cursor.execute(sql, (correo, nombre_area, contra))
    conexion.commit()
    ultimo_id = cursor.lastrowid
    cursor.close()
    conexion.close()
    return ultimo_id

def insertar_denuncia_correo(id_correo, id_denuncia):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "INSERT INTO denuncia_correo (id_correo, id_denuncia) VALUES (%s, %s);"
    cursor.execute(sql, (id_correo, id_denuncia))
    conexion.commit()
    cursor.close()
    conexion.close()
    return True

def insertar_emergencia_correo(id_correo, id_numero_emergencia):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "INSERT INTO emergencia_correo (id_correo, id_numero_emergencia) VALUES (%s, %s);"
    cursor.execute(sql, (id_correo, id_numero_emergencia))
    conexion.commit()
    cursor.close()
    conexion.close()
    return True

def cambiar_contrasena(id_correo, nueva_contra):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "UPDATE correo_institucional SET contra = %s WHERE id_correo = %s;"
    cursor.execute(sql, (nueva_contra, id_correo))
    conexion.commit()
    cursor.close()
    conexion.close()
    return True



def obtener_emergencia_por_id(id):
    """Obtiene el detalle completo de una emergencia incluyendo audio"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
    SELECT ini.id_incidencia, ini.ubicacion, ini.estado, ini.fecha,
           ini.nivel_incidencia, ini.hora,
           eme.nombre_emergencia, eme.numero,
           CONCAT(pe.nombre,' ',pe.apellidos) AS nombres,
           pe.numero_celular, pe.dni,
           aud.id_audio, aud.ubicacion_audio
    FROM incidencia ini
    INNER JOIN emergencia eme ON eme.id_numero_emergencia = ini.id_numero_emergencia
    INNER JOIN usuario us ON us.id_usuario = ini.id_usuario
    INNER JOIN persona pe ON pe.id_persona = us.id_persona
    LEFT JOIN audio aud ON aud.id_incidencia = ini.id_incidencia
    WHERE ini.id_incidencia = %s
    """
    cursor.execute(sql, (id,))
    fila = cursor.fetchone()
    cursor.close()
    conexion.close()

    if fila:
        resultado = {
            "id_incidencia": fila['id_incidencia'],
            "ubicacion": fila['ubicacion'],
            "estado": fila['estado'],
            "fecha": str(fila['fecha']),  # Convertir datetime a str
            "nivel_incidencia": fila['nivel_incidencia'],
            "hora": str(fila['hora']),   # Convertir time o timedelta a str
            "nombre_emergencia": fila['nombre_emergencia'],
            "numero": fila['numero'],
            "nombre": fila['nombres'],
            "cel_us": fila['numero_celular'],
            "dni": fila['dni'],
            "id_audio": fila['id_audio'],  # Agregar id_audio
            "ubicacion_audio": fila['ubicacion_audio']  # Agregar ruta del audio
        }
        return resultado
    else:
        return {"error": "No se encontró la emergencia con ese ID"}











# dash


def obtener_ruidos():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "SELECT COUNT(*) AS conteo FROM incidencia WHERE id_denuncia = 1;"
    cursor.execute(sql)
    audios = cursor.fetchall()
    conteo = audios[0]['conteo'] if audios else 0
    cursor.close()
    conexion.close()
    return conteo

def obtener_iluminacion():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "SELECT COUNT(*) AS conteo FROM incidencia WHERE id_denuncia = 2;"
    cursor.execute(sql)
    iluminacion = cursor.fetchall()
    conteo = iluminacion[0]['conteo'] if iluminacion else 0
    cursor.close()
    conexion.close()
    return conteo

def obtener_pistas():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "SELECT COUNT(*) AS conteo FROM incidencia WHERE id_denuncia = 3;"
    cursor.execute(sql)
    pistas = cursor.fetchall()
    conteo = pistas[0]['conteo'] if pistas else 0
    cursor.close()
    conexion.close()
    return conteo

def obtener_parques():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "SELECT COUNT(*) AS conteo FROM incidencia WHERE id_denuncia = 4;"
    cursor.execute(sql)
    parques = cursor.fetchall()
    conteo = parques[0]['conteo'] if parques else 0
    cursor.close()
    conexion.close()
    return conteo

def obtener_limpieza():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "SELECT COUNT(*) AS conteo FROM incidencia WHERE id_denuncia = 5;"
    cursor.execute(sql)
    limpieza = cursor.fetchall()
    conteo = limpieza[0]['conteo'] if limpieza else 0
    cursor.close()
    conexion.close()
    return conteo

def obtener_negocios():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "SELECT COUNT(*) AS conteo FROM incidencia WHERE id_denuncia = 6;"
    cursor.execute(sql)
    negocios = cursor.fetchall()
    conteo = negocios[0]['conteo'] if negocios else 0
    cursor.close()
    conexion.close()
    return conteo

def obtener_otros():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "SELECT COUNT(*) AS conteo FROM incidencia WHERE id_denuncia = 7;"
    cursor.execute(sql)
    otros = cursor.fetchall()
    conteo = otros[0]['conteo'] if otros else 0
    cursor.close()
    conexion.close()
    return conteo

def obtener_conflictos():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "SELECT COUNT(*) AS conteo FROM incidencia WHERE id_denuncia = 8;"
    cursor.execute(sql)
    conflictos = cursor.fetchall()
    conteo = conflictos[0]['conteo'] if conflictos else 0
    cursor.close()
    conexion.close()
    return conteo



#####ULTIMAS

def obtener_ultima_emergencia():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
    SELECT CONCAT(eme.nombre_emergencia,' ','-',' ',ini.fecha) as nombre  FROM incidencia ini
        INNER JOIN emergencia eme ON eme.id_numero_emergencia = ini.id_numero_emergencia
        WHERE ini.id_tipo_incidencia = 4
        ORDER BY ini.id_incidencia DESC
        LIMIT 1
    """
    cursor.execute(sql)
    conflictos = cursor.fetchone()
    nombre = conflictos['nombre'] if conflictos else None
    cursor.close()
    conexion.close()
    return nombre


def obtener_ultima_denuncia():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
    SELECT CONCAT(de.nombre,' ','-',' ',ini.fecha) AS nombre  FROM incidencia ini
        INNER JOIN denuncia de ON de.id_denuncia = ini.id_denuncia
        WHERE ini.id_tipo_incidencia = 3
        ORDER BY ini.id_incidencia DESC
        LIMIT 1
    """
    cursor.execute(sql)
    conflictos = cursor.fetchone()
    nombre = conflictos['nombre'] if conflictos else None
    cursor.close()
    conexion.close()
    return nombre

def obtener_ultima_riesgo():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
    SELECT CONCAT(de.nombre,' ','-',' ',ini.fecha) AS nombre  FROM incidencia ini
        INNER JOIN denuncia de ON de.id_denuncia = ini.id_denuncia
        WHERE ini.id_tipo_incidencia = 4
        ORDER BY ini.id_incidencia DESC
        LIMIT 1
    """
    cursor.execute(sql)
    conflictos = cursor.fetchone()
    nombre = conflictos['nombre'] if conflictos else None
    cursor.close()
    conexion.close()
    return nombre





def obtener_reportes_por_fecha():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT
            DATE(ini.fecha) AS fecha,
            SUM(CASE WHEN ini.id_tipo_incidencia = 3 THEN 1 ELSE 0 END) AS denuncias,
            SUM(CASE WHEN ini.id_tipo_incidencia = 4 THEN 1 ELSE 0 END) AS emergencias
        FROM incidencia ini
        GROUP BY DATE(ini.fecha)
        ORDER BY fecha DESC
        LIMIT 6
    """
    cursor.execute(sql)
    resultados = cursor.fetchall()
    cursor.close()
    conexion.close()

    # Convertir datos al formato requerido por el gráfico
    resultados.reverse()  # Para que salgan en orden cronológico
    labels = [fila['fecha'].strftime('%d/%m') for fila in resultados]
    denuncias = [fila['denuncias'] for fila in resultados]
    emergencias = [fila['emergencias'] for fila in resultados]

    return {
        "labels": labels,
        "denuncias": denuncias,
        "emergencias": emergencias
    }





def obtener_conteo_denuncia():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """  SELECT COUNT(*) AS total_denuncias
FROM incidencia ini
INNER JOIN denuncia de ON de.id_denuncia = ini.id_denuncia
WHERE ini.fecha >= CURDATE() - INTERVAL 1 MONTH AND ini.id_tipo_incidencia =3; """
    cursor.execute(sql, )
    resultado = cursor.fetchone()
    conteo = resultado['total_denuncias'] if resultado else 0
    cursor.close()
    conexion.close()
    return conteo

def obtener_conteo_riesgos():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """ SELECT COUNT(*) AS total_riesgos
FROM incidencia ini
INNER JOIN denuncia de ON de.id_denuncia = ini.id_denuncia
WHERE ini.fecha >= CURDATE() - INTERVAL 1 MONTH AND ini.id_tipo_incidencia =4; """
    cursor.execute(sql, )
    resultado = cursor.fetchone()
    conteo = resultado['total_riesgos'] if resultado else 0
    cursor.close()
    conexion.close()
    return conteo

def obtener_conteo_emergencia():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """ SELECT COUNT(*) AS total_emergencia
FROM incidencia ini
INNER JOIN emergencia eme ON eme.id_numero_emergencia = ini.id_numero_emergencia
WHERE ini.fecha >= CURDATE() - INTERVAL 1 MONTH AND ini.id_tipo_incidencia =4; """
    cursor.execute(sql, )
    resultado = cursor.fetchone()
    conteo = resultado['total_emergencia'] if resultado else 0
    cursor.close()
    conexion.close()
    return conteo
# Nuevas funciones para agregar al controlador_central.py

def obtener_total_denuncias():
    """Obtiene el total de denuncias del día actual"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT COUNT(*) AS total 
        FROM incidencia 
        WHERE id_tipo_incidencia = 3 
        AND DATE(fecha) = CURDATE()
    """
    cursor.execute(sql)
    resultado = cursor.fetchone()
    total = resultado['total'] if resultado else 0
    cursor.close()
    conexion.close()
    return total

def obtener_total_emergencias():
    """Obtiene el total de emergencias del día actual"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT COUNT(*) AS total 
        FROM incidencia 
        WHERE id_tipo_incidencia = 4 
        AND DATE(fecha) = CURDATE()
    """
    cursor.execute(sql)
    resultado = cursor.fetchone()
    total = resultado['total'] if resultado else 0
    cursor.close()
    conexion.close()
    return total

def obtener_tendencia_denuncias():
    """Calcula tendencia de denuncias (mes actual vs mes anterior)"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT 
            (SELECT COUNT(*) FROM incidencia 
             WHERE id_tipo_incidencia = 3 
             AND MONTH(fecha) = MONTH(CURDATE()) 
             AND YEAR(fecha) = YEAR(CURDATE())) AS mes_actual,
            (SELECT COUNT(*) FROM incidencia 
             WHERE id_tipo_incidencia = 3 
             AND MONTH(fecha) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
             AND YEAR(fecha) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))) AS mes_anterior
    """
    cursor.execute(sql)
    resultado = cursor.fetchone()
    cursor.close()
    conexion.close()
    
    if resultado and resultado['mes_anterior'] > 0:
        porcentaje = ((resultado['mes_actual'] - resultado['mes_anterior']) / resultado['mes_anterior']) * 100
        return {
            "porcentaje": round(porcentaje, 1),
            "direccion": "up" if porcentaje > 0 else "down"
        }
    return {"porcentaje": 0, "direccion": "neutral"}

def obtener_tendencia_emergencias():
    """Calcula tendencia de emergencias (mes actual vs mes anterior)"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT 
            (SELECT COUNT(*) FROM incidencia 
             WHERE id_tipo_incidencia = 4 
             AND MONTH(fecha) = MONTH(CURDATE()) 
             AND YEAR(fecha) = YEAR(CURDATE())) AS mes_actual,
            (SELECT COUNT(*) FROM incidencia 
             WHERE id_tipo_incidencia = 4 
             AND MONTH(fecha) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
             AND YEAR(fecha) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))) AS mes_anterior
    """
    cursor.execute(sql)
    resultado = cursor.fetchone()
    cursor.close()
    conexion.close()
    
    if resultado and resultado['mes_anterior'] > 0:
        porcentaje = ((resultado['mes_actual'] - resultado['mes_anterior']) / resultado['mes_anterior']) * 100
        return {
            "porcentaje": round(porcentaje, 1),
            "direccion": "up" if porcentaje > 0 else "down"
        }
    return {"porcentaje": 0, "direccion": "neutral"}

def obtener_alertas_recientes():
    """Obtiene las últimas 5 alertas/incidencias con mayor prioridad"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT 
    CASE 
        WHEN ini.id_tipo_incidencia = 3 THEN CONCAT('Denuncia: ', de.nombre)
        WHEN ini.id_tipo_incidencia = 4 THEN CONCAT('Emergencia: ', eme.nombre_emergencia)
        ELSE 'Incidencia'
    END AS descripcion,
    
    ini.id_tipo_incidencia,
    TIMESTAMPDIFF(
        HOUR, 
        TIMESTAMP(ini.fecha, ini.hora), 
        NOW()
    ) AS horas_transcurridas
FROM incidencia ini
LEFT JOIN denuncia de ON de.id_denuncia = ini.id_denuncia
LEFT JOIN emergencia eme ON eme.id_numero_emergencia = ini.id_numero_emergencia
WHERE TIMESTAMP(ini.fecha, ini.hora) >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
ORDER BY ini.fecha DESC, ini.hora DESC
LIMIT 5;

    """
    cursor.execute(sql)
    alertas = cursor.fetchall()
    cursor.close()
    conexion.close()
    
    resultado = []
    for alerta in alertas:
        horas = alerta['horas_transcurridas']
        if horas < 1:
            tiempo = "Hace menos de 1h"
        elif horas < 24:
            tiempo = f"Hace {horas}h"
        else:
            tiempo = f"Hace {horas // 24}d"
            
        resultado.append({
            "descripcion": alerta['descripcion'],
            "tiempo": tiempo,
            "tipo": "danger" if alerta['id_tipo_incidencia'] == 4 else "warning"
        })
    
    return resultado

def obtener_actividad_tiempo_real():
    """Obtiene las últimas 10 actividades registradas"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT 
            CASE 
                WHEN ini.id_tipo_incidencia = 3 THEN CONCAT('Nueva denuncia: ', de.nombre)
                WHEN ini.id_tipo_incidencia = 4 THEN CONCAT('Emergencia: ', eme.nombre_emergencia)
                ELSE 'Nueva incidencia registrada'
            END AS actividad,
            TIME_FORMAT(ini.hora, '%H:%i:%s') AS hora
        FROM incidencia ini
        LEFT JOIN denuncia de ON de.id_denuncia = ini.id_denuncia
        LEFT JOIN emergencia eme ON eme.id_numero_emergencia = ini.id_numero_emergencia
        WHERE DATE(ini.fecha) = CURDATE()
        ORDER BY ini.fecha DESC
        LIMIT 10
    """
    cursor.execute(sql)
    actividades = cursor.fetchall()
    cursor.close()
    conexion.close()
    return actividades

def obtener_estadisticas_por_hora():
    """Obtiene distribución de incidencias por hora del día actual"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT 
            HOUR(hora) AS hora,
            COUNT(*) AS total,
            SUM(CASE WHEN id_tipo_incidencia = 3 THEN 1 ELSE 0 END) AS denuncias,
            SUM(CASE WHEN id_tipo_incidencia = 4 THEN 1 ELSE 0 END) AS emergencias
        FROM incidencia
        WHERE DATE(fecha) = CURDATE()
        GROUP BY HOUR(hora)
        ORDER BY HOUR(hora)
    """
    cursor.execute(sql)
    resultados = cursor.fetchall()
    cursor.close()
    conexion.close()

    # Formatear para gráfico
    horas = []
    denuncias = []
    emergencias = []

    for i in range(24):
        hora_str = f"{i:02d}:00"
        horas.append(hora_str)

        # Buscar si existe registro para esta hora
        datos_hora = next((r for r in resultados if r['hora'] == i), None)
        if datos_hora:
            denuncias.append(datos_hora['denuncias'])
            emergencias.append(datos_hora['emergencias'])
        else:
            denuncias.append(0)
            emergencias.append(0)

    return {
        "labels": horas,
        "denuncias": denuncias,
        "emergencias": emergencias
    }


def obtener_top_denuncias():
    """Obtiene el top 5 de tipos de denuncias más frecuentes del mes"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT 
            de.nombre,
            COUNT(*) as total
        FROM incidencia ini
        INNER JOIN denuncia de ON de.id_denuncia = ini.id_denuncia
        WHERE ini.id_tipo_incidencia = 3
        AND ini.fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY de.id_denuncia, de.nombre
        ORDER BY total DESC
        LIMIT 5
    """
    cursor.execute(sql)
    resultados = cursor.fetchall()
    cursor.close()
    conexion.close()
    
    labels = [r['nombre'] for r in resultados]
    valores = [r['total'] for r in resultados]
    
    return {
        "labels": labels,
        "valores": valores
    }

def obtener_resumen_semanal():
    """Obtiene resumen de la última semana"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT 
            DATE(fecha) as dia,
            DAYNAME(fecha) as nombre_dia,
            COUNT(*) as total,
            SUM(CASE WHEN id_tipo_incidencia = 3 THEN 1 ELSE 0 END) AS denuncias,
            SUM(CASE WHEN id_tipo_incidencia = 4 THEN 1 ELSE 0 END) AS emergencias
        FROM incidencia
        WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(fecha)
        ORDER BY dia
    """
    cursor.execute(sql)
    resultados = cursor.fetchall()
    cursor.close()
    conexion.close()
    
    dias_es = {
        'Monday': 'Lun',
        'Tuesday': 'Mar',
        'Wednesday': 'Mié',
        'Thursday': 'Jue',
        'Friday': 'Vie',
        'Saturday': 'Sáb',
        'Sunday': 'Dom'
    }
    
    labels = []
    totales = []
    denuncias = []
    emergencias = []
    
    for r in resultados:
        labels.append(dias_es.get(r['nombre_dia'], r['nombre_dia'][:3]))
        totales.append(r['total'])
        denuncias.append(r['denuncias'])
        emergencias.append(r['emergencias'])
    
    return {
        "labels": labels,
        "totales": totales,
        "denuncias": denuncias,
        "emergencias": emergencias
    }

import urllib.parse

def obtener_motivo(id_incidencia):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = "SELECT descripcion, archivo_adjunto FROM motivo_incidencia WHERE id_incidencia = %s;"
    cursor.execute(sql, (id_incidencia,))
    motivo = cursor.fetchone()
    cursor.close()
    conexion.close()

    if motivo:
        archivo = motivo['archivo_adjunto']
        if archivo:
            archivo = archivo.replace('\\', '/')
            base_url = "http://10.0.0.36:5000/"
            archivo_adjunto_url = urllib.parse.urljoin(base_url, archivo)
        else:
            archivo_adjunto_url = None

        return {
            "descripcion": motivo['descripcion'],
            "archivo_adjunto": archivo_adjunto_url
        }
    else:
        return None


def obtener_id_persona(id_incidencia):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT us.id_usuario
        FROM incidencia ini
        INNER JOIN usuario us ON us.id_usuario = ini.id_usuario
        WHERE ini.id_incidencia = %s;
    """
    cursor.execute(sql, (id_incidencia,))
    resultado = cursor.fetchone()
    cursor.close()
    conexion.close()
    return resultado['id_usuario'] if resultado else None

