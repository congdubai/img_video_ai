import React, { useState, useEffect } from 'react';
import { Film, ArrowRight, RotateCcw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { ScenesData, SceneItem, getProjectFile, triggerJob } from '../api/client';

interface ScenesPageProps {
  projectName: string;
  onNextStep: () => void;
}

export const ScenesPage: React.FC<ScenesPageProps> = ({ projectName, onNextStep }) => {
  const [scenesData, setScenesData] = useState<ScenesData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getProjectFile<ScenesData>(projectName, 'scenes');
      if (res.exists && res.content) {
        setScenesData(res.content);
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

  const handleRebuildScenes = async () => {
    try {
      await triggerJob(projectName, 'scenes', { force: true });
      setTimeout(loadData, 2000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const millis = Math.floor((s - Math.floor(s)) * 10);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}.${millis}`;
  };

  if (loading) {
    return <div className="p-8 text-center text-stone-500 font-medium">Đang tải danh sách cảnh...</div>;
  }

  const scenes = scenesData?.scenes || [];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-stone-300 dark:border-stone-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>Bước 3: Phân chia Cảnh minh họa</span>
            <span className="text-xs bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-2 py-0.5 rounded-full font-bold">
              scenes.json
            </span>
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
            Gộp các câu liên tiếp thành cảnh dài mục tiêu 5 - 12 giây để zoom mượt mà, không tách rời câu thoại.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRebuildScenes}
            className="doodle-btn px-3 py-2 bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl font-bold text-xs flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Tự động gộp lại</span>
          </button>

          <button
            onClick={onNextStep}
            className="doodle-btn px-4 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 rounded-xl font-bold text-xs flex items-center gap-2"
          >
            <span>Tiếp theo: Lệnh ảnh</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Visual Timeline Bar */}
      {scenes.length > 0 && (
        <div className="doodle-card bg-white dark:bg-stone-900 p-4 rounded-2xl mb-8 border-2 border-stone-900 dark:border-stone-700">
          <div className="text-xs font-bold text-stone-500 mb-2 uppercase flex items-center justify-between">
            <span>Dải phân cảnh trực quan ({scenes.length} cảnh)</span>
            <span className="text-[11px] font-semibold text-stone-400">Mục tiêu lý tưởng: 5s - 12s</span>
          </div>

          <div className="flex w-full h-10 bg-stone-100 dark:bg-stone-800 rounded-xl overflow-hidden border border-stone-300 dark:border-stone-700 p-1 gap-1">
            {scenes.map((sc) => {
              const totalD = scenes[scenes.length - 1].end || 1;
              const widthPct = Math.max((sc.duration / totalD) * 100, 3);
              const isWarning = sc.duration < 4.0 || sc.duration > 14.0;

              return (
                <div
                  key={sc.scene_id}
                  style={{ width: `${widthPct}%` }}
                  title={`Cảnh #${sc.scene_id}: ${sc.duration.toFixed(1)}s (${formatSec(sc.start)} - ${formatSec(sc.end)})`}
                  className={`h-full rounded-lg flex items-center justify-center font-bold text-[11px] cursor-pointer transition select-none ${
                    isWarning
                      ? 'bg-amber-300 dark:bg-amber-600/80 text-stone-950'
                      : 'bg-stone-300 dark:bg-stone-700 hover:bg-amber-400 hover:text-stone-950 text-stone-800 dark:text-stone-200'
                  }`}
                >
                  #{sc.scene_id}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scenes List Cards */}
      {scenes.length === 0 ? (
        <div className="py-12 text-center text-stone-500 border-2 border-dashed border-stone-300 dark:border-stone-800 rounded-2xl">
          <Film className="w-8 h-8 text-stone-400 mx-auto mb-2" />
          <p className="font-bold text-sm">Chưa có cảnh nào</p>
          <p className="text-xs text-stone-400 mt-1">Bấm "Tự động gộp lại" để tạo cảnh từ timeline.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scenes.map((sc) => {
            const isTooShort = sc.duration < 4.5;
            const isTooLong = sc.duration > 13.0;

            return (
              <div
                key={sc.scene_id}
                className="doodle-card bg-white dark:bg-stone-900 p-4 rounded-xl border-2 border-stone-900 dark:border-stone-700 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start space-x-3.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center font-bold text-sm shrink-0 shadow-[2px_2px_0px_#1c1917]">
                    #{sc.scene_id}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
                        {sc.sentence_ids.length > 1 ? `Gồm câu ${sc.sentence_ids.join(', ')}` : `Câu ${sc.sentence_ids[0]}`}
                      </span>

                      {isTooShort && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Cảnh hơi ngắn (&lt;5s)
                        </span>
                      )}
                      {isTooLong && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Cảnh hơi dài (&gt;12s)
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                      {sc.text}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0 self-end md:self-auto">
                  <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-mono text-xs font-bold border border-stone-300 dark:border-stone-700">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>{sc.duration.toFixed(1)}s</span>
                    <span className="text-stone-400 font-normal">({formatSec(sc.start)} - {formatSec(sc.end)})</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
