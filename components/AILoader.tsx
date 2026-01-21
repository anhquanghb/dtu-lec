
import React from 'react';
import { Loader2, Sparkles, BrainCircuit } from 'lucide-react';

interface Props {
  isVisible: boolean;
  message?: string;
  subMessage?: string;
}

const AILoader: React.FC<Props> = ({ isVisible, message = 'AI Processing', subMessage = 'Analyzing data & generating content...' }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300">
      <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full border border-slate-100 relative overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
        <div className="absolute -left-10 -top-10 w-32 h-32 bg-indigo-100 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-purple-100 rounded-full blur-3xl opacity-50"></div>
        
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-75"></div>
          <div className="relative bg-white p-4 rounded-full shadow-lg border border-slate-100">
             <Loader2 size={40} className="text-indigo-600 animate-spin" />
             <Sparkles size={20} className="text-amber-400 absolute -top-1 -right-1 animate-bounce" />
          </div>
        </div>
        
        <div className="text-center space-y-2 z-10">
          <h3 className="text-xl font-bold text-slate-800 flex items-center justify-center gap-2">
            <BrainCircuit size={20} className="text-purple-500" />
            {message}
          </h3>
          <p className="text-xs text-slate-500 font-medium">{subMessage}</p>
        </div>

        {/* Processing Lines Animation */}
        <div className="w-full space-y-2">
           <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
             <div className="h-full bg-indigo-500 animate-[progress_1.5s_ease-in-out_infinite] w-2/3 rounded-full origin-left"></div>
           </div>
           <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
             <div className="h-full bg-purple-500 animate-[progress_1s_ease-in-out_infinite_0.2s] w-1/2 rounded-full origin-left"></div>
           </div>
           <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
             <div className="h-full bg-pink-500 animate-[progress_1.2s_ease-in-out_infinite_0.4s] w-3/4 rounded-full origin-left"></div>
           </div>
        </div>
      </div>
      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default AILoader;