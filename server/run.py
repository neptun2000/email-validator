import asyncio
import subprocess
import sys
import os
from pathlib import Path

async def run_node_server():
    node_process = await asyncio.create_subprocess_exec(
        'npm', 'run', 'dev',
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )

    while True:
        try:
            line = await node_process.stdout.readline()
            if not line:
                break
            print('[Node]', line.decode().strip())
        except Exception as e:
            print(f"Error reading Node.js output: {e}")
            break

async def run_python_server():
    try:
        import uvicorn
        config = uvicorn.Config("app:app", host="0.0.0.0", port=8000, reload=True)
        server = uvicorn.Server(config)
        await server.serve()
    except Exception as e:
        print(f"Error starting Python server: {e}")
        raise

async def main():
    try:
        # Change to the server directory
        server_dir = Path(__file__).parent
        os.chdir(server_dir)

        # Run both servers
        await asyncio.gather(
            run_python_server(),
            run_node_server()
        )
    except Exception as e:
        print(f"Error in main: {e}")
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