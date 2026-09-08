from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes
from .models import MovimientoFinanciero
from .services import registrar_egreso


@api_view(['POST'])
@permission_classes([IsAuthenticated])

def registrar_gasto(request):

    try:

        data = request.data

        movimiento = registrar_egreso(
            categoria=data["categoria"],
            descripcion=data["descripcion"],
            monto=data["monto"],
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

    except Exception as e:

        return Response({
            "error": str(e)
        }, status=500)
    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def listar_movimientos(request):

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