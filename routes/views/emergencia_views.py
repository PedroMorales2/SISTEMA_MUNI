"""
routes/views/emergencia_views.py
Vistas de emergencias (Frontend)
"""
from flask import Blueprint, render_template, session, redirect, url_for

emergencia_views_bp = Blueprint('emergencia_views', __name__)


def require_login(func):
    """Decorador para requerir login"""
    def wrapper(*args, **kwargs):
        if not session.get('logged_in'):
            return redirect(url_for('auth_views.index'))
        return func(*args, **kwargs)
    wrapper.__name__ = func.__name__
    return wrapper


@emergencia_views_bp.route('/pendientes')
@require_login
def emergencia_pendiente():
    """Página de emergencias pendientes"""
    return render_template('emergencias/emergencia_pendiente.html')


@emergencia_views_bp.route('/resueltas')
@require_login
def emergencia_resuelta():
    """Página de emergencias resueltas"""
    return render_template('emergencias/emergencia_resuelta.html')


@emergencia_views_bp.route('/rechazadas')
@require_login
def emergencia_rechazada():
    """Página de emergencias rechazadas"""
    return render_template('emergencias/emergencia_rechazada.html')


@emergencia_views_bp.route('/detalle/<id>')
@require_login
def detalle_emergencia(id):
    """Detalle de emergencia (sin edición)"""
    return render_template('emergencias/ver_detalle_emergencia.html', id=id, vision=False)


@emergencia_views_bp.route('/detalle/<id>/editar')
@require_login
def detalle_emergencias(id):
    """Detalle de emergencia (con edición)"""
    return render_template('emergencias/ver_detalle_emergencia.html', id=id, vision=True)