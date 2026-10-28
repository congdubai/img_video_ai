import React, { useState, useEffect } from 'react';
import { Plus, Folder, Copy, Trash2, ArrowRight, Clock, Video, CheckCircle, AlertTriangle } from 'lucide-react';
import { ProjectInfo, fetchProjects, createProject, duplicateProject, deleteProject } from '../api/client';

interface ProjectListPageProps {
  onSelectProject: (name: string) => void;
}

export const ProjectListPage: React.FC<ProjectListPageProps> = ({ onSelectProject }) => {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newProjectName, setNewProjectName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const list = await fetchProjects();
      setProjects(list);
    } catch (e: any) {
      setErrorMsg(e.message || 'Lỗi tải dự án');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      await createProject(newProjectName.trim());
      setNewProjectName('');
      setShowCreateModal(false);
      await load();
      onSelectProject(newProjectName.trim());
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDuplicate = async (pName: string) => {
    const target = prompt(`Nhập tên dự án mới để nhân đôi từ "${pName}":`, `${pName}_copy`);
    if (!target) return;
    try {
      await duplicateProject(pName, target);
      await load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (pName: string) => {
    if (confirm(`Bạn có chắc chắn muốn XÓA VĨNH VIỄN dự án "${pName}" không? Thao tác này không thể hoàn tác!`)) {
      try {
        await deleteProject(pName);
        await load();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-8 border-b border-stone-300 dark:border-stone-800 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>Dự án video Nguệch Ngoạc</span>
            <span className="text-xs bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full font-bold">
              Local Studio
            </span>
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
            Minh họa nét vẽ tay doodle, giọng đọc tiếng Việt, zoom mượt và phụ đề có hiệu ứng
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="doodle-btn px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-stone-950 rounded-xl font-bold text-sm flex items-center gap-2 self-start md:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Tạo dự án mới</span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-stone-500 font-medium">Đang tải danh sách dự án...</div>
      ) : projects.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-stone-300 dark:border-stone-800 rounded-2xl bg-white/50 dark:bg-stone-900/50 p-8">
          <Folder className="w-12 h-12 text-stone-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">Chưa có dự án nào</h3>
          <p className="text-sm text-stone-500 mt-1 max-w-sm mx-auto">
            Bấm "Tạo dự án mới" để bắt đầu viết kịch bản và làm video giải thích đầu tiên.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p) => {
            const hasVideo = p.status.render.exists;
            const steps = [
              { label: 'Kịch bản', done: p.status.script.exists, stale: p.status.script.stale },
              { label: 'Giọng', done: p.status.tts.exists, stale: p.status.tts.stale },
              { label: 'Cảnh', done: p.status.scenes.exists, stale: p.status.scenes.stale },
              { label: 'Lệnh ảnh', done: p.status.prompts.exists, stale: p.status.prompts.stale },
              { label: 'Ảnh', done: p.status.images.exists, stale: p.status.images.stale },
              { label: 'Video', done: p.status.render.exists, stale: false },
            ];

            return (
              <div
                key={p.name}
                className="doodle-card bg-white dark:bg-stone-900 rounded-2xl p-5 flex flex-col justify-between border-2 border-stone-900 dark:border-stone-700 hover:border-amber-500 transition"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-lg text-stone-900 dark:text-stone-100 truncate pr-2">
                      {p.name}
                    </h3>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => handleDuplicate(p.name)}
                        title="Nhân đôi dự án"
                        className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.name)}
                        title="Xóa dự án"
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-stone-400 hover:text-red-600 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Duration Badge */}
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-stone-400 mb-4">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Thời lượng: {p.total_duration ? formatSec(p.total_duration) : '--:--'}</span>
                  </div>

                  {/* Step status mini badges */}
                  <div className="grid grid-cols-3 gap-1.5 mb-6">
                    {steps.map((st, idx) => (
                      <div
                        key={idx}
                        className={`text-[11px] px-2 py-1 rounded font-medium flex items-center justify-between ${
                          st.stale
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300'
                            : st.done
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-400 border border-stone-200 dark:border-stone-800'
                        }`}
                      >
                        <span className="truncate">{st.label}</span>
                        {st.stale ? (
                          <AlertTriangle className="w-3 h-3 shrink-0 ml-1 text-amber-600" />
                        ) : st.done ? (
                          <CheckCircle className="w-3 h-3 shrink-0 ml-1 text-emerald-600" />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Open Button */}
                <button
                  onClick={() => onSelectProject(p.name)}
                  className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-950 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <span>Mở dự án</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Tạo Dự Án */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="doodle-card bg-white dark:bg-stone-900 rounded-2xl max-w-md w-full p-6 border-2 border-stone-900 dark:border-stone-700">
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-2">
              Tạo dự án video mới
            </h3>
            <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">
              Đặt tên thư mục dự án (viết liền không dấu hoặc gạch dưới, ví dụ: <code>tai_sao_troi_xanh</code>)
            </p>

            <form onSubmit={handleCreate}>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="ví dụ: giai_thich_hố_đen"
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-stone-900 dark:border-stone-700 dark:bg-stone-800 text-sm font-medium mb-4 focus:outline-none focus:border-amber-500"
                autoFocus
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="doodle-btn px-4 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 rounded-xl text-sm font-bold"
                >
                  Tạo ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
