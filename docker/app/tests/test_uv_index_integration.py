"""
Test UV Index API Integration

This module tests the UV index API integration in the weather tools module.
Tests include validation of API calls, coordinate handling, and UV recommendations.
"""

import pytest
import json
import sys
import os
from unittest.mock import patch, MagicMock

# Add parent directory to path to import modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from agents.weather_tools import uv_index_tool, _validate_coordinates, _get_uv_recommendations


class TestUVIndexAPIIntegration:
    """Test suite for UV Index API integration."""
    
    def test_uv_index_api_with_valid_coordinates(self):
        """Test UV index API with valid coordinates."""
        mock_uv_response = {
            "now": {
                "uvi": 7.2,
                "time": "2024-01-15T14:30:00Z"
            }
        }
        
        with patch('agents.weather_tools.requests.get') as mock_http:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_uv_response
            mock_http.return_value = mock_response
            
            result = uv_index_tool(40.7128, -74.0060)
            
            # Verify the result contains expected information
            assert "UV Index Information" in result
            assert "7.2" in result
            assert "High" in result  # UV index 7.2 should be "High"
            assert "40.7128, -74.006" in result
            assert "Safety Recommendations" in result
    
    def test_uv_index_api_low_uv(self):
        """Test UV index API with low UV index."""
        mock_uv_response = {
            "now": {
                "uvi": 2.1,
                "time": "2024-01-15T10:00:00Z"
            }
        }
        
        with patch('agents.weather_tools.requests.get') as mock_http:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_uv_response
            mock_http.return_value = mock_response
            
            result = uv_index_tool(45.5152, -122.6784)  # Portland
            
            assert "2.1" in result
            assert "Low" in result
            assert "Minimal sun protection" in result
    
    def test_uv_index_api_moderate_uv(self):
        """Test UV index API with moderate UV index."""
        mock_uv_response = {
            "now": {
                "uvi": 4.5
            }
        }
        
        with patch('agents.weather_tools.requests.get') as mock_http:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_uv_response
            mock_http.return_value = mock_response
            
            result = uv_index_tool(34.0522, -118.2437)  # Los Angeles
            
            assert "4.5" in result
            assert "Moderate" in result
            assert "Take precautions" in result
    
    def test_uv_index_api_very_high_uv(self):
        """Test UV index API with very high UV index."""
        mock_uv_response = {
            "now": {
                "uvi": 9.8
            }
        }
        
        with patch('agents.weather_tools.requests.get') as mock_http:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_uv_response
            mock_http.return_value = mock_response
            
            result = uv_index_tool(25.7617, -80.1918)  # Miami
            
            assert "9.8" in result
            assert "Very High" in result
            assert "Extra precautions" in result
    
    def test_uv_index_api_extreme_uv(self):
        """Test UV index API with extreme UV index."""
        mock_uv_response = {
            "now": {
                "uvi": 12.5
            }
        }
        
        with patch('agents.weather_tools.requests.get') as mock_http:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_uv_response
            mock_http.return_value = mock_response
            
            result = uv_index_tool(-23.5505, -46.6333)  # São Paulo (for extreme UV testing)
            
            assert "12.5" in result
            assert "Extreme" in result
            assert "Take all precautions" in result
            assert "avoid sun exposure" in result
    
    def test_uv_index_api_invalid_coordinates(self):
        """Test UV index API with invalid coordinates."""
        # Test latitude out of range
        result = uv_index_tool(95.0, -74.0060)
        assert "Invalid coordinates" in result
        assert "latitude must be between -90 and 90" in result
        
        # Test longitude out of range
        result = uv_index_tool(40.7128, -185.0)
        assert "Invalid coordinates" in result
        assert "longitude between -180 and 180" in result
        
        # Test both out of range
        result = uv_index_tool(-95.0, 185.0)
        assert "Invalid coordinates" in result
    
    def test_uv_index_api_boundary_coordinates(self):
        """Test UV index API with boundary coordinates."""
        mock_uv_response = {
            "now": {
                "uvi": 3.0
            }
        }
        
        with patch('agents.weather_tools.requests.get') as mock_http:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_uv_response
            mock_http.return_value = mock_response
            
            # Test boundary values
            result = uv_index_tool(90.0, 180.0)
            assert "3.0" in result
            
            result = uv_index_tool(-90.0, -180.0)
            assert "3.0" in result
            
            result = uv_index_tool(0.0, 0.0)
            assert "3.0" in result
    
    def test_uv_index_api_failure(self):
        """Test UV index API when API call fails."""
        with patch('agents.weather_tools.requests.get') as mock_http:
            mock_response = MagicMock()
            mock_response.status_code = 500
            mock_http.return_value = mock_response
            
            result = uv_index_tool(40.7128, -74.0060)
            
            assert "Unable to retrieve UV index data" in result
            assert "service may be temporarily unavailable" in result
    
    def test_uv_index_api_invalid_response(self):
        """Test UV index API with invalid JSON response."""
        with patch('agents.weather_tools.requests.get') as mock_http:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.side_effect = json.JSONDecodeError("Invalid JSON", "", 0)
            mock_http.return_value = mock_response
            
            result = uv_index_tool(40.7128, -74.0060)
            
            assert "Error parsing UV index data" in result
    
    def test_uv_index_api_missing_uv_data(self):
        """Test UV index API with missing UV data in response."""
        mock_uv_response = {
            "now": {
                "time": "2024-01-15T14:30:00Z"
                # Missing 'uvi' field
            }
        }
        
        with patch('agents.weather_tools.requests.get') as mock_http:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_uv_response
            mock_http.return_value = mock_response
            
            result = uv_index_tool(40.7128, -74.0060)
            
            assert "UV index data is not available" in result
    
    def test_uv_index_api_empty_response(self):
        """Test UV index API with empty response."""
        mock_uv_response = {}
        
        with patch('agents.weather_tools.requests.get') as mock_http:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_uv_response
            mock_http.return_value = mock_response
            
            result = uv_index_tool(40.7128, -74.0060)
            
            assert "UV index data is not available" in result
    
    def test_uv_index_api_exception_handling(self):
        """Test UV index API exception handling."""
        with patch('agents.weather_tools.requests.get') as mock_http:
            mock_http.side_effect = Exception("Network error")
            
            result = uv_index_tool(40.7128, -74.0060)
            
            assert "Error retrieving UV index information" in result
            assert "Network error" in result


