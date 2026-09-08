from django.urls import path
from .views import estadisticas, alertas_stock

urlpatterns = [
    path('', estadisticas),
    path('alertas-stock/', alertas_stock),
]