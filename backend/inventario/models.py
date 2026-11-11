from django.contrib.auth.models import User
from django.db import models


class Categoria(models.Model):
    nombre = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.nombre


class Marca(models.Model):
    nombre = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.nombre


class Producto(models.Model):
    codigo_barra = models.CharField(max_length=50, unique=True)
    nombre = models.CharField(max_length=150)
    descripcion = models.TextField(blank=True, null=True)
    precio_compra = models.DecimalField(max_digits=12, decimal_places=2)
    precio_venta = models.DecimalField(max_digits=12, decimal_places=2)
    stock = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    costo_promedio = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    stock_minimo = models.IntegerField(default=5)
    activo = models.BooleanField(default=True)
    imagen = models.ImageField(upload_to="productos/", null=True, blank=True)
    unidad = models.CharField(max_length=10, default="unidad")
    categoria = models.ForeignKey(Categoria, on_delete=models.SET_NULL, null=True, blank=True)

    marca = models.ForeignKey(Marca, on_delete=models.SET_NULL, null=True, blank=True)

    sku = models.CharField(max_length=50, unique=True, null=True, blank=True)

    # Tasa de IVA incluida en el precio de venta (Paraguay: 10 %, 5 % o exenta).
    TASAS_IVA = (
        (10, "IVA 10 %"),
        (5, "IVA 5 %"),
        (0, "Exenta"),
    )
    tasa_iva = models.PositiveSmallIntegerField(choices=TASAS_IVA, default=10)

    def __str__(self):
        return self.nombre


class LoteProducto(models.Model):
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE)

    lote = models.CharField(max_length=100)

    fecha_vencimiento = models.DateField(null=True, blank=True)

    cantidad = models.DecimalField(max_digits=12, decimal_places=3, default=0)

    fecha_ingreso = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.producto.nombre} - {self.lote}"


class MovimientoStock(models.Model):
    TIPO_CHOICES = (
        ("COMPRA", "Compra"),
        ("VENTA", "Venta"),
        ("AJUSTE", "Ajuste"),
    )

    producto = models.ForeignKey(Producto, on_delete=models.CASCADE)
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    cantidad = models.DecimalField(max_digits=12, decimal_places=3)
    fecha = models.DateTimeField(auto_now_add=True)
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    motivo = models.CharField(max_length=255, blank=True, null=True)

    stock_anterior = models.DecimalField(max_digits=12, decimal_places=3, default=0)

    stock_nuevo = models.DecimalField(max_digits=12, decimal_places=3, default=0)

    def __str__(self):
        return f"{self.producto.nombre} - {self.tipo} ({self.cantidad})"
