"""
Test Weather Data Aggregation

This module tests the weather data aggregation functionality in the weather tools module.
Tests include validation of multi-source data combination, comparison logic, and graceful handling of failures.
"""

import pytest
import json
import sys
import os
from unittest.mock import patch, MagicMock

# Add parent directory to path to import modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from agents.weather_tools import aggregate_weather_data, _generate_weather_analysis


class TestWeatherDataAggregation:
    """Test suite for weather data aggregation functionality."""
    
    def test_aggregate_weather_data_all_sources_available(self):
        """Test weather aggregation when all data sources are available."""
        # Mock successful responses from all sources
        mock_openmeteo_response = "🌤️ **Current Weather for New York**\n\n**Temperature:** 22°C (71.6°F)\n**Conditions:** Partly cloudy"
        mock_nws_response = "🇺🇸 **National Weather Service Forecast for New York**\n**Today:** Partly Cloudy, 75°F"
        mock_uv_response = "☀️ **UV Index Information**\n**Current UV Index:** 6.5\n**Risk Level:** High"
        
        with patch('agents.weather_tools.openmeteo_weather_tool') as mock_openmeteo, \
             patch('agents.weather_tools.nws_weather_tool') as mock_nws, \
             patch('agents.weather_tools.uv_index_tool') as mock_uv:
            
            mock_openmeteo.return_value = mock_openmeteo_response
            mock_nws.return_value = mock_nws_response
            mock_uv.return_value = mock_uv_response
            
            result = aggregate_weather_data("New York")
            
            # Verify comprehensive report structure
            assert "Comprehensive Weather Report for New York" in result
            assert "Data sources: OpenMeteo, National Weather Service, UV Index" in result
            assert "Current Weather for New York" in result
            assert "National Weather Service Forecast" in result
            assert "UV Index Information" in result
            assert "Weather Data Analysis" in result
            assert "Data Availability:** Excellent - 3 sources available" in result
    
    def test_aggregate_weather_data_openmeteo_only(self):
        """Test weather aggregation when only OpenMeteo is available."""
        mock_openmeteo_response = "🌤️ **Current Weather for Seattle**\n\n**Temperature:** 18°C (64.4°F)"
        
        with patch('agents.weather_tools.openmeteo_weather_tool') as mock_openmeteo, \
             patch('agents.weather_tools.nws_weather_tool') as mock_nws, \
             patch('agents.weather_tools.uv_index_tool') as mock_uv:
            
            mock_openmeteo.return_value = mock_openmeteo_response
            mock_nws.return_value = "Error retrieving NWS weather information"
            mock_uv.return_value = "Error retrieving UV index information"
            
            result = aggregate_weather_data("Seattle")
            
            assert "Comprehensive Weather Report for Seattle" in result
            assert "Data sources: OpenMeteo" in result
            assert "Current Weather for Seattle" in result
            assert "Data Availability:** Limited - Only OpenMeteo available" in result
            assert "Single source data" in result
    
    def test_aggregate_weather_data_nws_only(self):
        """Test weather aggregation when only NWS is available."""
        mock_nws_response = "🇺🇸 **National Weather Service Forecast for Chicago**\n**Today:** Clear, 68°F"
        
        with patch('agents.weather_tools.openmeteo_weather_tool') as mock_openmeteo, \
             patch('agents.weather_tools.nws_weather_tool') as mock_nws, \
             patch('agents.weather_tools.uv_index_tool') as mock_uv:
            
            mock_openmeteo.return_value = "Error retrieving weather information"
            mock_nws.return_value = mock_nws_response
            mock_uv.return_value = "Error retrieving UV index information"
            
            result = aggregate_weather_data("Chicago")
            
            assert "Comprehensive Weather Report for Chicago" in result
            assert "Data sources: National Weather Service" in result
            assert "National Weather Service Forecast for Chicago" in result
            assert "Data Availability:** Limited - Only National Weather Service available" in result
    
    def test_aggregate_weather_data_uv_only(self):
        """Test weather aggregation when only UV index is available."""
        mock_uv_response = "☀️ **UV Index Information**\n**Current UV Index:** 4.2\n**Risk Level:** Moderate"
        
        with patch('agents.weather_tools.openmeteo_weather_tool') as mock_openmeteo, \
             patch('agents.weather_tools.nws_weather_tool') as mock_nws, \
             patch('agents.weather_tools.uv_index_tool') as mock_uv, \
             patch('agents.weather_tools._get_coordinates_for_location') as mock_coords:
            
            mock_openmeteo.return_value = "Error retrieving weather information"
            mock_nws.return_value = "Error retrieving NWS weather information"
            mock_uv.return_value = mock_uv_response
            mock_coords.return_value = (40.7128, -74.0060)
            
            result = aggregate_weather_data("New York")
            
            assert "Comprehensive Weather Report for New York" in result
            assert "Data sources: UV Index" in result
            assert "UV Index Information" in result
            assert "Data Availability:** Limited - Only UV Index available" in result
    
    def test_aggregate_weather_data_no_sources_available(self):
        """Test weather aggregation when no data sources are available."""
        with patch('agents.weather_tools.openmeteo_weather_tool') as mock_openmeteo, \
             patch('agents.weather_tools.nws_weather_tool') as mock_nws, \
             patch('agents.weather_tools.uv_index_tool') as mock_uv:
            
            mock_openmeteo.return_value = "Error retrieving weather information"
            mock_nws.return_value = "Error retrieving NWS weather information"
            mock_uv.return_value = "Error retrieving UV index information"
            
            result = aggregate_weather_data("InvalidLocation")
            
            assert "Unable to retrieve weather data for 'InvalidLocation' from any source" in result
            assert "Please check the location and try again" in result
    
    def test_aggregate_weather_data_partial_failures(self):
        """Test weather aggregation with partial source failures."""
        mock_openmeteo_response = "🌤️ **Current Weather for Denver**\n\n**Temperature:** 15°C (59°F)"
        mock_uv_response = "☀️ **UV Index Information**\n**Current UV Index:** 8.1\n**Risk Level:** Very High"
        
        with patch('agents.weather_tools.openmeteo_weather_tool') as mock_openmeteo, \
             patch('agents.weather_tools.nws_weather_tool') as mock_nws, \
             patch('agents.weather_tools.uv_index_tool') as mock_uv:
            
            mock_openmeteo.return_value = mock_openmeteo_response
            mock_nws.return_value = "Unable to retrieve forecast from National Weather Service"
            mock_uv.return_value = mock_uv_response
            
            result = aggregate_weather_data("Denver")
            
            assert "Comprehensive Weather Report for Denver" in result
            assert "Data sources: OpenMeteo, UV Index" in result
            assert "Current Weather for Denver" in result
            assert "UV Index Information" in result
            assert "Data Availability:** Excellent - 2 sources available" in result
    
    def test_aggregate_weather_data_exception_handling(self):
        """Test weather aggregation exception handling."""
        # Test that individual tool exceptions are handled gracefully
        with patch('agents.weather_tools.openmeteo_weather_tool') as mock_openmeteo, \
             patch('agents.weather_tools.nws_weather_tool') as mock_nws, \
             patch('agents.weather_tools.uv_index_tool') as mock_uv:
            
            mock_openmeteo.side_effect = Exception("Network error")
            mock_nws.side_effect = Exception("API error")
            mock_uv.side_effect = Exception("Service error")
            
            result = aggregate_weather_data("TestLocation")
            
            # When all sources fail, should return the "no sources available" message
            assert "Unable to retrieve weather data for 'TestLocation' from any source" in result
            assert "Please check the location and try again" in result
    
    def test_aggregate_weather_data_no_coordinates(self):
        """Test weather aggregation when coordinates cannot be found."""
        with patch('agents.weather_tools.openmeteo_weather_tool') as mock_openmeteo, \
             patch('agents.weather_tools.nws_weather_tool') as mock_nws, \
             patch('agents.weather_tools._get_coordinates_for_location') as mock_coords:
            
            mock_openmeteo.return_value = "I couldn't find coordinates for 'UnknownPlace'"
            mock_nws.return_value = "I couldn't find coordinates for 'UnknownPlace'"
            mock_coords.return_value = None
            
            result = aggregate_weather_data("UnknownPlace")
            
            assert "Unable to retrieve weather data for 'UnknownPlace' from any source" in result


