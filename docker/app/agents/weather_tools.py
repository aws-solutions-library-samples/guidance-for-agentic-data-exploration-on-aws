"""
Weather Tools Module

This module provides reusable weather-related tools that can be imported and used
by multiple agents. It includes tools for OpenMeteo API, National Weather Service API,
UV index data, and weather data aggregation functionality.
"""

import json
import re
from typing import Dict, Any, Optional, Tuple
from strands import tool
import requests


@tool
def openmeteo_weather_tool(query: str) -> str:
    """
    Get weather information using OpenMeteo API.
    
    This tool provides weather forecasts and current conditions using the OpenMeteo API,
    which offers free weather data without requiring an API key.
    
    Args:
        query: Weather query including location information
        
    Returns:
        Formatted weather information from OpenMeteo API
    """
    try:
        # Extract location from query - this is a simplified approach
        # In a real implementation, you might want more sophisticated location parsing
        location_match = re.search(r'(?:in|for|at)\s+([^,\n]+)', query.lower())
        if not location_match:
            # Try to find any location-like text
            words = query.split()
            location = ' '.join(words[-2:]) if len(words) >= 2 else query
        else:
            location = location_match.group(1).strip()
        
        # For OpenMeteo, we need coordinates. This is a simplified geocoding approach.
        # In production, you'd want to use a proper geocoding service.
        coords = _get_coordinates_for_location(location)
        if not coords:
            return f"I couldn't find coordinates for '{location}'. Please provide a more specific location or coordinates."
        
        lat, lon = coords
        
        # OpenMeteo API call for current weather and forecast
        openmeteo_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=7"
        
        response = requests.get(openmeteo_url, timeout=10)
        
        if response.status_code != 200:
            return f"Unable to retrieve weather data from OpenMeteo API. Status: {response.status_code}"
        
        try:
            weather_data = response.json()
        except json.JSONDecodeError:
            return "Error parsing weather data from OpenMeteo API."
        
        return _format_openmeteo_response(weather_data, location)
        
    except Exception as e:
        return f"Error retrieving weather information: {str(e)}"


def _get_coordinates_for_location(location: str) -> Optional[Tuple[float, float]]:
    """
    Simple coordinate lookup for common locations.
    In production, this would use a proper geocoding service.
    """
    # Basic coordinate mapping for common US cities
    location_coords = {
        'new york': (40.7128, -74.0060),
        'los angeles': (34.0522, -118.2437),
        'chicago': (41.8781, -87.6298),
        'houston': (29.7604, -95.3698),
        'phoenix': (33.4484, -112.0740),
        'philadelphia': (39.9526, -75.1652),
        'san antonio': (29.4241, -98.4936),
        'san diego': (32.7157, -117.1611),
        'dallas': (32.7767, -96.7970),
        'san jose': (37.3382, -121.8863),
        'austin': (30.2672, -97.7431),
        'jacksonville': (30.3322, -81.6557),
        'fort worth': (32.7555, -97.3308),
        'columbus': (39.9612, -82.9988),
        'charlotte': (35.2271, -80.8431),
        'san francisco': (37.7749, -122.4194),
        'indianapolis': (39.7684, -86.1581),
        'seattle': (47.6062, -122.3321),
        'denver': (39.7392, -104.9903),
        'washington': (38.9072, -77.0369),
        'boston': (42.3601, -71.0589),
        'el paso': (31.7619, -106.4850),
        'detroit': (42.3314, -83.0458),
        'nashville': (36.1627, -86.7816),
        'portland': (45.5152, -122.6784),
        'memphis': (35.1495, -90.0490),
        'oklahoma city': (35.4676, -97.5164),
        'las vegas': (36.1699, -115.1398),
        'louisville': (38.2527, -85.7585),
        'baltimore': (39.2904, -76.6122),
        'milwaukee': (43.0389, -87.9065),
        'albuquerque': (35.0844, -106.6504),
        'tucson': (32.2226, -110.9747),
        'fresno': (36.7378, -119.7871),
        'mesa': (33.4152, -111.8315),
        'sacramento': (38.5816, -121.4944),
        'atlanta': (33.7490, -84.3880),
        'kansas city': (39.0997, -94.5786),
        'colorado springs': (38.8339, -104.8214),
        'omaha': (41.2565, -95.9345),
        'raleigh': (35.7796, -78.6382),
        'miami': (25.7617, -80.1918),
        'long beach': (33.7701, -118.1937),
        'virginia beach': (36.8529, -75.9780),
        'oakland': (37.8044, -122.2711),
        'minneapolis': (44.9778, -93.2650),
        'tulsa': (36.1540, -95.9928),
        'tampa': (27.9506, -82.4572),
        'arlington': (32.7357, -97.1081),
        'new orleans': (29.9511, -90.0715)
    }
    
    location_lower = location.lower().strip()
    
    # Direct lookup
    if location_lower in location_coords:
        return location_coords[location_lower]
    
    # Partial matching
    for city, coords in location_coords.items():
        if city in location_lower or location_lower in city:
            return coords
    
    # Check if coordinates are provided directly
    coord_match = re.search(r'(-?\d+\.?\d*),\s*(-?\d+\.?\d*)', location)
    if coord_match:
        try:
            lat = float(coord_match.group(1))
            lon = float(coord_match.group(2))
            return (lat, lon)
        except ValueError:
            pass
    
    return None


