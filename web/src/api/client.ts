export interface StepStatus {
  exists: boolean;
  stale: boolean;
}

export interface ProjectInfo {
  name: string;
  total_duration: number;
  status: {
    script: StepStatus;
    tts: StepStatus;
    scenes: StepStatus;
    prompts: StepStatus;
    images: StepStatus;
    render: StepStatus;
    total_duration: number;
  };
}

export interface SentenceItem {
  id: number;
  start: number;
  end: number;
  duration: number;
  silence_after: number;
  text: string;
  audio_file: string;
}

export interface TimelineData {
  version: string;
  source_fingerprint: string;
  sample_rate: number;
  total_duration: number;
  sentences: SentenceItem[];
}

export interface SceneItem {
  scene_id: number;
  start: number;
  end: number;
  duration: number;
  sentence_ids: number[];
  text: string;
}

export interface ScenesData {
  version: string;
  source_fingerprint: string;
  total_scenes: number;
  scenes: SceneItem[];
}

export interface PromptItem {
  scene_id: number;
  scene_type: 'character' | 'compare' | 'object';
  prompt_en: string;
  overlay_text: string;
  status: 'draft' | 'approved';
}

export interface PromptsData {
  version: string;
  source_fingerprint: string;
  style_prefix: string;
  negative_prompt: string;
  prompts: PromptItem[];
}

export interface TaskProgressMessage {
  type: string;
  task_id: string;
  project_name: string;
  step: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  percent: number;
  message: string;
  data?: any;
  error?: string;
}

const API_BASE = '/api';

export async function fetchProjects(): Promise<ProjectInfo[]> {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error('Không thể tải danh sách dự án');
  const data = await res.json();
  return data.projects || [];
}

export async function createProject(name: string, script?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, script })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Lỗi tạo dự án');
  }
}

export async function duplicateProject(name: string, targetName: string): Promise<void> {
  const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(name)}/duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_name: targetName })
  });
  if (!res.ok) throw new Error('Không thể nhân đôi dự án');
}

export async function deleteProject(name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(name)}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Không thể xóa dự án');
}

export async function getProjectFile<T = any>(projectName: string, fileType: string): Promise<{ content: T; exists: boolean }> {
  const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectName)}/files/${fileType}`);
  if (!res.ok) throw new Error(`Lỗi đọc file ${fileType}`);
  return res.json();
}

export async function updateProjectFile(projectName: string, fileType: string, content: any): Promise<void> {
  const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectName)}/files/${fileType}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
  if (!res.ok) throw new Error(`Lỗi lưu file ${fileType}`);
}

export async function triggerJob(projectName: string, step: string, params: any = {}): Promise<{ task_id: string }> {
  const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectName)}/jobs/${step}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || `Lỗi kích hoạt ${step}`);
  }
  return res.json();
}

export async function uploadSceneImage(projectName: string, sceneId: number, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectName)}/images/${sceneId}/upload`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Lỗi tải ảnh lên');
}

export async function cancelJob(taskId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/jobs/${taskId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Không thể hủy tác vụ');
}

export async function fetchEnv(): Promise<any> {
  const res = await fetch(`${API_BASE}/env`);
  if (!res.ok) throw new Error('Không thể kiểm tra môi trường');
  return res.json();
}

export function createProgressSocket(onMessage: (msg: TaskProgressMessage) => void): () => void {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/api/ws/progress`;
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'progress') {
        onMessage(data);
      }
    } catch (e) {
      // ignore
    }
  };

  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('ping');
    }
  }, 10000);

  return () => {
    clearInterval(pingInterval);
    ws.close();
  };
}
