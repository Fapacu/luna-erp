from django.urls import path

from .views import (
    actualizar_proveedor,
    crear_compra,
    eliminar_proveedor,
    listar_compras,
    listar_proveedores,
    obtener_proveedor,
)

urlpatterns = [
    path("", crear_compra),
    path("proveedores/", listar_proveedores),
    path("proveedores/<int:id>/", obtener_proveedor),
    path("proveedores/<int:id>/editar/", actualizar_proveedor),
    path("proveedores/<int:id>/eliminar/", eliminar_proveedor),
    path("historial/", listar_compras),
]
