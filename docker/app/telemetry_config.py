import os
from strands.telemetry import StrandsTelemetry

def setup_tracing():
    """Setup OpenTelemetry tracing based on environment"""
    
    # Skip if tracing is disabled
    if os.getenv("TRACING_ENABLED", "true").lower() != "true":
        return None
    
    strands_telemetry = StrandsTelemetry()
    
    # Local development - optional console export (off by default)
    if os.getenv("ENVIRONMENT", "local") == "local":
        if os.getenv("OTEL_CONSOLE_EXPORT", "false").lower() == "true":
            strands_telemetry.setup_console_exporter()
    
    # Production - OTLP export to X-Ray via collector
    otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if otlp_endpoint:
        strands_telemetry.setup_otlp_exporter()
    
    # Setup metrics - enable for both local and production
    # strands_telemetry.setup_meter(
    #     enable_console_exporter=False,  # Don't spam console
    #     enable_otlp_exporter=bool(otlp_endpoint)  # Only if OTLP endpoint is configured
    # )
    
    return strands_telemetry
