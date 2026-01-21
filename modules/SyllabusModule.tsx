import React, { useState, useMemo } from 'react';
import { AppState } from '../types';
import { TRANSLATIONS } from '../constants';
import { Search, BookOpen } from 'lucide-react';
import SyllabusEditorModule from './SyllabusEditorModule';

interface Props {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
  selectedCourseId: string | null;
  setSelectedCourseId: (id: string | null) => void;
}

const SyllabusModule: React.FC<Props> = ({ state, updateState, selectedCourseId, setSelectedCourseId }) => {
  const { courses, language } = state;
  const t = TRANSLATIONS[language];
  const [courseSearch, setCourseSearch] = useState('');

  // --- Filtering Logic ---
  const filteredCourses = useMemo(() => {
    let result = courses;
    if (courseSearch) {
      const lower = courseSearch.toLowerCase().trim();
      result = result.filter(c => 
        (c.code || '').toLowerCase().includes(lower) || 
        (c.name?.vi || '').toLowerCase().includes(lower) ||
        (c.name?.en || '').toLowerCase().includes(lower)
      );
    }
    return result.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }, [courses, courseSearch]);

  const selectedCourse = useMemo(() => courses.find(c => c.id === selectedCourseId), [courses, selectedCourseId]);

  return (
    <div className="flex h-full gap-6 overflow-hidden animate-in fade-in duration-500">
      
      {/* Sidebar: Course List */}
      <aside className="w-80 shrink-0 bg-white border border-slate-200 rounded-xl flex flex-col shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder={language === 'vi' ? "Tìm môn học..." : "Search courses..."} value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)} />
            </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredCourses.map(c => (
                <button key={c.id} onClick={() => setSelectedCourseId(c.id)} className={`w-full p-4 text-left transition-all hover:bg-slate-50 flex items-center gap-3 border-l-4 ${selectedCourseId === c.id ? 'bg-indigo-50 border-indigo-600' : 'border-transparent'}`}>
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-black text-slate-500 text-xs shrink-0">{c.code.split(' ')[0]}</div>
                    <div className="min-w-0">
                        <div className="text-xs font-black text-slate-800 truncate">{c.code}</div>
                        <div className="text-[10px] text-slate-500 font-bold truncate uppercase">{c.name[language]}</div>
                    </div>
                </button>
            ))}
            {filteredCourses.length === 0 && <div className="p-8 text-center text-slate-300 text-xs italic">{language === 'vi' ? 'Không tìm thấy môn học' : 'No courses found'}</div>}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white border border-slate-200 rounded-xl shadow-sm relative">
         {selectedCourse ? (
           <SyllabusEditorModule 
              course={selectedCourse} 
              state={state} 
              updateState={updateState} 
           />
         ) : (
           <div className="h-full flex flex-col items-center justify-center text-slate-300"><BookOpen size={64} className="mb-4 opacity-20" /><p className="font-bold">Select a course to view syllabus</p></div>
         )}
      </main>
    </div>
  );
};

export default SyllabusModule;