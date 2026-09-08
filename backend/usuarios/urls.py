from django.urls import path
from .views import *

urlpatterns = [
    path('', listar_usuarios),
    path('crear/', crear_usuario),
    path('editar/<int:user_id>/', editar_usuario),
    path('password/<int:user_id>/', cambiar_password),
    path('eliminar/<int:user_id>/', eliminar_usuario),
    path('me/', usuario_actual),
]