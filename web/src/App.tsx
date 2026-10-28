import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ProjectListPage } from './pages/ProjectListPage';
import { ScriptPage } from './pages/ScriptPage';
import { VoicePage } from './pages/VoicePage';
import { ScenesPage } from './pages/ScenesPage';
import { PromptsPage } from './pages/PromptsPage';
import { ImagesPage } from './pages/ImagesPage';
import { RenderPage } from './pages/RenderPage';
import { SettingsPage } from './pages/SettingsPage';
import { 
  ProjectInfo, 
  TaskProgressMessage, 
  fetchProjects, 
  createProgressSocket 
} from './api/client';

export const App: React.FC = () => {
  const [currentProjectName, setCurrentProjectName] = useState<string | null>('sample_project');
  const [currentTab, setCurrentTab] = useState<string>('script');
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [activeTask, setActiveTask] = useState<TaskProgressMessage | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Khởi tạo chế độ Sáng / Tối theo hệ thống
  useEffect(() => {
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(isDark);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Nạp danh sách dự án
  const reloadProjects = async () => {
    try {
      const list = await fetchProjects();
      setProjects(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    reloadProjects();
  }, [currentProjectName]);

  // Lắng nghe WebSocket tiến độ
  useEffect(() => {
    const cleanup = createProgressSocket((msg) => {
      setActiveTask(msg);
      if (msg.status === 'completed' || msg.status === 'failed') {
        // Cập nhật lại trạng thái dự án khi task hoàn tất
        reloadProjects();
      }
    });
    return cleanup;
  }, []);

  const currentProject = projects.find((p) => p.name === currentProjectName) || null;

  // Chuyển sang bước tiếp theo
  const stepOrder = ['script', 'voice', 'scenes', 'prompts', 'images', 'render'];
  const handleNextStep = () => {
    const curIdx = stepOrder.indexOf(currentTab);
    if (curIdx !== -1 && curIdx < stepOrder.length - 1) {
      setCurrentTab(stepOrder[curIdx + 1]);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8F6F0] dark:bg-stone-950 font-sans">
      {/* Sidebar 6 bước */}
      {currentProjectName && (
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          project={currentProject}
          onBackToProjects={() => setCurrentProjectName(null)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header
          project={currentProject}
          activeTask={activeTask}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
        />

        <main className="flex-1 overflow-y-auto">
          {!currentProjectName ? (
            <ProjectListPage
              onSelectProject={(name) => {
                setCurrentProjectName(name);
                setCurrentTab('script');
              }}
            />
          ) : currentTab === 'script' ? (
            <ScriptPage projectName={currentProjectName} onNextStep={handleNextStep} />
          ) : currentTab === 'voice' ? (
            <VoicePage projectName={currentProjectName} onNextStep={handleNextStep} />
          ) : currentTab === 'scenes' ? (
            <ScenesPage projectName={currentProjectName} onNextStep={handleNextStep} />
          ) : currentTab === 'prompts' ? (
            <PromptsPage projectName={currentProjectName} onNextStep={handleNextStep} />
          ) : currentTab === 'images' ? (
            <ImagesPage projectName={currentProjectName} onNextStep={handleNextStep} />
          ) : currentTab === 'render' ? (
            <RenderPage projectName={currentProjectName} />
          ) : currentTab === 'settings' ? (
            <SettingsPage />
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default App;