def _format_openmeteo_response(weather_data: Dict[str, Any], location: str) -> str:
    """Format OpenMeteo API response into human-readable text."""
    try:
        current = weather_data.get('current', {})
        daily = weather_data.get('daily', {})
        
        # Current conditions
        temp = current.get('temperature_2m')
        feels_like = current.get('apparent_temperature')
        humidity = current.get('relative_humidity_2m')
        wind_speed = current.get('wind_speed_10m')
        precipitation = current.get('precipitation', 0)
        weather_code = current.get('weather_code', 0)
        
        # Weather code interpretation (simplified)
        weather_desc = _interpret_weather_code(weather_code)
        
        result = f"🌤️ **Current Weather for {location}**\n\n"
        
        if temp is not None:
            result += f"**Temperature:** {temp}°C ({temp * 9/5 + 32:.1f}°F)\n"
        if feels_like is not None:
            result += f"**Feels Like:** {feels_like}°C ({feels_like * 9/5 + 32:.1f}°F)\n"
        if humidity is not None:
            result += f"**Humidity:** {humidity}%\n"
        if wind_speed is not None:
            result += f"**Wind Speed:** {wind_speed} km/h ({wind_speed * 0.621371:.1f} mph)\n"
        if precipitation > 0:
            result += f"**Precipitation:** {precipitation} mm\n"
        
        result += f"**Conditions:** {weather_desc}\n\n"
        
        # 7-day forecast
        if daily and 'time' in daily:
            result += "📅 **7-Day Forecast:**\n\n"
            times = daily.get('time', [])
            max_temps = daily.get('temperature_2m_max', [])
            min_temps = daily.get('temperature_2m_min', [])
            precip_sums = daily.get('precipitation_sum', [])
            weather_codes = daily.get('weather_code', [])
            
            for i, date in enumerate(times[:7]):
                if i < len(max_temps) and i < len(min_temps):
                    max_temp_c = max_temps[i]
                    min_temp_c = min_temps[i]
                    max_temp_f = max_temp_c * 9/5 + 32
                    min_temp_f = min_temp_c * 9/5 + 32
                    precip = precip_sums[i] if i < len(precip_sums) else 0
                    code = weather_codes[i] if i < len(weather_codes) else 0
                    desc = _interpret_weather_code(code)
                    
                    result += f"**{date}:** {desc}, High: {max_temp_c}°C ({max_temp_f:.0f}°F), Low: {min_temp_c}°C ({min_temp_f:.0f}°F)"
                    if precip > 0:
                        result += f", Precipitation: {precip} mm"
                    result += "\n"
        
        result += "\n*Data provided by OpenMeteo API*"
        return result
        
    except Exception as e:
        return f"Error formatting weather data: {str(e)}"


def _interpret_weather_code(code: int) -> str:
    """Interpret OpenMeteo weather codes into human-readable descriptions."""
    weather_codes = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        56: "Light freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Light freezing rain",
        67: "Heavy freezing rain",
        71: "Slight snow fall",
        73: "Moderate snow fall",
        75: "Heavy snow fall",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail"
    }
    
    return weather_codes.get(code, f"Unknown weather condition (code: {code})")

@tool

