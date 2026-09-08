from rest_framework import serializers
from .models import Compra, Proveedor, DetalleCompra


class ProveedorSerializer(serializers.ModelSerializer):

    class Meta:
        model = Proveedor
        fields = '__all__'


class CompraSerializer(serializers.ModelSerializer):

    class Meta:
        model = Compra
        fields = '__all__'

class DetalleCompraSerializer(serializers.ModelSerializer):

    class Meta:
        model = DetalleCompra
        fields = '__all__'