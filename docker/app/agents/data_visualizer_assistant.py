from strands import Agent, tool
from .model_utils import get_current_model
from strands_tools import calculator
import os
import time

# Set environment variable to disable interactive mode
os.environ["BYPASS_TOOL_CONSENT"] = "true"

DATA_VISUALIZER_SYSTEM_PROMPT = """You are a data visualization agent with five specialized tools for creating different types of visualizations and calculations:

1. **data_extractor**: Extract structured data from raw text and convert to CSV format
2. **chart_tool**: For creating charts (bar, pie, line, scatter, etc.) using matplotlib
3. **wordcloud_tool**: For creating word cloud visualizations using WordCloud library
4. **table_tool**: For creating formatted data tables and summaries
5. **calculator**: For mathematical calculations and data analysis

MANDATORY DATA PROCESSING WORKFLOW:
When you receive ANY request with numerical data (temperatures, sales figures, warranty claims, percentages, etc.):
1. ALWAYS call data_extractor FIRST to convert the input to clean CSV format
2. THEN call chart_tool using the CSV output from data_extractor
3. NEVER call chart_tool directly with ANY input containing numbers

This applies to ALL data formats:
- Raw text from other tools
- Structured data provided by users
- Lists with percentages and counts
- Any text containing numerical values

EXAMPLE WORKFLOW:
Input: "Michigan: 25 claims, Ohio: 5 claims"
Step 1: data_extractor(input) → returns "Category,Value\nMichigan,25\nOhio,5"
Step 2: chart_tool(csv_data, chart_title="Claims by State")

IMPORTANT CONSTRAINTS:
- Generate a MAXIMUM of 3 visualizations per request
- Choose the most meaningful and relevant visualizations for the data
- Focus on the key insights and patterns in the data
- Avoid redundant or similar visualizations

CHART TITLE GUIDELINES:
- Always provide a clean, descriptive chart_title parameter when calling chart_tool
- Keep titles concise and descriptive (e.g., "Cleveland Weekly Temperatures", "Quarterly Sales Performance")
- Do NOT include instructions or formatting details in the title
- Focus on what the data represents, not how to create the chart

Choose the appropriate tool based on the user's request:
- Use data_extractor for: converting raw text with embedded data to structured CSV format (REQUIRED FIRST STEP)
- Use chart_tool for: bar charts, pie charts, line graphs, scatter plots, histograms, etc. (use CSV data only)
- Use wordcloud_tool for: word clouds, text frequency visualizations
- Use table_tool for: data tables, summaries, comparison tables, statistical reports
- Use calculator for: mathematical calculations, statistical analysis, data computations

All tools save files to the output directory with timestamps and return the filename."""

@tool
def data_extractor(raw_text: str) -> str:
    """
    Extract structured data from raw text using an LLM agent and return as CSV format.
    
    Args:
        raw_text: Raw text containing data to extract
        
    Returns:
        CSV formatted data with Category,Value headers
    """
    try:
        from .model_utils import get_current_model
        
        print("Routed to Data Extractor")
        extractor_agent = Agent(
            system_prompt="""You are a data extraction specialist that converts unstructured text into clean CSV format.

EXTRACTION RULES:
- Extract all numerical data points from the text
- Use the EXACT category names from the source text (e.g., "Michigan", "MI", "Q1", "Monday")
- Include only the numerical values without units (°F, $, %, etc.)
- Format as CSV with headers "Category,Value"
- Return ONLY the CSV data, no explanations or additional text
- DO NOT use percentages or calculated values as category names
- DO NOT use generic names like "Category1", "Item1", etc.

EXAMPLES:
Input: "Monday: 76°F, Tuesday: 75°F, Wednesday: 68°F"
Output:
Category,Value
Monday,76
Tuesday,75
Wednesday,68

Input: "Michigan: 25 claims, Ohio: 5 claims, Arizona: 5 claims"
Output:
Category,Value
Michigan,25
Ohio,5
Arizona,5

Input: "Q1 sales were $100K, Q2 reached $150K"
Output:
Category,Value
Q1,100
Q2,150""",
            model=get_current_model(),
        )
        
        formatted_query = f"Extract structured data from this text:\n\n{raw_text}"
        agent_response = extractor_agent(formatted_query)
        csv_data = str(agent_response).strip()
        
        # Save to file
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"extracted_data_{timestamp}.csv"
        output_dir = os.path.join(os.getcwd(), 'output')
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, 'w') as f:
            f.write(csv_data)
        
        return f"[Extracted data saved to: {filename}]\n{csv_data}"
        
    except Exception as e:
        return f"Error extracting data: {str(e)}"

