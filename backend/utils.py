import cv2
import numpy as np
from deepface import DeepFace
import os
import tempfile
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Force DeepFace to use CPU if needed, but usually it's fine.
# We'll use Facenet as it's highly accurate but much lighter than VGG-Face.
MODEL_NAME = "Facenet"

logger.info(f"Using DeepFace model: {MODEL_NAME}")

def get_face_encoding(image_bytes):
    """
    Extracts a face encoding (embedding) from image bytes using DeepFace.
    """
    # Create a temporary file to save the image bytes
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        tmp.write(image_bytes)
        tmp_path = tmp.name

    try:
        logger.info("Starting face detection and encoding...")
        # DeepFace.represent returns a list of dictionaries (one for each face detected)
        results = DeepFace.represent(
            img_path=tmp_path, 
            model_name=MODEL_NAME, 
            enforce_detection=True,
            detector_backend='opencv' # Faster for prototypes
        )
        
        if not results:
            logger.warning("No face detected in the image.")
            return None
        
        logger.info(f"Face detected! Encoding size: {len(results[0]['embedding'])}")
        # Return the embedding of the first face detected
        return results[0]["embedding"]
    except Exception as e:
        logger.error(f"Error extracting encoding: {e}")
        return None
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

def compare_encodings(encoding1, encoding2, threshold=0.4):
    """
    Compares two encodings using cosine similarity.
    DeepFace embeddings are usually compared with cosine distance.
    Lower distance = more similar.
    """
    if encoding1 is None or encoding2 is None:
        return False
    
    # Simple cosine distance calculation
    a = np.array(encoding1)
    b = np.array(encoding2)
    distance = 1 - np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
    
    return distance < threshold
