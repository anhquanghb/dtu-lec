import React, { useState, useMemo } from 'react';
import { AppState, Faculty, Course, LibraryResource } from '../types';
import { FileJson, Upload, X, AlertTriangle, Check, Copy, Plus, BookOpen, Merge, RefreshCw, Trash2, ArrowRight, Search, Info, ExternalLink, Sparkles } from 'lucide-react';

interface Props {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

// --- Similarity Logic ---
const normalizeStr = (str: string) => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
};

const getLevenshteinDistance = (a: string, b: string) => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

const calculateSimilarity = (s1: string, s2: string) => {
  const n1 = normalizeStr(s1);
  const n2 = normalizeStr(s2);
  if (!n1 && !n2) return 1;
  if (!n1 || !n2) return 0;
  if (n1 === n2) return 1;
  
  const longer = n1.length > n2.length ? n1 : n2;
  const dist = getLevenshteinDistance(n1, n2);
  return (longer.length - dist) / longer.length;
};

const JSONInputModule: React.FC<Props> = ({ state, updateState }) => {
  const { language, library, courses } = state;
  
  // Modal State
  const [activeModal, setActiveModal] = useState<'cv' | 'syllabus' | 'library_dedupe' | null>(null);
  
  // Import State
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [conflictData, setConflictData] = useState<{ item: Faculty | Course, existingItem: Faculty | Course, type: 'cv' | 'syllabus', matchReason: 'id' | 'name' } | null>(null);

  // Library Dedupe State
  const [duplicateGroups, setDuplicateGroups] = useState<LibraryResource[][]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number | null>(null);
  const [targetResourceId, setTargetResourceId] = useState<string | null>(null);

  const handleOpenModal = (type: 'cv' | 'syllabus' | 'library_dedupe') => {
    setActiveModal(type);
    setJsonInput('');
    setError(null);
    setConflictData(null);
    setDuplicateGroups([]);
    setSelectedGroupIndex(null);
    setTargetResourceId(null);
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setConflictData(null);
  };

  // --- Logic: Import CV/Syllabus (Existing) ---
  const processImport = () => {
    setError(null);
    try {
      const data = JSON.parse(jsonInput);
      const items = Array.isArray(data) ? data : [data];
      
      if (items.length === 0) {
        setError("Empty data.");
        return;
      }

      if (activeModal === 'cv') {
        const item = items[0] as Faculty;
        if (!item.name || !item.email) throw new Error("Invalid Faculty JSON format (Missing name or email)");
        
        // 1. Check ID Match
        let existing = state.faculties.find(f => f.id === item.id);
        let matchReason: 'id' | 'name' = 'id';

        // 2. If no ID match, Check Name Match (Fuzzy-ish exact match on normalized string)
        if (!existing) {
            const cleanInputVi = normalizeStr(item.name.vi || '');
            const cleanInputEn = normalizeStr(item.name.en || '');
            
            existing = state.faculties.find(f => {
                const fVi = normalizeStr(f.name.vi || '');
                const fEn = normalizeStr(f.name.en || '');
                return (cleanInputVi && fVi === cleanInputVi) || (cleanInputEn && fEn === cleanInputEn);
            });
            if (existing) matchReason = 'name';
        }

        if (existing) {
          setConflictData({ item, existingItem: existing, type: 'cv', matchReason });
          return;
        }
        
        updateState(prev => ({ ...prev, faculties: [...prev.faculties, ...items] }));

      } else if (activeModal === 'syllabus') {
        const item = items[0] as Course;
        if (!item.code || !item.name) throw new Error("Invalid Course JSON format (Missing code or name)");
        const existing = state.courses.find(c => c.id === item.id);
        if (existing) {
          setConflictData({ item, existingItem: existing, type: 'syllabus', matchReason: 'id' });
          return;
        }
        updateState(prev => ({ ...prev, courses: [...prev.courses, ...items] }));
      }

      alert(language === 'vi' ? "Nhập dữ liệu thành công!" : "Data imported successfully!");
      handleCloseModal();

    } catch (err) {
      setError(language === 'vi' ? "Lỗi JSON: " + (err as Error).message : "JSON Error: " + (err as Error).message);
    }
  };

  const handleOverwrite = () => {
    if (!conflictData) return;
    const { item, existingItem, type } = conflictData;

    if (type === 'cv') {
        // IMPORTANT: When overwriting, we MUST preserve the EXISTING ID to maintain relationships (courses, etc.)
        // We take the new data (item) but force the id to be existingItem.id
        const mergedItem = { ...item, id: existingItem.id };

        updateState(prev => ({
            ...prev,
            faculties: prev.faculties.map(f => f.id === existingItem.id ? (mergedItem as Faculty) : f)
        }));
    } else {
        // For courses: Preserve Catalog/Administrative Metadata, only overwrite Syllabus Content
        const exC = existingItem as Course;
        const newC = item as Course;

        const mergedItem: Course = {
            ...newC, // Take new content (Description, Textbooks, Topics, Assessment, CLOs, etc.)
            id: exC.id, // Preserve ID
            // Preserve Catalog Metadata
            code: exC.code,
            name: exC.name,
            credits: exC.credits,
            semester: exC.semester,
            type: exC.type,
            prerequisites: exC.prerequisites,
            coRequisites: exC.coRequisites,
            isEssential: exC.isEssential,
            isAbet: exC.isAbet,
            knowledgeAreaId: exC.knowledgeAreaId
        };

        updateState(prev => ({
            ...prev,
            courses: prev.courses.map(c => c.id === exC.id ? mergedItem : c)
        }));
    }
    
    alert(language === 'vi' ? "Đã ghi đè dữ liệu (Giữ nguyên thông tin khung chương trình)!" : "Data overwritten (Preserved catalog metadata)!");
    handleCloseModal();
  };

  const handleCreateNew = () => {
    if (!conflictData) return;
    const { item, type } = conflictData;
    
    // Force generate new ID to avoid conflict
    const newId = `${type === 'cv' ? 'fac' : 'CID'}-${Date.now()}`;
    const newItem = { ...item, id: newId };

    if (type === 'cv') {
      updateState(prev => ({ ...prev, faculties: [...prev.faculties, newItem as Faculty] }));
    } else {
      updateState(prev => ({ ...prev, courses: [...prev.courses, newItem as Course] }));
    }
    alert(language === 'vi' ? "Đã thêm mới dữ liệu (Sinh ID mới)!" : "Added as new record (Generated new ID)!");
    handleCloseModal();
  };

  // --- Logic: Library Deduplication (New & Optimized) ---
  const scanLibrary = () => {
    setIsScanning(true);
    setTimeout(() => {
      const visited = new Set<string>();
      const groups: LibraryResource[][] = [];
      const threshold = 0.7;

      // Sort by length desc to match longer titles first (better anchor)
      const sortedLib = [...library].sort((a, b) => b.title.length - a.title.length);

      for (let i = 0; i < sortedLib.length; i++) {
        if (visited.has(sortedLib[i].id)) continue;
        
        const currentGroup = [sortedLib[i]];
        visited.add(sortedLib[i].id);

        for (let j = i + 1; j < sortedLib.length; j++) {
          if (visited.has(sortedLib[j].id)) continue;
          
          const sim = calculateSimilarity(sortedLib[i].title, sortedLib[j].title);
          
          // Also check author similarity if titles are close
          let authorMatch = true;
          if (sim > threshold && sortedLib[i].author && sortedLib[j].author) {
             const authorSim = calculateSimilarity(sortedLib[i].author, sortedLib[j].author);
             if (authorSim < 0.5) authorMatch = false; // Different authors -> Different books usually
          }

          if (sim > threshold && authorMatch) {
            currentGroup.push(sortedLib[j]);
            visited.add(sortedLib[j].id);
          }
        }

        if (currentGroup.length > 1) {
          groups.push(currentGroup);
        }
      }

      setDuplicateGroups(groups);
      setIsScanning(false);
    }, 100); // Async to let UI render loader
  };

  const mergeLibraryGroup = () => {
    if (selectedGroupIndex === null || !targetResourceId) return;
    const group = duplicateGroups[selectedGroupIndex];
    if (!group) return;

    // IDs to remove (all except target)
    const removeIds = group.filter(item => item.id !== targetResourceId).map(item => item.id);
    
    // Update State
    updateState(prev => {
        // 1. Update Courses (Remap IDs)
        const newCourses = prev.courses.map(course => {
            let changed = false;
            const newTextbooks = course.textbooks.map(tb => {
                if (removeIds.includes(tb.resourceId)) {
                    changed = true;
                    return { ...tb, resourceId: targetResourceId };
                }
                return tb;
            });

            if (!changed) return course;

            // Deduplicate textbooks within the course
            const uniqueTextbooks: typeof newTextbooks = [];
            const seenIds = new Set<string>();
            newTextbooks.forEach(tb => {
                if (!seenIds.has(tb.resourceId)) {
                    seenIds.add(tb.resourceId);
                    uniqueTextbooks.push(tb);
                }
            });

            return { ...course, textbooks: uniqueTextbooks };
        });

        // 2. Update Library (Remove Merged Items)
        const newLibrary = prev.library.filter(lib => !removeIds.includes(lib.id));

        return {
            ...prev,
            courses: newCourses,
            library: newLibrary
        };
    });

    // Update Local State (Remove group from UI)
    const newGroups = [...duplicateGroups];
    newGroups.splice(selectedGroupIndex, 1);
    setDuplicateGroups(newGroups);
    setSelectedGroupIndex(null);
    setTargetResourceId(null);
    
    alert(language === 'vi' ? 'Đã gộp thành công!' : 'Merged successfully!');
  };

  const calculateUsage = (resId: string) => {
      let count = 0;
      courses.forEach(c => {
          if (c.textbooks.some(t => t.resourceId === resId)) count++;
      });
      return count;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3 mb-2">
                  <FileJson className="text-indigo-600" size={28} />
                  {language === 'vi' ? 'Nhập liệu & Công cụ' : 'Data Import & Tools'}
                </h1>
                <p className="text-slate-600 max-w-2xl">
                  {language === 'vi' 
                    ? 'Quản lý dữ liệu JSON hoặc sử dụng các công cụ làm sạch dữ liệu. Dùng "Library Deduplication" để tìm và gộp các tài liệu tham khảo bị trùng lặp trong hệ thống.'
                    : 'Manage JSON data or use data cleaning tools. Use "Library Deduplication" to find and merge duplicate reference materials across the system.'}
                </p>
            </div>
            <a 
                href="https://gemini.google.com/gem/1ERPKel5BS-NhyaEfdUbi1DRfJ92hDKBE?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 text-indigo-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:shadow-md transition-all group shrink-0"
            >
                <Sparkles size={16} className="text-purple-500 group-hover:animate-pulse"/>
                <span>{language === 'vi' ? 'Công cụ tạo JSON' : 'JSON Creator Bot'}</span>
                <ExternalLink size={14} className="opacity-50"/>
            </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: CV Import */}
          <button 
            onClick={() => handleOpenModal('cv')}
            className="flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group h-full"
          >
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
              <Upload size={28} className="text-indigo-600" />
            </div>
            <h3 className="text-base font-bold text-slate-700 group-hover:text-indigo-700">
              {language === 'vi' ? 'Nhập JSON Giảng viên' : 'Import Faculty JSON'}
            </h3>
          </button>

          {/* Card 2: Syllabus Import */}
          <button 
            onClick={() => handleOpenModal('syllabus')}
            className="flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group h-full"
          >
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
              <Upload size={28} className="text-emerald-600" />
            </div>
            <h3 className="text-base font-bold text-slate-700 group-hover:text-emerald-700">
              {language === 'vi' ? 'Nhập JSON Đề cương' : 'Import Syllabus JSON'}
            </h3>
          </button>

          {/* Card 3: Library Tools */}
          <button 
            onClick={() => handleOpenModal('library_dedupe')}
            className="flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl hover:border-amber-500 hover:bg-amber-50 transition-all group h-full"
          >
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
              <BookOpen size={28} className="text-amber-600" />
            </div>
            <h3 className="text-base font-bold text-slate-700 group-hover:text-amber-700">
              {language === 'vi' ? 'Kiểm tra Thư viện' : 'Library Deduplication'}
            </h3>
            <span className="text-[10px] text-slate-400 mt-2 bg-white px-2 py-1 rounded-full border border-slate-200">
                {language === 'vi' ? 'Tìm trùng lặp > 70%' : '>70% Similarity Scan'}
            </span>
          </button>
        </div>
      </div>

      {/* Editor Modal (CV/Syllabus) */}
      {(activeModal === 'cv' || activeModal === 'syllabus') && !conflictData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileJson size={20} className={activeModal === 'cv' ? 'text-indigo-600' : 'text-emerald-600'}/>
                {activeModal === 'cv' 
                  ? (language === 'vi' ? 'Nhập mã JSON CV' : 'Input CV JSON') 
                  : (language === 'vi' ? 'Nhập mã JSON Đề cương' : 'Input Syllabus JSON')}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
            </div>
            
            <div className="flex-1 p-0 relative">
              <textarea 
                className="w-full h-full p-6 font-mono text-sm bg-slate-900 text-slate-100 outline-none resize-none"
                placeholder={language === 'vi' ? 'Dán mã JSON vào đây...' : 'Paste your JSON code here...'}
                value={jsonInput}
                onChange={e => setJsonInput(e.target.value)}
                spellCheck={false}
              />
            </div>

            <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center">
              <div className="text-red-500 text-sm font-bold truncate max-w-lg">
                {error && <span className="flex items-center gap-1"><AlertTriangle size={16}/> {error}</span>}
              </div>
              <div className="flex gap-3">
                <button onClick={handleCloseModal} className="px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-100 font-bold text-sm">
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button 
                  onClick={processImport}
                  disabled={!jsonInput.trim()}
                  className={`px-6 py-2 rounded-lg text-white font-bold text-sm flex items-center gap-2 shadow-lg transition-all ${activeModal === 'cv' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'} disabled:opacity-50`}
                >
                  <Upload size={16}/> {language === 'vi' ? 'Nhập' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Library Deduplication Modal */}
      {activeModal === 'library_dedupe' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden">
                  <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                          <BookOpen size={20} className="text-amber-600"/>
                          {language === 'vi' ? 'Công cụ Gộp Thư viện' : 'Library Deduplication Tool'}
                      </h3>
                      <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                  </div>

                  <div className="flex-1 flex overflow-hidden">
                      {/* Sidebar: Group List */}
                      <div className="w-1/3 border-r border-slate-200 bg-slate-50 flex flex-col">
                          <div className="p-4 border-b border-slate-200">
                              <button 
                                  onClick={scanLibrary} 
                                  disabled={isScanning}
                                  className="w-full bg-amber-500 text-white px-4 py-3 rounded-xl font-bold hover:bg-amber-600 transition shadow-sm flex justify-center items-center gap-2 disabled:opacity-50"
                              >
                                  {isScanning ? <RefreshCw size={18} className="animate-spin"/> : <Search size={18}/>} 
                                  {language === 'vi' ? 'Quét Thư viện (70%)' : 'Scan Library (70%)'}
                              </button>
                              {duplicateGroups.length > 0 && (
                                  <div className="mt-3 text-xs text-center font-medium text-slate-500">
                                      {language === 'vi' ? `Tìm thấy ${duplicateGroups.length} nhóm trùng lặp` : `Found ${duplicateGroups.length} duplicate groups`}
                                  </div>
                              )}
                          </div>
                          
                          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                              {duplicateGroups.map((group, idx) => (
                                  <div 
                                      key={idx}
                                      onClick={() => { setSelectedGroupIndex(idx); setTargetResourceId(null); }}
                                      className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedGroupIndex === idx ? 'bg-white border-amber-400 shadow-md ring-1 ring-amber-100' : 'bg-white/50 border-slate-200 hover:border-amber-300'}`}
                                  >
                                      <div className="font-bold text-sm text-slate-700 line-clamp-1">{group[0].title}</div>
                                      <div className="flex justify-between items-center mt-2">
                                          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{group.length} items</span>
                                          <span className="text-[10px] text-slate-400 truncate max-w-[100px]">{group[0].author}</span>
                                      </div>
                                  </div>
                              ))}
                              {duplicateGroups.length === 0 && !isScanning && (
                                  <div className="flex flex-col items-center justify-center h-40 text-slate-400 italic text-sm">
                                      {language === 'vi' ? 'Nhấn Quét để bắt đầu' : 'Click Scan to start'}
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* Main: Merge Workspace */}
                      <div className="flex-1 flex flex-col bg-white">
                          {selectedGroupIndex !== null ? (
                              <>
                                  <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                                      <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-6 flex gap-3">
                                          <Info size={20} className="text-blue-500 shrink-0 mt-0.5"/>
                                          <div className="text-sm text-blue-700">
                                              <strong>{language === 'vi' ? 'Hướng dẫn:' : 'Instructions:'}</strong>
                                              <p>{language === 'vi' 
                                                  ? 'Chọn tài liệu CHÍNH (Target) để giữ lại. Các tài liệu khác sẽ bị xóa và mọi liên kết trong đề cương sẽ được chuyển sang tài liệu chính.' 
                                                  : 'Select the TARGET resource to keep. Others will be deleted, and syllabus links will be remapped to the Target.'}
                                              </p>
                                          </div>
                                      </div>

                                      <div className="space-y-4">
                                          {duplicateGroups[selectedGroupIndex].map(item => {
                                              const isTarget = targetResourceId === item.id;
                                              const usage = calculateUsage(item.id);
                                              return (
                                                  <div 
                                                      key={item.id} 
                                                      onClick={() => setTargetResourceId(item.id)}
                                                      className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-4 ${isTarget ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-slate-300'}`}
                                                  >
                                                      <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isTarget ? 'border-amber-500 bg-white' : 'border-slate-300'}`}>
                                                          {isTarget && <div className="w-2.5 h-2.5 rounded-full bg-amber-500"/>}
                                                      </div>
                                                      <div className="flex-1 min-w-0">
                                                          <div className="flex justify-between">
                                                              <h4 className="font-bold text-slate-800 text-sm">{item.title}</h4>
                                                              {usage > 0 && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded ml-2 whitespace-nowrap">Used in {usage} courses</span>}
                                                          </div>
                                                          <p className="text-xs text-slate-500 mt-1">{item.author} • {item.publisher} ({item.year})</p>
                                                          <div className="flex gap-2 mt-2 text-[10px] text-slate-400 font-mono">
                                                              <span className="bg-slate-100 px-1.5 rounded">{item.id}</span>
                                                              {item.type && <span className="uppercase border px-1.5 rounded">{item.type}</span>}
                                                          </div>
                                                      </div>
                                                      <div className="self-center">
                                                          {isTarget ? (
                                                              <span className="text-xs font-bold text-amber-600 bg-white px-3 py-1 rounded-full border border-amber-200 shadow-sm">KEEP</span>
                                                          ) : (
                                                              <span className="text-xs font-bold text-red-400 flex items-center gap-1"><Trash2 size={12}/> REMOVE</span>
                                                          )}
                                                      </div>
                                                  </div>
                                              );
                                          })}
                                      </div>
                                  </div>
                                  <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end">
                                      <button 
                                          onClick={mergeLibraryGroup}
                                          disabled={!targetResourceId}
                                          className="bg-amber-500 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-amber-600 transition shadow-lg shadow-amber-200 disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                                      >
                                          <Merge size={18}/> {language === 'vi' ? 'Gộp & Cập nhật Đề cương' : 'Merge & Update Syllabi'}
                                      </button>
                                  </div>
                              </>
                          ) : (
                              <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                                  <ArrowRight size={48} className="mb-4 opacity-20"/>
                                  <p className="text-sm font-medium">{language === 'vi' ? 'Chọn một nhóm bên trái để xử lý' : 'Select a group from the sidebar to process'}</p>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Conflict Resolution Modal (Keep existing) */}
      {conflictData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border-t-4 border-amber-500">
            <div className="p-6">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-4 mx-auto">
                <AlertTriangle size={24}/>
              </div>
              <h3 className="text-xl font-bold text-slate-800 text-center mb-2">
                {language === 'vi' ? 'Phát hiện trùng lặp' : 'Duplicate Detected'}
              </h3>
              
              <div className="text-sm text-slate-600 text-center mb-6">
                <p className="mb-2">
                    {language === 'vi' ? 'Hệ thống tìm thấy dữ liệu trùng khớp dựa trên:' : 'The system found a matching record based on:'} 
                    <span className="font-bold text-indigo-600 ml-1 uppercase">{conflictData.matchReason === 'id' ? 'ID' : 'NAME'}</span>
                </p>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-left text-xs space-y-1">
                    <div className="flex justify-between">
                        <span className="text-slate-400">ID:</span>
                        <span className="font-mono font-bold">{conflictData.existingItem.id}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">{language === 'vi' ? 'Tên:' : 'Name:'}</span>
                        <span className="font-bold">{(conflictData.existingItem as any).name?.vi || (conflictData.existingItem as any).name?.en || (conflictData.existingItem as any).title}</span>
                    </div>
                </div>
                {/* Updated Warning Text */}
                <p className="text-xs text-slate-500 italic mt-4 bg-yellow-50 p-2 rounded border border-yellow-100">
                    {conflictData.type === 'syllabus' 
                        ? (language === 'vi' ? "Lưu ý: Ghi đè sẽ cập nhật nội dung đề cương nhưng GIỮ NGUYÊN thông tin khung chương trình (Số tín chỉ, Loại môn, Tiên quyết...)." : "Note: Overwrite will update syllabus content but PRESERVE catalog info (Credits, Type, Prerequisites...).")
                        : (language === 'vi' ? "Lưu ý: Ghi đè sẽ cập nhật thông tin giảng viên nhưng GIỮ NGUYÊN ID để không làm hỏng liên kết môn học." : "Note: Overwrite will update faculty info but PRESERVE ID to maintain course links.")
                    }
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleOverwrite} className="px-4 py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 flex flex-col items-center justify-center gap-1 transition-colors group">
                  <Copy size={18} className="group-hover:scale-110 transition-transform"/>
                  <span className="text-xs">{language === 'vi' ? 'Ghi đè' : 'Overwrite'}</span>
                </button>
                <button onClick={handleCreateNew} className="px-4 py-3 bg-emerald-50 text-emerald-600 font-bold rounded-xl hover:bg-emerald-100 flex flex-col items-center justify-center gap-1 transition-colors group">
                  <Plus size={18} className="group-hover:scale-110 transition-transform"/>
                  <span className="text-xs">{language === 'vi' ? 'Tạo mới (Sinh ID)' : 'Create New (Gen ID)'}</span>
                </button>
              </div>
              <button onClick={handleCloseModal} className="w-full mt-4 py-2 text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-wider">
                {language === 'vi' ? 'Hủy bỏ' : 'Cancel Operation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JSONInputModule;