#!/bin/bash

# AI Data Explorer Log Monitoring Script
# Monitors CloudWatch logs for streaming errors and exceptions

set -e

echo "🔍 AI Data Explorer Log Monitor"
echo "==============================="

# Configuration
LOG_GROUP="DataExplorerAgentsStack-AgentServiceLogs2FB27782-zrehbS19FqUn"
REGION="us-east-1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "📋 Monitoring log group: $LOG_GROUP"
echo "🌍 Region: $REGION"
echo ""

# Function to monitor logs in real-time
monitor_realtime() {
    echo "🔴 Starting real-time log monitoring (Ctrl+C to stop)..."
    echo "Looking for errors, exceptions, and streaming issues..."
    echo ""
    
    # Get current timestamp
    START_TIME=$(date -u +%s)000
    
    while true; do
        # Check for errors in the last 30 seconds
        CURRENT_TIME=$(date -u +%s)000
        SEARCH_START=$((CURRENT_TIME - 30000))
        
        # Search for errors
        ERROR_LOGS=$(aws logs filter-log-events \
            --region $REGION \
            --log-group-name "$LOG_GROUP" \
            --start-time $SEARCH_START \
            --filter-pattern "ERROR" \
            --query "events[].{timestamp:timestamp,message:message}" \
            --output json 2>/dev/null || echo "[]")
        
        # Search for exceptions
        EXCEPTION_LOGS=$(aws logs filter-log-events \
            --region $REGION \
            --log-group-name "$LOG_GROUP" \
            --start-time $SEARCH_START \
            --filter-pattern "Exception" \
            --query "events[].{timestamp:timestamp,message:message}" \
            --output json 2>/dev/null || echo "[]")
        
        # Search for streaming issues
        STREAM_LOGS=$(aws logs filter-log-events \
            --region $REGION \
            --log-group-name "$LOG_GROUP" \
            --start-time $SEARCH_START \
            --filter-pattern "stream" \
            --query "events[].{timestamp:timestamp,message:message}" \
            --output json 2>/dev/null || echo "[]")
        
        # Display errors
        if [[ "$ERROR_LOGS" != "[]" && "$ERROR_LOGS" != "" ]]; then
            echo -e "${RED}🚨 ERRORS DETECTED:${NC}"
            echo "$ERROR_LOGS" | jq -r '.[] | "\(.timestamp | tonumber / 1000 | strftime("%H:%M:%S")) - \(.message)"'
            echo ""
        fi
        
        # Display exceptions
        if [[ "$EXCEPTION_LOGS" != "[]" && "$EXCEPTION_LOGS" != "" ]]; then
            echo -e "${RED}💥 EXCEPTIONS DETECTED:${NC}"
            echo "$EXCEPTION_LOGS" | jq -r '.[] | "\(.timestamp | tonumber / 1000 | strftime("%H:%M:%S")) - \(.message)"'
            echo ""
        fi
        
        # Display streaming logs
        if [[ "$STREAM_LOGS" != "[]" && "$STREAM_LOGS" != "" ]]; then
            echo -e "${BLUE}🌊 STREAMING ACTIVITY:${NC}"
            echo "$STREAM_LOGS" | jq -r '.[] | "\(.timestamp | tonumber / 1000 | strftime("%H:%M:%S")) - \(.message)"'
            echo ""
        fi
        
        sleep 5
    done
}

# Function to search recent logs
search_recent() {
    local MINUTES=${1:-10}
    local PATTERN=${2:-"ERROR"}
    
    echo "🔍 Searching last $MINUTES minutes for pattern: $PATTERN"
    
    # Calculate start time
    START_TIME=$(date -u -d "$MINUTES minutes ago" +%s)000
    
    aws logs filter-log-events \
        --region $REGION \
        --log-group-name "$LOG_GROUP" \
        --start-time $START_TIME \
        --filter-pattern "$PATTERN" \
        --query "events[].{timestamp:timestamp,message:message}" \
        --output table
}

# Function to get streaming statistics
streaming_stats() {
    echo "📊 Streaming Statistics (last 30 minutes)"
    
    START_TIME=$(date -u -d "30 minutes ago" +%s)000
    
    echo ""
    echo "🔧 Chunk Processing:"
    aws logs filter-log-events \
        --region $REGION \
        --log-group-name "$LOG_GROUP" \
        --start-time $START_TIME \
        --filter-pattern "Processing chunk" \
        --query "length(events)" \
        --output text | xargs -I {} echo "  Total chunks processed: {}"
    
    echo ""
    echo "❌ Errors:"
    aws logs filter-log-events \
        --region $REGION \
        --log-group-name "$LOG_GROUP" \
        --start-time $START_TIME \
        --filter-pattern "ERROR" \
        --query "length(events)" \
        --output text | xargs -I {} echo "  Total errors: {}"
    
    echo ""
    echo "🌊 Stream Completions:"
    aws logs filter-log-events \
        --region $REGION \
        --log-group-name "$LOG_GROUP" \
        --start-time $START_TIME \
        --filter-pattern "Stream completed" \
        --query "length(events)" \
        --output text | xargs -I {} echo "  Successful completions: {}"
}

# Main menu
case "${1:-menu}" in
    "monitor"|"m")
        monitor_realtime
        ;;
    "search"|"s")
        search_recent "${2:-10}" "${3:-ERROR}"
        ;;
    "stats"|"st")
        streaming_stats
        ;;
    "errors"|"e")
        search_recent 30 "ERROR"
        ;;
    "exceptions"|"ex")
        search_recent 30 "Exception"
        ;;
    "streaming"|"str")
        search_recent 15 "stream"
        ;;
    *)
        echo "Usage: $0 [command] [options]"
        echo ""
        echo "Commands:"
        echo "  monitor, m          - Real-time log monitoring"
        echo "  search, s [min] [pattern] - Search recent logs (default: 10 min, ERROR)"
        echo "  stats, st           - Show streaming statistics"
        echo "  errors, e           - Show recent errors (30 min)"
        echo "  exceptions, ex      - Show recent exceptions (30 min)"
        echo "  streaming, str      - Show recent streaming activity (15 min)"
        echo ""
        echo "Examples:"
        echo "  $0 monitor                    # Real-time monitoring"
        echo "  $0 search 5 'JSON'          # Search last 5 min for JSON"
        echo "  $0 errors                    # Show recent errors"
        echo "  $0 stats                     # Show statistics"
        ;;
esac
