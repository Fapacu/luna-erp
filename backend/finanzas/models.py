from django.db import models
from django.contrib.auth.models import User


class MovimientoFinanciero(models.Model):

    TIPOS = (
        ('INGRESO', 'INGRESO'),
        ('EGRESO', 'EGRESO'),
    )

    CATEGORIAS = (
        ('VENTA', 'VENTA'),
        ('COMPRA', 'COMPRA'),
        ('GASTO', 'GASTO'),
        ('SERVICIO', 'SERVICIO'),
        ('SALARIO', 'SALARIO'),
        ('OTRO', 'OTRO'),
    )

    tipo = models.CharField(
        max_length=20,
        choices=TIPOS
    )

    categoria = models.CharField(
        max_length=50,
        choices=CATEGORIAS
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
        null=True,
        blank=True
    )

    metodo_pago = models.CharField(
        max_length=50,
        default='efectivo'
    )

    referencia = models.CharField(
        max_length=100,
        null=True,
        blank=True
    )

    class Meta:
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.tipo} - {self.categoria} - {self.monto}"


class CuentaPorPagar(models.Model):

    proveedor = models.ForeignKey(
        'compras.Proveedor',
        on_delete=models.CASCADE
    )

    compra = models.ForeignKey(
        'compras.Compra',
        on_delete=models.CASCADE
    )

    total = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    saldo = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    fecha_vencimiento = models.DateField()

    pagado = models.BooleanField(
        default=False
    )

    fecha_creacion = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ['pagado', 'fecha_vencimiento']

    def __str__(self):
        return f"{self.proveedor} - Saldo: {self.saldo}"


class PagoCuentaPagar(models.Model):

    cuenta = models.ForeignKey(
        CuentaPorPagar,
        on_delete=models.CASCADE,
        related_name='pagos'
    )

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
        null=True,
        blank=True
    )

    metodo_pago = models.CharField(
        max_length=50,
        default='efectivo'
    )

    referencia = models.CharField(
        max_length=100,
        null=True,
        blank=True
    )

    class Meta:
        ordering = ['-fecha']

    def __str__(self):
        return f"Pago {self.monto} - {self.cuenta.proveedor}"