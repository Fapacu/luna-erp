from rest_framework.decorators import (
    api_view,
    permission_classes
)

from rest_framework.permissions import (
    IsAuthenticated
)

from rest_framework.response import Response

from .models import Auditoria


@api_view(['GET'])
@permission_classes([IsAuthenticated])

def listar_auditoria(request):

    registros = Auditoria.objects.all()

    data = []

    for r in registros:

        data.append({

            "id": r.id,

            "fecha": r.fecha.strftime(
                "%d/%m/%Y %H:%M:%S"
            ),

            "usuario":

            r.usuario.username

            if r.usuario

            else "Sistema",

            "modulo": r.modulo,

            "accion": r.accion,

            "referencia": r.referencia,

            "detalle": r.detalle,

            "ip": r.ip

        })

    return Response(data)