import React, { useState, useEffect, useRef } from 'react';
import { Save, Mic, Check, AlertCircle, Info } from 'lucide-react';
import { getProjectFile, updateProjectFile, triggerJob } from '../api/client';

interface ScriptPageProps {
  projectName: string;
  onNextStep: () => void;
}

export const ScriptPage: React.FC<ScriptPageProps> = ({ projectName, onNextStep }) => {
  const [scriptText, setScriptText] = useState('');
  const [loading, setLoading] = useState(true);
  const [savedStatus, setSavedStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const timerRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    getProjectFile<string>(projectName, 'script')
      .then((res) => {
        if (isMounted) {
          setScriptText(res.content || '');
          setLoading(false);
          setSavedStatus('saved');
        }
      })
      .catch((err) => {
        if (isMounted) {
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [projectName]);

  // Debounced Auto-save
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setScriptText(val);
    setSavedStatus('dirty');

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        setSavedStatus('saving');
        await updateProjectFile(projectName, 'script', val);
        setSavedStatus('saved');
      } catch (err) {
        setSavedStatus('dirty');
      }
    }, 1200);
  };

  const handleManualSave = async () => {
    try {
      setSavedStatus('saving');
      await updateProjectFile(projectName, 'script', scriptText);
      setSavedStatus('saved');
    } catch (err: any) {
      alert('Lỗi lưu file: ' + err.message);
      setSavedStatus('dirty');
    }
  };

  const handleRunTTS = async () => {
    await handleManualSave();
    try {
      await triggerJob(projectName, 'tts', { force: true });
      onNextStep();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Tính thống kê
  const lines = scriptText.split('\n').filter((l) => l.trim().length > 0);
  const lineCount = lines.length;
  const wordCount = scriptText.trim().length > 0 ? scriptText.trim().split(/\s+/).length : 0;
  const estSeconds = Math.round(wordCount * 0.28 + lineCount * 0.4);
  const estMinutes = Math.floor(estSeconds / 60);
  const estRemainderSecs = estSeconds % 60;

  if (loading) {
    return <div className="p-8 text-center text-stone-500 font-medium">Đang tải kịch bản...</div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-stone-300 dark:border-stone-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>Bước 1: Soạn thảo kịch bản</span>
            <span className="text-xs bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-2 py-0.5 rounded-full font-bold">
              script.txt
            </span>
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
            Mỗi dòng là một câu ngắn hoặc đoạn. Xuống dòng kép sẽ tạo khoảng lặng dài hơn giữa các đoạn.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300">
            {savedStatus === 'saved' && (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Đã lưu</span>
              </>
            )}
            {savedStatus === 'saving' && (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>Đang lưu...</span>
              </>
            )}
            {savedStatus === 'dirty' && (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Có thay đổi chưa lưu</span>
              </>
            )}
          </div>

          <button
            onClick={handleManualSave}
            className="doodle-btn px-3 py-2 bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl font-bold text-xs flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Lưu</span>
          </button>

          <button
            onClick={handleRunTTS}
            className="doodle-btn px-4 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 rounded-xl font-bold text-xs flex items-center gap-2"
          >
            <Mic className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Chạy đọc thử (TTS)</span>
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="p-3 bg-white dark:bg-stone-900 border-2 border-stone-900 dark:border-stone-700 rounded-xl shadow-[2px_2px_0px_#1c1917]">
          <div className="text-[11px] font-bold text-stone-500 uppercase">Số câu (dòng)</div>
          <div className="text-lg font-extrabold text-stone-900 dark:text-stone-100">{lineCount}</div>
        </div>
        <div className="p-3 bg-white dark:bg-stone-900 border-2 border-stone-900 dark:border-stone-700 rounded-xl shadow-[2px_2px_0px_#1c1917]">
          <div className="text-[11px] font-bold text-stone-500 uppercase">Số từ</div>
          <div className="text-lg font-extrabold text-stone-900 dark:text-stone-100">{wordCount}</div>
        </div>
        <div className="p-3 bg-white dark:bg-stone-900 border-2 border-stone-900 dark:border-stone-700 rounded-xl shadow-[2px_2px_0px_#1c1917]">
          <div className="text-[11px] font-bold text-stone-500 uppercase">Ước lượng giọng đọc</div>
          <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
            {estMinutes > 0 ? `${estMinutes}p ` : ''}{estRemainderSecs}s
          </div>
        </div>
      </div>

      {/* Editor Textarea */}
      <div className="relative">
        <textarea
          value={scriptText}
          onChange={handleChange}
          rows={16}
          placeholder="Nhập hoặc dán kịch bản tiếng Việt vào đây, mỗi dòng một câu..."
          className="w-full p-4 rounded-2xl border-2 border-stone-900 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-medium text-sm leading-relaxed shadow-[3px_3px_0px_#1c1917] focus:outline-none focus:border-amber-500 font-sans resize-y"
        />
      </div>

      {/* Helper Tip */}
      <div className="mt-4 p-3 bg-stone-100 dark:bg-stone-900/60 border border-stone-300 dark:border-stone-800 rounded-xl flex items-start gap-2.5 text-xs text-stone-600 dark:text-stone-400">
        <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <span>
          <strong>Gợi ý viết kịch bản Nguệch Ngoạc:</strong> Viết câu ngắn gọn, trực diện, giàu hình ảnh gợi nhớ. Mỗi câu dài từ 8 đến 20 từ là lý tưởng nhất để chia cảnh minh họa và hiển thị phụ đề rõ ràng trên màn hình điện thoại lẫn máy tính.
        </span>
      </div>
    </div>
  );
};
