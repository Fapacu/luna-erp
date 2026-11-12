from django.urls import path

from . import views

urlpatterns = [
    # Ventas
    path("", views.crear_venta),
    path("historial/", views.historial_ventas, name="historial_ventas"),
    path("anular/<int:venta_id>/", views.anular_venta),
    path("ticket/<int:venta_id>/", views.imprimir_ticket),
    path("reportes/", views.reportes, name="reportes"),
    # Cajas
    path("caja/abrir/", views.abrir_caja),
    path("caja/cerrar/", views.cerrar_caja),
    path("caja/actual/", views.caja_actual),
    path("caja/historial/", views.historial_cajas),
    path("caja/estado/", views.estado_caja),
    path("retiro/", views.retiro_caja),
    path("gasto/", views.gasto_caja),
    # Clientes y libreta (cuentas por cobrar)
    path("clientes/", views.clientes),
    path("clientes/<int:id>/", views.cliente_detalle),
    path("libreta/", views.libreta),
    path("libreta/buscar/", views.buscar_libreta),
    path("libreta/<int:id>/", views.detalle_libreta),
    path("libreta/<int:id>/cobrar/", views.cobrar_libreta),
    # Facturación
    path("facturacion/configuracion/", views.configuracion_facturacion),
    path("facturacion/clientes/", views.buscar_cliente_documento),
    path("facturas/", views.listar_facturas),
    path("factura/<int:venta_id>/", views.imprimir_factura),
    path("<int:venta_id>/facturar/", views.facturar_venta),
]
