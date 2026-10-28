import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, 
  Play, 
  Settings2, 
  Sliders, 
  Download, 
  Eye, 
  Sparkles, 
  CheckCircle, 
  Layers, 
  Zap,
  RefreshCw
} from 'lucide-react';
import { triggerJob, getProjectFile, TimelineData, ScenesData } from '../api/client';

interface RenderPageProps {
  projectName: string;
}

export const RenderPage: React.FC<RenderPageProps> = ({ projectName }) => {
  const [resolution, setResolution] = useState<'1080p' | '720p'>('1080p');
  const [zoomMode, setZoomMode] = useState<'alternate' | 'in' | 'out'>('alternate');
  const [zoomScale, setZoomScale] = useState<number>(8); // 8%
  const [subEffect, setSubEffect] = useState<'pop' | 'fade' | 'none'>('pop');
  const [subFontSize, setSubFontSize] = useState<number>(44);
  const [previewFrom, setPreviewFrom] = useState<number>(0);
  const [previewTo, setPreviewTo] = useState<number>(15);
  const [videoTimestamp, setVideoTimestamp] = useState<number>(Date.now());
  const [hasVideo, setHasVideo] = useState<boolean>(false);

  // Live Subtitle Preview Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Vẽ preview phụ đề tức thì lên Canvas
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Nền kem doodle hoặc ảnh mẫu
    ctx.fillStyle = '#FBF8F1';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Khung viền doodle
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 6;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Tiêu đề cảnh mẫu ở trên
    ctx.font = 'bold 36px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1C1917';
    ctx.fillText('TẠI SAO BẦU TRỜI XANH?', canvas.width / 2, 80);

    // Hình minh họa người que mẫu ở giữa
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2 - 20, 70, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.stroke();

    // Mắt người que
    ctx.fillStyle = '#1C1917';
    ctx.beginPath();
    ctx.arc(canvas.width / 2 - 20, canvas.height / 2 - 30, 8, 0, Math.PI * 2);
    ctx.arc(canvas.width / 2 + 20, canvas.height / 2 - 30, 8, 0, Math.PI * 2);
    ctx.fill();

    // Miệng cười
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2 - 10, 25, 0, Math.PI);
    ctx.stroke();

    // Phụ đề mô phỏng ở dưới
    const subY = canvas.height - 70;
    const sampleSubText = 'Bạn đã bao giờ tự hỏi, tại sao bầu trời lại xanh?';

    ctx.font = `bold ${subFontSize}px "Be Vietnam Pro", sans-serif`;
    ctx.textAlign = 'center';
    
    // Viền đen phụ đề
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 7;
    ctx.strokeText(sampleSubText, canvas.width / 2, subY);

    // Ruột chữ trắng
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(sampleSubText, canvas.width / 2, subY);
  }, [subFontSize, subEffect]);

  const handleRenderPreview = async () => {
    try {
      await triggerJob(projectName, 'render', { preview: true });
      setTimeout(() => {
        setVideoTimestamp(Date.now());
        setHasVideo(true);
      }, 5000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRenderSegment = async () => {
    try {
      await triggerJob(projectName, 'render', { 
        preview: true, 
        from_sec: previewFrom, 
        to_sec: previewTo 
      });
      setTimeout(() => {
        setVideoTimestamp(Date.now());
        setHasVideo(true);
      }, 5000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRenderFull = async () => {
    if (confirm('Bắt đầu render video MP4 hoàn chỉnh (1080p, 30fps)?')) {
      try {
        await triggerJob(projectName, 'render', { preview: false });
        setTimeout(() => {
          setVideoTimestamp(Date.now());
          setHasVideo(true);
        }, 8000);
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const videoUrl = `/api/projects/${encodeURIComponent(projectName)}/media/output/video.mp4?t=${videoTimestamp}`;
  const previewUrl = `/api/projects/${encodeURIComponent(projectName)}/media/output/preview.mp4?t=${videoTimestamp}`;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-stone-300 dark:border-stone-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>Bước 6: Xuất Video MP4 Hoàn Chỉnh</span>
            <span className="text-xs bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full font-bold">
              Single-Pass FFmpeg
            </span>
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
            Ghép ảnh zoom mượt, hiệu ứng chuyển cảnh mờ crossfade, tiêu đề và phụ đề tiếng Việt có hiệu ứng nảy nhẹ.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRenderPreview}
            className="doodle-btn px-3.5 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl font-bold text-xs flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Xem thử 720p nhanh</span>
          </button>

          <button
            onClick={handleRenderFull}
            className="doodle-btn px-4 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 rounded-xl font-bold text-xs flex items-center gap-2"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Xuất MP4 Chính Thức (1080p)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái: Cài đặt & Tùy biến Phụ đề */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card Cấu hình Video */}
          <div className="doodle-card bg-white dark:bg-stone-900 p-5 rounded-2xl border-2 border-stone-900 dark:border-stone-700">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 uppercase flex items-center gap-2 mb-4">
              <Sliders className="w-4 h-4 text-amber-500" />
              <span>Hiệu ứng Video & Zoom</span>
            </h3>

            <div className="space-y-4 text-xs font-semibold">
              <div>
                <label className="text-stone-500 uppercase block mb-1">Kiểu Zoom cảnh:</label>
                <select
                  value={zoomMode}
                  onChange={(e: any) => setZoomMode(e.target.value)}
                  className="w-full p-2 rounded-xl border border-stone-300 dark:border-stone-700 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none"
                >
                  <option value="alternate">Xen kẽ (Cảnh chẵn Zoom In, Cảnh lẻ Zoom Out)</option>
                  <option value="in">Toàn bộ Zoom In chậm</option>
                  <option value="out">Toàn bộ Zoom Out chậm</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-stone-500 uppercase">Mức Zoom:</label>
                  <span className="font-bold text-amber-600">{zoomScale}%</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={15}
                  value={zoomScale}
                  onChange={(e) => setZoomScale(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <div className="pt-2 border-t border-stone-200 dark:border-stone-800">
                <label className="text-stone-500 uppercase block mb-1">Xem thử đoạn ngắn (giây):</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={previewFrom}
                    onChange={(e) => setPreviewFrom(Number(e.target.value))}
                    className="w-20 p-2 rounded-xl border border-stone-300 dark:border-stone-700 dark:bg-stone-800 text-center font-mono"
                  />
                  <span className="text-stone-400">đến</span>
                  <input
                    type="number"
                    value={previewTo}
                    onChange={(e) => setPreviewTo(Number(e.target.value))}
                    className="w-20 p-2 rounded-xl border border-stone-300 dark:border-stone-700 dark:bg-stone-800 text-center font-mono"
                  />
                  <button
                    onClick={handleRenderSegment}
                    className="doodle-btn px-3 py-2 bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold"
                  >
                    Render đoạn
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card Thiết kế Phụ đề */}
          <div className="doodle-card bg-white dark:bg-stone-900 p-5 rounded-2xl border-2 border-stone-900 dark:border-stone-700">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 uppercase flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-amber-500" />
              <span>Thiết kế Phụ đề & Hiệu ứng</span>
            </h3>

            <div className="space-y-4 text-xs font-semibold">
              <div>
                <label className="text-stone-500 uppercase block mb-1">Hiệu ứng xuất hiện:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'pop', label: 'Nảy nhẹ (Pop)' },
                    { id: 'fade', label: 'Mờ dần (Fade)' },
                    { id: 'none', label: 'Đứng yên' }
                  ].map((eff) => (
                    <button
                      key={eff.id}
                      onClick={() => setSubEffect(eff.id as any)}
                      className={`p-2 rounded-xl border text-center transition font-bold ${
                        subEffect === eff.id
                          ? 'bg-amber-400 border-stone-900 text-stone-950 shadow-[1px_1px_0px_#1c1917]'
                          : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      {eff.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-stone-500 uppercase">Cỡ chữ phụ đề:</label>
                  <span className="font-bold text-amber-600">{subFontSize}px</span>
                </div>
                <input
                  type="range"
                  min={32}
                  max={58}
                  value={subFontSize}
                  onChange={(e) => setSubFontSize(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <div className="p-3 bg-stone-100 dark:bg-stone-800 rounded-xl text-stone-600 dark:text-stone-400 text-[11px] font-medium leading-relaxed">
                Phụ đề sử dụng font <strong>Be Vietnam Pro</strong> hỗ trợ đầy đủ 100% tiếng Việt có dấu, nét viền đen dày giúp dễ đọc trên mọi bức ảnh.
              </div>
            </div>
          </div>
        </div>

        {/* Cột phải: Live Canvas Preview & Trình phát Video Kết quả */}
        <div className="lg:col-span-7 space-y-6">
          {/* Live Subtitle Preview */}
          <div className="doodle-card bg-white dark:bg-stone-900 p-4 rounded-2xl border-2 border-stone-900 dark:border-stone-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-stone-500 uppercase">
                Khung xem thử phụ đề tức thì (Canvas)
              </span>
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                Tự động cập nhật khi đổi cỡ chữ & hiệu ứng
              </span>
            </div>

            <div className="aspect-video w-full rounded-xl overflow-hidden border border-stone-300 dark:border-stone-700 shadow-inner">
              <canvas
                ref={canvasRef}
                width={960}
                height={540}
                className="w-full h-full object-contain bg-stone-100 dark:bg-stone-800"
              />
            </div>
          </div>

          {/* Trình phát Video Render Cuối Cùng */}
          <div className="doodle-card bg-white dark:bg-stone-900 p-5 rounded-2xl border-2 border-stone-900 dark:border-stone-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Video className="w-4 h-4 text-amber-500" />
                <span>Video MP4 đã xuất</span>
              </h3>

              <div className="flex items-center gap-2">
                <a
                  href={videoUrl}
                  download={`${projectName}.mp4`}
                  className="doodle-btn px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải video</span>
                </a>
              </div>
            </div>

            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-stone-800">
              <video
                key={videoTimestamp}
                src={videoUrl}
                controls
                className="w-full h-full object-contain"
              >
                Trình duyệt của bạn không hỗ trợ phát thẻ video HTML5.
              </video>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
