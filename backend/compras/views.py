import logging
from datetime import date
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from finanzas.models import CuentaPorPagar
from finanzas.services import registrar_egreso
from inventario.models import Producto
from inventario.services import registrar_movimiento
from usuarios.permissions import requiere_roles

from .models import Compra, DetalleCompra, Proveedor

logger = logging.getLogger(__name__)


def _ids_productos(valor):
    """Valida una lista de IDs de producto; devuelve lista de int o None."""
    if valor is None:
        return []
    if not isinstance(valor, list):
        return None
    ids = []
    for item in valor:
        try:
            ids.append(int(item))
        except (TypeError, ValueError):
            return None
    return ids


def _texto(valor, limite, obligatorio=False):
    """Normaliza un texto opcional; lanza ValueError si no es válido."""
    if valor is None:
        valor = ""
    if not isinstance(valor, str):
        raise ValueError
    valor = valor.strip()
    if len(valor) > limite or (obligatorio and not valor):
        raise ValueError
    return valor


def _decimal_no_negativo(valor):
    try:
        numero = Decimal(str(valor if valor not in (None, "") else "0"))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError
    if not numero.is_finite() or numero < 0 or numero.as_tuple().exponent < -2:
        raise ValueError
    return numero


# =========================================
# PROVEEDORES ERP
# =========================================


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def listar_proveedores(request):
    # =====================================
    # LISTAR
    # =====================================

    if request.method == "GET":
        proveedores = Proveedor.objects.all().order_by("nombre")

        data = []

        for p in proveedores:
            data.append(
                {
                    "id": p.id,
                    "nombre": p.nombre,
                    "telefono": p.telefono,
                    "direccion": getattr(p, "direccion", ""),
                    "ruc": getattr(p, "ruc", ""),
                    "productos": [{"id": prod.id, "nombre": prod.nombre} for prod in p.productos.all()],
                }
            )

        return Response(data)

    # =====================================
    # CREAR
    # =====================================

    if request.method == "POST":
        requiere_roles(request.user, "ADMIN", "GERENTE")

        data = request.data

        try:
            nombre = _texto(data.get("nombre"), 100, obligatorio=True)
        except ValueError:
            return Response({"error": "Nombre requerido (máximo 100 caracteres)."}, status=400)
        try:
            telefono = _texto(data.get("telefono"), 20)
        except ValueError:
            return Response({"error": "Teléfono inválido (máximo 20 caracteres)."}, status=400)
        productos_ids = _ids_productos(data.get("productos", []))
        if productos_ids is None:
            return Response({"error": "La lista de productos no es válida."}, status=400)

        with transaction.atomic():
            proveedor = Proveedor.objects.create(nombre=nombre, telefono=telefono)
            proveedor.productos.set(Producto.objects.filter(id__in=productos_ids))

        return Response({"success": True, "id": proveedor.id})


# =========================================
# OBTENER PROVEEDOR
# =========================================


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def obtener_proveedor(request, id):
    try:
        p = Proveedor.objects.get(id=id)

    except Proveedor.DoesNotExist:
        return Response({"error": "Proveedor no existe"}, status=404)

    return Response(
        {
            "id": p.id,
            "nombre": p.nombre,
            "telefono": p.telefono,
            "direccion": getattr(p, "direccion", ""),
            "ruc": getattr(p, "ruc", ""),
            "productos": [{"id": producto.id, "nombre": producto.nombre} for producto in p.productos.all()],
        }
    )


# =========================================
# ACTUALIZAR PROVEEDOR
# =========================================


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def actualizar_proveedor(request, id):
    requiere_roles(request.user, "ADMIN", "GERENTE")

    try:
        p = Proveedor.objects.get(id=id)

    except Proveedor.DoesNotExist:
        return Response({"error": "Proveedor no existe"}, status=404)

    data = request.data

    try:
        if "nombre" in data:
            p.nombre = _texto(data.get("nombre"), 100, obligatorio=True)
        if "telefono" in data:
            p.telefono = _texto(data.get("telefono"), 20)
    except ValueError:
        return Response({"error": "Nombre (máx. 100) o teléfono (máx. 20) inválido."}, status=400)

    productos_ids = _ids_productos(data.get("productos")) if "productos" in data else None
    if "productos" in data and productos_ids is None:
        return Response({"error": "La lista de productos no es válida."}, status=400)

    with transaction.atomic():
        p.save()
        if productos_ids is not None:
            p.productos.set(Producto.objects.filter(id__in=productos_ids))

    return Response({"success": True})