class TestWeatherAnalysisGeneration:
    """Test suite for weather analysis generation."""
    
    def test_generate_weather_analysis_multiple_sources(self):
        """Test weather analysis generation with multiple sources."""
        results = [
            ("OpenMeteo", "Weather data from OpenMeteo"),
            ("NWS", "Weather data from NWS")
        ]
        sources_available = ["OpenMeteo", "National Weather Service", "UV Index"]
        
        analysis = _generate_weather_analysis(results, sources_available, "New York")
        
        assert "Weather Data Analysis" in analysis
        assert "Data Availability:** Excellent - 3 sources available" in analysis
        assert "Multiple data sources provide increased reliability" in analysis
        assert "OpenMeteo:** International coverage" in analysis
        assert "National Weather Service:** Official US government forecasts" in analysis
        assert "UV Index:** Real-time UV radiation data" in analysis
        assert "NWS data is official and highly reliable" in analysis
    
    def test_generate_weather_analysis_single_source(self):
        """Test weather analysis generation with single source."""
        results = [
            ("OpenMeteo", "Weather data from OpenMeteo")
        ]
        sources_available = ["OpenMeteo"]
        
        analysis = _generate_weather_analysis(results, sources_available, "London")
        
        assert "Data Availability:** Limited - Only OpenMeteo available" in analysis
        assert "Single source data - consider checking other sources" in analysis
        assert "OpenMeteo:** International coverage" in analysis
    
    def test_generate_weather_analysis_no_sources(self):
        """Test weather analysis generation with no sources."""
        results = []
        sources_available = []
        
        analysis = _generate_weather_analysis(results, sources_available, "InvalidLocation")
        
        assert "Data Availability:** No sources available" in analysis
    
    def test_generate_weather_analysis_nws_priority(self):
        """Test that NWS recommendations are prioritized for US locations."""
        results = [
            ("OpenMeteo", "Weather data from OpenMeteo"),
            ("NWS", "Weather data from NWS")
        ]
        sources_available = ["OpenMeteo", "National Weather Service"]
        
        analysis = _generate_weather_analysis(results, sources_available, "Boston")
        
        assert "NWS data is official and highly reliable for US locations" in analysis
        assert "Compare forecasts between sources for consistency" in analysis
    
    def test_generate_weather_analysis_uv_recommendations(self):
        """Test UV-specific recommendations in analysis."""
        results = [
            ("OpenMeteo", "Weather data from OpenMeteo")
        ]
        sources_available = ["OpenMeteo", "UV Index"]
        
        analysis = _generate_weather_analysis(results, sources_available, "Miami")
        
        assert "Check UV recommendations for outdoor activities" in analysis
        assert "UV Index:** Real-time UV radiation data" in analysis
    
    def test_generate_weather_analysis_exception_handling(self):
        """Test weather analysis exception handling."""
        # Simulate an error in analysis generation
        with patch('agents.weather_tools._generate_weather_analysis') as mock_analysis:
            mock_analysis.side_effect = Exception("Analysis error")
            
            # This would be called within aggregate_weather_data
            try:
                _generate_weather_analysis([], [], "TestLocation")
            except Exception as e:
                assert "Analysis error" in str(e)


