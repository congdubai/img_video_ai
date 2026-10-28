import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Volume2, Mic, Clock, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { TimelineData, SentenceItem, getProjectFile, triggerJob } from '../api/client';

interface VoicePageProps {
  projectName: string;
  onNextStep: () => void;
}

export const VoicePage: React.FC<VoicePageProps> = ({ projectName, onNextStep }) => {
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeSentenceId, setActiveSentenceId] = useState<number | null>(null);
  const [rebuildingSentenceId, setRebuildingSentenceId] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getProjectFile<TimelineData>(projectName, 'timeline');
      if (res.exists && res.content) {
        setTimeline(res.content);
        setDuration(res.content.total_duration || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectName]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const cur = audioRef.current.currentTime;
    setCurrentTime(cur);

    // Tìm câu đang phát
    if (timeline?.sentences) {
      const match = timeline.sentences.find((s) => cur >= s.start && cur <= s.end + s.silence_after);
      if (match) {
        setActiveSentenceId(match.id);
      }
    }
  };

  const handleSeekSentence = (s: SentenceItem) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = s.start;
    audioRef.current.play();
    setIsPlaying(true);
    setActiveSentenceId(s.id);
  };

  const handleRebuildSentence = async (sentId: number) => {
    try {
      setRebuildingSentenceId(sentId);
      await triggerJob(projectName, 'tts', { sentence_id: sentId, force: true });
      setTimeout(async () => {
        await loadData();
        setRebuildingSentenceId(null);
      }, 3000);
    } catch (err: any) {
      alert(err.message);
      setRebuildingSentenceId(null);
    }
  };

  const handleRebuildAllTTS = async () => {
    if (confirm('Bạn có muốn sinh lại toàn bộ âm thanh và mốc thời gian không?')) {
      try {
        await triggerJob(projectName, 'tts', { force: true });
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const millis = Math.floor((s - Math.floor(s)) * 10);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}.${millis}`;
  };

  if (loading) {
    return <div className="p-8 text-center text-stone-500 font-medium">Đang tải dữ liệu giọng đọc...</div>;
  }

  const voiceUrl = `/api/projects/${encodeURIComponent(projectName)}/media/audio/voice.wav?t=${Date.now()}`;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-stone-300 dark:border-stone-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>Bước 2: Giọng đọc & Mốc thời gian</span>
            <span className="text-xs bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-2 py-0.5 rounded-full font-bold">
              timeline.json
            </span>
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
            Mốc thời gian tính chính xác từ số mẫu âm thanh của Kokoro TTS. Bấm vào từng câu để nghe thử.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRebuildAllTTS}
            className="doodle-btn px-3 py-2 bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl font-bold text-xs flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Sinh lại toàn bộ</span>
          </button>

          <button
            onClick={onNextStep}
            className="doodle-btn px-4 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 rounded-xl font-bold text-xs flex items-center gap-2"
          >
            <span>Tiếp theo: Gom cảnh</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Audio Player Card */}
      <div className="doodle-card bg-white dark:bg-stone-900 p-5 rounded-2xl mb-8 border-2 border-stone-900 dark:border-stone-700">
        <audio
          ref={audioRef}
          src={voiceUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-amber-400 hover:bg-amber-300 text-stone-950 flex items-center justify-center font-bold shadow-[2px_2px_0px_#1c1917] transition active:translate-x-0.5 active:translate-y-0.5"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            <div>
              <div className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <span>voice.wav</span>
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                  Chuẩn 24kHz
                </span>
              </div>
              <div className="text-xs font-semibold text-stone-500 font-mono mt-0.5">
                {formatSec(currentTime)} / {formatSec(duration)}
              </div>
            </div>
          </div>

          {/* Timeline Bar */}
          <div className="flex-1 max-w-xl mx-2">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setCurrentTime(val);
                if (audioRef.current) audioRef.current.currentTime = val;
              }}
              className="w-full accent-amber-500 cursor-pointer h-2 bg-stone-200 dark:bg-stone-800 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Sentence List Table */}
      {!timeline?.sentences || timeline.sentences.length === 0 ? (
        <div className="py-12 text-center text-stone-500 border-2 border-dashed border-stone-300 dark:border-stone-800 rounded-2xl">
          <Mic className="w-8 h-8 text-stone-400 mx-auto mb-2" />
          <p className="font-bold text-sm">Chưa có giọng đọc nào</p>
          <p className="text-xs text-stone-400 mt-1">Bấm "Sinh lại toàn bộ" để chạy TTS kịch bản.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase px-3 py-1">
            <span>Danh sách các câu ({timeline.sentences.length} câu)</span>
            <span>Mốc thời gian (Bắt đầu - Kết thúc)</span>
          </div>

          {timeline.sentences.map((sent) => {
            const isActive = activeSentenceId === sent.id;
            const isRebuilding = rebuildingSentenceId === sent.id;

            return (
              <div
                key={sent.id}
                onClick={() => handleSeekSentence(sent)}
                className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex items-center justify-between gap-4 ${
                  isActive
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 shadow-[2px_2px_0px_#F59E0B]'
                    : 'bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-800 hover:border-stone-500'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isActive ? 'bg-amber-400 text-stone-950' : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                  }`}>
                    {sent.id}
                  </span>
                  <p className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
                    {sent.text}
                  </p>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <span className="font-mono text-xs font-bold text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-md">
                    {formatSec(sent.start)} - {formatSec(sent.end)}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRebuildSentence(sent.id);
                    }}
                    title="Đọc lại riêng câu này"
                    disabled={isRebuilding}
                    className="p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-bold transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRebuilding ? 'animate-spin text-amber-500' : ''}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
