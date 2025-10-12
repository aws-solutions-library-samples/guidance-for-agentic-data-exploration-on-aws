from strands.hooks import HookProvider, HookRegistry
from strands.experimental.hooks import AfterToolInvocationEvent

class ChartResultProcessor(HookProvider):
    def __init__(self):
        self.chart_content = None
    
    def register_hooks(self, registry: HookRegistry) -> None:
        registry.add_callback(AfterToolInvocationEvent, self.process_result)

    def process_result(self, event: AfterToolInvocationEvent) -> None:
        if event.tool_use["name"] == "data_visualizer_assistant":
            # Store the chart content to be included in response
            self.chart_content = event.result
            # Modify the result to ensure it gets included in the agent's response
            if hasattr(event, 'result') and event.result:
                # The result should already be included, but let's ensure it
                pass
