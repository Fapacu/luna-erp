from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from ventas.models import Venta
from inventario.models import Producto

# Crear grupos
admin_group, created = Group.objects.get_or_create(name='ADMIN')
cajero_group, created = Group.objects.get_or_create(name='CAJERO')

# Permisos productos
producto_permissions = Permission.objects.filter(
    content_type=ContentType.objects.get_for_model(Producto)
)

# Permisos ventas
venta_permissions = Permission.objects.filter(
    content_type=ContentType.objects.get_for_model(Venta)
)

# ADMIN puede todo
admin_group.permissions.set(list(producto_permissions) + list(venta_permissions))

# CAJERO solo ver productos y crear ventas
for perm in producto_permissions:
    if perm.codename.startswith("view"):
        cajero_group.permissions.add(perm)

for perm in venta_permissions:
    if perm.codename.startswith("add"):
        cajero_group.permissions.add(perm)

print("Grupos y permisos creados correctamente")