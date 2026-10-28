import React, { useState, useEffect } from 'react';
import { 
  ImageIcon, 
  RotateCcw, 
  ArrowRight, 
  Eye, 
  Upload, 
  Check, 
  AlertTriangle,
  Sliders,
  Sparkles,
  Maximize2,
  X
} from 'lucide-react';
import { PromptsData, ScenesData, getProjectFile, triggerJob } from '../api/client';

interface ImagesPageProps {
  projectName: string;
  onNextStep: () => void;
}

export const ImagesPage: React.FC<ImagesPageProps> = ({ projectName, onNextStep }) => {
  const [promptsData, setPromptsData] = useState<PromptsData | null>(null);
  const [scenesData, setScenesData] = useState<ScenesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'approved' | 'missing'>('all');
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
  const [variantsCount, setVariantsCount] = useState<number>(1);
  const [refreshKey, setRefreshKey] = useState<number>(Date.now());

  const loadData = async () => {
    try {
      setLoading(true);
      const [pRes, sRes] = await Promise.all([
        getProjectFile<PromptsData>(projectName, 'prompts'),
        getProjectFile<ScenesData>(projectName, 'scenes')
      ]);
      if (pRes.exists && pRes.content) setPromptsData(pRes.content);
      if (sRes.exists && sRes.content) setScenesData(sRes.content);
      setRefreshKey(Date.now());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectName]);

  const handleGenerateAll = async (ignoreApproval: boolean = false) => {
    try {
      await triggerJob(projectName, 'images', { 
        variants: variantsCount, 
        force: true, 
        all: ignoreApproval 
      });
      setTimeout(loadData, 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleGenerateSingle = async (scId: number) => {
    try {
      await triggerJob(projectName, 'images', { 
        scene_id: scId, 
        variants: variantsCount, 
        force: true, 
        all: true 
      });
      setTimeout(loadData, 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-stone-500 font-medium">Đang tải danh sách ảnh...</div>;
  }

  const items = promptsData?.prompts || [];
  const scenes = scenesData?.scenes || [];

  const filteredItems = items.filter((it) => {
    if (filter === 'approved') return it.status === 'approved';
    return true;
  });

  const selectedItem = items.find((it) => it.scene_id === selectedSceneId);
  const selectedScene = scenes.find((s) => s.scene_id === selectedSceneId);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-stone-300 dark:border-stone-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>Bước 5: Thư viện ảnh theo Cảnh</span>
            <span className="text-xs bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-2 py-0.5 rounded-full font-bold">
              images/
            </span>
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
            Ảnh vẽ tay doodle tỉ lệ 16:9, độ phân giải cao để zoom mượt mà không vỡ hạt.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleGenerateAll(false)}
            className="doodle-btn px-3 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl font-bold text-xs flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Sinh các cảnh đã duyệt</span>
          </button>

          <button
            onClick={() => handleGenerateAll(true)}
            className="doodle-btn px-3 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 rounded-xl font-bold text-xs flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Sinh tất cả các cảnh</span>
          </button>

          <button
            onClick={onNextStep}
            className="doodle-btn px-4 py-2 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-950 rounded-xl font-bold text-xs flex items-center gap-2"
          >
            <span>Tiếp theo: Xuất video</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Grid of Images */}
      {items.length === 0 ? (
        <div className="py-12 text-center text-stone-500 border-2 border-dashed border-stone-300 dark:border-stone-800 rounded-2xl">
          <p className="font-bold text-sm">Chưa có danh sách cảnh để sinh ảnh</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredItems.map((it) => {
            const sc = scenes.find((s) => s.scene_id === it.scene_id);
            const thumbUrl = `/api/projects/${encodeURIComponent(projectName)}/media/images/scene_${String(it.scene_id).padStart(3, '0')}.png?thumb=1&w=480&t=${refreshKey}`;
            const isApproved = it.status === 'approved';

            return (
              <div
                key={it.scene_id}
                onClick={() => setSelectedSceneId(it.scene_id)}
                className="doodle-card bg-white dark:bg-stone-900 rounded-2xl overflow-hidden border-2 border-stone-900 dark:border-stone-700 cursor-pointer group flex flex-col justify-between"
              >
                {/* Image Canvas / Preview */}
                <div className="relative aspect-video bg-stone-200 dark:bg-stone-800 overflow-hidden">
                  <img
                    src={thumbUrl}
                    alt={`Cảnh #${it.scene_id}`}
                    loading="lazy"
                    onError={(e) => {
                      // Fallback hiển thị placeholder
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />

                  {/* Badge số cảnh */}
                  <div className="absolute top-2 left-2 bg-amber-400 text-stone-950 font-bold text-xs px-2 py-0.5 rounded-md shadow-[1px_1px_0px_#1c1917]">
                    #{it.scene_id}
                  </div>

                  {/* Status Badge */}
                  <div className="absolute top-2 right-2">
                    {isApproved ? (
                      <span className="bg-emerald-500 text-white p-1 rounded-md shadow-sm flex items-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="bg-stone-900/80 text-stone-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        Nháp
                      </span>
                    )}
                  </div>
                </div>

                {/* Info Footer */}
                <div className="p-3">
                  <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 line-clamp-2 mb-2">
                    {sc?.text || it.prompt_en}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-stone-500 font-medium">
                    <span>{sc ? `${sc.duration.toFixed(1)}s` : ''}</span>
                    <span className="group-hover:text-amber-500 font-bold flex items-center gap-1 transition">
                      <Eye className="w-3 h-3" /> Xem chi tiết
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Xem Lớn & Thao Tác Cảnh */}
      {selectedSceneId !== null && selectedItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="doodle-card bg-white dark:bg-stone-900 rounded-2xl max-w-3xl w-full p-6 border-2 border-stone-900 dark:border-stone-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-200 dark:border-stone-800">
              <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <span>Chi tiết ảnh Cảnh #{selectedItem.scene_id}</span>
                <span className="text-xs bg-amber-400 text-stone-950 px-2 py-0.5 rounded-full font-bold">
                  {selectedScene ? `${selectedScene.duration.toFixed(1)}s` : ''}
                </span>
              </h3>

              <button
                onClick={() => setSelectedSceneId(null)}
                className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Large Image Preview */}
            <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-stone-900 dark:border-stone-700 mb-4 bg-stone-100 dark:bg-stone-800">
              <img
                src={`/api/projects/${encodeURIComponent(projectName)}/media/images/scene_${String(selectedItem.scene_id).padStart(3, '0')}.png?t=${refreshKey}`}
                alt={`Cảnh #${selectedItem.scene_id}`}
                className="w-full h-full object-contain"
              />
            </div>

            {/* Info details */}
            <div className="space-y-3 mb-6">
              <div>
                <label className="text-[11px] font-bold text-stone-500 uppercase">Thoại cảnh:</label>
                <div className="p-2.5 bg-stone-100 dark:bg-stone-800 rounded-lg text-xs font-medium text-stone-800 dark:text-stone-200 mt-1">
                  {selectedScene?.text || 'Không có câu thoại'}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-500 uppercase">Prompt tiếng Anh:</label>
                <div className="p-2.5 bg-stone-100 dark:bg-stone-800 rounded-lg text-xs font-mono text-stone-800 dark:text-stone-200 mt-1">
                  {selectedItem.prompt_en || 'Chưa có prompt'}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-200 dark:border-stone-800">
              <button
                onClick={() => handleGenerateSingle(selectedItem.scene_id)}
                className="doodle-btn px-4 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 rounded-xl font-bold text-xs flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Sinh lại ảnh cảnh này</span>
              </button>

              <button
                onClick={() => setSelectedSceneId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
