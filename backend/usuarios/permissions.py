from rest_framework.exceptions import PermissionDenied


def obtener_rol(user):

    try:
        return user.usuarioperfil.role.nombre.upper()
    except:
        return None


def requiere_roles(user, *roles):

    rol = obtener_rol(user)

    if rol not in roles:
        raise PermissionDenied("No tienes permisos para realizar esta acción.")