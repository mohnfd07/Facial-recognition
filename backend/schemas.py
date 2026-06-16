from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class UserBase(BaseModel):
    name: str
    matric_number: str

class UserCreate(UserBase):
    encoding: str

class User(UserBase):
    id: int

    class Config:
        from_attributes = True

class RecognitionLogBase(BaseModel):
    name: Optional[str] = None
    matric_number: Optional[str] = None
    distance: Optional[str] = None
    success: bool
    timestamp: datetime

class RecognitionLog(RecognitionLogBase):
    id: int

    class Config:
        from_attributes = True
