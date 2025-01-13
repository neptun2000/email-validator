import subprocess
import sys
import time
import os
import signal
from pathlib import Path

def run_fastapi():
    try:
        # Change to the server directory
        server_dir = Path(__file__).parent
        os.chdir(server_dir)

        # Start FastAPI server
        print("Starting FastAPI server...")
        fastapi_process = subprocess.Popen(
            ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        return fastapi_process
    except Exception as e:
        print(f"Error starting FastAPI server: {e}")
        sys.exit(1)

def run_express():
    try:
        # Start Express server
        print("Starting Express server...")
        express_process = subprocess.Popen(
            ["npm", "run", "dev"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        return express_process
    except Exception as e:
        print(f"Error starting Express server: {e}")
        sys.exit(1)

def main():
    # Start FastAPI first
    fastapi_process = run_fastapi()

    # Give FastAPI a moment to start
    time.sleep(2)

    # Start Express server
    express_process = run_express()

    try:
        # Monitor both processes
        while True:
            if fastapi_process.poll() is not None:
                print("FastAPI server stopped unexpectedly")
                express_process.terminate()
                sys.exit(1)
            if express_process.poll() is not None:
                print("Express server stopped unexpectedly")
                fastapi_process.terminate()
                sys.exit(1)
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down servers...")
        fastapi_process.send_signal(signal.SIGTERM)
        express_process.send_signal(signal.SIGTERM)
        sys.exit(0)

if __name__ == "__main__":
    main()