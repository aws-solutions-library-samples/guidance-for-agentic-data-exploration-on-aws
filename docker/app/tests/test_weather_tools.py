"""
Test Weather Tools Module

This module provides comprehensive unit tests for the weather_tools module,
including tests for OpenMeteo, NWS, UV index tools, and weather data aggregation.
All external API calls are mocked for consistent testing.
"""

import pytest
import json
import sys
import os
from unittest.mock import patch, MagicMock

# Add parent directory to path to import modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from agents.weather_tools import (
    openmeteo_weather_tool,
    nws_weather_tool,
    uv_index_tool,
    aggregate_weather_data,
    _get_coordinates_for_location,
    _format_openmeteo_response,
    _format_nws_response,
    _format_uv_response,
    _interpret_weather_code,
    _get_uv_recommendations,
    _validate_coordinates,
    _validate_us_coordinates,
    _generate_weather_analysis
)


class TestOpenMeteoWeatherTool:
    """Test suite for OpenMeteo weather tool."""
    
    @patch('agents.weather_tools.requests.get')
    def test_openmeteo_successful_request(self, mock_get):
        """Test successful OpenMeteo API request."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "current": {
                "temperature_2m": 22.5,
                "apparent_temperature": 24.0,
                "relative_humidity_2m": 65,
                "wind_speed_10m": 15.2,
                "precipitation": 0.0,
                "weather_code": 1
            },
            "daily": {
                "time": ["2024-01-01", "2024-01-02", "2024-01-03"],
                "temperature_2m_max": [25.0, 23.0, 21.0],
                "temperature_2m_min": [15.0, 13.0, 11.0],
                "precipitation_sum": [0.0, 2.5, 0.0],
                "weather_code": [1, 61, 0]
            }
        }
        mock_get.return_value = mock_response
        
        result = openmeteo_weather_tool("weather in New York")
        
        assert "Current Weather for new york" in result
        assert "22.5°C" in result
        assert "72.5°F" in result
        assert "Mainly clear" in result
        assert "7-Day Forecast" in result
        assert "Data provided by OpenMeteo API" in result
    
    @patch('agents.weather_tools.requests.get')
    def test_openmeteo_api_error(self, mock_get):
        """Test OpenMeteo API error handling."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_get.return_value = mock_response
        
        result = openmeteo_weather_tool("weather in New York")
        
        assert "Unable to retrieve weather data from OpenMeteo API" in result
        assert "Status: 500" in result
    
    @patch('agents.weather_tools.requests.get')
    def test_openmeteo_json_decode_error(self, mock_get):
        """Test OpenMeteo JSON decode error handling."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = json.JSONDecodeError("Invalid JSON", "", 0)
        mock_get.return_value = mock_response
        
        result = openmeteo_weather_tool("weather in New York")
        
        assert "Error parsing weather data from OpenMeteo API" in result
    
    @patch('agents.weather_tools.requests.get')
    def test_openmeteo_network_exception(self, mock_get):
        """Test OpenMeteo network exception handling."""
        mock_get.side_effect = Exception("Network error")
        
        result = openmeteo_weather_tool("weather in New York")
        
        assert "Error retrieving weather information" in result
        assert "Network error" in result
    
    def test_openmeteo_invalid_location(self):
        """Test OpenMeteo with invalid location."""
        result = openmeteo_weather_tool("weather in InvalidCity123")
        
        assert "couldn't find coordinates" in result
        assert "invalidcity123" in result  # Location is converted to lowercase
    
    @patch('agents.weather_tools.requests.get')
    def test_openmeteo_coordinate_query(self, mock_get):
        """Test OpenMeteo with coordinate-based query."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "current": {
                "temperature_2m": 20.0,
                "weather_code": 0
            },
            "daily": {
                "time": ["2024-01-01"],
                "temperature_2m_max": [22.0],
                "temperature_2m_min": [18.0],
                "precipitation_sum": [0.0],
                "weather_code": [0]
            }
        }
        mock_get.return_value = mock_response
        
        # Use a query format without prepositions to avoid regex truncation
        result = openmeteo_weather_tool("40.7128, -74.0060")
        
        assert "Current Weather" in result
        assert "20.0°C" in result


