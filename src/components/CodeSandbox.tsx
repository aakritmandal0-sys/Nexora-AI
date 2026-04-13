import React, { useState } from 'react';
import { Play, X, RotateCcw } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface CodeSandboxProps {
  code: string;
  language: string;
  isDarkMode: boolean;
}

export const CodeSandbox: React.FC<CodeSandboxProps> = ({ code, language, isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [key, setKey] = useState(0);

  const isWebCode = language === 'html' || language === 'javascript' || language === 'css' || language === 'jsx' || language === 'tsx';

  if (!isWebCode) return null;

  const srcDoc = `
    <html>
      <head>
        <style>
          body { font-family: sans-serif; color: ${isDarkMode ? '#e5e7eb' : '#0f172a'}; background: ${isDarkMode ? '#0f172a' : '#ffffff'}; padding: 20px; }
        </style>
      </head>
      <body>
        ${language === 'html' ? code : `<div id="root"></div>`}
        ${language === 'javascript' || language === 'jsx' || language === 'tsx' ? `<script>${code}</script>` : ''}
        ${language === 'css' ? `<style>${code}</style>` : ''}
      </body>
    </html>
  `;

  return (
    <div className="mt-4">
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
      >
        <Play size={14} />
        Run Code
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={cn(
            "w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border",
            isDarkMode ? "bg-[#0b1220] border-white/10" : "bg-white border-slate-200"
          )}>
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-2">
                <Play size={18} className="text-indigo-400" />
                <h3 className="font-bold">Code Preview</h3>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setKey(prev => prev + 1)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Reload"
                >
                  <RotateCcw size={18} />
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-white">
              <iframe
                key={key}
                srcDoc={srcDoc}
                title="Code Sandbox"
                className="w-full h-full border-none"
                sandbox="allow-scripts"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
