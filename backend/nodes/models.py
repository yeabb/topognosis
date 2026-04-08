import uuid
from django.db import models


class Node(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('dead_end', 'Dead End'),
        ('merged', 'Merged'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    graph = models.ForeignKey('graphs.Graph', on_delete=models.CASCADE, related_name='nodes')
    parents = models.ManyToManyField('self', symmetrical=False, blank=True, related_name='children')
    # User-defined or auto-derived from summary. Placeholder is first message truncated.
    label = models.CharField(max_length=255, blank=True)

    # AI-generated 1-2 sentence summary of what happened in this node.
    # Blank while node is active. Generated lazily on hover/view or forced on push to platform.
    summary = models.TextField(blank=True)

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')

    # Full materialized conversation context up to this node
    materialized_context = models.JSONField(default=list)

    # Compressed version fed to the AI model when context exceeds threshold
    compressed_context = models.JSONField(default=list)

    # Raw events since parent — audit trail and playback
    delta_events = models.JSONField(default=list)

    # Git commit hash of filesystem state at this node (CLI surface only)
    git_hash = models.CharField(max_length=40, blank=True)

    # Which model/tool was used at this node
    model = models.CharField(max_length=100, blank=True)
    tool = models.CharField(max_length=100, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.graph} / {self.id}'


class Event(models.Model):
    EVENT_TYPES = [
        ('message_user', 'User Message'),
        ('message_ai', 'AI Message'),
        ('tool_call', 'Tool Call'),
        ('tool_result', 'Tool Result'),
        ('branch', 'Branch'),
        ('merge', 'Merge'),
        ('compress', 'Compression'),
        ('checkout', 'Checkout'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    node = models.ForeignKey(Node, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.event_type} @ {self.node.id}'
