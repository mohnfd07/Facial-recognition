from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    matric_number = Column(String, unique=True, index=True)
    # Store face encoding as a JSON string or comma-separated values
    encoding = Column(Text)

class RecognitionLog(Base):
    __tablename__ = "recognition_logs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)
    matric_number = Column(String, nullable=True)
    distance = Column(Text, nullable=True) # Storing as text for flexibility
    success = Column(Boolean, default=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
