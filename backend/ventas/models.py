from django.contrib.auth.models import User
from django.db import models

from inventario.models import Producto


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
        ("INGRESO", "INGRESO"),
        ("RETIRO", "RETIRO"),
        ("GASTO", "GASTO"),
    )

    caja = models.ForeignKey(Caja, on_delete=models.CASCADE)

    tipo = models.CharField(max_length=20, choices=TIPOS)

    descripcion = models.TextField()

    monto = models.DecimalField(max_digits=12, decimal_places=2)

    fecha = models.DateTimeField(auto_now_add=True)

    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return f"{self.tipo} - {self.monto}"


class Cliente(models.Model):
    nombre = models.CharField(max_length=200)

    telefono = models.CharField(max_length=50, blank=True, null=True)

    ruc = models.CharField(max_length=50, blank=True, null=True)

    direccion = models.TextField(blank=True, null=True)

    activo = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre


class Venta(models.Model):
    caja = models.ForeignKey("Caja", on_delete=models.PROTECT, null=True, blank=True)

    ESTADOS = (
        ("COMPLETADA", "COMPLETADA"),
        ("ANULADA", "ANULADA"),
        ("DEVOLUCION", "DEVOLUCION"),
    )

    estado = models.CharField(max_length=20, choices=ESTADOS, default="COMPLETADA")

    cliente = models.ForeignKey(Cliente, on_delete=models.SET_NULL, null=True, blank=True)

    numero_ticket = models.CharField(max_length=50, unique=True, null=True, blank=True)

    METODOS = (
        ("EFECTIVO", "Efectivo"),
        ("TARJETA", "Tarjeta"),
        ("TRANSFERENCIA", "Transferencia"),
        ("LIBRETA", "Libreta"),
    )

    usuario = models.ForeignKey(User, on_delete=models.PROTECT)
    total = models.DecimalField(max_digits=14, decimal_places=2)
    metodo_pago = models.CharField(max_length=20, choices=METODOS)
    fecha = models.DateTimeField(auto_now_add=True)


class DetalleVenta(models.Model):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE)

    producto = models.ForeignKey(Producto, on_delete=models.CASCADE)

    cantidad = models.DecimalField(max_digits=10, decimal_places=3)

    precio_venta = models.DecimalField(max_digits=12, decimal_places=2)

    precio_compra = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    subtotal = models.DecimalField(max_digits=14, decimal_places=2)

    ganancia = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    # Tasa de IVA vigente para el producto al momento de la venta.
    tasa_iva = models.PositiveSmallIntegerField(default=10)


class ConfiguracionFacturacion(models.Model):
    """Datos fiscales del emisor y timbrado vigente (registro único)."""

    FORMATOS = (
        ("TICKET", "Ticket (impresora térmica 80 mm)"),
        ("A4", "Hoja A4"),
        ("DIGITAL", "A4 estilo factura electrónica"),
    )

    razon_social = models.CharField(max_length=200, blank=True, default="")
    nombre_fantasia = models.CharField(max_length=200, blank=True, default="Luna Minimarket")
    ruc = models.CharField(max_length=20, blank=True, default="")
    actividad_economica = models.CharField(max_length=200, blank=True, default="")
    direccion = models.CharField(max_length=250, blank=True, default="")
    ciudad = models.CharField(max_length=100, blank=True, default="")
    telefono = models.CharField(max_length=50, blank=True, default="")
    email = models.CharField(max_length=150, blank=True, default="")

    timbrado = models.CharField(max_length=8, blank=True, default="")
    timbrado_inicio = models.DateField(null=True, blank=True)
    timbrado_fin = models.DateField(null=True, blank=True)
    establecimiento = models.PositiveSmallIntegerField(default=1)
    punto_expedicion = models.PositiveSmallIntegerField(default=1)
    numero_siguiente = models.PositiveIntegerField(default=1)
    numero_final = models.PositiveIntegerField(null=True, blank=True)

    formato_factura = models.CharField(max_length=10, choices=FORMATOS, default="TICKET")
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuración de facturación"

    def __str__(self):
        return self.razon_social or "Configuración de facturación"

    @classmethod
    def obtener(cls, bloquear=False):
        consulta = cls.objects.select_for_update() if bloquear else cls.objects
        configuracion = consulta.order_by("id").first()
        if configuracion is None:
            configuracion = cls.objects.create()
        return configuracion


