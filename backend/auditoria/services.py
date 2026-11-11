from .models import Auditoria


def registrar_auditoria(usuario, modulo, accion, referencia="", detalle="", ip=None):
    Auditoria.objects.create(
        usuario=usuario, modulo=modulo, accion=accion, referencia=referencia, detalle=detalle, ip=ip
    )
