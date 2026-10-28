import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Copy, 
  Check, 
  Save, 
  ArrowRight, 
  RotateCcw, 
  CheckCheck, 
  Info,
  Type
} from 'lucide-react';
import { PromptsData, PromptItem, ScenesData, getProjectFile, updateProjectFile, triggerJob } from '../api/client';

interface PromptsPageProps {
  projectName: string;
  onNextStep: () => void;
}

export const PromptsPage: React.FC<PromptsPageProps> = ({ projectName, onNextStep }) => {
  const [promptsData, setPromptsData] = useState<PromptsData | null>(null);
  const [scenesData, setScenesData] = useState<ScenesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedAll, setCopiedAll] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pRes, sRes] = await Promise.all([
        getProjectFile<PromptsData>(projectName, 'prompts'),
        getProjectFile<ScenesData>(projectName, 'scenes')
      ]);
      if (pRes.exists && pRes.content) setPromptsData(pRes.content);
      if (sRes.exists && sRes.content) setScenesData(sRes.content);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectName]);

  // Cập nhật từng trường của prompt
  const handleItemChange = (sceneId: number, field: keyof PromptItem, val: any) => {
    if (!promptsData) return;
    const updated = promptsData.prompts.map((item) => {
      if (item.scene_id === sceneId) {
        return { ...item, [field]: val };
      }
      return item;
    });
    setPromptsData({ ...promptsData, prompts: updated });
  };

  const handleToggleApprove = (sceneId: number) => {
    if (!promptsData) return;
    const updated = promptsData.prompts.map((item) => {
      if (item.scene_id === sceneId) {
        return { ...item, status: item.status === 'approved' ? 'draft' : 'approved' } as PromptItem;
      }
      return item;
    });
    setPromptsData({ ...promptsData, prompts: updated });
  };

  const handleApproveAll = () => {
    if (!promptsData) return;
    const updated = promptsData.prompts.map((item) => ({ ...item, status: 'approved' as const }));
    setPromptsData({ ...promptsData, prompts: updated });
  };

  const handleSave = async () => {
    if (!promptsData) return;
    try {
      setSaving(true);
      await updateProjectFile(projectName, 'prompts', promptsData);
      setSaving(false);
    } catch (err: any) {
      alert('Lỗi lưu prompts: ' + err.message);
      setSaving(false);
    }
  };

  // Sao chép toàn bộ danh sách cảnh để mang đi sinh prompt bên ngoài
  const handleCopyForExternalLLM = () => {
    if (!scenesData?.scenes) return;
    const formatted = scenesData.scenes
      .map(
        (sc) =>
          `Cảnh #${sc.scene_id} (${sc.duration.toFixed(1)}s):\nThoại: "${sc.text}"\n`
      )
      .join('\n');
    navigator.clipboard.writeText(formatted);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const handleRebuildPrompts = async () => {
    try {
      await triggerJob(projectName, 'prompts', { force: true });
      setTimeout(loadData, 2000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-stone-500 font-medium">Đang tải danh sách lệnh ảnh...</div>;
  }

  const items = promptsData?.prompts || [];
  const approvedCount = items.filter((it) => it.status === 'approved').length;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-stone-300 dark:border-stone-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>Bước 4: Lệnh sinh ảnh & Tiêu đề</span>
            <span className="text-xs bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-2 py-0.5 rounded-full font-bold">
              prompts.json
            </span>
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
            Sao chép nội dung thoại để tự sinh prompt bên ngoài, sau đó dán prompt tiếng Anh vào ô bên dưới và bấm duyệt.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleCopyForExternalLLM}
            className="doodle-btn px-3 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl font-bold text-xs flex items-center gap-1.5"
            title="Sao chép toàn bộ danh sách cảnh để mang sang công cụ sinh prompt"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAll ? 'Đã chép vào clipboard!' : 'Sao chép kịch bản cảnh'}</span>
          </button>

          <button
            onClick={handleApproveAll}
            className="doodle-btn px-3 py-2 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-900 dark:text-emerald-200 rounded-xl font-bold text-xs flex items-center gap-1.5"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Duyệt tất cả ({items.length})</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="doodle-btn px-3.5 py-2 bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl font-bold text-xs flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Đang lưu...' : 'Lưu lại'}</span>
          </button>

          <button
            onClick={async () => {
              await handleSave();
              onNextStep();
            }}
            className="doodle-btn px-4 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 rounded-xl font-bold text-xs flex items-center gap-2"
          >
            <span>Tiếp theo: Sinh ảnh ({approvedCount}/{items.length})</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Style Prefix Box */}
      <div className="doodle-card bg-white dark:bg-stone-900 p-4 rounded-xl mb-6 border-2 border-stone-900 dark:border-stone-700">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Phong cách dùng chung (style_prefix)</span>
          </label>
          <span className="text-[11px] text-stone-400 font-medium">Tự động ghép vào trước mỗi prompt khi sinh ảnh</span>
        </div>
        <input
          type="text"
          value={promptsData?.style_prefix || ''}
          onChange={(e) => promptsData && setPromptsData({ ...promptsData, style_prefix: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-medium focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* Prompts Table */}
      {items.length === 0 ? (
        <div className="py-12 text-center text-stone-500 border-2 border-dashed border-stone-300 dark:border-stone-800 rounded-2xl">
          <p className="font-bold text-sm">Chưa có khung lệnh ảnh nào</p>
          <button
            onClick={handleRebuildPrompts}
            className="mt-3 doodle-btn px-3 py-1.5 bg-amber-400 text-stone-950 rounded-lg text-xs font-bold"
          >
            Tạo khung prompts từ Scenes
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((it) => {
            const sc = scenesData?.scenes.find((s) => s.scene_id === it.scene_id);
            const isApproved = it.status === 'approved';

            return (
              <div
                key={it.scene_id}
                className={`doodle-card p-4 rounded-xl border-2 transition ${
                  isApproved
                    ? 'bg-white dark:bg-stone-900 border-stone-900 dark:border-stone-700'
                    : 'bg-amber-50/50 dark:bg-stone-900/60 border-dashed border-amber-400 dark:border-amber-700'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Cột trái: Thoại cảnh */}
                  <div className="w-full md:w-5/12">
                    <div className="flex items-center space-x-2 mb-1.5">
                      <span className="w-6 h-6 rounded-md bg-amber-400 text-stone-950 flex items-center justify-center font-bold text-xs shrink-0 shadow-[1px_1px_0px_#1c1917]">
                        #{it.scene_id}
                      </span>
                      <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
                        Thoại ({sc?.duration.toFixed(1) || '?'}s)
                      </span>
                    </div>

                    <div className="p-3 bg-stone-100 dark:bg-stone-800 rounded-xl text-xs font-medium text-stone-800 dark:text-stone-200 leading-relaxed border border-stone-200 dark:border-stone-700 select-text">
                      {sc?.text || 'Không tìm thấy câu thoại tương ứng.'}
                    </div>

                    {/* Tiêu đề chèn (overlay_text) */}
                    <div className="mt-2.5">
                      <label className="text-[11px] font-bold text-stone-500 uppercase flex items-center gap-1 mb-1">
                        <Type className="w-3 h-3 text-amber-500" />
                        <span>Chữ tiêu đề (hiện trên video)</span>
                      </label>
                      <input
                        type="text"
                        value={it.overlay_text || ''}
                        onChange={(e) => handleItemChange(it.scene_id, 'overlay_text', e.target.value)}
                        placeholder="Để trống nếu không cần hiện tiêu đề..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 dark:bg-stone-800 text-xs font-bold text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500 uppercase"
                      />
                    </div>
                  </div>

                  {/* Cột phải: Prompt tiếng Anh để dán & duyệt */}
                  <div className="w-full md:w-7/12 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase flex items-center gap-1.5">
                          <span>Prompt tiếng Anh (Dán vào đây)</span>
                        </label>

                        {/* Loại cảnh */}
                        <select
                          value={it.scene_type}
                          onChange={(e) => handleItemChange(it.scene_id, 'scene_type', e.target.value)}
                          className="text-xs px-2 py-1 rounded-lg border border-stone-300 dark:border-stone-700 dark:bg-stone-800 font-semibold focus:outline-none"
                        >
                          <option value="character">Nhân vật (character)</option>
                          <option value="compare">So sánh (compare)</option>
                          <option value="object">Đồ vật (object)</option>
                        </select>
                      </div>

                      <textarea
                        value={it.prompt_en}
                        onChange={(e) => handleItemChange(it.scene_id, 'prompt_en', e.target.value)}
                        rows={3}
                        placeholder="Dán prompt tiếng Anh mô tả cảnh vẽ tay vào đây..."
                        className="w-full p-2.5 rounded-xl border border-stone-300 dark:border-stone-700 dark:bg-stone-800 text-xs font-medium text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500 leading-relaxed font-sans"
                      />
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-stone-200 dark:border-stone-800">
                      <span className="text-[11px] text-stone-400 font-mono">
                        {it.prompt_en.trim().length} ký tự
                      </span>

                      <button
                        onClick={() => handleToggleApprove(it.scene_id)}
                        className={`doodle-btn px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                          isApproved
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                            : 'bg-amber-400 hover:bg-amber-300 text-stone-950'
                        }`}
                      >
                        {isApproved ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Đã duyệt</span>
                          </>
                        ) : (
                          <span>Bấm để duyệt</span>
                        )}
                      </button>
                    </div>
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
