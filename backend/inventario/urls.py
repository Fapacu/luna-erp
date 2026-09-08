from django.urls import path
from .views import *

urlpatterns = [

path('buscar/', buscar_producto),

path('productos/', crear_producto),

path('productos/<int:id>/', producto_detalle),

path('ajustar-stock/', ajustar_stock),

path(
    'alertas-vencimiento/',
    alertas_vencimiento
),
]