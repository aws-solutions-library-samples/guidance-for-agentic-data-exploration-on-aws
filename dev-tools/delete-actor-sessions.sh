#!/bin/bash

# Delete all Bedrock AgentCore memory sessions for a specific actor
# Usage: ./delete-actor-sessions.sh <actor-id> [memory-id]

set -e

ACTOR_ID="$1"
MEMORY_ID="${2:-AIDataExplorer_STM-hrW4k8B5pU}"
REGION="${AWS_REGION:-us-east-1}"

if [ -z "$ACTOR_ID" ]; then
    echo "Usage: $0 <actor-id> [memory-id]"
    echo ""
    echo "Examples:"
    echo "  $0 local@dev"
    echo "  $0 user123@company.com ai-data-explorer-memory"
    echo ""
    echo "This will:"
    echo "  1. List all sessions for the actor"
    echo "  2. End each active session"
    echo "  3. Delete each session"
    exit 1
fi

echo "🗑️  Deleting sessions for actor: $ACTOR_ID"
echo "📝 Memory ID: $MEMORY_ID"
echo "🌍 Region: $REGION"
echo ""

# List sessions for the actor
echo "📋 Listing sessions..."
SESSIONS=$(aws bedrock-agentcore list-sessions \
    --region "$REGION" \
    --memory-id "$MEMORY_ID" \
    --actor-id "$ACTOR_ID" \
    --query "sessionSummaries[].sessionId" \
    --output text 2>/dev/null || echo "")

if [ -z "$SESSIONS" ] || [ "$SESSIONS" = "None" ]; then
    echo "✅ No sessions found for actor $ACTOR_ID"
    exit 0
fi

echo "Found sessions: $SESSIONS"
echo ""

# Process each session
for SESSION_ID in $SESSIONS; do
    echo "🔄 Processing session: $SESSION_ID"
    
    # List events for this session
    echo "  📋 Listing events..."
    EVENTS=$(aws bedrock-agentcore list-events \
        --region "$REGION" \
        --memory-id "$MEMORY_ID" \
        --actor-id "$ACTOR_ID" \
        --session-id "$SESSION_ID" \
        --query "events[].eventId" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$EVENTS" ] && [ "$EVENTS" != "None" ]; then
        EVENT_COUNT=$(echo "$EVENTS" | wc -w)
        echo "  Found $EVENT_COUNT events"
        echo "  🗑️  Deleting events..."
        # Delete each event
        for EVENT_ID in $EVENTS; do
            aws bedrock-agentcore delete-event \
                --region "$REGION" \
                --memory-id "$MEMORY_ID" \
                --session-id "$SESSION_ID" \
                --event-id "$EVENT_ID" \
                --actor-id "$ACTOR_ID" >/dev/null 2>&1
        done
        echo "  ✅ Deleted $EVENT_COUNT events"
    else
        echo "  ℹ️  No events found in session"
    fi
    
    echo ""
done

echo "🎉 Completed processing sessions and events for actor $ACTOR_ID"
