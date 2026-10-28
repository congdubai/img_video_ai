import React from 'react';
import { 
  FolderKanban, 
  FileText, 
  Mic, 
  Film, 
  Sparkles, 
  Image as ImageIcon, 
  Video, 
  Settings, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  PlayCircle 
} from 'lucide-react';
import { ProjectInfo } from '../api/client';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  project: ProjectInfo | null;
  onBackToProjects: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  project,
  onBackToProjects
}) => {
  const steps = [
    { id: 'script', label: '1. Kịch bản', icon: FileText, key: 'script' },
    { id: 'voice', label: '2. Giọng đọc', icon: Mic, key: 'tts' },
    { id: 'scenes', label: '3. Cảnh', icon: Film, key: 'scenes' },
    { id: 'prompts', label: '4. Lệnh ảnh', icon: Sparkles, key: 'prompts' },
    { id: 'images', label: '5. Ảnh', icon: ImageIcon, key: 'images' },
    { id: 'render', label: '6. Xuất video', icon: Video, key: 'render' },
  ];

  return (
    <aside className="w-64 bg-stone-100 dark:bg-stone-900 border-r border-stone-300 dark:border-stone-800 flex flex-col justify-between shrink-0 h-screen select-none">
      <div>
        {/* Brand / Logo */}
        <div className="p-4 border-b border-stone-300 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full border-2 border-stone-900 bg-white dark:bg-stone-200 flex items-center justify-center font-bold text-stone-900 text-lg shadow-[2px_2px_0px_#1c1917]">
              ✏️
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-stone-900 dark:text-stone-100">
                Nguệch Ngoạc AI
              </h1>
              <p className="text-[11px] text-stone-500 font-medium">Local Explainer Studio</p>
            </div>
          </div>
        </div>

        {/* Project Selector Header */}
        <div className="p-3 bg-stone-200/60 dark:bg-stone-800/60 border-b border-stone-300 dark:border-stone-800 flex items-center justify-between">
          <div className="truncate mr-2">
            <div className="text-[10px] uppercase font-bold text-stone-500">Dự án hiện tại</div>
            <div className="font-bold text-sm text-stone-800 dark:text-stone-200 truncate">
              {project ? project.name : 'Chưa chọn'}
            </div>
          </div>
          <button
            onClick={onBackToProjects}
            title="Đổi dự án"
            className="p-1.5 rounded hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 text-xs font-medium flex items-center gap-1 transition"
          >
            <FolderKanban className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Steps */}
        <nav className="p-3 space-y-1">
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = currentTab === step.id;
            const statusInfo = project?.status?.[step.key as keyof typeof project.status] as { exists: boolean; stale: boolean } | undefined;
            const isDone = statusInfo?.exists;
            const isStale = statusInfo?.stale;

            return (
              <button
                key={step.id}
                onClick={() => onSelectTab(step.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-amber-400 text-stone-950 shadow-[2px_2px_0px_#1c1917] font-semibold'
                    : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{step.label}</span>
                </div>

                {/* Status Indicator Badge */}
                <div className="flex items-center">
                  {isStale ? (
                    <span 
                      className="text-amber-600 dark:text-amber-400 flex items-center gap-1 text-[11px]" 
                      title="Dữ liệu bước trước đã đổi! Bước này cần chạy lại."
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="text-[10px] hidden lg:inline font-bold">Lỗi thời</span>
                    </span>
                  ) : isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-stone-300 dark:bg-stone-700" />
                  )}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Settings */}
      <div className="p-3 border-t border-stone-300 dark:border-stone-800">
        <button
          onClick={() => onSelectTab('settings')}
          className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
            currentTab === 'settings'
              ? 'bg-stone-300 dark:bg-stone-800 text-stone-900 dark:text-stone-100'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Cài đặt & Môi trường</span>
        </button>
      </div>
    </aside>
  );
};
