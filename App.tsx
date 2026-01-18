import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, FileVideo, FileAudio, FileImage, FileText, Settings, 
  CheckCircle, Loader2, Download, AlertCircle, 
  Wand2, RefreshCw, X, Play, Music, ArrowRight, Palette,
  Sun, Moon, Monitor, Coffee, Zap
} from 'lucide-react';
import { MediaType, ConversionStatus, MediaFile, ConversionOption, ProcessingResult, Theme } from './types';
import { convertImage, getFileExtension, formatFileSize } from './utils/mediaUtils';
import { analyzeImage, processAudio, analyzeDocument } from './services/geminiService';

// Supported Input Formats
const ACCEPTED_TYPES = {
  'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'],
  'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
  'audio/*': ['.mp3', '.wav', '.aac', '.flac', '.ogg'],
  'application/pdf': ['.pdf']
};

// Theme Configuration
const THEMES: Record<Theme, React.CSSProperties> = {
  light: {
    '--bg-main': '#f8fafc',       // slate-50
    '--bg-card': '#ffffff',       // white
    '--bg-hover': '#f1f5f9',      // slate-100
    '--text-main': '#0f172a',     // slate-900
    '--text-muted': '#64748b',    // slate-500
    '--border': '#e2e8f0',        // slate-200
    '--accent': '#4f46e5',        // indigo-600
    '--accent-hover': '#4338ca',  // indigo-700
    '--accent-text': '#ffffff',
    '--accent-bg': '#e0e7ff',     // indigo-100
    '--success': '#16a34a',       // green-600
    '--success-bg': '#dcfce7',    // green-100
    '--error': '#dc2626',         // red-600
    '--error-bg': '#fee2e2',      // red-100
  } as React.CSSProperties,
  dark: {
    '--bg-main': '#0f172a',       // slate-900
    '--bg-card': '#1e293b',       // slate-800
    '--bg-hover': '#334155',      // slate-700
    '--text-main': '#f8fafc',     // slate-50
    '--text-muted': '#94a3b8',    // slate-400
    '--border': '#334155',        // slate-700
    '--accent': '#818cf8',        // indigo-400
    '--accent-hover': '#6366f1',  // indigo-500
    '--accent-text': '#0f172a',
    '--accent-bg': '#1e1b4b',     // indigo-950
    '--success': '#4ade80',       // green-400
    '--success-bg': '#14532d',    // green-900
    '--error': '#f87171',         // red-400
    '--error-bg': '#7f1d1d',      // red-900
  } as React.CSSProperties,
  grey: {
    '--bg-main': '#e5e5e5',       // neutral-200
    '--bg-card': '#f5f5f5',       // neutral-100
    '--bg-hover': '#d4d4d4',      // neutral-300
    '--text-main': '#171717',     // neutral-900
    '--text-muted': '#525252',    // neutral-600
    '--border': '#a3a3a3',        // neutral-400
    '--accent': '#404040',        // neutral-700
    '--accent-hover': '#262626',  // neutral-800
    '--accent-text': '#ffffff',
    '--accent-bg': '#d4d4d4',     // neutral-300
    '--success': '#166534',       // green-800
    '--success-bg': '#bbf7d0',    // green-200
    '--error': '#991b1b',         // red-800
    '--error-bg': '#fecaca',      // red-200
  } as React.CSSProperties,
  warm: {
    '--bg-main': '#f5f5dc',       // beige
    '--bg-card': '#fff8e1',       // amber-50ish
    '--bg-hover': '#ede9ce',
    '--text-main': '#4a3b32',     // warm brown
    '--text-muted': '#8d7b68',    // lighter brown
    '--border': '#d7ccc8',        // light brown border
    '--accent': '#a0522d',        // sienna
    '--accent-hover': '#8b4513',  // saddle brown
    '--accent-text': '#ffffff',
    '--accent-bg': '#eeddcc',     // pale sienna
    '--success': '#556b2f',       // olive drab
    '--success-bg': '#e6eecc',
    '--error': '#cd5c5c',         // indian red
    '--error-bg': '#f5dcdc',
  } as React.CSSProperties,
  cyberpunk: {
    '--bg-main': '#050505',       // black
    '--bg-card': '#111111',       // dark grey
    '--bg-hover': '#1a1a1a',
    '--text-main': '#00ff41',     // matrix green
    '--text-muted': '#008f11',    // dark matrix green
    '--border': '#003b00',
    '--accent': '#ff00ff',        // magenta
    '--accent-hover': '#d400d4',
    '--accent-text': '#000000',
    '--accent-bg': '#330033',
    '--success': '#00ff41',
    '--success-bg': '#003300',
    '--error': '#ff003c',
    '--error-bg': '#330000',
  } as React.CSSProperties,
};

