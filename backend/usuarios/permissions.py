from rest_framework.exceptions import PermissionDenied
from django.core.exceptions import ObjectDoesNotExist


def obtener_rol(user):
    if not getattr(user, "is_authenticated", False):
        return None
    try:
        perfil = user.usuarioperfil
    except (AttributeError, ObjectDoesNotExist):
        return None
    if not perfil.role_id:
        return None
    return perfil.role.nombre.upper()


def requiere_roles(user, *roles):

    rol = obtener_rol(user)

    if rol not in roles:
        raise PermissionDenied("No tienes permisos para realizar esta acción.")
