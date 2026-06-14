from pydantic import BaseModel
from typing import List

class UserBase(BaseModel):
    name: str

class UserCreate(UserBase):
    encoding: str

class User(UserBase):
    id: int

    class Config:
        from_attributes = True
