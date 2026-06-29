from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    matric_number = Column(String, unique=True, index=True)
    # Store face encoding as a JSON string or comma-separated values
    encoding = Column(Text)

class Lecturer(Base):
    __tablename__ = "lecturers"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="lecturer")  # "lecturer" or "super_admin"
    status = Column(String, default="pending")  # "pending", "approved", "rejected"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    lecturer_id = Column(Integer, ForeignKey("lecturers.id"), nullable=True)
    logs = relationship("RecognitionLog", back_populates="session")

class RecognitionLog(Base):
    __tablename__ = "recognition_logs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)
    matric_number = Column(String, nullable=True)
    distance = Column(Text, nullable=True) # Storing as text for flexibility
    success = Column(Boolean, default=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True)
    session = relationship("Session", back_populates="logs")