def nws_weather_tool(location: str) -> str:
    """
    Get weather information using National Weather Service API.
    
    This tool provides official weather forecasts from the US National Weather Service.
    It uses a two-step process: first getting grid coordinates, then retrieving the forecast.
    
    Args:
        location: Location string (city, state) or coordinates (lat,lon)
        
    Returns:
        Formatted weather information from NWS API
    """
    try:
        # Get coordinates for the location
        coords = _get_coordinates_for_location(location)
        if not coords:
            return f"I couldn't find coordinates for '{location}'. Please provide a more specific US location or coordinates."
        
        lat, lon = coords
        
        # Step 1: Get grid information from NWS points endpoint
        points_url = f"https://api.weather.gov/points/{lat},{lon}"
        
        points_response = requests.get(points_url, timeout=10)
        if points_response.status_code != 200:
            return f"Unable to retrieve grid information from National Weather Service. Status: {points_response.status_code}"
        
        try:
            points_data = points_response.json()
        except json.JSONDecodeError:
            return "Error parsing grid information from National Weather Service."
        
        # Extract forecast URLs from points response
        properties = points_data.get('properties', {})
        forecast_url = properties.get('forecast')
        forecast_hourly_url = properties.get('forecastHourly')
        
        if not forecast_url:
            return "Unable to get forecast URL from National Weather Service."
        
        # Step 2: Get the actual forecast
        forecast_response = requests.get(forecast_url, timeout=10)
        if forecast_response.status_code != 200:
            return f"Unable to retrieve forecast from National Weather Service. Status: {forecast_response.status_code}"
        
        try:
            forecast_data = forecast_response.json()
        except json.JSONDecodeError:
            return "Error parsing forecast data from National Weather Service."
        
        return _format_nws_response(forecast_data, location, lat, lon)
        
    except Exception as e:
        return f"Error retrieving NWS weather information: {str(e)}"


def _format_nws_response(forecast_data: Dict[str, Any], location: str, lat: float, lon: float) -> str:
    """Format NWS API response into human-readable text."""
    try:
        properties = forecast_data.get('properties', {})
        periods = properties.get('periods', [])
        
        if not periods:
            return "No forecast data available from National Weather Service."
        
        result = f"🇺🇸 **National Weather Service Forecast for {location}**\n"
        result += f"*Coordinates: {lat}, {lon}*\n\n"
        
        # Current/Next period (detailed)
        current_period = periods[0]
        result += f"**{current_period.get('name', 'Current Period')}:**\n"
        result += f"🌡️ **Temperature:** {current_period.get('temperature', 'N/A')}°{current_period.get('temperatureUnit', 'F')}\n"
        
        wind_speed = current_period.get('windSpeed', 'N/A')
        wind_direction = current_period.get('windDirection', 'N/A')
        result += f"💨 **Wind:** {wind_speed} {wind_direction}\n"
        
        result += f"🌤️ **Conditions:** {current_period.get('shortForecast', 'N/A')}\n"
        
        detailed_forecast = current_period.get('detailedForecast', '')
        if detailed_forecast:
            result += f"📝 **Details:** {detailed_forecast}\n"
        
        result += "\n"
        
        # Extended forecast (next 6 periods)
        if len(periods) > 1:
            result += "📅 **Extended Forecast:**\n\n"
            for period in periods[1:7]:  # Next 6 periods
                name = period.get('name', 'Unknown')
                temp = period.get('temperature', 'N/A')
                temp_unit = period.get('temperatureUnit', 'F')
                short_forecast = period.get('shortForecast', 'N/A')
                
                result += f"**{name}:** {short_forecast}, {temp}°{temp_unit}\n"
        
        # Check for weather alerts
        result += "\n⚠️ *For current weather alerts and warnings, check weather.gov*\n"
        result += "\n*Official forecast from the National Weather Service*"
        
        return result
        
    except Exception as e:
        return f"Error formatting NWS weather data: {str(e)}"


def _validate_coordinates(lat: float, lon: float) -> bool:
    """Validate that coordinates are within reasonable ranges."""
    return -90 <= lat <= 90 and -180 <= lon <= 180


def _validate_us_coordinates(lat: float, lon: float) -> bool:
    """Validate that coordinates are within the continental US (approximate)."""
    # Rough bounds for continental US, Alaska, and Hawaii
    return (
        (24.396308 <= lat <= 49.384358 and -125.0 <= lon <= -66.93457) or  # Continental US
        (54.0 <= lat <= 71.5 and -179.0 <= lon <= -129.0) or  # Alaska
        (18.0 <= lat <= 23.0 and -162.0 <= lon <= -154.0)  # Hawaii
    )

