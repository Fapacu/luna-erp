from datetime import date

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from config.fechas import filtrar_rango
from usuarios.permissions import requiere_roles

from .models import Auditoria


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listar_auditoria(request):
    """Eventos de auditoría (solo ADMIN/GERENTE), con filtros opcionales."""
    requiere_roles(request.user, "ADMIN", "GERENTE")

    registros = Auditoria.objects.select_related("usuario").all()

    try:
        desde = request.query_params.get("desde")
        hasta = request.query_params.get("hasta")
        registros = filtrar_rango(
            registros,
            "fecha",
            date.fromisoformat(desde) if desde else None,
            date.fromisoformat(hasta) if hasta else None,
        )
    except ValueError:
        return Response({"error": "Fechas inválidas. Usa el formato AAAA-MM-DD."}, status=400)

    modulo = (request.query_params.get("modulo") or "").strip()
    if modulo:
        registros = registros.filter(modulo__iexact=modulo)

    try:
        limite = min(max(int(request.query_params.get("limite", 1000)), 1), 5000)
    except ValueError:
        limite = 1000

    data = []

    for r in registros[:limite]:
        data.append(
            {
                "id": r.id,
                "fecha": timezone.localtime(r.fecha).strftime("%d/%m/%Y %H:%M:%S"),
                "usuario": r.usuario.username if r.usuario else "Sistema",
                "modulo": r.modulo,
                "accion": r.accion,
                "referencia": r.referencia,
                "detalle": r.detalle,
                "ip": r.ip,
            }
        )

    return Response(data)
