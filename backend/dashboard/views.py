from rest_framework.decorators import api_view
from rest_framework.response import Response

from ventas.models import Venta, DetalleVenta
from inventario.models import Producto

from django.db.models import Sum, F
from django.utils.timezone import now
from datetime import timedelta


# ======================
# ESTADÍSTICAS GENERALES
# ======================

@api_view(['GET'])
def estadisticas(request):

    # 🔥 RANGO DEL DÍA (SOLUCIÓN ZONA HORARIA)
    inicio = now().replace(hour=0, minute=0, second=0, microsecond=0)
    fin = inicio + timedelta(days=1)

    ventas = Venta.objects.filter(
        fecha__gte=inicio,
        fecha__lt=fin
    )

    # 💰 TOTAL DEL DÍA
    total_hoy = ventas.aggregate(total=Sum('total'))['total'] or 0

    # 📦 PRODUCTOS VENDIDOS
    productos_hoy = DetalleVenta.objects.filter(
        venta__fecha__gte=inicio,
        venta__fecha__lt=fin
    ).count()

    # 💵 CAJA TOTAL
    caja_total = total_hoy

    # 💳 MÉTODOS DE PAGO
    efectivo = ventas.filter(metodo_pago="EFECTIVO").aggregate(total=Sum('total'))['total'] or 0
    tarjeta = ventas.filter(metodo_pago="TARJETA").aggregate(total=Sum('total'))['total'] or 0
    transferencia = ventas.filter(metodo_pago="TRANSFERENCIA").aggregate(total=Sum('total'))['total'] or 0

    # ⚠ STOCK BAJO (CANTIDAD)
    stock_bajo = Producto.objects.filter(
        stock__lte=F('stock_minimo')
    ).count()

    return Response({
        "total_hoy": total_hoy,
        "productos_hoy": productos_hoy,
        "caja_total": caja_total,
        "efectivo": efectivo,
        "tarjeta": tarjeta,
        "transferencia": transferencia,
        "stock_bajo": stock_bajo
    })


# ======================
# ALERTAS STOCK BAJO
# ======================

@api_view(['GET'])
def alertas_stock(request):

    productos = Producto.objects.filter(
        stock__lte=F('stock_minimo')
    )

    data = []

    for p in productos:
        data.append({
            "id": p.id,
            "nombre": p.nombre,
            "stock": p.stock,
            "stock_minimo": p.stock_minimo
        })

    return Response(data)