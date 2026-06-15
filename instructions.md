# Local Setup & Startup Instructions

Follow these steps to run the Facial Recognition System on your local machine.

## 1. Start the Backend (FastAPI)
Open a new terminal and run:
```powershell
# Navigate to the backend folder
cd backend

# Activate the virtual environment
.\venv\Scripts\activate

# Start the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
*The backend will be live at: http://localhost:8000*

## 2. Start the Frontend (React)
Open a second terminal and run:
```powershell
# Navigate to the frontend folder
cd frontend

# Start the React development server
npm start
```
*The frontend will be live at: http://localhost:3000*

---

## Troubleshooting Local Connection
- **API URL:** The app automatically switches to `http://localhost:8000` when it detects you are on `localhost`.
- **CORS:** If you see "Network Error" in the browser console, ensure the backend is actually running on port 8000.
- **Model Loading:** The first time you use the system, the backend will take ~30 seconds to load the AI model into your RAM.
- **Database:** Locally, the system defaults to a file named `facial_recognition.db`. If you want to use the cloud database locally, add your `DATABASE_URL` to a `.env` file inside the `backend/` folder.