class TestNWSWeatherTool:
    """Test suite for NWS weather tool."""
    
    @patch('agents.weather_tools.requests.get')
    def test_nws_successful_request(self, mock_get):
        """Test successful NWS API request."""
        mock_points_response = MagicMock()
        mock_points_response.status_code = 200
        mock_points_response.json.return_value = {
            "properties": {
                "forecast": "https://api.weather.gov/gridpoints/TOP/31,80/forecast"
            }
        }
        
        mock_forecast_response = MagicMock()
        mock_forecast_response.status_code = 200
        mock_forecast_response.json.return_value = {
            "properties": {
                "periods": [
                    {
                        "name": "Today",
                        "temperature": 75,
                        "temperatureUnit": "F",
                        "windSpeed": "10 mph",
                        "windDirection": "SW",
                        "shortForecast": "Partly Cloudy",
                        "detailedForecast": "Partly cloudy with a high near 75."
                    },
                    {
                        "name": "Tonight",
                        "temperature": 55,
                        "temperatureUnit": "F",
                        "shortForecast": "Clear"
                    }
                ]
            }
        }
        
        mock_get.side_effect = [mock_points_response, mock_forecast_response]
        
        result = nws_weather_tool("New York")
        
        assert "National Weather Service Forecast" in result
        assert "75°F" in result
        assert "Partly Cloudy" in result
        assert "Today" in result
        assert "Tonight" in result
        assert "Official forecast from the National Weather Service" in result
    
    @patch('agents.weather_tools.requests.get')
    def test_nws_points_api_error(self, mock_get):
        """Test NWS points API error handling."""
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response
        
        result = nws_weather_tool("New York")
        
        assert "Unable to retrieve grid information" in result
        assert "Status: 404" in result
    
    @patch('agents.weather_tools.requests.get')
    def test_nws_forecast_api_error(self, mock_get):
        """Test NWS forecast API error handling."""
        mock_points_response = MagicMock()
        mock_points_response.status_code = 200
        mock_points_response.json.return_value = {
            "properties": {
                "forecast": "https://api.weather.gov/gridpoints/TOP/31,80/forecast"
            }
        }
        
        mock_forecast_response = MagicMock()
        mock_forecast_response.status_code = 500
        
        mock_get.side_effect = [mock_points_response, mock_forecast_response]
        
        result = nws_weather_tool("New York")
        
        assert "Unable to retrieve forecast" in result
        assert "Status: 500" in result
    
    def test_nws_invalid_location(self):
        """Test NWS with invalid location."""
        result = nws_weather_tool("InvalidCity123")
        
        assert "couldn't find coordinates" in result
        assert "InvalidCity123" in result


