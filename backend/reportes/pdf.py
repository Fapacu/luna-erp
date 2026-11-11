# reportes/pdf.py
from django.http import HttpResponse
from reportlab.platypus import SimpleDocTemplate, Table


def generar_pdf(productos):
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = 'attachment; filename="reporte.pdf"'

    doc = SimpleDocTemplate(response)

    data = [["Producto", "Cantidad"]]

    for p in productos:
        data.append([p["nombre"], p["cantidad"]])

    table = Table(data)
    doc.build([table])

    return response
