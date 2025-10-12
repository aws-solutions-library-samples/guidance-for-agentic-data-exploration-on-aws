#!/bin/bash

# AI Data Explorer Evaluation Runner
# Runs comprehensive evaluation of the multi-agent system

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
EVAL_DIR="$PROJECT_DIR/evaluation"

# Default values
MODE="single"
BASELINE_RUNS=5
VERBOSE=false
EVALUATOR_MODEL="us.anthropic.claude-sonnet-4-20250514-v1:0"
AGENT_MODEL=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --baseline)
            MODE="baseline"
            shift
            ;;
        --compare)
            MODE="compare"
            BASELINE_PATH="$2"
            shift 2
            ;;
        --runs)
            BASELINE_RUNS="$2"
            shift 2
            ;;
        --evaluator-model)
            EVALUATOR_MODEL="$2"
            shift 2
            ;;
        --agent-model)
            AGENT_MODEL="$2"
            shift 2
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --baseline              Run baseline evaluation (multiple rounds)"
            echo "  --compare <path>        Compare with baseline file"
            echo "  --runs <num>           Number of runs for baseline (default: 5)"
            echo "  --evaluator-model <model> Model for LLM judge evaluation"
            echo "  --agent-model <model>   Model for agents being tested"
            echo "  --verbose, -v          Verbose output"
            echo "  --help, -h             Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "================================"
echo "🚀 AI Data Explorer Evaluation"
echo "================================"

# Change to evaluation directory
cd "$EVAL_DIR"

# Set up environment
export PYTHONPATH="$PROJECT_DIR/docker/app:$PYTHONPATH"

# Set agent model if specified
if [ -n "$AGENT_MODEL" ]; then
    export AGENT_MODEL="$AGENT_MODEL"
    echo "🤖 Using agent model: $AGENT_MODEL"
fi

# Install requirements if needed
if [ ! -f "requirements.txt" ]; then
    echo "📦 Creating evaluation requirements..."
    cat > requirements.txt << EOF
pandas>=1.5.0
matplotlib>=3.5.0
strands-agents[otel]
strands-agents-tools
EOF
fi

# Check if requirements are installed
python3 -c "import pandas, matplotlib" 2>/dev/null || {
    echo "📦 Installing evaluation requirements..."
    pip install -r requirements.txt
}

# Run evaluation based on mode
case $MODE in
    "single")
        echo "🔍 Running single evaluation..."
        python3 run_evaluation.py --evaluator-model "$EVALUATOR_MODEL" ${VERBOSE:+--verbose}
        ;;
    "baseline")
        echo "📊 Running baseline evaluation with $BASELINE_RUNS rounds..."
        python3 continuous_eval.py --mode baseline --runs "$BASELINE_RUNS" --evaluator-model "$EVALUATOR_MODEL"
        ;;
    "compare")
        if [ -z "$BASELINE_PATH" ]; then
            echo "❌ Error: Baseline path required for compare mode"
            exit 1
        fi
        echo "📈 Comparing with baseline: $BASELINE_PATH"
        python3 continuous_eval.py --mode compare --baseline-path "$BASELINE_PATH" --evaluator-model "$EVALUATOR_MODEL"
        ;;
esac

echo ""
echo "✅ Evaluation complete!"
echo "📁 Results saved in: $EVAL_DIR/evaluation_results/"
