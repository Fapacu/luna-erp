from decimal import Decimal

from .models import MovimientoCaja


def registrar_movimiento_caja(caja, tipo, descripcion, monto, usuario=None):
    return MovimientoCaja.objects.create(
        caja=caja, tipo=tipo, descripcion=descripcion, monto=Decimal(str(monto)), usuario=usuario
    )
