from django.contrib import admin
from .models import Compra, Proveedor, DetalleCompra


class DetalleCompraInline(admin.TabularInline):
    model = DetalleCompra
    extra = 0


@admin.register(Proveedor)
class ProveedorAdmin(admin.ModelAdmin):

    list_display = ('id', 'nombre', 'telefono')

    search_fields = ('nombre', 'producto')


@admin.register(Compra)
class CompraAdmin(admin.ModelAdmin):

    list_display = ('id', 'proveedor', 'fecha')

    list_filter = ('fecha',)

    search_fields = ('proveedor__nombre',)

    inlines = [DetalleCompraInline]