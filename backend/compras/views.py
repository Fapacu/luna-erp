from decimal import Decimal

from django.db import transaction

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

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

    try:

        p = Proveedor.objects.get(id=id)

    except Proveedor.DoesNotExist:

        return Response({

            "error": "Proveedor no existe"

        }, status=404)

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

            producto = Producto.objects.get(
                id=item["producto"]
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

            cantidad = int(item["cantidad"])
            costo = Decimal(str(item["costo"]))

        except Exception:

            return Response({
                "error": "Datos inválidos"
            }, status=400)

        if cantidad <= 0:

            return Response({
                "error": "Cantidad inválida"
            }, status=400)

        if costo <= 0:

            return Response({
                "error": "Costo inválido"
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

            estado="PAGADA",

            credito=data.get(
                "credito",
                False
            ),

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

            DetalleCompra.objects.create(

                compra=compra,

                producto=item["producto"],

                cantidad=item["cantidad"],

                precio_compra=item["costo"],

                subtotal=item["subtotal"]

            )

            registrar_movimiento(

                producto=item["producto"],

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

        registrar_egreso(

            categoria="COMPRA",

            descripcion=f"Compra #{compra.id}",

            monto=compra.total,

            usuario=request.user,

            metodo_pago=compra.metodo_pago,

            referencia=compra.numero_factura

        )

    except Exception as e:

        transaction.set_rollback(True)

        return Response({

            "error": str(e)

        }, status=400)

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