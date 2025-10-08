"""
routes/api/auth.py
API de autenticación y gestión de usuarios
"""
from flask import Blueprint, request, jsonify, session, current_app
from werkzeug.utils import secure_filename
import os

import controladores.controlador_usuario as controlador_usuario
from utils.validators import validate_email, validate_dni, validate_phone
from utils.formatters import generar_codigo_verificacion
from utils.constants import *
from services.file_service import FileService

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['POST'])
def iniciar_sesion():
    """Inicio de sesión de usuario"""
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({"error": MSG_CAMPOS_REQUERIDOS}), HTTP_BAD_REQUEST

        # Verificar usuario
        ids = controlador_usuario.verificar_usuario(username, password)

        if ids and 'id_usuario' in ids and 'id_persona' in ids and 'verificado' in ids:
            id_usuario = ids['id_usuario']
            id_persona = ids['id_persona']
            id_verificado = ids['verificado']

            persona = controlador_usuario.obtener_persona_por_id(id_persona)

            if persona:
                # Guardar en sesión
                session['nombre'] = persona['nombre_completo']
                session['dni'] = persona['dni']
                session['numero_celular'] = persona['numero_celular']
                session['direccion'] = persona['direccion']

                return jsonify({
                    "message": "Login successful",
                    "user": {
                        "id_usuario": id_usuario,
                        "nombre": persona['nombre_completo'],
                        "dni": persona['dni'],
                        "numero_celular": persona['numero_celular'],
                        "direccion": persona['direccion'],
                        "verificado": id_verificado
                    }
                }), HTTP_OK
            else:
                return jsonify({"error": "User details could not be retrieved"}), HTTP_INTERNAL_ERROR
        else:
            return jsonify({"error": "Invalid username or password"}), HTTP_UNAUTHORIZED

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), HTTP_INTERNAL_ERROR


@auth_bp.route('/logout', methods=['POST'])
def cerrar_sesion():
    """Cierre de sesión"""
    session.clear()
    return jsonify({"message": "Session closed successfully"}), HTTP_OK


@auth_bp.route('/profile', methods=['GET'])
def obtener_perfil():
    """Obtiene perfil del usuario actual"""
    if "nombre" in session:
        return jsonify({
            "nombre": session["nombre"],
            "dni": session["dni"],
            "numero_celular": session["numero_celular"],
            "direccion": session["direccion"]
        }), HTTP_OK
    else:
        return jsonify({"error": MSG_USUARIO_NO_AUTENTICADO}), HTTP_UNAUTHORIZED


@auth_bp.route('/register', methods=['POST'])
def registrar_usuario():
    """Registro de nuevo usuario"""
    try:
        nombre = request.form.get('nombre')
        apellidos = request.form.get('apellidos')
        dni = request.form.get('dni')
        celular = request.form.get('celular')
        direccion = request.form.get('direccion')
        username = request.form.get('username')
        password = request.form.get('password')
        foto_file = request.files.get('foto_confirmacion')

        # Validar campos
        if not all([nombre, apellidos, dni, celular, direccion, username, password, foto_file]):
            return jsonify({"error": MSG_CAMPOS_REQUERIDOS}), HTTP_BAD_REQUEST

        if not validate_email(username):
            return jsonify({"error": "Email inválido"}), HTTP_BAD_REQUEST
        
        if not validate_dni(dni):
            return jsonify({"error": "DNI debe tener 8 dígitos"}), HTTP_BAD_REQUEST
        
        if not validate_phone(celular):
            return jsonify({"error": "Teléfono debe tener 9 dígitos"}), HTTP_BAD_REQUEST

        # Validar archivo
        is_valid, error_msg = FileService.validar_archivo(foto_file, 'imagen')
        if not is_valid:
            return jsonify({"error": error_msg}), HTTP_BAD_REQUEST

        # Generar código
        codigo_verificacion = generar_codigo_verificacion()

        # Registrar persona
        id_persona = controlador_usuario.registrar_persona(
            nombre, apellidos, dni, '', celular, direccion
        )

        if not id_persona:
            return jsonify({"error": "No se pudo registrar la persona"}), HTTP_INTERNAL_ERROR

        # Guardar foto
        ruta_foto = FileService.guardar_archivo(
            foto_file, id_persona, 'datos_personales', 'foto_confirmacion'
        )

        if ruta_foto:
            controlador_usuario.actualizar_foto_persona(id_persona, ruta_foto)

        # Enviar código
        email_service = current_app.email_service
        email_service.enviar_codigo_verificacion(username, codigo_verificacion)

        # Registrar usuario
        controlador_usuario.registrar_usuario(username, password, id_persona, codigo_verificacion)

        return jsonify({
            "message": MSG_REGISTRO_EXITOSO,
            "id_persona": id_persona
        }), HTTP_CREATED

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), HTTP_INTERNAL_ERROR


@auth_bp.route('/verify', methods=['POST'])
def verificar_usuario():
    """Verifica código de usuario"""
    try:
        data = request.json
        id_usuario = data.get('id_usuario')
        cod = data.get('cod')

        if not id_usuario or not cod:
            return jsonify({'success': False, 'message': 'Faltan datos'}), HTTP_BAD_REQUEST

        rpta = controlador_usuario.cambiar_estado_usuario(id_usuario, cod)

        if rpta:
            return jsonify({'success': True, 'message': "Usuario verificado correctamente"}), HTTP_OK
        else:
            return jsonify({'success': False, 'message': "Código incorrecto"}), HTTP_BAD_REQUEST

    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'message': 'Error en el servidor',
            'error': str(e)
        }), HTTP_INTERNAL_ERROR


@auth_bp.route('/change-password', methods=['POST'])
def cambiar_contrasena():
    """Cambia contraseña de usuario"""
    try:
        data = request.json
        id_usuario = data.get('id_usuario')
        contra_actual = data.get('contra_actual')
        nueva_contrasena = data.get('nueva_contrasena')
        confirmar_contrasena = data.get('confirmar_contrasena')

        if not all([id_usuario, contra_actual, nueva_contrasena, confirmar_contrasena]):
            return jsonify({"error": MSG_CAMPOS_REQUERIDOS}), HTTP_BAD_REQUEST

        if nueva_contrasena != confirmar_contrasena:
            return jsonify({"error": "Las contraseñas no coinciden"}), HTTP_BAD_REQUEST

        resultado = controlador_usuario.cambiar_contrasena(id_usuario, contra_actual, nueva_contrasena)

        if resultado:
            return jsonify({"message": "Contraseña cambiada exitosamente"}), HTTP_OK
        else:
            return jsonify({"error": "No se pudo cambiar la contraseña"}), HTTP_INTERNAL_ERROR

    except Exception as e:
        return jsonify({"error": f"Ocurrió un error: {str(e)}"}), HTTP_INTERNAL_ERROR