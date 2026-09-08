from django.db import models
from django.contrib.auth.models import User
from inventario.models import Producto
from django.contrib.auth.models import User

class Caja(models.Model):

    usuario = models.ForeignKey(User, on_delete=models.PROTECT)
    fecha_apertura = models.DateTimeField(auto_now_add=True)
    fecha_cierre = models.DateTimeField(null=True, blank=True)

    monto_inicial = models.DecimalField(max_digits=14, decimal_places=2)
    monto_cierre = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)

    total_vendido = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    diferencia = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    abierta = models.BooleanField(default=True)

    def __str__(self):
        return f"Caja {self.usuario.username} - {self.fecha_apertura.date()}"
    
class MovimientoCaja(models.Model):

    TIPOS = (
        ('INGRESO', 'INGRESO'),
        ('RETIRO', 'RETIRO'),
        ('GASTO', 'GASTO'),
    )

    caja = models.ForeignKey(
        Caja,
        on_delete=models.CASCADE
    )

    tipo = models.CharField(
        max_length=20,
        choices=TIPOS
    )

    descripcion = models.TextField()

    monto = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    fecha = models.DateTimeField(
        auto_now_add=True
    )

    usuario = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True
    )

    def __str__(self):
        return f"{self.tipo} - {self.monto}"


class Cliente(models.Model):

    nombre = models.CharField(
        max_length=200
    )

    telefono = models.CharField(
        max_length=50,
        blank=True,
        null=True
    )

    ruc = models.CharField(
        max_length=50,
        blank=True,
        null=True
    )

    direccion = models.TextField(
        blank=True,
        null=True
    )

    activo = models.BooleanField(
        default=True
    )

    def __str__(self):
        return self.nombre

class Venta(models.Model):

    caja = models.ForeignKey('Caja', on_delete=models.PROTECT, null=True, blank=True)

    ESTADOS = (
    ('COMPLETADA', 'COMPLETADA'),
    ('ANULADA', 'ANULADA'),
    ('DEVOLUCION', 'DEVOLUCION'),
    
    )

    estado = models.CharField(
    max_length=20,
    choices=ESTADOS,
    default='COMPLETADA'
    )

    cliente = models.ForeignKey(
    Cliente,
    on_delete=models.SET_NULL,
    null=True,
    blank=True
    )

    numero_ticket = models.CharField(
    max_length=50,
    unique=True,
    null=True,
    blank=True
    )



    METODOS = (
    ('EFECTIVO','Efectivo'),
    ('TARJETA','Tarjeta'),
    ('TRANSFERENCIA','Transferencia'),
    ('LIBRETA','Libreta'),
)

    usuario = models.ForeignKey(User, on_delete=models.PROTECT)
    total = models.DecimalField(max_digits=14, decimal_places=2)
    metodo_pago = models.CharField(max_length=20, choices=METODOS)
    fecha = models.DateTimeField(auto_now_add=True)

class DetalleVenta(models.Model):

    venta = models.ForeignKey(
        Venta,
        on_delete=models.CASCADE
    )

    producto = models.ForeignKey(
        Producto,
        on_delete=models.CASCADE
    )

    cantidad = models.DecimalField(
        max_digits=10,
        decimal_places=3
    )

    precio_venta = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    precio_compra = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    subtotal = models.DecimalField(
        max_digits=14,
        decimal_places=2
    )

    ganancia = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0
    )

class CuentaPorCobrar(models.Model):

    cliente_nombre = models.CharField(
        max_length=200
    )

    venta = models.ForeignKey(
        Venta,
        on_delete=models.CASCADE
    )

    total = models.DecimalField(
        max_digits=14,
        decimal_places=2
    )

    saldo = models.DecimalField(
        max_digits=14,
        decimal_places=2
    )

    pagado = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0
    )

    fecha = models.DateTimeField(
        auto_now_add=True
    )

    cancelada = models.BooleanField(
        default=False
    )

    def __str__(self):

        return self.cliente_nombre

class MovimientoLibreta(models.Model):

    TIPOS = (

        ("COMPRA", "Compra"),

        ("PAGO", "Pago"),

    )

    cuenta = models.ForeignKey(

        CuentaPorCobrar,

        on_delete=models.CASCADE,

        related_name="movimientos"

    )

    venta = models.ForeignKey(

        Venta,

        on_delete=models.SET_NULL,

        null=True,

        blank=True

    )

    tipo = models.CharField(

        max_length=20,

        choices=TIPOS

    )

    monto = models.DecimalField(

        max_digits=14,

        decimal_places=2

    )

    fecha = models.DateTimeField(

        auto_now_add=True

    )

    def __str__(self):

        return f"{self.tipo} - {self.monto}"
    
class PagoCuentaPorCobrar(models.Model):

    cuenta = models.ForeignKey(
        CuentaPorCobrar,
        on_delete=models.CASCADE,
        related_name="pagos"
    )

    monto = models.DecimalField(
        max_digits=14,
        decimal_places=2
    )

    fecha = models.DateTimeField(
        auto_now_add=True
    )

    observacion = models.TextField(
        blank=True,
        null=True
    )

    def __str__(self):

        return f"Pago {self.monto}"