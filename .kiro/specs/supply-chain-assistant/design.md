# Design Document

## Overview

The Supply Chain Assistant is a comprehensive specialized agent that provides manufacturing-specific supply chain expertise within the AI Data Explorer multi-agent system. This agent consolidates weather capabilities, adds new environmental data sources, and provides access to graph database operations for complex supply chain network analysis.

The design follows the existing agent architecture patterns while introducing new tools for weather data aggregation, UV index monitoring, and enhanced supply chain analytics capabilities.

## Architecture

### Agent Structure

The Supply Chain Assistant follows the established Strands Agent framework pattern:

```python
supply_chain_agent = Agent(
    system_prompt=SUPPLY_CHAIN_SYSTEM_PROMPT,
    model=get_current_model(),
    tools=[
        openmateo_weather_tool,
        nws_weather_tool, 
        uv_index_tool,
        neptune_cypher_query,
        neptune_database_statistics
    ]
)
```

### Integration Points

1. **Supervisor Agent Integration**: The supervisor agent routing logic will be updated to direct supply chain and weather queries to the Supply Chain Assistant
2. **Weather Agent Migration**: The existing weather assistant functionality will be converted to a tool within the Supply Chain Assistant
3. **Neptune Integration**: Direct access to Neptune graph database tools for supply chain network analysis
4. **Multi-source Weather Data**: Aggregation and comparison of weather data from existing and new sources

## Components and Interfaces

### Core Agent Component

**File**: `docker/app/agents/supply_chain_assistant.py`

The main agent implementation following the established pattern:
- System prompt defining supply chain expertise areas
- Import weather tools from dedicated weather_tools module
- Tool integration for weather, UV, and graph database access
- Response formatting and error handling

**File**: `docker/app/agents/weather_tools.py`

A reusable module containing all weather-related tools:
- OpenMeteo weather tool (converted from existing weather agent)
- NWS weather API tool
- UV index tool
- Weather data aggregation utilities
- Designed for reuse across multiple agents

### Weather Tools Module

**File**: `docker/app/agents/weather_tools.py`

A dedicated module containing reusable weather tools that can be imported by any agent:

#### OpenMeteo Weather Tool
- **Function**: `openmeteo_weather_tool(query: str) -> str`
- **Purpose**: Leverage existing weather agent capabilities as a tool
- **Implementation**: Convert current weather assistant to a callable tool function
- **Reusability**: Can be imported and used by other agents

#### NWS Weather Tool  
- **Function**: `nws_weather_tool(location: str) -> str`
- **Purpose**: Access National Weather Service API for official weather data
- **API Endpoint**: `https://api.weather.gov/points/{latitude},{longitude}`
- **Implementation**: Use `strands_tools.http_request` for API calls
- **Reusability**: Standalone tool for NWS weather data access
- **Data Flow**:
  1. Get coordinates/grid info from points endpoint
  2. Retrieve forecast from returned forecast URL
  3. Format and return weather data

#### UV Index Tool
- **Function**: `uv_index_tool(latitude: float, longitude: float) -> str`
- **Purpose**: Access real-time UV index data
- **API Endpoint**: `https://currentuvindex.com/api/v1/uvi?latitude={lat}&longitude={lon}`
- **Implementation**: Direct HTTP request using `strands_tools.http_request`
- **Reusability**: Can be used by any agent needing UV data

#### Weather Data Aggregation
- **Function**: `aggregate_weather_data(location: str) -> str`
- **Purpose**: Combine and compare data from both weather sources
- **Implementation**: Call both weather tools and provide unified analysis
- **Reusability**: Provides standardized weather data comparison for any agent

### Weather Tools Import

The Supply Chain Assistant will import weather tools from the dedicated weather_tools module:

```python
from .weather_tools import (
    openmeteo_weather_tool,
    nws_weather_tool,
    uv_index_tool,
    aggregate_weather_data
)
```

### Neptune Graph Database Integration

#### Direct Tool Access
- **neptune_cypher_query**: Direct access to existing Neptune Cypher query tool
- **neptune_database_statistics**: Access to Neptune database statistics tool
- **Purpose**: Enable complex supply chain network analysis and relationship mapping

#### Supply Chain Graph Queries
- **Implementation**: Leverage existing Neptune tools infrastructure
- **Use Cases**: 
  - Supplier relationship mapping
  - Production network analysis
  - Inventory flow tracking
  - Risk assessment through network analysis

## Data Models

