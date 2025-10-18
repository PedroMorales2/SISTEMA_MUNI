"""
config.py
Configuraciones centralizadas de la aplicación
"""
import os
from datetime import timedelta

class Config:
    """Configuración base"""
    # Flask
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your_secret_key_change_in_production'
    
    # CORS
    CORS_ORIGINS = ['http://localhost:3000', 'http://localhost:5173']
    
    # Sesión
    SESSION_TYPE = 'filesystem'
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    
    # Email
    MAIL_SERVER = 'smtp.gmail.com'
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME') or 'electronico4208978@gmail.com'
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD') or 'aoym rhqf jkxy splu'
    MAIL_DEFAULT_SENDER = MAIL_USERNAME
    
    # Base de datos MySQL
    DB_HOST = os.environ.get('DB_HOST') or '127.0.0.1'
    DB_PORT = int(os.environ.get('DB_PORT', 3306))
    DB_USER = os.environ.get('DB_USER') or 'munireque'
    DB_PASSWORD = os.environ.get('DB_PASSWORD') or 'morales78mor'
    DB_NAME = os.environ.get('DB_NAME') or 'munireque$bd_muni_reque'
    
    # Archivos
    ALLOWED_IMAGE_EXTENSIONS = {'jpg', 'jpeg', 'png'}
    ALLOWED_AUDIO_EXTENSIONS = {'mp3', 'wav', 'ogg', 'm4a'}
    ALLOWED_VIDEO_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv'}
    ALLOWED_DOCUMENT_EXTENSIONS = {'pdf', 'docx', 'doc', 'txt'}
    MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB
    
    UPLOAD_FOLDER = 'static/uploads'
    
    # Modelos de IA
    MODEL_DIR = 'modelos_entrenados'
    DATA_DIR = 'datos_procesados'
    CACHE_DIR = 'cache_predicciones'
    DATASET_PATH = 'dataset_incidencias_reque_2015_2024.csv'
    
    # DBSCAN
    DBSCAN_DEFAULT_EPS = 50
    DBSCAN_DEFAULT_MIN_SAMPLES = 3
    
    # Mapeo de categorías
    DENUNCIAS_MAP = {
        1: "Ruidos molestos",
        2: "Bullying y violencia familiar",
        3: "Ocupación vía pública",
        4: "Parques y jardines",
        5: "Limpieza pública",
        6: "Negocios informales",
        7: "Otros",
        8: "Peleas y conflictos",
        9: "Lluvias intensas",
        10: "Sismos",
        11: "Incendio urbano",
        12: "Riesgo de colapso"
    }
    
    EMERGENCIAS_MAP = {
        1: "Otros",
        2: "Policía (911)",
        3: "Serenazgo (955)",
        4: "Ambulancia (666)",
        5: "Bomberos Monsefú (444)",
        6: "Bomberos Chiclayo (922)"
    }


class DevelopmentConfig(Config):
    """Configuración para desarrollo"""
    DEBUG = True
    TESTING = False
    DB_HOST = '127.0.0.1'


class ProductionConfig(Config):
    """Configuración para producción"""
    DEBUG = False
    TESTING = False
    DB_HOST = 'munireque.mysql.pythonanywhere-services.com'
    SECRET_KEY = os.environ.get('SECRET_KEY') or os.urandom(24).hex()


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}

def get_config():
    env = os.environ.get('FLASK_ENV', 'production')
    return config.get(env, config['default'])