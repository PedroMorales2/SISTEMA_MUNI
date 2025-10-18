from utils.database import obtenerconexion as obtener_conexion

def verificar_usuario(username, password):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT us.id_usuario, us.id_persona, us.verificado FROM usuario us
                    WHERE us.username = %s AND us.`password` = %s"""
    cursor.execute(sql, (username, password))
    usuario = cursor.fetchone()
    cursor.close()
    conexion.close()
    return usuario


def obtener_persona_por_id(id_persona):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """
        SELECT CONCAT(nombre, ' ', apellidos) AS nombre_completo, dni, numero_celular, direccion
        FROM persona
        WHERE id_persona = %s
    """
    cursor.execute(sql, (id_persona,))
    persona = cursor.fetchone()  # ✅ esto será un dict
    cursor.close()
    conexion.close()
    return persona


def registrar_persona(nombre, apellidos, dni, foto_confirmacion,celular, direccion):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """INSERT INTO persona (nombre, apellidos, dni, foto_confirmacion,numero_celular, direccion)
            VALUES (%s, %s, %s,%s,%s,%s)"""
    cursor.execute(sql, (nombre, apellidos, dni, foto_confirmacion,celular, direccion))
    conexion.commit()
    cursor.close()
    conexion.close()
    return cursor.lastrowid

def registrar_usuario(username, password, id_persona, numero_aleatorio):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """INSERT INTO usuario (username, password,estado,token, id_persona, cod_verify, verificado)
            VALUES (%s, %s,'A','0000', %s, %s, false)"""
    cursor.execute(sql, (username, password, id_persona, numero_aleatorio))
    conexion.commit()
    cursor.close()
    conexion.close()
    return cursor.lastrowid

def actualizar_foto_persona(id_persona, foto_confirmacion):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """UPDATE persona SET foto_confirmacion = %s WHERE id_persona = %s"""
    cursor.execute(sql, (foto_confirmacion, id_persona))
    conexion.commit()
    cursor.close()
    conexion.close()
    

def cambiar_contrasena(id_usuario, actual_contrasena, nueva_contrasena):
    conexion = obtener_conexion()
    cursor = conexion.cursor()

    sql_verificar = """SELECT COUNT(*) as existe FROM usuario
                       WHERE id_usuario = %s AND password = %s"""
    cursor.execute(sql_verificar, (id_usuario, actual_contrasena))
    resultado = cursor.fetchone()

    if resultado['existe'] == 0:
        cursor.close()
        conexion.close()
        return False

    sql_actualizar = """UPDATE usuario SET password = %s WHERE id_usuario = %s"""
    cursor.execute(sql_actualizar, (nueva_contrasena, id_usuario))
    conexion.commit()

    cursor.close()
    conexion.close()
    return True




def cambiar_estado_usuario(id_usuario, cod):
    try:
        conexion = obtener_conexion()
        curso = conexion.cursor()  # importante para acceder por claves
        sql = "SELECT cod_verify FROM usuario WHERE id_usuario = %s"
        curso.execute(sql, (id_usuario,))
        resul = curso.fetchone()

        if resul is None:
            return False  # usuario no encontrado

        cod_veri = resul['cod_verify']
        if cod_veri == cod:
            sql2 = "UPDATE usuario SET verificado = TRUE WHERE id_usuario = %s"
            curso.execute(sql2, (id_usuario,))
            conexion.commit()
            return True
        return False  # código incorrecto
    except Exception as e:
        print(f"Error al verificar usuario: {e}")
        return False
    finally:
        if curso:
            curso.close()
        if conexion:
            conexion.close()