class Factura(models.Model):
    """Factura emitida para una venta, con los datos fiscales congelados."""

    TIPOS_DOCUMENTO = (
        ("RUC", "RUC"),
        ("CI", "Cédula de identidad"),
        ("SIN_NOMBRE", "Sin nombre (consumidor final)"),
    )
    CONDICIONES = (
        ("CONTADO", "Contado"),
        ("CREDITO", "Crédito"),
    )
    ESTADOS = (
        ("EMITIDA", "Emitida"),
        ("ANULADA", "Anulada"),
    )

    venta = models.OneToOneField(Venta, on_delete=models.PROTECT, related_name="factura")
    numero = models.CharField(max_length=15, unique=True)
    fecha_emision = models.DateTimeField(auto_now_add=True)
    usuario = models.ForeignKey(User, on_delete=models.PROTECT)
    estado = models.CharField(max_length=10, choices=ESTADOS, default="EMITIDA")
    condicion = models.CharField(max_length=10, choices=CONDICIONES, default="CONTADO")

    timbrado = models.CharField(max_length=8)
    timbrado_inicio = models.DateField()
    timbrado_fin = models.DateField()

    emisor_razon_social = models.CharField(max_length=200)
    emisor_nombre_fantasia = models.CharField(max_length=200, blank=True, default="")
    emisor_ruc = models.CharField(max_length=20)
    emisor_actividad = models.CharField(max_length=200, blank=True, default="")
    emisor_direccion = models.CharField(max_length=250, blank=True, default="")
    emisor_ciudad = models.CharField(max_length=100, blank=True, default="")
    emisor_telefono = models.CharField(max_length=50, blank=True, default="")
    emisor_email = models.CharField(max_length=150, blank=True, default="")

    cliente_tipo_documento = models.CharField(max_length=12, choices=TIPOS_DOCUMENTO)
    cliente_documento = models.CharField(max_length=20)
    cliente_razon_social = models.CharField(max_length=200)
    cliente_direccion = models.CharField(max_length=250, blank=True, default="")
    cliente_telefono = models.CharField(max_length=50, blank=True, default="")
    cliente_email = models.CharField(max_length=150, blank=True, default="")

    total_exenta = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_gravada_5 = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_gravada_10 = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    iva_5 = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    iva_10 = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        ordering = ["-id"]

    def __str__(self):
        return f"Factura {self.numero}"


class CuentaPorCobrar(models.Model):
    cliente_nombre = models.CharField(max_length=200)

    # Vacío cuando la cuenta se cargó a mano desde el libro (saldo anterior).
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, null=True, blank=True)

    total = models.DecimalField(max_digits=14, decimal_places=2)

    saldo = models.DecimalField(max_digits=14, decimal_places=2)

    pagado = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    fecha = models.DateTimeField(auto_now_add=True)

    cancelada = models.BooleanField(default=False)

    def __str__(self):
        return self.cliente_nombre


class MovimientoLibreta(models.Model):
    TIPOS = (
        ("COMPRA", "Compra"),
        ("PAGO", "Pago"),
        ("ANULACION", "Anulación"),
        ("SALDO_INICIAL", "Saldo anterior"),
    )

    cuenta =models.ForeignKey(CuentaPorCobrar, on_delete=models.CASCADE, related_name="movimientos")

    venta = models.ForeignKey(Venta, on_delete=models.SET_NULL, null=True, blank=True)

    tipo = models.CharField(max_length=20, choices=TIPOS)

    monto = models.DecimalField(max_digits=14, decimal_places=2)

    fecha = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.tipo} - {self.monto}"


class PagoCuentaPorCobrar(models.Model):
    cuenta = models.ForeignKey(CuentaPorCobrar, on_delete=models.CASCADE, related_name="pagos")

    monto = models.DecimalField(max_digits=14, decimal_places=2)

    fecha = models.DateTimeField(auto_now_add=True)

    observacion = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Pago {self.monto}"
