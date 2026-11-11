"""Facturación para Paraguay: validación de RUC, IVA incluido y numeración por timbrado.

Los precios de venta incluyen IVA. Para cada tasa se liquida el impuesto
contenido en el total: IVA 10 % = total / 11 e IVA 5 % = total / 21.

La validez legal del comprobante depende de que el timbrado cargado esté
autorizado por la SET para la modalidad con la que se imprime (autoimpresor).
Este módulo no emite documentos electrónicos (SIFEN).
"""

import re
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from django.utils import timezone

from .models import Cliente, ConfiguracionFacturacion, Factura

RUC_SIN_NOMBRE = "44444401-7"
RAZON_SOCIAL_SIN_NOMBRE = "SIN NOMBRE"


class FacturacionError(ValueError):
    """Error de validación de datos fiscales con mensaje para el usuario."""


# ---------------------------------------------------------------- RUC / CI

def digito_verificador_ruc(numero):
    """Dígito verificador del RUC paraguayo (módulo 11, base máxima 11)."""
    total = 0
    k = 2
    for caracter in reversed(str(numero)):
        if k > 11:
            k = 2
        total += int(caracter) * k
        k += 1
    resto = total % 11
    return 11 - resto if resto > 1 else 0


def normalizar_ruc(valor):
    """Devuelve el RUC como 'NNNNNNN-D' o lanza FacturacionError."""
    texto = re.sub(r"[\s.]", "", str(valor or "")).upper()
    coincidencia = re.fullmatch(r"(\d{3,8})-?(\d)", texto)
    if not coincidencia:
        raise FacturacionError("El RUC debe tener el formato 1234567-8.")
    base, dv = coincidencia.groups()
    if digito_verificador_ruc(base) != int(dv):
        raise FacturacionError(f"El dígito verificador del RUC {base}-{dv} no es válido.")
    return f"{base}-{dv}"


def normalizar_ci(valor):
    texto = re.sub(r"[\s.]", "", str(valor or ""))
    if not re.fullmatch(r"\d{3,10}", texto):
        raise FacturacionError("La cédula debe contener solo números.")
    return texto


# ---------------------------------------------------------------- Montos

