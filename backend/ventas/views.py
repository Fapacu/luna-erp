from decimal import Decimal
from django.db.models import Q
from django.db import transaction
from django.db.models import Sum
from django.utils.timezone import now
from django.http import JsonResponse, HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.template.loader import render_to_string
from inventario.models import Producto
from inventario.services import registrar_movimiento
from inventario.models import Producto
from finanzas.services import registrar_ingreso
from .models import (
    Venta,
    DetalleVenta,
    Caja,
    MovimientoCaja,
    Cliente,
    CuentaPorCobrar,
    PagoCuentaPorCobrar,
    MovimientoLibreta
)

from .services import registrar_movimiento_caja


# =========================================
# CREAR VENTA ERP
# =========================================


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def crear_venta(request):

    try:

        productos = request.data.get("productos", [])
        metodo_pago = request.data.get("metodo_pago", "EFECTIVO")
        cliente_nombre = request.data.get("cliente_nombre", "").strip()

        if not productos:

            return Response({
                "error": "No hay productos."
            }, status=400)

        if metodo_pago == "LIBRETA" and not cliente_nombre:

            return Response({
                "error": "Debe ingresar el nombre del cliente."
            }, status=400)

        caja = Caja.objects.filter(
            abierta=True
        ).first()

        if not caja:

            return Response({
                "error": "No hay caja abierta."
            }, status=400)

        with transaction.atomic():

            ultimo = Venta.objects.count() + 1

            numero_ticket = f"TICKET-{ultimo:06d}"

            venta = Venta.objects.create(

                usuario=request.user,

                caja=caja,

                metodo_pago=metodo_pago,

                numero_ticket=numero_ticket,

                total=0

            )

            total = Decimal("0")

            for item in productos:

                producto = Producto.objects.get(
                    id=item["id"]
                )

                cantidad = Decimal(str(item["cantidad"]))

                if producto.stock < cantidad:

                    return Response({

                        "error":
                        f"Stock insuficiente de {producto.nombre}"

                    }, status=400)

                precio = Decimal(str(producto.precio_venta))

                subtotal = precio * cantidad

                ganancia = (
                    precio - producto.precio_compra
                ) * cantidad

                DetalleVenta.objects.create(

                    venta=venta,

                    producto=producto,

                    cantidad=cantidad,

                    precio_venta=precio,

                    precio_compra=producto.precio_compra,

                    subtotal=subtotal,

                    ganancia=ganancia

                )

                # Descontar stock
                producto.stock -= cantidad
                producto.save()

                registrar_movimiento(

                    producto=producto,

                    tipo="VENTA",

                    cantidad=cantidad,

                    usuario=request.user,

                    motivo=f"Venta #{venta.id}"

                )

                total += subtotal

            venta.total = total
            venta.save()

            # ==========================
            # LIBRETA
            # ==========================

            if metodo_pago == "LIBRETA":

                cuenta = CuentaPorCobrar.objects.filter(

                    cliente_nombre__iexact=cliente_nombre,

                    cancelada=False

                ).first()

                if cuenta:

                    cuenta.total += total
                    cuenta.saldo += total
                    cuenta.save()

                else:

                    cuenta = CuentaPorCobrar.objects.create(

                        cliente_nombre=cliente_nombre,

                        venta=venta,

                        total=total,

                        saldo=total,

                        pagado=0

                    )

                mov = MovimientoLibreta.objects.create(

                    cuenta=cuenta,

                    venta=venta,

                    tipo="COMPRA",

                    monto=total

                )

            else:

                registrar_ingreso(

                    categoria="VENTA",

                    descripcion=f"Venta #{venta.id}",

                    monto=total,

                    usuario=request.user,

                    metodo_pago=metodo_pago,

                    referencia=venta.numero_ticket

                )

                registrar_movimiento_caja(

                    caja=caja,

                    tipo="INGRESO",

                    descripcion=f"Venta #{venta.id}",

                    monto=total,

                    usuario=request.user

                )

            from auditoria.services import registrar_auditoria

            registrar_auditoria(

                usuario=request.user,

                modulo="VENTAS",

                accion="CREAR_VENTA",

                referencia=f"Venta #{venta.id}",

                detalle=f"Total: {total}"

            )

            return Response({

                "success": True,

                "venta_id": venta.id,

                "ticket": venta.numero_ticket,

                "total": float(total)

            })

    except Exception as e:

        import traceback

        traceback.print_exc()

        return Response({

            "error": str(e)

        }, status=500)

