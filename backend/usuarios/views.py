from django.contrib.auth.models import User
from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from auditoria.services import registrar_auditoria

from .models import Role, UsuarioPerfil
from .permissions import obtener_rol, requiere_roles


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def usuario_actual(request):
    user = request.user

    rol = obtener_rol(user) or ""

    return Response({"id": user.id, "username": user.username, "email": user.email, "rol": rol})


def cantidad_administradores():
    return UsuarioPerfil.objects.filter(role__nombre="ADMIN", user__is_active=True).count()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listar_roles(request):
    requiere_roles(request.user, "ADMIN")
    roles = Role.objects.filter(nombre__in=["ADMIN", "GERENTE", "CAJERO"]).order_by("id")
    return Response([{"id": role.id, "nombre": role.nombre} for role in roles])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listar_usuarios(request):
    requiere_roles(request.user, "ADMIN")

    usuarios = []

    perfiles = UsuarioPerfil.objects.select_related("user", "role").filter(
        role__nombre__in=["ADMIN", "GERENTE", "CAJERO"]
    )

    for perfil in perfiles:
        user = perfil.user

        usuarios.append(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "is_active": user.is_active,
                "rol": perfil.role.nombre,
                "role_id": perfil.role_id,
            }
        )

    return Response(usuarios)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def crear_usuario(request):
    requiere_roles(request.user, "ADMIN")

    username = request.data.get("username", "")
    username = username.strip() if isinstance(username, str) else ""
    password = request.data.get("password", "")
    email = request.data.get("email") or ""
    email = email.strip() if isinstance(email, str) else ""
    role_id = request.data.get("role_id")

    # Validaciones
    if not username or not isinstance(password, str) or not password:
        return Response({"error": "Usuario y contraseña son obligatorios"}, status=400)

    if len(username) > 150:
        return Response({"error": "El nombre de usuario es demasiado largo."}, status=400)

    if len(password) < 8:
        return Response({"error": "La contraseña debe tener al menos 8 caracteres."}, status=400)

    # Verificar usuario duplicado
    if User.objects.filter(username=username).exists():
        return Response({"error": "El nombre de usuario ya existe"}, status=400)

    # Validar rol
    try:
        role = Role.objects.get(id=role_id)

    except (Role.DoesNotExist, ValueError, TypeError):
        return Response({"error": "Rol inválido"}, status=400)
    if role.nombre not in ["ADMIN", "GERENTE", "CAJERO"]:
        return Response({"error": "Rol no permitido"}, status=400)

    with transaction.atomic():
        user = User.objects.create_user(username=username, password=password, email=email)
        UsuarioPerfil.objects.create(user=user, role=role)

    # Auditoría
    registrar_auditoria(
        usuario=request.user,
        modulo="USUARIOS",
        accion="CREAR_USUARIO",
        referencia=username,
        detalle=f"Rol asignado: {role.nombre}",
    )

    return Response({"msg": "Usuario creado correctamente"}, status=201)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def editar_usuario(request, user_id):
    requiere_roles(request.user, "ADMIN")

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "Usuario no encontrado"}, status=404)

    username = request.data.get("username", "")
    email = request.data.get("email", "")
    username = username.strip() if isinstance(username, str) else ""
    email = email.strip() if isinstance(email, str) else ""
    role_id = request.data.get("role_id")
    is_active = request.data.get("is_active", True)
    if not isinstance(is_active, bool):
        return Response({"error": "El estado activo debe ser verdadero o falso."}, status=400)

    # Validar campos obligatorios
    if not username:
        return Response({"error": "El nombre de usuario es obligatorio"}, status=400)

    # Validar que el username no esté repetido
    if User.objects.filter(username=username).exclude(id=user.id).exists():
        return Response({"error": "Ese nombre de usuario ya existe"}, status=400)

    # Validar rol
    try:
        role = Role.objects.get(id=role_id)
    except (Role.DoesNotExist, ValueError, TypeError):
        return Response({"error": "Rol inválido"}, status=400)

    if role.nombre not in ["ADMIN", "GERENTE", "CAJERO"]:
        return Response({"error": "Rol no permitido"}, status=400)

    perfil, _ = UsuarioPerfil.objects.select_for_update().get_or_create(user=user, defaults={"role": role})
    era_admin_activo = perfil.role.nombre == "ADMIN" and user.is_active
    if user.id == request.user.id and not is_active:
        return Response({"error": "No puedes desactivar tu propia cuenta."}, status=400)
    if era_admin_activo and (role.nombre != "ADMIN" or not is_active) and cantidad_administradores() <= 1:
        return Response(
            {"error": "No puedes cambiar el rol ni desactivar al último administrador activo."}, status=400
        )

    # Actualizar usuario
    user.username = username
    user.email = email
    user.is_active = is_active
    user.save()

    # Actualizar perfil
    perfil.role = role
    perfil.save()

    registrar_auditoria(
        usuario=request.user,
        modulo="USUARIOS",
        accion="EDITAR_USUARIO",
        referencia=user.username,
        detalle=f"Rol: {role.nombre} | Activo: {is_active}",
    )

    return Response({"msg": "Usuario actualizado correctamente"})


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def cambiar_password(request, user_id):
    requiere_roles(request.user, "ADMIN")

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "Usuario no encontrado"}, status=404)

    nueva = request.data.get("password")

    if not isinstance(nueva, str) or len(nueva) < 8:
        return Response({"error": "La contraseña debe tener al menos 8 caracteres."}, status=400)

    user.set_password(nueva)
    user.save()

    registrar_auditoria(
        usuario=request.user, modulo="USUARIOS", accion="CAMBIAR_PASSWORD", referencia=user.username
    )

    return Response({"msg": "Password actualizado"})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def eliminar_usuario(request, user_id):
    requiere_roles(request.user, "ADMIN")

    try:
        user = User.objects.get(id=user_id)

    except User.DoesNotExist:
        return Response({"error": "Usuario no encontrado"}, status=404)

    if user.id == request.user.id:
        return Response({"error": "No puedes desactivar tu propia cuenta."}, status=400)

    try:
        perfil = UsuarioPerfil.objects.select_related("role").get(user=user)
    except UsuarioPerfil.DoesNotExist:
        perfil = None
    if user.is_active and perfil and perfil.role.nombre == "ADMIN" and cantidad_administradores() <= 1:
        return Response({"error": "No puedes desactivar al último administrador activo."}, status=400)

    user.is_active = False
    user.save(update_fields=["is_active"])
    registrar_auditoria(
        usuario=request.user,
        modulo="USUARIOS",
        accion="DESACTIVAR_USUARIO",
        referencia=user.username,
    )
    return Response({"msg": "Usuario desactivado. Su historial se conserva."})
