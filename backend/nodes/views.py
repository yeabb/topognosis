from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import Node
from .serializers import NodeSerializer, NodeUpdateSerializer, NodeCheckoutSerializer


class NodeListCreateView(generics.ListCreateAPIView):
    serializer_class = NodeSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        graph_id = self.request.query_params.get('graph')
        return Node.objects.filter(graph__owner=self.request.user, graph_id=graph_id)


class NodeDetailView(generics.RetrieveUpdateAPIView):
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
