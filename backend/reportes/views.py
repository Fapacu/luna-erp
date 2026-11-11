"""Indicadores y reportes de gestión (ADMIN/GERENTE)."""

from datetime import datetime, timedelta
from decimal import Decimal

from django.db import models
from django.db.models import Sum
from django.utils.timezone import localdate, make_aware
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from compras.models import Compra
from config.fechas import rango_dia, rango_mes, totales_por_dia
from finanzas.models import MovimientoFinanciero
from inventario.models import Producto
from usuarios.permissions import obtener_rol
from ventas.models import Caja, DetalleVenta, MovimientoCaja, Venta

from .pdf import generar_pdf


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_financiero(request):
    if not request.user.is_staff and obtener_rol(request.user) not in ["ADMIN", "GERENTE"]:
        raise PermissionDenied("No tienes permiso")

    ventas_total = Venta.objects.filter(estado="COMPLETADA").aggregate(total=Sum("total"))["total"] or 0

    compras_total = Compra.objects.exclude(estado="ANULADA").aggregate(total=Sum("total"))["total"] or 0

    ganancia_total = (
        DetalleVenta.objects.filter(venta__estado="COMPLETADA").aggregate(total=Sum("ganancia"))["total"] or 0
    )

    margen = 0

    if ventas_total > 0:
        margen = (ganancia_total / ventas_total) * 100

    top_productos = (
        DetalleVenta.objects.filter(venta__estado="COMPLETADA")
        .values("producto__nombre")
        .annotate(ganancia_total=Sum("ganancia"))
        .order_by("-ganancia_total")[:5]
    )

    return Response(
        {
            "ventas_total": float(ventas_total),
            "compras_total": float(compras_total),
            "ganancia_total": float(ganancia_total),
            "margen": round(float(margen), 2),
            "top_productos": list(top_productos),
        }
    )


# 🔹 DASHBOARD SIMPLE (HOY)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_data(request):
    rol = obtener_rol(request.user)

    if not request.user.is_staff and rol not in ["ADMIN", "GERENTE"]:
        raise PermissionDenied("No tienes permiso")

    inicio, fin = rango_dia(localdate())

    ventas_hoy = Venta.objects.filter(fecha__gte=inicio, fecha__lt=fin, estado="COMPLETADA")

    total_hoy = ventas_hoy.aggregate(total=Sum("total"))["total"] or 0

    efectivo = ventas_hoy.filter(metodo_pago="EFECTIVO").aggregate(total=Sum("total"))["total"] or 0
    tarjeta = ventas_hoy.filter(metodo_pago="TARJETA").aggregate(total=Sum("total"))["total"] or 0
    transferencia = ventas_hoy.filter(metodo_pago="TRANSFERENCIA").aggregate(total=Sum("total"))["total"] or 0

    productos_hoy = (
        DetalleVenta.objects.filter(
            venta__in=ventas_hoy,
        ).aggregate(total=Sum("cantidad"))["total"]
        or 0
    )

    cajas_abiertas = Caja.objects.filter(abierta=True)
    caja_total = 0
    for caja in cajas_abiertas:
        movimientos = {
            item["tipo"]: item["total"] or Decimal("0")
            for item in MovimientoCaja.objects.filter(caja=caja).values("tipo").annotate(total=Sum("monto"))
        }
        caja_total += caja.monto_inicial + movimientos.get("INGRESO", Decimal("0"))
        caja_total -= movimientos.get("RETIRO", Decimal("0")) + movimientos.get("GASTO", Decimal("0"))

    return Response(
        {
            "total_hoy": total_hoy,
            "efectivo": efectivo,
            "tarjeta": tarjeta,
            "transferencia": transferencia,
            "productos_hoy": productos_hoy,
            "caja_total": caja_total,
        }
    )


# 🔹 PRODUCTOS POR MES
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def productos_mas_vendidos(request):
    rol = obtener_rol(request.user)

    if not request.user.is_staff and rol not in ["ADMIN", "GERENTE"]:
        raise PermissionDenied("No tienes permiso")

    mes = request.GET.get("mes")
    anio = request.GET.get("anio")

    if not mes or not anio:
        return Response({"error": "Debe enviar mes y año"}, status=400)

    try:
        inicio, fin = rango_mes(int(anio), int(mes))
    except (TypeError, ValueError):
        return Response({"error": "Mes o año inválido"}, status=400)

    ventas = DetalleVenta.objects.filter(
        venta__fecha__gte=inicio,
        venta__fecha__lt=fin,
        venta__estado="COMPLETADA",
    )

    productos = (
        ventas.values("producto__nombre")
        .annotate(cantidad_total=Sum("cantidad"), total_generado=Sum("subtotal"))
        .order_by("-cantidad_total")
    )

    return Response(list(productos))


