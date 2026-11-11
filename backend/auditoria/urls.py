from django.urls import path

from .views import listar_auditoria

urlpatterns = [
    path("", listar_auditoria),
]
