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

# ── HELPER: Confidence Score ──
def get_confidence_label(score):
    if score >= 0.85:
        return "Bagus"
    elif score >= 0.70:
        return "Cukup"
    else:
        return "Rendah"

def build_confidence_summary(results):
    """Bikin ringkasan confidence dari semua hasil OCR"""
    scores = [r['confidence'] for r in results]
    scores_arr = np.array(scores)
    best_idx = int(np.argmax(scores_arr))
    worst_idx = int(np.argmin(scores_arr))

    detail = []
    for r in results:
        detail.append({
            "teks": r['text'],
            "confidence_score": round(float(r['confidence']), 4),
            "confidence_persen": f"{r['confidence']:.0%}",
            "label": get_confidence_label(r['confidence']),
            "ai_status": r.get('status', '-')
        })

    summary = {
        "rata_rata": f"{scores_arr.mean():.2%}",
        "tertinggi": {
            "teks": results[best_idx]['text'],
            "score": f"{scores_arr.max():.2%}"
        },
        "terendah": {
            "teks": results[worst_idx]['text'],
            "score": f"{scores_arr.min():.2%}"
        },
        "jumlah_bagus": int(sum(s >= 0.85 for s in scores)),
        "jumlah_cukup": int(sum(0.70 <= s < 0.85 for s in scores)),
        "jumlah_rendah": int(sum(s < 0.70 for s in scores)),
    }

    return detail, summary


@app.route('/')
def home():
    return "Welcome home dawg - Server Preprocessing Aktif"


@app.route('/cek-koneksi', methods=['GET'])
def hello():
    return jsonify({"pesan": "API SVTR sudah aktif, siap menerima kiriman gambar!"})


# ── ENDPOINT LAMA (hanya top 1 hasil) ──
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
                "confidence_label": get_confidence_label(confidence),  # ← TAMBAHAN
                "ai_status": top_result['status'],
                "processed_file": "processed_" + file.filename
            }
        })

    except Exception as e:
        import traceback
        print(f"[ERROR DETAIL]\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500


# ── ENDPOINT BARU (semua hasil + ringkasan confidence) ──
@app.route('/predict-detail', methods=['POST'])
def predict_detail():
    if 'image' not in request.files:
        return jsonify({"error": "File tidak ditemukan"}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "Nama file kosong"}), 400

    raw_path = os.path.join(RAW_FOLDER, file.filename)
    file.save(raw_path)

    try:
        results = ai_engine.predict_from_file(raw_path)

        if not results:
            return jsonify({
                "status": "Re-Capture",
                "message": "Teks tidak terdeteksi, silakan ambil foto ulang"
            }), 200

        if not isinstance(results, list):
            return jsonify({"error": f"Format hasil tidak valid: {type(results)}"}), 500

        # Confidence score semua hasil
        detail, summary = build_confidence_summary(results)

        # Status akhir berdasarkan rata-rata score
        scores = [r['confidence'] for r in results]
        avg_score = np.mean(scores)
        final_status = "Ok" if avg_score >= 0.85 else "Re-Capture"

        return jsonify({
            "status": final_status,
            "message": "Proses selesai",
            "ringkasan": summary,
            "detail_per_teks": detail,
            "processed_file": "processed_" + file.filename
        })

    except Exception as e:
        import traceback
        print(f"[ERROR DETAIL]\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)