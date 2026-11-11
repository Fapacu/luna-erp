from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from usuarios.models import UsuarioPerfil
from django.contrib.auth import authenticate

from rest_framework_simplejwt.tokens import RefreshToken

from auditoria.services import registrar_auditoria


class LoginThrottle(SimpleRateThrottle):
    """Limita los intentos de inicio de sesión por dirección IP."""
    scope = "login"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def login_personalizado(request):

    username = request.data.get(
        "username"
    )

    password = request.data.get(
        "password"
    )

    if not isinstance(username, str) or not isinstance(password, str) or not username.strip() or not password:
        return Response({"error": "Ingresa usuario y contraseña."}, status=400)

    user = authenticate(

        username=username,

        password=password

    )

    if not user:

        return Response({

            "error":
            "Credenciales inválidas"

        }, status=401)

    try:
        perfil = UsuarioPerfil.objects.select_related("role").get(user=user)
    except UsuarioPerfil.DoesNotExist:
        return Response({"error": "La cuenta no tiene un rol asignado. Contacta al administrador."}, status=403)

    registrar_auditoria(

        usuario=user,

        modulo="SEGURIDAD",

        accion="LOGIN",

        referencia=user.username,

        ip=request.META.get(
            'REMOTE_ADDR'
        )

    )

    refresh = RefreshToken.for_user(
        user
    )

    return Response({

        "refresh": str(refresh),

        "access": str(refresh.access_token),

        "usuario": {

            "id": user.id,

            "username": user.username,

            "email": user.email,

            "rol": perfil.role.nombre,

            "is_staff": user.is_staff

        }

    })
