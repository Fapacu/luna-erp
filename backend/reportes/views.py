from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework.exceptions import PermissionDenied
from finanzas.models import MovimientoFinanciero
from ventas.models import Venta, DetalleVenta
from compras.models import Compra
from django.db.models import Sum
from django.utils.timezone import now,make_aware
from django.db import models
from decimal import Decimal
from datetime import datetime, timedelta

from ventas.models import Venta, DetalleVenta, Caja
from inventario.models import Producto
from .pdf import generar_pdf

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_financiero(request):

    ventas_total = Venta.objects.filter(
        estado='COMPLETADA'
    ).aggregate(
        total=Sum('total')
    )['total'] or 0

    compras_total = Compra.objects.aggregate(
        total=Sum('total')
    )['total'] or 0


    ganancia_total = DetalleVenta.objects.filter(
        venta__estado='COMPLETADA'
    ).aggregate(
        total=Sum('ganancia')
    )['total'] or 0


    margen = 0

    if ventas_total > 0:
        margen = (ganancia_total / ventas_total) * 100


    top_productos = DetalleVenta.objects.values(
        'producto__nombre'
    ).annotate(
        ganancia_total=Sum('ganancia')
    ).order_by('-ganancia_total')[:5]


    return Response({

        "ventas_total": float(ventas_total),

        "compras_total": float(compras_total),

        "ganancia_total": float(ganancia_total),

        "margen": round(float(margen), 2),

        "top_productos": list(top_productos)

    })



# 🔹 DASHBOARD SIMPLE (HOY)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_data(request):

    try:
        rol = request.user.usuarioperfil.role.nombre
    except:
        rol = ""

    if not request.user.is_staff and rol not in ['ADMIN', 'GERENTE']:
        raise PermissionDenied("No tienes permiso")

    hoy = now().date()

    ventas_hoy = Venta.objects.filter(fecha__date=hoy),
    estado='COMPLETADA'

    total_hoy = ventas_hoy.aggregate(total=Sum('total'))['total'] or 0

    efectivo = ventas_hoy.filter(metodo_pago='EFECTIVO').aggregate(total=Sum('total'))['total'] or 0
    tarjeta = ventas_hoy.filter(metodo_pago='TARJETA').aggregate(total=Sum('total'))['total'] or 0
    transferencia = ventas_hoy.filter(metodo_pago='TRANSFERENCIA').aggregate(total=Sum('total'))['total'] or 0

    productos_hoy = DetalleVenta.objects.filter(
        venta__fecha__date=hoy
    ).aggregate(total=Sum('cantidad'))['total'] or 0

    cajas_abiertas = Caja.objects.filter(abierta=True)

    caja_total = sum(
        float(c.monto_inicial or 0) + float(c.total_vendido or 0)
        for c in cajas_abiertas
    )

    return Response({
        "total_hoy": total_hoy,
        "efectivo": efectivo,
        "tarjeta": tarjeta,
        "transferencia": transferencia,
        "productos_hoy": productos_hoy,
        "caja_total": caja_total
    })


# 🔹 PRODUCTOS POR MES
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def productos_mas_vendidos(request):

    try:
        rol = request.user.usuarioperfil.role.nombre
    except:
        rol = ""

    if not request.user.is_staff and rol not in ['ADMIN', 'GERENTE']:
        raise PermissionDenied("No tienes permiso")

    mes = request.GET.get('mes')
    anio = request.GET.get('anio')

    if not mes or not anio:
        return Response({"error": "Debe enviar mes y año"}, status=400)

    ventas = DetalleVenta.objects.filter(
        venta__fecha__month=mes,
        venta__fecha__year=anio
    )

    productos = ventas.values('producto__nombre') \
        .annotate(
            cantidad_total=Sum('cantidad'),
            total_generado=Sum('subtotal')
        ) \
        .order_by('-cantidad_total')

    return Response(list(productos))


