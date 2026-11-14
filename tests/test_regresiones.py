"""Regresiones de los defectos encontrados en la revisión integral del ERP."""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from compras.models import Compra, Proveedor
from finanzas.models import CuentaPorPagar, MovimientoFinanciero
from tests import test_erp_flows as base
from ventas.models import CuentaPorCobrar, MovimientoCaja, Venta


class ERPRegresionesTests(TestCase):
    # Reutiliza los datos y ayudantes de la suite principal sin heredar sus pruebas.
    setUpTestData = classmethod(base.ERPFlowTests.setUpTestData.__func__)
    abrir_caja = base.ERPFlowTests.abrir_caja
    vender = base.ERPFlowTests.vender

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_retiro_y_gasto_no_superan_efectivo_disponible(self):
        caja = self.abrir_caja(monto="100.00")
        response = self.client.post(
            "/api/ventas/retiro/",
            {"caja_id": caja.id, "monto": "150", "descripcion": "Excesivo"},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        response = self.client.post(
            "/api/ventas/gasto/",
            {"caja_id": caja.id, "monto": "100.01", "descripcion": "Excesivo"},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(MovimientoCaja.objects.filter(caja=caja).exists())
        response = self.client.post(
            "/api/ventas/retiro/", {"caja_id": caja.id, "monto": "100", "descripcion": "Todo"}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)

    def test_producto_por_unidad_rechaza_cantidad_fraccionaria(self):
        caja = self.abrir_caja()
        response = self.vender(caja, cantidad="1.5")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(Venta.objects.exists())
        self.product.unidad = "kg"
        self.product.save(update_fields=["unidad"])
        self.assertEqual(self.vender(caja, cantidad="0.333").status_code, 200)
        self.assertEqual(Venta.objects.get().total, Decimal("3.33"))

    def test_anular_venta_libreta_con_pagos_previos_si_hay_saldo(self):
        caja = self.abrir_caja()
        primera = self.vender(caja, cantidad="3", metodo="LIBRETA").data["venta_id"]
        segunda = self.vender(caja, cantidad="1", metodo="LIBRETA").data["venta_id"]
        cuenta = CuentaPorCobrar.objects.get()
        self.client.post(
            f"/api/ventas/libreta/{cuenta.id}/cobrar/", {"caja_id": caja.id, "monto": "5"}, format="json"
        )
        response = self.client.post(f"/api/ventas/anular/{segunda}/", {"caja_id": caja.id}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        cuenta.refresh_from_db()
        self.assertEqual(cuenta.saldo, Decimal("25.00"))
        self.assertEqual(cuenta.total, Decimal("30.00"))
        self.assertTrue(cuenta.movimientos.filter(tipo="ANULACION").exists())
        # Sin saldo suficiente no se anula: se devolvería dinero ya cobrado.
        self.client.post(
            f"/api/ventas/libreta/{cuenta.id}/cobrar/", {"caja_id": caja.id, "monto": "10"}, format="json"
        )
        response = self.client.post(f"/api/ventas/anular/{primera}/", {"caja_id": caja.id}, format="json")
        self.assertEqual(response.status_code, 400, response.data)

    def test_cajero_no_ve_auditoria_ni_reporte_de_ganancias(self):
        self.client.force_authenticate(self.cashier)
        self.assertEqual(self.client.get("/api/auditoria/").status_code, 403)
        self.assertEqual(self.client.get("/api/ventas/reportes/").status_code, 403)
        self.assertEqual(self.client.get("/api/compras/historial/").status_code, 403)

    def test_entradas_invalidas_devuelven_400_y_no_500(self):
        proveedor = Proveedor.objects.create(nombre="Prov")
        proveedor.productos.add(self.product)
        casos = [
            ("/api/compras/proveedores/", {"nombre": "X", "productos": "abc"}),
            ("/api/compras/", {"proveedor": proveedor.id, "items": "abc"}),
            (
                "/api/compras/",
                {"proveedor": proveedor.id, "items": [{"producto": "abc", "cantidad": 1, "costo": 1}]},
            ),
            (
                "/api/compras/",
                {
                    "proveedor": proveedor.id,
                    "credito": True,
                    "fecha_vencimiento": "mañana",
                    "items": [{"producto": self.product.id, "cantidad": 1, "costo": 1}],
                },
            ),
            ("/api/ventas/clientes/", {}),
            (
                "/api/usuarios/crear/",
                {"username": "nuevo", "password": "123", "role_id": self.cashier_role.id, "email": None},
            ),
        ]
        for url, data in casos:
            with self.subTest(url=url, data=data):
                self.assertEqual(self.client.post(url, data, format="json").status_code, 400)
        self.assertEqual(self.client.get("/api/ventas/reportes/?desde=basura").status_code, 400)

    def test_compra_contado_desde_la_ui_sin_iva_oculto(self):
        proveedor = Proveedor.objects.create(nombre="Prov UI")
        proveedor.productos.add(self.product)
        response = self.client.post(
            "/api/compras/",
            {
                "proveedor": proveedor.id,
                "metodo_pago": "EFECTIVO",
                "credito": False,
                "fecha_vencimiento": "",
                "observacion": "",
                "descuento": "1",
                "impuesto": "0",
                "items": [{"producto": self.product.id, "nombre": "x", "cantidad": 2, "costo": 4}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        compra = Compra.objects.get()
        self.assertEqual(
            (compra.subtotal, compra.impuesto, compra.total),
            (Decimal("8.00"), Decimal("0.00"), Decimal("7.00")),
        )
        self.assertEqual(MovimientoFinanciero.objects.get(categoria="COMPRA").monto, Decimal("7.00"))

    def test_pago_a_proveedor_salda_compra_a_credito(self):
        proveedor = Proveedor.objects.create(nombre="Prov crédito")
        proveedor.productos.add(self.product)
        self.client.post(
            "/api/compras/",
            {
                "proveedor": proveedor.id,
                "credito": True,
                "fecha_vencimiento": "2030-01-31",
                "items": [{"producto": self.product.id, "cantidad": 10, "costo": 4}],
            },
            format="json",
        )
        cuenta = CuentaPorPagar.objects.get()
        url = f"/api/finanzas/cuentas-por-pagar/{cuenta.id}/pagar/"
        self.assertEqual(self.client.post(url, {"monto": "41"}, format="json").status_code, 400)
        self.assertEqual(self.client.post(url, {"monto": "15"}, format="json").status_code, 200)
        self.assertEqual(Compra.objects.get().estado, "PARCIAL")
        self.assertEqual(self.client.post(url, {"monto": "25"}, format="json").status_code, 200)
        cuenta.refresh_from_db()
        self.assertTrue(cuenta.pagado)
        self.assertEqual(Compra.objects.get().estado, "PAGADA")
        self.assertEqual(MovimientoFinanciero.objects.filter(categoria="COMPRA").count(), 2)
        self.client.force_authenticate(self.cashier)
        self.assertEqual(self.client.get("/api/finanzas/cuentas-por-pagar/").status_code, 403)

    def test_dashboard_cuenta_ventas_del_dia_local(self):
        caja = self.abrir_caja()
        self.vender(caja, cantidad="2")
        response = self.client.get("/api/dashboard/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Decimal(str(response.data["total_hoy"])), Decimal("20.00"))

    def test_historial_y_ticket_de_ventas(self):
        caja = self.abrir_caja(user=self.cashier)
        venta = self.vender(caja).data["venta_id"]
        response = self.client.get("/api/ventas/historial/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["estado"], "COMPLETADA")
        ticket = self.client.get(f"/api/ventas/ticket/{venta}/")
        self.assertContains(ticket, "Gs. 10")
        self.client.force_authenticate(self.admin)
        self.assertEqual(len(self.client.get("/api/ventas/historial/").data), 1)

    def test_no_se_puede_desactivar_la_propia_cuenta(self):
        response = self.client.delete(f"/api/usuarios/eliminar/{self.admin.id}/")
        self.assertEqual(response.status_code, 400, response.data)

    def test_caja_sin_id_no_usa_la_caja_de_otro_usuario(self):
        self.abrir_caja(user=self.admin)
        self.client.force_authenticate(self.cashier)
        response = self.client.post(
            "/api/ventas/",
            {
                "metodo_pago": "EFECTIVO",
                "productos": [{"id": self.product.id, "cantidad": 1}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)

    def test_cargar_cuenta_del_libro_con_saldo_anterior(self):
        url = "/api/ventas/libreta/"
        for invalido in ({"saldo": "50000"}, {"cliente_nombre": "Ana"}, {"cliente_nombre": "Ana", "saldo": 0}):
            self.assertEqual(self.client.post(url, invalido, format="json").status_code, 400)
        self.client.force_authenticate(self.cashier)
        datos = {"cliente_nombre": " Ana Gómez ", "saldo": "50000"}
        self.assertEqual(self.client.post(url, datos, format="json").status_code, 403)
        self.client.force_authenticate(self.admin)
        response = self.client.post(url, datos, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        cuenta = CuentaPorCobrar.objects.get()
        self.assertEqual((cuenta.cliente_nombre, cuenta.saldo), ("Ana Gómez", Decimal("50000")))
        self.assertIsNone(cuenta.venta)
        self.assertEqual(cuenta.movimientos.get().tipo, "SALDO_INICIAL")
        # No es dinero recibido: no toca caja ni finanzas.
        self.assertFalse(MovimientoFinanciero.objects.exists())
        # Una sola cuenta activa por cliente.
        repetida = {"cliente_nombre": "ana gómez", "saldo": "10"}
        self.assertEqual(self.client.post(url, repetida, format="json").status_code, 400)
        # Se cobra igual que una libreta nacida de una venta.
        caja = self.abrir_caja()
        cobro = {"caja_id": caja.id, "monto": "20000"}
        response = self.client.post(f"{url}{cuenta.id}/cobrar/", cobro, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.client.get(f"{url}{cuenta.id}/").data["saldo"], 30000.0)

    def test_cobro_libreta_con_caja_observacion_y_comprobante(self):
        caja = self.abrir_caja()
        self.vender(caja, cantidad="3", metodo="LIBRETA")
        cuenta = CuentaPorCobrar.objects.get()
        url = f"/api/ventas/libreta/{cuenta.id}/cobrar/"
        self.assertEqual(
            self.client.post(
                url, {"caja_id": caja.id, "monto": "5", "observacion": "x" * 201}, format="json"
            ).status_code,
            400,
        )
        response = self.client.post(
            url, {"caja_id": caja.id, "monto": "30", "observacion": "Pago quincena"}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["pago"]["caja_id"], caja.id)
        self.assertEqual(response.data["pago"]["observacion"], "Pago quincena")
        self.assertTrue(response.data["cuenta"]["cancelada"])
        self.assertEqual(cuenta.pagos.get().observacion, "Pago quincena")
        self.assertTrue(
            MovimientoCaja.objects.filter(caja=caja, tipo="INGRESO", monto=Decimal("30")).exists()
        )

    def test_instalacion_nueva_tiene_roles_y_comando_crear_admin(self):
        from io import StringIO
        from unittest import mock

        from django.contrib.auth.models import User
        from django.core.management import call_command

        from usuarios.models import Role

        self.assertTrue(Role.objects.filter(nombre="GERENTE").exists())
        salida = StringIO()
        with mock.patch(
            "usuarios.management.commands.crear_admin.getpass",
            side_effect=["Clave-Segura-2026", "Clave-Segura-2026"],
        ):
            call_command("crear_admin", "--username", "dueño", stdout=salida)
        usuario = User.objects.get(username="dueño")
        self.assertEqual(usuario.usuarioperfil.role.nombre, "ADMIN")
        respuesta = APIClient().post(
            "/api/login/", {"username": "dueño", "password": "Clave-Segura-2026"}, format="json"
        )
        self.assertEqual(respuesta.status_code, 200, respuesta.data)

    def test_django_sirve_el_frontend_en_el_mismo_dominio(self):
        cliente = APIClient()
        for ruta, texto in (
            ("/", "Cargando sistema"),
            ("/login.html", "loginForm"),
            ("/ventas/facturas.html", "Facturas emitidas"),
        ):
            with self.subTest(ruta=ruta):
                respuesta = cliente.get(ruta)
                self.assertEqual(respuesta.status_code, 200)
                self.assertIn(texto, b"".join(respuesta.streaming_content).decode("utf-8"))
        self.assertEqual(cliente.get("/api/ventas/caja/estado/").status_code, 401)
