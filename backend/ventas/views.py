from config.fechas import filtrar_rango, totales_por_dia
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from datetime import date
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
from finanzas.services import registrar_egreso
from usuarios.permissions import requiere_roles, obtener_rol
from django.utils import timezone
from django.conf import settings
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


UNIDADES_FRACCIONABLES = {"kg", "g", "lt", "l"}


def seleccionar_caja_abierta(request, requerida=True, bloquear=False):
    """Resuelve la caja indicada por el POS sin cruzar movimientos entre cajas.

    Si no se envía ``caja_id`` solo se usa una caja abierta del propio usuario;
    nunca se toma arbitrariamente la caja de otra persona.
    """
    datos = request.data if isinstance(request.data, dict) else {}
    caja_id = datos.get("caja_id") or request.query_params.get("caja_id")
    cajas = Caja.objects.filter(abierta=True)
    if bloquear:
        cajas = cajas.select_for_update()
    if caja_id:
        try:
            return cajas.get(id=int(caja_id)), None
        except (Caja.DoesNotExist, ValueError, TypeError):
            return None, Response({"error": "La caja seleccionada no existe o está cerrada"}, status=400)
    caja = cajas.filter(usuario=request.user).order_by("-id").first()
    if requerida and not caja:
        return None, Response({"error": "No hay una caja abierta seleccionada"}, status=400)
    return caja, None


def efectivo_en_caja(caja):
    """Efectivo esperado: apertura + ingresos - retiros - gastos."""
    resumen = {
        item["tipo"]: item["total"] or Decimal("0")
        for item in MovimientoCaja.objects.filter(caja=caja)
        .values("tipo").annotate(total=Sum("monto"))
    }
    ingresos = resumen.get("INGRESO", Decimal("0"))
    retiros = resumen.get("RETIRO", Decimal("0"))
    gastos = resumen.get("GASTO", Decimal("0"))
    return caja.monto_inicial + ingresos - retiros - gastos, ingresos, retiros, gastos


def formatear_guaranies(valor):
    """Formatea un importe en guaraníes sin decimales: 1234567 -> 1.234.567."""
    entero = Decimal(valor or 0).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return f"{entero:,}".replace(",", ".")


def _parse_fecha(valor):
    """Devuelve una fecha a partir de AAAA-MM-DD, None si viene vacía o ValueError."""
    if not valor:
        return None
    return date.fromisoformat(str(valor).strip())


def _validar_cliente(data):
    """Normaliza los campos editables de un cliente."""
    if not isinstance(data, dict):
        return None, Response({"error": "Datos de cliente inválidos."}, status=400)
    limites = {"nombre": 200, "telefono": 50, "ruc": 50, "direccion": 500}
    datos = {}
    for campo, limite in limites.items():
        if campo not in data:
            continue
        valor = data.get(campo)
        if valor is None:
            valor = ""
        if not isinstance(valor, str):
            return None, Response({"error": f"El campo {campo} no es válido."}, status=400)
        valor = valor.strip()
        if len(valor) > limite:
            return None, Response({"error": f"El campo {campo} supera {limite} caracteres."}, status=400)
        datos[campo] = valor if (valor or campo == "nombre") else None
    if "activo" in data:
        if not isinstance(data["activo"], bool):
            return None, Response({"error": "El estado activo debe ser verdadero o falso."}, status=400)
        datos["activo"] = data["activo"]
    return datos, None