@tool
def chart_tool(data_description: str, chart_title: str = None) -> str:
    """Create charts using matplotlib. Handles bar charts, pie charts, line graphs, scatter plots, etc.
    
    Args:
        data_description: The data and instructions for creating the chart
        chart_title: Optional title for the chart (if not provided, will try to extract from data)
    """
    try:
        import matplotlib
        matplotlib.use('Agg')  # Use non-interactive backend
        import matplotlib.pyplot as plt
        import numpy as np
        from datetime import datetime
        import re
        import json
        
        # Create output directory
        output_dir = os.path.join(os.getcwd(), 'output')
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate timestamp for unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"chart_{timestamp}.png"
        filepath = os.path.join(output_dir, filename)
        
        plt.figure(figsize=(10, 6))
        
        # Parse CSV data if present, otherwise use old parsing
        if "Category,Value" in data_description:
            lines = data_description.split('\n')
            categories, values = [], []
            for line in lines:
                if ',' in line and line != "Category,Value":
                    parts = line.split(',')
                    if len(parts) >= 2:
                        category = parts[0].strip()
                        try:
                            value = float(parts[1].strip())
                            categories.append(category)
                            values.append(value)
                        except:
                            continue
            extracted_title = None
            x_label, y_label = extract_labels(data_description)
        else:
            # Use old parsing for non-CSV data
            categories, values, extracted_title, x_label, y_label = parse_chart_data(data_description)
        
        # Use provided title or extracted title or default
        final_title = chart_title or extracted_title
        
        if not categories or not values:
            return "Error: No data found to visualize. Please provide data in a clear format."
        
        # Determine chart type from description
        chart_type = determine_chart_type(data_description)
        
        if chart_type == 'pie':
            plt.pie(values, labels=categories, autopct='%1.1f%%', startangle=90)
            plt.title(final_title or 'Pie Chart', fontsize=16, fontweight='bold')
        elif chart_type == 'line':
            plt.plot(categories, values, marker='o', linewidth=2, markersize=8)
            plt.title(final_title or 'Line Chart', fontsize=16, fontweight='bold')
            plt.xlabel(x_label or 'Categories', fontsize=12)
            plt.ylabel(y_label or 'Values', fontsize=12)
            plt.grid(True, alpha=0.3)
            plt.xticks(rotation=45)
        else:  # Default to bar chart
            colors = ['skyblue', 'lightcoral', 'lightgreen', 'gold', 'orange', 'purple', 'pink', 'cyan']
            bars = plt.bar(categories, values, color=colors[:len(categories)])
            plt.title(final_title or 'Bar Chart', fontsize=16, fontweight='bold')
            plt.xlabel(x_label or 'Categories', fontsize=12)
            plt.ylabel(y_label or 'Values', fontsize=12)
            plt.grid(axis='y', alpha=0.3)
            plt.xticks(rotation=45)
            
            # Add value labels on bars
            for bar, value in zip(bars, values):
                plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + max(values)*0.01, 
                        f'{value}', ha='center', va='bottom')
        
        plt.tight_layout()
        plt.savefig(filepath, format='png', dpi=150, bbox_inches='tight')
        plt.close()
        
        return f"[Generated image: {filename}]"
        
    except Exception as e:
        return f"Error creating chart: {str(e)}"

def parse_chart_data(text):
    """Parse data from text using multiple strategies."""
    import re
    
    # Strategy 1: Temperature data with °F or °C (Monday: 76°F, Tuesday: 25°C)
    temp_pairs = re.findall(r'(\w+)[^:]*:\s*\*?\*?(\d+)°[FC]', text)
    if temp_pairs:
        categories = [pair[0].title() for pair in temp_pairs]
        values = [float(pair[1]) for pair in temp_pairs]
        title = extract_title(text)
        x_label, y_label = extract_labels(text)
        return categories, values, title, x_label, y_label
    
    # Strategy 2: Key-value pairs (Q1: 100, Q2: 150)
    pairs = re.findall(r'([A-Za-z0-9\s]+)[:\s=]+(\d+(?:\.\d+)?)', text)
    if pairs:
        categories = [pair[0].strip().title() for pair in pairs]
        values = [float(pair[1]) for pair in pairs]
        title = extract_title(text)
        x_label, y_label = extract_labels(text)
        return categories, values, title, x_label, y_label
    
    # Strategy 3: Table-like data (| Item | Value |)
    table_matches = re.findall(r'\|\s*([^|]+)\s*\|\s*(\d+(?:\.\d+)?)\s*\|', text)
    if table_matches:
        categories = [match[0].strip().title() for match in table_matches]
        values = [float(match[1]) for match in table_matches]
        title = extract_title(text)
        x_label, y_label = extract_labels(text)
        return categories, values, title, x_label, y_label
    
    # Strategy 4: Comma-separated with numbers
    items = re.findall(r'([A-Za-z0-9\s]+)[\s,]*(\d+(?:\.\d+)?)', text)
    if items and len(items) >= 2:
        categories = [item[0].strip().title() for item in items]
        values = [float(item[1]) for item in items]
        title = extract_title(text)
        x_label, y_label = extract_labels(text)
        return categories, values, title, x_label, y_label
    
    return [], [], None, None, None

