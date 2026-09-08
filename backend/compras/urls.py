from django.urls import path

from .views import (

    crear_compra,

    listar_proveedores,

    listar_compras,

    obtener_proveedor,

    actualizar_proveedor,

    eliminar_proveedor

)

urlpatterns = [

    path(
        '',
        crear_compra
    ),

    path(
        'proveedores/',
        listar_proveedores
    ),

    path(
        'proveedores/<int:id>/',
        obtener_proveedor
    ),

    path(
        'proveedores/<int:id>/editar/',
        actualizar_proveedor
    ),

    path(
        'proveedores/<int:id>/eliminar/',
        eliminar_proveedor
    ),

    path(
        'historial/',
        listar_compras
    ),

]