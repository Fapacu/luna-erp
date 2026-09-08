from django.db.models import Q, CharField
from django.db.models.functions import Cast
from rest_framework.decorators import api_view
from rest_framework.response import Response
from inventario.models import Producto, LoteProducto
from .services import registrar_movimiento
from django.utils.timezone import now
from datetime import timedelta
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from .models import *
from compras.models import Proveedor

# ======================
# CREAR PRODUCTO
# ======================

@api_view(['POST'])
def crear_producto(request):

    producto = Producto.objects.create(

        codigo_barra = request.data.get("codigo_barra"),
        nombre = request.data.get("nombre"),
        precio_compra = request.data.get("precio_compra"),
        precio_venta = request.data.get("precio_venta"),
        stock = request.data.get("stock"),
        stock_minimo = request.data.get("stock_minimo", 5),
        unidad = request.data.get("unidad", "unidad")

    )

    proveedor_id = request.data.get("proveedor")

    if proveedor_id:

        try:

            proveedor = Proveedor.objects.get(
                id=proveedor_id
            )

            proveedor.productos.add(producto)

        except Proveedor.DoesNotExist:

            pass

    return Response({
        "mensaje": "Producto creado",
        "id": producto.id,
        "nombre": producto.nombre,
        "precio_compra": producto.precio_compra,
        "precio_venta": producto.precio_venta,
        "stock": producto.stock,
        "stock_minimo": producto.stock_minimo,
        "unidad": producto.unidad
    })

    


# ======================
# DETALLE / EDITAR / ELIMINAR
# ======================

@api_view(['GET','PUT','DELETE'])
def producto_detalle(request, id):

    try:
        producto = Producto.objects.get(id=id)
    except Producto.DoesNotExist:
        return Response({"error":"Producto no encontrado"}, status=404)


    # ======================
    # OBTENER PRODUCTO
    # ======================
    if request.method == 'GET':

        return Response({
            "id": producto.id,
            "codigo_barra": producto.codigo_barra,
            "nombre": producto.nombre,
            "precio_compra": producto.precio_compra,
            "precio_venta": producto.precio_venta,
            "stock": producto.stock,
            "stock_minimo": producto.stock_minimo,
            "unidad": producto.unidad,
        })


    # ======================
    # ACTUALIZAR PRODUCTO
    # ======================
    if request.method == 'PUT':

        producto.nombre = request.data.get("nombre", producto.nombre)
        producto.precio_venta = request.data.get("precio_venta", producto.precio_venta)

        

        # stock mínimo
        stock_minimo = request.data.get("stock_minimo")
        if stock_minimo not in [None, ""]:
            producto.stock_minimo = int(stock_minimo)

        # unidad
        unidad = request.data.get("unidad")
        if unidad:
            producto.unidad = unidad

        # opcionales
        if request.data.get("codigo_barra"):
            producto.codigo_barra = request.data.get("codigo_barra")

        if request.data.get("precio_compra"):
            producto.precio_compra = request.data.get("precio_compra")

        producto.save()

        return Response({"mensaje":"Producto actualizado"})


    # ======================
    # ELIMINAR PRODUCTO
    # ======================
    if request.method == 'DELETE':

        producto.delete()

        return Response({"mensaje":"Producto eliminado"})


# ======================
# BUSCAR PRODUCTOS
# ======================

@api_view(['GET'])
def buscar_producto(request):

    query = request.GET.get("q", "")

    productos = Producto.objects.annotate(
        precio_str=Cast('precio_venta', CharField())
    ).filter(
        Q(codigo_barra__icontains=query) |
        Q(nombre__icontains=query) |
        Q(id__icontains=query) |
        Q(precio_str__icontains=query)
    )[:20]

    data = []

    for p in productos:
        data.append({
            "id": p.id,
            "nombre": p.nombre,
            "precio_venta": p.precio_venta,
            "stock": p.stock,
            "stock_minimo": p.stock_minimo,
            "codigo_barra": p.codigo_barra,
            "unidad": p.unidad,
            "imagen": p.imagen.url if p.imagen else ""
        })

    return Response(data)


@api_view(['POST'])
def ajustar_stock(request):

    producto_id = request.data.get("producto_id")
    cantidad = request.data.get("cantidad")
    motivo = request.data.get("motivo", "")

    # 🔴 VALIDACIONES (AQUÍ VAN)
    if not producto_id:
        return Response({"error": "Producto requerido"}, status=400)

    if cantidad is None:
        return Response({"error": "Cantidad requerida"}, status=400)

    try:
        cantidad = int(cantidad)
    except:
        return Response({"error": "Cantidad inválida"}, status=400)

    if cantidad == 0:
        return Response({"error": "Cantidad no puede ser 0"}, status=400)

    # 🔍 VALIDAR PRODUCTO
    try:
        producto = Producto.objects.get(id=producto_id)
    except Producto.DoesNotExist:
        return Response({"error": "Producto no encontrado"}, status=404)

    # 🧠 LÓGICA CENTRAL
    try:
        registrar_movimiento(
            producto=producto,
            tipo="AJUSTE",
            cantidad=cantidad,
            usuario=request.user,
            motivo=motivo
        )
    except ValueError as e:
        return Response({"error": str(e)}, status=400)

    return Response({"msg": "Stock actualizado correctamente"})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def alertas_vencimiento(request):

    limite = now().date() + timedelta(days=30)

    lotes = LoteProducto.objects.filter(
        fecha_vencimiento__lte=limite,
        cantidad__gt=0
    )

    data = []

    for l in lotes:

        data.append({
            "producto": l.producto.nombre,
            "lote": l.lote,
            "vence": l.fecha_vencimiento,
            "cantidad": float(l.cantidad)
        })

    return Response(data)