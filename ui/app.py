from flask import Flask, render_template, request, jsonify, Response, send_from_directory, redirect, session, url_for
import requests
import json
import time
import os
import tempfile
import hashlib
import base64
import uuid
from datetime import datetime, timezone
from werkzeug.utils import secure_filename
import base64
from urllib.parse import urlencode
from functools import wraps
import boto3
from botocore.exceptions import ClientError
from decimal import Decimal
import logging

# Filter out health check logs
class HealthCheckFilter(logging.Filter):
    def filter(self, record):
        return "/health" not in record.getMessage()

# Apply filter to werkzeug logger (Flask's request logger)
logging.getLogger("werkzeug").addFilter(HealthCheckFilter())

# Try to import authentication dependencies
try:
    from jose import jwt, JWTError
    AUTH_AVAILABLE = True
except ImportError:
    print("Warning: python-jose not available, authentication disabled")
    AUTH_AVAILABLE = False
    jwt = None
    JWTError = Exception

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = tempfile.mkdtemp(prefix='uploads_')
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'dev-secret-change-in-production')

# Configure logging
logger = logging.getLogger(__name__)

def cleanup_old_temp_files():
    """Clean up temporary upload files older than 1 hour"""
    try:
        temp_dir = tempfile.gettempdir()
        current_time = time.time()
        
        for filename in os.listdir(temp_dir):
            if filename.startswith('upload_'):
                file_path = os.path.join(temp_dir, filename)
                if os.path.isfile(file_path):
                    file_age = current_time - os.path.getmtime(file_path)
                    if file_age > 3600:  # 1 hour in seconds
                        os.remove(file_path)
    except Exception:
        # Ignore cleanup errors to not break the main functionality
        logger.debug("Cleanup error ignored")

# Agent service URL - use same load balancer for internal communication
AGENT_SERVICE_URL = os.getenv('AGENT_SERVICE_URL', 'http://localhost:8000')

# Cognito Configuration
COGNITO_DOMAIN = os.environ.get('COGNITO_DOMAIN')
CLIENT_ID = os.environ.get('CLIENT_ID')
CLIENT_SECRET = os.environ.get('CLIENT_SECRET')
USER_POOL_ID = os.environ.get('USER_POOL_ID')
REGION = os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')
REDIRECT_URI = os.environ.get('REDIRECT_URI')

# Neptune/Graph DB availability
NEPTUNE_ENABLED = bool(os.environ.get('NEPTUNE_ETL_BUCKET')) or not all([COGNITO_DOMAIN, CLIENT_ID, CLIENT_SECRET, USER_POOL_ID, REDIRECT_URI])

@app.context_processor
def inject_globals():
    """Make global variables available to all templates"""
    # Load version info
    version_info = {'version': 'unknown'}
    try:
        version_file = os.path.join(os.path.dirname(__file__), 'version.json')
        if os.path.exists(version_file):
            with open(version_file, 'r') as f:
                version_info = json.load(f)
    except Exception:
        pass
    
    return {
        'neptune_enabled': NEPTUNE_ENABLED,
        'app_version': version_info.get('version', 'unknown')
    }

def get_cognito_public_keys():
    """Get Cognito public keys for JWT verification"""
    if not USER_POOL_ID or not REGION:
        return None
    keys_url = f"https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}/.well-known/jwks.json"
    try:
        response = requests.get(keys_url, timeout=10)
        return response.json()
    except:
        return None

def verify_jwt_token(token):
    """Verify JWT token from Cognito"""
    if not AUTH_AVAILABLE or not CLIENT_ID or not USER_POOL_ID or not REGION:
        return None
    try:
        keys = get_cognito_public_keys()
        if not keys:
            return None
            
        header = jwt.get_unverified_header(token)
        kid = header['kid']
        
        key = None
        for k in keys['keys']:
            if k['kid'] == kid:
                key = k
                break
        
        if not key:
            return None
            
        payload = jwt.decode(
            token,
            key,
            algorithms=['RS256'],
            audience=CLIENT_ID,
            issuer=f"https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}"
        )
        return payload
    except JWTError:
        return None