### Weather Data Model

```python
@dataclass
class WeatherData:
    source: str  # "openmeteo" or "nws_api"
    location: str
    temperature: float
    conditions: str
    forecast: List[str]
    alerts: List[str]
    timestamp: datetime
```

### UV Index Data Model

```python
@dataclass
class UVIndexData:
    latitude: float
    longitude: float
    uv_index: float
    risk_level: str  # "Low", "Moderate", "High", "Very High", "Extreme"
    timestamp: datetime
    recommendations: List[str]
```

### Supply Chain Context Model

```python
@dataclass
class SupplyChainContext:
    weather_data: List[WeatherData]
    uv_data: UVIndexData
    location_context: str
    supply_chain_impact: str
    recommendations: List[str]
```

## Error Handling

### API Error Handling
- **Weather API Failures**: Graceful degradation to available weather source
- **UV API Failures**: Clear error messaging with fallback recommendations
- **Neptune Connection Issues**: Informative error messages with troubleshooting guidance

### Data Validation
- **Location Validation**: Coordinate and location format validation
- **API Response Validation**: Schema validation for external API responses
- **Tool Integration**: Error propagation and handling between tools

### Fallback Strategies
- **Single Weather Source**: Continue operation if one weather source fails
- **Cached Data**: Use recent data when APIs are temporarily unavailable
- **Graceful Degradation**: Provide partial functionality when tools are unavailable

## Testing Strategy

### Unit Tests
- **Tool Functions**: Individual testing of each weather and UV tool
- **Data Aggregation**: Testing of weather data combination logic
- **Error Handling**: Testing of various failure scenarios

### Integration Tests
- **API Integration**: Live testing of NWS and UV index APIs
- **Neptune Integration**: Testing of graph database query functionality
- **Agent Integration**: End-to-end testing of agent responses

### Mock Testing
- **API Mocking**: Mock external API responses for consistent testing
- **Neptune Mocking**: Mock graph database responses for unit tests
- **Error Simulation**: Mock various error conditions

### Test Data
- **Sample Locations**: Predefined test coordinates and locations
- **Expected Responses**: Known good responses for validation
- **Error Scenarios**: Predefined error conditions for testing

## Implementation Phases

### Phase 1: Weather Tools Module
1. Create dedicated weather_tools.py module
2. Convert existing weather agent to openmeteo_weather_tool function
3. Implement NWS weather API tool
4. Implement UV index tool
5. Create weather data aggregation functionality

### Phase 2: Core Agent Structure
1. Create supply chain assistant agent file
2. Implement basic system prompt and agent structure
3. Import weather tools from weather_tools module
4. Add to supervisor agent routing logic

### Phase 3: Neptune Integration
1. Add Neptune tools to Supply Chain Assistant
2. Implement supply chain specific graph queries
3. Create network analysis capabilities

### Phase 4: Testing and Validation
1. Implement comprehensive test suite for weather_tools module
2. Validate API integrations (NWS and UV index)
3. Test Supply Chain Assistant integration
4. Performance testing and optimization

## Security Considerations

### API Security
- **Rate Limiting**: Implement appropriate rate limiting for external APIs
- **Input Validation**: Validate all location and coordinate inputs
- **Error Information**: Avoid exposing sensitive error details

### Neptune Security
- **Access Control**: Leverage existing Neptune IAM security
- **Query Validation**: Validate Cypher queries for safety
- **Data Protection**: Ensure sensitive supply chain data protection

## Performance Considerations

### API Performance
- **Caching**: Implement appropriate caching for weather and UV data
- **Parallel Requests**: Make concurrent API calls where possible
- **Timeout Handling**: Implement reasonable timeouts for external APIs

### Neptune Performance
- **Query Optimization**: Leverage existing Neptune query optimization
- **Connection Pooling**: Use existing Neptune connection management
- **Result Caching**: Cache frequently accessed graph data

## Monitoring and Observability

### Metrics
- **API Response Times**: Monitor external API performance
- **Error Rates**: Track API and tool failure rates
- **Usage Patterns**: Monitor tool usage and query patterns

### Logging
- **Tool Execution**: Log tool calls and responses
- **Error Tracking**: Detailed error logging for troubleshooting
- **Performance Metrics**: Log response times and resource usage

### Tracing
- **OpenTelemetry Integration**: Leverage existing tracing infrastructure
- **Tool Tracing**: Trace individual tool executions
- **End-to-End Tracing**: Full request tracing through the agent system