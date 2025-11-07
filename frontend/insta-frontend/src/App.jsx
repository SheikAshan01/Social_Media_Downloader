import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Video, Music } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import confetti from "canvas-confetti";

function App() {
  const [url, setUrl] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState("");
  const [progress, setProgress] = useState(0); // ✅ progress state added
  const [completed, setCompleted] = useState(false);
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5001";

  const handleFetch = async () => {
    if (!url.trim()) return toast.error("Please paste a valid Instagram URL!");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setData(result);
      toast.success("Post details fetched!");
    } catch (err) {
      toast.error("Failed to fetch post details");
    } finally {
      setLoading(false);
    }
  };

  const triggerConfetti = () => {
    const duration = 2 * 1000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 75,
        origin: { x: 0 },
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 75,
        origin: { x: 1 },
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  };

  // 🧩 Handle download with progress tracking + Confetti
  const handleDownload = async (type) => {
    if (!data) return;
    setDownloading(type);
    toast.loading(`Preparing ${type}...`, { id: "dl" });

    const endpoint =
      type === "video"
        ? `/api/download_video?url=${encodeURIComponent(data.original_url)}`
        : `/api/download_audio?url=${encodeURIComponent(data.original_url)}`;

    try {
      const response = await fetch(`${API_BASE}${endpoint}`);
      if (!response.ok) throw new Error("Failed to download file");

      const contentLength = response.headers.get("Content-Length");
      const total = parseInt(contentLength, 10);
      const reader = response.body.getReader();
      let received = 0;
      let chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total) {
          const progressValue = Math.round((received / total) * 100);
          setProgress(progressValue); // ✅ update progress bar width
        }
      }

      const blob = new Blob(chunks);
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download =
        type === "video" ? "instagram_video.mp4" : "instagram_audio.mp3";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setProgress(100);
      toast.success(`${type === "video" ? "Video" : "Audio"} downloaded!`, {
        id: "dl",
      });

      // ✅ 🎉 Trigger confetti animation
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors:
          type === "video"
            ? ["#22c55e", "#4ade80", "#86efac"] // green shades
            : ["#3b82f6", "#60a5fa", "#93c5fd"], // blue shades
      });

      setCompleted(true);
      setTimeout(() => setCompleted(false), 3000); // hide success msg after 3s
    } catch (err) {
      console.error(err);
      toast.error("Download failed", { id: "dl" });
    } finally {
      setTimeout(() => {
        setProgress(0);
        setDownloading("");
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4c1d95] text-white p-4 sm:p-6 transition-all duration-700">
      <Toaster position="top-right" />

      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-[0_0_25px_rgba(124,58,237,0.5)] border border-purple-500/30 w-full max-w-lg sm:max-w-xl md:max-w2xl p-5 sm:p-8 mx-3 hover:shadow-[0_0_40px_rgba(192,132,252,0.7)] transition-all duration-500"
      >
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-center mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(192,132,252,0.4)]">
          Instagram Downloader
        </h1>

        {/* Input */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 mb-5">
          <input
            type="text"
            placeholder="Paste Instagram URL..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 p-3 rounded-xl text-gray-900 focus:ring-2 focus:ring-purple-400 text-sm sm:text-base w-full shadow-inner bg-white/80 placeholder-gray-400"
          />
          <button
            onClick={handleFetch}
            className="bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-xl px-5 py-3 font-semibold shadow-[0_0_15px_rgba(192,132,252,0.4)] transition-all duration-300"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Fetch"}
          </button>
        </div>

        {/* Show post preview */}
        {data && (
          <div className="text-center">
            <img
              src={`${API_BASE}/api/proxy_image?url=${encodeURIComponent(
                data.thumbnail
              )}`}
              alt="Thumbnail"
              className="mx-auto rounded-lg mb-3 w-48 sm:w-64 md:w-72 shadow-lg"
            />
            <p className="text-indigo-300 font-semibold">{data.title}</p>

            {/* Download buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mt-4 w-full">
              <button
                onClick={() => handleDownload("video")}
                disabled={downloading === "video"}
                className="flex items-center gap-2 bg-gradient-to-r from-[#7c3aed] via-[#a855f7] to-[#d946ef] hover:from-[#a855f7] hover:to-[#7c3aed] px-5 py-3 rounded-xl shadow-[0_0_15px_rgba(124,58,237,0.4)] text-white font-semibold transition-all duration-300 w-full sm:w-auto"
              >
                {downloading === "video" ? (
                  <Loader2 className="animate-spin w-5 h-5" />
                ) : (
                  <Video className="w-5 h-5" />
                )}
                {downloading === "video" ? "Downloading..." : "Download Video"}
              </button>

              <button
                onClick={() => handleDownload("audio")}
                disabled={downloading === "audio"}
                className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 px-5 py-3 rounded-xl shadow-lg"
              >
                {downloading === "audio" ? (
                  <Loader2 className="animate-spin w-5 h-5" />
                ) : (
                  <Music className="w-5 h-5" />
                )}
                {downloading === "audio" ? "Converting..." : "Download Audio"}
              </button>
            </div>

            {/* 🔥 Animated Progress Bar */}
            {downloading && progress > 0 && (
              <motion.div
                className="w-full bg-gray-700 rounded-full h-3 mt-4 overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: progress === 100 ? 0 : 1 }}
                transition={{ duration: 0.5 }}
              >
                <motion.div
                  className="h-3 bg-gradient-to-r from-[#a855f7] via-[#c084fc] to-[#f0abfc] animate-[move_2s_linear_infinite]"
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "easeOut", duration: 0.2 }}
                />
              </motion.div>
            )}

            {/* ✅ Completed message */}
            {completed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="flex items-center justify-center gap-2 mt-3 text-green-400 font-semibold drop-shadow-[0_0_10px_rgba(34,197,94,0.7)]"
              >
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 10 }}
                >
                  ✅
                </motion.span>
                <span>Download Completed!</span>
              </motion.div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default App;
