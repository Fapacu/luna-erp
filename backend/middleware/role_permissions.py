from rest_framework.exceptions import PermissionDenied


def require_role(user, roles):

    perfil = user.usuarioperfil

    if perfil.role.nombre not in roles:
        raise PermissionDenied("No tienes permisos para esta acción")