# 🔥 DASHBOARD PRINCIPAL
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_reporte(request):

    try:
        rol = request.user.usuarioperfil.role.nombre
    except:
        rol = ""

    if not request.user.is_staff and rol not in ['ADMIN', 'GERENTE']:
        raise PermissionDenied("No tienes permiso")

    desde = request.GET.get('desde')
    hasta = request.GET.get('hasta')

    if not desde or not hasta:
        return Response({"error": "Debe enviar desde y hasta"}, status=400)

    # ✅ validar fechas
    try:
        desde_date = make_aware(datetime.strptime(desde, "%Y-%m-%d"))
        hasta_date = make_aware(datetime.strptime(hasta, "%Y-%m-%d"))
    except:
        return Response({"error": "Fechas inválidas"}, status=400)

    # 📅 PERIODO ACTUAL
    ventas = Venta.objects.filter(fecha__range=[desde_date, hasta_date], estado='COMPLETADA')
    ventas_ids = ventas.values_list('id', flat=True)

    # 🔙 PERIODO ANTERIOR
    dias = (hasta_date - desde_date).days
    anterior_desde = desde_date - timedelta(days=dias + 1)
    anterior_hasta = desde_date - timedelta(days=1)

    ventas_anterior = Venta.objects.filter(
        fecha__range=[anterior_desde, anterior_hasta],
        estado='COMPLETADA'
    )

    # 🔢 MÉTRICAS
    total_ventas = ventas.count()

    ingreso_total = ventas.aggregate(total=Sum('total'))['total'] or 0

        # ======================================
    # EGRESOS ERP
    # ======================================

    egresos = MovimientoFinanciero.objects.filter(
        tipo="EGRESO",
        fecha__range=[desde_date, hasta_date]
    )

    egreso_total = egresos.aggregate(
        total=Sum('monto')
    )['total'] or 0


    # ======================================
    # UTILIDAD NETA
    # ======================================

    utilidad_neta = ingreso_total - egreso_total


    # ======================================
    # TICKET PROMEDIO
    # ======================================

    ticket_promedio = 0

    if total_ventas > 0:

        ticket_promedio = (
            ingreso_total / total_ventas
        )


    # ======================================
    # ROI
    # ======================================

    roi = 0

    if egreso_total > 0:

        roi = (
            (utilidad_neta / egreso_total)
            * 100
        )


    # ======================================
    # MARGEN
    # ======================================

    margen = 0

    if ingreso_total > 0:

        margen = (
            (utilidad_neta / ingreso_total)
            * 100
        )

    total_productos = DetalleVenta.objects.filter(
        venta_id__in=ventas_ids
    ).aggregate(total=Sum('cantidad'))['total'] or 0

    ingreso_anterior = ventas_anterior.aggregate(
        total=Sum('total')
    )['total'] or 0

    crecimiento = 0
    if ingreso_anterior > 0:
        crecimiento = ((ingreso_total - ingreso_anterior) / ingreso_anterior) * 100

    # 🏆 PRODUCTOS

    productos = DetalleVenta.objects.filter(
        venta_id__in=ventas_ids
    ).values(
        'producto__nombre',
        'producto__unidad'
    ).annotate(
        cantidad=Sum('cantidad')
    ).order_by('-cantidad')[:10]


    lista_productos = [
        {
            "nombre": p["producto__nombre"],
            "cantidad": float(p["cantidad"] or 0),
            "unidad": p["producto__unidad"]
        }
        for p in productos
    ]

    # 📈 VENTAS POR DÍA
    ventas_por_dia = ventas.values('fecha__date') \
        .annotate(total=Sum('total')) \
        .order_by('fecha__date')

    grafico_linea = [
        {
            "fecha": str(v["fecha__date"]),
            "total": v["total"]
        }
        for v in ventas_por_dia
    ]

    # 💳 MÉTODOS DE PAGO
    metodos = ventas.values('metodo_pago') \
        .annotate(total=Sum('total'))

    # 👤 CLIENTES TOP
    clientes = ventas.values(
        'cliente__nombre'
    ).annotate(
        total=Sum('total')
    ).order_by('-total')[:5]

    # 🧠 PREDICCIÓN (POR DÍA)
    ventas_por_dia_totales = [v["total"] for v in ventas_por_dia]

    prediccion = 0
    if ventas_por_dia_totales:
        promedio = sum(ventas_por_dia_totales) / len(ventas_por_dia_totales)
        prediccion = promedio * Decimal('1.10')

    # 📦 ALERTAS STOCK
    alertas = Producto.objects.filter(
        stock__lte=models.F('stock_minimo')
    ).values('nombre', 'stock')

    return Response({
        "total_ventas": total_ventas,
        "total_productos": float(total_productos),
        "ingreso_total": float(ingreso_total),
        "crecimiento": round(crecimiento, 2),

        "productos": lista_productos,
        "ventas_por_dia": grafico_linea,

        "metodos": list(metodos),
        "clientes_top": list(clientes),
        "prediccion": float(prediccion),
        "alertas_stock": list(alertas),

        "egreso_total": float(egreso_total),

        "utilidad_neta": float(utilidad_neta),

        "ticket_promedio": float(ticket_promedio),

        "roi": round(float(roi), 2),

        "margen": round(float(margen), 2),
    })


# 🔹 ALERTAS STOCK
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def alertas_stock(request):

    productos = Producto.objects.filter(
        stock__lte=models.F('stock_minimo')
    )

    return Response(list(productos.values(
        'id', 'nombre', 'stock', 'stock_minimo'
    )))


# 🔹 EXPORTAR PDF
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def exportar_pdf(request):

    productos = request.data.get("productos", [])

    if not productos:
        return Response({"error": "No hay datos"}, status=400)

    return generar_pdf(productos)