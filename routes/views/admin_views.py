"""
routes/views/admin_views.py
Vistas de administración (Frontend)
"""
from flask import Blueprint, render_template, session, redirect, url_for
import requests

admin_views_bp = Blueprint('admin_views', __name__)

API_BASE_URL = 'http://127.0.0.1:5000'


def require_login(func):
    """Decorador para requerir login"""
    def wrapper(*args, **kwargs):
        if not session.get('logged_in'):
            return redirect(url_for('auth_views.index'))
        return func(*args, **kwargs)
    wrapper.__name__ = func.__name__
    return wrapper


@admin_views_bp.route('/usuarios')
@require_login
def ver_usuario():
    """Página para ver usuarios"""
    return render_template('admin/ver_usuario.html')


@admin_views_bp.route('/usuarios/agregar')
@require_login
def agregar_usuario():
    """Página para agregar nuevo usuario"""
    try:
        response_riesgo = requests.get(f'{API_BASE_URL}/api/central/usuarios/riesgos_disponibles')
        response_denuncia = requests.get(f'{API_BASE_URL}/api/central/usuarios/denuncias_disponibles')

        riesgos = response_riesgo.json().get("message", []) if response_riesgo.status_code == 200 else []
        denuncias = response_denuncia.json().get("message", []) if response_denuncia.status_code == 200 else []

        return render_template('admin/agregar_usuario.html', riesgos=riesgos, denuncias=denuncias)
        
    except Exception as e:
        print(f"Error obteniendo datos: {e}")
        return render_template('admin/agregar_usuario.html', riesgos=[], denuncias=[])


@admin_views_bp.route('/prediccion')
@require_login
def prediccion():
    """Página de predicciones LSTM"""
    return render_template('admin/prediccion.html')