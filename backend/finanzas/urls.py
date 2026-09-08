from django.urls import path

from .views import (
    registrar_gasto,
    listar_movimientos
)

urlpatterns = [

    path(
        'gastos/',
        registrar_gasto
    ),

    path(
        'movimientos/',
        listar_movimientos
    ),
    

]