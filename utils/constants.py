"""
utils/constants.py
Constantes globales de la aplicación
"""

# Estados de incidencias
ESTADO_PENDIENTE = '1'
ESTADO_ACEPTADO = '2'
ESTADO_RECHAZADO = '3'

ESTADOS = {
    ESTADO_PENDIENTE: 'Pendiente',
    ESTADO_ACEPTADO: 'Aceptado',
    ESTADO_RECHAZADO: 'Rechazado'
}

# Tipos de incidencias
TIPO_EMERGENCIA = 4

# Códigos HTTP
HTTP_OK = 200
HTTP_CREATED = 201
HTTP_BAD_REQUEST = 400
HTTP_UNAUTHORIZED = 401
HTTP_NOT_FOUND = 404
HTTP_INTERNAL_ERROR = 500
HTTP_SERVICE_UNAVAILABLE = 503

# Mensajes
MSG_CAMPOS_REQUERIDOS = "Todos los campos son obligatorios"
MSG_USUARIO_NO_AUTENTICADO = "Usuario no autenticado"
MSG_ERROR_INTERNO = "Error interno del servidor"
MSG_REGISTRO_EXITOSO = "Registro exitoso"

# Formatos de fecha
FORMATO_FECHA = '%Y-%m-%d'
FORMATO_FECHA_HORA = '%Y-%m-%d %H:%M:%S'
FORMATO_FECHA_PERSONALIZADO = '%d del %m del año %Y a las %H:%M'