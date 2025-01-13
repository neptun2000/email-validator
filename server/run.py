import asyncio
import subprocess
import sys
import os
from pathlib import Path

async def run_node_server():
    """Run the Node.js frontend server"""
    try:
        print("[Node] Starting Node.js frontend server...")
        node_process = await asyncio.create_subprocess_exec(
            'npm', 'run', 'dev',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(Path(__file__).parent.parent)  # Run from project root
        )

        async def pipe_output(pipe, prefix):
            while True:
                line = await pipe.readline()
                if not line:
                    break
                print(f'[{prefix}]', line.decode().strip())

        await asyncio.gather(
            pipe_output(node_process.stdout, 'Node'),
            pipe_output(node_process.stderr, 'Node Error')
        )

    except Exception as e:
        print(f"[Node] Error starting frontend server: {e}")
        raise

async def run_python_server():
    """Run the FastAPI backend server"""
    try:
        print("[Python] Starting FastAPI backend server...")

        # Import here to ensure dependencies are loaded
        import uvicorn
        from app import app

        config = uvicorn.Config(
            app=app,
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_level="info"
        )
        server = uvicorn.Server(config)
        await server.serve()
    except Exception as e:
        print(f"[Python] Error starting backend server: {e}")
        raise

async def main():
    try:
        # Change to the server directory for Python imports
        server_dir = Path(__file__).parent
        os.chdir(server_dir)

        print("Starting Email Validation Platform...")

        # Run both servers concurrently
        await asyncio.gather(
            run_python_server(),
            run_node_server()
        )
    except Exception as e:
        print(f"Fatal error in main: {e}")
        sys.exit(1)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down servers...")
        sys.exit(0)
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)