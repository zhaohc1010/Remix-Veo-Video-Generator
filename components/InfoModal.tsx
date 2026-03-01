import React from 'react';
import { X, UploadCloud, FileInput } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-dark-800 border border-gray-700 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-700 bg-dark-900/50">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <UploadCloud className="text-brand-500" />
            关于“图床” (Image Hosting)
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-4 text-gray-300">
          <p className="font-medium text-white">
            你不需要任何图床 (You do not need an image host).
          </p>
          
          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 space-y-2">
            <h4 className="text-sm font-bold text-brand-400 uppercase tracking-wider">原理说明</h4>
            <p className="text-sm leading-relaxed">
              在提供的代码示例中，使用了 <code className="bg-black/30 px-1 rounded text-orange-400">FormData</code> 对象。
            </p>
            <p className="text-sm leading-relaxed">
              这意味着图片文件是通过二进制流 (Binary Stream) 直接从你的浏览器发送到 API 服务器的。
            </p>
          </div>

          <div className="flex items-start gap-3 mt-4">
            <FileInput className="text-green-500 mt-1 shrink-0" />
            <div>
              <p className="text-sm">
                <strong>图床是干嘛的？</strong><br/>
                图床通常用于将图片转换为一个公开的 URL 链接 (例如: <code>https://img.com/pic.jpg</code>)。
                有些 API 要求你传入图片的 URL 链接，那种情况下才需要图床。
              </p>
              <p className="text-sm mt-2 text-green-400">
                但对于这个工具，你只需要上传本地文件即可。
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition"
          >
            明白了 (Got it)
          </button>
        </div>
      </div>
    </div>
  );
};