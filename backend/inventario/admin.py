from django.contrib import admin

from .models import Producto


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ("id", "nombre", "precio_venta", "stock", "activo")
    search_fields = ("nombre", "codigo_barra")
    list_filter = ("activo",)
