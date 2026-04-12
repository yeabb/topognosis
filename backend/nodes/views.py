import logging

from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Node, Event
from .serializers import NodeSerializer, NodeUpdateSerializer, NodeCheckoutSerializer, EventCreateSerializer

logger = logging.getLogger(__name__)


class NodeListCreateView(generics.ListCreateAPIView):
    serializer_class = NodeSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        graph_id = self.request.query_params.get('graph')
        return Node.objects.filter(graph__owner=self.request.user, graph_id=graph_id)


class NodeDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Node.objects.filter(graph__owner=self.request.user)

    def get_serializer_class(self):
        if self.request.method == 'PATCH':
            return NodeUpdateSerializer
        return NodeSerializer


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def checkout_node(request, pk):
    try:
        node = Node.objects.get(pk=pk, graph__owner=request.user)
    except Node.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    serializer = NodeCheckoutSerializer({
        'node_id': node.id,
        'materialized_context': node.materialized_context,
        'compressed_context': node.compressed_context,
        'git_hash': node.git_hash,
    })
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def append_event(request, pk):
    """Append a delta_event to a node. Used by the CLI to stream events in real time."""
    try:
        node = Node.objects.get(pk=pk, graph__owner=request.user)
    except Node.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    serializer = EventCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    event = serializer.save(node=node)

    # Keep delta_events on the Node in sync as an ordered list of IDs.
    # This gives a fast O(1) ordered access without traversing the linked list.
    node.delta_events = node.delta_events + [str(event.id)]
    node.save(update_fields=['delta_events', 'updated_at'])

    logger.info('Event %s (%s) appended to node %s', event.id, event.event_type, node.id)
    return Response(EventCreateSerializer(event).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def branch_node(request, pk):
    """
    Create a new child node branched from a specific message index in the parent node.
    The new node's context is parent.materialized_context[:branch_from_index+1].
    """
    try:
        parent = Node.objects.get(pk=pk, graph__owner=request.user)
    except Node.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    branch_from_index = request.data.get('branch_from_index')
    if branch_from_index is None:
        return Response({'detail': 'branch_from_index is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        branch_from_index = int(branch_from_index)
    except (TypeError, ValueError):
        return Response({'detail': 'branch_from_index must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

    context = parent.materialized_context
    if branch_from_index < 0 or branch_from_index >= len(context):
        return Response({'detail': 'branch_from_index out of range.'}, status=status.HTTP_400_BAD_REQUEST)

    sliced_context = context[:branch_from_index + 1]

    child = Node.objects.create(
        graph=parent.graph,
        label='',  # set from first user message when they send it
        model=parent.model,
        tool=parent.tool,
        status='active',
        materialized_context=sliced_context,
        inherited_context_length=len(sliced_context),
    )
    child.parents.add(parent)

    logger.info(f'Branched node {child.id} from {parent.id} at index {branch_from_index}')

    serializer = NodeSerializer(child)
    return Response(serializer.data, status=status.HTTP_201_CREATED)
