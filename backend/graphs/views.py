import json
import logging
import os

from django.http import StreamingHttpResponse
from django.utils.text import slugify
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from nodes.models import Node
from llm.router import get_adapter, get_error_message
from .models import Graph
from .serializers import GraphSerializer

logger = logging.getLogger(__name__)

DEFAULT_MODEL = os.getenv('LLM_MODEL', 'claude-haiku-4-5-20251001')


class GraphListCreateView(generics.ListCreateAPIView):
    serializer_class = GraphSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Graph.objects.filter(owner=self.request.user).order_by('-updated_at')

    def perform_create(self, serializer):
        name = serializer.validated_data.get('name', 'New graph')
        base_slug = slugify(name) or 'graph'
        slug = base_slug
        counter = 1
        while Graph.objects.filter(owner=self.request.user, slug=slug).exists():
            slug = f'{base_slug}-{counter}'
            counter += 1
        serializer.save(owner=self.request.user, slug=slug)


class GraphDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = GraphSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Graph.objects.filter(owner=self.request.user)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def chat(request, pk):
    try:
        graph = Graph.objects.get(pk=pk, owner=request.user)
    except Graph.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    message = request.data.get('message', '').strip()
    if not message:
        return Response({'detail': 'Message is required.'}, status=status.HTTP_400_BAD_REQUEST)

    model = request.data.get('model', DEFAULT_MODEL)

    # If a specific node_id is provided (e.g. after branching), use that node.
    # Otherwise fall back to finding/creating the active node for this graph.
    node_id = request.data.get('node_id')
    node = None

    if node_id:
        try:
            node = Node.objects.get(pk=node_id, graph=graph)
        except Node.DoesNotExist:
            return Response({'detail': 'Node not found.'}, status=status.HTTP_404_NOT_FOUND)
    else:
        node = Node.objects.filter(graph=graph, status='active').order_by('-created_at').first()
        if not node:
            node = Node.objects.create(
                graph=graph,
                label=message[:80],
                model=model,
                tool='web',
            )

    # Append user message to materialized context
    node.materialized_context.append({'role': 'user', 'content': message})
    node.save()

    # Auto-name the graph from the first message if still default
    if graph.name == 'New graph':
        words = message.split()[:6]
        graph.name = ' '.join(words)
        graph.save()

    def stream():
        full_response = ''
        try:
            adapter = get_adapter(model)
            for text in adapter.stream(node.materialized_context):
                full_response += text
                yield f'data: {json.dumps({"text": text})}\n\n'

            node.materialized_context.append({'role': 'assistant', 'content': full_response})
            node.save()

            yield f'data: {json.dumps({"done": True, "node_id": str(node.id), "graph_name": graph.name})}\n\n'

        except Exception as e:
            logger.exception(f'Chat stream error for graph {graph.id}: {e}')
            yield f'data: {json.dumps({"error": get_error_message(e)})}\n\n'

    response = StreamingHttpResponse(stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response
