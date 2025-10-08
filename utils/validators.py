"""
utils/validators.py
Funciones de validación
"""
import re


def allowed_file(filename, allowed_extensions):
    """Valida si la extensión del archivo está permitida"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions


def validate_email(email):
    """Valida formato de email"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_dni(dni):
    """Valida formato de DNI (8 dígitos)"""
    return dni.isdigit() and len(dni) == 8


def validate_phone(phone):
    """Valida formato de teléfono (9 dígitos)"""
    return phone.isdigit() and len(phone) == 9


def validate_coordinates(lat, lon):
    """Valida coordenadas geográficas"""
    try:
        lat = float(lat)
        lon = float(lon)
        return -90 <= lat <= 90 and -180 <= lon <= 180
    except (ValueError, TypeError):
        return False


def validate_required_fields(data, required_fields):
    """Valida que todos los campos requeridos estén presentes"""
    missing = [field for field in required_fields if not data.get(field)]
    return len(missing) == 0, missing