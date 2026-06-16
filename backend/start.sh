#!/bin/sh
# This script ensures the PORT variable is expanded correctly
echo "Starting Uvicorn on port $PORT"
uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
