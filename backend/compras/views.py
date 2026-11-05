from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.db import transaction

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from usuarios.permissions import requiere_roles

from finanzas.models import CuentaPorPagar
from finanzas.services import registrar_egreso

from inventario.models import Producto
from inventario.services import registrar_movimiento

from .models import Compra, DetalleCompra, Proveedor


# =========================================
# PROVEEDORES ERP
# =========================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])

def listar_proveedores(request):

    # =====================================
    # LISTAR
    # =====================================

    if request.method == 'GET':

        proveedores = Proveedor.objects.all().order_by('nombre')

        data = []

        for p in proveedores:

            data.append({

                "id": p.id,

                "nombre": p.nombre,

                "telefono": p.telefono,

                "direccion": getattr(
                    p,
                    'direccion',
                    ''
                ),

                "ruc": getattr(
                    p,
                    'ruc',
                    ''
                ),

                "productos": [

                    {
                        "id": prod.id,
                        "nombre": prod.nombre
                    }

                    for prod in p.productos.all()
                ]
            })

        return Response(data)


    # =====================================
    # CREAR
    # =====================================

    if request.method == 'POST':
        requiere_roles(request.user, "ADMIN", "GERENTE")

        data = request.data

        nombre = data.get("nombre")
        telefono = data.get("telefono", "")
        productos_ids = data.get("productos", [])

        if not nombre:

            return Response({

                "error": "Nombre requerido"

            }, status=400)

        proveedor = Proveedor.objects.create(

            nombre=nombre,
            telefono=telefono

        )

        productos = Producto.objects.filter(
            id__in=productos_ids
        )

        proveedor.productos.set(productos)

        return Response({

            "success": True,

            "id": proveedor.id
        })

# =========================================
# OBTENER PROVEEDOR
# =========================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])

def obtener_proveedor(request, id):

    try:

        p = Proveedor.objects.get(id=id)

    except Proveedor.DoesNotExist:

        return Response({

            "error": "Proveedor no existe"

        }, status=404)

    return Response({

        "id": p.id,

        "nombre": p.nombre,

        "telefono": p.telefono,

        "direccion": getattr(
            p,
            'direccion',
            ''
        ),

        "ruc": getattr(
            p,
            'ruc',
            ''
        ),

        "productos": [
            {
                "id": producto.id,
                "nombre": producto.nombre
            }
            for producto in p.productos.all()
        ]
    })


# =========================================
# ACTUALIZAR PROVEEDOR
# =========================================

@api_view(['PUT'])
@permission_classes([IsAuthenticated])

def actualizar_proveedor(request, id):
    requiere_roles(request.user, "ADMIN", "GERENTE")

    try:

        p = Proveedor.objects.get(id=id)

    except Proveedor.DoesNotExist:

        return Response({

            "error": "Proveedor no existe"

        }, status=404)

    data = request.data

    p.nombre = data.get(
        "nombre",
        p.nombre
    )

    p.telefono = data.get(
        "telefono",
        p.telefono
    )

    if hasattr(p, 'direccion'):

        p.direccion = data.get(
            "direccion",
            p.direccion
        )

    if hasattr(p, 'ruc'):

        p.ruc = data.get(
            "ruc",
            p.ruc
        )

    productos_ids = data.get(
        "productos",
        []
    )

    productos = Producto.objects.filter(
        id__in=productos_ids
    )

    p.productos.set(productos)

    p.save()

    return Response({

        "success": True
    })


# =========================================
# ELIMINAR PROVEEDOR
# =========================================

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])

def eliminar_proveedor(request, id):
    requiere_roles(request.user, "ADMIN", "GERENTE")

    try:

        p = Proveedor.objects.get(id=id)

    except Proveedor.DoesNotExist:

        return Response({

            "error": "Proveedor no existe"

        }, status=404)

    if Compra.objects.filter(proveedor=p).exists():
        return Response({
            "error": "No se puede eliminar un proveedor con compras registradas; conserve el historial contable."
        }, status=409)

    p.delete()

    return Response({

        "success": True
    })


# =========================================
# CREAR COMPRA ERP
# =========================================

@transaction.atomic
@api_view(['POST'])
@permission_classes([IsAuthenticated])

