from django.urls import path

from . import views

urlpatterns = [
    path("buscar/", views.buscar_producto),
    path("productos/", views.crear_producto),
    path("productos/<int:id>/", views.producto_detalle),
    path("ajustar-stock/", views.ajustar_stock),
    path("alertas-vencimiento/", views.alertas_vencimiento),
]
