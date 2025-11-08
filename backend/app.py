from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import yt_dlp, tempfile, os, uuid, subprocess, requests

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": [
    "http://localhost:5173",
    "https://social-media-downloader-gamma.vercel.app",
    "https://social-media-downloader.vercel.app"
]}}, supports_credentials=True)
TMP = tempfile.gettempdir()


# ────────────────────────────────────────────────
# 1️⃣  Extract meta info (title, thumbnail, etc.)
# ────────────────────────────────────────────────
@app.route("/api/fetch", methods=["POST"])
def fetch():
    try:
        data = request.get_json()
        url = data.get("url")
        if not url:
            return jsonify({"error": "URL missing"}), 400

        secret_path = "/etc/secrets/instagram.txt"
        local_path = os.path.join(os.path.dirname(__file__), "cookies", "instagram.txt")
        
        if os.path.exists(secret_path):
            cookies_path = secret_path
        else:
            cookies_path = local_path
            
        print("Using cookies from:", cookies_path, "Exists?", os.path.exists(cookies_path))

        ydl_opts = {
            "quiet": True,
            "skip_download": True,
            "extract_flat": False,
            "noplaylist": True,
            "geo_bypass": True,
            "cookiefile": cookies_path,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        result = {
            "title": info.get("title"),
            "uploader": info.get("uploader"),
            "thumbnail": info.get("thumbnail"),
            "original_url": url,
        }
        return jsonify(result)

    except Exception as e:
        print("Error in /api/fetch:", e)
        return jsonify({"error": str(e)}), 500

# ────────────────────────────────────────────────
# 2️⃣  Download video using yt-dlp
# ────────────────────────────────────────────────
from flask import after_this_request

@app.route("/api/download_video")
def download_video():
    url = request.args.get("url")
    if not url:
        return jsonify({"error": "Missing url"}), 400

    outfile = os.path.join(TMP, f"{uuid.uuid4()}.mp4")
    ydl_opts = {
        "outtmpl": outfile,
        "quiet": True,
        "noplaylist": True,
        "retries": 3,
        "format": "best[ext=mp4]/best"
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        @after_this_request
        def cleanup(response):
            try:
                if os.path.exists(outfile):
                    os.remove(outfile)
            except Exception:
                pass
            return response

        return send_file(outfile, as_attachment=True, download_name="instagram_video.mp4")
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ────────────────────────────────────────────────
# 2️⃣  Download Audio 
# ────────────────────────────────────────────────
@app.route("/api/download_audio")
def download_audio():
    url = request.args.get("url")
    if not url:
        return jsonify({"error": "Missing url"}), 400

    outfile = os.path.join(TMP, f"{uuid.uuid4()}.mp3")

    ydl_opts = {
        "quiet": True,
        "noplaylist": True,
        "retries": 3,
        "format": "bestaudio/best",
        "outtmpl": outfile.replace(".mp3", ""),
        "ffmpeg_location": "C:\\ffmpeg\\bin",  # <— ensure correct path
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }],
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        final_mp3 = outfile
        if not os.path.exists(final_mp3):
            # sometimes yt-dlp names it differently (without .mp3)
            candidates = [f for f in os.listdir(TMP) if f.endswith(".mp3")]
            if candidates:
                final_mp3 = os.path.join(TMP, candidates[-1])

        @after_this_request
        def cleanup(response):
            try:
                if os.path.exists(final_mp3):
                    os.remove(final_mp3)
            except Exception:
                pass
            return response

        return send_file(final_mp3, as_attachment=True, download_name="instagram_audio.mp3")
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/proxy_image")
def proxy_image():
    import requests
    from flask import Response, request, stream_with_context

    img_url = request.args.get("url")
    if not img_url:
        return {"error": "Missing url"}, 400

    try:
        r = requests.get(img_url, stream=True, timeout=10)
        return Response(
            stream_with_context(r.iter_content(chunk_size=8192)),
            content_type=r.headers.get("Content-Type", "image/jpeg"),
        )
    except Exception as e:
        return {"error": str(e)}, 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
