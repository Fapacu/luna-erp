"""Utilidades de fechas independientes de las tablas de zona horaria de MySQL.

Con ``USE_TZ=True`` los lookups ``__date``, ``__month``, ``__year`` y
``TruncDate`` requieren que MySQL/MariaDB tenga cargadas las tablas de zonas
horarias (``CONVERT_TZ``). Si no están cargadas devuelven ``NULL`` y las
consultas quedan vacías sin error. Estas funciones filtran por rangos de
``datetime`` conscientes de zona horaria y agrupan por día en Python.
"""

from collections import OrderedDict
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.utils import timezone


def inicio_dia(dia):
    """Inicio (00:00 hora local) del día indicado como datetime consciente."""
    return timezone.make_aware(datetime.combine(dia, time.min))


def rango_dia(dia):
    """(inicio, fin_exclusivo) del día local indicado."""
    return inicio_dia(dia), inicio_dia(dia + timedelta(days=1))


def filtrar_rango(queryset, campo, desde=None, hasta=None):
    """Filtra ``campo`` entre ``desde`` y ``hasta`` (fechas locales, inclusivas)."""
    if desde:
        queryset = queryset.filter(**{f"{campo}__gte": inicio_dia(desde)})
    if hasta:
        queryset = queryset.filter(**{f"{campo}__lt": inicio_dia(hasta + timedelta(days=1))})
    return queryset


def rango_mes(anio, mes):
    """(inicio, fin_exclusivo) del mes local indicado."""
    inicio = date(anio, mes, 1)
    siguiente = date(anio + (mes == 12), mes % 12 + 1, 1)
    return inicio_dia(inicio), inicio_dia(siguiente)


def totales_por_dia(queryset, campo_fecha="fecha", campo_total="total"):
    """Suma ``campo_total`` por día local; devuelve [(date, Decimal)] ordenado."""
    acumulado = OrderedDict()
    for fecha, total in queryset.order_by(campo_fecha).values_list(campo_fecha, campo_total):
        dia = timezone.localtime(fecha).date()
        acumulado[dia] = acumulado.get(dia, Decimal("0")) + (total or Decimal("0"))
    return list(acumulado.items())
