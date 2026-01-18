import React, { useState, useRef } from 'react';
import { 
  Upload, FileVideo, FileAudio, FileImage, FileText, Settings, 
  CheckCircle, Loader2, Download, AlertCircle, 
  Wand2, RefreshCw, X, Play, Music, ArrowRight
} from 'lucide-react';
import { MediaType, ConversionStatus, MediaFile, ConversionOption, ProcessingResult } from './types';
import { convertImage, getFileExtension, formatFileSize } from './utils/mediaUtils';
import { analyzeImage, processAudio, analyzeDocument } from './services/geminiService';

// Supported Input Formats
const ACCEPTED_TYPES = {
  'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'],
  'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
  'audio/*': ['.mp3', '.wav', '.aac', '.flac', '.ogg'],
  'application/pdf': ['.pdf']
};

export default function App() {
  const [activeFile, setActiveFile] = useState<MediaFile | null>(null);
  const [status, setStatus] = useState<ConversionStatus>(ConversionStatus.IDLE);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
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
    
    // Prevent flickering: only disable dragging if we left the main container, not just entered a child element
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    
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

  // Logic Matrix: Define available outputs based on input type
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
      }, 2000); // 2 second simulation
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
      // 1. AI Handling
      if (option.type === 'ai-analysis') {
        setProgress(30); // Fake start
        let textResult = '';
        if (activeFile.type === MediaType.IMAGE) {
          textResult = await analyzeImage(activeFile.file);
        } else if (activeFile.type === MediaType.AUDIO) {
          textResult = await processAudio(activeFile.file);
        } else if (activeFile.type === MediaType.DOCUMENT) {
          textResult = await analyzeDocument(activeFile.file);
        } else {
          // Mock Video analysis
          await new Promise(r => setTimeout(r, 1500));
          textResult = "Video content analysis requires backend resources. (Demo Output: The video features a clear instructional walkthrough of software interface...)";
        }
        setProgress(100);
        const blob = new Blob([textResult], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        setResult({ url, filename: `analysis_${activeFile.file.name}.txt`, text: textResult });
      }
      // 2. Real Image Conversion
      else if (activeFile.type === MediaType.IMAGE && ['png', 'jpg', 'webp'].includes(option.value)) {
        // Real conversion for supported formats
        const mime = option.value === 'png' ? 'image/png' : option.value === 'webp' ? 'image/webp' : 'image/jpeg';
        const blob = await convertImage(activeFile.file, mime);
        
        setProgress(100);
        const url = URL.createObjectURL(blob);
        const nameParts = activeFile.file.name.split('.');
        const newName = `${nameParts.slice(0, -1).join('.')}.${option.extension}`;
        setResult({ url, filename: newName });
      }
      // 3. Simulated Conversion (Video/Audio/PDF backend required)
      else {
        await simulateProgress();
        // Return original file as a mock result
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

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* Sidebar - "Streamlit" Style */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col z-10 shadow-sm hidden md:flex">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 font-bold text-xl text-indigo-600">
             <RefreshCw className="w-6 h-6" />
             <span>UniConverter</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Universal Media Tool</p>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Settings</h3>
            <div className="space-y-3">
               <div className="flex items-center justify-between text-sm text-slate-600">
                 <span>Output Quality</span>
                 <span className="text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded">High</span>
               </div>
               <div className="flex items-center justify-between text-sm text-slate-600">
                 <span>AI Analysis</span>
                 <span className="text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded">Enabled</span>
               </div>
            </div>
          </div>

          <div>
             <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">About</h3>
             <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-600 space-y-2">
                <p><strong>Supported:</strong></p>
                <p>🎥 MP4, AVI, MOV, MKV</p>
                <p>🎵 MP3, WAV, AAC, FLAC</p>
                <p>🖼️ JPG, PNG, WEBP</p>
                <p>📄 PDF Documents</p>
             </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">Powered by Gemini & React</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative overflow-y-auto">
        <header className="bg-white px-8 py-5 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
           <div className="flex items-center gap-3">
             <div className="md:hidden">
                <RefreshCw className="w-6 h-6 text-indigo-600" />
             </div>
             <h1 className="text-xl font-semibold text-slate-800">Media Converter & Processor</h1>
           </div>
           <div className="flex items-center gap-2 text-sm text-slate-500">
             <span className="w-2 h-2 rounded-full bg-green-500"></span>
             <span className="hidden sm:inline">System Ready</span>
           </div>
        </header>

        {/* 
          Container for the main workspace. 
          When no file is selected, this container fills the screen to maximize drop area. 
        */}
        <div className="flex-1 p-4 md:p-8 w-full h-full flex flex-col">
          
          {/* Upload Section */}
          {!activeFile ? (
            <div className="flex-1 w-full h-full flex flex-col animate-in fade-in zoom-in duration-500">
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  flex-1 w-full flex flex-col items-center justify-center
                  border-3 border-dashed rounded-3xl p-6 md:p-16 text-center transition-all cursor-pointer group bg-white relative overflow-hidden
                  ${isDragging 
                    ? 'border-indigo-500 bg-indigo-50/50 scale-[1.005] shadow-2xl ring-4 ring-indigo-100' 
                    : 'border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/30 hover:shadow-xl'
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
                
                {/* Visuals */}
                <div className="relative z-10 flex flex-col items-center">
                    <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-8 transition-transform shadow-sm ${
                    isDragging ? 'bg-indigo-200 scale-110 rotate-3' : 'bg-indigo-100 group-hover:scale-110 group-hover:-rotate-3'
                    }`}>
                    <Upload className={`w-12 h-12 ${isDragging ? 'text-indigo-800' : 'text-indigo-600'}`} />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">
                    {isDragging ? 'Drop File Here' : 'Drag & Drop or Click'}
                    </h2>
                    <p className="text-slate-500 text-lg md:text-xl max-w-lg mx-auto">
                    Transform your media instantly. Support for high-quality Video, Audio, Images, and PDF.
                    </p>
                    
                    <div className="mt-12 flex flex-wrap justify-center gap-4 md:gap-8 text-sm md:text-base font-medium text-slate-400">
                        <span className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100"><FileVideo className="w-4 h-4 text-indigo-400" /> Video</span>
                        <span className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100"><FileAudio className="w-4 h-4 text-pink-400" /> Audio</span>
                        <span className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100"><FileImage className="w-4 h-4 text-blue-400" /> Image</span>
                        <span className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100"><FileText className="w-4 h-4 text-orange-400" /> PDF</span>
                    </div>
                </div>

                {/* Background Decoration */}
                {isDragging && (
                    <div className="absolute inset-0 bg-indigo-50/50 flex items-center justify-center pointer-events-none">
                        <div className="w-[120%] h-[120%] border-[20px] border-indigo-100 rounded-full animate-pulse opacity-20"></div>
                    </div>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto w-full space-y-6 animate-in slide-in-from-bottom-8 duration-500">
              
              {/* Active File Card */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-8 items-start">
                {/* Preview Thumbnail */}
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

                {/* File Info & Controls */}
                <div className="flex-1 w-full space-y-6">
                   <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 truncate max-w-md" title={activeFile.file.name}>{activeFile.file.name}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                           <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-medium uppercase">{activeFile.extension}</span>
                           <span>•</span>
                           <span>{formatFileSize(activeFile.file.size)}</span>
                        </div>
                      </div>
                      <button onClick={clearFile} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                   </div>

                   <hr className="border-slate-100" />

                   {/* Conversion Controls */}
                   <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Convert To</label>
                        <div className="relative">
                          <select 
                            value={selectedFormat}
                            onChange={(e) => setSelectedFormat(e.target.value)}
                            disabled={status === ConversionStatus.PROCESSING || status === ConversionStatus.SUCCESS}
                            className="w-full appearance-none p-4 pl-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none disabled:opacity-50 disabled:bg-slate-100 cursor-pointer"
                          >
                            <option value="">Select target format...</option>
                            {getOptions().map(opt => (
                              <option key={opt.value} value={opt.value}>
                                {opt.type === 'ai-analysis' ? '✨ ' : ''}{opt.label}
                              </option>
                            ))}
                          </select>
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                            {selectedFormat.includes('ai') ? <Wand2 className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {status === ConversionStatus.PROCESSING && (
                        <div className="space-y-2">
                           <div className="flex justify-between text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                             <span>Processing</span>
                             <span>{Math.round(progress)}%</span>
                           </div>
                           <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                                style={{ width: `${progress}%` }}
                              />
                           </div>
                        </div>
                      )}

                      {/* Main Action Button */}
                      {status !== ConversionStatus.SUCCESS && (
                        <button
                          onClick={handleProcess}
                          disabled={!selectedFormat || status === ConversionStatus.PROCESSING}
                          className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-md ${
                            !selectedFormat || status === ConversionStatus.PROCESSING
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200 hover:-translate-y-0.5'
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

              {/* Success Result */}
              {status === ConversionStatus.SUCCESS && result && (
                 <div className="bg-green-50 border border-green-200 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="w-6 h-6" />
                       </div>
                       <div>
                          <h3 className="text-lg font-bold text-green-900">Conversion Successful</h3>
                          <p className="text-green-700">{result.filename}</p>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                       <button onClick={clearFile} className="px-4 py-2 text-green-700 font-medium hover:bg-green-100 rounded-lg transition-colors">
                          Convert Another
                       </button>
                       <a 
                         href={result.url} 
                         download={result.filename}
                         className="flex-1 md:flex-none px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                       >
                         <Download className="w-5 h-5" />
                         Download Result
                       </a>
                    </div>

                    {/* AI Output Text */}
                    {result.text && (
                       <div className="w-full mt-2 bg-white p-4 rounded-xl border border-green-100 text-slate-600 text-sm leading-relaxed max-h-60 overflow-y-auto">
                          <strong className="block text-green-800 text-xs uppercase tracking-wider mb-2">Analysis Result</strong>
                          {result.text}
                       </div>
                    )}
                 </div>
              )}

              {/* Error Message */}
              {status === ConversionStatus.ERROR && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-3 text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

            </div>
          )}
        </div>
      </main>
    </div>
  );
}