class TestUVRecommendations:
    """Test suite for UV index recommendations."""
    
    def test_uv_recommendations_low(self):
        """Test UV recommendations for low UV index."""
        risk_level, recommendations = _get_uv_recommendations(2.0)
        
        assert risk_level == "Low"
        assert len(recommendations) >= 3
        assert any("Minimal sun protection" in rec for rec in recommendations)
        assert any("sunglasses" in rec for rec in recommendations)
    
    def test_uv_recommendations_moderate(self):
        """Test UV recommendations for moderate UV index."""
        risk_level, recommendations = _get_uv_recommendations(4.0)
        
        assert risk_level == "Moderate"
        assert len(recommendations) >= 4
        assert any("Take precautions" in rec for rec in recommendations)
        assert any("shade" in rec for rec in recommendations)
        assert any("SPF 30+" in rec for rec in recommendations)
    
    def test_uv_recommendations_high(self):
        """Test UV recommendations for high UV index."""
        risk_level, recommendations = _get_uv_recommendations(7.0)
        
        assert risk_level == "High"
        assert len(recommendations) >= 5
        assert any("Protection against sun damage" in rec for rec in recommendations)
        assert any("10 a.m. and 4 p.m." in rec for rec in recommendations)
        assert any("wide-brimmed hat" in rec for rec in recommendations)
    
    def test_uv_recommendations_very_high(self):
        """Test UV recommendations for very high UV index."""
        risk_level, recommendations = _get_uv_recommendations(9.0)
        
        assert risk_level == "Very High"
        assert len(recommendations) >= 5
        assert any("Extra precautions" in rec for rec in recommendations)
        assert any("Minimize sun exposure" in rec for rec in recommendations)
        assert any("burn quickly" in rec for rec in recommendations)
    
    def test_uv_recommendations_extreme(self):
        """Test UV recommendations for extreme UV index."""
        risk_level, recommendations = _get_uv_recommendations(12.0)
        
        assert risk_level == "Extreme"
        assert len(recommendations) >= 6
        assert any("Take all precautions" in rec for rec in recommendations)
        assert any("avoid sun exposure" in rec for rec in recommendations)
        assert any("burn in minutes" in rec for rec in recommendations)
        assert any("staying indoors" in rec for rec in recommendations)
    
    def test_uv_recommendations_boundary_values(self):
        """Test UV recommendations at boundary values."""
        # Test exact boundary values
        risk_level, _ = _get_uv_recommendations(3.0)
        assert risk_level == "Moderate"
        
        risk_level, _ = _get_uv_recommendations(2.9)
        assert risk_level == "Low"
        
        risk_level, _ = _get_uv_recommendations(6.0)
        assert risk_level == "High"
        
        risk_level, _ = _get_uv_recommendations(5.9)
        assert risk_level == "Moderate"
        
        risk_level, _ = _get_uv_recommendations(8.0)
        assert risk_level == "Very High"
        
        risk_level, _ = _get_uv_recommendations(7.9)
        assert risk_level == "High"
        
        risk_level, _ = _get_uv_recommendations(11.0)
        assert risk_level == "Extreme"
        
        risk_level, _ = _get_uv_recommendations(10.9)
        assert risk_level == "Very High"
    
    def test_uv_recommendations_zero_and_negative(self):
        """Test UV recommendations for zero and negative values."""
        risk_level, recommendations = _get_uv_recommendations(0.0)
        assert risk_level == "Low"
        
        # Negative values should still return Low (edge case)
        risk_level, recommendations = _get_uv_recommendations(-1.0)
        assert risk_level == "Low"


