"""
routes/views/auth_views.py
Vistas de autenticación (Frontend)
"""
from flask import Blueprint, render_template, request, redirect, url_for, session, flash
import requests

auth_views_bp = Blueprint('auth_views', __name__)

API_BASE_URL = 'http://127.0.0.1:5000'
#API_BASE_URL = 'https://munireque.pythonanywhere.com'

@auth_views_bp.route('/')
def index():
    """Página de inicio/login"""
    return render_template('inicio_sesion.html')


@auth_views_bp.route('/login', methods=['POST'])
def login():
    """Procesa login de usuario administrador"""
    email = request.form.get('email')
    password = request.form.get('password')

    payload = {
        "user": email,
        "contrasena": password
    }

    try:
        response = requests.post(f'{API_BASE_URL}/api/central/login', json=payload)

        if response.status_code == 200:
            data = response.json()

            if 'usuario' in data:
                # Guardar en sesión
                session['logged_in'] = True
                session['id_usuario'] = data['usuario']['id_correo']
                session['nombre_area'] = data['usuario']['nombre_area']
                
                return redirect(url_for('auth_views.home'))
            else:
                flash('Credenciales inválidas', 'error')
                return redirect(url_for('auth_views.index'))
        else:
            flash('Error al conectar con el servidor', 'error')
            return redirect(url_for('auth_views.index'))

    except Exception as e:
        flash(f'Error: {str(e)}', 'error')
        return redirect(url_for('auth_views.index'))


@auth_views_bp.route('/logout')
def logout():
    """Cierra sesión"""
    session.clear()
    flash('Sesión cerrada correctamente', 'success')
    return redirect(url_for('auth_views.index'))


@auth_views_bp.route('/home')
def home():
    """Dashboard principal"""
    if not session.get('logged_in'):
        return redirect(url_for('auth_views.index'))
    
    return render_template('index.html')