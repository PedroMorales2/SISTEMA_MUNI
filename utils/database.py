"""
utils/database.py
Módulo centralizado para conexión a base de datos MySQL
"""
import pymysql.cursors
import os


def obtenerconexion():
    """Obtiene conexión a la base de datos MySQL"""
    try:
        # Variables de entorno o valores por defecto
        host = os.environ.get('DB_HOST', '127.0.0.1')
        user = os.environ.get('DB_USER', 'munireque')
        password = os.environ.get('DB_PASSWORD', 'morales78mor')
        database = os.environ.get('DB_NAME', 'munireque$bd_muni_reque')
        port = int(os.environ.get('DB_PORT', 3306))
        
        conexion = pymysql.connect(
            host=host,
            user=user,
            password=password,
            database=database,
            port=port,
            cursorclass=pymysql.cursors.DictCursor,
            charset='utf8mb4'
        )
        
        return conexion
        
    except Exception as e:
        print(f"❌ Error al conectar a la base de datos: {e}")
        return None


def test_conexion():
    """Prueba la conexión a la base de datos"""
    conexion = obtenerconexion()
    
    if conexion:
        print("✅ Conexión exitosa a la base de datos")
        try:
            with conexion.cursor() as cursor:
                cursor.execute("SELECT VERSION()")
                version = cursor.fetchone()
                print(f"📊 MySQL Version: {version}")
            conexion.close()
            return True
        except Exception as e:
            print(f"❌ Error: {e}")
            return False
    else:
        print("❌ No se pudo conectar")
        return False


if __name__ == "__main__":
    test_conexion()