export default function App() {
  const [activeFile, setActiveFile] = useState<MediaFile | null>(null);
  const [status, setStatus] = useState<ConversionStatus>(ConversionStatus.IDLE);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [currentTheme, setCurrentTheme] = useState<Theme>('light');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getMediaType = (file: File): MediaType => {
    if (file.type.startsWith('image/')) return MediaType.IMAGE;
    if (file.type.startsWith('video/')) return MediaType.VIDEO;
    if (file.type.startsWith('audio/')) return MediaType.AUDIO;
    if (file.type === 'application/pdf') return MediaType.DOCUMENT;
    return MediaType.UNKNOWN;
  };

  const processFile = (file: File) => {
    const type = getMediaType(file);
    
    if (type === MediaType.UNKNOWN) {
      setErrorMsg("Unsupported file type. Please upload Video, Audio, Image, or PDF.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    
    setActiveFile({
      file,
      previewUrl,
      type,
      id: Math.random().toString(36).substring(7),
      extension: getFileExtension(file.name)
    });
    setStatus(ConversionStatus.IDLE);
    setResult(null);
    setErrorMsg('');
    setSelectedFormat('');
    setProgress(0);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const clearFile = () => {
    if (activeFile) URL.revokeObjectURL(activeFile.previewUrl);
    setActiveFile(null);
    setStatus(ConversionStatus.IDLE);
    setResult(null);
    setSelectedFormat('');
    setProgress(0);
  };

  const getOptions = (): ConversionOption[] => {
    if (!activeFile) return [];
    
    const options: ConversionOption[] = [];
    const baseAI = { type: 'ai-analysis' as const, value: 'ai_analysis', extension: 'txt' };

    switch (activeFile.type) {
      case MediaType.IMAGE:
        options.push(
          { label: 'PNG Image', value: 'png', extension: 'png', type: 'conversion' },
          { label: 'JPEG Image', value: 'jpg', extension: 'jpg', type: 'conversion' },
          { label: 'WebP Image', value: 'webp', extension: 'webp', type: 'conversion' },
          { ...baseAI, label: 'AI: Describe Image' }
        );
        break;
      case MediaType.VIDEO:
        options.push(
          { label: 'MP4 Video', value: 'mp4', extension: 'mp4', type: 'conversion' },
          { label: 'AVI Video', value: 'avi', extension: 'avi', type: 'conversion' },
          { label: 'MOV Video', value: 'mov', extension: 'mov', type: 'conversion' },
          { label: 'MKV Video', value: 'mkv', extension: 'mkv', type: 'conversion' },
          { label: 'GIF Animation', value: 'gif', extension: 'gif', type: 'conversion' },
          { label: 'MP3 Audio (Extract)', value: 'mp3', extension: 'mp3', type: 'conversion' },
          { ...baseAI, label: 'AI: Summarize Video' }
        );
        break;
      case MediaType.AUDIO:
        options.push(
          { label: 'MP3 Audio', value: 'mp3', extension: 'mp3', type: 'conversion' },
          { label: 'WAV Audio', value: 'wav', extension: 'wav', type: 'conversion' },
          { label: 'AAC Audio', value: 'aac', extension: 'aac', type: 'conversion' },
          { label: 'FLAC Audio', value: 'flac', extension: 'flac', type: 'conversion' },
          { ...baseAI, label: 'AI: Transcribe Audio' }
        );
        break;
      case MediaType.DOCUMENT:
        options.push(
           { ...baseAI, label: 'AI: Summarize Document' },
           { label: 'Convert to TXT', value: 'txt', extension: 'txt', type: 'conversion' },
           { label: 'Convert to DOCX', value: 'docx', extension: 'docx', type: 'conversion' }
        );
        break;
    }
    return options;
  };

  const simulateProgress = async () => {
    return new Promise<void>((resolve) => {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(interval);
            return 95;
          }
          return prev + Math.random() * 15;
        });
      }, 300);
      setTimeout(() => {
        clearInterval(interval);
        setProgress(100);
        resolve();
      }, 2000);
    });
  };

  const handleProcess = async () => {
    if (!activeFile || !selectedFormat) return;

    setStatus(ConversionStatus.PROCESSING);
    setErrorMsg('');
    setResult(null);
    setProgress(0);

    const option = getOptions().find(o => o.value === selectedFormat);
    if (!option) return;

    try {
      if (option.type === 'ai-analysis') {
        setProgress(30);
        let textResult = '';
        if (activeFile.type === MediaType.IMAGE) {
          textResult = await analyzeImage(activeFile.file);
        } else if (activeFile.type === MediaType.AUDIO) {
          textResult = await processAudio(activeFile.file);
        } else if (activeFile.type === MediaType.DOCUMENT) {
          textResult = await analyzeDocument(activeFile.file);
        } else {
          await new Promise(r => setTimeout(r, 1500));
          textResult = "Video content analysis requires backend resources. (Demo Output: The video features a clear instructional walkthrough...)";
        }
        setProgress(100);
        const blob = new Blob([textResult], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        setResult({ url, filename: `analysis_${activeFile.file.name}.txt`, text: textResult });
      }
      else if (activeFile.type === MediaType.IMAGE && ['png', 'jpg', 'webp'].includes(option.value)) {
        const mime = option.value === 'png' ? 'image/png' : option.value === 'webp' ? 'image/webp' : 'image/jpeg';
        const blob = await convertImage(activeFile.file, mime);
        setProgress(100);
        const url = URL.createObjectURL(blob);
        const nameParts = activeFile.file.name.split('.');
        const newName = `${nameParts.slice(0, -1).join('.')}.${option.extension}`;
        setResult({ url, filename: newName });
      }
      else {
        await simulateProgress();
        const url = URL.createObjectURL(activeFile.file);
        setResult({ 
          url, 
          filename: `converted_${activeFile.file.name.split('.')[0]}.${option.extension}`,
          text: `Conversion to ${option.extension.toUpperCase()} simulated. In a production environment with Python/MoviePy/PDF tools, this file would be processed on the server.`
        });
      }
      setStatus(ConversionStatus.SUCCESS);
    } catch (err: any) {
      console.error(err);
      setStatus(ConversionStatus.ERROR);
      setErrorMsg(err.message || "An error occurred during processing.");
    }
  };

  // Convert theme object to CSS string for injection
  const cssVariables = Object.entries(THEMES[currentTheme])
    .map(([key, value]) => `${key}: ${value};`)
    .join(' ');

  const ThemeButton = ({ theme, icon: Icon, label }: { theme: Theme, icon: any, label: string }) => (
    <button
      onClick={() => setCurrentTheme(theme)}
      className={`
        flex items-center gap-2 p-2 rounded-lg text-sm transition-all w-full
        ${currentTheme === theme 
          ? 'bg-[var(--accent)] text-[var(--accent-text)] shadow-md' 
          : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
        }
      `}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );

  return (
    <>
      <style>{`:root { ${cssVariables} }`}</style>
      <div className="flex h-screen bg-[var(--bg-main)] text-[var(--text-main)] font-sans overflow-hidden transition-colors duration-300">
        
        {/* Sidebar */}
        <aside className="w-72 bg-[var(--bg-card)] border-r border-[var(--border)] flex flex-col z-10 shadow-sm hidden md:flex transition-colors duration-300">
          <div className="p-6 border-b border-[var(--border)]">
            <div className="flex items-center gap-2 font-bold text-xl text-[var(--accent)]">
               <RefreshCw className="w-6 h-6" />
               <span>UniConverter</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">Universal Media Tool</p>
          </div>

          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <div>
              <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Settings</h3>
              <div className="space-y-3">
                 <div className="flex items-center justify-between text-sm text-[var(--text-main)]">
                   <span>Output Quality</span>
                   <span className="text-[var(--accent)] font-medium bg-[var(--accent-bg)] px-2 py-0.5 rounded">High</span>
                 </div>
                 <div className="flex items-center justify-between text-sm text-[var(--text-main)]">
                   <span>AI Analysis</span>
                   <span className="text-[var(--success)] font-medium bg-[var(--success-bg)] px-2 py-0.5 rounded">Enabled</span>
                 </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                <Palette className="w-3 h-3" /> Theme
              </h3>
              <div className="space-y-1">
                <ThemeButton theme="light" icon={Sun} label="Light Mode" />
                <ThemeButton theme="dark" icon={Moon} label="Dark Mode" />
                <ThemeButton theme="grey" icon={Monitor} label="Grey Mode" />
                <ThemeButton theme="warm" icon={Coffee} label="Warm Mode" />
                <ThemeButton theme="cyberpunk" icon={Zap} label="Cyberpunk" />
              </div>
            </div>

            <div>
               <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">About</h3>
               <div className="p-4 bg-[var(--bg-hover)] rounded-lg border border-[var(--border)] text-xs text-[var(--text-muted)] space-y-2">
                  <p><strong>Supported:</strong></p>
                  <p>🎥 MP4, AVI, MOV, MKV</p>
                  <p>🎵 MP3, WAV, AAC, FLAC</p>
                  <p>🖼️ JPG, PNG, WEBP</p>
                  <p>📄 PDF Documents</p>
               </div>
            </div>
          </div>

          <div className="p-4 border-t border-[var(--border)] text-center">
            <p className="text-xs text-[var(--text-muted)]">Powered by Gemini & React</p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-full relative overflow-y-auto">
          <header className="bg-[var(--bg-card)] px-8 py-5 border-b border-[var(--border)] flex items-center justify-between sticky top-0 z-10 transition-colors duration-300">
             <div className="flex items-center gap-3">
               <div className="md:hidden">
                  <RefreshCw className="w-6 h-6 text-[var(--accent)]" />
               </div>
               <h1 className="text-xl font-semibold text-[var(--text-main)]">Media Converter & Processor</h1>
             </div>
             <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
               <span className="w-2 h-2 rounded-full bg-[var(--success)]"></span>
               <span className="hidden sm:inline">System Ready</span>
             </div>
          </header>

          <div className="flex-1 p-4 md:p-8 w-full h-full flex flex-col">
            
            {!activeFile ? (
              <div className="flex-1 w-full h-full flex flex-col animate-in fade-in zoom-in duration-500">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`
                    flex-1 w-full flex flex-col items-center justify-center
                    border-3 border-dashed rounded-3xl p-6 md:p-16 text-center transition-all cursor-pointer group bg-[var(--bg-card)] relative overflow-hidden
                    ${isDragging 
                      ? 'border-[var(--accent)] bg-[var(--accent-bg)] scale-[1.005] shadow-2xl ring-4 ring-[var(--accent-bg)]' 
                      : 'border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-hover)] hover:shadow-xl'
                    }
                  `}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    onChange={handleFileSelect}
                    accept={Object.values(ACCEPTED_TYPES).flat().join(',')}
                  />
                  
                  <div className="relative z-10 flex flex-col items-center">
                      <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-8 transition-transform shadow-sm ${
                      isDragging ? 'bg-[var(--accent-bg)] scale-110 rotate-3' : 'bg-[var(--accent-bg)] group-hover:scale-110 group-hover:-rotate-3'
                      }`}>
                      <Upload className={`w-12 h-12 ${isDragging ? 'text-[var(--accent-hover)]' : 'text-[var(--accent)]'}`} />
                      </div>
                      <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-main)] mb-4 tracking-tight">
                      {isDragging ? 'Drop File Here' : 'Drag & Drop or Click'}
                      </h2>
                      <p className="text-[var(--text-muted)] text-lg md:text-xl max-w-lg mx-auto">
                      Transform your media instantly. Support for high-quality Video, Audio, Images, and PDF.
                      </p>
                      
                      <div className="mt-12 flex flex-wrap justify-center gap-4 md:gap-8 text-sm md:text-base font-medium text-[var(--text-muted)]">
                          <span className="flex items-center gap-2 px-3 py-1 bg-[var(--bg-hover)] rounded-full border border-[var(--border)]"><FileVideo className="w-4 h-4 text-[var(--accent)]" /> Video</span>
                          <span className="flex items-center gap-2 px-3 py-1 bg-[var(--bg-hover)] rounded-full border border-[var(--border)]"><FileAudio className="w-4 h-4 text-[var(--accent)]" /> Audio</span>
                          <span className="flex items-center gap-2 px-3 py-1 bg-[var(--bg-hover)] rounded-full border border-[var(--border)]"><FileImage className="w-4 h-4 text-[var(--accent)]" /> Image</span>
                          <span className="flex items-center gap-2 px-3 py-1 bg-[var(--bg-hover)] rounded-full border border-[var(--border)]"><FileText className="w-4 h-4 text-[var(--accent)]" /> PDF</span>
                      </div>
                  </div>

                  {isDragging && (
                      <div className="absolute inset-0 bg-[var(--accent-bg)] opacity-20 flex items-center justify-center pointer-events-none">
                          <div className="w-[120%] h-[120%] border-[20px] border-[var(--accent)] rounded-full animate-pulse opacity-20"></div>
                      </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="max-w-5xl mx-auto w-full space-y-6 animate-in slide-in-from-bottom-8 duration-500">
                
                <div className="bg-[var(--bg-card)] rounded-2xl p-6 shadow-sm border border-[var(--border)] flex flex-col md:flex-row gap-8 items-start transition-colors duration-300">
                  <div className="w-full md:w-64 bg-slate-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center relative flex-shrink-0 shadow-inner group">
                    {activeFile.type === MediaType.IMAGE && (
                      <img src={activeFile.previewUrl} alt="Preview" className="w-full h-full object-contain" />
                    )}
                    {activeFile.type === MediaType.VIDEO && (
                       <div className="relative w-full h-full flex items-center justify-center">
                          <video src={activeFile.previewUrl} className="w-full h-full object-contain opacity-60" />
                          <Play className="absolute w-12 h-12 text-white opacity-80 group-hover:scale-110 transition-transform" />
                       </div>
                    )}
                    {activeFile.type === MediaType.AUDIO && (
                      <div className="text-white/50 flex flex-col items-center">
                        <Music className="w-16 h-16 mb-2" />
                        <span className="text-xs font-mono uppercase">Audio File</span>
                      </div>
                    )}
                    {activeFile.type === MediaType.DOCUMENT && (
                      <div className="text-white/50 flex flex-col items-center">
                        <FileText className="w-16 h-16 mb-2" />
                        <span className="text-xs font-mono uppercase">PDF Document</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 w-full space-y-6">
                     <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-bold text-[var(--text-main)] truncate max-w-md" title={activeFile.file.name}>{activeFile.file.name}</h3>
                          <div className="flex items-center gap-3 mt-1 text-sm text-[var(--text-muted)]">
                             <span className="px-2 py-0.5 bg-[var(--bg-hover)] rounded text-[var(--text-main)] font-medium uppercase">{activeFile.extension}</span>
                             <span>•</span>
                             <span>{formatFileSize(activeFile.file.size)}</span>
                          </div>
                        </div>
                        <button onClick={clearFile} className="p-2 hover:bg-[var(--bg-hover)] rounded-full text-[var(--text-muted)] hover:text-[var(--error)] transition-colors">
                          <X className="w-5 h-5" />
                        </button>
                     </div>

                     <hr className="border-[var(--border)]" />

                     <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-[var(--text-main)] mb-2">Convert To</label>
                          <div className="relative">
                            <select 
                              value={selectedFormat}
                              onChange={(e) => setSelectedFormat(e.target.value)}
                              disabled={status === ConversionStatus.PROCESSING || status === ConversionStatus.SUCCESS}
                              className="w-full appearance-none p-4 pl-12 bg-[var(--bg-main)] border border-[var(--border)] rounded-xl text-[var(--text-main)] font-medium focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all outline-none disabled:opacity-50 disabled:bg-[var(--bg-hover)] cursor-pointer"
                            >
                              <option value="">Select target format...</option>
                              {getOptions().map(opt => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.type === 'ai-analysis' ? '✨ ' : ''}{opt.label}
                                </option>
                              ))}
                            </select>
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                              {selectedFormat.includes('ai') ? <Wand2 className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
                            </div>
                          </div>
                        </div>

                        {status === ConversionStatus.PROCESSING && (
                          <div className="space-y-2">
                             <div className="flex justify-between text-xs font-semibold text-[var(--accent)] uppercase tracking-wider">
                               <span>Processing</span>
                               <span>{Math.round(progress)}%</span>
                             </div>
                             <div className="h-2 w-full bg-[var(--bg-hover)] rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-[var(--accent)] transition-all duration-300 ease-out"
                                  style={{ width: `${progress}%` }}
                                />
                             </div>
                          </div>
                        )}

                        {status !== ConversionStatus.SUCCESS && (
                          <button
                            onClick={handleProcess}
                            disabled={!selectedFormat || status === ConversionStatus.PROCESSING}
                            className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-md ${
                              !selectedFormat || status === ConversionStatus.PROCESSING
                                ? 'bg-[var(--bg-hover)] text-[var(--text-muted)] cursor-not-allowed shadow-none'
                                : 'bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] hover:-translate-y-0.5'
                            }`}
                          >
                            {status === ConversionStatus.PROCESSING ? (
                               <>
                                 <Loader2 className="w-5 h-5 animate-spin" />
                                 Processing File...
                               </>
                            ) : (
                               <>
                                 {selectedFormat.includes('ai') ? 'Start Analysis' : 'Convert File'} 
                                 <ArrowRight className="w-5 h-5" />
                               </>
                            )}
                          </button>
                        )}
                     </div>
                  </div>
                </div>

                {status === ConversionStatus.SUCCESS && result && (
                   <div className="bg-[var(--success-bg)] border border-[var(--success)] rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-bottom-4 transition-colors duration-300">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-[var(--bg-card)] text-[var(--success)] rounded-full flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="w-6 h-6" />
                         </div>
                         <div>
                            <h3 className="text-lg font-bold text-[var(--text-main)]">Conversion Successful</h3>
                            <p className="text-[var(--success)]">{result.filename}</p>
                         </div>
                      </div>
                      
                      <div className="flex items-center gap-3 w-full md:w-auto">
                         <button onClick={clearFile} className="px-4 py-2 text-[var(--success)] font-medium hover:bg-[var(--bg-card)] rounded-lg transition-colors">
                            Convert Another
                         </button>
                         <a 
                           href={result.url} 
                           download={result.filename}
                           className="flex-1 md:flex-none px-6 py-3 bg-[var(--success)] text-[var(--accent-text)] rounded-xl font-semibold hover:opacity-90 transition-colors flex items-center justify-center gap-2 shadow-sm"
                         >
                           <Download className="w-5 h-5" />
                           Download Result
                         </a>
                      </div>

                      {result.text && (
                         <div className="w-full mt-2 bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border)] text-[var(--text-main)] text-sm leading-relaxed max-h-60 overflow-y-auto">
                            <strong className="block text-[var(--success)] text-xs uppercase tracking-wider mb-2">Analysis Result</strong>
                            {result.text}
                         </div>
                      )}
                   </div>
                )}

                {status === ConversionStatus.ERROR && (
                  <div className="bg-[var(--error-bg)] border border-[var(--error)] rounded-xl p-4 flex items-center gap-3 text-[var(--error)]">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p>{errorMsg}</p>
                  </div>
                )}

              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