def require_auth(f):
    """Decorator to require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Skip auth if not available or not configured (development mode)
        if not AUTH_AVAILABLE or not all([COGNITO_DOMAIN, CLIENT_ID, CLIENT_SECRET, USER_POOL_ID, REDIRECT_URI]):
            # Initialize basic session for local development
            if 'user' not in session:
                session['user'] = {'email': 'local@dev', 'role': 'Admin'}
                session.modified = True
            return f(*args, **kwargs)
            
        user = session.get('user')
        if not user:
            return redirect('/login')
        return f(*args, **kwargs)
    return decorated_function

@app.route('/favicon.svg')
def favicon_svg():
    return send_from_directory('static', 'favicon.svg')

@app.route('/health')
def health():
    """Health check endpoint for load balancer"""
    return {'status': 'healthy', 'auth_available': AUTH_AVAILABLE}

@app.route('/version')
def version():
    """Version information endpoint"""
    try:
        version_file = os.path.join(os.path.dirname(__file__), 'version.json')
        if os.path.exists(version_file):
            with open(version_file, 'r') as f:
                return json.load(f)
        else:
            return {'version': 'unknown', 'build_date': 'unknown', 'git_commit': 'unknown'}
    except Exception:
        return {'version': 'unknown', 'build_date': 'unknown', 'git_commit': 'unknown'}

@app.route('/')
def index():
    # Always show the landing page - let users choose to log in
    user = session.get('user', {})
    return render_template('index.html', user=user)

@app.route('/login')
def login():
    """Redirect to Cognito hosted UI"""
    if not all([COGNITO_DOMAIN, CLIENT_ID, REDIRECT_URI]):
        return f"Authentication not configured. COGNITO_DOMAIN: {COGNITO_DOMAIN}, CLIENT_ID: {CLIENT_ID}, REDIRECT_URI: {REDIRECT_URI}", 500
        
    params = {
        'client_id': CLIENT_ID,
        'response_type': 'code',
        'scope': 'openid email profile',
        'redirect_uri': REDIRECT_URI,
    }
    
    login_url = f"{COGNITO_DOMAIN}/login?{urlencode(params)}"
    return redirect(login_url)

@app.route('/callback')
def callback():
    """Handle OAuth callback from Cognito"""
    code = request.args.get('code')
    error = request.args.get('error')
    
    if error:
        return f"Authentication error: {error}", 400
    
    if not code:
        return "No authorization code received", 400
    
    # Check if this code was already processed (prevent double processing)
    if session.get('processed_code') == code:
        return redirect('/explorer')
    
    # Exchange code for tokens
    token_data = {
        'grant_type': 'authorization_code',
        'client_id': CLIENT_ID,
        'code': code,
        'redirect_uri': REDIRECT_URI,
    }
    
    auth_string = f"{CLIENT_ID}:{CLIENT_SECRET}"
    auth_bytes = auth_string.encode('ascii')
    auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
    
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': f'Basic {auth_b64}'
    }
    
    try:
        response = requests.post(f"{COGNITO_DOMAIN}/oauth2/token", data=token_data, headers=headers, timeout=30)
        
        if response.status_code != 200:
            return f"Token exchange failed: {response.text}", 400
            
        tokens = response.json()
        access_token = tokens.get('access_token')
        id_token = tokens.get('id_token')
        
        # Verify and decode ID token with error handling
        try:
            user_info = verify_jwt_token(id_token)
            if not user_info:
                # Fallback: extract basic info from token without full verification
                import json
                # Decode the payload (middle part) of the JWT
                payload_part = id_token.split('.')[1]
                # Add padding if needed
                payload_part += '=' * (4 - len(payload_part) % 4)
                payload = json.loads(base64.b64decode(payload_part))
                user_info = {
                    'email': payload.get('email', 'user@example.com'),
                    'sub': payload.get('sub', 'unknown'),
                    'cognito:groups': payload.get('cognito:groups', [])
                }
        except Exception as e:
            # Final fallback
            user_info = {
                'email': 'user@example.com',
                'sub': 'temp-user-id',
                'cognito:groups': []
            }
        
        # Get user groups
        user_groups = user_info.get('cognito:groups', [])
        user_role = 'Admin' if 'Admin' in user_groups else 'User'
        
        # Store user info in session
        session['user'] = {
            'email': user_info.get('email'),
            'sub': user_info.get('sub'),
            'role': user_role,
            'phone_number': user_info.get('phone_number'),
            'name': user_info.get('name'),
            'access_token': access_token,
            'id_token': id_token
        }
        
        # Mark this code as processed
        session['processed_code'] = code
        
        return redirect('/explorer')
        
    except Exception as e:
        return f"Token request failed: {str(e)}", 500

@app.route('/conversation')
@require_auth
def get_conversation():
    """Proxy conversation requests to agent service"""
    try:
        # Use local@dev as default user_id for local development
        user = session.get('user', {})
        user_id = user.get('email', 'local@dev')
        
        response = requests.get(f"{AGENT_SERVICE_URL}/conversation", 
                              params={'user_id': user_id}, 
                              timeout=30)
        data = response.json()
        return jsonify(data), response.status_code
    except Exception as e:
        print(f"Conversation error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/clear-conversation', methods=['POST'])
@require_auth
def clear_conversation():
    """Proxy clear conversation requests to agent service"""
    try:
        # Use local@dev as default user_id for local development
        user = session.get('user', {})
        user_id = user.get('email', 'local@dev')
        
        response = requests.post(f"{AGENT_SERVICE_URL}/clear-conversation", 
                               json={'user_id': user_id}, 
                               timeout=30)
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/query-streaming-with-events', methods=['POST'])
@require_auth
def query_streaming_with_events():
    """Proxy streaming query requests to agent service"""
    try:
        user = session.get('user', {})
        data = request.get_json()
        # print(f"STREAMING: Request data: {data}")  # Debug logging - commented out to reduce log noise
        
        # Add user context to the request (only fields expected by agent)
        agent_data = {
            'prompt': data.get('prompt', '')
        }
        if user:
            agent_data['user_id'] = user.get('sub') or user.get('email', 'local@dev')
        
        # Make the request to agent service
        agent_response = requests.post(
            f"{AGENT_SERVICE_URL}/query-streaming-with-events",
            json=agent_data,
            stream=True,
            timeout=300
        )
        
        def generate():
            try:
                for chunk in agent_response.iter_content(chunk_size=1, decode_unicode=True):
                    if chunk:
                        yield chunk
            except Exception as e:
                print(f"STREAMING: Generator error: {str(e)}")
                yield f"data: {{'type': 'error', 'message': '{str(e)}'}}\n\n"
        
        return app.response_class(
            generate(),
            mimetype='text/plain',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',  # Disable nginx buffering
                'Access-Control-Allow-Origin': '*',  # Allow CORS for ALB access
                'Access-Control-Allow-Methods': 'POST',
                'Access-Control-Allow-Headers': 'Content-Type',
            }
        )
    except Exception as e:
        print(f"STREAMING: Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(f"Error: {str(e)}", status=500)

@app.route('/streaming-auth-token', methods=['GET'])
@require_auth  
def get_streaming_token():
    """Generate a temporary token for ALB streaming access"""
    user = session.get('user', {})
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401
    
    # Create a simple JWT-like token (in production, use proper JWT)
    import time
    import hashlib
    
    timestamp = int(time.time())
    user_id = user.get('sub', '')
    secret = app.secret_key
    
    # Simple token: timestamp + user_id + hash
    token_data = f"{timestamp}:{user_id}"
    token_hash = hashlib.sha256(f"{token_data}:{secret}".encode()).hexdigest()[:16]
    token = f"{token_data}:{token_hash}"
    
    return jsonify({
        'token': token,
        'alb_url': os.environ.get('ALB_URL', ''),
        'expires_in': 3600  # 1 hour
    })

@app.route('/profile')
@require_auth
def profile():
    """User profile page"""
    user = session.get('user', {})
    return render_template('profile.html', user=user)

@app.route('/logout')
def logout():
    """Logout user and redirect to home"""
    session.clear()
    return redirect('/')

@app.route('/explorer')
@require_auth
def chat_page():
    user = session.get('user', {})
    return render_template('chat.html', agent_service_url=AGENT_SERVICE_URL, user=user)

@app.route('/explorer', methods=['POST'])
@require_auth
def chat():
    try:
        data = request.get_json()
        prompt = data.get('prompt', '')
        file_content = data.get('file_content')
        file_name = data.get('file_name')
        file_type = data.get('file_type')
        mime_type = data.get('mime_type')
        
        # Add user context
        user = session.get('user', {})
        if user:
            data['user_id'] = user.get('sub')
            data['user_role'] = user.get('role')
            data['user_email'] = user.get('email')
            # Add Flask session ID as session identifier
            import flask
            if hasattr(flask.session, 'sid'):
                data['session_id'] = flask.session.sid
            else:
                # Fallback: use a hash of session data for session ID
                import hashlib
                session_data = str(sorted(session.items()))
                data['session_id'] = hashlib.md5(session_data.encode()).hexdigest()[:16]
        
        if not prompt and not file_content:
            return jsonify({'error': 'No prompt or file provided'}), 400
        
        # Handle file content if provided
        if file_content and file_name:
            if file_type == 'image':
                # For images, include the file info in the prompt
                prompt = f"{prompt}\n\n[Image uploaded: {file_name}]" if prompt else f"Analyze this image: {file_name}"
            else:
                # For text files, include content in prompt
                try:
                    if isinstance(file_content, str):
                        file_text = file_content
                    else:
                        file_text = base64.b64decode(file_content).decode('utf-8')
                    prompt = f"{prompt}\n\nFile content ({file_name}):\n{file_text}" if prompt else f"Analyze this file ({file_name}):\n{file_text}"
                except Exception as e:
                    prompt = f"{prompt}\n\n[File uploaded: {file_name} - Error reading content: {str(e)}]" if prompt else f"File uploaded: {file_name} - Error reading content: {str(e)}"
        
        if not prompt:
            return jsonify({'error': 'No prompt provided'}), 400
        
        # Prepare request data for agent service
        if file_content and file_type == 'image':
            # Only include file data for images that need special handling
            agent_data = {
                'prompt': prompt,
                'file_content': file_content,
                'file_name': file_name,
                'file_type': file_type,
                'mime_type': mime_type
            }
        else:
            # For regular text messages and text files, send prompt only
            agent_data = {'prompt': prompt}
        
        # File uploads are handled by dedicated endpoints, this is for chat with file content
        # Since /query endpoint was removed, we need to handle this differently
        # For now, we'll use the streaming endpoint but handle it appropriately
        agent_url = f"{AGENT_SERVICE_URL}/query-streaming-with-events"
        
        def generate():
            try:
                response = requests.post(
                    agent_url,
                    json=agent_data,
                    timeout=300,
                    headers={'Content-Type': 'application/json'}
                )
                
                if response.status_code == 200:
                    # For non-streaming, just return the content as SSE format
                    content = response.text
                    yield f"data: {json.dumps({'type': 'content', 'message': content})}\n\n"
                    yield f"data: {json.dumps({'type': 'done'})}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Agent service error: {response.status_code}'})}\n\n"
                    
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': f'Connection error: {str(e)}'})}\n\n"
        
        return Response(generate(), mimetype='text/event-stream')
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/upload-file', methods=['POST'])
@require_auth
def upload_file_with_actions():
    """Handle file uploads with action buttons"""
    try:
        user = session.get('user', {})
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
            
        # Read file content
        try:
            if file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
                # Handle image files with compression to stay under 5MB Bedrock limit
                from PIL import Image
                import io
                
                # Read and compress image
                image_data = file.read()
                
                # Check if image is already under 5MB
                if len(image_data) <= 5242880:  # 5MB in bytes
                    file_content = base64.b64encode(image_data).decode('utf-8')
                else:
                    # Compress image
                    img = Image.open(io.BytesIO(image_data))
                    
                    # Convert to RGB if necessary
                    if img.mode in ('RGBA', 'P'):
                        img = img.convert('RGB')
                    
                    # Compress with reducing quality until under 5MB
                    quality = 85
                    while quality > 10:
                        output = io.BytesIO()
                        img.save(output, format='JPEG', quality=quality, optimize=True)
                        compressed_data = output.getvalue()
                        
                        if len(compressed_data) <= 5242880:  # 5MB limit
                            file_content = base64.b64encode(compressed_data).decode('utf-8')
                            break
                        
                        quality -= 10
                    else:
                        # If still too large, resize image
                        img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
                        output = io.BytesIO()
                        img.save(output, format='JPEG', quality=70, optimize=True)
                        file_content = base64.b64encode(output.getvalue()).decode('utf-8')
                
                file_type = 'image'
            elif file.filename.lower().endswith('.pdf'):
                # Handle PDF files
                file_content = base64.b64encode(file.read()).decode('utf-8')
                file_type = 'pdf'
            else:
                # Handle text files
                file_content = file.read().decode('utf-8')
                file_type = 'text'
        except UnicodeDecodeError:
            return jsonify({'error': 'Unable to read file content. Please ensure it is a valid text or image file.'}), 400
        filename = file.filename
        
        # Store file content in temporary files instead of session
        file_hash = hashlib.md5(f"{filename}_{file_content[:100]}".encode(), usedforsecurity=False).hexdigest()
        temp_file_path = os.path.join(tempfile.gettempdir(), f"upload_{file_hash}")
        
        with open(temp_file_path, 'w' if file_type == 'text' else 'wb') as f:
            if file_type == 'text':
                f.write(file_content)
            else:
                f.write(base64.b64decode(file_content))
        
        # Store only file reference in session
        if 'uploaded_files' not in session:
            session['uploaded_files'] = {}
        session['uploaded_files'][filename] = {
            'path': temp_file_path,
            'type': file_type,
            'hash': file_hash
        }
        
        # Explicitly mark session as modified
        session.modified = True
        
        # Clean up old temp files (older than 1 hour)
        cleanup_old_temp_files()
        
        # Determine file type and available actions
        file_ext = filename.lower().split('.')[-1] if '.' in filename else ''
        
        # For text-based files, offer action buttons
        text_extensions = ['txt', 'sql', 'xml', 'json', 'csv', 'md', 'py', 'js', 'html', 'css']
        
        if file_type == 'image':
            actions = ['Analyze']
            content_preview = f"[Image: {filename}]"
        elif file_type == 'pdf':
            actions = ['Add to KB', 'Add to Conversation']
            content_preview = f"[PDF Document: {filename}]"
        elif file_ext in text_extensions:
            actions = ['Analyze', 'Add to KB', 'Add to Conversation']
            # Add "Add to Graph DB" option for specific file types if Neptune is enabled
            if NEPTUNE_ENABLED and file_ext in ['txt', 'csv', 'sql']:
                actions.append('Add to Graph DB')
            content_preview = file_content[:200] + '...' if len(file_content) > 200 else file_content
        else:
            actions = ['Analyze']
            content_preview = file_content[:200] + '...' if len(file_content) > 200 else file_content
            
        return jsonify({
            'status': 'success',
            'message': f'Processing file: {filename}',
            'filename': filename,
            'file_type': file_ext,
            'actions': actions,
            'content_preview': content_preview
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/file-action', methods=['POST'])
@require_auth
def handle_file_action():
    """Handle file action button clicks"""
    try:
        data = request.get_json()
        action = data.get('action')
        filename = data.get('filename')
        
        if not action or not filename:
            return jsonify({'error': 'Missing action or filename'}), 400
            
        # Get file content from session
        uploaded_files = session.get('uploaded_files', {})
        
        if filename not in uploaded_files:
            return jsonify({'error': 'File not found in session'}), 404
            
        file_data = uploaded_files[filename]
        
        # Only support new format - clear old format data
        if isinstance(file_data, str) or 'path' not in file_data:
            return jsonify({'error': 'File format outdated, please re-upload the file'}), 400
        
        # Check if temp file still exists
        if not os.path.exists(file_data['path']):
            return jsonify({'error': 'Temporary file has been cleaned up, please re-upload'}), 404
        
        # Read file content from temporary file
        try:
            if file_data['type'] == 'text':
                with open(file_data['path'], 'r') as f:
                    file_content = f.read()
            else:
                with open(file_data['path'], 'rb') as f:
                    file_content = base64.b64encode(f.read()).decode('utf-8')
        except FileNotFoundError:
            return jsonify({'error': 'File not found, please re-upload'}), 404
            
        file_type = file_data['type']
        
        # Create appropriate prompt based on action and file type
        if file_type == 'image':
            # Technical prompt for the agent (with file path)
            agent_prompt = f"I've uploaded an image called {filename}. Can you analyze what's in this image? The image file path is: {file_data['path']}"
            # Clean prompt for the user (without file path)
            user_prompt = f"I've uploaded an image called {filename}. Can you analyze what's in this image?"
        elif file_type == 'pdf':
            if action == 'Add to KB':
                agent_prompt = f"I have a PDF document called {filename} that I'd like to add to our knowledge base for future reference. [PDF data: {filename}]"
                user_prompt = agent_prompt
            elif action == 'Add to Conversation':
                agent_prompt = f"Here's a PDF document called {filename} that I'd like to discuss. [PDF data: {filename}]"
                user_prompt = agent_prompt
            else:
                return jsonify({'error': f'Unknown action for PDF: {action}'}), 400
        else:
            # Text file prompts
            if action == 'Analyze':
                agent_prompt = f"I've uploaded a file called {filename}. Can you help me understand what this contains and provide insights?\n\n{file_content}"
                user_prompt = agent_prompt
            elif action == 'Add to KB':
                agent_prompt = f"I have some content from {filename} that I'd like to add to our knowledge base for future reference:\n\n{file_content}"
                user_prompt = agent_prompt
            elif action == 'Add to Conversation':
                agent_prompt = f"Here's some content from {filename} that I'd like to discuss:\n\n{file_content}"
                user_prompt = agent_prompt
            elif action == 'Add to Graph DB':
                agent_prompt = f"I have a {filename} file that I'd like to add to the graph database for analysis. The file has been uploaded to the ETL bucket."
                user_prompt = agent_prompt
            else:
                return jsonify({'error': f'Unknown action: {action}'}), 400
            
        return jsonify({
            'status': 'success',
            'prompt': user_prompt,  # Clean prompt for UI display
            'agent_prompt': agent_prompt,  # Technical prompt for agent
            'action': action,
            'filename': filename
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/graph-schema')
@require_auth
def graph_schema_page():
    """Graph Schema editor page"""
    user = session.get('user')
    return render_template('graph_schema.html', user=user)

import re
from collections import defaultdict

def validate_schema(schema):
    """Validate graph schema format and return errors"""
    error_map = defaultdict(list)
    
    # Normalize the content first
    normalized_content = schema
    
    # Replace various arrow combinations with the correct symbol
    arrow_variations = [')>[', ')->[', ') ->[', ')-> [']
    for variant in arrow_variations:
        normalized_content = normalized_content.replace(variant, ')→[')
    
    # Replace various dash combinations with the correct symbol
    dash_variations = [']-(', '] -(', ']--(', '] --(']
    for variant in dash_variations:
        normalized_content = normalized_content.replace(variant, ']—(')
    
    # Remove all spaces from the content
    lines = []
    for line in normalized_content.split('\n'):
        cleaned_line = re.sub(r'\s+', '', line.strip())
        if cleaned_line:  # Only add non-empty lines
            lines.append(cleaned_line)
    
    normalized_content = '\n'.join(lines)
    
    # Regex for valid line format: [Block1]—(Relation)→[Block2]
    line_regex = re.compile(r'^\[([^\s\[\]]+)\]—\(([^\s\(\)]+)\)→\[([^\s\[\]]+)\]$')
    
    for index, line in enumerate(lines):
        if not line.strip():
            continue
            
        line_number = index + 1
        errors = []
        
        if not line_regex.match(line.strip()):
            # Collect all errors for this line
            if '—(' not in line:
                errors.append('Missing correct dash before relation')
            if ')→' not in line:
                errors.append('Missing correct arrow')
            if line.count('[') != 2:
                errors.append('Should have exactly two blocks in square brackets')
            if line.count('(') != 1:
                errors.append('Should have exactly one relation in parentheses')
            
            if not errors:
                errors.append('Invalid format')
            
            error_map[line_number] = errors
    
    # Convert error map to list of formatted errors
    formatted_errors = [
        {'line': line, 'messages': messages}
        for line, messages in error_map.items()
    ]
    
    return {
        'isValid': len(formatted_errors) == 0,
        'errors': formatted_errors,
        'normalizedContent': normalized_content
    }

@app.route('/data-loader')
@require_auth
def data_loader():
    """Data Loader main page"""
    user = session.get('user')
    return render_template('data_loader.html', user=user)

@app.route('/data-loader/<load_id>')
@require_auth
def data_loader_detail(load_id):
    """Data Loader detail page"""
    user = session.get('user')
    return render_template('data_loader_detail.html', user=user)

@app.route('/api/data-loader-test')
@require_auth
def api_data_loader_test():
    """Test endpoint to debug data loader issues"""
    try:
        import boto3
        from decimal import Decimal
        
        # Test basic functionality
        result = {
            'boto3_available': True,
            'decimal_available': True,
            'aws_region': os.environ.get('AWS_REGION', 'us-east-1')
        }
        
        # Test DynamoDB connection
        try:
            dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
            table_name = 'AI-Data-Explorer-Bulk-Load-Log'
            table = dynamodb.Table(table_name)
            
            # Try to describe the table (doesn't require scan permissions)
            table_info = table.table_status
            result['dynamodb_connection'] = True
            result['table_status'] = table_info
            
        except Exception as e:
            result['dynamodb_connection'] = False
            result['dynamodb_error'] = str(e)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': f'Test failed: {str(e)}'}), 500

@app.route('/api/data-loader-debug')
@require_auth
def api_data_loader_debug():
    """Debug endpoint to see raw DynamoDB data"""
    try:
        dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
        table_name = 'AI-Data-Explorer-Bulk-Load-Log'
        table = dynamodb.Table(table_name)
        
        # Get just one item to see the structure
        response = table.scan(Limit=1)
        items = response.get('Items', [])
        
        if not items:
            return jsonify({'message': 'No items found in table'})
        
        # Return the raw item structure as text
        item = items[0]
        result = {}
        for key, value in item.items():
            result[key] = {
                'value': str(value),
                'type': str(type(value).__name__)
            }
        
        return jsonify({
            'raw_item': result,
            'item_count': len(items)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/data-loader-data')
@require_auth
def api_data_loader_data():
    """API endpoint to get data loader data from DynamoDB"""
    try:
        # Get DynamoDB table
        dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
        table_name = 'AI-Data-Explorer-Bulk-Load-Log'
        table = dynamodb.Table(table_name)
        
        # Scan the table to get all items
        try:
            response = table.scan()
            items = response.get('Items', [])
            
            # Continue scanning if there are more items
            while 'LastEvaluatedKey' in response:
                response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
                items.extend(response.get('Items', []))
        except Exception as scan_error:
            logger.error(f"DynamoDB scan error: {str(scan_error)}")
            return jsonify({'error': f'Database scan failed: {str(scan_error)}'}), 500
        
        # Process items to ensure proper data types
        try:
            processed_items = []
            for item in items:
                # Convert each item individually with better error handling
                processed_item = {}
                for key, value in item.items():
                    if isinstance(value, Decimal):
                        processed_item[key] = float(value)
                    elif hasattr(value, 'value'):  # Binary type
                        processed_item[key] = str(value.value) if value.value else ''
                    elif isinstance(value, bytes):  # Raw binary
                        processed_item[key] = value.decode('utf-8', errors='ignore')
                    else:
                        processed_item[key] = value
                processed_items.append(processed_item)
        except Exception as process_error:
            logger.error(f"Item processing error: {str(process_error)}")
            return jsonify({'error': f'Data processing failed: {str(process_error)}'}), 500
        
        return jsonify({
            'data': processed_items,
            'recordsTotal': len(processed_items),
            'recordsFiltered': len(processed_items)
        })
        
    except Exception as e:
        logger.error(f"Error fetching data loader data: {str(e)}")
        return jsonify({'error': f'Failed to fetch data: {str(e)}'}), 500

@app.route('/api/data-loader-detail/<load_id>')
@require_auth
def api_data_loader_detail(load_id):
    """API endpoint to get specific data loader detail from DynamoDB"""
    try:
        # Get DynamoDB table
        dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
        table_name = 'AI-Data-Explorer-Bulk-Load-Log'
        table = dynamodb.Table(table_name)
        
        # Get the specific item
        response = table.get_item(Key={'loadId': load_id})
        
        if 'Item' not in response:
            return jsonify({'error': 'Load ID not found'}), 404
        
        item = response['Item']
        
        # Process item to ensure proper data types
        processed_item = {}
        for key, value in item.items():
            if isinstance(value, Decimal):
                processed_item[key] = float(value)
            elif hasattr(value, 'value'):  # Binary type
                processed_item[key] = str(value.value) if value.value else ''
            elif isinstance(value, bytes):  # Raw binary
                processed_item[key] = value.decode('utf-8', errors='ignore')
            else:
                processed_item[key] = value
        
        # Parse the loader response if it exists
        parsed_response = None
        
        # First try the payload field (already parsed)
        if 'payload' in processed_item and processed_item['payload']:
            parsed_response = processed_item['payload']
        
        # If no payload, try to parse loaderResponse
        elif 'loaderResponse' in processed_item and processed_item['loaderResponse']:
            try:
                loader_response = processed_item['loaderResponse']
                
                # Handle base64 encoded binary data
                if isinstance(loader_response, str) and loader_response:
                    try:
                        # Try to decode as base64 first
                        import base64
                        decoded = base64.b64decode(loader_response).decode('utf-8')
                        parsed_response = json.loads(decoded)
                    except:
                        # If base64 fails, try direct JSON parsing
                        parsed_response = json.loads(loader_response)
                else:
                    parsed_response = loader_response
                    
            except (json.JSONDecodeError, TypeError, ValueError) as e:
                logger.warning(f"Could not parse loaderResponse for load ID {load_id}: {str(e)}")
        
        if parsed_response:
            processed_item['parsedResponse'] = parsed_response
        
        return jsonify({
            'data': processed_item,
            'debug': {
                'has_loaderResponse': 'loaderResponse' in processed_item,
                'has_parsedResponse': 'parsedResponse' in processed_item,
                'loaderResponse_type': type(processed_item.get('loaderResponse', None)).__name__,
                'loaderResponse_preview': str(processed_item.get('loaderResponse', ''))[:200] if processed_item.get('loaderResponse') else None
            }
        })
        
    except Exception as e:
        logger.error(f"Error fetching data loader detail for {load_id}: {str(e)}")
        return jsonify({'error': f'Failed to fetch detail: {str(e)}'}), 500

@app.route('/etl-processor')
@require_auth
def etl_results_page():
    """ETL Processor Results page"""
    user = session.get('user')
    return render_template('etl_results.html', user=user)

@app.route('/etl-processor/data', methods=['GET'])
@require_auth
def get_etl_results():
    """Get ETL results from DynamoDB with pagination and filtering"""
    try:
        import boto3
        from boto3.dynamodb.conditions import Key, Attr
        
        # Get query parameters
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 25))
        search = request.args.get('search', '').strip()
        sort_by = request.args.get('sort_by', 'timestamp')
        sort_order = request.args.get('sort_order', 'desc')
        
        dynamodb = boto3.resource('dynamodb')
        table_name = 'AI-Data-Explorer-ETL-Log'
        table = dynamodb.Table(table_name)
        
        # Scan with filters
        scan_kwargs = {}
        if search:
            scan_kwargs['FilterExpression'] = (
                Attr('file_name').contains(search) |
                Attr('node_label').contains(search) |
                Attr('status_message').contains(search)
            )
        
        response = table.scan(**scan_kwargs)
        items = response['Items']
        
        # Sort items
        reverse = sort_order == 'desc'
        if sort_by == 'timestamp':
            items.sort(key=lambda x: x.get('timestamp', ''), reverse=reverse)
        elif sort_by == 'file_name':
            items.sort(key=lambda x: x.get('file_name', ''), reverse=reverse)
        elif sort_by == 'status_code':
            items.sort(key=lambda x: int(x.get('status_code', 0)), reverse=reverse)
        elif sort_by == 'row_count':
            items.sort(key=lambda x: int(x.get('row_count', 0)), reverse=reverse)
        
        # Pagination
        total = len(items)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_items = items[start:end]
        
        return jsonify({
            'items': paginated_items,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/etl-processor/<item_id>')
@require_auth
def etl_result_detail_page(item_id):
    """ETL result detail page"""
    user = session.get('user')
    return render_template('etl_result_detail.html', user=user, item_id=item_id)

@app.route('/etl-processor/<item_id>/data', methods=['GET'])
@require_auth
def get_etl_result_detail(item_id):
    """Get detailed ETL result by ID using scan (since we don't have timestamp in URL)"""
    try:
        import boto3
        from boto3.dynamodb.conditions import Attr
        
        dynamodb = boto3.resource('dynamodb')
        table_name = 'AI-Data-Explorer-ETL-Log'
        table = dynamodb.Table(table_name)
        
        # Use scan to find the item by ID
        response = table.scan(
            FilterExpression=Attr('id').eq(item_id)
        )
        
        if not response['Items']:
            return jsonify({'error': 'Item not found'}), 404
            
        return jsonify(response['Items'][0])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/graph-schema/preview', methods=['POST'])
@require_auth
def preview_graph_schema():
    """Generate graph data from schema content"""
    try:
        data = request.get_json()
        schema_content = data.get('schema', '')
        
        nodes = set()
        links = []
        
        if schema_content.strip():
            lines = schema_content.split('\n')
            for line in lines:
                # Match pattern: [Block1]—(Relation)→[Block2]
                import re
                match = re.search(r'\[([^\]]+)\]—\(([^\)]+)\)→\[([^\]]+)\]', line)
                if match:
                    source, relation, target = match.groups()
                    nodes.add(source)
                    nodes.add(target)
                    links.append({
                        'source': source,
                        'target': target,
                        'label': relation
                    })
        
        graph_data = {
            'nodes': [{'id': node, 'name': node} for node in nodes],
            'links': links
        }
        
        return jsonify(graph_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/graph-schema/validate', methods=['POST'])
@require_auth
def validate_graph_schema():
    """Validate graph schema format"""
    try:
        data = request.get_json()
        schema_content = data.get('schema', '')
        
        validation_result = validate_schema(schema_content)
        return jsonify(validation_result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/graph-schema/load', methods=['GET'])
@require_auth
def load_graph_schema():
    """Load graph schema from S3 or local fallback for development"""
    try:
        # Try to load from S3 first (for deployed environments)
        if os.environ.get('NEPTUNE_ETL_BUCKET'):
            import boto3
            s3_client = boto3.client('s3')
            bucket_name = os.environ.get('NEPTUNE_ETL_BUCKET')
            
            response = s3_client.get_object(Bucket=bucket_name, Key='public/schema/graph.txt')
            schema_content = response['Body'].read().decode('utf-8')
            return jsonify({'schema': schema_content})
        else:
            # Fallback to local demo file for development
            local_schema_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'demo_graph.txt')
            if os.path.exists(local_schema_path):
                with open(local_schema_path, 'r') as f:
                    schema_content = f.read()
                return jsonify({'schema': schema_content})
            else:
                return jsonify({'error': 'No graph schema available. Deploy with --with-graph-db or ensure demo_graph.txt exists.'}), 404
                
    except Exception as e:
        # If S3 file doesn't exist, return empty schema for user to fill in
        if 'NoSuchKey' in str(e):
            return jsonify({'schema': ''})
        # For other S3 errors, return the error
        return jsonify({'error': str(e)}), 500

@app.route('/graph-schema/save', methods=['POST'])
@require_auth
def save_graph_schema():
    """Save graph schema to S3 or local file for development"""
    try:
        data = request.get_json()
        schema_content = data.get('schema', '')
        
        # Try to save to S3 first (for deployed environments)
        if os.environ.get('NEPTUNE_ETL_BUCKET'):
            import boto3
            s3_client = boto3.client('s3')
            bucket_name = os.environ.get('NEPTUNE_ETL_BUCKET')
            
            s3_client.put_object(
                Bucket=bucket_name,
                Key='public/schema/graph.txt',
                Body=schema_content.encode('utf-8'),
                ContentType='text/plain'
            )
            return jsonify({'success': True, 'message': 'Schema saved to S3 successfully'})
        else:
            # Fallback to local file for development
            local_schema_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'demo_graph.txt')
            with open(local_schema_path, 'w') as f:
                f.write(schema_content)
            return jsonify({'success': True, 'message': 'Schema saved locally for development'})
            
    except Exception as e:
        # If S3 fails, try local fallback
        try:
            if not os.environ.get('NEPTUNE_ETL_BUCKET'):
                local_schema_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'demo_graph.txt')
                with open(local_schema_path, 'w') as f:
                    f.write(schema_content)
                return jsonify({'success': True, 'message': 'Schema saved locally (S3 unavailable)'})
        except:
            pass
        return jsonify({'error': str(e)}), 500

