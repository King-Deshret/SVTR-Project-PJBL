import cv2
import numpy as np
import os

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(current_dir, "..", "..", "Data", "Processed", "enhancedtest.jpg")

def preprocess_image(image_path):
    """
    Fungsi preprocessing
    1. Grayscale
    2. CLAHE 
    3. Denoising 
    """

    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(f"Gambar tidak ditemukan: {image_path}")
    
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    denoised = cv2.medianBlur(enhanced, 3)
    return denoised

if __name__ == "__main__":
    sample_img = r"D:\SVTR-Project\SVTR-Project-PJBL\Data\Raw\kemasan.jpg"
    try:
        result = preprocess_image(sample_img)
        cv2.imwrite("SVTR-Project-PJBL/Data/Processed/enhancedtest.jpg", result)
        print("Berhasil! Cek file di data/processed/test_enhanced.jpg")
    except Exception as e:
        print(f" Error: {e}")