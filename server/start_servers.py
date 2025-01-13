import sys
import uvicorn

def main():
    print("Starting Email Validation Platform...")
    try:
        uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)
    except KeyboardInterrupt:
        print("\nShutting down FastAPI server...")
        sys.exit(0)
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()