def extract_title(text):
    """Extract chart title from text."""
    import re
    
    # Look for explicit title indicators
    title_patterns = [
        r'title[:\s]+([^,\n]+)',
        r'chart[:\s]+([^,\n]+)',
        r'showing\s+([^,\n]+)',
        r'create.*chart.*showing\s+([^,\n]+)',
    ]
    
    for pattern in title_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            title = match.group(1).strip()
            # Remove surrounding quotes and clean up
            title = title.strip('"\'').title()
            return title
    
    # Fallback: use first meaningful phrase
    words = text.split()[:6]
    if len(words) >= 2:
        title = ' '.join(words)
        # Remove surrounding quotes and clean up
        title = title.strip('"\'').title()
        return title
    
    return None

def extract_labels(text):
    """Extract axis labels from text."""
    import re
    
    x_label = None
    y_label = None
    
    # Common patterns for axis labels
    if re.search(r'quarter|q\d', text, re.IGNORECASE):
        x_label = 'Quarter'
    elif re.search(r'month|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec', text, re.IGNORECASE):
        x_label = 'Month'
    elif re.search(r'year|\d{4}', text, re.IGNORECASE):
        x_label = 'Year'
    elif re.search(r'product|item|category', text, re.IGNORECASE):
        x_label = 'Category'
    
    if re.search(r'sales|revenue|income', text, re.IGNORECASE):
        y_label = 'Sales'
    elif re.search(r'profit|earnings', text, re.IGNORECASE):
        y_label = 'Profit'
    elif re.search(r'count|number|quantity', text, re.IGNORECASE):
        y_label = 'Count'
    elif re.search(r'percentage|percent|%', text, re.IGNORECASE):
        y_label = 'Percentage'
    
    return x_label, y_label

def determine_chart_type(text):
    """Determine the best chart type based on text description."""
    text_lower = text.lower()
    
    if 'pie' in text_lower:
        return 'pie'
    elif 'line' in text_lower or 'trend' in text_lower or 'over time' in text_lower:
        return 'line'
    else:
        return 'bar'

@tool  
def wordcloud_tool(text_data: str) -> str:
    """Create word cloud visualizations using WordCloud library."""
    try:
        from wordcloud import WordCloud
        import matplotlib
        matplotlib.use('Agg')  # Use non-interactive backend
        import matplotlib.pyplot as plt
        from datetime import datetime
        
        # Create output directory
        output_dir = os.path.join(os.getcwd(), 'output')
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate timestamp for unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"wordcloud_{timestamp}.png"
        filepath = os.path.join(output_dir, filename)
        
        # Create word cloud
        wordcloud = WordCloud(
            width=800, 
            height=400, 
            background_color='white',
            colormap='managua',
            max_words=100
        ).generate(text_data)
        
        # Create matplotlib figure
        plt.figure(figsize=(10, 5))
        plt.imshow(wordcloud, interpolation='bilinear')
        plt.axis('off')
        plt.title('Word Cloud', fontsize=16, fontweight='bold', pad=20)
        
        plt.savefig(filepath, format='png', dpi=150, bbox_inches='tight')
        plt.close()
        
        return f"[Generated image: {filename}]"
        
    except ImportError as e:
        return f"Error: WordCloud library not available - {str(e)}. Please use the chart tool for data visualization instead."
    except Exception as e:
        return f"Error: Word cloud creation failed - {str(e)}. Please use the chart tool for data visualization instead."

