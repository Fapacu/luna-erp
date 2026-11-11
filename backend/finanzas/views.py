from decimal import Decimal, InvalidOperation

from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from auditoria.services import registrar_auditoria
from usuarios.permissions import requiere_roles

from .models import CuentaPorPagar, MovimientoFinanciero, PagoCuentaPagar
from .services import registrar_egreso


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def registrar_gasto(request):
    requiere_roles(request.user, "ADMIN", "GERENTE")

    data = request.data
    try:
        monto = Decimal(str(data.get("monto", "")))
    except (InvalidOperation, TypeError, ValueError):
        return Response({"error": "Monto inválido"}, status=400)

    descripcion = data.get("descripcion", "")
    categoria = data.get("categoria", "")
    metodo_pago = data.get("metodo_pago") or "efectivo"
    categorias_validas = {opcion[0] for opcion in MovimientoFinanciero.CATEGORIAS}
    if (not monto.is_finite() or monto <= 0 or monto.as_tuple().exponent < -2
            or not isinstance(descripcion, str) or not descripcion.strip()
            or categoria not in categorias_validas
            or not isinstance(metodo_pago, str) or len(metodo_pago) > 50):
        return Response({"error": "Categoría, descripción y monto válido son obligatorios."}, status=400)

    with transaction.atomic():
        movimiento = registrar_egreso(
            categoria=categoria,
            descripcion=descripcion.strip(),
            monto=monto,
            usuario=request.user,
            metodo_pago=metodo_pago,
        )
        registrar_auditoria(
            usuario=request.user, modulo="FINANZAS", accion="REGISTRAR_GASTO",
            referencia=f"Movimiento #{movimiento.id}",
            detalle=f"{categoria}: {descripcion.strip()[:150]} - {monto}",
        )

    return Response({
        "success": True,
        "id": movimiento.id
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def listar_movimientos(request):
    requiere_roles(request.user, "ADMIN", "GERENTE")

    movimientos = MovimientoFinanciero.objects.all().order_by('-fecha')

    return Response([
        {
            "id": m.id,
            "tipo": m.tipo,
            "categoria": m.categoria,
            "descripcion": m.descripcion,
            "monto": float(m.monto),
            "fecha": m.fecha,
            "metodo_pago": m.metodo_pago,
            "referencia": m.referencia,
        }
        for m in movimientos
    ])


def _serializar_cuenta(cuenta):
    return {
        "id": cuenta.id,
        "proveedor": cuenta.proveedor.nombre,
        "compra_id": cuenta.compra_id,
        "numero_factura": cuenta.compra.numero_factura,
        "total": float(cuenta.total),
        "saldo": float(cuenta.saldo),
        "pagado": cuenta.pagado,
        "fecha_vencimiento": cuenta.fecha_vencimiento.isoformat() if cuenta.fecha_vencimiento else None,
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def cuentas_por_pagar(request):
    """Deudas con proveedores por compras a crédito."""
    requiere_roles(request.user, "ADMIN", "GERENTE")
    cuentas = CuentaPorPagar.objects.select_related("proveedor", "compra")
    if request.query_params.get("pendientes") == "1":
        cuentas = cuentas.filter(pagado=False)
    return Response([_serializar_cuenta(c) for c in cuentas])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pagar_cuenta_por_pagar(request, id):
    """Registra un pago (total o parcial) a un proveedor."""
    requiere_roles(request.user, "ADMIN", "GERENTE")

    try:
        monto = Decimal(str(request.data.get("monto", "")))
        if not monto.is_finite() or monto <= 0 or monto.as_tuple().exponent < -2:
            raise ValueError
    except (InvalidOperation, TypeError, ValueError):
        return Response({"error": "Monto inválido"}, status=400)

    metodo_pago = request.data.get("metodo_pago") or "efectivo"
    referencia = request.data.get("referencia") or ""
    if (not isinstance(metodo_pago, str) or len(metodo_pago) > 50
            or not isinstance(referencia, str) or len(referencia) > 100):
        return Response({"error": "Método de pago o referencia inválidos."}, status=400)

    with transaction.atomic():
        try:
            cuenta = CuentaPorPagar.objects.select_for_update().select_related(
                "proveedor", "compra"
            ).get(id=id)
        except CuentaPorPagar.DoesNotExist:
            return Response({"error": "Cuenta por pagar no encontrada"}, status=404)

        if cuenta.pagado or cuenta.saldo <= 0:
            return Response({"error": "La cuenta ya está pagada."}, status=400)
        if monto > cuenta.saldo:
            return Response({"error": "El pago supera el saldo pendiente."}, status=400)

        PagoCuentaPagar.objects.create(
            cuenta=cuenta, monto=monto, usuario=request.user,
            metodo_pago=metodo_pago, referencia=referencia.strip() or None,
        )
        cuenta.saldo -= monto
        cuenta.pagado = cuenta.saldo == 0
        cuenta.save(update_fields=["saldo", "pagado"])

        compra = cuenta.compra
        compra.estado = "PAGADA" if cuenta.pagado else "PARCIAL"
        compra.save(update_fields=["estado"])

        registrar_egreso(
            categoria="COMPRA",
            descripcion=f"Pago a proveedor {cuenta.proveedor.nombre} - Compra #{compra.id}",
            monto=monto,
            usuario=request.user,
            metodo_pago=metodo_pago,
            referencia=compra.numero_factura or f"Compra #{compra.id}",
        )
        registrar_auditoria(
            usuario=request.user, modulo="FINANZAS", accion="PAGAR_PROVEEDOR",
            referencia=f"Compra #{compra.id}",
            detalle=f"Pago: {monto}; saldo restante: {cuenta.saldo}",
        )

    return Response({"success": True, "cuenta": _serializar_cuenta(cuenta)})
