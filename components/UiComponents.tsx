import React from 'react';
import { Upload } from 'lucide-react';

export const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-sm font-medium text-gray-400 mb-1.5">{children}</label>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`w-full bg-dark-900 border border-gray-700 text-white px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition disabled:opacity-50 ${props.className}`}
  />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <select
    {...props}
    className="w-full bg-dark-900 border border-gray-700 text-white px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition appearance-none"
  >
    {props.children}
  </select>
);

export const FileUploadZone: React.FC<{
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
}> = ({ label, file, onChange, accept = "image/*" }) => {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onChange(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="w-full">
      <Label>{label}</Label>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={`relative group border-2 border-dashed rounded-xl h-48 flex flex-col items-center justify-center text-center transition cursor-pointer overflow-hidden
          ${file ? 'border-brand-500 bg-brand-900/10' : 'border-gray-700 hover:border-brand-500/50 hover:bg-dark-800'}`}
      >
        <input
          type="file"
          accept={accept}
          className="absolute inset-0 opacity-0 cursor-pointer z-10"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) onChange(e.target.files[0]);
          }}
        />
        
        {file ? (
          <div className="relative w-full h-full flex items-center justify-center p-2">
            <img 
              src={URL.createObjectURL(file)} 
              alt="Preview" 
              className="max-h-full max-w-full object-contain rounded-md shadow-lg" 
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition backdrop-blur-sm">
              <span className="text-white font-medium bg-black/50 px-3 py-1 rounded-full">更换图片</span>
            </div>
            <div className="absolute bottom-2 right-2 bg-black/60 text-xs px-2 py-1 rounded text-white">
              {file.name}
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-3 group-hover:bg-brand-500/20 transition">
              <Upload className="text-gray-400 group-hover:text-brand-400 transition" size={24} />
            </div>
            <p className="text-sm font-medium text-gray-300">点击或拖拽上传</p>
            <p className="text-xs text-gray-500 mt-1">PNG, JPG (最大 10MB)</p>
          </div>
        )}
      </div>
      {file && (
        <button 
          onClick={() => onChange(null)}
          className="text-xs text-red-400 hover:text-red-300 mt-2 underline"
        >
          移除图片
        </button>
      )}
    </div>
  );
};