# =========================================
# HISTORIAL VENTAS
# =========================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])

def historial_ventas(request):
    ventas = Venta.objects.select_related(
        'usuario',
        'caja',
        'cliente'
    ).order_by('-fecha')[:200]

    data = []

    for venta in ventas:
        data.append({
            'id': venta.id,
            'ticket': venta.numero_ticket,
            'fecha': venta.fecha.strftime('%d/%m/%Y %H:%M'),
            'usuario': venta.usuario.username if venta.usuario else 'N/A',
            'cliente': venta.cliente.nombre if venta.cliente else 'Consumidor Final',
            'total': float(venta.total),
            'metodo_pago': venta.metodo_pago,
            'caja': venta.caja.id if venta.caja else None,
        })

    return JsonResponse(data, safe=False)


# =========================================
# ANULAR VENTA
# =========================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])

def anular_venta(request, venta_id):

    try:

        venta = Venta.objects.get(id=venta_id)

        if venta.estado == "ANULADA":

            return Response({
                "error": "La venta ya está anulada"
            }, status=400)

        with transaction.atomic():

            detalles = DetalleVenta.objects.filter(
                venta=venta
            )

            for d in detalles:

                registrar_movimiento(
                    producto=d.producto,
                    tipo="AJUSTE",
                    cantidad=d.cantidad,
                    usuario=request.user,
                    motivo=f"Anulación venta #{venta.id}"
                )

            venta.estado = "ANULADA"
            venta.save()

        return Response({
            "success": True
        })

    except Exception as e:

        return Response({
            "error": str(e)
        }, status=500)


# =========================================
# ABRIR CAJA
# =========================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])

def abrir_caja(request):

    data = request.data

    abierta = Caja.objects.filter(
        abierta=True
    ).exists()

    if abierta:

        return Response({
            "error": "Ya existe una caja abierta"
        }, status=400)

    monto_inicial = Decimal(
        str(request.data.get("monto_inicial", 0))
    )

    caja = Caja.objects.create(

        usuario=request.user,

        monto_inicial=data["monto_inicial"],

        abierta=True
    )

    return Response({
        "success": True,
        "caja_id": caja.id
    })


# =========================================
# CAJA ACTUAL
# =========================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])

def caja_actual(request):

    caja = Caja.objects.filter(
        abierta=True
    ).first()

    if not caja:

        return Response({
            "error": "No hay caja abierta"
        })

    movimientos = MovimientoCaja.objects.filter(
        caja=caja
    )

    ingresos = sum(
        m.monto
        for m in movimientos
        if m.tipo == "INGRESO"
    )

    retiros = sum(
        m.monto
        for m in movimientos
        if m.tipo == "RETIRO"
    )

    gastos = sum(
        m.monto
        for m in movimientos
        if m.tipo == "GASTO"
    )

    monto_actual = (
        Decimal(str(caja.monto_inicial))
        + Decimal(str(ingresos))
        - Decimal(str(retiros))
        - Decimal(str(gastos))
    )

    return Response({

        "monto_inicial": float(caja.monto_inicial),
        "ingresos": float(ingresos),
        "retiros": float(retiros),
        "gastos": float(gastos),
        "total": float(monto_actual)
    })


# =========================================
# RETIRO CAJA
# =========================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])

def retiro_caja(request):

    try:

        caja = Caja.objects.filter(
            abierta=True
        ).first()

        if not caja:

            return Response({
                "error": "No hay caja abierta"
            }, status=400)

        data = request.data

        registrar_movimiento_caja(
            caja=caja,
            tipo="RETIRO",
            descripcion=data["descripcion"],
            monto=data["monto"],
            usuario=request.user
        )

        return Response({
            "success": True
        })

    except Exception as e:

        return Response({
            "error": str(e)
        }, status=500)


# =========================================
# GASTO CAJA
# =========================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])

def gasto_caja(request):

    try:

        caja = Caja.objects.filter(
            abierta=True
        ).first()

        if not caja:

            return Response({
                "error": "No hay caja abierta"
            }, status=400)

        data = request.data

        registrar_movimiento_caja(
            caja=caja,
            tipo="GASTO",
            descripcion=data["descripcion"],
            monto=data["monto"],
            usuario=request.user
        )

        return Response({
            "success": True
        })

    except Exception as e:

        return Response({
            "error": str(e)
        }, status=500)


