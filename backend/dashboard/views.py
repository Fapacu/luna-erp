from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ventas.models import Venta, DetalleVenta
from inventario.models import Producto

from django.db.models import Sum, F
from ventas.models import Caja
from django.utils.timezone import localdate


# ======================
# ESTADÍSTICAS GENERALES
# ======================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def estadisticas(request):

    # 🔥 RANGO DEL DÍA (SOLUCIÓN ZONA HORARIA)
    hoy = localdate()

    ventas = Venta.objects.filter(
        fecha__date=hoy,
        estado="COMPLETADA",
    )

    # 💰 TOTAL DEL DÍA
    total_hoy = ventas.aggregate(total=Sum('total'))['total'] or 0

    # 📦 PRODUCTOS VENDIDOS
    productos_hoy = DetalleVenta.objects.filter(
        venta__in=ventas
    ).aggregate(total=Sum("cantidad"))["total"] or 0

    # 💵 CAJA TOTAL
    cajas_abiertas = Caja.objects.filter(abierta=True)
    caja_total = sum(
        c.monto_inicial + sum(
            (m.monto if m.tipo == "INGRESO" else -m.monto)
            for m in c.movimientocaja_set.all()
            if m.tipo in {"INGRESO", "RETIRO", "GASTO"}
        )
        for c in cajas_abiertas
    )

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
@permission_classes([IsAuthenticated])
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