@tool
def uv_index_tool(location: str) -> str:
    """
    Get real-time UV index information for a specified location.
    
    This tool provides current UV index data and safety recommendations
    using the currentuvindex.com API.
    
    Args:
        location: Location string (city, state) or coordinates (lat,lon)
        
    Returns:
        UV index information with safety recommendations
    """
    try:
        # Get coordinates for the location
        coords = _get_coordinates_for_location(location)
        if not coords:
            return f"I couldn't find coordinates for '{location}'. Please provide a more specific location or coordinates."
        
        latitude, longitude = coords
        
        # Validate coordinates
        if not _validate_coordinates(latitude, longitude):
            return f"Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180. Received: {latitude}, {longitude}"
        
        # UV Index API call
        uv_url = f"https://currentuvindex.com/api/v1/uvi?latitude={latitude}&longitude={longitude}"
        
        response = requests.get(uv_url, timeout=10)
        if response.status_code != 200:
            return f"Unable to retrieve UV index data. Status: {response.status_code}"
        
        try:
            uv_data = response.json()
        except json.JSONDecodeError:
            return "Error parsing UV index data from the API."
        
        return _format_uv_response(uv_data, latitude, longitude)
        
    except Exception as e:
        return f"Error retrieving UV index information: {str(e)}"





def _format_uv_response(uv_data: Dict[str, Any], lat: float, lon: float) -> str:
    """Format UV index API response into human-readable text with safety recommendations."""
    try:
        uv_index = uv_data.get('now', {}).get('uvi')
        
        if uv_index is None:
            return "UV index data is not available for this location at this time."
        
        # Determine risk level and recommendations
        risk_level, recommendations = _get_uv_recommendations(uv_index)
        
        result = f"☀️ **UV Index Information**\n"
        result += f"*Location: {lat}, {lon}*\n\n"
        result += f"**Current UV Index:** {uv_index}\n"
        result += f"**Risk Level:** {risk_level}\n\n"
        
        result += "🛡️ **Safety Recommendations:**\n"
        for i, rec in enumerate(recommendations, 1):
            result += f"{i}. {rec}\n"
        
        # Add time information if available
        if 'now' in uv_data and 'time' in uv_data['now']:
            result += f"\n*Data as of: {uv_data['now']['time']}*\n"
        
        result += "\n*UV index data provided by currentuvindex.com*"
        
        return result
        
    except Exception as e:
        return f"Error formatting UV index data: {str(e)}"


def _get_uv_recommendations(uv_index: float) -> Tuple[str, list]:
    """
    Get UV risk level and safety recommendations based on UV index value.
    
    Args:
        uv_index: UV index value
        
    Returns:
        Tuple of (risk_level, recommendations_list)
    """
    if uv_index < 3:
        return "Low", [
            "Minimal sun protection required for normal activity",
            "Wear sunglasses on bright days",
            "If you burn easily, cover up and use sunscreen SPF 30+"
        ]
    elif uv_index < 6:
        return "Moderate", [
            "Take precautions if you will be outside",
            "Stay in shade near midday when the sun is strongest",
            "Wear protective clothing, sunglasses, and sunscreen SPF 30+",
            "Watch for bright surfaces like sand, water and snow which increase UV exposure"
        ]
    elif uv_index < 8:
        return "High", [
            "Protection against sun damage is needed",
            "Reduce time in the sun between 10 a.m. and 4 p.m.",
            "Wear protective clothing, a wide-brimmed hat, and sunglasses",
            "Use sunscreen SPF 30+ generously and reapply every 2 hours",
            "Bright surfaces like sand, water and snow will increase UV exposure"
        ]
    elif uv_index < 11:
        return "Very High", [
            "Extra precautions are needed because unprotected skin and eyes can burn quickly",
            "Minimize sun exposure between 10 a.m. and 4 p.m.",
            "Seek shade, wear protective clothing, a wide-brimmed hat, and sunglasses",
            "Apply sunscreen SPF 30+ generously every 2 hours",
            "Be especially careful near water, sand, and snow as they reflect UV rays"
        ]
    else:
        return "Extreme", [
            "Take all precautions because unprotected skin and eyes can burn in minutes",
            "Try to avoid sun exposure between 10 a.m. and 4 p.m.",
            "Seek shade, wear protective clothing, a wide-brimmed hat, and sunglasses",
            "Apply sunscreen SPF 30+ generously every 2 hours",
            "Be extra careful near water, sand, and snow as they reflect and intensify UV rays",
            "Consider staying indoors during peak UV hours"
        ]

