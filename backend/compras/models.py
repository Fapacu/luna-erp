from django.contrib.auth.models import User
from django.db import models

from inventario.models import Producto


class Proveedor(models.Model):
    nombre = models.CharField(max_length=100)
    telefono = models.CharField(max_length=20, blank=True, null=True)

    productos = models.ManyToManyField(Producto, related_name="proveedores")

    def __str__(self):
        return self.nombre


class Compra(models.Model):
    proveedor = models.ForeignKey(Proveedor, on_delete=models.CASCADE)
    fecha = models.DateTimeField(auto_now_add=True)

    # Totales de la compra
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    ESTADOS = (
        ("PENDIENTE", "PENDIENTE"),
        ("PAGADA", "PAGADA"),
        ("PARCIAL", "PARCIAL"),
        ("ANULADA", "ANULADA"),
    )
    estado = models.CharField(max_length=20, choices=ESTADOS, default="PAGADA")

    numero_factura = models.CharField(max_length=100, unique=True, null=True, blank=True)

    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    impuesto = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    descuento = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    metodo_pago = models.CharField(max_length=50, default="efectivo")

    credito = models.BooleanField(default=False)

    fecha_vencimiento = models.DateField(null=True, blank=True)

    observacion = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"Compra {self.id} - {self.proveedor.nombre}"


class DetalleCompra(models.Model):
    compra = models.ForeignKey(Compra, on_delete=models.CASCADE)
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    cantidad = models.DecimalField(max_digits=12, decimal_places=3)
    precio_compra = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.producto.nombre} x {self.cantidad}"
