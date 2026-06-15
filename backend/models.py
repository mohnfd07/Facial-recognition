from sqlalchemy import Column, Integer, String, Text
try:
    from database import Base
except ImportError:
    from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    matric_number = Column(String, unique=True, index=True)
    # Store face encoding as a JSON string or comma-separated values
    encoding = Column(Text)
