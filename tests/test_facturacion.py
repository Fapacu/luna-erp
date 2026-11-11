"""Facturación paraguaya: RUC, IVA incluido, numeración por timbrado e impresión."""

from datetime import timedelta
from decimal import Decimal

from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from inventario.models import Producto
from ventas.facturacion import (
    FacturacionError,
    digito_verificador_ruc,
    liquidar_iva,
    normalizar_ruc,
    numero_a_letras,
)
from ventas.models import Cliente, ConfiguracionFacturacion, Factura, Venta

from tests import test_erp_flows as base


class UtilidadesFacturacionTests(SimpleTestCase):
    def test_digito_verificador_ruc(self):
        self.assertEqual(digito_verificador_ruc("44444401"), 7)
        self.assertEqual(digito_verificador_ruc("80012345"), 0)
        self.assertEqual(digito_verificador_ruc("1234567"), 9)
        self.assertEqual(normalizar_ruc("4.444.4401-7"), "44444401-7")
        self.assertEqual(normalizar_ruc("12345679"), "1234567-9")
        with self.assertRaises(FacturacionError):
            normalizar_ruc("44444401-3")
        with self.assertRaises(FacturacionError):
            normalizar_ruc("abc")

    def test_liquidacion_iva_incluido(self):
        totales = liquidar_iva([(Decimal("11000"), 10), (Decimal("21000"), 5), (Decimal("5000"), 0)])
        self.assertEqual(totales["iva_10"], Decimal("1000"))
        self.assertEqual(totales["iva_5"], Decimal("1000"))
        self.assertEqual(totales["total_exenta"], Decimal("5000"))
        self.assertEqual(totales["total"], Decimal("37000"))

    def test_numero_a_letras(self):
        casos = {
            0: "cero", 1: "uno", 16: "dieciséis", 21: "veintiuno", 100: "cien", 101: "ciento uno",
            1000: "mil", 21000: "veintiún mil", 31500: "treinta y un mil quinientos",
            150000: "ciento cincuenta mil", 1000000: "un millón", 2500000: "dos millones quinientos mil",
            21000000: "veintiún millones",
        }
        for numero, texto in casos.items():
            with self.subTest(numero=numero):
                self.assertEqual(numero_a_letras(numero), texto)


