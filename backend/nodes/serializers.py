from rest_framework import serializers
from .models import Node, Event


class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = (
            'id', 'node', 'event_type',
            'parent_event_id', 'branched_from_event_id', 'snapshot_hash', 'tool_name',
            'payload', 'created_at',
        )
        read_only_fields = ('id', 'created_at')


class EventCreateSerializer(serializers.ModelSerializer):
    """Used for POST /api/nodes/<pk>/events/ — node is set from the URL, not the body."""
    class Meta:
        model = Event
        fields = (
            'id', 'event_type',
            'parent_event_id', 'branched_from_event_id', 'snapshot_hash', 'tool_name',
            'payload', 'created_at',
        )
        read_only_fields = ('id', 'created_at')


class NodeSerializer(serializers.ModelSerializer):
    parents = serializers.PrimaryKeyRelatedField(many=True, queryset=Node.objects.all(), required=False)
    children = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = Node
        fields = (
            'id', 'graph', 'parents', 'children',
            'label', 'summary', 'status',
            'inherited_context_length',
            'materialized_context', 'compressed_context', 'delta_events',
            'git_hash', 'model', 'tool',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'children', 'created_at', 'updated_at')


class NodeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Node
        fields = ('label', 'summary', 'status', 'git_hash', 'model', 'tool')


class NodeCheckoutSerializer(serializers.Serializer):
    materialized_context = serializers.ListField()
    compressed_context = serializers.ListField()
    git_hash = serializers.CharField()
    node_id = serializers.UUIDField()
