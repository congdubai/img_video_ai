import React from 'react';
import { Play, Square, Moon, Sun, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { ProjectInfo, TaskProgressMessage, cancelJob } from '../api/client';

interface HeaderProps {
  project: ProjectInfo | null;
  activeTask: TaskProgressMessage | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  activeTask,
  darkMode,
  onToggleDarkMode
}) => {
  const isRunning = activeTask && (activeTask.status === 'running' || activeTask.status === 'queued');

  const handleCancel = async () => {
    if (activeTask?.task_id) {
      if (confirm('Bạn có chắc chắn muốn hủy tác vụ đang chạy này và giải phóng VRAM không?')) {
        await cancelJob(activeTask.task_id);
      }
    }
  };

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <header className="h-14 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 px-6 flex items-center justify-between z-10 shrink-0">
      <div className="flex items-center space-x-4">
        {project && (
          <div className="flex items-center space-x-3">
            <span className="font-bold text-stone-900 dark:text-stone-100 text-base">
              {project.name}
            </span>
            <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Thời lượng: {formatSec(project.total_duration || 0)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Task Progress Bar (nếu có task đang chạy) */}
      <div className="flex-1 max-w-xl mx-6">
        {isRunning && (
          <div className="flex items-center space-x-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 px-3 py-1.5 rounded-lg shadow-sm">
            <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-xs font-medium text-amber-900 dark:text-amber-200 mb-1">
                <span className="truncate">{activeTask.message}</span>
                <span className="font-bold ml-2">{Math.round(activeTask.percent * 100)}%</span>
              </div>
              <div className="w-full bg-amber-200 dark:bg-amber-900 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.round(activeTask.percent * 100)}%` }}
                />
              </div>
            </div>
            <button
              onClick={handleCancel}
              title="Hủy tác vụ này"
              className="px-2 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/60 dark:hover:bg-red-800 text-red-700 dark:text-red-200 rounded text-xs font-bold transition shrink-0 flex items-center gap-1"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Hủy</span>
            </button>
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
          title="Đổi giao diện Sáng / Tối"
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