# =========================================
# ELIMINAR PROVEEDOR
# =========================================


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def eliminar_proveedor(request, id):
    requiere_roles(request.user, "ADMIN", "GERENTE")

    try:
        p = Proveedor.objects.get(id=id)

    except Proveedor.DoesNotExist:
        return Response({"error": "Proveedor no existe"}, status=404)

    if Compra.objects.filter(proveedor=p).exists():
        return Response(
            {
                "error": "No se puede eliminar un proveedor con compras registradas; conserve el historial contable."
            },
            status=409,
        )

    p.delete()

    return Response({"success": True})


# =========================================
# CREAR COMPRA ERP
# =========================================


@transaction.atomic
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def crear_compra(request):
    requiere_roles(request.user, "ADMIN", "GERENTE")

    data = request.data

    proveedor_id = data.get("proveedor")
    items = data.get("items", [])

    if not proveedor_id:
        return Response({"error": "Seleccione un proveedor"}, status=400)

    if not items or not isinstance(items, list):
        return Response({"error": "No hay productos"}, status=400)

    credito = data.get("credito", False)
    if not isinstance(credito, bool):
        return Response({"error": "El campo crédito debe ser verdadero o falso."}, status=400)

    fecha_vencimiento = None
    if credito:
        try:
            fecha_vencimiento = date.fromisoformat(str(data.get("fecha_vencimiento") or "").strip())
        except ValueError:
            return Response(
                {"error": "Indique una fecha de vencimiento válida para una compra a crédito."}, status=400
            )

    try:
        numero_factura = _texto(data.get("numero_factura"), 100) or None
        metodo_pago = _texto(data.get("metodo_pago") or "efectivo", 50)
        observacion = _texto(data.get("observacion"), 2000)
    except ValueError:
        return Response({"error": "Número de factura, método de pago u observación inválidos."}, status=400)

    try:
        descuento = _decimal_no_negativo(data.get("descuento"))
        impuesto = _decimal_no_negativo(data.get("impuesto"))
    except ValueError:
        return Response(
            {"error": "Descuento e impuesto deben ser importes válidos no negativos."}, status=400
        )

    if numero_factura and Compra.objects.filter(numero_factura=numero_factura).exists():
        return Response({"error": "Factura duplicada"}, status=400)

    try:
        proveedor = Proveedor.objects.get(id=proveedor_id)

    except Proveedor.DoesNotExist:
        return Response({"error": "Proveedor no existe"}, status=404)

    # =====================================
    # VALIDAR TODOS LOS PRODUCTOS
    # =====================================

    productos_validados = []
    total = Decimal("0")

    for item in items:
        if not isinstance(item, dict):
            return Response({"error": "Detalle de compra inválido."}, status=400)

        try:
            producto = Producto.objects.select_for_update().get(id=int(item["producto"]), activo=True)

        except (KeyError, TypeError, ValueError):
            return Response({"error": "Detalle de compra inválido."}, status=400)

        except Producto.DoesNotExist:
            return Response({"error": "Producto no existe"}, status=404)

        if not proveedor.productos.filter(id=producto.id).exists():
            return Response({"error": f"{proveedor.nombre} no provee {producto.nombre}"}, status=400)

        try:
            cantidad = Decimal(str(item["cantidad"]))
            costo = Decimal(str(item["costo"]))

        except (KeyError, InvalidOperation, TypeError, ValueError):
            return Response({"error": "Datos inválidos"}, status=400)

        if not cantidad.is_finite() or cantidad <= 0 or cantidad.as_tuple().exponent < -3:
            return Response({"error": "Cantidad inválida"}, status=400)

        if not costo.is_finite() or costo <= 0 or costo.as_tuple().exponent < -2:
            return Response({"error": "El costo debe ser positivo y tener hasta dos decimales."}, status=400)

        subtotal = Decimal(cantidad) * costo

        total += subtotal

        productos_validados.append(
            {"producto": producto, "cantidad": cantidad, "costo": costo, "subtotal": subtotal}
        )

    if descuento > total + impuesto:
        return Response({"error": "El descuento no puede superar el total de la compra."}, status=400)

    # =====================================
    # CREAR COMPRA
    # =====================================

    try:
        compra = Compra.objects.create(
            proveedor=proveedor,
            usuario=request.user,
            numero_factura=numero_factura,
            metodo_pago=metodo_pago,
            estado="PENDIENTE" if credito else "PAGADA",
            credito=credito,
            fecha_vencimiento=fecha_vencimiento,
            observacion=observacion,
        )

        # =================================
        # DETALLES + INVENTARIO
        # =================================

        for item in productos_validados:
            producto = item["producto"]
            producto.refresh_from_db(fields=["stock", "precio_compra", "costo_promedio"])
            stock_anterior = Decimal(str(producto.stock))
            costo_anterior = Decimal(str(producto.costo_promedio or producto.precio_compra))
            cantidad = item["cantidad"]
            costo_nuevo = item["costo"]
            stock_nuevo = stock_anterior + cantidad
            costo_promedio = (
                (stock_anterior * costo_anterior + cantidad * costo_nuevo) / stock_nuevo
            ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            producto.precio_compra = costo_nuevo
            producto.costo_promedio = costo_promedio
            producto.save(update_fields=["precio_compra", "costo_promedio"])

            DetalleCompra.objects.create(
                compra=compra,
                producto=producto,
                cantidad=item["cantidad"],
                precio_compra=item["costo"],
                subtotal=item["subtotal"],
            )

            registrar_movimiento(
                producto=producto,
                tipo="COMPRA",
                cantidad=item["cantidad"],
                usuario=request.user,
                motivo=f"Compra #{compra.id}" + (f" - Factura {numero_factura}" if numero_factura else ""),
            )

        # =================================
        # TOTALES
        # =================================

        # Los costos se cargan tal como figuran en la factura. El impuesto y el
        # descuento adicionales solo se aplican si el usuario los informa.
        compra.subtotal = total

        compra.impuesto = impuesto

        compra.descuento = descuento

        compra.total = compra.subtotal + compra.impuesto - compra.descuento

        compra.save()

        # =================================
        # CUENTA POR PAGAR
        # =================================

        if compra.credito:
            CuentaPorPagar.objects.create(
                proveedor=proveedor,
                compra=compra,
                total=compra.total,
                saldo=compra.total,
                fecha_vencimiento=compra.fecha_vencimiento,
            )

        # =================================
        # MOVIMIENTO FINANCIERO
        # =================================

        if not compra.credito:
            registrar_egreso(
                categoria="COMPRA",
                descripcion=f"Compra #{compra.id}",
                monto=compra.total,
                usuario=request.user,
                metodo_pago=compra.metodo_pago,
                referencia=compra.numero_factura,
            )

        from auditoria.services import registrar_auditoria

        registrar_auditoria(
            usuario=request.user,
            modulo="COMPRAS",
            accion="CREAR_COMPRA",
            referencia=f"Compra #{compra.id}",
            detalle=f"Proveedor: {proveedor.nombre}; total: {compra.total}; crédito: {credito}",
        )

    except Exception:
        logger.exception("No se pudo registrar la compra")

        transaction.set_rollback(True)

        return Response(
            {"error": "No se pudo registrar la compra. Verifique los datos e intente nuevamente."}, status=500
        )

    return Response({"success": True, "mensaje": "Compra registrada correctamente"})


# =========================================
# HISTORIAL COMPRAS ERP
# =========================================


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listar_compras(request):
    requiere_roles(request.user, "ADMIN", "GERENTE")

    compras = (
        Compra.objects.select_related("proveedor")
        .prefetch_related("detallecompra_set__producto")
        .order_by("-id")
    )

    data = []

    for c in compras:
        data.append(
            {
                "id": c.id,
                "proveedor": c.proveedor.nombre,
                "fecha": timezone.localtime(c.fecha).strftime("%Y-%m-%d %H:%M"),
                "numero_factura": c.numero_factura,
                "metodo_pago": c.metodo_pago,
                "estado": c.estado,
                "credito": c.credito,
                "subtotal": float(c.subtotal),
                "impuesto": float(c.impuesto),
                "descuento": float(c.descuento),
                "total": float(c.total),
                "detalle": [
                    {
                        "producto": d.producto.nombre,
                        "cantidad": float(d.cantidad),
                        "costo": float(d.precio_compra),
                        "subtotal": float(d.subtotal),
                    }
                    for d in c.detallecompra_set.all()
                ],
            }
        )

    return Response(data)
