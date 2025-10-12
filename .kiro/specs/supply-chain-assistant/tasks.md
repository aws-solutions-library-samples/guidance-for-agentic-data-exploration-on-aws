# Implementation Plan

- [x] 1. Create reusable weather tools module

  - Create `docker/app/agents/weather_tools.py` with all weather-related tools
  - Implement modular design for reuse across multiple agents
  - _Requirements: 1.1, 3.1, 3.2, 4.1, 4.2, 4.3_

- [x] 1.1 Convert existing weather agent to OpenMeteo weather tool

  - Extract weather agent functionality into `openmeteo_weather_tool` function
  - Maintain existing weather capabilities as a reusable tool
  - Use `strands_tools.http_request` for API calls
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 1.2 Implement NWS weather API tool

  - Create `nws_weather_tool` function using National Weather Service API
  - Implement two-step API flow: points endpoint then forecast endpoint
  - Handle coordinate and location input validation
  - Format NWS weather data for consistent output
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 1.3 Implement UV index tool

  - Create `uv_index_tool` function using currentuvindex.com API
  - Accept latitude/longitude parameters
  - Return real-time UV index with safety recommendations
  - Handle API errors gracefully
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 1.4 Create weather data aggregation functionality

  - Implement `aggregate_weather_data` function
  - Combine data from both OpenMeteo and NWS sources
  - Provide unified weather analysis and comparison
  - Handle cases where one source fails
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 1.5 Write unit tests for weather tools module

  - Test each weather tool function individually
  - Mock external API calls for consistent testing
  - Test error handling and edge cases
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 2. Create Supply Chain Assistant agent

  - Implement main supply chain assistant with manufacturing expertise
  - Import weather tools from weather_tools module
  - Integrate Neptune graph database tools
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [x] 2.1 Implement Supply Chain Assistant system prompt and structure

  - Create comprehensive system prompt covering all supply chain expertise areas
  - Define agent structure following existing patterns
  - Import weather tools and Neptune tools
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2.2 Add Neptune graph database integration

  - Import `neptune_cypher_query` and `neptune_database_statistics` tools
  - Enable complex supply chain network analysis capabilities
  - Provide graph-based relationship mapping for supply chains
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2.3 Implement supply chain tool integration

  - Combine weather tools, UV index, and Neptune tools in agent
  - Create unified supply chain context using environmental data
  - Enable comprehensive supply chain decision support
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 4.1_

- [x] 2.4 Write unit tests for Supply Chain Assistant

  - Test agent initialization and tool integration
  - Test supply chain expertise responses
  - Test weather and environmental data integration
  - _Requirements: 7.1, 7.4, 7.5_

- [x] 3. Update supervisor agent routing

  - Modify supervisor agent to route queries to Supply Chain Assistant
  - Remove standalone weather agent routing
  - Update routing logic for supply chain and weather queries
  - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.3_

- [x] 3.1 Update supervisor agent system prompt

  - Add Supply Chain Assistant to routing decision protocol
  - Route weather queries to Supply Chain Assistant instead of weather agent
  - Route supply chain queries to Supply Chain Assistant
  - _Requirements: 5.2, 5.3_

- [x] 3.2 Update supervisor agent tools list

  - Remove weather_assistant from supervisor tools
  - Add supply_chain_assistant to supervisor tools
  - Update imports to include Supply Chain Assistant
  - _Requirements: 5.1, 5.2, 6.1, 6.2_

- [x] 3.3 Remove standalone weather agent

  - Remove weather_assistant.py file or mark as deprecated
  - Update any remaining references to standalone weather agent
  - Ensure weather functionality is only available through Supply Chain Assistant
  - _Requirements: 5.1, 5.4_

- [x] 3.4 Write integration tests for supervisor routing

  - Test routing of weather queries to Supply Chain Assistant
  - Test routing of supply chain queries to Supply Chain Assistant
  - Verify standalone weather agent is no longer accessible
  - _Requirements: 7.1, 7.5_

- [x] 4. Validate API integrations and functionality

  - Test all external API integrations end-to-end
  - Validate weather data aggregation across sources
  - Test Neptune graph database connectivity
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 4.1 Test NWS API integration

  - Validate NWS points and forecast API calls
  - Test with various location formats and coordinates
  - Verify error handling for invalid locations
  - _Requirements: 3.1, 3.2, 3.4, 7.2_

- [x] 4.2 Test UV index API integration

  - Validate currentuvindex.com API calls
  - Test with various coordinate inputs
  - Verify UV index data parsing and recommendations
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.3_

- [x] 4.3 Test weather data aggregation

  - Validate combined weather data from multiple sources
  - Test comparison and consolidation logic
  - Verify graceful handling when one source fails
  - _Requirements: 3.1, 3.2, 3.3, 7.2_

- [x] 4.4 Test Neptune integration in Supply Chain Assistant

  - Validate Neptune Cypher query execution
  - Test supply chain network analysis queries
  - Verify graph database statistics access
  - _Requirements: 2.1, 2.2, 2.3, 7.4_

- [ ]\* 4.5 Create comprehensive test suite
  - Implement end-to-end integration tests
  - Test complete supply chain assistant workflows
  - Performance testing for API calls and data aggregation
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