def crear_compra(request):
    requiere_roles(request.user, "ADMIN", "GERENTE")

    data = request.data

    proveedor_id = data.get("proveedor")
    items = data.get("items", [])

    if not proveedor_id:
        return Response({
            "error": "Seleccione un proveedor"
        }, status=400)

    if not items:
        return Response({
            "error": "No hay productos"
        }, status=400)

    credito = data.get("credito", False)
    if not isinstance(credito, bool):
        return Response({"error": "El campo crédito debe ser verdadero o falso."}, status=400)
    if credito and not data.get("fecha_vencimiento"):
        return Response({"error": "Indique la fecha de vencimiento para una compra a crédito."}, status=400)

    numero_factura = data.get("numero_factura")

    if not numero_factura:
        numero_factura = None

    if numero_factura and Compra.objects.filter(
        numero_factura=numero_factura
    ).exists():

        return Response({
            "error": "Factura duplicada"
        }, status=400)

    try:

        proveedor = Proveedor.objects.get(id=proveedor_id)

    except Proveedor.DoesNotExist:

        return Response({
            "error": "Proveedor no existe"
        }, status=404)

    # =====================================
    # VALIDAR TODOS LOS PRODUCTOS
    # =====================================

    productos_validados = []
    total = Decimal("0")

    for item in items:

        try:

            producto = Producto.objects.select_for_update().get(
                id=item["producto"], activo=True
            )

        except Producto.DoesNotExist:

            return Response({
                "error": "Producto no existe"
            }, status=404)

        if not proveedor.productos.filter(id=producto.id).exists():

            return Response({
                "error":
                f"{proveedor.nombre} no provee {producto.nombre}"
            }, status=400)

        try:

            cantidad = Decimal(str(item["cantidad"]))
            costo = Decimal(str(item["costo"]))

        except (KeyError, InvalidOperation, TypeError, ValueError):

            return Response({
                "error": "Datos inválidos"
            }, status=400)

        if not cantidad.is_finite() or cantidad <= 0 or cantidad.as_tuple().exponent < -3:

            return Response({
                "error": "Cantidad inválida"
            }, status=400)

        if not costo.is_finite() or costo <= 0 or costo.as_tuple().exponent < -2:

            return Response({
                "error": "El costo debe ser positivo y tener hasta dos decimales."
            }, status=400)

        subtotal = Decimal(cantidad) * costo

        total += subtotal

        productos_validados.append({

            "producto": producto,
            "cantidad": cantidad,
            "costo": costo,
            "subtotal": subtotal

        })

    # =====================================
    # CREAR COMPRA
    # =====================================

    try:

        compra = Compra.objects.create(

            proveedor=proveedor,

            usuario=request.user,

            numero_factura=numero_factura,

            metodo_pago=data.get(
                "metodo_pago",
                "efectivo"
            ),

            estado="PENDIENTE" if credito else "PAGADA",

            credito=credito,

            fecha_vencimiento=data.get(
                "fecha_vencimiento"
            ),

            observacion=data.get(
                "observacion",
                ""
            )

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

                subtotal=item["subtotal"]

            )

            registrar_movimiento(

                producto=producto,

                tipo="COMPRA",

                cantidad=item["cantidad"],

                usuario=request.user,

                motivo="Compra proveedor"

            )

        # =================================
        # TOTALES
        # =================================

        compra.subtotal = total

        compra.impuesto = (
            total * Decimal("0.10")
        )

        compra.total = (
            compra.subtotal
            + compra.impuesto
            - compra.descuento
        )

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

                fecha_vencimiento=
                compra.fecha_vencimiento

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

            referencia=compra.numero_factura

        )

    except Exception:
        import logging
        logging.getLogger(__name__).exception("No se pudo registrar la compra")

        transaction.set_rollback(True)

        return Response({

            "error": "No se pudo registrar la compra. Verifique los datos e intente nuevamente."

        }, status=500)

    return Response({

        "success": True,

        "mensaje": "Compra registrada correctamente"

    })


# =========================================
# HISTORIAL COMPRAS ERP
# =========================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])

def listar_compras(request):

    compras = Compra.objects.all().order_by('-id')

    data = []

    for c in compras:

        data.append({

            "id": c.id,

            "proveedor": c.proveedor.nombre,

            "fecha":
            c.fecha.strftime(
                "%Y-%m-%d %H:%M"
            ),

            "numero_factura":
            c.numero_factura,

            "metodo_pago":
            c.metodo_pago,

            "estado":
            c.estado,

            "credito":
            c.credito,

            "subtotal":
            float(c.subtotal),

            "impuesto":
            float(c.impuesto),

            "descuento":
            float(c.descuento),

            "total":
            float(c.total),

            "detalle": [

                {

                    "producto":
                    d.producto.nombre,

                    "cantidad":
                    d.cantidad,

                    "costo":
                    float(d.precio_compra),

                    "subtotal":
                    float(d.subtotal)

                }

                for d in c.detallecompra_set.all()
            ]
        })

    return Response(data)
