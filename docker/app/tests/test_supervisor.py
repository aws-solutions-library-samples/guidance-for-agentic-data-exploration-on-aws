def test_supervisor_system_prompt():
    """Test supervisor system prompt contains key routing information."""
    from agents.supervisor_agent import SUPERVISOR_SYSTEM_PROMPT
    assert "Supply Chain Assistant" in SUPERVISOR_SYSTEM_PROMPT
    assert "General Assistant" in SUPERVISOR_SYSTEM_PROMPT
    assert "Schema Translator" in SUPERVISOR_SYSTEM_PROMPT
    assert "Data Analyzer" in SUPERVISOR_SYSTEM_PROMPT
    assert "Graph Agent" in SUPERVISOR_SYSTEM_PROMPT
    assert "Data Visualizer Agent" in SUPERVISOR_SYSTEM_PROMPT
