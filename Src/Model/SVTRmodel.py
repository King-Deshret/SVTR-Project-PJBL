import os
os.environ['FLAGS_use_onednn'] = '0'
os.environ['PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK'] = 'True'

from paddleocr import PaddleOCR
import cv2
import numpy as np
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
from Src.Preprocessing.enhancedpicture import EnhancedPicture


class SVTRModel:

    def __init__(self):
        self.ocr = PaddleOCR(
            use_textline_orientation=True,
            lang='en',
            device='cpu',
            enable_mkldnn=False,
            det_limit_side_len=640,
            det_limit_type='min',
        )
        self.preprocessor = EnhancedPicture()
        print("Model SVTR berhasil dibuat")

    def detect(self, image):
        result = self.ocr.ocr(image, rec=False)
        if not result or result[0] is None:
            print("[DETECTION] Tidak ada teks terdeteksi.")
            return []
        first = result[0]
        if isinstance(first, dict):
            boxes = first.get('dt_polys', [])
        elif isinstance(first, list):
            boxes = [line[0] for line in first]
        else:
            boxes = []
        print(f"[DETECTION] {len(boxes)} area teks ditemukan.")
        return boxes

    def recognize(self, image):
        result = self.ocr.ocr(image, det=False)
        if not result or result[0] is None:
            print("[RECOGNITION] Tidak ada teks terbaca.")
            return []
        first = result[0]
        recognition_results = []
        if isinstance(first, dict):
            rec_texts  = first.get('rec_texts',  [])
            rec_scores = first.get('rec_scores', [])
            for i, text in enumerate(rec_texts):
                conf = rec_scores[i] if i < len(rec_scores) else 0.0
                recognition_results.append((text, conf))
                print(f"[RECOGNITION] '{text}' — {conf*100:.2f}%")
        elif isinstance(first, list):
            for line in first:
                text = line[0]
                conf = line[1]
                recognition_results.append((text, conf))
                print(f"[RECOGNITION] '{text}' — {conf*100:.2f}%")
        return recognition_results

    def predict(self, image):
        result = self.ocr.ocr(image)
        if not result or result[0] is None:
            print("[PREDICT] Tidak ada teks terdeteksi.")
            return []
        first = result[0]
        if isinstance(first, dict):
            rec_texts  = first.get('rec_texts',  [])
            rec_scores = first.get('rec_scores', [])
            rec_polys  = first.get('rec_polys',  [])
            if not rec_texts:
                print("[PREDICT] rec_texts kosong.")
                return []
            output = []
            for i, text in enumerate(rec_texts):
                confidence = rec_scores[i] if i < len(rec_scores) else 0.0
                box        = rec_polys[i]  if i < len(rec_polys)  else []
                if confidence >= 0.90:
                    status = "HIGH"
                elif confidence >= 0.70:
                    status = "MEDIUM"
                else:
                    status = "LOW — perlu review manual"
                output.append({
                    'text'      : text,
                    'confidence': confidence,
                    'box'       : box,
                    'status'    : status
                })
                print(f"[PREDICT] '{text}' — {confidence*100:.1f}% — {status}")
            return output
        elif isinstance(first, list):
            output = []
            for line in first:
                if not isinstance(line, (list, tuple)) or len(line) < 2:
                    continue
                box        = line[0]
                text       = line[1][0]
                confidence = line[1][1]
                if confidence >= 0.90:
                    status = "HIGH"
                elif confidence >= 0.70:
                    status = "MEDIUM"
                else:
                    status = "LOW — perlu review manual"
                output.append({
                    'text'      : text,
                    'confidence': confidence,
                    'box'       : box,
                    'status'    : status
                })
            return output
        print(f"[PREDICT] Format tidak dikenal: {type(first)}")
        return []

    def predict_from_file(self, image_path):
        image = cv2.imread(image_path)
        if image is None:
            print(f"[ERROR] Gambar tidak ditemukan: {image_path}")
            return []
        print(f"\n{'='*50}")
        print(f"[INPUT] {image_path}")
        print(f"[SIZE]  {image.shape[1]}×{image.shape[0]} px")
        print(f"{'='*50}")
        print("\n[PREPROCESSING]")
        processed = self.preprocessor.process(image_path)
        print("\n[SVTR INFERENCE]")
        results = self.predict(processed)
        if not results:
            print("[FALLBACK] Coba tanpa preprocessing...")
            results = self.predict(image)
        return results

    def visualize(self, image_path, results):
        image = cv2.imread(image_path)
        if image is None or not results:
            return
        for item in results:
            box        = item['box']
            text       = item['text']
            confidence = item['confidence']
            status     = item['status']
            if 'HIGH' in status:
                color = (0, 200, 0)
            elif 'MEDIUM' in status:
                color = (0, 165, 255)
            else:
                color = (0, 0, 220)
            pts = np.array(box, dtype=np.int32)
            cv2.polylines(image, [pts], isClosed=True,
                          color=color, thickness=2)
            label = f"{text} ({confidence*100:.1f}%)"
            x, y  = int(box[0][0]), int(box[0][1]) - 8
            cv2.putText(image, label, (x, y),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5,
                        color, 1, cv2.LINE_AA)
        cv2.imshow("SVTR Detection Result", image)
        cv2.waitKey(0)
        cv2.destroyAllWindows()


if __name__ == "__main__":
    model    = SVTRModel()
    img_path = "Data/Raw/Ultramilk.jpeg"
    results  = model.predict_from_file(img_path)
    print(f"\n{'='*50}")
    print("HASIL DETEKSI & RECOGNITION")
    print(f"{'='*50}")
    if not results:
        print("Tidak ada teks terdeteksi.")
    else:
        for i, item in enumerate(results, 1):
            print(f"\n[{i}] Teks       : {item['text']}")
            print(f"    Confidence : {item['confidence']:.4f} "
                  f"({item['confidence']*100:.2f}%)")
            print(f"    Status     : {item['status']}")
        model.visualize(img_path, results)