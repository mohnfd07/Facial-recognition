from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class LecturerLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str

class UserBase(BaseModel):
    name: str
    matric_number: str

class UserCreate(UserBase):
    encoding: str

class User(UserBase):
    id: int

    class Config:
        from_attributes = True

class SessionBase(BaseModel):
    name: str

class SessionCreate(SessionBase):
    pass

class Session(SessionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class RecognitionLogBase(BaseModel):
    name: Optional[str] = None
    matric_number: Optional[str] = None
    distance: Optional[str] = None
    success: bool
    timestamp: datetime
    session_id: Optional[int] = None

class RecognitionLog(RecognitionLogBase):
    id: int

    class Config:
        from_attributes = True
