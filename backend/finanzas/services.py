from decimal import Decimal

from .models import MovimientoFinanciero


def registrar_ingreso(categoria, descripcion, monto, usuario=None, metodo_pago="efectivo", referencia=""):
    return MovimientoFinanciero.objects.create(
        tipo="INGRESO",
        categoria=categoria,
        descripcion=descripcion,
        monto=Decimal(str(monto)),
        usuario=usuario,
        metodo_pago=metodo_pago,
        referencia=referencia,
    )


def registrar_egreso(categoria, descripcion, monto, usuario=None, metodo_pago="efectivo", referencia=""):
    return MovimientoFinanciero.objects.create(
        tipo="EGRESO",
        categoria=categoria,
        descripcion=descripcion,
        monto=Decimal(str(monto)),
        usuario=usuario,
        metodo_pago=metodo_pago,
        referencia=referencia,
    )
