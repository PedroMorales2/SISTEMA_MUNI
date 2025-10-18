"""
routes/views/mapa_views.py
Vistas de mapas (Frontend)
"""
from flask import Blueprint, render_template, session, redirect, url_for

mapa_views_bp = Blueprint('mapa_views', __name__)


def require_login(func):
    """Decorador para requerir login"""
    def wrapper(*args, **kwargs):
        if not session.get('logged_in'):
            return redirect(url_for('auth_views.index'))
        return func(*args, **kwargs)
    wrapper.__name__ = func.__name__
    return wrapper


@mapa_views_bp.route('/interactivo')
@require_login
def mapa_interactivo():
    """Mapa interactivo con marcadores"""
    return render_template('mapas/mapa_box.html')


@mapa_views_bp.route('/calor')
@require_login
def mapa_interactivo_calor():
    """Mapa de calor (heatmap)"""
    return render_template('mapas/mapa.html')


@mapa_views_bp.route('/dbscan')
@require_login
def mapa_dbscan():
    """Mapa con clustering DBSCAN"""
    return render_template('mapas/mapa.html')