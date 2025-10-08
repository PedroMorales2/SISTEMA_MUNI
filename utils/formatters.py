"""
utils/formatters.py
Funciones de formateo de datos
"""
from datetime import datetime, timedelta, date
import random


def formatear_fecha_hora(fecha_obj, hora_valor):
    """Formatea fecha y hora en formato legible"""
    if isinstance(fecha_obj, datetime):
        fecha_dt = fecha_obj.replace(hour=0, minute=0, second=0, microsecond=0)
    elif isinstance(fecha_obj, date):
        fecha_dt = datetime(fecha_obj.year, fecha_obj.month, fecha_obj.day)
    else:
        try:
            fecha_dt = datetime.strptime(str(fecha_obj), '%a, %d %b %Y %H:%M:%S %Z')
        except:
            fecha_dt = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    if isinstance(hora_valor, timedelta):
        hora_dt = hora_valor
    else:
        try:
            hora_dt = timedelta(seconds=float(hora_valor))
        except:
            hora_dt = timedelta(seconds=0)
    
    fecha_hora = fecha_dt + hora_dt
    return fecha_hora.strftime('%d del %m del año %Y a las %H:%M')


def serializar_denuncia(denuncia):
    """Serializa una denuncia para JSON"""
    resultado = {}
    fecha_obj = None
    hora_valor = None
    
    for key, value in denuncia.items():
        if key == "fecha":
            fecha_obj = value
        elif key == "hora":
            hora_valor = value
        else:
            resultado[key] = value
    
    if fecha_obj and hora_valor is not None:
        resultado['fecha'] = formatear_fecha_hora(fecha_obj, hora_valor)
    
    return resultado


def parsear_ubicacion(ubicacion_str):
    """Parsea string de ubicación en coordenadas"""
    try:
        parts = str(ubicacion_str).split(',')
        return {
            'latitud': float(parts[0].strip()),
            'longitud': float(parts[1].strip())
        }
    except:
        return {'latitud': None, 'longitud': None}


def convertir_estado_texto(estado):
    """Convierte código de estado a texto"""
    estados = {'1': 'Pendiente', '2': 'Aceptado', '3': 'Rechazado'}
    return estados.get(str(estado), 'Desconocido')


def generar_codigo_verificacion():
    """Genera código de verificación de 4 dígitos"""
    return random.randint(1000, 9999)