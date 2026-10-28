import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Cpu, 
  HardDrive, 
  CheckCircle, 
  AlertCircle, 
  Terminal, 
  Sparkles, 
  Save,
  Info,
  RefreshCw
} from 'lucide-react';
import { fetchEnv, getProjectFile, updateProjectFile } from '../api/client';

export const SettingsPage: React.FC = () => {
  const [envData, setEnvData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [configYaml, setConfigYaml] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const loadEnv = async () => {
    try {
      setLoading(true);
      const res = await fetchEnv();
      setEnvData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEnv();
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-stone-300 dark:border-stone-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>Cài đặt & Kiểm tra Môi trường</span>
            <span className="text-xs bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-2 py-0.5 rounded-full font-bold">
              System Diagnostics
            </span>
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
            Kiểm tra trạng thái phần cứng GPU, FFmpeg NVENC, Kokoro TTS và cấu hình hệ thống.
          </p>
        </div>

        <button
          onClick={loadEnv}
          className="doodle-btn px-3 py-2 bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl font-bold text-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Kiểm tra lại</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-stone-500 font-medium">Đang kiểm tra môi trường...</div>
      ) : envData ? (
        <div className="space-y-6">
          {/* Card Thông số Phần cứng & Thư viện */}
          <div className="doodle-card bg-white dark:bg-stone-900 p-6 rounded-2xl border-2 border-stone-900 dark:border-stone-700">
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 mb-4">
              <Cpu className="w-4 h-4 text-amber-500" />
              <span>Trạng thái Phần cứng & Công cụ Local</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* GPU */}
              <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="text-xs font-bold text-stone-500 uppercase mb-1">Card Đồ Họa (GPU)</div>
                <div className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  {envData.gpu.name}
                </div>
                <div className="text-xs text-stone-500 mt-1">
                  VRAM: <strong>{envData.gpu.vram_mb} MB</strong> | Trạng thái: {envData.gpu.status}
                </div>
              </div>

              {/* FFmpeg */}
              <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="text-xs font-bold text-stone-500 uppercase mb-1">Bộ mã hóa FFmpeg</div>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  <span>{envData.ffmpeg.installed ? 'Đã cài đặt sẵn' : 'Chưa cài đặt'}</span>
                </div>
                <div className="text-xs text-stone-500 mt-1">
                  Tăng tốc NVENC: <strong>{envData.ffmpeg.nvenc ? 'Có hỗ trợ (Siêu tốc)' : 'Không có'}</strong>
                </div>
              </div>

              {/* Python & Node */}
              <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="text-xs font-bold text-stone-500 uppercase mb-1">Môi trường Thực thi</div>
                <div className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  Python: {envData.python} | Hệ điều hành: {envData.os}
                </div>
              </div>

              {/* Kokoro TTS */}
              <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="text-xs font-bold text-stone-500 uppercase mb-1">Kokoro TTS Engine</div>
                <div className="text-xs text-stone-700 dark:text-stone-300 font-medium">
                  {envData.kokoro.message}
                </div>
              </div>
            </div>
          </div>

          {/* Card Hướng dẫn Chuyển Về Máy Nhà (RTX 4050 6GB) */}
          <div className="doodle-card bg-amber-50 dark:bg-amber-950/30 p-6 rounded-2xl border-2 border-amber-400 dark:border-amber-700">
            <h3 className="text-base font-bold text-amber-950 dark:text-amber-200 flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Ghi chú chạy trên máy cá nhân (RTX 4050 6GB)</span>
            </h3>

            <div className="text-xs text-amber-900 dark:text-amber-300 leading-relaxed space-y-2">
              <p>
                1. <strong>Tối ưu VRAM 6GB:</strong> Hệ thống đã cài đặt cơ chế khóa tác vụ tuần tự (chỉ cho phép 1 tác vụ GPU chạy tại một thời điểm) và tự động gọi <code>torch.cuda.empty_cache()</code> để làm sạch bộ nhớ card ngay khi sinh ảnh hoặc đọc giọng xong.
              </p>
              <p>
                2. <strong>Kokoro TTS Giọng Ngọc Huyền:</strong> Khi về máy nhà, bạn chỉ cần tải weights model <code>kokoro-v0_19.onnx</code> và <code>voices.bin / voices.json</code> đặt vào thư mục <code>models/kokoro/</code>.
              </p>
              <p>
                3. <strong>ComfyUI API:</strong> Nếu bạn dùng ComfyUI, chỉ cần mở ComfyUI ở cổng mặc định <code>http://127.0.0.1:8188</code>, hệ thống sẽ tự động bắt kết nối và gửi prompt sinh ảnh doodle!
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
