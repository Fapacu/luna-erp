from django.contrib.auth.models import User
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from auditoria.services import registrar_auditoria
from .models import Role, UsuarioPerfil
from .permissions import requiere_roles

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def usuario_actual(request):

    user = request.user

    try:
        rol = user.usuarioperfil.role.nombre
    except:
        rol = ""

    return Response({
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "rol": rol
    })


def es_admin(user):
    try:
        return user.is_staff or user.usuarioperfil.role.nombre == "ADMIN"
    except:
        return False

def cantidad_administradores():

    return UsuarioPerfil.objects.filter(
        role__nombre="ADMIN",
        user__is_active=True
    ).count()

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def listar_usuarios(request):

    usuarios = []

    perfiles = UsuarioPerfil.objects.select_related(
        "user",
        "role"
    ).filter(
        role__nombre__in=["ADMIN", "CAJERO"]
    )

    for perfil in perfiles:

        user = perfil.user

        usuarios.append({

            "id": user.id,

            "username": user.username,

            "email": user.email,

            "is_active": user.is_active,

            "rol": perfil.role.nombre

        })

    return Response(usuarios)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crear_usuario(request):

    requiere_roles(request.user, "ADMIN")

    username = request.data.get("username", "").strip()
    password = request.data.get("password", "")
    email = request.data.get("email", "").strip()
    role_id = request.data.get("role_id")

    # Validaciones
    if not username or not password:
        return Response(
            {"error": "Usuario y contraseña son obligatorios"},
            status=400
        )

    # Verificar usuario duplicado
    if User.objects.filter(username=username).exists():
        return Response(
            {"error": "El nombre de usuario ya existe"},
            status=400
        )

    # Validar rol
    try:
        role = Role.objects.get(id=role_id)
        
    except Role.DoesNotExist:
        return Response(
            {"error": "Rol inválido"},
            status=400
        )
    if role.nombre not in ["ADMIN", "CAJERO"]:

        return Response(
            {
                "error": "Solo se permiten los roles ADMIN y CAJERO"
            },
            status=400
        )

    # Crear usuario
    user = User.objects.create_user(
        username=username,
        password=password,
        email=email
    )

    # Crear perfil
    UsuarioPerfil.objects.create(
        user=user,
        role=role
    )

    # Auditoría
    registrar_auditoria(
        usuario=request.user,
        modulo="USUARIOS",
        accion="CREAR_USUARIO",
        referencia=username,
        detalle=f"Rol asignado: {role.nombre}"
    )

    return Response({
        "msg": "Usuario creado correctamente"
    }, status=201)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def editar_usuario(request, user_id):

    requiere_roles(request.user, "ADMIN")

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {"error": "Usuario no encontrado"},
            status=404
        )

    username = request.data.get("username", "").strip()
    email = request.data.get("email", "").strip()
    role_id = request.data.get("role_id")
    is_active = request.data.get("is_active", True)

    # Validar campos obligatorios
    if not username:
        return Response(
            {"error": "El nombre de usuario es obligatorio"},
            status=400
        )

    # Validar que el username no esté repetido
    if User.objects.filter(username=username).exclude(id=user.id).exists():
        return Response(
            {"error": "Ese nombre de usuario ya existe"},
            status=400
        )

    # Validar rol
    try:
        role = Role.objects.get(id=role_id)
    except Role.DoesNotExist:
        return Response({"error": "Rol inválido"}, status=400)

    if role.nombre not in ["ADMIN", "CAJERO"]:
        return Response(
            {"error": "Solo se permiten los roles ADMIN y CAJERO"},
            status=400
        )

    # Actualizar usuario
    user.username = username
    user.email = email
    user.is_active = is_active
    user.save()

    # Actualizar perfil
    perfil, _ = UsuarioPerfil.objects.get_or_create(user=user)
    perfil.role = role
    perfil.save()

    perfil_actual = UsuarioPerfil.objects.get(user=user)

    if perfil_actual.role.nombre == "ADMIN":

        ultimo_admin = cantidad_administradores() == 1

        if ultimo_admin:

            if role.nombre != "ADMIN":

                return Response(
                    {
                        "error": "No puedes cambiar el rol del último administrador."
                    },
                    status=400
                )

            if not is_active:

                return Response(
                    {
                        "error": "No puedes desactivar al último administrador."
                    },
                    status=400
                )



    registrar_auditoria(
        usuario=request.user,
        modulo="USUARIOS",
        accion="EDITAR_USUARIO",
        referencia=user.username,
        detalle=f"Rol: {role.nombre} | Activo: {is_active}"
    )

    return Response({
        "msg": "Usuario actualizado correctamente"
    })

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def cambiar_password(request, user_id):

    requiere_roles(request.user, "ADMIN")

    try:
        user = User.objects.get(id=user_id)
    except:
        return Response({"error": "Usuario no encontrado"}, status=404)

    nueva = request.data.get("password")

    if not nueva:
        return Response({"error": "Password requerido"}, status=400)

    user.set_password(nueva)
    user.save()

    registrar_auditoria(
        usuario=request.user,
        modulo="USUARIOS",
        accion="CAMBIAR_PASSWORD",
        referencia=user.username
    )

    return Response({"msg": "Password actualizado"})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def eliminar_usuario(request, user_id):

    requiere_roles(request.user, "ADMIN")

    try:
        user = User.objects.get(id=user_id)

    except User.DoesNotExist:

        return Response({
            "error": "Usuario no encontrado"
        }, status=404)

    from auditoria.services import registrar_auditoria

    registrar_auditoria(

        usuario=request.user,

        modulo="USUARIOS",

        accion="ELIMINAR_USUARIO",

        referencia=user.username

    )


    try:

        perfil = UsuarioPerfil.objects.get(user=user)

        if perfil.role.nombre == "ADMIN" and cantidad_administradores() == 1:

            return Response(
                {
                    "error": "No puedes eliminar al último administrador."
                },
                status=400
            )

    except UsuarioPerfil.DoesNotExist:
        pass

    user.delete()

    return Response({
        "msg": "Usuario eliminado"
    })