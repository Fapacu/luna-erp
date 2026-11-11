from django.urls import path

from .views import (
    cuentas_por_pagar,
    listar_movimientos,
    pagar_cuenta_por_pagar,
    registrar_gasto,
)

urlpatterns = [
    path("gastos/", registrar_gasto),
    path("movimientos/", listar_movimientos),
    path("cuentas-por-pagar/", cuentas_por_pagar),
    path("cuentas-por-pagar/<int:id>/pagar/", pagar_cuenta_por_pagar),
]