# =========================================
# CERRAR CAJA
# =========================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])

def cerrar_caja(request):

    caja = Caja.objects.filter(
        abierta=True
    ).first()

    if not caja:

        return Response({
            "error": "No hay caja abierta"
        }, status=400)

    ventas = Venta.objects.filter(
        caja=caja
    )

    total_vendido = ventas.aggregate(
        total=Sum('total')
    )['total'] or 0

    movimientos = MovimientoCaja.objects.filter(
        caja=caja
    )

    ingresos = sum(
        m.monto
        for m in movimientos
        if m.tipo == "INGRESO"
    )

    retiros = sum(
        m.monto
        for m in movimientos
        if m.tipo == "RETIRO"
    )

    gastos = sum(
        m.monto
        for m in movimientos
        if m.tipo == "GASTO"
    )

    monto_sistema = (
        Decimal(str(caja.monto_inicial))
        + Decimal(str(ingresos))
        - Decimal(str(retiros))
        - Decimal(str(gastos))
    )

    monto_real = Decimal(
        str(request.data.get("monto_real", 0))
    )

    diferencia = monto_real - monto_sistema

    caja.total_vendido = total_vendido
    caja.monto_cierre = monto_real
    caja.diferencia = diferencia
    caja.fecha_cierre = now()
    caja.abierta = False

    caja.save()

    return Response({

        "monto_sistema": float(monto_sistema),
        "monto_real": float(monto_real),
        "diferencia": float(diferencia)
    })

# =========================================
# HISTORIAL CAJAS
# =========================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])

def historial_cajas(request):

    cajas = Caja.objects.all().order_by('-id')

    data = []

    for c in cajas:

        data.append({

            "id": c.id,
            "fecha_apertura": c.fecha_apertura,
            "fecha_cierre": c.fecha_cierre,
            "monto_inicial": float(c.monto_inicial),
            "monto_cierre": float(c.monto_cierre or 0),
            "total_vendido": float(c.total_vendido or 0),
            "diferencia": float(c.diferencia or 0),
            "abierta": c.abierta
        })

    return Response(data)


# =========================================
# ESTADO CAJA
# =========================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])

def estado_caja(request):

    abierta = Caja.objects.filter(
        abierta=True
    ).exists()

    return Response({
        "abierta": abierta
    })

# =========================================
# CLIENTES ERP
# =========================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])

def clientes(request):

    # ======================
    # LISTAR
    # ======================

    if request.method == 'GET':

        q = request.GET.get('q', '')

        clientes = Cliente.objects.filter(

            Q(nombre__icontains=q) |
            Q(ruc__icontains=q) |
            Q(telefono__icontains=q)

        ).order_by('nombre')

        data = []

        for c in clientes:

            ventas_cliente = Venta.objects.filter(
                cliente=c
            )

            total_compras = ventas_cliente.aggregate(
                total=Sum('total')
            )['total'] or 0

            cantidad_ventas = ventas_cliente.count()

            ticket_promedio = 0

            if cantidad_ventas > 0:

                ticket_promedio = (
                    total_compras /
                    cantidad_ventas
                )

            data.append({

                "id": c.id,

                "nombre": c.nombre,

                "telefono": c.telefono,

                "ruc": c.ruc,

                "direccion": c.direccion,

                "activo": c.activo,

                "total_compras":
                float(total_compras),

                "cantidad_ventas":
                cantidad_ventas,

                "ticket_promedio":
                float(ticket_promedio)
            })

        return Response(data)


    # ======================
    # CREAR
    # ======================

    if request.method == 'POST':

        data = request.data

        cliente = Cliente.objects.create(

            nombre=data.get("nombre"),

            telefono=data.get(
                "telefono"
            ),

            ruc=data.get("ruc"),

            direccion=data.get(
                "direccion"
            ),

            activo=data.get(
                "activo",
                True
            )
        )

        return Response({

            "success": True,

            "id": cliente.id
        })


# =========================================
# CLIENTE DETALLE ERP
# =========================================

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])