class FacturacionTests(TestCase):
    setUpTestData_base = base.ERPFlowTests.setUpTestData.__func__
    abrir_caja = base.ERPFlowTests.abrir_caja

    @classmethod
    def setUpTestData(cls):
        cls.setUpTestData_base(cls)
        cls.exento = Producto.objects.create(
            codigo_barra="EXENTO-1", nombre="Producto exento", precio_compra=Decimal("1000"),
            precio_venta=Decimal("5000"), stock=Decimal("10"), tasa_iva=0,
        )
        cls.iva5 = Producto.objects.create(
            codigo_barra="IVA5-1", nombre="Arroz", precio_compra=Decimal("1000"),
            precio_venta=Decimal("21000"), stock=Decimal("10"), tasa_iva=5,
        )
        cls.product.precio_venta = Decimal("11000")
        cls.product.save()

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        hoy = timezone.localdate()
        config = ConfiguracionFacturacion.obtener()
        config.razon_social = "LUNA MINIMARKET S.A."
        config.ruc = "80012345-0"
        config.direccion = "Avda. Principal 123"
        config.timbrado = "12345678"
        config.timbrado_inicio = hoy - timedelta(days=30)
        config.timbrado_fin = hoy + timedelta(days=300)
        config.numero_siguiente = 41
        config.save()

    def vender_con_factura(self, factura, metodo="EFECTIVO"):
        caja = self.abrir_caja()
        data = {
            "caja_id": caja.id, "metodo_pago": metodo, "comprobante": "FACTURA", "factura": factura,
            "productos": [
                {"id": self.product.id, "cantidad": 1},
                {"id": self.iva5.id, "cantidad": 1},
                {"id": self.exento.id, "cantidad": 1},
            ],
        }
        if metodo == "LIBRETA":
            data["cliente_nombre"] = "Cliente libreta"
        return self.client.post("/api/ventas/", data, format="json")

    def test_venta_con_factura_numera_liquida_iva_y_guarda_cliente(self):
        ruc = "1234567-9"
        response = self.vender_con_factura({"tipo_documento": "RUC", "documento": ruc.replace("-", ""),
                                            "razon_social": "Juan Pérez", "direccion": "Calle 1"})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["factura"], "001-001-0000041")
        factura = Factura.objects.get()
        self.assertEqual(factura.cliente_documento, ruc)
        self.assertEqual(factura.cliente_razon_social, "JUAN PÉREZ")
        self.assertEqual((factura.iva_10, factura.iva_5, factura.total_exenta), (Decimal("1000"), Decimal("1000"), Decimal("5000.00")))
        self.assertEqual(factura.total, Decimal("37000.00"))
        self.assertEqual(factura.condicion, "CONTADO")
        self.assertEqual(ConfiguracionFacturacion.obtener().numero_siguiente, 42)
        self.assertEqual(Venta.objects.get().cliente, Cliente.objects.get(ruc=ruc))

        html = self.client.get(f"/api/ventas/factura/{factura.venta_id}/?formato=A4").content.decode()
        for texto in ("TIMBRADO N.º 12345678", "001-001-0000041", "JUAN PÉREZ", "TREINTA Y SIETE MIL",
                      "ORIGINAL: CLIENTE", "DUPLICADO: ARCHIVO TRIBUTARIO", "LIQUIDACIÓN DEL IVA", "<svg"):
            self.assertIn(texto, html)
        sugerencias = self.client.get("/api/ventas/facturacion/clientes/?documento=1234").data
        self.assertEqual(sugerencias[0]["documento"], ruc)

    def test_libreta_genera_factura_a_credito_y_sin_nombre(self):
        response = self.vender_con_factura({"tipo_documento": "SIN_NOMBRE"}, metodo="LIBRETA")
        self.assertEqual(response.status_code, 200, response.data)
        factura = Factura.objects.get()
        self.assertEqual(factura.condicion, "CREDITO")
        self.assertEqual((factura.cliente_documento, factura.cliente_razon_social), ("44444401-7", "SIN NOMBRE"))

    def test_datos_invalidos_o_timbrado_vencido_no_registran_venta(self):
        response = self.vender_con_factura({"tipo_documento": "RUC", "documento": "1234567-0", "razon_social": "X"})
        self.assertEqual(response.status_code, 400, response.data)
        response = self.vender_con_factura({"tipo_documento": "CI", "documento": "123456", "razon_social": ""})
        self.assertEqual(response.status_code, 400, response.data)
        config = ConfiguracionFacturacion.obtener()
        config.timbrado_fin = timezone.localdate() - timedelta(days=1)
        config.save()
        response = self.vender_con_factura({"tipo_documento": "CI", "documento": "123456", "razon_social": "Ana"})
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("timbrado", response.data["error"])
        self.assertFalse(Venta.objects.exists())
        self.assertFalse(Factura.objects.exists())

    def test_facturar_despues_anular_y_permisos(self):
        caja = self.abrir_caja(user=self.cashier)
        venta = self.client.post("/api/ventas/", {
            "caja_id": caja.id, "metodo_pago": "EFECTIVO", "productos": [{"id": self.product.id, "cantidad": 1}],
        }, format="json").data["venta_id"]
        datos = {"tipo_documento": "CI", "documento": "4.567.890", "razon_social": "Ana Gómez"}
        response = self.client.post(f"/api/ventas/{venta}/facturar/", datos, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Factura.objects.get().cliente_documento, "4567890")
        self.assertEqual(self.client.post(f"/api/ventas/{venta}/facturar/", datos, format="json").status_code, 400)
        self.assertEqual(self.client.get("/api/ventas/historial/").data[0]["factura"], "001-001-0000041")
        # El cajero no configura la facturación.
        self.assertEqual(self.client.put("/api/ventas/facturacion/configuracion/", {"timbrado": "1"}, format="json").status_code, 403)
        self.client.force_authenticate(self.admin)
        self.client.post(f"/api/ventas/anular/{venta}/", {"caja_id": caja.id}, format="json")
        self.assertEqual(Factura.objects.get().estado, "ANULADA")
        self.assertIn("ANULADA", self.client.get(f"/api/ventas/factura/{venta}/").content.decode())

    def test_configuracion_valida_ruc_timbrado_y_numero_usado(self):
        url = "/api/ventas/facturacion/configuracion/"
        self.assertEqual(self.client.put(url, {"ruc": "80012345-9"}, format="json").status_code, 400)
        self.assertEqual(self.client.put(url, {"timbrado": "123"}, format="json").status_code, 400)
        self.assertEqual(self.client.put(url, {"timbrado_inicio": "2026-12-31", "timbrado_fin": "2026-01-01"}, format="json").status_code, 400)
        response = self.client.put(url, {"formato_factura": "A4", "numero_siguiente": 100}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["habilitada"])
        self.assertEqual(response.data["proximo_numero"], "001-001-0000100")
        self.vender_con_factura({"tipo_documento": "SIN_NOMBRE"})
        response = self.client.put(url, {"numero_siguiente": 100}, format="json")
        self.assertEqual(response.status_code, 400, response.data)

    def test_producto_valida_tasa_iva(self):
        response = self.client.post("/api/inventario/productos/", {
            "codigo_barra": "IVA-X", "nombre": "X", "precio_compra": "1", "precio_venta": "2", "tasa_iva": 7,
        }, format="json")
        self.assertEqual(response.status_code, 400, response.data)
        response = self.client.put(f"/api/inventario/productos/{self.product.id}/", {"tasa_iva": 5}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.product.refresh_from_db()
        self.assertEqual(self.product.tasa_iva, 5)