@app.route('/upload-to-kb', methods=['POST'])
@require_auth
def upload_to_kb():
    """Upload file directly to S3 knowledge base"""
    try:
        filename = request.json.get('filename')
        if not filename:
            return jsonify({'error': 'Missing filename'}), 400
            
        # Get file from session
        uploaded_files = session.get('uploaded_files', {})
        if filename not in uploaded_files:
            return jsonify({'error': 'File not found in session'}), 404
            
        file_data = uploaded_files[filename]
        if not os.path.exists(file_data['path']):
            return jsonify({'error': 'Temporary file not found'}), 404
        
        # Get S3 configuration
        bucket_name = os.environ.get('KB_S3_BUCKET_NAME')
        products_kb_id = os.environ.get('PRODUCTS_KB_ID')
        products_ds_id = os.environ.get('PRODUCTS_DS_ID')
        
        if not bucket_name:
            return jsonify({'error': 'S3 bucket not configured'}), 500
            
        # Upload to S3
        s3_client = boto3.client('s3')
        s3_key = f"products/{secure_filename(filename)}"
        
        with open(file_data['path'], 'rb') as f:
            s3_client.upload_fileobj(f, bucket_name, s3_key)
        
        # Trigger data source sync if KB configured
        if products_kb_id and products_ds_id:
            bedrock_client = boto3.client('bedrock-agent')
            bedrock_client.start_ingestion_job(
                knowledgeBaseId=products_kb_id,
                dataSourceId=products_ds_id
            )
            
        return jsonify({
            'status': 'success',
            'message': f'File {filename} uploaded to knowledge base',
            's3_key': s3_key
        })
        
    except ClientError as e:
        return jsonify({'error': f'S3 upload failed: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/upload-to-graph-db', methods=['POST'])
@require_auth
def upload_to_graph_db():
    """Upload file to S3 Neptune ETL bucket for graph database processing"""
    try:
        filename = request.json.get('filename')
        if not filename:
            return jsonify({'error': 'Missing filename'}), 400
            
        # Get file from session
        uploaded_files = session.get('uploaded_files', {})
        if filename not in uploaded_files:
            return jsonify({'error': 'File not found in session'}), 404
            
        file_data = uploaded_files[filename]
        if not os.path.exists(file_data['path']):
            return jsonify({'error': 'Temporary file not found'}), 404
        
        # Get Neptune ETL bucket configuration
        bucket_name = os.environ.get('NEPTUNE_ETL_BUCKET')
        
        if not bucket_name:
            return jsonify({'error': 'Neptune ETL bucket not configured'}), 500
            
        # Upload to S3 with 'incoming/' prefix
        s3_client = boto3.client('s3')
        s3_key = f"incoming/{secure_filename(filename)}"
        
        with open(file_data['path'], 'rb') as f:
            s3_client.upload_fileobj(f, bucket_name, s3_key)
            
        return jsonify({
            'status': 'success',
            'message': f'File {filename} uploaded to graph database ETL bucket',
            's3_key': s3_key,
            'bucket': bucket_name
        })
        
    except ClientError as e:
        return jsonify({'error': f'S3 upload failed: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get-file-content', methods=['POST'])
@require_auth
def get_file_content():
    """Get raw file content for data analysis"""
    try:
        data = request.get_json()
        filename = data.get('filename')
        
        if not filename:
            return jsonify({'error': 'Missing filename'}), 400
            
        # Get file from session
        uploaded_files = session.get('uploaded_files', {})
        if filename not in uploaded_files:
            return jsonify({'error': 'File not found in session'}), 404
            
        file_data = uploaded_files[filename]
        if not os.path.exists(file_data['path']):
            return jsonify({'error': 'Temporary file not found'}), 404
        
        # Read raw file content
        try:
            if file_data['type'] == 'text':
                with open(file_data['path'], 'r') as f:
                    file_content = f.read()
            else:
                with open(file_data['path'], 'rb') as f:
                    file_content = base64.b64encode(f.read()).decode('utf-8')
        except FileNotFoundError:
            return jsonify({'error': 'File not found, please re-upload'}), 404
            
        return jsonify({
            'status': 'success',
            'filename': filename,
            'content': file_content,
            'file_type': file_data['type']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/upload', methods=['POST'])
@require_auth  
def upload_file():
    """Legacy file upload endpoint - keep for image uploads"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        content = file.read()
        filename = secure_filename(file.filename)
        
        if filename.lower().endswith(('.sql', '.ddl')):
            prompt = f"Convert this SQL schema to graph model:\n\n{content.decode('utf-8')}"
        elif filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
            encoded_image = base64.b64encode(content).decode('utf-8')
            prompt = f"Analyze this image: [Image data: {filename}]"
        else:
            prompt = f"Analyze this file ({filename}):\n\n{content.decode('utf-8', errors='ignore')}"
        
        return jsonify({'prompt': prompt})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get-image/<filename>')
def proxy_get_image(filename):
    """Proxy image requests to the agent service"""
    try:
        # Validate filename to prevent path traversal
        import re
        if not re.match(r'^[a-zA-Z0-9_.-]+$', filename):
            return "Invalid filename", 400
            
        # Only allow requests to pre-configured trusted agent service URL
        agent_service_url = os.getenv('AGENT_SERVICE_URL', 'http://127.0.0.1:8000')
        
        # Strict allowlist validation for agent service URL
        allowed_patterns = [
            r'^http://127\.0\.0\.1:\d+$',
            r'^http://localhost:\d+$', 
            r'^http://internal-.*\.elb\.amazonaws\.com$',
            r'^http://.*\.us-east-1\.elb\.amazonaws\.com$',
            r'^http://.*\.us-east-2\.elb\.amazonaws\.com$',
            r'^http://.*\.us-west-2\.elb\.amazonaws\.com$',
            r'^http://.*\.eu-central-1\.elb\.amazonaws\.com$',
            r'^http://.*\.ap-southeast-2\.elb\.amazonaws\.com$'
        ]
        
        import re
        if not any(re.match(pattern, agent_service_url) for pattern in allowed_patterns):
            return "Invalid agent service URL", 400
            
        # Set timeout based on environment
        if os.getenv('AWS_EXECUTION_ENV') or os.getenv('ECS_CONTAINER_METADATA_URI'):
            timeout = 60  # Much longer timeout for AWS
        else:
            timeout = 10  # Local development
            
        print(f"Using agent URL: {agent_service_url}")
        print(f"Proxying image request to: {agent_service_url}/query-get-image/{filename}")
        
        # Use query-get-image path that routes to agent service via existing /query* pattern
        agent_image_url = f"{agent_service_url}/query-get-image/{filename}"
        response = requests.get(agent_image_url, timeout=timeout) # nosemgrep: python.flask.security.injection.ssrf-requests.ssrf-requests
        print(f"Agent service response: {response.status_code}")
        
        if response.status_code == 200:
            # Return the image with proper content type
            content_type = response.headers.get('content-type', 'application/octet-stream')
            return Response(response.content, mimetype=content_type)
        else:
            print(f"Agent service error: {response.text}")
            return f"Agent service returned {response.status_code}", response.status_code
            
    except Exception as e:
        print(f"Error proxying image request: {str(e)}")
        return f"Error loading image: {str(e)}", 500

@app.route('/query-get-image/<filename>')
def proxy_query_get_image(filename):
    """Proxy query-get-image requests to the agent service (for local development)"""
    return proxy_get_image(filename)

# Data Analyzer Routes
@app.route('/data-analyzer')
@require_auth
def data_analyzer_results():
    """Display Data Analyzer results page"""
    user = session.get('user')
    return render_template('data_analyzer_results.html', user=user)

@app.route('/data-analyzer/data', methods=['GET'])
@require_auth
def get_data_analyzer_results():
    """Get Data Analyzer results from DynamoDB"""
    try:
        table_name = os.environ.get('DATA_ANALYZER_LOG_TABLE', 'AI-Data-Explorer-Data-Analyzer-Log')
        if not table_name:
            return jsonify({'data': []})
            
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(table_name)
        
        response = table.scan()
        results = response.get('Items', [])
        
        # Convert Decimal to float for JSON serialization
        for result in results:
            for key, value in result.items():
                if isinstance(value, Decimal):
                    result[key] = float(value)
        
        return jsonify({'data': results})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            logger.warning(f"Table {table_name} not found")
            return jsonify({'data': []})
        logger.error(f"Error fetching data analyzer results: {str(e)}")
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        logger.error(f"Error fetching data analyzer results: {str(e)}")
        return jsonify({'data': []})

@app.route('/data-analyzer/<result_id>')
@require_auth
def data_analyzer_detail(result_id):
    """Display Data Analyzer detail page"""
    user = session.get('user')
    return render_template('data_analyzer_detail.html', user=user, result_id=result_id)

@app.route('/data-analyzer/<result_id>/data', methods=['GET'])
@require_auth
def get_data_analyzer_detail(result_id):
    """Get specific Data Analyzer result from DynamoDB"""
    try:
        table_name = os.environ.get('DATA_ANALYZER_LOG_TABLE', 'AI-Data-Explorer-Data-Analyzer-Log')
        if not table_name:
            return jsonify({'error': 'Table not configured'}), 404
            
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(table_name)
        
        # Query by partition key only since we don't know the file_name
        response = table.query(
            KeyConditionExpression='id = :id',
            ExpressionAttributeValues={':id': result_id}
        )
        
        items = response.get('Items', [])
        if not items:
            return jsonify({'error': 'Result not found'}), 404
        
        # Return the first item (there should only be one per id)
        result = items[0]
        
        # Convert Decimal to float for JSON serialization
        for key, value in result.items():
            if isinstance(value, Decimal):
                result[key] = float(value)
        
        return jsonify(result)
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            return jsonify({'error': 'Table not found'}), 404
        logger.error(f"Error fetching data analyzer detail: {str(e)}")
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        logger.error(f"Error fetching data analyzer detail: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Schema Translator Routes
@app.route('/schema-translator')
@require_auth
def schema_translator_results():
    """Display Schema Translator results page"""
    user = session.get('user')
    return render_template('schema_translator_results.html', user=user)

@app.route('/schema-translator/data', methods=['GET'])
@require_auth
def get_schema_translator_results():
    """Get Schema Translator results from DynamoDB"""
    try:
        table_name = os.environ.get('SCHEMA_TRANSLATOR_LOG_TABLE', 'AI-Data-Explorer-Schema-Translator-Log')
        if not table_name:
            return jsonify({'data': []})
            
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(table_name)
        
        response = table.scan()
        results = response.get('Items', [])
        
        # Convert Decimal to float for JSON serialization
        for result in results:
            for key, value in result.items():
                if isinstance(value, Decimal):
                    result[key] = float(value)
        
        return jsonify({'data': results})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            logger.warning(f"Table {table_name} not found")
            return jsonify({'data': []})
        logger.error(f"Error fetching schema translator results: {str(e)}")
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        logger.error(f"Error fetching schema translator results: {str(e)}")
        return jsonify({'data': []})

@app.route('/schema-translator/<result_id>')
@require_auth
def schema_translator_detail(result_id):
    """Display Schema Translator detail page"""
    user = session.get('user')
    return render_template('schema_translator_detail.html', user=user, result_id=result_id)

@app.route('/schema-translator/<result_id>/data', methods=['GET'])
@require_auth
def get_schema_translator_detail(result_id):
    """Get specific Schema Translator result from DynamoDB"""
    try:
        table_name = os.environ.get('SCHEMA_TRANSLATOR_LOG_TABLE', 'AI-Data-Explorer-Schema-Translator-Log')
        if not table_name:
            return jsonify({'error': 'Table not configured'}), 404
            
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(table_name)
        
        # Query by partition key only since we don't know the timestamp
        response = table.query(
            KeyConditionExpression='id = :id',
            ExpressionAttributeValues={':id': result_id}
        )
        
        items = response.get('Items', [])
        if not items:
            return jsonify({'error': 'Result not found'}), 404
        
        # Return the first item (there should only be one per id)
        result = items[0]
        
        # Convert Decimal to float for JSON serialization
        for key, value in result.items():
            if isinstance(value, Decimal):
                result[key] = float(value)
        
        return jsonify(result)
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            return jsonify({'error': 'Table not found'}), 404
        logger.error(f"Error fetching schema translator detail: {str(e)}")
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        logger.error(f"Error fetching schema translator detail: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/set-models', methods=['POST'])
@require_auth
def set_models():
    """Proxy endpoint to set multiple models on agent service."""
    try:
        data = request.get_json()
        response = requests.post(f"{AGENT_SERVICE_URL}/set-models", json=data, timeout=10)
        return response.json(), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/get-models', methods=['GET'])
@require_auth
def get_models():
    """Proxy endpoint to get current models from agent service."""
    try:
        response = requests.get(f"{AGENT_SERVICE_URL}/get-models", timeout=10)
        return response.json(), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/feedback')
@require_auth
def feedback_page():
    """Feedback page - Admin only"""
    user = session.get('user')
    if user.get('role') != 'Admin':
        return redirect(url_for('index'))
    return render_template('feedback.html', user=user)

@app.route('/feedback/data', methods=['GET'])
@require_auth
def get_feedback():
    """Get feedback from DynamoDB - Admin only"""
    user = session.get('user')
    if user.get('role') != 'Admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        # Get query parameters
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 25))
        search = request.args.get('search', '').strip()
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')
        
        dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
        table_name = 'AI-Data-Explorer-Feedback'
        table = dynamodb.Table(table_name)
        
        # Scan with filters
        scan_kwargs = {}
        if search:
            from boto3.dynamodb.conditions import Attr
            scan_kwargs['FilterExpression'] = (
                Attr('user_id').contains(search) |
                Attr('user_message').contains(search) |
                Attr('assistant_message').contains(search) |
                Attr('feedback').contains(search)
            )
        
        response = table.scan(**scan_kwargs)
        items = response['Items']
        
        # Sort items
        reverse = sort_order == 'desc'
        if sort_by == 'created_at':
            items.sort(key=lambda x: x.get('created_at', ''), reverse=reverse)
        elif sort_by == 'sentiment':
            items.sort(key=lambda x: x.get('sentiment', ''), reverse=reverse)
        elif sort_by == 'user_id':
            items.sort(key=lambda x: x.get('user_id', ''), reverse=reverse)
        
        # Pagination
        total = len(items)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_items = items[start:end]
        
        return jsonify({
            'items': paginated_items,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/feedback/<feedback_id>')
@require_auth
def feedback_detail_page(feedback_id):
    """Feedback detail page - Admin only"""
    user = session.get('user')
    if user.get('role') != 'Admin':
        return redirect(url_for('index'))
    return render_template('feedback_detail.html', user=user, feedback_id=feedback_id)

@app.route('/feedback/<feedback_id>/data', methods=['GET'])
@require_auth
def get_feedback_detail(feedback_id):
    """Get detailed feedback by ID - Admin only"""
    user = session.get('user')
    if user.get('role') != 'Admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
        table_name = 'AI-Data-Explorer-Feedback'
        table = dynamodb.Table(table_name)
        
        # Scan for the feedback_id since it's not the primary key
        from boto3.dynamodb.conditions import Attr
        response = table.scan(
            FilterExpression=Attr('feedback_id').eq(feedback_id)
        )
        
        if not response['Items']:
            return jsonify({'error': 'Feedback not found'}), 404
        
        return jsonify(response['Items'][0])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/submit-feedback', methods=['POST'])
@require_auth
def submit_feedback():
    """Submit user feedback to DynamoDB"""
    try:
        data = request.get_json()
        
        # Get DynamoDB table
        dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
        table_name = 'AI-Data-Explorer-Feedback'
        table = dynamodb.Table(table_name)
        
        # Prepare feedback item
        feedback_item = {
            'feedback_id': str(uuid.uuid4()),
            'timestamp': data.get('timestamp'),
            'user_id': data.get('user_id'),
            'user_message': data.get('user_message'),
            'assistant_message': data.get('assistant_message'),
            'sentiment': data.get('sentiment'),  # 'positive' or 'negative'
            'feedback': data.get('feedback', ''),
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        # Store in DynamoDB
        table.put_item(Item=feedback_item)
        
        return jsonify({'success': True}), 200
        
    except Exception as e:
        print(f"Error submitting feedback: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Reason: This is a development server configuration only used in local environment
    # Production deployment uses gunicorn with proper host configuration    
    app.run(host='0.0.0.0', port=5000, debug=True) #nosec B104, B201 # nosemgrep python.flask.security.audit.app-run-param-config.avoid_app_run_with_bad_host,python.flask.security.audit.debug-enabled.debug-enabled
