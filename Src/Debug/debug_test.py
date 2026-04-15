import sys
import os

# Paksa Python ambil dari folder project, bukan cache
sys.path.insert(0, r'D:\SVTR-Project')

# Bersihkan module yang sudah ter-cache di session ini
for mod in list(sys.modules.keys()):
    if 'SVTRmodel' in mod or 'enhancedpicture' in mod:
        del sys.modules[mod]

import cv2
from Src.Preprocessing.enhancedpicture import EnhancedPicture
from Src.Model.SVTRmodel import SVTRModel

img_path = r'D:\SVTR-Project\Data\Raw\Ultramilk.jpeg'

# Verifikasi method tersedia
print("Methods di SVTRModel:", [m for m in dir(SVTRModel) if not m.startswith('_')])

# TEST 1 — tanpa preprocessing
print("="*40)
print("TEST 1: Tanpa preprocessing")
model = SVTRModel()
img   = cv2.imread(img_path)
print(f"Ukuran gambar: {img.shape}")
results = model.predict(img)
print(f"Hasil: {results}")

# TEST 2 — dengan preprocessing
print("="*40)
print("TEST 2: Dengan preprocessing")
results2 = model.predict_from_file(img_path)
print(f"Hasil: {results2}")