@tool
def aggregate_weather_data(location: str) -> str:
    """
    Aggregate and compare weather data from multiple sources.
    
    This tool combines weather information from both OpenMeteo and National Weather Service
    APIs to provide comprehensive weather analysis and comparison.
    
    Args:
        location: Location string (city, state) or coordinates (lat,lon)
        
    Returns:
        Unified weather analysis combining multiple data sources
    """
    try:
        # Get coordinates for UV index
        coords = _get_coordinates_for_location(location)
        
        results = []
        sources_available = []
        
        # Try to get OpenMeteo data
        try:
            openmeteo_result = openmeteo_weather_tool(f"weather for {location}")
            if not openmeteo_result.startswith("Error") and not openmeteo_result.startswith("I couldn't find"):
                results.append(("OpenMeteo", openmeteo_result))
                sources_available.append("OpenMeteo")
        except Exception as e:
            results.append(("OpenMeteo", f"OpenMeteo data unavailable: {str(e)}"))
        
        # Try to get NWS data (US locations only)
        try:
            nws_result = nws_weather_tool(location)
            if not nws_result.startswith("Error") and not nws_result.startswith("Unable") and not nws_result.startswith("I couldn't find"):
                results.append(("NWS", nws_result))
                sources_available.append("National Weather Service")
        except Exception as e:
            results.append(("NWS", f"National Weather Service data unavailable: {str(e)}"))
        
        # Try to get UV index data
        uv_result = None
        try:
            uv_result = uv_index_tool(location)
            if not uv_result.startswith("Error") and not uv_result.startswith("Unable") and not uv_result.startswith("I couldn't find"):
                sources_available.append("UV Index")
        except Exception as e:
            uv_result = f"UV index data unavailable: {str(e)}"
        
        # Format aggregated response
        if not sources_available:
            return f"Unable to retrieve weather data for '{location}' from any source. Please check the location and try again."
        
        # Build comprehensive response
        response = f"🌍 **Comprehensive Weather Report for {location}**\n"
        response += f"*Data sources: {', '.join(sources_available)}*\n\n"
        
        # Add individual source data
        for source, data in results:
            if not data.startswith(source + " data unavailable"):
                response += f"{data}\n\n"
                response += "---\n\n"
        
        # Add UV index if available
        if uv_result and not uv_result.startswith("UV index data unavailable"):
            response += f"{uv_result}\n\n"
            response += "---\n\n"
        
        # Add comparison and analysis
        response += _generate_weather_analysis(results, sources_available, location)
        
        return response.strip()
        
    except Exception as e:
        return f"Error aggregating weather data: {str(e)}"


def _generate_weather_analysis(results: list, sources_available: list, location: str) -> str:
    """Generate analysis and comparison of weather data from multiple sources."""
    try:
        analysis = "📊 **Weather Data Analysis:**\n\n"
        
        if len(sources_available) > 1:
            analysis += f"✅ **Data Availability:** Excellent - {len(sources_available)} sources available\n"
            analysis += "• Multiple data sources provide increased reliability\n"
            analysis += "• Cross-reference information for better accuracy\n\n"
        elif len(sources_available) == 1:
            analysis += f"⚠️ **Data Availability:** Limited - Only {sources_available[0]} available\n"
            analysis += "• Single source data - consider checking other sources for verification\n\n"
        else:
            analysis += "❌ **Data Availability:** No sources available\n\n"
            return analysis
        
        # Source-specific notes
        if "OpenMeteo" in sources_available:
            analysis += "🌐 **OpenMeteo:** International coverage, good for global locations\n"
        
        if "National Weather Service" in sources_available:
            analysis += "🇺🇸 **National Weather Service:** Official US government forecasts, highly reliable for US locations\n"
        
        if "UV Index" in sources_available:
            analysis += "☀️ **UV Index:** Real-time UV radiation data for outdoor activity planning\n"
        
        analysis += "\n"
        
        # Recommendations based on available data
        analysis += "💡 **Recommendations:**\n"
        
        if "National Weather Service" in sources_available:
            analysis += "• NWS data is official and highly reliable for US locations\n"
        
        if "UV Index" in sources_available:
            analysis += "• Check UV recommendations for outdoor activities\n"
        
        if len(sources_available) > 1:
            analysis += "• Compare forecasts between sources for consistency\n"
        
        analysis += "• Check for weather alerts and warnings\n"
        analysis += "• Monitor conditions if planning outdoor activities\n"
        
        return analysis
        
    except Exception as e:
        return f"Error generating weather analysis: {str(e)}"