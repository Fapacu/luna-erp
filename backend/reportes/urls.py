from django.urls import path

from . import views

urlpatterns = [
    path("dashboard/", views.dashboard_data),
    path("productos-mas-vendidos/", views.productos_mas_vendidos),
    path("exportar-pdf/", views.exportar_pdf),
    path("dashboard-reporte/", views.dashboard_reporte),
    path("dashboard-financiero/", views.dashboard_financiero),
]
