export interface GenerationConfig {
  apiKey: string;
  prompt: string;
  model: string;
  seconds: string;
  size: string;
  watermark: string;
  startImage: File | null;
  endImage: File | null;
  endFrameParamName: string; // New field for customizable parameter name
}

export interface ApiResponse {
  id?: string;
  task_id?: string;
  code?: number;
  message?: string;
  data?: any;
  output?: {
    video_url?: string;
  };
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  prompt: string;
  model: string;
  status: GenerationStatus;
  videoUrl?: string;
  thumbnailUrl?: string; // Optional: could be the start image URL if we object-url it
  error?: string;
}