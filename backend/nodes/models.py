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

    # Number of messages inherited from parent node at branch time (0 for root nodes)
    inherited_context_length = models.IntegerField(default=0)

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
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    node = models.ForeignKey(Node, on_delete=models.CASCADE, related_name='events')

    # Free-text — no DB constraint. Use EventType constants from event_types.py.
    event_type = models.CharField(max_length=50)

    # Linked-list pointer to the previous event in this node's chain.
    # Null on the first event of a node.
    parent_event_id = models.UUIDField(null=True, blank=True, db_index=True)

    # For branch events only: the exact event in the PARENT node where this branch split off.
    # This is what makes the DAG precise — not just "branched from node X" but
    # "branched from event Y inside node X, at that exact point in the chain."
    # Null on root nodes and on any event that isn't a branch point.
    branched_from_event_id = models.UUIDField(null=True, blank=True, db_index=True)

    # For CLI events that mutate filesystem state: the shadow-repo commit hash
    # captured by SnapshotManager after the tool call completed.
    snapshot_hash = models.CharField(max_length=40, blank=True)

    # Tool name (CLI surface — populated for pre/post_tool_use events)
    tool_name = models.CharField(max_length=100, blank=True)

    # All other event-specific data
    payload = models.JSONField(default=dict)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.event_type} @ {self.node.id}'
