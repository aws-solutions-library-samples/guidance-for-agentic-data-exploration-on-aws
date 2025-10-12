import json
import pandas as pd
import matplotlib.pyplot as plt
import datetime
import os
import sys
import time
from typing import Dict, List, Any, Optional

# Add the app directory to the path to import agents
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'docker', 'app'))

class AgentEvaluator:
    def __init__(self, test_cases_path: str, output_dir: str = "evaluation_results", evaluator_model: str = None):
        """Initialize evaluator with test cases"""
        with open(test_cases_path, "r") as f:
            self.test_cases = json.load(f)
        
        self.output_dir = output_dir
        self.evaluator_model = evaluator_model or "us.anthropic.claude-sonnet-4-20250514-v1:0"
        os.makedirs(output_dir, exist_ok=True)
        
        # Initialize evaluator agent for LLM judge evaluation
        self.evaluator_agent = None
        self._init_evaluator_agent()
    
    def _init_evaluator_agent(self):
        """Initialize the evaluator agent for LLM judge evaluation"""
        try:
            from strands import Agent
            self.evaluator_agent = Agent(
                model=self.evaluator_model,
                system_prompt="""You are an expert AI evaluator. Assess AI responses based on:
1. Accuracy - factual correctness (1-5)
2. Relevance - addresses the query (1-5) 
3. Completeness - covers all aspects (1-5)
4. Agent Selection - appropriate agent routing (1-5)

Provide scores and brief explanation. Format as JSON:
{"accuracy": X, "relevance": X, "completeness": X, "agent_selection": X, "explanation": "..."}"""
            )
        except Exception as e:
            print(f"Warning: Could not initialize evaluator agent: {e}")
    
    def evaluate_supervisor_agent(self, agent_name: str = "supervisor") -> Dict[str, Any]:
        """Evaluate the supervisor agent with comprehensive metrics"""
        from agents.supervisor_agent import supervisor_agent
        
        results = []
        start_time = datetime.datetime.now()
        
        print(f"Starting evaluation of {agent_name} at {start_time}")
        
        for i, case in enumerate(self.test_cases):
            print(f"Running test {i+1}/{len(self.test_cases)}: {case['id']}")
            
            case_start = datetime.datetime.now()
            
            try:
                # Clear conversation history before each test
                supervisor_agent.messages.clear()
                
                # Clear agent cache to ensure fresh agent with new model
                if hasattr(supervisor_agent, '_supervisor_agent'):
                    supervisor_agent._supervisor_agent = None
                
                # Execute the query
                response = supervisor_agent(case["query"])
                response_text = str(response)
                
                # Handle follow-up queries for multi-turn tests
                follow_up_response = None
                if case.get("follow_up"):
                    follow_up_response = supervisor_agent(case["follow_up"])
                
                case_duration = (datetime.datetime.now() - case_start).total_seconds()
                
                # Analyze response
                analysis = self._analyze_response(case, response_text, response)
                
                result = {
                    "test_id": case["id"],
                    "category": case.get("category", ""),
                    "query": case["query"],
                    "expected_agent": case.get("expected_agent", ""),
                    "expected_contains": case.get("expected_contains", []),
                    "actual_response": response_text,
                    "follow_up_query": case.get("follow_up"),
                    "follow_up_response": str(follow_up_response) if follow_up_response else None,
                    "response_time": case_duration,
                    "contains_expected": analysis["contains_expected"],
                    "agent_routing_correct": analysis["agent_routing_correct"],
                    "success": analysis["success"],
                    "timestamp": datetime.datetime.now().isoformat()
                }
                
                # Add LLM judge evaluation if available
                if self.evaluator_agent:
                    llm_eval = self._llm_judge_evaluation(case, response_text)
                    result.update(llm_eval)
                
                results.append(result)
                
            except Exception as e:
                print(f"Error in test {case['id']}: {e}")
                results.append({
                    "test_id": case["id"],
                    "category": case.get("category", ""),
                    "query": case["query"],
                    "error": str(e),
                    "success": False,
                    "timestamp": datetime.datetime.now().isoformat()
                })
        
        total_duration = (datetime.datetime.now() - start_time).total_seconds()
        
        # Save results
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        results_path = os.path.join(self.output_dir, f"{agent_name}_{timestamp}.json")
        
        with open(results_path, "w") as f:
            json.dump(results, f, indent=2)
        
        print(f"Evaluation completed in {total_duration:.2f} seconds")
        print(f"Results saved to {results_path}")
        
        # Generate analysis
        metrics = self._calculate_metrics(results, agent_name)
        self._generate_charts(results, agent_name, timestamp)
        
        return {
            "results": results,
            "metrics": metrics,
            "results_path": results_path
        }
    
    def _analyze_response(self, case: Dict, response_text: str, response_obj: Any) -> Dict[str, Any]:
        """Analyze response for correctness and agent routing"""
        analysis = {
            "contains_expected": False,
            "agent_routing_correct": False,
            "success": False
        }
        
        # Check if response contains expected content
        expected_contains = case.get("expected_contains", [])
        if expected_contains:
            analysis["contains_expected"] = any(
                expected.lower() in response_text.lower() 
                for expected in expected_contains
            )
        else:
            analysis["contains_expected"] = True  # No specific content expected
        
        # For agent routing, we'd need to inspect the actual agent used
        # This is simplified - in practice you'd track which agent was called
        expected_agent = case.get("expected_agent")
        if expected_agent:
            # Simplified routing check based on response content patterns
            routing_patterns = {
                "supply_chain_assistant": ["weather", "temperature", "forecast", "supply chain", "manufacturing", "inventory"],
                "schema_assistant": ["graph", "node", "relationship", "schema"],
                "data_visualizer_assistant": ["chart", "visualization", "plot"],

                "help_assistant": ["deploy", "setup", "install", "configuration"],
                "general_assistant": ["help", "assist", "answer"]
            }
            
            patterns = routing_patterns.get(expected_agent, [])
            analysis["agent_routing_correct"] = any(
                pattern.lower() in response_text.lower() 
                for pattern in patterns
            )
        else:
            analysis["agent_routing_correct"] = True
        
        # Overall success
        analysis["success"] = (
            analysis["contains_expected"] and 
            analysis["agent_routing_correct"] and
            len(response_text.strip()) > 0
        )
        
        return analysis
    
    def _llm_judge_evaluation(self, case: Dict, response_text: str) -> Dict[str, Any]:
        """Use LLM judge to evaluate response quality"""
        if not self.evaluator_agent:
            return {}
        
        try:
            eval_prompt = f"""
Query: {case['query']}
Expected Agent: {case.get('expected_agent', 'N/A')}
Expected Content: {case.get('expected_contains', [])}

Response to evaluate:
{response_text}

Evaluate this response and provide scores.
"""
            
            evaluation = self.evaluator_agent(eval_prompt)
            eval_text = str(evaluation)
            
            # Try to parse JSON from evaluation
            try:
                # Look for JSON in the response
                import re
                json_match = re.search(r'\{.*\}', eval_text, re.DOTALL)
                if json_match:
                    eval_scores = json.loads(json_match.group())
                    return {
                        "llm_accuracy": eval_scores.get("accuracy", 0),
                        "llm_relevance": eval_scores.get("relevance", 0), 
                        "llm_completeness": eval_scores.get("completeness", 0),
                        "llm_agent_selection": eval_scores.get("agent_selection", 0),
                        "llm_explanation": eval_scores.get("explanation", "")
                    }
            except:
                pass
            
            return {"llm_evaluation_raw": eval_text}
            
        except Exception as e:
            print(f"LLM evaluation failed: {e}")
            return {}
    
    def _calculate_metrics(self, results: List[Dict], agent_name: str) -> Dict[str, Any]:
        """Calculate comprehensive metrics from results"""
        df = pd.DataFrame(results)
        
        # Filter out error cases for metric calculation
        successful_results = df[df.get('success', False) == True]
        
        metrics = {
            "total_tests": len(results),
            "successful_tests": len(successful_results),
            "success_rate": len(successful_results) / len(results) if results else 0,
            "avg_response_time": df["response_time"].mean() if "response_time" in df else 0,
            "max_response_time": df["response_time"].max() if "response_time" in df else 0,
            "min_response_time": df["response_time"].min() if "response_time" in df else 0,
            "categories": df["category"].value_counts().to_dict() if "category" in df else {},
            "agent_routing_accuracy": 0,
            "content_accuracy": 0
        }
        
        # Calculate routing and content accuracy
        if len(successful_results) > 0:
            if "agent_routing_correct" in successful_results:
                metrics["agent_routing_accuracy"] = successful_results["agent_routing_correct"].mean()
            if "contains_expected" in successful_results:
                metrics["content_accuracy"] = successful_results["contains_expected"].mean()
        
        # LLM judge metrics if available
        llm_cols = ["llm_accuracy", "llm_relevance", "llm_completeness", "llm_agent_selection"]
        for col in llm_cols:
            if col in df and not df[col].isna().all():
                metrics[f"avg_{col}"] = df[col].mean()
        
        return metrics
    
    def _generate_charts(self, results: List[Dict], agent_name: str, timestamp: str):
        """Generate visualization charts for evaluation results"""
        df = pd.DataFrame(results)
        
        # Response time by category
        if "response_time" in df and "category" in df:
            plt.figure(figsize=(12, 6))
            
            plt.subplot(1, 2, 1)
            df.groupby("category")["response_time"].mean().plot(kind="bar")
            plt.title(f"Avg Response Time by Category - {agent_name}")
            plt.ylabel("Seconds")
            plt.xticks(rotation=45)
            
            # Success rate by category
            plt.subplot(1, 2, 2)
            success_by_category = df.groupby("category")["success"].mean()
            success_by_category.plot(kind="bar", color="green", alpha=0.7)
            plt.title(f"Success Rate by Category - {agent_name}")
            plt.ylabel("Success Rate")
            plt.xticks(rotation=45)
            plt.ylim(0, 1)
            
            plt.tight_layout()
            chart_path = os.path.join(self.output_dir, f"{agent_name}_{timestamp}_analysis.png")
            plt.savefig(chart_path, dpi=300, bbox_inches='tight')
            plt.close()
            
            print(f"Charts saved to {chart_path}")

    def compare_evaluations(self, results1: Dict, results2: Dict, name1: str, name2: str):
        """Compare two evaluation results"""
        metrics1 = results1["metrics"]
        metrics2 = results2["metrics"]
        
        print(f"\n=== Comparison: {name1} vs {name2} ===")
        print(f"Success Rate: {metrics1['success_rate']:.2%} vs {metrics2['success_rate']:.2%}")
        print(f"Avg Response Time: {metrics1['avg_response_time']:.2f}s vs {metrics2['avg_response_time']:.2f}s")
        print(f"Agent Routing Accuracy: {metrics1['agent_routing_accuracy']:.2%} vs {metrics2['agent_routing_accuracy']:.2%}")
        print(f"Content Accuracy: {metrics1['content_accuracy']:.2%} vs {metrics2['content_accuracy']:.2%}")
        
        # LLM judge comparison if available
        for metric in ["avg_llm_accuracy", "avg_llm_relevance", "avg_llm_completeness"]:
            if metric in metrics1 and metric in metrics2:
                print(f"{metric}: {metrics1[metric]:.2f} vs {metrics2[metric]:.2f}")
