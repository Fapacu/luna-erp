from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from auditoria.models import Auditoria
from compras.models import Compra, Proveedor
from finanzas.models import CuentaPorPagar, MovimientoFinanciero
from inventario.models import LoteProducto, MovimientoStock, Producto
from usuarios.models import Role, UsuarioPerfil
from ventas.models import (
    Caja,
    DetalleVenta,
    MovimientoCaja,
    Venta,
)


class ERPFlowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin_role = Role.objects.create(nombre="ADMIN")
        cls.cashier_role = Role.objects.create(nombre="CAJERO")
        cls.admin = User.objects.create_user("admin-test", password="testing-pass-123")
        cls.cashier = User.objects.create_user("cajero-test", password="testing-pass-123")
        UsuarioPerfil.objects.create(user=cls.admin, role=cls.admin_role)
        UsuarioPerfil.objects.create(user=cls.cashier, role=cls.cashier_role)
        cls.product = Producto.objects.create(
            codigo_barra="TEST-001",
            nombre="Producto de prueba",
            precio_compra=Decimal("5.00"),
            precio_venta=Decimal("10.00"),
            stock=Decimal("20.000"),
            stock_minimo=3,
            unidad="unidad",
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def abrir_caja(self, user=None, monto="100.00"):
        self.client.force_authenticate(user or self.admin)
        response = self.client.post(
            "/api/ventas/caja/abrir/", {"monto_inicial": monto}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        return Caja.objects.get(pk=response.data["caja_id"])

    def vender(self, caja, cantidad="1", metodo="EFECTIVO"):
        data = {
            "caja_id": caja.id,
            "metodo_pago": metodo,
            "productos": [{"id": self.product.id, "cantidad": cantidad}],
        }
        if metodo == "LIBRETA":
            data["cliente_nombre"] = "Cliente de prueba"
        return self.client.post("/api/ventas/", data, format="json")

    def test_login_emite_token_y_registra_auditoria(self):
        response = self.client.post(
            "/api/login/",
            {"username": "admin-test", "password": "testing-pass-123"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("access", response.data)
        self.assertEqual(response.data["usuario"]["rol"], "ADMIN")
        self.assertTrue(Auditoria.objects.filter(accion="LOGIN").exists())

    def test_permisos_restringen_administracion_al_cajero(self):
        self.client.force_authenticate(self.cashier)
        response = self.client.post(
            "/api/inventario/productos/",
            {
                "codigo_barra": "NO-PERMITIDO",
                "nombre": "No permitido",
                "precio_compra": "1",
                "precio_venta": "2",
                "stock": "1",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Producto.objects.filter(codigo_barra="NO-PERMITIDO").exists())

    def test_se_pueden_abrir_y_listar_dos_cajas(self):
        caja_1 = self.abrir_caja()
        caja_2 = self.abrir_caja(user=self.cashier, monto="50.00")
        response = self.client.get("/api/ventas/caja/estado/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual({c["id"] for c in response.data["cajas"]}, {caja_1.id, caja_2.id})

    def test_venta_descuenta_stock_una_vez_y_asigna_caja(self):
        caja_1 = self.abrir_caja()
        caja_2 = self.abrir_caja(user=self.cashier)
        response = self.vender(caja_2, cantidad="2")
        self.assertEqual(response.status_code, 200, response.data)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, Decimal("18.000"))
        venta = Venta.objects.get(pk=response.data["venta_id"])
        self.assertEqual(venta.caja_id, caja_2.id)
        self.assertEqual(venta.numero_ticket, response.data["ticket"])
        self.assertEqual(DetalleVenta.objects.filter(venta=venta).count(), 1)
        self.assertEqual(MovimientoStock.objects.filter(tipo="VENTA").count(), 1)
        self.assertEqual(MovimientoCaja.objects.filter(caja=caja_1).count(), 0)
        self.assertEqual(MovimientoCaja.objects.filter(caja=caja_2, tipo="INGRESO").count(), 1)

    def test_venta_sin_stock_no_deja_registros_parciales(self):
        caja = self.abrir_caja()
        response = self.vender(caja, cantidad="999")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Venta.objects.count(), 0)
        self.assertEqual(DetalleVenta.objects.count(), 0)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, Decimal("20.000"))

    def test_cierre_de_caja_concilia_efectivo_y_suma_ventas_completadas(self):
        caja = self.abrir_caja(monto="100.00")
        venta_response = self.vender(caja, cantidad="2")
        self.assertEqual(venta_response.status_code, 200, venta_response.data)
        response = self.client.post(
            "/api/ventas/caja/cerrar/",
            {"caja_id": caja.id, "monto_real": "120.00"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["monto_sistema"], 120.0)
        caja.refresh_from_db()
        self.assertFalse(caja.abierta)
        self.assertEqual(caja.total_vendido, Decimal("20.00"))

    def test_anulacion_restituye_stock_y_revierte_movimientos(self):
        caja = self.abrir_caja()
        response = self.vender(caja)
        venta_id = response.data["venta_id"]
        self.assertEqual(response.status_code, 200, response.data)
        response = self.client.post(
            f"/api/ventas/anular/{venta_id}/", {"caja_id": caja.id}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, Decimal("20.000"))
        self.assertEqual(Venta.objects.get(pk=venta_id).estado, "ANULADA")
        self.assertTrue(MovimientoFinanciero.objects.filter(tipo="EGRESO", referencia__startswith="TICKET-").exists())
        response = self.client.post(
            "/api/ventas/caja/cerrar/",
            {"caja_id": caja.id, "monto_real": "100.00"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        caja.refresh_from_db()
        self.assertEqual(caja.total_vendido, Decimal("0.00"))

    def test_ajuste_de_stock_fraccionario_y_rechazo_de_stock_negativo(self):
        response = self.client.post(
            "/api/inventario/ajustar-stock/",
            {"producto_id": self.product.id, "cantidad": "1.250", "motivo": "conteo"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, Decimal("21.250"))
        response = self.client.post(
            "/api/inventario/ajustar-stock/",
            {"producto_id": self.product.id, "cantidad": "-99", "motivo": "inválido"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, Decimal("21.250"))

    def test_busqueda_inventario_y_alertas_dashboard(self):
        response = self.client.get("/api/inventario/buscar/?q=TEST-001")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data[0]["id"], self.product.id)
        response = self.client.get("/api/dashboard/alertas-stock/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsInstance(response.data, list)

    def test_compra_contado_actualiza_stock_y_finanzas(self):
        proveedor = Proveedor.objects.create(nombre="Proveedor de prueba")
        proveedor.productos.add(self.product)
        response = self.client.post(
            "/api/compras/",
            {
                "proveedor": proveedor.id,
                "metodo_pago": "efectivo",
                "items": [{"producto": self.product.id, "cantidad": "2.5", "costo": "4.00"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, Decimal("22.500"))
        self.assertEqual(self.product.precio_compra, Decimal("4.00"))
        self.assertEqual(self.product.costo_promedio, Decimal("4.89"))
        self.assertEqual(Compra.objects.count(), 1)
        self.assertTrue(MovimientoFinanciero.objects.filter(tipo="EGRESO", categoria="COMPRA").exists())
        caja = self.abrir_caja()
        venta_response = self.vender(caja)
        self.assertEqual(venta_response.status_code, 200, venta_response.data)
        detalle = DetalleVenta.objects.get(venta_id=venta_response.data["venta_id"])
        self.assertEqual(detalle.precio_compra, Decimal("4.89"))
        self.assertEqual(detalle.ganancia, Decimal("5.11"))

    def test_compra_a_credito_crea_cuenta_sin_registrar_egreso_pagado(self):
        proveedor = Proveedor.objects.create(nombre="Proveedor crédito")
        proveedor.productos.add(self.product)
        response = self.client.post(
            "/api/compras/",
            {
                "proveedor": proveedor.id,
                "credito": True,
                "fecha_vencimiento": date.today().isoformat(),
                "metodo_pago": "credito",
                "items": [{"producto": self.product.id, "cantidad": "1", "costo": "4.00"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        compra = Compra.objects.get()
        self.assertEqual(compra.estado, "PENDIENTE")
        self.assertEqual(CuentaPorPagar.objects.get(compra=compra).saldo, compra.total)
        self.assertFalse(MovimientoFinanciero.objects.filter(referencia=compra.numero_factura).exists())
        response = self.client.delete(f"/api/compras/proveedores/{proveedor.id}/eliminar/")
        self.assertEqual(response.status_code, 409)
        self.assertTrue(Proveedor.objects.filter(pk=proveedor.id).exists())

    def test_pagos_libreta_se_asignan_a_la_caja_seleccionada(self):
        caja_1 = self.abrir_caja()
        caja_2 = self.abrir_caja(user=self.cashier)
        response = self.vender(caja_2, metodo="LIBRETA")
        self.assertEqual(response.status_code, 200, response.data)
        venta = Venta.objects.get(pk=response.data["venta_id"])
        cuenta = venta.cuentaporcobrar_set.get()
        response = self.client.post(
            f"/api/ventas/libreta/{cuenta.id}/cobrar/",
            {"monto": "5.00", "caja_id": caja_2.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(MovimientoCaja.objects.filter(caja=caja_1).count(), 0)
        self.assertEqual(MovimientoCaja.objects.filter(caja=caja_2, tipo="INGRESO").count(), 1)

    def test_gastos_y_reportes_requieren_rol_y_registran_auditoria(self):
        response = self.client.post(
            "/api/finanzas/gastos/",
            {"categoria": "SERVICIO", "descripcion": "Servicio de prueba", "monto": "12.50"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(MovimientoFinanciero.objects.filter(categoria="SERVICIO").exists())
        self.assertEqual(self.client.get("/api/reportes/dashboard-financiero/").status_code, 200)
        self.assertEqual(self.client.get("/api/auditoria/").status_code, 200)
        self.client.force_authenticate(self.cashier)
        self.assertEqual(self.client.get("/api/finanzas/movimientos/").status_code, 403)
        self.assertEqual(self.client.get("/api/usuarios/").status_code, 403)

    def test_dashboard_y_reportes_validan_periodo(self):
        response = self.client.get("/api/dashboard/")
        self.assertEqual(response.status_code, 200, response.data)
        hoy = date.today().isoformat()
        response = self.client.get(
            "/api/reportes/dashboard-reporte/", {"desde": hoy, "hasta": hoy}
        )
        self.assertEqual(response.status_code, 200, response.data)
        response = self.client.get(
            "/api/reportes/dashboard-reporte/", {"desde": hoy, "hasta": "2000-01-01"}
        )
        self.assertEqual(response.status_code, 400)

    def test_gestion_de_usuarios_roles_y_desactivacion(self):
        response = self.client.get("/api/usuarios/roles/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("ADMIN", {role["nombre"] for role in response.data})
        response = self.client.post(
            "/api/usuarios/crear/",
            {
                "username": "nuevo-cajero",
                "password": "clave-segura-123",
                "email": "cajero@example.test",
                "role_id": self.cashier_role.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        user = User.objects.get(username="nuevo-cajero")
        self.assertEqual(user.usuarioperfil.role, self.cashier_role)
        response = self.client.get("/api/usuarios/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("nuevo-cajero", {item["username"] for item in response.data})
        response = self.client.delete(f"/api/usuarios/eliminar/{user.id}/")
        self.assertEqual(response.status_code, 200, response.data)
        user.refresh_from_db()
        self.assertFalse(user.is_active)

    def test_inventario_producto_detalle_y_baja(self):
        response = self.client.post(
            "/api/inventario/productos/",
            {
                "codigo_barra": "TEST-CRUD-01",
                "nombre": "Producto CRUD",
                "precio_compra": "2.50",
                "precio_venta": "5.00",
                "stock": "4.000",
                "stock_minimo": "2",
                "unidad": "unidad",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        product_id = response.data["id"]
        response = self.client.get(f"/api/inventario/productos/{product_id}/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["nombre"], "Producto CRUD")
        response = self.client.put(
            f"/api/inventario/productos/{product_id}/",
            {"nombre": "Producto editado", "precio_venta": "6.00"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)

        caja = self.abrir_caja()
        venta_response = self.client.post(
            "/api/ventas/",
            {
                "caja_id": caja.id,
                "metodo_pago": "EFECTIVO",
                "productos": [{"id": product_id, "cantidad": "1"}],
            },
            format="json",
        )
        self.assertEqual(venta_response.status_code, 200, venta_response.data)
        venta_id = venta_response.data["venta_id"]

        response = self.client.delete(f"/api/inventario/productos/{product_id}/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(Producto.objects.get(pk=product_id).activo)
        self.assertTrue(DetalleVenta.objects.filter(venta_id=venta_id, producto_id=product_id).exists())

        response = self.client.get("/api/inventario/buscar/?q=TEST-CRUD-01")
        self.assertEqual(response.data, [])
        response = self.client.get("/api/inventario/buscar/?q=TEST-CRUD-01&incluir_inactivos=1")
        self.assertEqual(response.data[0]["activo"], False)
        response = self.client.post(
            "/api/ventas/",
            {
                "caja_id": caja.id,
                "metodo_pago": "EFECTIVO",
                "productos": [{"id": product_id, "cantidad": "1"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Venta.objects.count(), 1)

        response = self.client.put(
            f"/api/inventario/productos/{product_id}/",
            {"activo": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(Producto.objects.get(pk=product_id).activo)

    def test_proveedores_clientes_ticket_y_reportes_de_ventas(self):
        response = self.client.post(
            "/api/compras/proveedores/",
            {"nombre": "Proveedor API", "telefono": "0981000000", "productos": [self.product.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        provider_id = response.data["id"]
        self.assertEqual(self.client.get(f"/api/compras/proveedores/{provider_id}/").status_code, 200)
        response = self.client.put(
            f"/api/compras/proveedores/{provider_id}/editar/",
            {"nombre": "Proveedor API editado", "productos": [self.product.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.client.get("/api/compras/historial/").status_code, 200)

        response = self.client.post(
            "/api/ventas/clientes/",
            {"nombre": "Cliente API", "telefono": "0982000000"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        client_id = response.data["id"]
        self.assertEqual(self.client.get(f"/api/ventas/clientes/{client_id}/").status_code, 200)
        response = self.client.put(
            f"/api/ventas/clientes/{client_id}/",
            {"nombre": "Cliente API editado"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.client.get("/api/ventas/clientes/").status_code, 200)

        caja = self.abrir_caja()
        sale = self.vender(caja)
        self.assertEqual(sale.status_code, 200, sale.data)
        sale_id = sale.data["venta_id"]
        self.assertEqual(self.client.get("/api/ventas/historial/").status_code, 200)
        ticket = self.client.get(f"/api/ventas/ticket/{sale_id}/")
        self.assertEqual(ticket.status_code, 200)
        self.assertIn("text/html", ticket["Content-Type"])
        self.assertIn(b"Producto de prueba", ticket.content)
        self.assertEqual(self.client.get("/api/ventas/reportes/").status_code, 200)
        self.assertEqual(self.client.get("/api/ventas/caja/historial/").status_code, 200)

        response = self.client.delete(f"/api/compras/proveedores/{provider_id}/eliminar/")
        self.assertEqual(response.status_code, 200, response.data)

    def test_caja_registra_retiros_y_gastos_en_resumen_financiero(self):
        caja = self.abrir_caja(monto="100.00")
        response = self.client.post(
            "/api/ventas/retiro/",
            {"caja_id": caja.id, "descripcion": "Retiro de prueba", "monto": "10.00"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        response = self.client.post(
            "/api/ventas/gasto/",
            {"caja_id": caja.id, "descripcion": "Gasto de prueba", "monto": "5.00"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(MovimientoFinanciero.objects.filter(categoria="GASTO").count(), 1)
        response = self.client.get(f"/api/ventas/caja/actual/?caja_id={caja.id}")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["total"], 85.0)

    def test_lotes_alertas_y_exportacion_pdf(self):
        LoteProducto.objects.create(
            producto=self.product,
            lote="LOTE-TEST",
            fecha_vencimiento=date.today(),
            cantidad=Decimal("2.000"),
        )
        response = self.client.get("/api/inventario/alertas-vencimiento/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data), 1)
        hoy = date.today()
        response = self.client.get(
            "/api/reportes/productos-mas-vendidos/",
            {"mes": hoy.month, "anio": hoy.year},
        )
        self.assertEqual(response.status_code, 200, response.data)
        response = self.client.post(
            "/api/reportes/exportar-pdf/",
            {"productos": [{"nombre": self.product.nombre, "cantidad": 2}]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
