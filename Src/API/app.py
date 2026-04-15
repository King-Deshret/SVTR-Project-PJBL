from flask import Flask, request, jsonify
import cv2
import numpy as np
import os
from Src.Preprocessing.enhancedpicture import EnhancedPicture
from Src.Model.SVTRmodel import SVTRModel
os.add_dll_directory(r"D:\SVTR-Project\ocr_env\Lib\site-packages\paddle\base")
app = Flask(__name__)

RAW_FOLDER = 'Data/Raw'
PROCESSED_FOLDER = 'Data/Processed'
os.makedirs(RAW_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

ai_engine = SVTRModel()
preprocessor = EnhancedPicture()

@app.route('/') 
def home():
    return "Welcome home dawg - Server Preprocessing Aktif"

@app.route('/cek-koneksi', methods=['GET'])
def hello():
    return jsonify({"pesan": "API SVTR sudah aktif, siap menerima kiriman gambar!"})

@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({"error": "File tidak ditemukan"}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "Nama file kosong"}), 400

    raw_path = os.path.join(RAW_FOLDER, file.filename)
    file.save(raw_path)

    try:
        results = ai_engine.predict_from_file(raw_path)

        print(f"[DEBUG] Type results : {type(results)}")
        print(f"[DEBUG] Isi results  : {results}")

        if not results:
            print("[FALLBACK] Coba recognition langsung tanpa preprocessing...")
            raw_img = cv2.imread(raw_path)
            results = ai_engine.predict(raw_img)
            return jsonify({
                "status": "Re-Capture",
                "message": "Teks tidak terdeteksi, silakan ambil foto ulang"
            }), 200

        if not isinstance(results, list):
            return jsonify({"error": f"Format hasil tidak valid: {type(results)}"}), 500

        top_result = results[0]

        if not isinstance(top_result, dict):
            return jsonify({"error": f"Format top_result tidak valid: {top_result}"}), 500

        confidence = top_result['confidence']
        final_status = "Ok" if confidence >= 0.85 else "Re-Capture"

        return jsonify({
            "status": final_status,
            "message": "Proses selesai",
            "data": {
                "detected_text": top_result['text'],
                "confidence_score": round(float(confidence), 4),
                "ai_status": top_result['status'],
                "processed_file": "processed_" + file.filename
            }
        })

    except Exception as e:

        import traceback
        print(f"[ERROR DETAIL]\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)