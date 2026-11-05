from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from usuarios.auth_views import (
    login_personalizado
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/usuarios/', include('usuarios.urls')),
    path('api/inventario/', include('inventario.urls')),
    path('api/ventas/', include('ventas.urls')),
    path('api/compras/', include('compras.urls')),
    path('api/login/',login_personalizado),
    path('api/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/reportes/', include('reportes.urls')),
    path('api/dashboard/', include('dashboard.urls')),
    path('api/finanzas/',include('finanzas.urls')),
    path('api/auditoria/',include('auditoria.urls')),
    
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
