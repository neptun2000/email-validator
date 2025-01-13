import sys
import os
from pathlib import Path

if __name__ == "__main__":
    try:
        # Change to the server directory for Python imports
        server_dir = Path(__file__).parent
        os.chdir(server_dir)

        print("Starting Email Validation Platform...")

        # Import FastAPI app and run it
        import uvicorn
        from app import app

        config = uvicorn.Config(
            app=app,
            host="0.0.0.0",  # Listen on all interfaces
            port=8000,
            reload=True,
            log_level="info"
        )
        server = uvicorn.Server(config)
        server.run()

    except KeyboardInterrupt:
        print("\nShutting down server...")
        sys.exit(0)
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)