def redondear_gs(valor):
    return Decimal(valor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def liquidar_iva(detalles):
    """Totales por tasa e IVA contenido a partir de (subtotal, tasa) de cada línea."""
    totales = {0: Decimal("0"), 5: Decimal("0"), 10: Decimal("0")}
    for subtotal, tasa in detalles:
        tasa = int(tasa)
        if tasa not in totales:
            raise FacturacionError(f"Tasa de IVA no soportada: {tasa} %.")
        totales[tasa] += Decimal(subtotal)
    return {
        "total_exenta": totales[0],
        "total_gravada_5": totales[5],
        "total_gravada_10": totales[10],
        "iva_5": redondear_gs(totales[5] / 21),
        "iva_10": redondear_gs(totales[10] / 11),
        "total": totales[0] + totales[5] + totales[10],
    }


_UNIDADES = ("", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
             "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete",
             "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés",
             "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve")
_DECENAS = ("", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa")
_CENTENAS = ("", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
             "seiscientos", "setecientos", "ochocientos", "novecientos")


def _menor_mil(n):
    if n == 100:
        return "cien"
    centenas, resto = divmod(n, 100)
    partes = [_CENTENAS[centenas]] if centenas else []
    if resto < 30:
        partes.append(_UNIDADES[resto])
    else:
        decenas, unidades = divmod(resto, 10)
        partes.append(_DECENAS[decenas] + (f" y {_UNIDADES[unidades]}" if unidades else ""))
    return " ".join(p for p in partes if p)


def numero_a_letras(valor):
    """Convierte un entero no negativo a palabras en español (hasta billones)."""
    n = int(redondear_gs(valor))
    if n == 0:
        return "cero"
    grupos = [
        (10 ** 12, "billón", "billones"),
        (10 ** 6, "millón", "millones"),
        (1000, "mil", "mil"),
    ]
    partes = []
    for divisor, singular, plural in grupos:
        cantidad, n = divmod(n, divisor)
        if not cantidad:
            continue
        if divisor == 1000:
            partes.append("mil" if cantidad == 1 else f"{numero_a_letras(cantidad)} mil")
        else:
            partes.append(f"un {singular}" if cantidad == 1 else f"{numero_a_letras(cantidad)} {plural}")
    if n:
        partes.append(_menor_mil(n))
    texto = " ".join(partes)
    # "uno" delante de sustantivo se apocopa: "veintiún mil", "un millón".
    texto = re.sub(r"\buno (mil|millones|billones)\b", r"un \1", texto)
    return re.sub(r"\bveintiuno (mil|millones|billones)\b", r"veintiún \1", texto)


# ---------------------------------------------------------------- Configuración

def validar_configuracion(config, hoy=None):
    """Comprueba que el emisor y el timbrado permitan emitir hoy."""
    hoy = hoy or timezone.localdate()
    faltantes = [
        nombre for nombre, valor in (
            ("razón social", config.razon_social),
            ("RUC", config.ruc),
            ("dirección", config.direccion),
            ("timbrado", config.timbrado),
            ("inicio de vigencia del timbrado", config.timbrado_inicio),
            ("fin de vigencia del timbrado", config.timbrado_fin),
        ) if not valor
    ]
    if faltantes:
        raise FacturacionError(
            "Falta configurar la facturación (" + ", ".join(faltantes) + "). Un administrador debe completarla en Facturación."
        )
    if not (config.timbrado_inicio <= hoy <= config.timbrado_fin):
        raise FacturacionError("El timbrado no está vigente para la fecha de hoy.")
    if config.numero_final and config.numero_siguiente > config.numero_final:
        raise FacturacionError("Se agotó el rango de numeración autorizado para el timbrado.")


def numero_formateado(establecimiento, punto_expedicion, numero):
    return f"{int(establecimiento):03d}-{int(punto_expedicion):03d}-{int(numero):07d}"


# ---------------------------------------------------------------- Receptor

def _texto(datos, campo, limite):
    valor = datos.get(campo) or ""
    if not isinstance(valor, str):
        raise FacturacionError(f"El campo {campo} no es válido.")
    valor = valor.strip()
    if len(valor) > limite:
        raise FacturacionError(f"El campo {campo} supera {limite} caracteres.")
    return valor


def validar_datos_cliente(datos):
    """Normaliza los datos del comprador enviados por el POS."""
    if not isinstance(datos, dict):
        raise FacturacionError("Datos de facturación inválidos.")
    tipo = str(datos.get("tipo_documento") or "RUC").upper()
    if tipo not in dict(Factura.TIPOS_DOCUMENTO):
        raise FacturacionError("Tipo de documento inválido.")

    razon_social = _texto(datos, "razon_social", 200)
    direccion = _texto(datos, "direccion", 250)
    telefono = _texto(datos, "telefono", 50)
    email = _texto(datos, "email", 150)
    if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise FacturacionError("El correo electrónico no es válido.")

    if tipo == "SIN_NOMBRE":
        documento = RUC_SIN_NOMBRE
        razon_social = RAZON_SOCIAL_SIN_NOMBRE
    else:
        documento = normalizar_ruc(datos.get("documento")) if tipo == "RUC" else normalizar_ci(datos.get("documento"))
        if not razon_social:
            raise FacturacionError("Ingresa el nombre o la razón social del cliente.")

    return {
        "cliente_tipo_documento": tipo,
        "cliente_documento": documento,
        "cliente_razon_social": razon_social.upper(),
        "cliente_direccion": direccion,
        "cliente_telefono": telefono,
        "cliente_email": email,
    }


def _guardar_cliente(datos):
    """Crea o actualiza la ficha del cliente para autocompletar la próxima factura."""
    if datos["cliente_tipo_documento"] == "SIN_NOMBRE":
        return None
    cliente = Cliente.objects.filter(ruc=datos["cliente_documento"]).order_by("id").first()
    if cliente is None:
        cliente = Cliente(ruc=datos["cliente_documento"])
    cliente.nombre = datos["cliente_razon_social"]
    if datos["cliente_direccion"]:
        cliente.direccion = datos["cliente_direccion"]
    if datos["cliente_telefono"]:
        cliente.telefono = datos["cliente_telefono"]
    cliente.activo = True
    cliente.save()
    return cliente


# ---------------------------------------------------------------- Emisión

def emitir_factura(venta, datos_cliente, usuario):
    """Emite la factura de una venta. Debe llamarse dentro de transaction.atomic()."""
    if venta.estado != "COMPLETADA":
        raise FacturacionError("Solo se pueden facturar ventas completadas.")
    if Factura.objects.filter(venta=venta).exists():
        raise FacturacionError("Esta venta ya tiene factura.")

    config = ConfiguracionFacturacion.obtener(bloquear=True)
    validar_configuracion(config)

    detalles = list(venta.detalleventa_set.values_list("subtotal", "tasa_iva"))
    if not detalles:
        raise FacturacionError("La venta no tiene productos.")
    totales = liquidar_iva(detalles)

    numero = numero_formateado(config.establecimiento, config.punto_expedicion, config.numero_siguiente)
    if Factura.objects.filter(numero=numero).exists():
        raise FacturacionError(f"El número de factura {numero} ya fue utilizado. Revisa la numeración configurada.")

    factura = Factura.objects.create(
        venta=venta,
        numero=numero,
        usuario=usuario,
        condicion="CREDITO" if venta.metodo_pago == "LIBRETA" else "CONTADO",
        timbrado=config.timbrado,
        timbrado_inicio=config.timbrado_inicio,
        timbrado_fin=config.timbrado_fin,
        emisor_razon_social=config.razon_social,
        emisor_nombre_fantasia=config.nombre_fantasia,
        emisor_ruc=config.ruc,
        emisor_actividad=config.actividad_economica,
        emisor_direccion=config.direccion,
        emisor_ciudad=config.ciudad,
        emisor_telefono=config.telefono,
        emisor_email=config.email,
        **datos_cliente,
        **totales,
    )
    config.numero_siguiente += 1
    config.save(update_fields=["numero_siguiente", "actualizado"])

    cliente = _guardar_cliente(datos_cliente)
    if cliente and venta.cliente_id != cliente.id:
        venta.cliente = cliente
        venta.save(update_fields=["cliente"])
    return factura


def es_fecha(valor):
    try:
        return date.fromisoformat(str(valor))
    except (TypeError, ValueError):
        return None
