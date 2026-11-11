from django.urls import path

from .views import alertas_stock, estadisticas

urlpatterns = [
    path("", estadisticas),
    path("alertas-stock/", alertas_stock),
]