class TestCoordinateValidation:
    """Test suite for coordinate validation."""
    
    def test_validate_coordinates_valid(self):
        """Test coordinate validation with valid coordinates."""
        assert _validate_coordinates(40.7128, -74.0060) == True
        assert _validate_coordinates(0.0, 0.0) == True
        assert _validate_coordinates(90.0, 180.0) == True
        assert _validate_coordinates(-90.0, -180.0) == True
        assert _validate_coordinates(45.5, -122.7) == True
    
    def test_validate_coordinates_invalid_latitude(self):
        """Test coordinate validation with invalid latitude."""
        assert _validate_coordinates(91.0, -74.0060) == False
        assert _validate_coordinates(-91.0, -74.0060) == False
        assert _validate_coordinates(100.0, 0.0) == False
        assert _validate_coordinates(-100.0, 0.0) == False
    
    def test_validate_coordinates_invalid_longitude(self):
        """Test coordinate validation with invalid longitude."""
        assert _validate_coordinates(40.7128, 181.0) == False
        assert _validate_coordinates(40.7128, -181.0) == False
        assert _validate_coordinates(0.0, 200.0) == False
        assert _validate_coordinates(0.0, -200.0) == False
    
    def test_validate_coordinates_both_invalid(self):
        """Test coordinate validation with both coordinates invalid."""
        assert _validate_coordinates(95.0, 185.0) == False
        assert _validate_coordinates(-95.0, -185.0) == False


class TestUVAPIEndpoints:
    """Test suite for UV API endpoint construction and validation."""
    
    def test_uv_api_endpoint_construction(self):
        """Test that UV API endpoint URLs are constructed correctly."""
        with patch('agents.weather_tools.requests.get') as mock_http:
            mock_response = MagicMock()
            mock_response.status_code = 500
            mock_http.return_value = mock_response
            
            uv_index_tool(40.7128, -74.0060)
            
            # Verify the correct endpoint was called
            expected_url = "https://currentuvindex.com/api/v1/uvi?latitude=40.7128&longitude=-74.006"
            mock_http.assert_called_with(expected_url, timeout=10)
    
    def test_uv_api_endpoint_with_different_coordinates(self):
        """Test UV API endpoint construction with various coordinates."""
        test_cases = [
            (34.0522, -118.2437, "https://currentuvindex.com/api/v1/uvi?latitude=34.0522&longitude=-118.2437"),
            (0.0, 0.0, "https://currentuvindex.com/api/v1/uvi?latitude=0.0&longitude=0.0"),
            (-33.8688, 151.2093, "https://currentuvindex.com/api/v1/uvi?latitude=-33.8688&longitude=151.2093"),
        ]
        
        for lat, lon, expected_url in test_cases:
            with patch('agents.weather_tools.requests.get') as mock_http:
                mock_response = MagicMock()
                mock_response.status_code = 500
                mock_http.return_value = mock_response
                
                uv_index_tool(lat, lon)
                
                mock_http.assert_called_with(expected_url, timeout=10)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])