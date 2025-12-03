"""
WSGI entry point for Phusion Passenger (Netcup Webhosting)
This file is required for deployment on Netcup webhosting
"""

import sys
import os

# Add the application directory to the Python path
app_dir = os.path.dirname(__file__)
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

# Add site-packages directory to Python path (for bundled dependencies)
site_packages = os.path.join(app_dir, 'site-packages')
if os.path.exists(site_packages) and site_packages not in sys.path:
    sys.path.insert(0, site_packages)

# Add vendor directory for dependencies (if using local packages)
vendor_dir = os.path.join(app_dir, 'vendor')
if os.path.exists(vendor_dir) and vendor_dir not in sys.path:
    sys.path.insert(0, vendor_dir)

# Import the ASGI application
from main import socket_app

# Phusion Passenger requires a WSGI application
# We need to wrap the ASGI app for WSGI compatibility
try:
    from asgiref.wsgi import WsgiToAsgi
    application = WsgiToAsgi(socket_app)
except ImportError:
    # Fallback: Try using uvicorn's WSGI adapter
    print("Warning: asgiref not found. WebSocket support may be limited.")
    print("Install with: pip install asgiref")
    
    # Create a basic WSGI wrapper
    class ASGItoWSGI:
        def __init__(self, asgi_app):
            self.asgi_app = asgi_app
            
        def __call__(self, environ, start_response):
            # This is a simplified adapter - for full functionality install asgiref
            from io import BytesIO
            
            # Convert WSGI environ to ASGI scope
            scope = {
                'type': 'http',
                'asgi': {'version': '3.0'},
                'http_version': '1.1',
                'method': environ['REQUEST_METHOD'],
                'scheme': environ.get('wsgi.url_scheme', 'http'),
                'path': environ.get('PATH_INFO', '/'),
                'query_string': environ.get('QUERY_STRING', '').encode(),
                'root_path': environ.get('SCRIPT_NAME', ''),
                'headers': [],
                'server': (environ.get('SERVER_NAME'), int(environ.get('SERVER_PORT', 80))),
            }
            
            # Add headers
            for key, value in environ.items():
                if key.startswith('HTTP_'):
                    header_name = key[5:].replace('_', '-').lower()
                    scope['headers'].append((header_name.encode(), value.encode()))
            
            # Handle the request
            status = '200 OK'
            headers = [('Content-Type', 'text/html')]
            start_response(status, headers)
            
            return [b'QuizKnaller is running. Please use asgiref for full WebSocket support.']
    
    application = ASGItoWSGI(socket_app)
