from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from typing import List
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

# Create database tables
models.Base.metadata.create_all(bind=engine)

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
    logger.info(f"User {name} registered successfully")
    return new_user

@app.post("/recognize")
async def recognize_user(file: UploadFile = File(...), db: Session = Depends(get_db)):
    logger.info("Received recognition request")
    contents = await file.read()
    # Run heavy CPU task in a thread pool
    encoding = await run_in_threadpool(utils.get_face_encoding, contents)
    
    if encoding is None:
        logger.warning("No face detected in recognition attempt")
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

    if best_match:
        logger.info(f"Match found: {best_match['name']} (distance: {min_distance})")
        return {"match": True, **best_match, "distance": float(min_distance)}
    else:
        logger.info("No match found")
        return {"match": False, "detail": "No match found"}

@app.get("/profiles", response_model=List[schemas.User])
def get_profiles(db: Session = Depends(get_db)):
    return db.query(models.User).all()

@app.delete("/profiles/{user_id}")
def delete_profile(user_id: int, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(db_user)
    db.commit()
    return {"message": f"User {user_id} deleted"}

@app.delete("/profiles")
def delete_all_profiles(db: Session = Depends(get_db)):
    db.query(models.User).delete()
    db.commit()
    return {"message": "All profiles deleted"}

if __name__ == "__main__":
    import uvicorn
    # Get port from environment variable (standard for Railway/Render)
    port = int(os.environ.get("PORT", 8000))
    logger.info(f"Starting server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
