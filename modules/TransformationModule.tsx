
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AppState, MoetInfo, MoetCategory, MoetObjective, Course, KnowledgeArea, GeneralInfo, CoverageLevel, Language, MoetProgramFaculty, IRM, MoetSubBlock } from '../types';
import { translateContent } from '../services/geminiService';
import { TRANSLATIONS } from '../constants';
import AILoader from '../components/AILoader';
import { 
  Layout, Sparkles, Download, BookOpen, Target, Plus, Trash2, 
  FileText, Users, GraduationCap, Scale, Globe, Grid3X3, Check,
  ChevronDown, ChevronUp, Search, X, Bold, Italic, Underline, List as ListIcon, ListOrdered, Filter, UserCog, Link2, BoxSelect, Save, Calculator, ArrowRight, FileType, CheckSquare, Edit2, Layers
} from 'lucide-react';
import { exportMoetDocx } from '../services/MoetProgramExportDOC';
import { exportMoetPdf } from '../services/MoetProgramExportPDF';

interface Props {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const CATEGORY_ORDER: MoetCategory[] = ['knowledge', 'skills', 'attitude', 'learning'];

const CATEGORY_META: Record<MoetCategory, { vi: string, en: string, color: string, icon: React.ReactNode }> = {
  knowledge: { vi: 'Kiến thức', en: 'Knowledge', color: 'text-blue-600', icon: <BookOpen size={16}/> },
  skills: { vi: 'Kỹ năng', en: 'Skills', color: 'text-green-600', icon: <Target size={16}/> },
  attitude: { vi: 'Thái độ', en: 'Attitude', color: 'text-amber-600', icon: <UserCog size={16}/> },
  learning: { vi: 'Năng lực tự chủ & Trách nhiệm', en: 'Autonomy & Responsibility', color: 'text-purple-600', icon: <GraduationCap size={16}/> }
};

// --- Simple WYSIWYG Editor Component ---
const RichTextEditor: React.FC<{ value: string; onChange: (val: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  return (
    <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-indigo-500 transition-shadow shadow-sm">
      <div className="flex items-center gap-1 p-1 bg-slate-50 border-b border-slate-100 flex-wrap">
        <button onClick={() => execCommand('bold')} className="p-1.5 hover:bg-slate-200 rounded text-slate-600" title="Bold"><Bold size={16} /></button>
        <button onClick={() => execCommand('italic')} className="p-1.5 hover:bg-slate-200 rounded text-slate-600" title="Italic"><Italic size={16} /></button>
        <button onClick={() => execCommand('underline')} className="p-1.5 hover:bg-slate-200 rounded text-slate-600" title="Underline"><Underline size={16} /></button>
        <div className="w-px h-4 bg-slate-300 mx-1"></div>
        <button onClick={() => execCommand('insertUnorderedList')} className="p-1.5 hover:bg-slate-200 rounded text-slate-600" title="Bullet List"><ListIcon size={16} /></button>
        <button onClick={() => execCommand('insertOrderedList')} className="p-1.5 hover:bg-slate-200 rounded text-slate-600" title="Numbered List"><ListOrdered size={16} /></button>
      </div>
      <div 
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="p-4 min-h-[150px] max-h-[400px] overflow-y-auto outline-none text-sm leading-relaxed text-slate-700 prose prose-sm max-w-none"
        data-placeholder={placeholder}
      />
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          font-style: italic;
        }
        [contenteditable] ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        [contenteditable] ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        [contenteditable] li {
          margin: 0.25rem 0;
        }
      `}</style>
    </div>
  );
};

// --- Helper: Relation Editor Popup ---
const RelationEditor = ({ 
    course, 
    type, 
    allCourses, 
    value, 
    onChange, 
    language 
}: {
    course: Course,
    type: 'prereq' | 'coreq',
    allCourses: Course[],
    value: string[],
    onChange: (val: string[]) => void,
    language: Language
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = allCourses.filter(c => 
        c.id !== course.id && // Not self
        ((c.code || '').toLowerCase().includes(search.toLowerCase()) || (c.name[language] || '').toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="relative" ref={containerRef}>
            <div className="flex flex-wrap gap-1 min-h-[24px] items-center">
                {value.length === 0 && (
                    <button onClick={() => setIsOpen(true)} className="text-[10px] text-slate-400 hover:text-indigo-600 flex items-center gap-1 italic border border-dashed border-slate-300 px-1.5 rounded hover:border-indigo-300">
                        <Plus size={10}/> Add
                    </button>
                )}
                {value.map(code => (
                    <span key={code} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-700 border border-slate-200">
                        {code}
                        <button onClick={() => onChange(value.filter(v => v !== code))} className="hover:text-red-500"><X size={10}/></button>
                    </span>
                ))}
                {value.length > 0 && <button onClick={() => setIsOpen(true)} className="text-slate-400 hover:text-indigo-600 ml-1"><Edit2 size={10}/></button>}
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 shadow-xl rounded-lg z-50 p-2 animate-in fade-in zoom-in-95">
                    <div className="mb-2">
                        <input 
                            className="w-full text-xs p-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none" 
                            placeholder="Search..." 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                        {filtered.map(c => {
                            const isSelected = value.includes(c.code);
                            return (
                                <div 
                                    key={c.id} 
                                    onClick={() => {
                                        const newValue = isSelected ? value.filter(v => v !== c.code) : [...value, c.code];
                                        onChange(newValue);
                                    }}
                                    className={`flex items-center justify-between p-1.5 rounded cursor-pointer text-xs ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'}`}
                                >
                                    <span className="font-bold">{c.code}</span>
                                    {isSelected && <Check size={12}/>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Course Picker Component ---
const CoursePicker = ({ courses, onSelect, language, excludeIds = [] }: { courses: Course[], onSelect: (id: string) => void, language: Language, excludeIds?: string[] }) => {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const filtered = courses.filter(c => 
        !excludeIds.includes(c.id) &&
        ((c.code || '').toLowerCase().includes(search.toLowerCase()) || 
         (c.name[language] || '').toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="relative inline-block" ref={containerRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-1 text-xs text-indigo-600 font-bold bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors">
                <Plus size={14}/> {language === 'vi' ? 'Thêm môn học' : 'Add Course'}
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200 shadow-xl rounded-lg z-50 p-2 animate-in fade-in zoom-in-95">
                    <div className="flex items-center gap-2 mb-2 bg-slate-50 p-1.5 rounded border border-slate-100">
                        <Search size={14} className="text-slate-400"/>
                        <input className="flex-1 text-xs outline-none bg-transparent" autoFocus placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
                        <button onClick={() => setIsOpen(false)}><X size={14} className="text-slate-400 hover:text-slate-600"/></button>
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                        {filtered.map(c => (
                            <div key={c.id} onClick={() => { onSelect(c.id); setIsOpen(false); }} className="text-xs p-2 hover:bg-indigo-50 hover:text-indigo-700 rounded cursor-pointer truncate flex justify-between items-center group">
                                <div>
                                    <span className="font-bold block">{c.code}</span>
                                    <span className="text-[10px] text-slate-500 group-hover:text-indigo-500">{c.name[language]}</span>
                                </div>
                                <Plus size={12} className="opacity-0 group-hover:opacity-100 transition-opacity"/>
                            </div>
                        ))}
                        {filtered.length === 0 && <div className="text-xs text-slate-400 text-center py-4 italic">No results</div>}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Reusable Structure Table Component ---
const StructureTable = ({ 
    courseIds, 
    courses, 
    language, 
    onRemove, 
    onAdd,
    onTypeChange,
    onRelationUpdate,
    excludeIds,
    theme = 'slate'
}: {
    courseIds: string[],
    courses: Course[],
    language: Language,
    onRemove: (id: string) => void,
    onAdd: (id: string) => void,
    onTypeChange: (id: string, type: 'REQUIRED' | 'ELECTIVE' | 'SELECTED_ELECTIVE') => void,
    onRelationUpdate: (id: string, field: 'prerequisites' | 'coRequisites', value: string[]) => void,
    excludeIds: string[],
    theme?: 'slate' | 'amber'
}) => {
    const borderColor = theme === 'amber' ? 'border-amber-200' : 'border-slate-200';
    const headerBg = theme === 'amber' ? 'bg-amber-100/50' : 'bg-slate-50';
    
    return (
        <div className={`overflow-x-auto rounded-lg border ${borderColor} bg-white shadow-sm`}>
            <table className="w-full text-left text-sm">
                <thead className={`${headerBg} border-b ${borderColor} text-xs font-bold text-slate-500 uppercase`}>
                    <tr>
                        <th className="p-3 w-16">Code</th>
                        <th className="p-3 min-w-[150px]">Course Name</th>
                        <th className="p-3 w-12 text-center">Cr</th>
                        <th className="p-3 w-32">Type</th>
                        <th className="p-3 w-40">Prerequisites</th>
                        <th className="p-3 w-40">Co-requisites</th>
                        <th className="p-3 w-10 text-center">Action</th>
                    </tr>
                </thead>
                <tbody className={`divide-y ${theme === 'amber' ? 'divide-amber-50' : 'divide-slate-100'}`}>
                    {courseIds.map(cid => {
                        const c = courses.find(x => x.id === cid);
                        if (!c) return null;
                        return (
                            <tr key={cid} className={`group hover:${theme === 'amber' ? 'bg-amber-50/30' : 'bg-slate-50'}`}>
                                <td className="p-3 font-bold text-slate-700">{c.code}</td>
                                <td className="p-3">
                                    <div className="font-medium text-slate-800">{c.name[language]}</div>
                                </td>
                                <td className="p-3 text-center">{c.credits}</td>
                                <td className="p-3">
                                    <select 
                                        className="w-full text-xs p-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                                        value={c.type}
                                        onChange={(e) => onTypeChange(c.id, e.target.value as any)}
                                    >
                                        <option value="REQUIRED">{language === 'vi' ? 'Bắt buộc' : 'Compulsory'}</option>
                                        <option value="SELECTED_ELECTIVE">{language === 'vi' ? 'TC Định hướng' : 'Selected Elective'}</option>
                                        <option value="ELECTIVE">{language === 'vi' ? 'Tự chọn' : 'Free Elective'}</option>
                                    </select>
                                </td>
                                <td className="p-3">
                                    <RelationEditor 
                                        course={c} type="prereq" allCourses={courses} language={language}
                                        value={c.prerequisites} 
                                        onChange={val => onRelationUpdate(c.id, 'prerequisites', val)} 
                                    />
                                </td>
                                <td className="p-3">
                                    <RelationEditor 
                                        course={c} type="coreq" allCourses={courses} language={language}
                                        value={c.coRequisites} 
                                        onChange={val => onRelationUpdate(c.id, 'coRequisites', val)} 
                                    />
                                </td>
                                <td className="p-3 text-center">
                                    <button 
                                        onClick={() => onRemove(c.id)}
                                        className="text-slate-300 hover:text-red-500 transition-colors"
                                    >
                                        <X size={16}/>
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    <tr>
                        <td colSpan={7} className={`p-2 ${theme === 'amber' ? 'bg-amber-50/20' : 'bg-slate-50/50'}`}>
                            <CoursePicker 
                                courses={courses} 
                                onSelect={onAdd} 
                                language={language} 
                                excludeIds={excludeIds} 
                            />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

const TransformationModule: React.FC<Props> = ({ state, updateState }) => {
  const { generalInfo, courses, language, geminiConfig, peos, knowledgeAreas, sos, teachingMethods, assessmentMethods, faculties } = state;
  const moetInfo = generalInfo.moetInfo;
  const [isTranslating, setIsTranslating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // State for Type Selection Modal
  const [moveCourseData, setMoveCourseData] = useState<{ courseId: string, currentBlock: string, targetType: 'REQUIRED' | 'ELECTIVE' | 'SELECTED_ELECTIVE' } | null>(null);

  const tStrings = TRANSLATIONS[language];

  // Helper for updates
  const updateMoetField = (field: keyof MoetInfo, value: any) => {
    updateState(prev => ({
      ...prev,
      generalInfo: {
        ...prev.generalInfo,
        moetInfo: { ...prev.generalInfo.moetInfo, [field]: value }
      }
    }));
  };

  const updateMoetLangField = (field: keyof MoetInfo, value: string) => {
    const currentVal = (moetInfo[field] as any) || { vi: '', en: '' };
    updateMoetField(field, { ...currentVal, [language]: value });
  };

  // --- Core Logic for Structure Management ---

  const updateCourseRelation = (courseId: string, field: 'prerequisites' | 'coRequisites', value: string[]) => {
      updateState(prev => ({
          ...prev,
          courses: prev.courses.map(c => c.id === courseId ? { ...c, [field]: value } : c)
      }));
  };

  const updateCourseTypeGlobal = (courseId: string, type: 'REQUIRED' | 'ELECTIVE' | 'SELECTED_ELECTIVE') => {
      updateState(prev => ({
          ...prev,
          courses: prev.courses.map(c => c.id === courseId ? { ...c, type: type } : c)
      }));
  };

  const handleTypeChange = (courseId: string, newType: 'REQUIRED' | 'ELECTIVE' | 'SELECTED_ELECTIVE', currentBlockId: string) => {
      const subBlocks = (moetInfo.subBlocks || []).filter(sb => sb.parentBlockId === currentBlockId);
      
      // 1. If changing TO Required
      if (newType === 'REQUIRED') {
          // Remove from any sub-block
          const nextSubBlocks = (moetInfo.subBlocks || []).map(sb => ({
              ...sb,
              courseIds: sb.courseIds.filter(id => id !== courseId)
          }));
          // Add to main structure list if not present
          const currentList = moetInfo.programStructure[currentBlockId as keyof typeof moetInfo.programStructure] || [];
          const nextList = currentList.includes(courseId) ? currentList : [...currentList, courseId];
          
          updateState(prev => ({
              ...prev,
              courses: prev.courses.map(c => c.id === courseId ? { ...c, type: newType } : c),
              generalInfo: {
                  ...prev.generalInfo,
                  moetInfo: {
                      ...prev.generalInfo.moetInfo,
                      programStructure: { ...prev.generalInfo.moetInfo.programStructure, [currentBlockId]: nextList },
                      subBlocks: nextSubBlocks
                  }
              }
          }));
      } 
      // 2. If changing TO Elective/Selected Elective
      else {
          if (subBlocks.length === 0) {
              // Create new sub-block and move
              const newSubBlock: MoetSubBlock = {
                  id: `sb-${Date.now()}`,
                  name: { vi: 'Khối tự chọn 1', en: 'Elective Block 1' },
                  parentBlockId: currentBlockId as any,
                  minCredits: 3,
                  courseIds: [courseId],
                  note: { vi: '', en: '' }
              };
              // Remove from main list
              const currentList = moetInfo.programStructure[currentBlockId as keyof typeof moetInfo.programStructure] || [];
              const nextList = currentList.filter(id => id !== courseId);

              updateState(prev => ({
                  ...prev,
                  courses: prev.courses.map(c => c.id === courseId ? { ...c, type: newType } : c),
                  generalInfo: {
                      ...prev.generalInfo,
                      moetInfo: {
                          ...prev.generalInfo.moetInfo,
                          programStructure: { ...prev.generalInfo.moetInfo.programStructure, [currentBlockId]: nextList },
                          subBlocks: [...(prev.generalInfo.moetInfo.subBlocks || []), newSubBlock]
                      }
                  }
              }));
          } else if (subBlocks.length === 1) {
              // Move to the only sub-block
              const targetSubId = subBlocks[0].id;
              const nextSubBlocks = (moetInfo.subBlocks || []).map(sb => {
                  if (sb.id === targetSubId && !sb.courseIds.includes(courseId)) {
                      return { ...sb, courseIds: [...sb.courseIds, courseId] };
                  }
                  return sb;
              });
              // Remove from main list
              const currentList = moetInfo.programStructure[currentBlockId as keyof typeof moetInfo.programStructure] || [];
              const nextList = currentList.filter(id => id !== courseId);

              updateState(prev => ({
                  ...prev,
                  courses: prev.courses.map(c => c.id === courseId ? { ...c, type: newType } : c),
                  generalInfo: {
                      ...prev.generalInfo,
                      moetInfo: {
                          ...prev.generalInfo.moetInfo,
                          programStructure: { ...prev.generalInfo.moetInfo.programStructure, [currentBlockId]: nextList },
                          subBlocks: nextSubBlocks
                      }
                  }
              }));
          } else {
              // Multiple sub-blocks: Show Modal
              setMoveCourseData({ courseId, currentBlock: currentBlockId, targetType: newType });
          }
      }
  };

  const confirmMoveToSubBlock = (subBlockId: string) => {
      if (!moveCourseData) return;
      const { courseId, currentBlock, targetType } = moveCourseData;

      // Remove from main list
      const currentList = moetInfo.programStructure[currentBlock as keyof typeof moetInfo.programStructure] || [];
      const nextList = currentList.filter(id => id !== courseId);

      // Add to target sub-block (and remove from others if it was in another subblock - logic simplified to just ensure it's in target)
      // First clean up from all sub-blocks to be safe, then add to target
      let nextSubBlocks = (moetInfo.subBlocks || []).map(sb => ({
          ...sb,
          courseIds: sb.courseIds.filter(id => id !== courseId)
      }));
      
      nextSubBlocks = nextSubBlocks.map(sb => {
          if (sb.id === subBlockId) return { ...sb, courseIds: [...sb.courseIds, courseId] };
          return sb;
      });

      updateState(prev => ({
          ...prev,
          courses: prev.courses.map(c => c.id === courseId ? { ...c, type: targetType } : c),
          generalInfo: {
              ...prev.generalInfo,
              moetInfo: {
                  ...prev.generalInfo.moetInfo,
                  programStructure: { ...prev.generalInfo.moetInfo.programStructure, [currentBlock]: nextList },
                  subBlocks: nextSubBlocks
              }
          }
      }));
      setMoveCourseData(null);
  };

  // --- Sub-blocks Management ---
  const addSubBlock = (parentBlockId: 'gen' | 'fund' | 'spec' | 'grad') => {
      const newBlock: MoetSubBlock = {
          id: `sb-${Date.now()}`,
          name: { vi: 'Khối tự chọn mới', en: 'New Elective Block' },
          parentBlockId,
          minCredits: 3,
          courseIds: [],
          note: { vi: '', en: '' }
      };
      updateMoetField('subBlocks', [...(moetInfo.subBlocks || []), newBlock]);
  };

  const updateSubBlock = (id: string, updates: Partial<MoetSubBlock>) => {
      const next = (moetInfo.subBlocks || []).map(sb => sb.id === id ? { ...sb, ...updates } : sb);
      updateMoetField('subBlocks', next);
  };

  const deleteSubBlock = (id: string) => {
      if(!confirm(language === 'vi' ? 'Xóa khối tự chọn này? Các môn học bên trong sẽ bị gỡ bỏ khỏi khối và trở về danh sách chờ.' : 'Delete this elective block? Courses inside will be removed from the block and return to the waiting list.')) return;
      updateMoetField('subBlocks', (moetInfo.subBlocks || []).filter(sb => sb.id !== id));
  };

  // --- Standardized Action Handlers for Structure ---
  const removeCourseFromStructure = (courseId: string, blockId: string) => {
      // Check if it's in main list
      const currentList = moetInfo.programStructure[blockId as keyof typeof moetInfo.programStructure] || [];
      if (currentList.includes(courseId)) {
          updateMoetField('programStructure', { ...moetInfo.programStructure, [blockId]: currentList.filter(id => id !== courseId) });
          return;
      }
      // Check if it's in a sub-block
      const nextSubBlocks = (moetInfo.subBlocks || []).map(sb => {
          if (sb.parentBlockId === blockId) {
              return { ...sb, courseIds: sb.courseIds.filter(id => id !== courseId) };
          }
          return sb;
      });
      updateMoetField('subBlocks', nextSubBlocks);
  };

  const addCourseToMainList = (courseId: string, blockId: string) => {
      const currentList = moetInfo.programStructure[blockId as keyof typeof moetInfo.programStructure] || [];
      if (!currentList.includes(courseId)) {
          updateMoetField('programStructure', { ...moetInfo.programStructure, [blockId]: [...currentList, courseId] });
          // Ensure type is updated to compulsory
          updateCourseTypeGlobal(courseId, 'REQUIRED');
      }
  };

  const addCourseToSubBlock = (subBlockId: string, courseId: string) => {
      const nextSubBlocks = (moetInfo.subBlocks || []).map(sb => {
          if (sb.id === subBlockId && !sb.courseIds.includes(courseId)) {
              return { ...sb, courseIds: [...sb.courseIds, courseId] };
          }
          return sb;
      });
      updateMoetField('subBlocks', nextSubBlocks);
  };

  const removeCourseFromSubBlock = (subBlockId: string, courseId: string) => {
      const next = (moetInfo.subBlocks || []).map(sb => {
          if (sb.id === subBlockId) {
              return { ...sb, courseIds: sb.courseIds.filter(id => id !== courseId) };
          }
          return sb;
      });
      updateMoetField('subBlocks', next);
  };

  // 2.3 Learning Outcomes
  const addObjective = (category: MoetCategory) => {
      const newObj: MoetObjective = {
          id: `MO-${Date.now()}`,
          category: category,
          description: { vi: '', en: '' },
          peoIds: [],
          soIds: []
      };
      updateMoetField('specificObjectives', [...(moetInfo.specificObjectives || []), newObj]);
  };

  const updateObjectiveDesc = (id: string, val: string) => {
      const newObjs = (moetInfo.specificObjectives || []).map(o => o.id === id ? { ...o, description: { ...o.description, [language]: val } } : o);
      updateMoetField('specificObjectives', newObjs);
  };

  const deleteObjective = (id: string) => {
      updateMoetField('specificObjectives', (moetInfo.specificObjectives || []).filter(o => o.id !== id));
  };

  const toggleObjectiveSo = (objId: string, soId: string) => {
      const newObjs = (moetInfo.specificObjectives || []).map(o => {
          if (o.id !== objId) return o;
          const currentSos = o.soIds || [];
          return {
              ...o,
              soIds: currentSos.includes(soId) ? currentSos.filter(id => id !== soId) : [...currentSos, soId]
          };
      });
      updateMoetField('specificObjectives', newObjs);
  };

  // 2.2 Specific Objectives (MOET PLO)
  const addMoetSpecificObjective = () => {
    const newObj: MoetObjective = {
        id: `MSO-${Date.now()}`,
        description: { vi: '', en: '' },
        peoIds: []
    };
    updateMoetField('moetSpecificObjectives', [...(moetInfo.moetSpecificObjectives || []), newObj]);
  };

  const updateMoetSpecificObjectiveDesc = (id: string, val: string) => {
    const newObjs = (moetInfo.moetSpecificObjectives || []).map(o => o.id === id ? { ...o, description: { ...o.description, [language]: val } } : o);
    updateMoetField('moetSpecificObjectives', newObjs);
  };

  const toggleMoetSpecificObjectivePeo = (objId: string, peoId: string) => {
    const newObjs = (moetInfo.moetSpecificObjectives || []).map(o => {
        if (o.id !== objId) return o;
        const currentPeos = o.peoIds || [];
        return {
            ...o,
            peoIds: currentPeos.includes(peoId) ? currentPeos.filter(id => id !== peoId) : [...currentPeos, peoId]
        };
    });
    updateMoetField('moetSpecificObjectives', newObjs);
  };

  const deleteMoetSpecificObjective = (id: string) => {
    updateMoetField('moetSpecificObjectives', (moetInfo.moetSpecificObjectives || []).filter(o => o.id !== id));
  };

  // Program Faculty
  const addProgramFaculty = () => {
    const newItem: MoetProgramFaculty = {
      id: `pf-${Date.now()}`,
      name: '',
      position: '',
      major: '',
      degree: '',
      responsibility: '',
      note: ''
    };
    updateMoetField('programFaculty', [...(moetInfo.programFaculty || []), newItem]);
  };

  const updateProgramFaculty = (id: string, field: keyof MoetProgramFaculty, value: string) => {
    updateMoetField('programFaculty', (moetInfo.programFaculty || []).map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const deleteProgramFaculty = (id: string) => {
    updateMoetField('programFaculty', (moetInfo.programFaculty || []).filter(f => f.id !== id));
  };

  // Matrix
  const sortedObjectives = useMemo(() => {
      const allObjs = moetInfo.specificObjectives || [];
      return [...allObjs].sort((a, b) => {
          const idxA = CATEGORY_ORDER.indexOf(a.category!);
          const idxB = CATEGORY_ORDER.indexOf(b.category!);
          if (idxA !== idxB) return idxA - idxB;
          return 0;
      });
  }, [moetInfo.specificObjectives]);

  const getObjectiveLabel = (id: string) => {
      const index = sortedObjectives.findIndex(o => o.id === id);
      if (index === -1) return '?';
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      if (index < letters.length) return letters[index];
      return letters[index % letters.length] + Math.floor(index / letters.length);
  };

  const toggleCourseObjective = (courseId: string, objectiveId: string) => {
      const currentMap = moetInfo.courseObjectiveMap || [];
      const key = `${courseId}|${objectiveId}`;
      let newMap: string[];
      if (currentMap.includes(key)) {
          newMap = currentMap.filter(k => k !== key);
      } else {
          newMap = [...currentMap, key];
      }
      updateMoetField('courseObjectiveMap', newMap);
  };

  const impliedCourseObjectiveLinks = useMemo(() => {
      const set = new Set<string>();
      (moetInfo.specificObjectives || []).forEach(obj => {
          (obj.soIds || []).forEach(soId => {
              (state.courseSoMap || []).filter(m => m.soId === soId && m.level !== IRM.NONE).forEach(m => {
                  set.add(`${m.courseId}|${obj.id}`);
              });
          });
      });
      return set;
  }, [moetInfo.specificObjectives, state.courseSoMap]);

  // Export handlers
  const handleExportDOCX = async () => {
    setIsExporting(true);
    try {
        await exportMoetDocx(generalInfo, moetInfo, courses, faculties, language, sortedObjectives, impliedCourseObjectiveLinks, teachingMethods, assessmentMethods, sos);
    } finally { setIsExporting(false); }
  };

  const handleExportPDF = async () => {
      setIsExporting(true);
      try {
          await exportMoetPdf(generalInfo, moetInfo, courses, faculties, language, sortedObjectives, impliedCourseObjectiveLinks, teachingMethods, assessmentMethods, sos);
      } finally { setIsExporting(false); }
  };

  const handleAutoTranslate = async () => {
      setIsTranslating(true);
      try {
          const otherLang = language === 'vi' ? 'en' : 'vi';
          const targetLangName = language === 'vi' ? 'Vietnamese' : 'English';
          
          // Enhanced configuration to force structure preservation
          const structuralConfig = {
              ...geminiConfig,
              prompts: {
                  ...geminiConfig.prompts,
                  translation: `Translate the following educational content to ${targetLangName}.
CRITICAL INSTRUCTIONS:
1. **Preserve Structure**: Keep all HTML tags (<ul>, <li>, <p>, <b>, <i>), bullet points, and line breaks exactly as they are in the source. Do not flatten lists.
2. **Academic Tone**: Use formal, professional academic language suitable for University Program Specifications (MOET standards).
3. **Accuracy**: Translate the meaning accurately. Do not summarize.
4. **Output**: Return ONLY the translated string.

Content to translate: {text}`
              }
          };

          const fields: (keyof MoetInfo)[] = ['level', 'majorName', 'specializationName', 'trainingMode', 'trainingType','trainingLanguage', 'admissionTarget', 'admissionReq', 'graduationReq', 'gradingScale', 'implementationGuideline', 'referencedPrograms', 'generalObjectives'];
          const newMoet = { ...moetInfo };
          
          for (const f of fields) {
              const val = newMoet[f] as any;
              if (val && !val[language] && val[otherLang]) {
                  const trans = await translateContent(val[otherLang], language, structuralConfig);
                  if (trans) val[language] = trans;
              }
          }
          if (newMoet.specificObjectives) {
              for (const obj of newMoet.specificObjectives) {
                  if (!obj.description[language] && obj.description[otherLang]) {
                      const trans = await translateContent(obj.description[otherLang], language, structuralConfig);
                      if (trans) obj.description[language] = trans;
                  }
              }
          }
          if (newMoet.moetSpecificObjectives) {
              for (const obj of newMoet.moetSpecificObjectives) {
                  if (!obj.description[language] && obj.description[otherLang]) {
                      const trans = await translateContent(obj.description[otherLang], language, structuralConfig);
                      if (trans) obj.description[language] = trans;
                  }
              }
          }
          updateState(prev => ({ ...prev, generalInfo: { ...prev.generalInfo, moetInfo: newMoet } }));
      } catch (e) {
          alert("Translation failed.");
      } finally { setIsTranslating(false); }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <AILoader isVisible={isTranslating || isExporting} message={isTranslating ? (language === 'vi' ? 'Đang dịch...' : 'Translating...') : (language === 'vi' ? 'Đang xuất PDF/DOCX...' : 'Exporting...')} />
      
      {/* Sub-block Selection Modal */}
      {moveCourseData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800">{language === 'vi' ? 'Chọn khối tự chọn' : 'Select Elective Block'}</h3>
                      <button onClick={() => setMoveCourseData(null)}><X size={20} className="text-slate-400"/></button>
                  </div>
                  <div className="p-4 space-y-2">
                      <p className="text-sm text-slate-600 mb-4">{language === 'vi' ? 'Môn học này sẽ được chuyển vào khối nào?' : 'Which elective block should this course move to?'}</p>
                      {(moetInfo.subBlocks || []).filter(sb => sb.parentBlockId === moveCourseData.currentBlock).map(sb => (
                          <button 
                              key={sb.id}
                              onClick={() => confirmMoveToSubBlock(sb.id)}
                              className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-sm font-medium"
                          >
                              {sb.name[language]} <span className="text-xs text-slate-400">({sb.minCredits} cr)</span>
                          </button>
                      ))}
                      <button 
                          onClick={() => {
                              alert("Please add a new Elective Block first using the 'New Block' button in the main view, then try moving.");
                              setMoveCourseData(null);
                          }}
                          className="w-full text-center p-2 text-indigo-600 font-bold text-xs mt-2 hover:underline"
                      >
                          + {language === 'vi' ? 'Tạo khối mới (Thực hiện bên ngoài)' : 'Create New Block (Do in main view)'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
              <div className="bg-emerald-600 p-2 rounded-lg text-white"><Layout size={20} /></div>
              <div>
                  <h2 className="text-lg font-bold text-slate-800">{language === 'vi' ? 'Chương trình đào tạo (MOET)' : 'Program Specification (MOET)'}</h2>
                  <p className="text-xs text-slate-500">{language === 'vi' ? 'Chuyển đổi dữ liệu sang định dạng Bộ GD&ĐT' : 'Transform data to Ministry of Education format'}</p>
              </div>
          </div>
          <div className="flex gap-2">
              <button onClick={handleAutoTranslate} disabled={isTranslating} className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-100 transition shadow-sm disabled:opacity-50">
                  <Sparkles size={16} /> {tStrings.autoTranslate}
              </button>
              <button onClick={handleExportDOCX} disabled={isExporting} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition shadow-sm disabled:opacity-50">
                  <FileType size={16} /> Export DOCX
              </button>
              <button onClick={handleExportPDF} disabled={isExporting} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition shadow-sm disabled:opacity-50">
                  <Download size={16} /> Export PDF
              </button>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">
          {/* Section 1 */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-slate-800 flex items-center gap-2"><BookOpen size={18} className="text-emerald-600"/>{language === 'vi' ? '1. Thông tin chung' : '1. General Information'}</h3></div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <InputField label={language === 'vi' ? 'Trình độ đào tạo' : 'Training Level'} value={moetInfo.level[language]} onChange={v => updateMoetLangField('level', v)} placeholder="e.g. Đại học" />
                  <InputField label={language === 'vi' ? 'Tên ngành' : 'Major Name'} value={moetInfo.majorName[language]} onChange={v => updateMoetLangField('majorName', v)} placeholder="e.g. Kỹ thuật Điện" />
                  <InputField label={language === 'vi' ? 'Mã ngành' : 'Major Code'} value={moetInfo.majorCode} onChange={v => updateMoetField('majorCode', v)} placeholder="e.g. 7520201" />
                  <InputField label={language === 'vi' ? 'Tên chuyên ngành' : 'Specialization Name'} value={moetInfo.specializationName[language]} onChange={v => updateMoetLangField('specializationName', v)} placeholder="" />
                  <InputField label={language === 'vi' ? 'Mã chuyên ngành' : 'Specialization Code'} value={moetInfo.specializationCode} onChange={v => updateMoetField('specializationCode', v)} placeholder="" />
                  <InputField label={language === 'vi' ? 'Hình thức đào tạo' : 'Training Mode'} value={moetInfo.trainingMode[language]} onChange={v => updateMoetLangField('trainingMode', v)} placeholder="e.g. Chính quy" />
                  <InputField label={language === 'vi' ? 'Ngôn ngữ đào tạo' : 'Training Language'} value={moetInfo.trainingLanguage[language]} onChange={v => updateMoetLangField('trainingLanguage', v)} placeholder="e.g. Tiếng Việt" />
                  <InputField label={language === 'vi' ? 'Thời gian đào tạo' : 'Duration'} value={moetInfo.duration} onChange={v => updateMoetField('duration', v)} placeholder="e.g. 4.5 năm" />
                  <InputField label={language === 'vi' ? 'Phương thức đào tạo' : 'Training Type'} value={moetInfo.trainingType[language]} onChange={v => updateMoetLangField('trainingType', v)} placeholder="Tập trung" />
              </div>
          </section>

          {/* Section 2 */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Target size={18} className="text-emerald-600"/>{language === 'vi' ? '2. Mục tiêu & Chuẩn đầu ra' : '2. Objectives & Outcomes'}</h3></div>
              <div className="p-6 space-y-10">
                  {/* 2.1 */}
                  <RichNarrativeSection icon={<Target size={20} />} title={language === 'vi' ? '2.1 Mục tiêu chung' : '2.1 General Objectives'} value={moetInfo.generalObjectives[language]} onChange={v => updateMoetLangField('generalObjectives', v)} />
                  
                  {/* 2.2 */}
                  <div className="space-y-4">
                      <div className="flex justify-between items-center">
                          <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Layout size={18} className="text-indigo-600"/>{language === 'vi' ? '2.2 Mục tiêu cụ thể (MOET PLO)' : '2.2 Specific Objectives (MOET PLO)'}</label>
                          <button onClick={addMoetSpecificObjective} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center gap-2"><Plus size={14} /> {language === 'vi' ? 'Thêm' : 'Add'}</button>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {(moetInfo.moetSpecificObjectives || []).map((obj, idx) => (
                            <div key={obj.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3"><div className="w-6 h-6 bg-slate-800 text-white rounded-full flex items-center justify-center font-black text-[10px]">{idx + 1}</div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{language === 'vi' ? 'Mục tiêu cụ thể' : 'Specific Objective'}</span></div>
                                    <button onClick={() => deleteMoetSpecificObjective(obj.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                    <div className="lg:col-span-8"><textarea className="w-full min-h-[60px] p-3 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 transition-colors" value={obj.description[language]} onChange={e => updateMoetSpecificObjectiveDesc(obj.id, e.target.value)} placeholder="..." /></div>
                                    <div className="lg:col-span-4 space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Link2 size={10}/> Linked PEOs</label><div className="flex flex-wrap gap-1">{peos.map(peo => (<button key={peo.id} onClick={() => toggleMoetSpecificObjectivePeo(obj.id, peo.id)} className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${obj.peoIds?.includes(peo.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'}`}>{peo.code}</button>))}</div></div>
                                </div>
                            </div>
                        ))}
                      </div>
                  </div>

                  {/* 2.3 */}
                  <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><CheckSquare size={18} className="text-blue-600"/>{language === 'vi' ? '2.3 Chuẩn đầu ra (Learning Outcomes)' : '2.3 Learning Outcomes'}</label>
                      </div>
                      {CATEGORY_ORDER.map(cat => {
                          const meta = CATEGORY_META[cat];
                          const objs = (moetInfo.specificObjectives || []).filter(o => o.category === cat);
                          return (
                              <div key={cat} className="space-y-2">
                                  <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                                      <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${meta.color}`}>{meta.icon} {language === 'vi' ? meta.vi : meta.en}</span>
                                      <button onClick={() => addObjective(cat)} className="text-xs bg-white border border-slate-200 px-2 py-1 rounded text-slate-500 hover:text-indigo-600 hover:border-indigo-200"><Plus size={12}/></button>
                                  </div>
                                  {objs.map(o => (
                                      <div key={o.id} className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col gap-3">
                                          <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                              <span className="text-xs font-bold text-slate-600">{getObjectiveLabel(o.id)}.</span>
                                              <button onClick={() => deleteObjective(o.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                                          </div>
                                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                              <div className="lg:col-span-8">
                                                  <textarea 
                                                      className="w-full p-3 text-sm bg-slate-50/50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 resize-none min-h-[80px]" 
                                                      value={o.description[language]} 
                                                      onChange={e => updateObjectiveDesc(o.id, e.target.value)} 
                                                      placeholder="..."
                                                  />
                                              </div>
                                              <div className="lg:col-span-4">
                                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-2">
                                                      <Link2 size={10}/> Linked ABET SOs
                                                  </label>
                                                  <div className="flex flex-wrap gap-1">
                                                      {sos.map(so => (
                                                          <button 
                                                              key={so.id} 
                                                              onClick={() => toggleObjectiveSo(o.id, so.id)} 
                                                              className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${o.soIds?.includes(so.id) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-400 border-slate-200 hover:border-emerald-300'}`}
                                                          >
                                                              {so.code}
                                                          </button>
                                                      ))}
                                                  </div>
                                              </div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          );
                      })}
                  </div>
              </div>
          </section>

          {/* Section 3: Detailed Info */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-slate-800 flex items-center gap-2"><FileText size={18} className="text-emerald-600"/>{language === 'vi' ? '3. Thông tin chi tiết' : '3. Detailed Information'}</h3></div>
              <div className="p-6 space-y-8">
                  <RichNarrativeSection icon={<Users size={20} />} title={language === 'vi' ? '5. Đối tượng tuyển sinh' : '5. Admission Target'} value={moetInfo.admissionTarget[language]} onChange={v => updateMoetLangField('admissionTarget', v)} />
                  <RichNarrativeSection icon={<GraduationCap size={20} />} title={language === 'vi' ? '6. Điều kiện tốt nghiệp' : '6. Graduation Requirements'} value={moetInfo.graduationReq[language]} onChange={v => updateMoetLangField('graduationReq', v)} />
                  <RichNarrativeSection icon={<Scale size={20} />} title={language === 'vi' ? '7. Thang điểm' : '7. Grading Scale'} value={moetInfo.gradingScale[language]} onChange={v => updateMoetLangField('gradingScale', v)} />
                  <RichNarrativeSection icon={<Globe size={20} />} title={language === 'vi' ? '12. Các chương trình tham khảo' : '12. Referenced Programs'} value={moetInfo.referencedPrograms[language]} onChange={v => updateMoetLangField('referencedPrograms', v)} />
                  <RichNarrativeSection icon={<BookOpen size={20} />} title={language === 'vi' ? '13. Hướng dẫn thực hiện' : '13. Implementation Guidelines'} value={moetInfo.implementationGuideline[language]} onChange={v => updateMoetLangField('implementationGuideline', v)} />
              </div>
          </section>

          {/* Section 4: Program Structure */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-slate-800 flex items-center gap-2"><BoxSelect size={18} className="text-emerald-600"/>{language === 'vi' ? '4. Cấu trúc chương trình' : '4. Program Structure'}</h3></div>
              <div className="p-6 space-y-8">
                  {[
                      { id: 'gen', title: { vi: 'Kiến thức giáo dục đại cương', en: 'General Education' } },
                      { id: 'fund', title: { vi: 'Kiến thức cơ sở ngành', en: 'Fundamental Engineering' } },
                      { id: 'spec', title: { vi: 'Kiến thức chuyên ngành', en: 'Specialized Engineering' } },
                      { id: 'grad', title: { vi: 'Tốt nghiệp', en: 'Graduation' } }
                  ].map(block => {
                      const idList = moetInfo.programStructure[block.id as keyof typeof moetInfo.programStructure] || [];
                      const subBlocks = (moetInfo.subBlocks || []).filter(sb => sb.parentBlockId === block.id);
                      
                      return (
                          <div key={block.id} className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
                              <h4 className="font-bold text-slate-800 mb-6 text-lg border-b border-slate-100 pb-2">{language === 'vi' ? block.title.vi : block.title.en}</h4>
                              
                              {/* Compulsory Section */}
                              <div className="mb-8">
                                  <h5 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide border-l-4 border-slate-500 pl-2">
                                      {language === 'vi' ? 'Bắt buộc' : 'Compulsory'}
                                  </h5>
                                  <StructureTable 
                                      courseIds={idList}
                                      courses={courses}
                                      language={language}
                                      onRemove={(cid) => removeCourseFromStructure(cid, block.id)}
                                      onAdd={(cid) => addCourseToMainList(cid, block.id)}
                                      onTypeChange={(cid, type) => handleTypeChange(cid, type, block.id)}
                                      onRelationUpdate={updateCourseRelation}
                                      excludeIds={[...idList, ...subBlocks.flatMap(sb => sb.courseIds)]}
                                      theme="slate"
                                  />
                              </div>

                              {/* Electives Section */}
                              <div className="space-y-4">
                                  <div className="flex justify-between items-center mb-2">
                                       <h5 className="text-sm font-bold text-slate-700 uppercase tracking-wide border-l-4 border-amber-500 pl-2">
                                          {language === 'vi' ? 'Tự chọn' : 'Electives'}
                                       </h5>
                                       <button onClick={() => addSubBlock(block.id as any)} className="text-xs bg-amber-50 text-amber-600 font-bold px-3 py-1.5 rounded border border-amber-200 hover:bg-amber-100 flex items-center gap-1">
                                          <Plus size={12}/> {language === 'vi' ? 'Thêm Khối TC' : 'New Block'}
                                       </button>
                                  </div>

                                  {subBlocks.length === 0 && (
                                      <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-lg text-slate-400 text-xs italic">
                                          {language === 'vi' ? 'Chưa có khối tự chọn nào.' : 'No elective blocks defined.'}
                                      </div>
                                  )}

                                  {subBlocks.map(sb => (
                                      <div key={sb.id} className="bg-amber-50/30 rounded-xl border border-amber-200 overflow-hidden shadow-sm">
                                          <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-center gap-3">
                                              <Layers size={16} className="text-amber-500"/>
                                              <input 
                                                  className="flex-1 text-sm font-bold bg-transparent border-b border-transparent focus:border-amber-400 outline-none text-amber-900 placeholder-amber-300" 
                                                  value={sb.name[language]} 
                                                  onChange={e => updateSubBlock(sb.id, { name: { ...sb.name, [language]: e.target.value } })} 
                                                  placeholder="Block Name" 
                                              />
                                              <div className="flex items-center gap-2">
                                                  <span className="text-[10px] font-bold text-amber-600 uppercase">Min Credits:</span>
                                                  <input 
                                                      type="number" 
                                                      className="w-12 text-xs text-center bg-white border border-amber-200 rounded font-bold text-amber-700 focus:ring-1 focus:ring-amber-400 outline-none" 
                                                      value={sb.minCredits} 
                                                      onChange={e => updateSubBlock(sb.id, { minCredits: Number(e.target.value) })} 
                                                  />
                                              </div>
                                              <button onClick={() => deleteSubBlock(sb.id)} className="text-amber-400 hover:text-red-500 ml-2"><Trash2 size={16}/></button>
                                          </div>
                                          
                                          <div className="p-3">
                                              <StructureTable
                                                  courseIds={sb.courseIds}
                                                  courses={courses}
                                                  language={language}
                                                  onRemove={(cid) => removeCourseFromSubBlock(sb.id, cid)}
                                                  onAdd={(cid) => addCourseToSubBlock(sb.id, cid)}
                                                  onTypeChange={(cid, type) => handleTypeChange(cid, type, block.id)}
                                                  onRelationUpdate={updateCourseRelation}
                                                  excludeIds={[...idList, ...subBlocks.flatMap(x => x.courseIds)]}
                                                  theme="amber"
                                              />
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </section>

          {/* Section 5: Program Faculty */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><UserCog size={18} className="text-emerald-600"/>{language === 'vi' ? '5. Danh sách giảng viên' : '5. Program Faculty'}</h3>
                  <button onClick={addProgramFaculty} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center gap-2"><Plus size={14}/> Add</button>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                              <th className="p-3 text-xs font-bold text-slate-500">Name</th>
                              <th className="p-3 text-xs font-bold text-slate-500">Degree</th>
                              <th className="p-3 text-xs font-bold text-slate-500">Position</th>
                              <th className="p-3 text-xs font-bold text-slate-500">Major</th>
                              <th className="p-3 text-xs font-bold text-slate-500">Responsibility</th>
                              <th className="p-3 w-10"></th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {(moetInfo.programFaculty || []).map(f => (
                              <tr key={f.id}>
                                  <td className="p-2"><input className="w-full bg-transparent outline-none" value={f.name} onChange={e => updateProgramFaculty(f.id, 'name', e.target.value)} /></td>
                                  <td className="p-2"><input className="w-full bg-transparent outline-none" value={f.degree} onChange={e => updateProgramFaculty(f.id, 'degree', e.target.value)} /></td>
                                  <td className="p-2"><input className="w-full bg-transparent outline-none" value={f.position} onChange={e => updateProgramFaculty(f.id, 'position', e.target.value)} /></td>
                                  <td className="p-2"><input className="w-full bg-transparent outline-none" value={f.major} onChange={e => updateProgramFaculty(f.id, 'major', e.target.value)} /></td>
                                  <td className="p-2"><input className="w-full bg-transparent outline-none" value={f.responsibility} onChange={e => updateProgramFaculty(f.id, 'responsibility', e.target.value)} /></td>
                                  <td className="p-2 text-center"><button onClick={() => deleteProgramFaculty(f.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </section>

          {/* Section 6: Matrix */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Grid3X3 size={18} className="text-emerald-600"/>{language === 'vi' ? '6. Ma trận Quan hệ CĐR & Học phần' : '6. Outcome-Course Matrix'}</h3></div>
              <div className="overflow-auto custom-scrollbar h-[500px]">
                  <table className="w-full border-collapse text-sm">
                      <thead className="sticky top-0 bg-white z-10 shadow-sm">
                          <tr>
                              <th className="p-3 border-b border-r border-slate-200 text-left bg-slate-50 min-w-[200px] sticky left-0 z-20">Course</th>
                              {sortedObjectives.map(obj => (
                                  <th key={obj.id} className="p-2 border-b border-slate-200 text-center min-w-[40px] text-[10px] font-bold text-slate-600 bg-slate-50 group relative cursor-help">
                                      {getObjectiveLabel(obj.id)}
                                      <div className="absolute hidden group-hover:block z-50 bottom-full left-1/2 -translate-x-1/2 w-48 p-2 bg-slate-800 text-white rounded shadow-lg font-normal text-left">{obj.description[language]}</div>
                                  </th>
                              ))}
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {courses.map(c => (
                              <tr key={c.id} className="hover:bg-slate-50">
                                  <td className="p-3 border-r border-slate-200 sticky left-0 bg-white z-10 font-bold text-slate-700 text-xs">{c.code}</td>
                                  {sortedObjectives.map(obj => {
                                      const key = `${c.id}|${obj.id}`;
                                      const isManual = (moetInfo.courseObjectiveMap || []).includes(key);
                                      const isImplied = impliedCourseObjectiveLinks.has(key);
                                      return (
                                          <td key={obj.id} className={`text-center cursor-pointer border-r border-slate-50 ${isImplied ? 'bg-amber-50' : ''}`} onClick={() => toggleCourseObjective(c.id, obj.id)}>
                                              <div className={`w-4 h-4 mx-auto rounded flex items-center justify-center ${isManual ? 'bg-indigo-600 text-white' : (isImplied ? 'bg-amber-400 text-white' : 'border border-slate-200')}`}>
                                                  {(isManual || isImplied) && <Check size={10}/>}
                                              </div>
                                          </td>
                                      );
                                  })}
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </section>
      </div>
    </div>
  );
};

// --- Helper Components Definitions ---

const InputField = ({ label, value, onChange, placeholder }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</label>
    <input 
      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

const RichNarrativeSection = ({ icon, title, value, onChange }: { icon: React.ReactNode, title: string, value: string, onChange: (v: string) => void }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
        {icon}
      </div>
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
    </div>
    <RichTextEditor value={value} onChange={onChange} />
  </div>
);

export default TransformationModule;
