from django.urls import path
from ventas import views

from .views import (
    crear_venta,
    abrir_caja,
    cerrar_caja,
    caja_actual,
    historial_ventas,
    historial_cajas,
    estado_caja,
    anular_venta,
    retiro_caja,
    gasto_caja,
    clientes,
    cliente_detalle,
    libreta,
    detalle_libreta,
    cobrar_libreta
)

urlpatterns = [

    path('', crear_venta),

    path('anular/<int:venta_id>/', anular_venta),

    path('caja/abrir/', abrir_caja),
    path('caja/cerrar/', cerrar_caja),
    path('caja/actual/', caja_actual),
    path('caja/historial/', historial_cajas),
    path('caja/estado/', estado_caja),

    path('retiro/', retiro_caja),
    path('gasto/', gasto_caja),
    path('clientes/', clientes),
    path('clientes/<int:id>/', cliente_detalle),
    path('libreta/',libreta),
    path('libreta/<int:id>/',detalle_libreta),
    path('libreta/<int:id>/cobrar/',cobrar_libreta),
    path('historial/', views.historial_ventas, name='historial_ventas'),
    path('ticket/<int:venta_id>/', views.imprimir_ticket),
    path('productos/buscar/',views.buscar_productos,name='buscar_productos'),
    path("libreta/buscar/",views.buscar_libreta),
    path('reportes/',views.reportes,name='reportes'),

]