#!/usr/bin/env python3
"""
AI Data Explorer Agent Evaluation Runner

This script runs comprehensive evaluations on the multi-agent system.
"""

import os
import sys
import argparse
import json
from agent_evaluator import AgentEvaluator

def main():
    parser = argparse.ArgumentParser(description="Run AI Data Explorer Agent Evaluation")
    parser.add_argument("--test-cases", default="test_cases.json", help="Path to test cases JSON file")
    parser.add_argument("--output-dir", default="evaluation_results", help="Output directory for results")
    parser.add_argument("--baseline", help="Path to baseline results for comparison")
    parser.add_argument("--evaluator-model", default="us.anthropic.claude-sonnet-4-20250514-v1:0", help="Model to use for LLM judge evaluation")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    # Ensure we're in the right directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    # Initialize evaluator
    evaluator = AgentEvaluator(args.test_cases, args.output_dir, args.evaluator_model)
    
    print("🚀 Starting AI Data Explorer Agent Evaluation")
    print(f"📋 Test cases: {args.test_cases}")
    print(f"📁 Output directory: {args.output_dir}")
    
    # Run evaluation
    results = evaluator.evaluate_supervisor_agent("supervisor")
    
    # Print summary
    metrics = results["metrics"]
    print("\n" + "="*50)
    print("📊 EVALUATION SUMMARY")
    print("="*50)
    print(f"Total Tests: {metrics['total_tests']}")
    print(f"Successful Tests: {metrics['successful_tests']}")
    print(f"Success Rate: {metrics['success_rate']:.2%}")
    print(f"Average Response Time: {metrics['avg_response_time']:.2f}s")
    print(f"Agent Routing Accuracy: {metrics['agent_routing_accuracy']:.2%}")
    print(f"Content Accuracy: {metrics['content_accuracy']:.2%}")
    
    # Category breakdown
    print(f"\n📈 Results by Category:")
    for category, count in metrics['categories'].items():
        print(f"  {category}: {count} tests")
    
    # LLM Judge metrics if available
    llm_metrics = [k for k in metrics.keys() if k.startswith('avg_llm_')]
    if llm_metrics:
        print(f"\n🤖 LLM Judge Scores (1-5):")
        for metric in llm_metrics:
            clean_name = metric.replace('avg_llm_', '').replace('_', ' ').title()
            print(f"  {clean_name}: {metrics[metric]:.2f}")
    
    # Compare with baseline if provided
    if args.baseline and os.path.exists(args.baseline):
        print(f"\n📊 Comparing with baseline: {args.baseline}")
        with open(args.baseline, 'r') as f:
            baseline_data = json.load(f)
        
        baseline_results = {"metrics": baseline_data.get("metrics", {})}
        evaluator.compare_evaluations(results, baseline_results, "Current", "Baseline")
    
    print(f"\n✅ Evaluation complete! Results saved to: {results['results_path']}")
    
    # Set exit code based on success rate threshold
    success_threshold = 0.8  # 80% success rate threshold
    if metrics['success_rate'] < success_threshold:
        print(f"⚠️  Warning: Success rate {metrics['success_rate']:.2%} below threshold {success_threshold:.2%}")
        sys.exit(1)
    else:
        print(f"✅ Success rate {metrics['success_rate']:.2%} meets threshold {success_threshold:.2%}")

if __name__ == "__main__":
    main()
