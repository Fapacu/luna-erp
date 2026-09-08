from django.urls import path
from .views import *

urlpatterns = [
    path('dashboard/', dashboard_data),
    path('productos-mas-vendidos/', productos_mas_vendidos),
    path('alertas-stock/', alertas_stock),
    path('exportar-pdf/', exportar_pdf),

    # 🔥 endpoint principal
    path('dashboard-reporte/', dashboard_reporte),
    path('dashboard-financiero/', dashboard_financiero),
]