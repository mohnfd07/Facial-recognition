# Facial Recognition System Documentation

## Project Overview
This project is a full-stack facial recognition system designed for secure identification. It allows users to register their faces along with a name and unique matriculation number. Once registered, the system can identify the user in real-time through a webcam interface.

## Core Features
1. Face Registration: Capture and store face embeddings linked to a specific name and matric number.
2. Identity Recognition: Real-time identification of registered individuals with an accuracy confidence score.
3. Administrative Control: A secure "Profiles" section where an administrator can view and manage registered users.
4. Privacy Guard: A circular capture guide that masks and removes the background from images before processing to ensure privacy and focus.
5. Security Lock: Administrative functions are protected by a shared secret password to prevent unauthorized access.

## Technical Stack
- Frontend: React (TypeScript), Tailwind CSS, Lucide Icons, React-Webcam.
- Backend: FastAPI (Python), DeepFace (Facenet AI Model), SQLAlchemy.
- Database: PostgreSQL (Cloud-hosted via Neon).
- Deployment: Docker (Backend), Railway (API hosting), Vercel (Frontend hosting).

## Local Startup Instructions
Detailed instructions for starting the system on a local machine are provided in the instructions.md file. Briefly:
1. Backend: Activate the Python virtual environment and run the Uvicorn server on port 8000.
2. Frontend: Navigate to the frontend directory and run "npm start" to launch the interface on port 3000.

## Implementation Details
The backend is containerized using Docker to ensure all necessary Linux system libraries are present for AI processing. The system uses the Facenet model, which is optimized for high accuracy and low memory usage, making it ideal for cloud environments with limited resources.

The database logic includes a fallback mechanism; if the production PostgreSQL database is unreachable, the system will automatically utilize a local SQLite file to ensure continuous operation during development.

## Deployment Configuration
- Backend: Hosted on Railway using a Dockerfile that handles all system dependencies.
- Frontend: Hosted on Vercel with environment variables pointing to the Railway API URL.
- Security: CORS policies are configured to allow secure communication between the frontend and backend domains.
