from django.db.models import Q, CharField
from django.db import transaction
from django.db import DatabaseError, IntegrityError
from decimal import Decimal, InvalidOperation
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
from usuarios.permissions import requiere_roles

# ======================
# CREAR PRODUCTO
# ======================

def _tasa_iva(valor):
    """Valida la tasa de IVA (10, 5 o 0); lanza ValueError si no es válida."""
    try:
        tasa = int(valor)
    except (TypeError, ValueError):
        raise ValueError("La tasa de IVA debe ser 10, 5 o 0 (exenta).")
    if tasa not in dict(Producto.TASAS_IVA):
        raise ValueError("La tasa de IVA debe ser 10, 5 o 0 (exenta).")
    return tasa


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crear_producto(request):
    requiere_roles(request.user, "ADMIN", "GERENTE")
    try:
        tasa_iva = _tasa_iva(request.data.get("tasa_iva", 10))
    except ValueError as error:
        return Response({"error": str(error)}, status=400)
    try:
        nombre = request.data.get("nombre", "")
        codigo_barra = request.data.get("codigo_barra", "")
        unidad = request.data.get("unidad", "unidad")
        if not isinstance(nombre, str) or not isinstance(codigo_barra, str) or not isinstance(unidad, str):
            raise ValueError
        nombre = nombre.strip()
        codigo_barra = codigo_barra.strip()
        unidad = unidad.strip()
        precio_compra = Decimal(str(request.data.get("precio_compra", "")))
        precio_venta = Decimal(str(request.data.get("precio_venta", "")))
        stock = Decimal(str(request.data.get("stock", 0)))
        stock_minimo = Decimal(str(request.data.get("stock_minimo", 5)))
        if (not nombre or len(nombre) > 150 or not codigo_barra or len(codigo_barra) > 50
                or not unidad or len(unidad) > 10
                or any(not value.is_finite() for value in (precio_compra, precio_venta, stock, stock_minimo))
                or precio_compra < 0 or precio_venta <= 0 or stock < 0 or stock_minimo < 0
                or precio_compra.as_tuple().exponent < -2 or precio_venta.as_tuple().exponent < -2
                or stock.as_tuple().exponent < -3 or stock_minimo != stock_minimo.to_integral_value()):
            raise ValueError
    except (InvalidOperation, TypeError, ValueError, AttributeError):
        return Response({"error": "Complete nombre, precios y existencias con valores válidos."}, status=400)

    proveedor = None
    proveedor_id = request.data.get("proveedor")
    if proveedor_id:
        try:
            proveedor = Proveedor.objects.get(id=proveedor_id)
        except (Proveedor.DoesNotExist, ValueError, TypeError):
            return Response({"error": "Proveedor no encontrado."}, status=404)

    if Producto.objects.filter(codigo_barra=codigo_barra).exists():
        return Response({"error": "Ya existe un producto con ese código de barras."}, status=400)

    try:
        with transaction.atomic():
            try:
                with transaction.atomic():
                    producto = Producto.objects.create(
                        codigo_barra=codigo_barra,
                        nombre=nombre,
                        precio_compra=precio_compra,
                        precio_venta=precio_venta,
                        stock=Decimal("0"),
                        stock_minimo=int(stock_minimo),
                        unidad=unidad,
                        tasa_iva=tasa_iva,
                    )
            except IntegrityError:
                return Response({"error": "El código de barras ya está registrado."}, status=400)

            if stock > 0:
                registrar_movimiento(
                    producto=producto,
                    tipo="AJUSTE",
                    cantidad=stock,
                    usuario=request.user,
                    motivo="Stock inicial",
                )
            if proveedor:
                proveedor.productos.add(producto)
    except DatabaseError:
        import logging
        logging.getLogger(__name__).exception("No se pudo crear el producto")
        return Response({"error": "No se pudo crear el producto. Verifique los datos e intente nuevamente."}, status=500)

    return Response({
        "mensaje": "Producto creado",
        "id": producto.id,
        "nombre": producto.nombre,
        "precio_compra": producto.precio_compra,
        "precio_venta": producto.precio_venta,
        "stock": producto.stock,
        "stock_minimo": producto.stock_minimo,
        "unidad": producto.unidad,
        "tasa_iva": producto.tasa_iva,
    })

    


# ======================
# DETALLE / EDITAR / ELIMINAR
# ======================

