# start_all.py
"""
VentureScout AI — Start Backend + Frontend Together
"""

import sys
import os
import webbrowser
import threading
import time
import subprocess

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJECT_ROOT)

print("=" * 50)
print("🚀 VentureScout AI")
print("=" * 50)

def start_backend():
    """Start the FastAPI backend"""
    from src.api.main import app
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)

def start_frontend():
    """Start a simple HTTP server for frontend"""
    frontend_dir = os.path.join(PROJECT_ROOT, "frontend")
    os.chdir(frontend_dir)
    subprocess.run([sys.executable, "-m", "http.server", "3000"])

def open_browser():
    """Open both URLs after servers start"""
    time.sleep(3)
    print("\n🌐 Opening in browser...")
    webbrowser.open("http://localhost:3000")
    webbrowser.open("http://localhost:8000/docs")

if __name__ == "__main__":
    # Start backend
    backend_thread = threading.Thread(target=start_backend, daemon=True)
    backend_thread.start()
    
    # Start frontend
    frontend_thread = threading.Thread(target=start_frontend, daemon=True)
    frontend_thread.start()
    
    # Open browser
    threading.Thread(target=open_browser, daemon=True).start()
    
    print("\n✅ Backend: http://localhost:8000")
    print("✅ Frontend: http://localhost:3000")
    print("✅ API Docs: http://localhost:8000/docs")
    print("\nPress Ctrl+C to stop all servers.")
    print("=" * 50)
    
    # Keep alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Shutting down...")
        sys.exit(0)