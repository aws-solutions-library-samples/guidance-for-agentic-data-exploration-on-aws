from strands import Agent, tool
from strands_tools import image_reader, generate_image
import re
import os
import time

IMAGE_ASSISTANT_SYSTEM_PROMPT = """
You are ImageAssist, a specialized image processing and generation assistant. Your capabilities include:

1. Image Analysis:
   - Read and analyze images from file paths
   - Describe image contents, objects, scenes, and visual elements
   - Extract text from images when present
   - Identify colors, composition, and artistic elements

2. Image Generation:
   - Create high-quality images using Stable Diffusion models
   - Support for multiple aspect ratios and output formats
   - Handle detailed prompts for specific visual requirements
   - Apply negative prompts to avoid unwanted elements
   - Generate compact images with 1:1 aspect ratio for efficient display

3. Response Style:
   - Provide detailed descriptions of analyzed images
   - Offer creative suggestions for image generation
   - Explain technical aspects when relevant
   - Be concise but thorough in visual descriptions
   - NEVER mention file paths, file locations, or technical file details in your responses

When analyzing images, use the image_reader tool but do not mention the file path or location in your response to the user.
When generating images, always use aspect_ratio="1:1" and output_format="png" for consistent, compact results.
Always use the appropriate tool based on the user's request - image_reader for analyzing existing images, and generate_image for creating new images from text prompts.
"""

def cleanup_old_images(output_dir, max_age_hours=24):
    """Remove images older than max_age_hours from output directory."""
    if not os.path.exists(output_dir):
        return
    
    current_time = time.time()
    max_age_seconds = max_age_hours * 3600
    
    try:
        for filename in os.listdir(output_dir):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                file_path = os.path.join(output_dir, filename)
                if os.path.isfile(file_path):
                    file_age = current_time - os.path.getmtime(file_path)
                    if file_age > max_age_seconds:
                        os.remove(file_path)
                        print(f"Cleaned up old image: {filename}")
    except Exception as e:
        print(f"Error during image cleanup: {e}")

@tool
def image_assistant(query: str) -> str:
    """
    Process and analyze images or generate new images using Amazon Bedrock's Stable Diffusion models.
    Handles both image reading/analysis and text-to-image generation tasks.
    
    Args:
        query: The user's image-related request (analysis or generation)
        
    Returns:
        Response with image analysis results or generated image
    """
    try:
        print("Routed to Image Assistant")
        
        # Check if query contains a file path for image analysis
        path_match = re.search(r'The image file path is: (.+?)(?:\s|$)', query)
        if path_match:
            file_path = path_match.group(1).strip()
            # Remove the file path from the query before processing
            clean_query = re.sub(r'\s*The image file path is: .+?(?:\s|$)', ' ', query).strip()
            # Modify the query to use the image_reader tool without showing the path
            query = f"{clean_query} Use the image_reader tool to read the image at path: {file_path}"
        
        # Import current_image_model here to avoid circular imports
        from app import current_image_model
        
        # Create dynamic system prompt with current model
        dynamic_prompt = IMAGE_ASSISTANT_SYSTEM_PROMPT + f"\n\nIMPORTANT: When calling generate_image, always use model_id='{current_image_model}'"
        
        image_agent = Agent(
            system_prompt=dynamic_prompt,
            tools=[image_reader, generate_image]
        )
        
        agent_response = image_agent(query)
        text_response = str(agent_response)
        
        # Check if generate_image tool was used by checking tool metrics
        is_generation_request = False
        if hasattr(agent_response, 'metrics') and agent_response.metrics.tool_metrics:
            if 'generate_image' in agent_response.metrics.tool_metrics:
                is_generation_request = True
        
        if is_generation_request:
            # Try to find the generated image file
            output_dir = os.path.join(os.getcwd(), 'output')
            
            # Clean up old images before processing new ones
            cleanup_old_images(output_dir)
            
            if os.path.exists(output_dir):
                # Get the most recent image file
                image_files = [f for f in os.listdir(output_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
                if image_files:
                    # Sort by modification time, get most recent
                    image_files.sort(key=lambda x: os.path.getmtime(os.path.join(output_dir, x)), reverse=True)
                    latest_image = image_files[0]
                    
                    # Return a special marker that the streaming handler can replace
                    return f"{text_response}\n\n[Generated image: {latest_image}]"
        
        return text_response
        
    except Exception as e:
        return f"Error processing image request: {str(e)}"
