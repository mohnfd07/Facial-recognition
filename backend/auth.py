import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, Header
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session as DBSession

import models
from database import get_db

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 12  # 12 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_lecturer(authorization: str = Header(None), db: DBSession = Depends(get_db)) -> models.Lecturer:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    lecturer = db.query(models.Lecturer).filter(models.Lecturer.username == username).first()
    if lecturer is None:
        raise HTTPException(status_code=401, detail="Lecturer not found")
    return lecturer

def require_super_admin(current: models.Lecturer = Depends(get_current_lecturer)) -> models.Lecturer:
    if current.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return current

def seed_super_admin(db: DBSession):
    existing = db.query(models.Lecturer).filter(models.Lecturer.role == "super_admin").first()
    if existing:
        return
    username = os.environ.get("SUPER_ADMIN_USERNAME")
    password = os.environ.get("SUPER_ADMIN_PASSWORD")
    if not username or not password:
        return
    admin = models.Lecturer(
        username=username,
        hashed_password=hash_password(password),
        role="super_admin"
    )
    db.add(admin)
    db.commit()
