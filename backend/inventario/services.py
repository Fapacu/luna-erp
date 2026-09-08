from decimal import Decimal
from .models import MovimientoStock

def registrar_movimiento(
    producto,
    tipo,
    cantidad,
    usuario=None,
    motivo=""
):

    cantidad = Decimal(str(cantidad))

    stock_anterior = producto.stock

    if tipo == "COMPRA":
        producto.stock += cantidad

    elif tipo == "VENTA":

        if producto.stock < cantidad:
            raise Exception(
                f"Stock insuficiente para {producto.nombre}"
            )

        producto.stock -= cantidad

    elif tipo == "AJUSTE":
        producto.stock += cantidad

    stock_nuevo = producto.stock

    producto.save()

    MovimientoStock.objects.create(
        producto=producto,
        tipo=tipo,
        cantidad=cantidad,
        usuario=usuario,
        motivo=motivo,
        stock_anterior=stock_anterior,
        stock_nuevo=stock_nuevo
    )