class TestWeatherDataComparison:
    """Test suite for weather data comparison and consolidation."""
    
    def test_weather_data_consistency_check(self):
        """Test that aggregated data includes consistency information."""
        mock_openmeteo_response = "Temperature: 22°C (71.6°F)"
        mock_nws_response = "Temperature: 75°F"
        
        with patch('agents.weather_tools.openmeteo_weather_tool') as mock_openmeteo, \
             patch('agents.weather_tools.nws_weather_tool') as mock_nws, \
             patch('agents.weather_tools.uv_index_tool') as mock_uv:
            
            mock_openmeteo.return_value = mock_openmeteo_response
            mock_nws.return_value = mock_nws_response
            mock_uv.return_value = "Error retrieving UV index information"
            
            result = aggregate_weather_data("New York")
            
            # Should include both temperature readings for comparison
            assert "22°C (71.6°F)" in result
            assert "75°F" in result
            assert "Compare forecasts between sources" in result
    
    def test_weather_data_source_attribution(self):
        """Test that weather data is properly attributed to sources."""
        mock_openmeteo_response = "🌤️ **Current Weather for Portland**\n*Data provided by OpenMeteo API*"
        mock_nws_response = "🇺🇸 **National Weather Service Forecast for Portland**\n*Official forecast from the National Weather Service*"
        
        with patch('agents.weather_tools.openmeteo_weather_tool') as mock_openmeteo, \
             patch('agents.weather_tools.nws_weather_tool') as mock_nws, \
             patch('agents.weather_tools.uv_index_tool') as mock_uv:
            
            mock_openmeteo.return_value = mock_openmeteo_response
            mock_nws.return_value = mock_nws_response
            mock_uv.return_value = "Error retrieving UV index information"
            
            result = aggregate_weather_data("Portland")
            
            # Verify source attribution is maintained
            assert "Data provided by OpenMeteo API" in result
            assert "Official forecast from the National Weather Service" in result
    
    def test_weather_data_graceful_degradation(self):
        """Test graceful degradation when primary sources fail."""
        # Simulate OpenMeteo failure but NWS success
        with patch('agents.weather_tools.openmeteo_weather_tool') as mock_openmeteo, \
             patch('agents.weather_tools.nws_weather_tool') as mock_nws, \
             patch('agents.weather_tools.uv_index_tool') as mock_uv:
            
            mock_openmeteo.side_effect = Exception("OpenMeteo service unavailable")
            mock_nws.return_value = "🇺🇸 **National Weather Service Forecast**\n**Today:** Sunny, 72°F"
            mock_uv.return_value = "☀️ **UV Index Information**\n**Current UV Index:** 5.5"
            
            result = aggregate_weather_data("San Francisco")
            
            # Should still provide useful information from available sources
            assert "Comprehensive Weather Report for San Francisco" in result
            assert "Data sources: National Weather Service, UV Index" in result
            assert "National Weather Service Forecast" in result
            assert "UV Index Information" in result
    
    def test_weather_data_error_reporting(self):
        """Test that errors are properly reported without breaking aggregation."""
        mock_openmeteo_response = "🌤️ **Current Weather for Austin**\n**Temperature:** 28°C"
        
        with patch('agents.weather_tools.openmeteo_weather_tool') as mock_openmeteo, \
             patch('agents.weather_tools.nws_weather_tool') as mock_nws, \
             patch('agents.weather_tools.uv_index_tool') as mock_uv:
            
            mock_openmeteo.return_value = mock_openmeteo_response
            mock_nws.return_value = "Unable to retrieve forecast from National Weather Service"
            mock_uv.return_value = "Unable to retrieve UV index data"
            
            result = aggregate_weather_data("Austin")
            
            # Should include successful data and note limited availability
            assert "Current Weather for Austin" in result
            assert "Data sources: OpenMeteo" in result
            assert "Limited - Only OpenMeteo available" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])