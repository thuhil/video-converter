import React, { useState, useRef, useCallback } from 'react';
import { 
  Upload, 
  FileVideo, 
  FileAudio, 
  FileImage, 
  Settings, 
  CheckCircle, 
  Loader2, 
  Download, 
  AlertCircle,
  Wand2,
  RefreshCw,
  X
} from 'lucide-react';
import { 
  MediaType, 
  ConversionStatus, 
  MediaFile, 
  ConversionOption,
  ProcessingResult
} from './types';
import { convertImage, convertImageToPDF } from './utils/mediaUtils';
import { analyzeImage, processAudio } from './services/geminiService';

// Constants
const ACCEPTED_TYPES = {
  'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
  'video/*': ['.mp4', '.webm', '.mov', '.avi'],
  'audio/*': ['.mp3', '.wav', '.ogg']
};

export default function App() {
  const [activeFile, setActiveFile] = useState<MediaFile | null>(null);
  const [status, setStatus] = useState<ConversionStatus>(ConversionStatus.IDLE);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine media type from file
  const getMediaType = (file: File): MediaType => {
    if (file.type.startsWith('image/')) return MediaType.IMAGE;
    if (file.type.startsWith('video/')) return MediaType.VIDEO;
    if (file.type.startsWith('audio/')) return MediaType.AUDIO;
    return MediaType.UNKNOWN;
  };

  // Handle File Upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const type = getMediaType(file);
      
      if (type === MediaType.UNKNOWN) {
        setErrorMsg("Unsupported file type.");
        return;
      }

      // Create object URL for preview
      const previewUrl = URL.createObjectURL(file);
      
      setActiveFile({
        file,
        previewUrl,
        type,
        id: Math.random().toString(36).substring(7)
      });
      setStatus(ConversionStatus.IDLE);
      setResult(null);
      setErrorMsg('');
      setSelectedFormat('');
    }
  };

  const clearFile = () => {
    if (activeFile) {
      URL.revokeObjectURL(activeFile.previewUrl);
    }
    setActiveFile(null);
    setStatus(ConversionStatus.IDLE);
    setResult(null);
    setSelectedFormat('');
  };

  // Available options based on file type
  const getOptions = (): ConversionOption[] => {
    if (!activeFile) return [];
    
    switch (activeFile.type) {
      case MediaType.IMAGE:
        return [
          { label: 'Convert to PNG', value: 'png', extension: 'png', type: 'conversion' },
          { label: 'Convert to JPG', value: 'jpg', extension: 'jpg', type: 'conversion' },
          { label: 'Convert to PDF', value: 'pdf', extension: 'pdf', type: 'conversion' },
          { label: 'AI: Analyze Content', value: 'ai_desc', extension: 'txt', type: 'ai-analysis' }
        ];
      case MediaType.VIDEO:
        return [
          // Client side video conversion is limited, so we simulate or offer AI
          { label: 'Convert to MP3 (Extract Audio)', value: 'mp3', extension: 'mp3', type: 'conversion' },
          { label: 'Convert to GIF (Preview)', value: 'gif', extension: 'gif', type: 'conversion' },
          { label: 'AI: Summarize Content', value: 'ai_sum', extension: 'txt', type: 'ai-analysis' }
        ];
      case MediaType.AUDIO:
        return [
          { label: 'Convert to MP3', value: 'mp3', extension: 'mp3', type: 'conversion' },
          { label: 'AI: Transcribe', value: 'ai_transcribe', extension: 'txt', type: 'ai-analysis' }
        ];
      default:
        return [];
    }
  };

  // Main Processing Logic
  const handleProcess = async () => {
    if (!activeFile || !selectedFormat) return;

    setStatus(ConversionStatus.PROCESSING);
    setErrorMsg('');
    setResult(null);

    const option = getOptions().find(o => o.value === selectedFormat);
    if (!option) return;

    try {
      // 1. AI Analysis Handling
      if (option.type === 'ai-analysis') {
        let textResult = '';
        if (activeFile.type === MediaType.IMAGE) {
          textResult = await analyzeImage(activeFile.file);
        } else if (activeFile.type === MediaType.AUDIO) {
          textResult = await processAudio(activeFile.file);
        } else {
          // Mock for Video
          await new Promise(r => setTimeout(r, 2000));
          textResult = "Video analysis requires backend processing. (Demo: Video contains a meeting scene with 3 participants.)";
        }
        
        const blob = new Blob([textResult], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        setResult({ url, filename: `analysis_${activeFile.file.name}.txt`, text: textResult });
      } 
      // 2. Image Conversion (Real)
      else if (activeFile.type === MediaType.IMAGE) {
        let blob: Blob;
        if (selectedFormat === 'pdf') {
          blob = await convertImageToPDF(activeFile.file);
        } else {
          const mime = selectedFormat === 'png' ? 'image/png' : 'image/jpeg';
          blob = await convertImage(activeFile.file, mime);
        }
        const url = URL.createObjectURL(blob);
        const nameParts = activeFile.file.name.split('.');
        const newName = `${nameParts.slice(0, -1).join('.')}.${option.extension}`;
        setResult({ url, filename: newName });
      }
      // 3. Audio/Video Conversion (Simulation/Stub due to browser limits without WASM)
      else {
        // In a real production app, we would use FFmpeg.wasm here.
        // For this demo, we simulate the time it takes.
        await new Promise(r => setTimeout(r, 2500));
        
        // Return original file as a mock "result" to demonstrate flow, 
        // or a dummy blob for the sake of the UX.
        // Warning user about client-side limits.
        if (activeFile.type === MediaType.VIDEO && selectedFormat === 'gif') {
           // We can't easily do Video->GIF without a heavy library (gif.js/ffmpeg.wasm)
           throw new Error("Browser-based video encoding is currently limited in this demo environment. Please try Image conversion or AI Analysis features.");
        }
        
        // Mock success for UI demonstration
        const url = URL.createObjectURL(activeFile.file); 
        setResult({ 
          url, 
          filename: `converted_${activeFile.file.name.split('.')[0]}.${option.extension}`,
          text: "Note: Real-time video/audio encoding requires WASM/Server backend. This is a UI demonstration for these formats."
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
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800">
        <div className="p-6">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-indigo-500" />
            MediaStudio
          </h1>
          <p className="text-xs text-slate-500 mt-2">Universal Converter & AI</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg text-white">
            <Settings className="w-5 h-5" />
            <span className="text-sm font-medium">Converter</span>
          </div>
          {/* Static nav items for look */}
          <div className="flex items-center gap-3 p-3 hover:bg-slate-800/30 rounded-lg cursor-not-allowed opacity-50">
            <span className="w-5 h-5 flex items-center justify-center border border-slate-600 rounded text-xs">H</span>
            <span className="text-sm font-medium">History</span>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800">
           <div className="text-xs text-slate-500 mb-2">Powered By</div>
           <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <span className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">Gemini 2.5 AI</span>
           </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 flex flex-col items-center">
        
        <div className="w-full max-w-3xl space-y-8">
          
          {/* Header */}
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-slate-900">Universal Media Converter</h2>
            <p className="text-slate-600">Convert Images, Video, and Audio locally, or analyze them with AI.</p>
          </div>

          {/* Upload Area or Active File View */}
          {!activeFile ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:border-indigo-500 hover:bg-slate-50 transition-all cursor-pointer group"
            >
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                onChange={handleFileSelect}
                accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,.avi,.mp3,.wav"
              />
              <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Click to upload or drag and drop</h3>
              <p className="text-slate-500 mt-1">Video, Audio, or Images supported</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {/* File Preview Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                    {activeFile.type === MediaType.VIDEO && <FileVideo className="w-6 h-6" />}
                    {activeFile.type === MediaType.AUDIO && <FileAudio className="w-6 h-6" />}
                    {activeFile.type === MediaType.IMAGE && <FileImage className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 truncate max-w-md">{activeFile.file.name}</h3>
                    <p className="text-sm text-slate-500 uppercase">{activeFile.file.type.split('/')[1]} • {(activeFile.file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button 
                  onClick={clearFile}
                  className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left: Preview */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Preview</h4>
                    <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center relative">
                      {activeFile.type === MediaType.IMAGE && (
                        <img src={activeFile.previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                      )}
                      {activeFile.type === MediaType.VIDEO && (
                        <video src={activeFile.previewUrl} controls className="max-h-full max-w-full" />
                      )}
                      {activeFile.type === MediaType.AUDIO && (
                        <div className="text-white flex flex-col items-center">
                           <FileAudio className="w-16 h-16 mb-2 opacity-50" />
                           <audio src={activeFile.previewUrl} controls className="mt-4" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Controls */}
                  <div className="flex flex-col justify-center space-y-6">
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Desired Action</label>
                        <select 
                          value={selectedFormat}
                          onChange={(e) => setSelectedFormat(e.target.value)}
                          className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        >
                          <option value="">Select an option...</option>
                          {getOptions().map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.type === 'ai-analysis' ? '✨ ' : ''}{opt.label}
                            </option>
                          ))}
                        </select>
                     </div>

                     {/* Action Button */}
                     <button
                        onClick={handleProcess}
                        disabled={!selectedFormat || status === ConversionStatus.PROCESSING}
                        className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-lg transition-all ${
                          !selectedFormat || status === ConversionStatus.PROCESSING
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                        }`}
                     >
                        {status === ConversionStatus.PROCESSING ? (
                          <>
                            <Loader2 className="w-6 h-6 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            {selectedFormat.includes('ai') ? <Wand2 className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
                            {selectedFormat.includes('ai') ? 'Analyze with AI' : 'Convert Now'}
                          </>
                        )}
                     </button>
                     
                     {/* Error Message */}
                     {status === ConversionStatus.ERROR && (
                       <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3 text-sm">
                         <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                         <span>{errorMsg}</span>
                       </div>
                     )}

                  </div>
                </div>

                {/* Success Result Area */}
                {status === ConversionStatus.SUCCESS && result && (
                  <div className="mt-8 p-6 bg-green-50 border border-green-100 rounded-xl animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                          <CheckCircle className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-green-900">Processing Complete!</h4>
                          <p className="text-green-700 text-sm">{result.filename}</p>
                        </div>
                      </div>
                      <a 
                        href={result.url} 
                        download={result.filename}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                    </div>
                    
                    {/* Display AI Text Result if available */}
                    {result.text && (
                      <div className="bg-white p-4 rounded-lg border border-green-100 text-slate-700 text-sm whitespace-pre-wrap max-h-60 overflow-y-auto shadow-sm">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Output Content</div>
                        {result.text}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="text-center text-xs text-slate-400">
             Privacy Note: Image conversion happens locally in your browser. AI analysis sends data to Gemini API securely.
          </div>

        </div>
      </main>
    </div>
  );
}
