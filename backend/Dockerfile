# Use Python 3.11 as it's the most stable for AI libraries
FROM python:3.11-slim

# Install system libraries needed for OpenCV and AI processing
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libxcb1 \
    libx11-6 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Ensure uvicorn is installed
RUN pip install uvicorn

# Give execution permissions to the start script
RUN chmod +x start.sh

# Use the script to start the application
CMD ["/bin/sh", "start.sh"]