def cliente_detalle(request, id):

    try:

        cliente = Cliente.objects.get(id=id)

    except Cliente.DoesNotExist:

        return Response({
            "error": "Cliente no existe"
        }, status=404)


    # ======================
    # GET
    # ======================

    if request.method == 'GET':

        ventas_cliente = Venta.objects.filter(
            cliente=cliente
        )

        historial = []

        for v in ventas_cliente:

            historial.append({

                "id": v.id,

                "ticket":
                v.numero_ticket,

                "fecha": v.fecha,

                "total":
                float(v.total),

                "metodo_pago":
                v.metodo_pago
            })

        total_compras = ventas_cliente.aggregate(
            total=Sum('total')
        )['total'] or 0

        cantidad_ventas = ventas_cliente.count()

        ticket_promedio = 0

        if cantidad_ventas > 0:

            ticket_promedio = (
                total_compras /
                cantidad_ventas
            )

        return Response({

            "id": cliente.id,

            "nombre": cliente.nombre,

            "telefono": cliente.telefono,

            "ruc": cliente.ruc,

            "direccion": cliente.direccion,

            "activo": cliente.activo,

            "total_compras":
            float(total_compras),

            "cantidad_ventas":
            cantidad_ventas,

            "ticket_promedio":
            float(ticket_promedio),

            "historial":
            historial
        })


    # ======================
    # PUT
    # ======================

    if request.method == 'PUT':

        data = request.data

        cliente.nombre = data.get(
            "nombre",
            cliente.nombre
        )

        cliente.telefono = data.get(
            "telefono",
            cliente.telefono
        )

        cliente.ruc = data.get(
            "ruc",
            cliente.ruc
        )

        cliente.direccion = data.get(
            "direccion",
            cliente.direccion
        )

        cliente.activo = data.get(
            "activo",
            cliente.activo
        )

        cliente.save()

        return Response({
            "success": True
        })


    # ======================
    # DELETE
    # ======================

    if request.method == 'DELETE':

        cliente.delete()

        return Response({
            "success": True
        })
    

def buscar_productos(request):

    q = request.GET.get('q')

    productos = Producto.objects.filter(
        codigo_barras__icontains=q
    )

    data = []

    for p in productos:

        data.append({
            'id': p.id,
            'nombre': p.nombre,
            'precio': float(p.precio_venta),
            'stock': p.stock,
            'unidad': p.unidad
        })

    return JsonResponse(data, safe=False)


def imprimir_ticket(request, venta_id):
    venta = Venta.objects.get(id=venta_id)

    detalles = venta.detalles.all()

    html = render_to_string('ticket.html', {
        'venta': venta,
        'detalles': detalles
    })

    return HttpResponse(html)

