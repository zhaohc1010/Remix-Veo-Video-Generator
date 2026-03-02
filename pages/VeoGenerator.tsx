import React, { useState, useEffect, useRef } from 'react';
import { Settings, Play, Terminal, Loader2, Video, ImageIcon, AlertCircle, Download, History, Trash2, Clock, CheckCircle2, XCircle, Key, ExternalLink, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { generateVideo } from '../services/apiService';
import { GenerationConfig, LogEntry, GenerationStatus, HistoryItem } from '../types';
import { Input, Label, Select, FileUploadZone } from '../components/UiComponents';

const MODEL_OPTIONS = [
  "veo_3_1-fast-4K",
  "veo_3_1-components-4K",
  "veo_3_1-4K",
  "veo_3_1-fast-components-4K",
  "veo_3_1",
  "veo_3_1-fast",
  "veo_3_1-components"
];

const VeoGenerator: React.FC = () => {
  // Config State
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('user_api_key') || "";
  });
  
  const [model, setModel] = useState(MODEL_OPTIONS[0]);
  const [prompt, setPrompt] = useState("生成视频"); 
  const [seconds, setSeconds] = useState("8");
  const [size, setSize] = useState("16x9");
  const [watermark, setWatermark] = useState("false");
  const [startImage, setStartImage] = useState<File | null>(null);
  const [endImage, setEndImage] = useState<File | null>(null);
  
  // Advanced Config
  const [endFrameParamName] = useState("input_reference");

  // App State
  // Note: We removed 'status' and 'elapsedTime' to support concurrent tasks. 
  // Status is now tracked per-item in 'history'.
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // History State
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('veo_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Background polling for tasks that were processing when the user left the page
  useEffect(() => {
    if (!apiKey) return;
    
    const processingTasks = history.filter(item => item.status === GenerationStatus.PROCESSING);
    
    processingTasks.forEach(task => {
      const logPrefix = `[Task-${task.id.slice(-4)}]`;
      
      addLog({ timestamp: new Date().toLocaleTimeString(), message: `${logPrefix} Resuming background polling...`, type: 'info' });
      
      import('../services/apiService').then(({ pollTaskStatus }) => {
        pollTaskStatus(task.id, apiKey, (log) => {
          addLog({ ...log, message: `${logPrefix} ${log.message}` });
        }).then(responseData => {
          let videoUrl: string | undefined = undefined;
          
          if (responseData.output?.video_url) videoUrl = responseData.output.video_url;
          else if (responseData.video_url) videoUrl = responseData.video_url;
          else if (responseData.url) videoUrl = responseData.url;
          else if (typeof responseData.data === 'string' && responseData.data.startsWith('http')) {
            videoUrl = responseData.data;
          }

          if (videoUrl) {
             updateHistoryItem(task.id, { status: GenerationStatus.COMPLETED, videoUrl });
          } else {
             updateHistoryItem(task.id, { status: GenerationStatus.COMPLETED, error: "No direct video URL found" });
          }
        }).catch(error => {
          let errorMsg = "Unknown Error";
          if (error instanceof Error) errorMsg = error.message;
          else if (typeof error === 'string') errorMsg = error;
          
          updateHistoryItem(task.id, { status: GenerationStatus.FAILED, error: errorMsg });
        });
      });
    });
  }, []); // Run once on mount

  useEffect(() => {
    localStorage.setItem('veo_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('user_api_key', apiKey);
  }, [apiKey]);

  const addLog = (entry: LogEntry) => {
    setLogs(prev => [...prev, entry]);
  };

  // Helper to update a specific history item
  const updateHistoryItem = (id: string, updates: Partial<HistoryItem>) => {
    setHistory(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  // The actual async task runner
  const runGenerationTask = async (taskId: string, config: GenerationConfig) => {
    const logPrefix = `[Task-${taskId.slice(-4)}]`;

    try {
      const responseData = await generateVideo(config, (log) => {
        // Wrap the log with the task ID so user knows which task is logging
        addLog({ ...log, message: `${logPrefix} ${log.message}` });
      });
      
      addLog({ timestamp: new Date().toLocaleTimeString(), message: `${logPrefix} Request completed.`, type: 'success' });
      
      // Extract Video URL logic
      let videoUrl: string | undefined = undefined;
      
      // Try various common paths
      if (responseData.output?.video_url) videoUrl = responseData.output.video_url;
      else if (responseData.video_url) videoUrl = responseData.video_url;
      else if (responseData.url) videoUrl = responseData.url;
      else if (typeof responseData.data === 'string' && responseData.data.startsWith('http')) {
        videoUrl = responseData.data;
      }

      if (videoUrl) {
         updateHistoryItem(taskId, { status: GenerationStatus.COMPLETED, videoUrl });
         // Automatically play the most recently finished video
         setCurrentVideoUrl(videoUrl);
      } else {
         addLog({ timestamp: new Date().toLocaleTimeString(), message: `${logPrefix} Warning: Video URL not found in response.`, type: 'warning' });
         updateHistoryItem(taskId, { status: GenerationStatus.COMPLETED, error: "No direct video URL found" });
      }

    } catch (error: any) {
      // Safely extract error message even if error is not an Error object
      let errorMsg = "Unknown Error";
      if (error instanceof Error) errorMsg = error.message;
      else if (typeof error === 'string') errorMsg = error;
      else if (error && typeof error === 'object') errorMsg = JSON.stringify(error);

      addLog({ timestamp: new Date().toLocaleTimeString(), message: `${logPrefix} Failed: ${errorMsg}`, type: 'error' });
      updateHistoryItem(taskId, { status: GenerationStatus.FAILED, error: errorMsg });
    }
  };

  const handleGenerate = () => {
    if (!apiKey) {
      addLog({ timestamp: new Date().toLocaleTimeString(), message: "Error: Please enter your API Key in Settings.", type: 'error' });
      setShowSettings(true); 
      alert("Please enter your API Key first.");
      return;
    }

    if (!startImage) {
      addLog({ timestamp: new Date().toLocaleTimeString(), message: "Error: Start image is required.", type: 'error' });
      return;
    }

    // 1. Setup UI for new task
    const newHistoryId = Date.now().toString();
    const newHistoryItem: HistoryItem = {
      id: newHistoryId,
      timestamp: Date.now(),
      prompt,
      model,
      status: GenerationStatus.PROCESSING,
    };
    
    // 2. Add to history immediately (Optimistic UI)
    setHistory(prev => [newHistoryItem, ...prev]);
    
    // 3. Prepare Config
    const config: GenerationConfig = {
      apiKey,
      prompt,
      model,
      seconds,
      size,
      watermark,
      startImage,
      endImage,
      endFrameParamName
    };

    addLog({ timestamp: new Date().toLocaleTimeString(), message: `[Task-${newHistoryId.slice(-4)}] Queued generation task.`, type: 'info' });

    // 4. Start the task WITHOUT awaiting it (Fire and Forget)
    // This allows the UI to remain responsive and the user to start another task.
    runGenerationTask(newHistoryId, config);
  };

  const handleDeleteHistory = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleClearHistory = () => {
    if(confirm("Are you sure you want to clear all history?")) {
      setHistory([]);
    }
  };

  const downloadVideo = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const logsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Only scroll if there are new logs added, don't scroll on initial mount
    if (logs.length > 0) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  return (
    <div className="min-h-screen bg-dark-900 text-white font-sans selection:bg-brand-500/30">

      {/* Header */}
      <header className="bg-dark-800 border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-brand-600 to-cyan-400 rounded-lg flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Video className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Veo 视频生成</h1>
              <p className="text-xs text-gray-500">ApiZoo 客户端</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-700 bg-dark-900 transition hover:bg-dark-800 ${!apiKey ? 'ring-2 ring-red-500/50 animate-pulse' : ''}`}
            >
              <Settings size={16} className={!apiKey ? 'text-red-400' : 'text-gray-400'} />
              <span className="text-sm font-medium text-gray-300">设置</span>
            </button>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-dark-800 border-b border-gray-700 p-6 animate-in slide-in-from-top-2 shadow-2xl relative z-30">
          <div className="max-w-4xl mx-auto">
             <div className="flex flex-col md:flex-row gap-6 items-start">
               <div className="flex-1 w-full">
                  <div className="flex items-center justify-between mb-2">
                    <Label>API Key (Required)</Label>
                    <a 
                      href="https://api.apizoo.top/console/token" 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-xs flex items-center gap-1 text-brand-400 hover:text-brand-300 transition hover:underline"
                    >
                      <Key size={12} />
                      获取 API Key (Get Token) <ExternalLink size={10} />
                    </a>
                  </div>
                  <div className="relative">
                    <Input 
                        type={showApiKey ? "text" : "password"} 
                        value={apiKey} 
                        onChange={(e) => setApiKey(e.target.value)} 
                        placeholder="sk-..."
                        className={`font-mono text-sm pr-10 ${!apiKey ? 'border-red-500/50 focus:ring-red-500' : ''}`}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition"
                    >
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    您的 API Key 仅保存在本地浏览器中，不会发送到我们的服务器，仅用于请求 ApiZoo API。
                  </p>
               </div>
             </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Controls */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-dark-800 border border-gray-700 rounded-xl p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Settings className="text-brand-500" size={20} /> 配置
            </h2>

            <div className="space-y-5">
              <div>
                <Label>模型</Label>
                <Select value={model} onChange={(e) => setModel(e.target.value)}>
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label>Prompt (提示词)</Label>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full bg-dark-900 border border-gray-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none h-28 resize-none text-sm leading-relaxed"
                  placeholder="描述您想要生成的视频..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <Label>时长 (秒)</Label>
                   <Select value={seconds} onChange={(e) => setSeconds(e.target.value)}>
                     <option value="5">5 秒</option>
                     <option value="8">8 秒</option>
                     <option value="10">10 秒</option>
                   </Select>
                </div>
                <div>
                   <Label>画面比例</Label>
                   <Select value={size} onChange={(e) => setSize(e.target.value)}>
                     <option value="16x9">16:9 (横屏)</option>
                     <option value="9x16">9:16 (竖屏)</option>
                     <option value="1x1">1:1 (方形)</option>
                   </Select>
                </div>
              </div>

              {/* Start Image */}
              <FileUploadZone 
                label="首帧图片 (必须)" 
                file={startImage} 
                onChange={setStartImage} 
              />

              {/* End Image */}
              <div className="pt-2 border-t border-gray-700/50">
                 <div className="flex items-center justify-between mb-2">
                    <Label>尾帧图片 (可选)</Label>
                    <span className="text-xs text-brand-400 bg-brand-900/30 px-2 py-0.5 rounded border border-brand-500/20">高级</span>
                 </div>
                 <p className="text-xs text-gray-500 mb-3">
                   允许创建从首帧到尾帧的过渡 (图生视频)。
                 </p>
                 <FileUploadZone 
                    label="尾帧图片" 
                    file={endImage} 
                    onChange={setEndImage} 
                 />
              </div>

              <button
                onClick={handleGenerate}
                disabled={!startImage}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition transform active:scale-[0.98]
                  ${!startImage 
                    ? 'bg-gray-700 cursor-not-allowed text-gray-400' 
                    : 'bg-gradient-to-r from-brand-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 text-white shadow-brand-500/25'
                  }`}
              >
                 <Play fill="currentColor" /> 生成视频
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Output & Logs */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Output Display */}
          <div className="bg-dark-800 border border-gray-700 rounded-xl p-6 min-h-[300px] flex flex-col shadow-xl">
             <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <ImageIcon className="text-brand-500" size={20} /> 预览输出
             </h2>

             <div className="flex-1 bg-dark-900/50 rounded-xl border border-dashed border-gray-700 flex items-center justify-center relative overflow-hidden min-h-[400px]">
                
                {/* Idle State / Placeholder */}
                {!currentVideoUrl && (
                  <div className="text-center text-gray-500">
                    <Video size={48} className="mx-auto mb-2 opacity-20" />
                    <p>从历史记录中选择视频播放</p>
                    <p className="text-xs mt-2 opacity-50">或生成一个新视频</p>
                  </div>
                )}

                {/* Video Player */}
                {currentVideoUrl && (
                    <div className="w-full h-full flex flex-col items-center">
                        <video 
                          controls 
                          className="w-full h-auto max-h-[500px] rounded shadow-lg bg-black" 
                          src={currentVideoUrl} 
                          loop 
                          autoPlay 
                          muted 
                        />
                        <div className="mt-4 flex gap-3">
                          <button 
                            onClick={() => downloadVideo(currentVideoUrl!, `veo-video-${Date.now()}.mp4`)}
                            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition shadow-lg"
                          >
                            <Download size={18} /> 下载视频
                          </button>
                        </div>
                    </div>
                )}
             </div>
          </div>

          {/* History Section */}
          <div className="bg-dark-800 border border-gray-700 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
               <h2 className="text-xl font-semibold flex items-center gap-2">
                  <History className="text-brand-500" size={20} /> 历史记录
               </h2>
               {history.length > 0 && (
                 <button 
                   onClick={handleClearHistory}
                   className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                 >
                   <Trash2 size={12} /> 清除全部
                 </button>
               )}
            </div>
            
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-800">
               {history.length === 0 && (
                 <div className="text-center py-8 text-gray-500 text-sm italic">
                   暂无生成记录
                 </div>
               )}
               {history.map((item) => (
                 <div key={item.id} className="bg-dark-900 border border-gray-800 rounded-lg p-3 flex gap-4 hover:border-brand-500/30 transition group">
                    {/* Status Icon / Thumbnail Placeholder */}
                    <div className="w-24 h-16 shrink-0 bg-black rounded flex items-center justify-center border border-gray-800 overflow-hidden relative">
                       {item.status === GenerationStatus.PROCESSING && (
                         <div className="flex flex-col items-center justify-center gap-1">
                             <Loader2 className="animate-spin text-brand-500" size={20} />
                             <span className="text-[10px] text-gray-400">处理中</span>
                         </div>
                       )}
                       {item.status === GenerationStatus.FAILED && (
                         <XCircle className="text-red-500" size={20} />
                       )}
                       {item.status === GenerationStatus.COMPLETED && (
                          item.videoUrl ? (
                             <video src={item.videoUrl} className="w-full h-full object-cover opacity-80" />
                          ) : (
                             <AlertTriangle className="text-yellow-500" size={20} />
                          )
                       )}
                       {/* Overlay Play Icon - Only if video exists */}
                       {item.videoUrl && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                               onClick={() => setCurrentVideoUrl(item.videoUrl!)}
                          >
                             <Play size={16} fill="white" className="text-white" />
                          </div>
                       )}
                    </div>

                    <div className="flex-1 min-w-0">
                       <div className="flex justify-between items-start">
                          <p className="text-sm font-medium text-gray-200 truncate">{item.prompt}</p>
                          <button 
                             onClick={() => handleDeleteHistory(item.id)}
                             className="text-gray-600 hover:text-red-400 transition"
                          >
                             <Trash2 size={14} />
                          </button>
                       </div>
                       <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Clock size={10} /> {new Date(item.timestamp).toLocaleTimeString()}</span>
                          <span className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">{item.model}</span>
                          <span className={`${
                             item.status === GenerationStatus.COMPLETED ? 'text-green-400' :
                             item.status === GenerationStatus.FAILED ? 'text-red-400' : 
                             'text-brand-400 font-bold animate-pulse'
                          }`}>
                            {item.status}
                          </span>
                       </div>
                       {item.error && <p className="text-xs text-red-400 mt-1 truncate" title={item.error}>{item.error}</p>}
                    </div>

                    {item.videoUrl && (
                       <div className="flex flex-col justify-center gap-2">
                          <button 
                             onClick={() => setCurrentVideoUrl(item.videoUrl!)}
                             className="p-1.5 bg-brand-900/30 text-brand-400 hover:bg-brand-900/50 rounded transition"
                             title="Play in Main View"
                          >
                             <Play size={14} />
                          </button>
                          <button 
                             onClick={() => downloadVideo(item.videoUrl!, `veo-${item.id}.mp4`)}
                             className="p-1.5 bg-gray-800 text-gray-400 hover:text-white rounded transition"
                             title="Download"
                          >
                             <Download size={14} />
                          </button>
                       </div>
                    )}
                 </div>
               ))}
            </div>
          </div>

          {/* Terminal / Logs */}
          <div className="bg-black border border-gray-800 rounded-xl p-4 shadow-inner font-mono text-xs h-48 flex flex-col">
             <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-2">
               <div className="flex items-center gap-2 text-gray-400">
                  <Terminal size={14} />
                  <span>控制台日志</span>
               </div>
               <button onClick={() => setLogs([])} className="text-gray-600 hover:text-gray-300">清空</button>
             </div>
             <div className="flex-1 overflow-y-auto space-y-1 pr-2 scrollbar-thin scrollbar-thumb-gray-800">
                {logs.length === 0 && <span className="text-gray-700 italic">等待输入...</span>}
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-gray-600 shrink-0">[{log.timestamp}]</span>
                    <span className={`${
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'success' ? 'text-green-400' :
                      log.type === 'warning' ? 'text-yellow-400' :
                      'text-blue-300'
                    }`}>
                      {log.type === 'info' && 'ℹ '}
                      {log.type === 'success' && '✔ '}
                      {log.type === 'error' && '✖ '}
                      {log.type === 'warning' && '⚠ '}
                      {log.message}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
             </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default VeoGenerator;
