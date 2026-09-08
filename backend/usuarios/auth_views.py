from rest_framework.decorators import api_view
from rest_framework.response import Response
from usuarios.models import UsuarioPerfil
from django.contrib.auth import authenticate

from rest_framework_simplejwt.tokens import RefreshToken

from auditoria.services import registrar_auditoria


@api_view(['POST'])
def login_personalizado(request):

    username = request.data.get(
        "username"
    )

    password = request.data.get(
        "password"
    )

    user = authenticate(

        username=username,

        password=password

    )

    if not user:

        return Response({

            "error":
            "Credenciales inválidas"

        }, status=401)

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

    perfil = UsuarioPerfil.objects.get(user=user)

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