@tool
def table_tool(data_description: str) -> str:
    """Create formatted data tables and summaries."""
    try:
        import matplotlib
        matplotlib.use('Agg')  # Use non-interactive backend
        import matplotlib.pyplot as plt
        from datetime import datetime
        import re
        
        # Create output directory
        output_dir = os.path.join(os.getcwd(), 'output')
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate timestamp for unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"table_{timestamp}.png"
        filepath = os.path.join(output_dir, filename)
        
        # Parse data - look for key:value pairs
        data_pairs = re.findall(r'(\w+)[:\s=]+(\d+(?:\.\d+)?)', data_description.lower())
        
        if data_pairs:
            # Create table data from parsed data
            categories = [pair[0].title() for pair in data_pairs]
            values = [str(float(pair[1])) for pair in data_pairs]
            table_data = [['Category', 'Value']] + list(zip(categories, values))
        else:
            # Return error instead of sample data
            return "Error: No data found to create table. Please provide data in format like 'Q1: 100, Q2: 150, Q3: 120'"
        
        # Create table visualization
        fig, ax = plt.subplots(figsize=(8, 6))
        ax.axis('tight')
        ax.axis('off')
        
        # Create table using matplotlib
        table = ax.table(cellText=table_data[1:], colLabels=table_data[0],
                        cellLoc='center', loc='center',
                        colWidths=[0.5, 0.3])
        
        # Style the table
        table.auto_set_font_size(False)
        table.set_fontsize(12)
        table.scale(1.2, 2)
        
        # Header styling
        for i in range(len(table_data[0])):
            table[(0, i)].set_facecolor('#4CAF50')
            table[(0, i)].set_text_props(weight='bold', color='white')
        
        # Alternate row colors
        for i in range(1, len(table_data)):
            for j in range(len(table_data[0])):
                if i % 2 == 0:
                    table[(i, j)].set_facecolor('#f0f0f0')
                else:
                    table[(i, j)].set_facecolor('white')
        
        plt.title('Data Table', fontsize=16, fontweight='bold', pad=20)
        plt.savefig(filepath, format='png', dpi=150, bbox_inches='tight')
        plt.close()
        
        return f"[Generated image: {filename}]"
        
    except Exception as e:
        return f"Error creating table: {str(e)}"

def cleanup_old_charts(output_dir, max_age_hours=24):
    """Remove visualization files older than max_age_hours from output directory."""
    if not os.path.exists(output_dir):
        return
    
    current_time = time.time()
    max_age_seconds = max_age_hours * 3600
    
    try:
        for filename in os.listdir(output_dir):
            if (filename.startswith(('chart_', 'wordcloud_', 'table_')) and 
                filename.lower().endswith('.png')):
                file_path = os.path.join(output_dir, filename)
                if os.path.isfile(file_path):
                    file_age = current_time - os.path.getmtime(file_path)
                    if file_age > max_age_seconds:
                        os.remove(file_path)
                        print(f"Cleaned up old visualization: {filename}")
    except Exception as e:
        print(f"Error during visualization cleanup: {e}")

@tool
def data_visualizer_assistant(query: str) -> str:
    """Data visualization assistant for creating charts, word clouds, and tables."""
    try:
        print("Routed to Data Visualizer Assistant")
        
        # Clean up old visualizations
        output_dir = os.path.join(os.getcwd(), 'output')
        cleanup_old_charts(output_dir)
        
        # Record timestamp before execution
        start_time = time.time()
        
        agent = Agent(
            system_prompt=DATA_VISUALIZER_SYSTEM_PROMPT,
            model=get_current_model(),
            tools=[data_extractor, chart_tool, wordcloud_tool, table_tool, calculator]
        )
        
        result = agent(query)
        result_str = str(result)
        
        # Find visualization files created after start_time
        if os.path.exists(output_dir):
            viz_files = [f for f in os.listdir(output_dir) 
                        if (f.startswith(('chart_', 'wordcloud_', 'table_')) and 
                            f.lower().endswith('.png'))]
            
            # Filter to files created after we started
            recent_viz = []
            for filename in viz_files:
                file_path = os.path.join(output_dir, filename)
                if os.path.getmtime(file_path) >= start_time:
                    recent_viz.append(filename)
            
            if recent_viz:
                # Sort by creation time to maintain order
                recent_viz.sort(key=lambda x: os.path.getmtime(os.path.join(output_dir, x)))
                
                # Include all generated visualizations
                image_markers = []
                for filename in recent_viz:
                    image_markers.append(f"[Generated chart: {filename}]")
                
                return f"{result_str}\n\n" + "\n\n".join(image_markers)
        
        return result_str
        
    except Exception as e:
        return f"Error processing data visualization request: {str(e)}"