class TestUVIndexTool:
    """Test suite for UV index tool."""
    
    @patch('agents.weather_tools.requests.get')
    def test_uv_index_successful_request(self, mock_get):
        """Test successful UV index API request."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "now": {
                "uvi": 7.5,
                "time": "2024-01-01T12:00:00Z"
            }
        }
        mock_get.return_value = mock_response
        
        result = uv_index_tool("New York")
        
        assert "UV Index Information" in result
        assert "7.5" in result
        assert "High" in result
        assert "Safety Recommendations" in result
        assert "Protection against sun damage is needed" in result
    
    @patch('agents.weather_tools.requests.get')
    def test_uv_index_api_error(self, mock_get):
        """Test UV index API error handling."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_get.return_value = mock_response
        
        result = uv_index_tool("New York")
        
        assert "Unable to retrieve UV index data" in result
        assert "Status: 500" in result
    
    @patch('agents.weather_tools.requests.get')
    def test_uv_index_json_decode_error(self, mock_get):
        """Test UV index JSON decode error handling."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = json.JSONDecodeError("Invalid JSON", "", 0)
        mock_get.return_value = mock_response
        
        result = uv_index_tool("New York")
        
        assert "Error parsing UV index data" in result
    
    def test_uv_index_invalid_coordinates(self):
        """Test UV index with invalid coordinates."""
        result = uv_index_tool("91.0, 181.0")  # Invalid lat/lon
        
        assert "Invalid coordinates" in result
        assert "latitude must be between -90 and 90" in result
    
    def test_uv_index_invalid_location(self):
        """Test UV index with invalid location."""
        result = uv_index_tool("InvalidCity123")
        
        assert "couldn't find coordinates" in result
        assert "InvalidCity123" in result


class TestAggregateWeatherData:
    """Test suite for weather data aggregation."""
    
    @patch('agents.weather_tools.openmeteo_weather_tool')
    @patch('agents.weather_tools.nws_weather_tool')
    @patch('agents.weather_tools.uv_index_tool')
    def test_aggregate_all_sources_available(self, mock_uv, mock_nws, mock_openmeteo):
        """Test weather aggregation when all sources are available."""
        mock_openmeteo.return_value = "OpenMeteo weather data"
        mock_nws.return_value = "NWS weather data"
        mock_uv.return_value = "UV index data"
        
        result = aggregate_weather_data("New York")
        
        assert "Comprehensive Weather Report" in result
        assert "OpenMeteo, National Weather Service, UV Index" in result
        assert "OpenMeteo weather data" in result
        assert "NWS weather data" in result
        assert "UV index data" in result
        assert "Weather Data Analysis" in result
    
    @patch('agents.weather_tools.openmeteo_weather_tool')
    @patch('agents.weather_tools.nws_weather_tool')
    @patch('agents.weather_tools.uv_index_tool')
    def test_aggregate_partial_sources_available(self, mock_uv, mock_nws, mock_openmeteo):
        """Test weather aggregation when only some sources are available."""
        mock_openmeteo.return_value = "OpenMeteo weather data"
        mock_nws.return_value = "Error: NWS unavailable"
        mock_uv.return_value = "UV index data"
        
        result = aggregate_weather_data("New York")
        
        assert "Comprehensive Weather Report" in result
        assert "OpenMeteo, UV Index" in result
        assert "OpenMeteo weather data" in result
        assert "UV index data" in result
        assert "NWS unavailable" not in result  # Error messages should be filtered out
    
    @patch('agents.weather_tools.openmeteo_weather_tool')
    @patch('agents.weather_tools.nws_weather_tool')
    @patch('agents.weather_tools.uv_index_tool')
    def test_aggregate_no_sources_available(self, mock_uv, mock_nws, mock_openmeteo):
        """Test weather aggregation when no sources are available."""
        mock_openmeteo.return_value = "Error: OpenMeteo unavailable"
        mock_nws.return_value = "Error: NWS unavailable"
        mock_uv.return_value = "Error: UV unavailable"
        
        result = aggregate_weather_data("InvalidLocation")
        
        assert "Unable to retrieve weather data" in result
        assert "from any source" in result


class TestHelperFunctions:
    """Test suite for helper functions."""
    
    def test_get_coordinates_for_major_cities(self):
        """Test coordinate lookup for major cities."""
        coords = _get_coordinates_for_location("New York")
        assert coords == (40.7128, -74.0060)
        
        coords = _get_coordinates_for_location("Los Angeles")
        assert coords == (34.0522, -118.2437)
        
        coords = _get_coordinates_for_location("chicago")  # Case insensitive
        assert coords == (41.8781, -87.6298)
    
    def test_get_coordinates_from_string(self):
        """Test parsing coordinates from string."""
        coords = _get_coordinates_for_location("40.7128, -74.0060")
        assert coords == (40.7128, -74.0060)
        
        coords = _get_coordinates_for_location("40.7128,-74.0060")
        assert coords == (40.7128, -74.0060)
    
    def test_get_coordinates_invalid_location(self):
        """Test handling of invalid locations."""
        coords = _get_coordinates_for_location("InvalidCity123")
        assert coords is None
    
    def test_validate_coordinates(self):
        """Test coordinate validation."""
        assert _validate_coordinates(40.7128, -74.0060) == True
        assert _validate_coordinates(0, 0) == True
        assert _validate_coordinates(90, 180) == True
        assert _validate_coordinates(-90, -180) == True
        
        assert _validate_coordinates(91, 0) == False
        assert _validate_coordinates(0, 181) == False
        assert _validate_coordinates(-91, 0) == False
        assert _validate_coordinates(0, -181) == False
    
    def test_validate_us_coordinates(self):
        """Test US coordinate validation."""
        # Continental US
        assert _validate_us_coordinates(40.7128, -74.0060) == True  # New York
        assert _validate_us_coordinates(34.0522, -118.2437) == True  # Los Angeles
        
        # Alaska
        assert _validate_us_coordinates(64.2008, -149.4937) == True
        
        # Hawaii
        assert _validate_us_coordinates(21.3099, -157.8581) == True
        
        # Outside US
        assert _validate_us_coordinates(51.5074, -0.1278) == False  # London
        assert _validate_us_coordinates(-33.8688, 151.2093) == False  # Sydney
    
    def test_interpret_weather_code(self):
        """Test weather code interpretation."""
        assert _interpret_weather_code(0) == "Clear sky"
        assert _interpret_weather_code(1) == "Mainly clear"
        assert _interpret_weather_code(61) == "Slight rain"
        assert _interpret_weather_code(95) == "Thunderstorm"
        assert _interpret_weather_code(999) == "Unknown weather condition (code: 999)"
    
    def test_get_uv_recommendations(self):
        """Test UV recommendation generation."""
        risk, recs = _get_uv_recommendations(2.0)
        assert risk == "Low"
        assert "Minimal sun protection" in recs[0]
        
        risk, recs = _get_uv_recommendations(5.0)
        assert risk == "Moderate"
        assert "Take precautions" in recs[0]
        
        risk, recs = _get_uv_recommendations(7.0)
        assert risk == "High"
        assert "Protection against sun damage" in recs[0]
        
        risk, recs = _get_uv_recommendations(9.0)
        assert risk == "Very High"
        assert "Extra precautions" in recs[0]
        
        risk, recs = _get_uv_recommendations(12.0)
        assert risk == "Extreme"
        assert "Take all precautions" in recs[0]


class TestFormatFunctions:
    """Test suite for formatting functions."""
    
    def test_format_openmeteo_response(self):
        """Test OpenMeteo response formatting."""
        weather_data = {
            "current": {
                "temperature_2m": 22.5,
                "apparent_temperature": 24.0,
                "relative_humidity_2m": 65,
                "wind_speed_10m": 15.2,
                "weather_code": 1
            },
            "daily": {
                "time": ["2024-01-01", "2024-01-02"],
                "temperature_2m_max": [25.0, 23.0],
                "temperature_2m_min": [15.0, 13.0],
                "precipitation_sum": [0.0, 2.5],
                "weather_code": [1, 61]
            }
        }
        
        result = _format_openmeteo_response(weather_data, "New York")
        
        assert "Current Weather for New York" in result
        assert "22.5°C" in result
        assert "72.5°F" in result
        assert "Mainly clear" in result
        assert "7-Day Forecast" in result
        assert "2024-01-01" in result
    
    def test_format_nws_response(self):
        """Test NWS response formatting."""
        forecast_data = {
            "properties": {
                "periods": [
                    {
                        "name": "Today",
                        "temperature": 75,
                        "temperatureUnit": "F",
                        "windSpeed": "10 mph",
                        "windDirection": "SW",
                        "shortForecast": "Partly Cloudy",
                        "detailedForecast": "Partly cloudy with a high near 75."
                    }
                ]
            }
        }
        
        result = _format_nws_response(forecast_data, "New York", 40.7128, -74.0060)
        
        assert "National Weather Service Forecast" in result
        assert "75°F" in result
        assert "Partly Cloudy" in result
        assert "Today" in result
        assert "40.7128, -74.006" in result
    
    def test_format_uv_response(self):
        """Test UV response formatting."""
        uv_data = {
            "now": {
                "uvi": 7.5,
                "time": "2024-01-01T12:00:00Z"
            }
        }
        
        result = _format_uv_response(uv_data, 40.7128, -74.0060)
        
        assert "UV Index Information" in result
        assert "7.5" in result
        assert "High" in result
        assert "Safety Recommendations" in result
        assert "2024-01-01T12:00:00Z" in result
    
    def test_generate_weather_analysis(self):
        """Test weather analysis generation."""
        results = [
            ("OpenMeteo", "OpenMeteo weather data"),
            ("NWS", "NWS weather data")
        ]
        sources_available = ["OpenMeteo", "National Weather Service", "UV Index"]
        
        result = _generate_weather_analysis(results, sources_available, "New York")
        
        assert "Weather Data Analysis" in result
        assert "Excellent - 3 sources available" in result
        assert "OpenMeteo" in result
        assert "National Weather Service" in result
        assert "UV Index" in result


class TestErrorHandling:
    """Test suite for error handling scenarios."""
    
    @patch('agents.weather_tools.requests.get')
    def test_openmeteo_timeout_error(self, mock_get):
        """Test OpenMeteo timeout error handling."""
        mock_get.side_effect = Exception("Timeout")
        
        result = openmeteo_weather_tool("weather in New York")
        
        assert "Error retrieving weather information" in result
        assert "Timeout" in result
    
    @patch('agents.weather_tools.requests.get')
    def test_nws_timeout_error(self, mock_get):
        """Test NWS timeout error handling."""
        mock_get.side_effect = Exception("Timeout")
        
        result = nws_weather_tool("New York")
        
        assert "Error retrieving NWS weather information" in result
        assert "Timeout" in result
    
    @patch('agents.weather_tools.requests.get')
    def test_uv_index_timeout_error(self, mock_get):
        """Test UV index timeout error handling."""
        mock_get.side_effect = Exception("Timeout")
        
        result = uv_index_tool("New York")
        
        assert "Error retrieving UV index information" in result
        assert "Timeout" in result
    
    def test_format_openmeteo_response_error(self):
        """Test OpenMeteo response formatting error handling."""
        # The function handles missing data gracefully, so we need to test actual error conditions
        # Test with data that would cause an exception in the formatting logic
        invalid_data = None
        
        result = _format_openmeteo_response(invalid_data, "New York")
        
        assert "Error formatting weather data" in result
    
    def test_format_nws_response_error(self):
        """Test NWS response formatting error handling."""
        # The function handles missing data gracefully, so we need to test actual error conditions
        # Test with data that would cause an exception in the formatting logic
        invalid_data = None
        
        result = _format_nws_response(invalid_data, "New York", 40.7128, -74.0060)
        
        assert "Error formatting NWS weather data" in result
    
    def test_format_uv_response_error(self):
        """Test UV response formatting error handling."""
        # The function handles missing data gracefully, so we need to test actual error conditions
        # Test with data that would cause an exception in the formatting logic
        invalid_data = None
        
        result = _format_uv_response(invalid_data, 40.7128, -74.0060)
        
        assert "Error formatting UV index data" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])