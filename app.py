"""
app.py
Punto de entrada principal de la aplicación
Sistema de Denuncias Municipales - Backend + Frontend Integrado
"""
from flask import Flask
from flask_cors import CORS
from flask_mail import Mail
from config import get_config
import os

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

# Importar blueprints Views (Frontend)
from routes.views.auth_views import auth_views_bp
from routes.views.denuncia_views import denuncia_views_bp
from routes.views.emergencia_views import emergencia_views_bp
from routes.views.mapa_views import mapa_views_bp
from routes.views.admin_views import admin_views_bp

# Importar servicios
from services.email_service import EmailService

# Importar modelos de IA
from models.modelo_PREDICCION import get_modelo


def create_app(config_name='default'):
    """
    Factory pattern para crear la aplicación
    
    Args:
        config_name: Nombre de la configuración a usar
    
    Returns:
        Flask app configurada
    """
    app = Flask(__name__, static_url_path='/static')
    
    # Cargar configuración
    config_class = get_config()
    app.config.from_object(config_class)
    
    # Inicializar extensiones
    CORS(app, supports_credentials=True)
    mail = Mail(app)
    
    # Crear directorios necesarios
    os.makedirs(app.config['MODEL_DIR'], exist_ok=True)
    os.makedirs(app.config['DATA_DIR'], exist_ok=True)
    os.makedirs(app.config['CACHE_DIR'], exist_ok=True)
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # Inicializar servicios
    app.email_service = EmailService(mail)
    
    # Context processor para variables globales en templates
    @app.context_processor
    def inject_global_vars():
        return {
            'BASE_URL': 'http://127.0.0.1:5000',
        }
    
    # Inicializar modelo de IA
    print("\n" + "="*70)
    print("INICIALIZANDO SISTEMA DE DENUNCIAS MUNICIPALES")
    print("="*70)
    
    with app.app_context():
        try:
            print("📊 Cargando modelo de predicción LSTM...")
            app.modelo = get_modelo()
            print("✅ Modelo de predicción cargado exitosamente")
        except Exception as e:
            print(f"⚠️  Advertencia: No se pudo cargar el modelo de predicción")
            print(f"   Razón: {e}")
            print("   Los endpoints de predicción no estarán disponibles")
            app.modelo = None
    
    # ============================================
    # REGISTRAR BLUEPRINTS API (Backend REST)
    # ============================================
    print("\n📡 Registrando endpoints API...")
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    print("  ✓ /api/auth")
    
    app.register_blueprint(incidencias_bp, url_prefix='/api/incidencias')
    print("  ✓ /api/incidencias")

    app.register_blueprint(denuncias_bp, url_prefix='/api/denuncias')
    print("  ✓ /api/denuncias")
    
    app.register_blueprint(emergencias_bp, url_prefix='/api/emergencias')
    print("  ✓ /api/emergencias")
    
    app.register_blueprint(central_bp, url_prefix='/api/central')
    print("  ✓ /api/central")
    
    app.register_blueprint(mapas_bp, url_prefix='/api/mapas')
    print("  ✓ /api/mapas")
    
    app.register_blueprint(dbscan_bp, url_prefix='/api/modelo/dbscan')
    print("  ✓ /api/modelo/dbscan")
    
    app.register_blueprint(prediccion_bp, url_prefix='/api/modelo/prediccion')
    print("  ✓ /api/modelo/prediccion")
    
    app.register_blueprint(espacial_bp, url_prefix='/api/modelo/espacial')

    
    app.register_blueprint(exportacion_bp, url_prefix='/api/exportar')
    print("  ✓ /api/exportar")
    
    app.register_blueprint(recursos_bp, url_prefix='/api/recursos')
    print("  ✓ /api/recursos")
    
    app.register_blueprint(configuracion_bp, url_prefix='/api/configuracion')
    print("  ✓ /api/configuracion")
    
    # ============================================
    # REGISTRAR BLUEPRINTS VIEWS (Frontend HTML)
    # ============================================
    print("\n🌐 Registrando rutas de vistas...")
    
    app.register_blueprint(auth_views_bp)
    print("  ✓ / (login, logout, home)")
    
    app.register_blueprint(denuncia_views_bp, url_prefix='/denuncias')
    print("  ✓ /denuncias")
    
    app.register_blueprint(emergencia_views_bp, url_prefix='/emergencias')
    print("  ✓ /emergencias")
    
    app.register_blueprint(mapa_views_bp, url_prefix='/mapas')
    print("  ✓ /mapas")
    
    app.register_blueprint(admin_views_bp, url_prefix='/admin')
    print("  ✓ /admin")
    
    # ============================================
    # RUTAS DE UTILIDAD
    # ============================================
    @app.route('/health')
    def health():
        """Health check del sistema"""
        return {
            'status': 'healthy',
            'modelo_cargado': app.modelo is not None and app.modelo.trained if hasattr(app, 'modelo') else False,
            'version': '2.0'
        }
    
    @app.route('/api/info')
    def api_info():
        """Información de la API"""
        return {
            'service': 'Sistema de Denuncias Municipales',
            'version': '2.0',
            'endpoints': {
                'api': {
                    'auth': '/api/auth',
                    'incidencias': '/api/incidencias',
                    'denuncias': '/api/denuncias',
                    'emergencias': '/api/emergencias',
                    'central': '/api/central',
                    'mapas': '/api/mapas',
                    'dbscan': '/api/modelo/dbscan',
                    'prediccion': '/api/modelo/prediccion',
                    'exportar': '/api/exportar'
                },
                'vistas': {
                    'login': '/',
                    'home': '/home',
                    'denuncias': '/denuncias',
                    'emergencias': '/emergencias',
                    'mapas': '/mapas',
                    'admin': '/admin'
                }
            }
        }
    
    # ============================================
    # MANEJADORES DE ERRORES
    # ============================================
    @app.errorhandler(404)
    def not_found(error):
        """Maneja errores 404"""
        return {'error': 'Endpoint no encontrado', 'code': 404}, 404
    
    @app.errorhandler(500)
    def internal_error(error):
        """Maneja errores 500"""
        return {'error': 'Error interno del servidor', 'code': 500}, 500
    
    @app.errorhandler(403)
    def forbidden(error):
        """Maneja errores 403"""
        return {'error': 'Acceso prohibido', 'code': 403}, 403
    
    # ============================================
    # MENSAJE DE INICIO
    # ============================================
    print("\n" + "="*70)
    print("✅ SISTEMA INICIALIZADO CORRECTAMENTE")
    print("="*70)
    print(f"\n🌍 Servidor: http://127.0.0.1:5000")
    print(f"📊 Health Check: http://127.0.0.1:5000/health")
    print(f"📖 API Info: http://127.0.0.1:5000/api/info")
    print("\n" + "="*70 + "\n")
    
    return app


# ============================================
# CREAR APLICACIÓN
# ============================================
app = create_app()


# ============================================
# PUNTO DE ENTRADA
# ============================================
if __name__ == '__main__':
    # Configuración de desarrollo
    app.run(
        host='0.0.0.0',  # Accesible desde cualquier IP
        port=5000,
        debug=True,
        use_reloader=True,
        threaded=True
    )