# =========================================
# CREAR VENTA ERP
# =========================================


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def crear_venta(request):

    try:

        productos = request.data.get("productos", [])
        metodo_pago = request.data.get("metodo_pago", "EFECTIVO")
        cliente_nombre = request.data.get("cliente_nombre", "")
        cliente_nombre = cliente_nombre.strip() if isinstance(cliente_nombre, str) else ""

        metodos_validos = {codigo for codigo, _ in Venta.METODOS}
        if not isinstance(metodo_pago, str) or metodo_pago not in metodos_validos:
            return Response({"error": "Método de pago inválido."}, status=400)

        if not productos or not isinstance(productos, list):

            return Response({
                "error": "No hay productos."
            }, status=400)

        if len(cliente_nombre) > 200:
            return Response({"error": "El nombre del cliente es demasiado largo."}, status=400)

        if metodo_pago == "LIBRETA" and not cliente_nombre:

            return Response({
                "error": "Debe ingresar el nombre del cliente."
            }, status=400)

        with transaction.atomic():

            caja, error = seleccionar_caja_abierta(request, bloquear=True)
            if error:
                return error

            venta = Venta.objects.create(

                usuario=request.user,

                caja=caja,

                metodo_pago=metodo_pago,

                total=0

            )

            total = Decimal("0")

            for item in productos:

                if not isinstance(item, dict):
                    transaction.set_rollback(True)
                    return Response({"error": "Detalle de producto inválido."}, status=400)

                try:
                    producto = Producto.objects.select_for_update().get(id=item["id"], activo=True)
                    cantidad = Decimal(str(item["cantidad"]))
                except (KeyError, ValueError, TypeError, Producto.DoesNotExist):
                    transaction.set_rollback(True)
                    return Response({"error": "Producto o cantidad inválida."}, status=400)

                if not cantidad.is_finite() or cantidad <= 0 or cantidad.as_tuple().exponent < -3:
                    transaction.set_rollback(True)
                    return Response({"error": "La cantidad debe ser positiva y tener hasta tres decimales."}, status=400)

                if (producto.unidad or "").lower() not in UNIDADES_FRACCIONABLES and cantidad != cantidad.to_integral_value():
                    transaction.set_rollback(True)
                    return Response({"error": f"{producto.nombre} se vende por unidad; la cantidad debe ser entera."}, status=400)

                if producto.stock < cantidad:

                    transaction.set_rollback(True)

                    return Response({

                        "error":
                        f"Stock insuficiente de {producto.nombre}"

                    }, status=400)

                costo_unitario = Decimal(str(producto.costo_promedio or producto.precio_compra))
                precio = Decimal(str(producto.precio_venta))

                subtotal = (precio * cantidad).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

                ganancia = (
                    (precio - costo_unitario) * cantidad
                ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

                DetalleVenta.objects.create(

                    venta=venta,

                    producto=producto,

                    cantidad=cantidad,

                    precio_venta=precio,

                    precio_compra=costo_unitario,

                    subtotal=subtotal,

                    ganancia=ganancia

                )

                # El servicio aplica el descuento y registra el movimiento una sola vez.
                registrar_movimiento(

                    producto=producto,

                    tipo="VENTA",

                    cantidad=cantidad,

                    usuario=request.user,

                    motivo=f"Venta #{venta.id}"

                )

                total += subtotal

            venta.total = total
            venta.numero_ticket = f"TICKET-{venta.id:06d}"
            venta.save()

            # ==========================
            # LIBRETA
            # ==========================

            if metodo_pago == "LIBRETA":

                cuenta = CuentaPorCobrar.objects.select_for_update().filter(

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

                if metodo_pago == "EFECTIVO":
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

    except Exception:

        import logging
        logging.getLogger(__name__).exception("No se pudo registrar la venta")

        return Response({

            "error": "No se pudo registrar la venta. Verifica los datos y vuelve a intentar."

        }, status=500)

# =========================================
# HISTORIAL VENTAS
# =========================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def historial_ventas(request):
    """Últimas ventas con filtros opcionales. El cajero solo ve sus ventas."""
    ventas = Venta.objects.select_related('usuario', 'caja', 'cliente').order_by('-fecha')

    if obtener_rol(request.user) not in ("ADMIN", "GERENTE"):
        ventas = ventas.filter(usuario=request.user)

    try:
        desde = _parse_fecha(request.query_params.get("desde"))
        hasta = _parse_fecha(request.query_params.get("hasta"))
    except ValueError:
        return Response({"error": "Fechas inválidas. Usa el formato AAAA-MM-DD."}, status=400)
    ventas = filtrar_rango(ventas, "fecha", desde, hasta)

    q = (request.query_params.get("q") or "").strip()
    if q:
        filtro = Q(numero_ticket__icontains=q)
        if q.isdigit():
            filtro |= Q(id=int(q))
        ventas = ventas.filter(filtro)

    estado = (request.query_params.get("estado") or "").strip().upper()
    if estado:
        ventas = ventas.filter(estado=estado)

    data = []
    for venta in ventas[:300]:
        data.append({
            'id': venta.id,
            'ticket': venta.numero_ticket,
            'fecha': timezone.localtime(venta.fecha).strftime('%d/%m/%Y %H:%M'),
            'usuario': venta.usuario.username if venta.usuario else 'N/A',
            'cliente': venta.cliente.nombre if venta.cliente else 'Consumidor Final',
            'total': float(venta.total),
            'metodo_pago': venta.metodo_pago,
            'estado': venta.estado,
            'caja': venta.caja.id if venta.caja else None,
        })

    return Response(data)


# =========================================
# ANULAR VENTA
# =========================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def anular_venta(request, venta_id):
    requiere_roles(request.user, "ADMIN", "GERENTE")
    try:
        with transaction.atomic():
            venta = Venta.objects.select_for_update().get(id=venta_id)
            if venta.estado != "COMPLETADA":
                return Response({"error": "Solo se pueden anular ventas completadas."}, status=400)

            detalles = DetalleVenta.objects.filter(venta=venta).select_related("producto")
            for detalle in detalles:
                producto = Producto.objects.select_for_update().get(id=detalle.producto_id)
                registrar_movimiento(
                    producto=producto,
                    tipo="AJUSTE",
                    cantidad=detalle.cantidad,
                    usuario=request.user,
                    motivo=f"Anulación venta #{venta.id}",
                )

            if venta.metodo_pago == "LIBRETA":
                movimiento = MovimientoLibreta.objects.filter(
                    venta=venta, tipo="COMPRA"
                ).select_related("cuenta").first()
                if movimiento:
                    cuenta = CuentaPorCobrar.objects.select_for_update().get(id=movimiento.cuenta_id)
                    # La cuenta acumula varias ventas; solo se puede descontar
                    # lo que todavía se adeuda sin devolver dinero ya cobrado.
                    if cuenta.saldo < venta.total:
                        transaction.set_rollback(True)
                        return Response({"error": "No se puede anular: el saldo pendiente de la libreta es menor que la venta. Regulariza la libreta primero."}, status=400)
                    cuenta.total -= venta.total
                    cuenta.saldo -= venta.total
                    cuenta.cancelada = cuenta.saldo == 0
                    cuenta.save(update_fields=["total", "saldo", "cancelada"])
                    MovimientoLibreta.objects.create(
                        cuenta=cuenta, venta=venta, tipo="ANULACION", monto=venta.total
                    )
            else:
                if venta.metodo_pago == "EFECTIVO":
                    caja_reembolso = None
                    if venta.caja_id:
                        caja_reembolso = Caja.objects.select_for_update().filter(id=venta.caja_id, abierta=True).first()
                    if caja_reembolso is None:
                        caja_reembolso, error = seleccionar_caja_abierta(request, bloquear=True)
                        if error:
                            transaction.set_rollback(True)
                            return Response({"error": "La caja original está cerrada. Abre o selecciona una caja para registrar la devolución en efectivo."}, status=400)
                    if efectivo_en_caja(caja_reembolso)[0] < venta.total:
                        transaction.set_rollback(True)
                        return Response({"error": "La caja no tiene efectivo suficiente para devolver esta venta."}, status=400)
                    registrar_movimiento_caja(
                        caja=caja_reembolso,
                        tipo="RETIRO",
                        descripcion=f"Devolución por anulación de venta #{venta.id}",
                        monto=venta.total,
                        usuario=request.user,
                    )
                registrar_egreso(
                    categoria="OTRO",
                    descripcion=f"Reversión de venta anulada #{venta.id}",
                    monto=venta.total,
                    usuario=request.user,
                    metodo_pago=venta.metodo_pago,
                    referencia=venta.numero_ticket or str(venta.id),
                )

            venta.estado = "ANULADA"
            venta.save(update_fields=["estado"])
            from auditoria.services import registrar_auditoria
            registrar_auditoria(
                usuario=request.user,
                modulo="VENTAS",
                accion="ANULAR_VENTA",
                referencia=f"Venta #{venta.id}",
                detalle=f"Total reversado: {venta.total}",
            )

        return Response({
            "success": True
        })

    except Venta.DoesNotExist:
        return Response({"error": "Venta no encontrada."}, status=404)
    except Exception:
        import logging
        logging.getLogger(__name__).exception("No se pudo anular la venta")
        return Response({"error": "No se pudo anular la venta."}, status=500)


# =========================================
# ABRIR CAJA
# =========================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])

def abrir_caja(request):
    try:
        monto_inicial = Decimal(str(request.data.get("monto_inicial", 0)))
        if not monto_inicial.is_finite() or monto_inicial < 0:
            raise ValueError
    except (InvalidOperation, TypeError, ValueError):
        return Response({"error": "Monto inicial inválido"}, status=400)
    caja = Caja.objects.create(usuario=request.user, monto_inicial=monto_inicial, abierta=True)
    from auditoria.services import registrar_auditoria
    registrar_auditoria(
        usuario=request.user, modulo="CAJA", accion="ABRIR_CAJA",
        referencia=f"Caja #{caja.id}", detalle=f"Monto inicial: {monto_inicial}",
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
    caja, error = seleccionar_caja_abierta(request, requerida=False)

    if not caja:

        return Response({
            "error": "No hay caja abierta"
        }, status=400)

    monto_actual, ingresos, retiros, gastos = efectivo_en_caja(caja)

    return Response({

        "caja_id": caja.id,
        "usuario": caja.usuario.username,
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

        data = request.data
        descripcion = data.get("descripcion", "")
        try:
            monto = Decimal(str(data.get("monto", "")))
        except (InvalidOperation, TypeError, ValueError):
            return Response({"error": "Monto inválido"}, status=400)
        if not isinstance(descripcion, str) or not descripcion.strip() or not monto.is_finite() or monto <= 0:
            return Response({"error": "Descripción y monto positivo son obligatorios"}, status=400)

        with transaction.atomic():
            caja, error = seleccionar_caja_abierta(request, bloquear=True)
            if error:
                return error
            if monto > efectivo_en_caja(caja)[0]:
                return Response({"error": "El retiro supera el efectivo disponible en la caja."}, status=400)
            registrar_movimiento_caja(caja=caja, tipo="RETIRO", descripcion=descripcion.strip(), monto=monto, usuario=request.user)
            from auditoria.services import registrar_auditoria
            registrar_auditoria(usuario=request.user, modulo="CAJA", accion="RETIRO_CAJA",
                                referencia=f"Caja #{caja.id}", detalle=f"{descripcion.strip()[:150]}: {monto}")

        return Response({
            "success": True
        })

    except Exception:
        import logging
        logging.getLogger(__name__).exception("No se pudo registrar el retiro de caja")
        return Response({"error": "No se pudo registrar el retiro."}, status=500)


# =========================================
# GASTO CAJA
# =========================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])

def gasto_caja(request):

    try:

        data = request.data
        descripcion = data.get("descripcion", "")
        try:
            monto = Decimal(str(data.get("monto", "")))
        except (InvalidOperation, TypeError, ValueError):
            return Response({"error": "Monto inválido"}, status=400)
        if not isinstance(descripcion, str) or not descripcion.strip() or not monto.is_finite() or monto <= 0:
            return Response({"error": "Descripción y monto positivo son obligatorios"}, status=400)

        with transaction.atomic():
            caja, error = seleccionar_caja_abierta(request, bloquear=True)
            if error:
                return error
            if monto > efectivo_en_caja(caja)[0]:
                return Response({"error": "El gasto supera el efectivo disponible en la caja."}, status=400)
            registrar_movimiento_caja(caja=caja, tipo="GASTO", descripcion=descripcion.strip(), monto=monto, usuario=request.user)
            registrar_egreso(
                categoria="GASTO",
                descripcion=descripcion.strip(),
                monto=monto,
                usuario=request.user,
                metodo_pago="EFECTIVO",
                referencia=f"Caja #{caja.id}",
            )

        return Response({
            "success": True
        })

    except Exception:
        import logging
        logging.getLogger(__name__).exception("No se pudo registrar el gasto de caja")
        return Response({"error": "No se pudo registrar el gasto."}, status=500)


# =========================================
# CERRAR CAJA
# =========================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])

def cerrar_caja(request):
    try:
        monto_real = Decimal(str(request.data.get("monto_real", "")))
        if not monto_real.is_finite() or monto_real < 0:
            raise ValueError
    except (InvalidOperation, TypeError, ValueError):
        return Response({"error": "Monto contado inválido"}, status=400)

    with transaction.atomic():
        caja, error = seleccionar_caja_abierta(request, bloquear=True)
        if error:
            return error
        ventas_total = Venta.objects.filter(
            caja=caja, estado="COMPLETADA"
        ).aggregate(total=Sum("total"))["total"] or Decimal("0")
        monto_sistema = efectivo_en_caja(caja)[0]
        diferencia = monto_real - monto_sistema
        caja.total_vendido = ventas_total
        caja.monto_cierre = monto_real
        caja.diferencia = diferencia
        caja.fecha_cierre = now()
        caja.abierta = False
        caja.save(update_fields=["total_vendido", "monto_cierre", "diferencia", "fecha_cierre", "abierta"])
        from auditoria.services import registrar_auditoria
        registrar_auditoria(
            usuario=request.user,
            modulo="CAJA",
            accion="CERRAR_CAJA",
            referencia=f"Caja #{caja.id}",
            detalle=f"Sistema: {monto_sistema}; contado: {monto_real}; diferencia: {diferencia}",
        )

    return Response({"caja_id": caja.id, "monto_sistema": float(monto_sistema),
                     "monto_real": float(monto_real), "diferencia": float(diferencia)})

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
    cajas = Caja.objects.filter(abierta=True).select_related("usuario").order_by("id")
    return Response({"abierta": cajas.exists(), "cajas": [{"id": c.id, "usuario": c.usuario.username, "fecha_apertura": c.fecha_apertura, "seleccionada": False} for c in cajas]})

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

        datos, error = _validar_cliente(request.data)
        if error:
            return error
        if not datos.get("nombre"):
            return Response({"error": "El nombre del cliente es obligatorio."}, status=400)

        cliente = Cliente.objects.create(**datos)

        return Response({"success": True, "id": cliente.id})


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

        datos, error = _validar_cliente(request.data)
        if error:
            return error
        if "nombre" in datos and not datos["nombre"]:
            return Response({"error": "El nombre del cliente es obligatorio."}, status=400)
        for campo, valor in datos.items():
            setattr(cliente, campo, valor)
        cliente.save()

        return Response({"success": True})


    # ======================
    # DELETE (archivado lógico para conservar el historial)
    # ======================

    if request.method == 'DELETE':
        requiere_roles(request.user, "ADMIN", "GERENTE")

        cliente.activo = False
        cliente.save(update_fields=["activo"])

        return Response({"success": True, "activo": False})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def buscar_productos(request):

    q = request.query_params.get('q', '').strip()
    if not q:
        return Response([])

    productos = Producto.objects.filter(
        codigo_barra__icontains=q,
        activo=True,
    )[:20]

    data = []

    for p in productos:

        data.append({
            'id': p.id,
            'nombre': p.nombre,
            'precio_venta': float(p.precio_venta),
            'stock': float(p.stock),
            'unidad': p.unidad
        })

    return JsonResponse(data, safe=False)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def imprimir_ticket(request, venta_id):
    try:
        venta = Venta.objects.select_related("usuario", "caja").get(id=venta_id)
    except Venta.DoesNotExist:
        return Response({"error": "Venta no encontrada."}, status=404)

    if obtener_rol(request.user) not in ("ADMIN", "GERENTE") and venta.usuario_id != request.user.id:
        return Response({"error": "Solo puedes reimprimir tus propias ventas."}, status=403)

    lineas = []
    for d in venta.detalleventa_set.select_related("producto").all():
        cantidad = d.cantidad.normalize()
        lineas.append({
            "nombre": d.producto.nombre,
            "cantidad": f"{cantidad:f}".replace(".", ","),
            "precio": formatear_guaranies(d.precio_venta),
            "subtotal": formatear_guaranies(d.subtotal),
        })

    cliente = venta.cliente.nombre if venta.cliente_id else ""
    if not cliente and venta.metodo_pago == "LIBRETA":
        mov = MovimientoLibreta.objects.filter(venta=venta, tipo="COMPRA").select_related("cuenta").first()
        cliente = mov.cuenta.cliente_nombre if mov else ""

    html = render_to_string('ticket.html', {
        'venta': venta,
        'lineas': lineas,
        'fecha': timezone.localtime(venta.fecha).strftime('%d/%m/%Y %H:%M'),
        'total': formatear_guaranies(venta.total),
        'metodo': venta.get_metodo_pago_display(),
        'cliente': cliente,
        'negocio': settings.NEGOCIO,
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
            timezone.localtime(c.fecha).strftime(
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

            "fecha": timezone.localtime(m.fecha).strftime("%d/%m/%Y %H:%M"),

            "monto": float(m.monto),

            "productos": []

        }

        # Si el movimiento proviene de una venta,
        # cargar los productos de esa venta.

        if m.venta_id and m.tipo == "COMPRA":

            detalles = DetalleVenta.objects.select_related("producto").filter(
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

        "fecha": timezone.localtime(cuenta.fecha).strftime("%d/%m/%Y %H:%M"),

        "total": float(cuenta.total),

        "pagado": float(cuenta.pagado),

        "saldo": float(cuenta.saldo),

        "movimientos": movimientos

    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cobrar_libreta(request, id):
    try:
        monto = Decimal(str(request.data.get("monto", "")))
        if not monto.is_finite() or monto <= 0:
            raise ValueError
    except (InvalidOperation, TypeError, ValueError):
        return Response({"error": "Monto inválido"}, status=400)

    with transaction.atomic():
        try:
            cuenta = CuentaPorCobrar.objects.select_for_update().get(id=id)
        except CuentaPorCobrar.DoesNotExist:
            return Response({"error": "Cuenta no encontrada"}, status=404)
        if monto > cuenta.saldo:
            return Response({"error": "El pago supera el saldo"}, status=400)
        caja, error = seleccionar_caja_abierta(request, bloquear=True)
        if error:
            return error
        PagoCuentaPorCobrar.objects.create(cuenta=cuenta, monto=monto)
        cuenta.pagado += monto
        cuenta.saldo -= monto
        cuenta.cancelada = cuenta.saldo == 0
        cuenta.save(update_fields=["pagado", "saldo", "cancelada"])
        MovimientoLibreta.objects.create(cuenta=cuenta, tipo="PAGO", monto=monto)
        registrar_movimiento_caja(
            caja=caja, tipo="INGRESO",
            descripcion=f"Cobro libreta - {cuenta.cliente_nombre}",
            monto=monto, usuario=request.user,
        )
        registrar_ingreso(
            categoria="VENTA", descripcion=f"Cobro libreta - {cuenta.cliente_nombre}",
            monto=monto, usuario=request.user, metodo_pago="EFECTIVO",
            referencia=f"Cuenta #{cuenta.id}",
        )
        from auditoria.services import registrar_auditoria
        registrar_auditoria(
            usuario=request.user, modulo="LIBRETA", accion="COBRAR_LIBRETA",
            referencia=f"Cuenta #{cuenta.id}",
            detalle=f"Cobro: {monto}; saldo restante: {cuenta.saldo}; caja #{caja.id}",
        )

    return Response({"success": True, "saldo": float(cuenta.saldo)})

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
    requiere_roles(request.user, "ADMIN", "GERENTE")
    try:
        desde = _parse_fecha(request.GET.get("desde"))
        hasta = _parse_fecha(request.GET.get("hasta"))
    except ValueError:
        return Response({"error": "Fechas inválidas. Usa el formato AAAA-MM-DD."}, status=400)

    try:

        ventas = Venta.objects.filter(
            estado="COMPLETADA"
        )

        # -----------------------------------------
        # FILTRO DESDE
        # -----------------------------------------

        ventas = filtrar_rango(ventas, "fecha", desde, hasta)


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

        movimientos_libreta = filtrar_rango(movimientos_libreta, "fecha", desde, hasta)


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

        ventas_por_dia = [
            {"fecha": dia.isoformat(), "total": float(total)}
            for dia, total in totales_por_dia(ventas)
        ]


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

    except Exception:
        import logging
        logging.getLogger(__name__).exception("No se pudo generar el reporte de ventas")
        return Response({"error": "No se pudo generar el reporte solicitado."}, status=500)
