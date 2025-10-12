#!/usr/bin/env python3
"""
Continuous Evaluation for AI Data Explorer

Runs multiple evaluation rounds to establish statistical baselines
and track performance over time.
"""

import os
import json
import statistics
from datetime import datetime
from agent_evaluator import AgentEvaluator

class ContinuousEvaluator:
    def __init__(self, test_cases_path: str, output_dir: str = "continuous_evaluation", evaluator_model: str = None):
        self.evaluator = AgentEvaluator(test_cases_path, output_dir, evaluator_model)
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def run_baseline_evaluation(self, num_runs: int = 5) -> dict:
        """Run multiple evaluation rounds to establish baseline"""
        print(f"🔄 Running baseline evaluation with {num_runs} rounds...")
        
        all_results = []
        all_metrics = []
        
        for run in range(1, num_runs + 1):
            print(f"\n--- Round {run}/{num_runs} ---")
            
            results = self.evaluator.evaluate_supervisor_agent(f"baseline_run_{run}")
            all_results.append(results["results"])
            all_metrics.append(results["metrics"])
        
        # Calculate statistical baseline
        baseline_stats = self._calculate_baseline_stats(all_metrics)
        
        # Save baseline
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        baseline_path = os.path.join(self.output_dir, f"baseline_{timestamp}.json")
        
        baseline_data = {
            "timestamp": timestamp,
            "num_runs": num_runs,
            "individual_runs": all_metrics,
            "baseline_stats": baseline_stats,
            "all_results": all_results
        }
        
        with open(baseline_path, "w") as f:
            json.dump(baseline_data, f, indent=2)
        
        print(f"\n📊 Baseline Statistics:")
        for metric, stats in baseline_stats.items():
            if isinstance(stats, dict) and 'mean' in stats:
                print(f"  {metric}: {stats['mean']:.3f} ± {stats['std']:.3f}")
        
        print(f"\n✅ Baseline saved to: {baseline_path}")
        return baseline_data
    
    def _calculate_baseline_stats(self, metrics_list: list) -> dict:
        """Calculate statistical baseline from multiple runs"""
        baseline_stats = {}
        
        # Metrics to track statistically
        numeric_metrics = [
            'success_rate', 'avg_response_time', 'agent_routing_accuracy', 
            'content_accuracy', 'avg_llm_accuracy', 'avg_llm_relevance',
            'avg_llm_completeness', 'avg_llm_agent_selection'
        ]
        
        for metric in numeric_metrics:
            values = []
            for run_metrics in metrics_list:
                if metric in run_metrics and run_metrics[metric] is not None:
                    values.append(run_metrics[metric])
            
            if values:
                baseline_stats[metric] = {
                    'mean': statistics.mean(values),
                    'std': statistics.stdev(values) if len(values) > 1 else 0,
                    'min': min(values),
                    'max': max(values),
                    'count': len(values)
                }
        
        return baseline_stats
    
    def compare_with_baseline(self, baseline_path: str) -> dict:
        """Compare current performance with baseline"""
        print(f"📊 Comparing with baseline: {baseline_path}")
        
        # Load baseline
        with open(baseline_path, 'r') as f:
            baseline_data = json.load(f)
        
        baseline_stats = baseline_data['baseline_stats']
        
        # Run current evaluation
        current_results = self.evaluator.evaluate_supervisor_agent("current_vs_baseline")
        current_metrics = current_results["metrics"]
        
        # Compare metrics
        comparison = {}
        significant_changes = []
        
        for metric, baseline_stat in baseline_stats.items():
            if metric in current_metrics:
                current_value = current_metrics[metric]
                baseline_mean = baseline_stat['mean']
                baseline_std = baseline_stat['std']
                
                # Calculate z-score for significance
                if baseline_std > 0:
                    z_score = (current_value - baseline_mean) / baseline_std
                else:
                    z_score = 0
                
                comparison[metric] = {
                    'current': current_value,
                    'baseline_mean': baseline_mean,
                    'baseline_std': baseline_std,
                    'difference': current_value - baseline_mean,
                    'percent_change': ((current_value - baseline_mean) / baseline_mean * 100) if baseline_mean != 0 else 0,
                    'z_score': z_score,
                    'significant': abs(z_score) > 2  # 95% confidence
                }
                
                if abs(z_score) > 2:
                    direction = "improved" if z_score > 0 else "degraded"
                    significant_changes.append(f"{metric} {direction} significantly (z={z_score:.2f})")
        
        # Print comparison results
        print(f"\n📈 Performance Comparison:")
        for metric, comp in comparison.items():
            status = "📈" if comp['difference'] > 0 else "📉" if comp['difference'] < 0 else "➡️"
            significance = " ⚠️ SIGNIFICANT" if comp['significant'] else ""
            print(f"  {status} {metric}: {comp['current']:.3f} vs {comp['baseline_mean']:.3f} ({comp['percent_change']:+.1f}%){significance}")
        
        if significant_changes:
            print(f"\n⚠️  Significant Changes Detected:")
            for change in significant_changes:
                print(f"  • {change}")
        else:
            print(f"\n✅ No significant performance changes detected")
        
        # Save comparison results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        comparison_path = os.path.join(self.output_dir, f"comparison_{timestamp}.json")
        
        comparison_data = {
            "timestamp": timestamp,
            "baseline_path": baseline_path,
            "current_results": self._make_json_serializable(current_results),
            "comparison": comparison,
            "significant_changes": significant_changes
        }
        
        with open(comparison_path, "w") as f:
            json.dump(comparison_data, f, indent=2, default=str)
        
        print(f"\n💾 Comparison saved to: {comparison_path}")
        return comparison_data
    
    def _make_json_serializable(self, obj):
        """Convert objects to JSON serializable format"""
        if isinstance(obj, dict):
            return {k: self._make_json_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._make_json_serializable(item) for item in obj]
        elif isinstance(obj, bool):
            return obj  # booleans are JSON serializable
        elif hasattr(obj, '__dict__'):
            return str(obj)  # Convert complex objects to string
        else:
            return obj

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Continuous Evaluation for AI Data Explorer")
    parser.add_argument("--mode", choices=["baseline", "compare"], required=True,
                       help="Mode: 'baseline' to establish baseline, 'compare' to compare with baseline")
    parser.add_argument("--test-cases", default="test_cases.json", help="Path to test cases")
    parser.add_argument("--runs", type=int, default=5, help="Number of runs for baseline")
    parser.add_argument("--baseline-path", help="Path to baseline file for comparison")
    parser.add_argument("--evaluator-model", default="us.anthropic.claude-sonnet-4-20250514-v1:0", help="Model for LLM judge evaluation")
    
    args = parser.parse_args()
    
    # Ensure we're in the right directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    evaluator = ContinuousEvaluator(args.test_cases, evaluator_model=args.evaluator_model)
    
    if args.mode == "baseline":
        evaluator.run_baseline_evaluation(args.runs)
    elif args.mode == "compare":
        if not args.baseline_path:
            print("❌ Error: --baseline-path required for compare mode")
            return 1
        evaluator.compare_with_baseline(args.baseline_path)

if __name__ == "__main__":
    main()
