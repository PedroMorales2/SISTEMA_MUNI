"""
services/email_service.py
Servicio centralizado para envío de emails
"""
from flask_mail import Message
from flask import current_app


class EmailService:
    """Servicio para gestionar envío de correos"""
    
    def __init__(self, mail):
        self.mail = mail
    
    def enviar_codigo_verificacion(self, destinatario, codigo):
        """Envía código de verificación al usuario"""
        try:
            msg = Message(
                subject='Código de verificación - Sistema de Denuncias',
                sender=current_app.config['MAIL_USERNAME'],
                recipients=[destinatario],
                body=f'''
Hola,

Tu código de verificación es: {codigo}

Este código es válido por 24 horas.

Si no solicitaste este código, ignora este mensaje.

Saludos,
Sistema de Denuncias Municipales
                '''.strip()
            )
            
            self.mail.send(msg)
            return True
            
        except Exception as e:
            print(f"❌ Error enviando email de verificación: {e}")
            return False
    
    def enviar_notificacion_denuncia(self, destinatario, id_incidencia, nombre_area):
        """Notifica a autoridades sobre nueva denuncia"""
        try:
            msg = Message(
                subject=f'Nueva Denuncia Recibida - {nombre_area}',
                sender=current_app.config['MAIL_USERNAME'],
                recipients=[destinatario],
                body=f'''
Se ha registrado una nueva denuncia en el sistema.

ID de Incidencia: {id_incidencia}
Área Responsable: {nombre_area}

Por favor, revisa el sistema para más detalles.

Saludos,
Sistema de Denuncias Municipales
                '''.strip()
            )
            
            self.mail.send(msg)
            return True
            
        except Exception as e:
            print(f"❌ Error enviando notificación a {destinatario}: {e}")
            return False
    
    def enviar_notificaciones_multiples(self, correos, id_incidencia):
        """Envía notificaciones a múltiples destinatarios"""
        enviados = 0
        fallidos = 0
        
        for fila in correos:
            correo = fila.get('correo')
            nombre_area = fila.get('nombre_area', 'Sin área')
            
            if self.enviar_notificacion_denuncia(correo, id_incidencia, nombre_area):
                enviados += 1
            else:
                fallidos += 1
        
        return {'enviados': enviados, 'fallidos': fallidos}