from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes
from .models import MovimientoFinanciero
from .services import registrar_egreso
from usuarios.permissions import requiere_roles
from decimal import Decimal, InvalidOperation


@api_view(['POST'])
@permission_classes([IsAuthenticated])

def registrar_gasto(request):
    requiere_roles(request.user, "ADMIN", "GERENTE")

    try:

        data = request.data

        monto = Decimal(str(data.get("monto", "")))
        descripcion = data.get("descripcion", "")
        categoria = data.get("categoria", "")
        categorias_validas = {opcion[0] for opcion in MovimientoFinanciero.CATEGORIAS}
        if (not monto.is_finite() or monto <= 0 or not isinstance(descripcion, str)
                or not descripcion.strip() or categoria not in categorias_validas):
            return Response({"error": "Categoría, descripción y monto válido son obligatorios."}, status=400)
        movimiento = registrar_egreso(
            categoria=data["categoria"],
            descripcion=data["descripcion"],
            monto=monto,
            usuario=request.user,
            metodo_pago=data.get(
                "metodo_pago",
                "efectivo"
            )
        )

        return Response({
            "success": True,
            "id": movimiento.id
        })

    except (InvalidOperation, TypeError, ValueError):
        return Response({"error": "Monto inválido"}, status=400)
    except Exception:
        import logging
        logging.getLogger(__name__).exception("No se pudo registrar el gasto financiero")

        return Response({
            "error": "No se pudo registrar el gasto. Verifique los datos e intente nuevamente."
        }, status=500)
    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def listar_movimientos(request):
    requiere_roles(request.user, "ADMIN", "GERENTE")

    movimientos = MovimientoFinanciero.objects.all().order_by('-fecha')

    return Response([

        {
            "id": m.id,
            "tipo": m.tipo,
            "categoria": m.categoria,
            "descripcion": m.descripcion,
            "monto": float(m.monto),
            "fecha": m.fecha
        }

        for m in movimientos

    ])