# =========================================
# CUENTAS POR COBRAR
# =========================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def libreta(request):

    cuentas = CuentaPorCobrar.objects.all().order_by('-fecha')

    data = []

    for c in cuentas:

        data.append({

            "id": c.id,

            "cliente_nombre":
            c.cliente_nombre,

            "total":
            float(c.total),

            "pagado":
            float(c.pagado),

            "saldo":
            float(c.saldo),

            "cancelada":
            c.cancelada,

            "fecha":
            c.fecha.strftime(
                "%d/%m/%Y %H:%M"
            )

        })

    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def detalle_libreta(request, id):

    try:

        cuenta = CuentaPorCobrar.objects.get(id=id)

    except CuentaPorCobrar.DoesNotExist:

        return Response(
            {"error": "No encontrada"},
            status=404
        )

    movimientos = []

    for m in cuenta.movimientos.all().order_by("fecha"):

        movimiento = {

            "tipo": m.tipo,

            "fecha": m.fecha.strftime("%d/%m/%Y %H:%M"),

            "monto": float(m.monto),

            "productos": []

        }

        # Si el movimiento proviene de una venta,
        # cargar los productos de esa venta.

        if m.venta:

            detalles = DetalleVenta.objects.filter(
                venta=m.venta
            )

            for d in detalles:

                movimiento["productos"].append({

                    "producto": d.producto.nombre,

                    "cantidad": float(d.cantidad),

                    "precio": float(d.precio_venta),

                    "subtotal": float(d.subtotal)

                })

        movimientos.append(movimiento)

    return Response({

        "cliente": cuenta.cliente_nombre,

        "fecha": cuenta.fecha.strftime("%d/%m/%Y %H:%M"),

        "total": float(cuenta.total),

        "pagado": float(cuenta.pagado),

        "saldo": float(cuenta.saldo),

        "movimientos": movimientos

    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cobrar_libreta(request, id):

    try:

        cuenta = CuentaPorCobrar.objects.get(
            id=id
        )

    except CuentaPorCobrar.DoesNotExist:

        return Response(
            {"error": "Cuenta no encontrada"},
            status=404
        )

    monto = Decimal(
        str(
            request.data.get(
                "monto",
                0
            )
        )
    )

    if monto <= 0:

        return Response(
            {"error":"Monto inválido"},
            status=400
        )

    if monto > cuenta.saldo:

        return Response(
            {
                "error":
                "El pago supera el saldo"
            },
            status=400
        )

    PagoCuentaPorCobrar.objects.create(

        cuenta=cuenta,

        monto=monto

    )

    cuenta.pagado += monto

    cuenta.saldo -= monto

    if cuenta.saldo <= 0:

        cuenta.saldo = 0

        cuenta.cancelada = True

    cuenta.save()

    # Registrar movimiento en historial de libreta

    MovimientoLibreta.objects.create(

        cuenta=cuenta,

        tipo="PAGO",

        monto=monto

    )

    # Obtener caja abierta

    caja = Caja.objects.filter(

        abierta=True

    ).first()

    if caja:

        registrar_movimiento_caja(

            caja=caja,

            tipo="INGRESO",

            descripcion=f"Cobro libreta - {cuenta.cliente_nombre}",

            monto=monto,

            usuario=request.user

        )

    registrar_ingreso(

        categoria="COBRO LIBRETA",

        descripcion=f"Cobro de {cuenta.cliente_nombre}",

        monto=monto,

        usuario=request.user,

        metodo_pago="EFECTIVO",

        referencia=f"LIB-{cuenta.id}"

    )

    return Response({

        "ok": True,

        "saldo":
        float(cuenta.saldo),

        "pagado":
        float(cuenta.pagado),

        "cancelada":
        cuenta.cancelada

    })

    

# =========================================
# BUSCAR LIBRETAS
# =========================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def buscar_libreta(request):

    texto = request.GET.get("q", "").strip()

    cuentas = (
        CuentaPorCobrar.objects
        .filter(cliente_nombre__icontains=texto)
        .values("cliente_nombre")
        .distinct()
        .order_by("cliente_nombre")
    )

    data = []

    for c in cuentas:

        nombre = c["cliente_nombre"]

        saldo = (
            CuentaPorCobrar.objects
            .filter(
                cliente_nombre=nombre,
                cancelada=False
            )
            .aggregate(total=Sum("saldo"))
        )["total"] or 0

        data.append({

            "nombre": nombre,

            "saldo": float(saldo)

        })

    return Response(data)

# =========================================
# REPORTES ERP
# =========================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reportes(request):

    try:

        # =========================================
        # FECHAS
        # =========================================

        desde = request.GET.get("desde")
        hasta = request.GET.get("hasta")

        ventas = Venta.objects.filter(
            estado="COMPLETADA"
        )

        # -----------------------------------------
        # FILTRO DESDE
        # -----------------------------------------

        if desde:

            ventas = ventas.filter(
                fecha__date__gte=desde
            )

        # -----------------------------------------
        # FILTRO HASTA
        # -----------------------------------------

        if hasta:

            ventas = ventas.filter(
                fecha__date__lte=hasta
            )


        # =========================================
        # RESUMEN DE VENTAS
        # =========================================

        resumen = ventas.aggregate(

            total_ventas=Sum("total")

        )

        total_ventas = (
            resumen["total_ventas"]
            or Decimal("0")
        )

        cantidad_ventas = ventas.count()


        # =========================================
        # DETALLES DE LAS VENTAS
        # =========================================

        detalles = DetalleVenta.objects.filter(
            venta__in=ventas
        )


        # =========================================
        # GANANCIA TOTAL
        # =========================================

        ganancia_data = detalles.aggregate(

            ganancia=Sum("ganancia")

        )

        ganancia = (
            ganancia_data["ganancia"]
            or Decimal("0")
        )


        # =========================================
        # TICKET PROMEDIO
        # =========================================

        if cantidad_ventas > 0:

            ticket_promedio = (
                total_ventas /
                Decimal(str(cantidad_ventas))
            )

        else:

            ticket_promedio = Decimal("0")


        # =========================================
        # MÉTODOS DE PAGO
        # =========================================

        metodos_pago = {}

        for metodo, nombre in Venta.METODOS:

            total_metodo = ventas.filter(
                metodo_pago=metodo
            ).aggregate(
                total=Sum("total")
            )["total"] or Decimal("0")

            metodos_pago[metodo] = float(
                total_metodo
            )


        # =========================================
        # PRODUCTOS MÁS VENDIDOS
        # =========================================

        productos_vendidos = detalles.values(
            "producto__id",
            "producto__nombre"
        ).annotate(

            cantidad=Sum("cantidad"),

            total=Sum("subtotal"),

            ganancia=Sum("ganancia")

        ).order_by(
            "-cantidad"
        )[:10]


        productos_mas_vendidos = []

        for producto in productos_vendidos:

            productos_mas_vendidos.append({

                "id":
                producto["producto__id"],

                "nombre":
                producto["producto__nombre"],

                "cantidad":
                float(producto["cantidad"] or 0),

                "total":
                float(producto["total"] or 0),

                "ganancia":
                float(producto["ganancia"] or 0)

            })


        # =========================================
        # PRODUCTOS MÁS RENTABLES
        # =========================================

        productos_rentables = detalles.values(
            "producto__id",
            "producto__nombre"
        ).annotate(

            ganancia=Sum("ganancia"),

            cantidad=Sum("cantidad"),

            total=Sum("subtotal")

        ).order_by(
            "-ganancia"
        )[:10]


        productos_mas_rentables = []

        for producto in productos_rentables:

            productos_mas_rentables.append({

                "id":
                producto["producto__id"],

                "nombre":
                producto["producto__nombre"],

                "ganancia":
                float(producto["ganancia"] or 0),

                "cantidad":
                float(producto["cantidad"] or 0),

                "total":
                float(producto["total"] or 0)

            })


        # =========================================
        # LIBRETA
        # =========================================

        ventas_libreta = ventas.filter(
            metodo_pago="LIBRETA"
        )

        libreta_vendido = (
            ventas_libreta.aggregate(
                total=Sum("total")
            )["total"]
            or Decimal("0")
        )


        # =========================================
        # COBROS DE LIBRETA
        # =========================================

        movimientos_libreta = MovimientoLibreta.objects.filter(
            tipo="PAGO"
        )

        if desde:

            movimientos_libreta = movimientos_libreta.filter(
                fecha__date__gte=desde
            )

        if hasta:

            movimientos_libreta = movimientos_libreta.filter(
                fecha__date__lte=hasta
            )


        libreta_cobrado = (
            movimientos_libreta.aggregate(
                total=Sum("monto")
            )["total"]
            or Decimal("0")
        )


        # =========================================
        # SALDO PENDIENTE ACTUAL
        # =========================================

        cuentas = CuentaPorCobrar.objects.filter(
            cancelada=False
        )

        libreta_pendiente = (
            cuentas.aggregate(
                total=Sum("saldo")
            )["total"]
            or Decimal("0")
        )


        # =========================================
        # VENTAS POR DÍA
        # =========================================

        from django.db.models.functions import TruncDate

        ventas_dia = ventas.annotate(

            dia=TruncDate("fecha")

        ).values(
            "dia"
        ).annotate(

            total=Sum("total"),

        ).order_by(
            "dia"
        )


        ventas_por_dia = []

        for venta_dia in ventas_dia:

            ventas_por_dia.append({

                "fecha":
                venta_dia["dia"].strftime(
                    "%Y-%m-%d"
                ),

                "total":
                float(
                    venta_dia["total"] or 0
                )

            })


        # =========================================
        # RESPUESTA
        # =========================================

        return Response({

            "resumen": {

                "total_ventas":
                float(total_ventas),

                "cantidad_ventas":
                cantidad_ventas,

                "ganancia":
                float(ganancia),

                "ticket_promedio":
                float(ticket_promedio)

            },

            "metodos_pago":
            metodos_pago,

            "ventas_por_dia":
            ventas_por_dia,

            "productos_mas_vendidos":
            productos_mas_vendidos,

            "productos_mas_rentables":
            productos_mas_rentables,

            "libreta": {

                "vendido":
                float(libreta_vendido),

                "cobrado":
                float(libreta_cobrado),

                "pendiente":
                float(libreta_pendiente)

            }

        })

    except Exception as e:

        import traceback

        traceback.print_exc()

        return Response({

            "error":
            str(e)

        }, status=500)