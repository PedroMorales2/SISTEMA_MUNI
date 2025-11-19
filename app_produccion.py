"""
app_produccion.py
Versión optimizada para PythonAnywhere - SOLO CARGA MODELOS
"""
import os
import sys

# ================================
# CONFIGURAR ZONA HORARIA PERÚ
# ================================
os.environ['TZ'] = 'America/Lima'
import time
time.tzset()

# Configuración crítica ANTES de importar TensorFlow
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

from flask import Flask
from flask_cors import CORS
from flask_mail import Mail
from config import get_config

# Importar blueprints API (Backend)
from routes.api.auth import auth_bp
from routes.api.incidencias import incidencias_bp
from routes.api.denuncias import denuncias_bp
from routes.api.emergencias import emergencias_bp
from routes.api.central import central_bp
from routes.api.mapas import mapas_bp
from routes.api.modelo_dbscan import dbscan_bp
from routes.api.modelo_prediccion import prediccion_bp
from routes.api.exportacion import exportacion_bp
from routes.api.recursos import recursos_bp
from routes.api.configuracion import configuracion_bp
from routes.api.prediccion_espacial import espacial_bp
from routes.api.sectores import sectores_bp

# Importar blueprints Views (Frontend)
from routes.views.auth_views import auth_views_bp
from routes.views.denuncia_views import denuncia_views_bp
from routes.views.emergencia_views import emergencia_views_bp
from routes.views.mapa_views import mapa_views_bp
from routes.views.admin_views import admin_views_bp

# Importar servicios
from services.email_service import EmailService

# Importar wrapper del modelo (modificado para producción)
from models.modelo_PREDICCION_produccion import get_modelo, ModeloPrediccionIncidencias


def create_app(config_name='default'):
    """Factory pattern para crear la aplicación"""
    app = Flask(__name__, static_url_path='/static')

    # Cargar configuración
    config_class = get_config()
    app.config.from_object(config_class)

    # Inicializar extensiones
    CORS(app, supports_credentials=True)
    mail = Mail(app)

    # Crear directorios necesarios
    os.makedirs(app.config.get('MODEL_DIR', 'modelos_entrenados'), exist_ok=True)
    os.makedirs(app.config.get('DATA_DIR', 'datos_procesados'), exist_ok=True)
    os.makedirs(app.config.get('CACHE_DIR', 'cache_predicciones'), exist_ok=True)
    os.makedirs(app.config.get('UPLOAD_FOLDER', 'uploads'), exist_ok=True)

    # Inicializar servicios
    app.email_service = EmailService(mail)

    # Context processor
    @app.context_processor
    def inject_global_vars():
        return {'BASE_URL': 'https://munireque.pythonanywhere.com'}

    # Inicializar modelo (SOLO CARGA, NO ENTRENA)
    print("\n" + "="*70)
    print("INICIALIZANDO SISTEMA - MODO PRODUCCIÓN")
    print("="*70)

    with app.app_context():
        try:
            print("📊 Cargando modelos preentrenados...")
            app.modelo = ModeloPrediccionIncidencias()
            print("✅ Modelos cargados exitosamente")
        except Exception as e:
            print(f"⚠️ Advertencia: No se pudieron cargar modelos")
            print(f"   Razón: {e}")
            app.modelo = None

    # Registrar blueprints API
    print("\n📡 Registrando endpoints API...")
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(incidencias_bp, url_prefix='/api/incidencias')
    app.register_blueprint(denuncias_bp, url_prefix='/api/denuncias')
    app.register_blueprint(emergencias_bp, url_prefix='/api/emergencias')
    app.register_blueprint(central_bp, url_prefix='/api/central')
    app.register_blueprint(mapas_bp, url_prefix='/api/mapas')
    app.register_blueprint(dbscan_bp, url_prefix='/api/modelo/dbscan')
    app.register_blueprint(prediccion_bp, url_prefix='/api/modelo/prediccion')
    app.register_blueprint(espacial_bp, url_prefix='/api/modelo/espacial')
    app.register_blueprint(exportacion_bp, url_prefix='/api/exportar')
    app.register_blueprint(recursos_bp, url_prefix='/api/recursos')
    app.register_blueprint(configuracion_bp, url_prefix='/api/configuracion')
    app.register_blueprint(sectores_bp, url_prefix='/api/sectores')
    print("✅ APIs registradas")

    # Registrar blueprints Views
    print("\n🌐 Registrando rutas de vistas...")
    app.register_blueprint(auth_views_bp)
    app.register_blueprint(denuncia_views_bp, url_prefix='/denuncias')
    app.register_blueprint(emergencia_views_bp, url_prefix='/emergencias')
    app.register_blueprint(mapa_views_bp, url_prefix='/mapas')
    app.register_blueprint(admin_views_bp, url_prefix='/admin')
    print("✅ Vistas registradas")

    # Rutas de utilidad
    @app.route('/health')
    def health():
        """Health check del sistema"""
        return {
            'status': 'healthy',
            'modelo_cargado': app.modelo is not None and hasattr(app.modelo, 'trained') and app.modelo.trained,
            'version': '2.0 - Producción'
        }

    @app.route('/api/info')
    def api_info():
        """Información de la API"""
        return {
            'service': 'Sistema de Denuncias Municipales',
            'version': '2.0',
            'mode': 'production'
        }

    # Manejadores de errores
    @app.errorhandler(404)
    def not_found(error):
        return {'error': 'Endpoint no encontrado', 'code': 404}, 404

    @app.errorhandler(500)
    def internal_error(error):
        return {'error': 'Error interno del servidor', 'code': 500}, 500

    @app.errorhandler(403)
    def forbidden(error):
        return {'error': 'Acceso prohibido', 'code': 403}, 403

    print("\n" + "="*70)
    print("✅ SISTEMA INICIALIZADO - MODO PRODUCCIÓN")
    print("="*70 + "\n")

    return app


# Crear aplicación
app = create_app()


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)