@api_view(['GET','PUT','DELETE'])
@permission_classes([IsAuthenticated])
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
            "activo": producto.activo,
            "tasa_iva": producto.tasa_iva,
        })


    # ======================
    # ACTUALIZAR PRODUCTO
    # ======================
    if request.method == 'PUT':
        requiere_roles(request.user, "ADMIN", "GERENTE")
        try:
            if "activo" in request.data:
                if not isinstance(request.data["activo"], bool):
                    raise ValueError("El estado del producto debe ser verdadero o falso.")
                producto.activo = request.data["activo"]

            if "nombre" in request.data:
                nombre = request.data["nombre"]
                if not isinstance(nombre, str) or not nombre.strip() or len(nombre.strip()) > 150:
                    raise ValueError("El nombre del producto no es válido.")
                producto.nombre = nombre.strip()

            for campo, minimo in (("precio_venta", Decimal("0.01")), ("precio_compra", Decimal("0"))):
                if campo in request.data:
                    precio = Decimal(str(request.data[campo]))
                    if not precio.is_finite() or precio < minimo or precio.as_tuple().exponent < -2:
                        raise ValueError("El precio debe ser válido y tener hasta dos decimales.")
                    setattr(producto, campo, precio)

            if "stock_minimo" in request.data:
                stock_minimo = int(request.data["stock_minimo"])
                if stock_minimo < 0:
                    raise ValueError("El stock mínimo no puede ser negativo.")
                producto.stock_minimo = stock_minimo

            if "unidad" in request.data:
                unidad = request.data["unidad"]
                if not isinstance(unidad, str) or not unidad.strip() or len(unidad.strip()) > 10:
                    raise ValueError("La unidad del producto no es válida.")
                producto.unidad = unidad.strip()

            if "tasa_iva" in request.data:
                producto.tasa_iva = _tasa_iva(request.data["tasa_iva"])

            if "codigo_barra" in request.data:
                codigo = request.data["codigo_barra"]
                if not isinstance(codigo, str) or not codigo.strip() or len(codigo.strip()) > 50:
                    raise ValueError("El código de barras no es válido.")
                if Producto.objects.filter(codigo_barra=codigo.strip()).exclude(pk=producto.pk).exists():
                    raise ValueError("Ya existe un producto con ese código de barras.")
                producto.codigo_barra = codigo.strip()
        except (InvalidOperation, TypeError, ValueError, AttributeError) as error:
            return Response({"error": str(error) or "Datos de producto inválidos."}, status=400)

        producto.save()

        return Response({"mensaje":"Producto actualizado"})


    # ======================
    # ELIMINAR PRODUCTO
    # ======================
    if request.method == 'DELETE':
        requiere_roles(request.user, "ADMIN", "GERENTE")

        producto.activo = False
        producto.save(update_fields=["activo"])

        return Response({"mensaje": "Producto archivado correctamente", "activo": False})


# ======================
# BUSCAR PRODUCTOS
# ======================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def buscar_producto(request):

    query = request.GET.get("q", "")
    incluir_inactivos = request.GET.get("incluir_inactivos") == "1"

    productos_base = Producto.objects.all()
    if incluir_inactivos:
        requiere_roles(request.user, "ADMIN", "GERENTE")
    else:
        productos_base = productos_base.filter(activo=True)

    productos = productos_base.annotate(
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
            "imagen": p.imagen.url if p.imagen else "",
            "activo": p.activo,
            "tasa_iva": p.tasa_iva,
        })

    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ajustar_stock(request):
    requiere_roles(request.user, "ADMIN", "GERENTE")

    producto_id = request.data.get("producto_id")
    cantidad = request.data.get("cantidad")
    motivo = request.data.get("motivo", "")

    # 🔴 VALIDACIONES (AQUÍ VAN)
    if not producto_id:
        return Response({"error": "Producto requerido"}, status=400)

    if cantidad is None:
        return Response({"error": "Cantidad requerida"}, status=400)

    if not isinstance(motivo, str) or not motivo.strip():
        return Response({"error": "El motivo es obligatorio para ajustar el stock."}, status=400)
    motivo = motivo.strip()
    if len(motivo) > 255:
        return Response({"error": "El motivo no puede superar los 255 caracteres."}, status=400)

    try:
        cantidad = Decimal(str(cantidad))
        if not cantidad.is_finite():
            raise ValueError
    except (InvalidOperation, TypeError, ValueError):
        return Response({"error": "Cantidad inválida"}, status=400)

    if cantidad == 0:
        return Response({"error": "Cantidad no puede ser 0"}, status=400)

    # 🔍 VALIDAR PRODUCTO
    # 🧠 LÓGICA CENTRAL
    try:
        with transaction.atomic():
            producto = Producto.objects.select_for_update().get(id=producto_id, activo=True)
            if producto.stock + cantidad < 0:
                return Response({"error": "El ajuste dejaría el stock negativo."}, status=400)
            registrar_movimiento(producto=producto, tipo="AJUSTE", cantidad=cantidad,
                                 usuario=request.user, motivo=motivo)
    except Producto.DoesNotExist:
        return Response({"error": "Producto no encontrado"}, status=404)
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