# 🔥 DASHBOARD PRINCIPAL
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_reporte(request):
    rol = obtener_rol(request.user)

    if not request.user.is_staff and rol not in ["ADMIN", "GERENTE"]:
        raise PermissionDenied("No tienes permiso")

    desde = request.GET.get("desde")
    hasta = request.GET.get("hasta")

    if not desde or not hasta:
        return Response({"error": "Debe enviar desde y hasta"}, status=400)

    # ✅ validar fechas
    try:
        desde_date = make_aware(datetime.strptime(desde, "%Y-%m-%d"))
        hasta_date = make_aware(datetime.strptime(hasta, "%Y-%m-%d"))
        if hasta_date < desde_date:
            return Response({"error": "El fin del periodo no puede ser anterior al inicio."}, status=400)
        hasta_exclusivo = hasta_date + timedelta(days=1)
    except (TypeError, ValueError):
        return Response({"error": "Fechas inválidas"}, status=400)

    # 📅 PERIODO ACTUAL
    ventas = Venta.objects.filter(
        fecha__gte=desde_date,
        fecha__lt=hasta_exclusivo,
        estado="COMPLETADA",
    )
    ventas_ids = ventas.values_list("id", flat=True)

    # 🔙 PERIODO ANTERIOR
    dias = (hasta_exclusivo - desde_date).days
    anterior_desde = desde_date - timedelta(days=dias)
    anterior_hasta = desde_date

    ventas_anterior = Venta.objects.filter(
        fecha__gte=anterior_desde, fecha__lt=anterior_hasta, estado="COMPLETADA"
    )

    # 🔢 MÉTRICAS
    total_ventas = ventas.count()

    ingreso_total = ventas.aggregate(total=Sum("total"))["total"] or 0

    # ======================================
    # EGRESOS ERP
    # ======================================

    egresos = MovimientoFinanciero.objects.filter(
        tipo="EGRESO",
        fecha__gte=desde_date,
        fecha__lt=hasta_exclusivo,
    )

    egreso_total = egresos.aggregate(total=Sum("monto"))["total"] or 0

    # ======================================
    # UTILIDAD NETA
    # ======================================

    utilidad_neta = ingreso_total - egreso_total

    # ======================================
    # TICKET PROMEDIO
    # ======================================

    ticket_promedio = 0

    if total_ventas > 0:
        ticket_promedio = ingreso_total / total_ventas

    # ======================================
    # ROI
    # ======================================

    roi = 0

    if egreso_total > 0:
        roi = (utilidad_neta / egreso_total) * 100

    # ======================================
    # MARGEN
    # ======================================

    margen = 0

    if ingreso_total > 0:
        margen = (utilidad_neta / ingreso_total) * 100

    total_productos = (
        DetalleVenta.objects.filter(venta_id__in=ventas_ids).aggregate(total=Sum("cantidad"))["total"] or 0
    )

    ingreso_anterior = ventas_anterior.aggregate(total=Sum("total"))["total"] or 0

    crecimiento = 0
    if ingreso_anterior > 0:
        crecimiento = ((ingreso_total - ingreso_anterior) / ingreso_anterior) * 100

    # 🏆 PRODUCTOS

    productos = (
        DetalleVenta.objects.filter(venta_id__in=ventas_ids)
        .values("producto__nombre", "producto__unidad")
        .annotate(cantidad=Sum("cantidad"))
        .order_by("-cantidad")[:10]
    )

    lista_productos = [
        {
            "nombre": p["producto__nombre"],
            "cantidad": float(p["cantidad"] or 0),
            "unidad": p["producto__unidad"],
        }
        for p in productos
    ]

    # 📈 VENTAS POR DÍA
    ventas_por_dia = totales_por_dia(ventas)

    grafico_linea = [{"fecha": dia.isoformat(), "total": float(total)} for dia, total in ventas_por_dia]

    # 💳 MÉTODOS DE PAGO
    metodos = ventas.values("metodo_pago").annotate(total=Sum("total"))

    # 👤 CLIENTES TOP
    clientes = ventas.values("cliente__nombre").annotate(total=Sum("total")).order_by("-total")[:5]

    # 🧠 PREDICCIÓN (POR DÍA)
    ventas_por_dia_totales = [total for _, total in ventas_por_dia]

    prediccion = 0
    if ventas_por_dia_totales:
        promedio = sum(ventas_por_dia_totales) / len(ventas_por_dia_totales)
        prediccion = promedio * Decimal("1.10")

    # 📦 ALERTAS STOCK
    alertas = Producto.objects.filter(stock__lte=models.F("stock_minimo"), activo=True).values(
        "nombre", "stock"
    )

    return Response(
        {
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
        }
    )


# 🔹 EXPORTAR PDF
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def exportar_pdf(request):
    if not request.user.is_staff and obtener_rol(request.user) not in ["ADMIN", "GERENTE"]:
        raise PermissionDenied("No tienes permiso")

    productos = request.data.get("productos", [])

    if not productos:
        return Response({"error": "No hay datos"}, status=400)

    return generar_pdf(productos)
