import json
import os
import uuid
import anthropic
from django.http import StreamingHttpResponse
from django.utils.text import slugify
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import Graph
from .serializers import GraphSerializer
from nodes.models import Node


class GraphListCreateView(generics.ListCreateAPIView):
    serializer_class = GraphSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Graph.objects.filter(owner=self.request.user).order_by('-updated_at')

    def perform_create(self, serializer):
        name = serializer.validated_data.get('name', 'New graph')
        base_slug = slugify(name) or 'graph'
        slug = base_slug
        # Ensure slug is unique per owner
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

    # Get or create the active node for this graph
    node = Node.objects.filter(graph=graph, status='active').order_by('-created_at').first()
    if not node:
        node = Node.objects.create(
            graph=graph,
            label=message[:80],
            model='claude-sonnet-4-6',
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
        client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
        full_response = ''

        try:
            with client.messages.stream(
                model='claude-sonnet-4-6',
                max_tokens=4096,
                messages=node.materialized_context,
            ) as stream:
                for text in stream.text_stream:
                    full_response += text
                    yield f'data: {json.dumps({"text": text})}\n\n'

            # Save assistant response to node
            node.materialized_context.append({'role': 'assistant', 'content': full_response})
            node.save()

            yield f'data: {json.dumps({"done": True, "graph_name": graph.name})}\n\n'

        except Exception as e:
            yield f'data: {json.dumps({"error": str(e)})}\n\n'

    response = StreamingHttpResponse(stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response
