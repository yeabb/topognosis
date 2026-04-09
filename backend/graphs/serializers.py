from rest_framework import serializers
from .models import Graph


class GraphSerializer(serializers.ModelSerializer):
    owner = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Graph
        fields = ('id', 'owner', 'name', 'description', 'visibility', 'slug', 'created_at', 'updated_at')
        read_only_fields = ('id', 'owner', 'slug', 'created_at', 'updated_at')
