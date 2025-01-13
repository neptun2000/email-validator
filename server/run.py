import uvicorn
import sys
from pathlib import Path

# Add the server directory to Python path
server_dir = Path(__file__).parent
sys.path.append(str(server_dir))

if __name__ == "__main__":
    print("Starting Email Validation Platform...")
    try:
        uvicorn.run(
            "app:app",
            host="0.0.0.0",
            port=5000,
            reload=True,
            reload_dirs=[str(server_dir)]
        )
    except KeyboardInterrupt:
        print("\nShutting down FastAPI server...")
        sys.exit(0)
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)