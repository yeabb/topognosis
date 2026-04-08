from rest_framework import generics, permissions
from .models import Graph
from .serializers import GraphSerializer


class GraphListCreateView(generics.ListCreateAPIView):
    serializer_class = GraphSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Graph.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class GraphDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = GraphSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Graph.objects.filter(owner=self.request.user)
