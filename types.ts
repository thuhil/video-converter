export enum MediaType {
  VIDEO = 'video',
  AUDIO = 'audio',
  IMAGE = 'image',
  UNKNOWN = 'unknown'
}

export enum ConversionStatus {
  IDLE = 'idle',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  ERROR = 'error'
}

export interface MediaFile {
  file: File;
  previewUrl: string;
  type: MediaType;
  id: string;
  extension: string;
}

export interface ConversionOption {
  label: string;
  value: string;
  extension: string;
  type: 'conversion' | 'ai-analysis';
  description?: string;
}

export interface ProcessingResult {
  url?: string;
  filename?: string;
  text?: string;
  stats?: string;
}
