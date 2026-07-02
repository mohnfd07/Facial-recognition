from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from typing import List, Optional
import json
import numpy as np
import os
import sys
import logging


# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Ensure backend directory is in sys.path
current_dir = os.path.dirname(os.path.realpath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

# Absolute imports for maximum reliability
import models
import schemas
import utils
from database import engine, get_db
from auth import get_current_lecturer, require_super_admin, verify_password, hash_password, create_access_token, seed_super_admin

# Create database tables
models.Base.metadata.create_all(bind=engine)

from database import SessionLocal
_db = SessionLocal()
try:
    seed_super_admin(_db)
finally:
    _db.close()

app = FastAPI(title="Facial Recognition API")

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Facial Recognition API is running"}

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/auth/login", response_model=schemas.Token)
def login(credentials: schemas.LecturerLogin, db: Session = Depends(get_db)):
    lecturer = db.query(models.Lecturer).filter(models.Lecturer.username == credentials.username).first()
    if not lecturer or not verify_password(credentials.password, lecturer.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if lecturer.role != "super_admin" and lecturer.status != "approved":
        detail = "Your account is pending approval" if lecturer.status == "pending" else "Your account has been rejected"
        raise HTTPException(status_code=403, detail=detail)
    token = create_access_token({"sub": lecturer.username})
    return {"access_token": token, "token_type": "bearer", "role": lecturer.role, "username": lecturer.username}

@app.post("/auth/signup", response_model=schemas.Lecturer)
def signup(credentials: schemas.LecturerSignup, db: Session = Depends(get_db)):
    existing = db.query(models.Lecturer).filter(models.Lecturer.username == credentials.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    new_lecturer = models.Lecturer(
        username=credentials.username,
        hashed_password=hash_password(credentials.password),
        role="lecturer",
        status="pending"
    )
    db.add(new_lecturer)
    db.commit()
    db.refresh(new_lecturer)
    return new_lecturer

@app.get("/lecturers", response_model=List[schemas.Lecturer])
def get_lecturers(db: Session = Depends(get_db), current=Depends(require_super_admin)):
    return db.query(models.Lecturer).filter(models.Lecturer.role != "super_admin").order_by(models.Lecturer.created_at.desc()).all()

@app.post("/lecturers/{lecturer_id}/approve", response_model=schemas.Lecturer)
def approve_lecturer(lecturer_id: int, db: Session = Depends(get_db), current=Depends(require_super_admin)):
    lecturer = db.query(models.Lecturer).filter(models.Lecturer.id == lecturer_id).first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer not found")
    lecturer.status = "approved"
    db.commit()
    db.refresh(lecturer)
    return lecturer

@app.delete("/lecturers/{lecturer_id}")
def remove_lecturer(lecturer_id: int, db: Session = Depends(get_db), current=Depends(require_super_admin)):
    lecturer = db.query(models.Lecturer).filter(models.Lecturer.id == lecturer_id).first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer not found")
    if lecturer.role == "super_admin":
        raise HTTPException(status_code=403, detail="Cannot remove super admin")
    db.delete(lecturer)
    db.commit()
    return {"message": f"Lecturer {lecturer_id} removed"}

@app.post("/register", response_model=schemas.User)
async def register_user(name: str = Form(...), matric_number: str = Form(...), file: UploadFile = File(...), db: Session = Depends(get_db)):
    logger.info(f"Received registration request for user: {name} ({matric_number})")
    # Check if matric number already exists
    db_user = db.query(models.User).filter(models.User.matric_number == matric_number).first()
    if db_user:
        logger.warning(f"Matric number {matric_number} already registered")
        raise HTTPException(status_code=400, detail="Matric number already registered")

    contents = await file.read()
    # Run heavy CPU task in a thread pool to avoid blocking the event loop
    encoding = await run_in_threadpool(utils.get_face_encoding, contents)
    
    if encoding is None:
        logger.warning(f"No face detected for user: {name}")
        raise HTTPException(status_code=400, detail="No face detected in the image")

    new_user = models.User(name=name, matric_number=matric_number, encoding=json.dumps(encoding))
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Log the registration
    reg_log = models.RecognitionLog(
        name=name,
        matric_number=matric_number,
        distance="NEW REG",
        success=True
    )
    db.add(reg_log)
    db.commit()

    logger.info(f"User {name} registered successfully")
    return new_user

@app.post("/recognize")
async def recognize_user(file: UploadFile = File(...), session_id: Optional[str] = Form(None), db: Session = Depends(get_db)):
    logger.info("Received recognition request")
    contents = await file.read()
    # Run heavy CPU task in a thread pool
    encoding = await run_in_threadpool(utils.get_face_encoding, contents)
    
    parsed_session_id = int(session_id) if session_id else None

    if encoding is None:
        logger.warning("No face detected in recognition attempt")
        # Save a fail log
        fail_log = models.RecognitionLog(success=False, session_id=parsed_session_id)
        db.add(fail_log)
        db.commit()
        raise HTTPException(status_code=400, detail="No face detected in the image")

    users = db.query(models.User).all()
    best_match = None
    min_distance = 1.0 # Cosine distance max is 2.0

    for user in users:
        stored_encoding = json.loads(user.encoding)
        
        # Skip profiles that don't match the current model's encoding size (e.g., VGG vs Facenet)
        if len(stored_encoding) != len(encoding):
            logger.warning(f"Skipping profile {user.name}: encoding size mismatch")
            continue

        a = np.array(encoding)
        b = np.array(stored_encoding)
        distance = 1 - np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
        
        if distance < 0.4 and distance < min_distance:
            min_distance = distance
            best_match = {"name": user.name, "matric_number": user.matric_number}

    # Save log entry
    log_entry = models.RecognitionLog(
        name=best_match["name"] if best_match else "Unknown",
        matric_number=best_match["matric_number"] if best_match else "N/A",
        distance=str(round(float(min_distance), 4)) if best_match else "N/A",
        success=True if best_match else False,
        session_id=parsed_session_id
    )
    db.add(log_entry)
    db.commit()

    if best_match:
        logger.info(f"Match found: {best_match['name']} (distance: {min_distance})")
        return {"match": True, **best_match, "distance": float(min_distance)}
    else:
        logger.info("No match found")
        return {"match": False, "detail": "No match found"}

@app.get("/profiles", response_model=List[schemas.User])
def get_profiles(db: Session = Depends(get_db), current=Depends(require_super_admin)):
    return db.query(models.User).all()

@app.delete("/profiles/{user_id}")
def delete_profile(user_id: int, db: Session = Depends(get_db), current=Depends(require_super_admin)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(db_user)
    db.commit()
    return {"message": f"User {user_id} deleted"}

@app.delete("/profiles")
def delete_all_profiles(db: Session = Depends(get_db), current=Depends(require_super_admin)):
    db.query(models.User).delete()
    db.commit()
    return {"message": "All profiles deleted"}

@app.get("/logs", response_model=List[schemas.RecognitionLog])
def get_logs(db: Session = Depends(get_db), current=Depends(require_super_admin)):
    return db.query(models.RecognitionLog).order_by(models.RecognitionLog.timestamp.desc()).limit(100).all()

@app.delete("/logs")
def delete_all_logs(db: Session = Depends(get_db), current=Depends(require_super_admin)):
    db.query(models.RecognitionLog).delete()
    db.commit()
    return {"message": "All logs cleared"}

@app.post("/sessions", response_model=schemas.Session)
def create_session(session: schemas.SessionCreate, db: Session = Depends(get_db), current=Depends(get_current_lecturer)):
    new_session = models.Session(name=session.name, lecturer_id=current.id)
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

@app.get("/sessions", response_model=List[schemas.Session])
def get_sessions(db: Session = Depends(get_db), current=Depends(get_current_lecturer)):
    query = db.query(models.Session, models.Lecturer.username).outerjoin(models.Lecturer, models.Session.lecturer_id == models.Lecturer.id)
    if current.role != "super_admin":
        query = query.filter(models.Session.lecturer_id == current.id)
    results = query.order_by(models.Session.created_at.desc()).all()
    sessions = []
    for session_obj, username in results:
        session_dict = {
            "id": session_obj.id,
            "name": session_obj.name,
            "created_at": session_obj.created_at,
            "lecturer_username": username,
        }
        sessions.append(session_dict)
    return sessions

@app.get("/sessions/{session_id}/logs", response_model=List[schemas.RecognitionLog])
def get_session_logs(session_id: int, db: Session = Depends(get_db), current=Depends(get_current_lecturer)):
    session_obj = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")
    if current.role != "super_admin" and session_obj.lecturer_id != current.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this session")
    return db.query(models.RecognitionLog).filter(
        models.RecognitionLog.session_id == session_id
    ).order_by(models.RecognitionLog.timestamp.desc()).all()

if __name__ == "__main__":
    import uvicorn
    # Get port from environment variable (standard for Railway/Render)
    port = int(os.environ.get("PORT", 8000))
    logger.info(f"Starting server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
