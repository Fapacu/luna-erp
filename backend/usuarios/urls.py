from django.urls import path

from . import views

urlpatterns = [
    path("", views.listar_usuarios),
    path("roles/", views.listar_roles),
    path("crear/", views.crear_usuario),
    path("editar/<int:user_id>/", views.editar_usuario),
    path("password/<int:user_id>/", views.cambiar_password),
    path("eliminar/<int:user_id>/", views.eliminar_usuario),
    path("me/", views.usuario_actual),
]
