
import React, { useMemo, useState, useRef, useEffect, memo } from 'react';
import { AppState, IRM, Course, Language, MoetSubBlock } from '../types';
import { TRANSLATIONS } from '../constants';
import { BarChart3, Download, Check, PieChart, ListChecks, Grid3X3, Filter, Book, Trash2, Star, Plus, Sparkles, ChevronDown, ChevronUp, Search, FileSpreadsheet, Globe, ArrowRight, Layers, Palette, ShieldCheck, Circle, X, Save, BoxSelect, FolderOpen } from 'lucide-react';
import { translateCourses } from '../services/geminiService';
import AILoader from '../components/AILoader';

interface Props {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const AREA_HEX_COLORS: Record<string, string> = {
  'blue': '#3b82f6',
  'indigo': '#6366f1',
  'purple': '#a855f7',
  'green': '#22c55e',
  'slate': '#64748b',
  'red': '#ef4444',
  'orange': '#f97316',
  'yellow': '#eab308'
};

// --- OPTIMIZATION: Memoized Component to prevent unnecessary re-renders ---
const RelationSelector = memo(({ 
    course, 
    type, 
    allCourses, 
    value, 
    onChange, 
    isActive, 
    onToggle, 
    onClose, 
    language
}: {
    course: Course,
    type: 'prereq' | 'coreq',
    allCourses: Course[],
    value: string[],
    onChange: (val: string[]) => void,
    isActive: boolean,
    onToggle: () => void,
    onClose: () => void,
    language: Language
}) => {
    const [search, setSearch] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Filter candidates based on logic
    const candidates = useMemo(() => allCourses.filter((c: Course) => {
        if (c.id === course.id) return false; // Cannot select self
        if (type === 'prereq') return c.semester < course.semester; // Must be previous semester
        if (type === 'coreq') return c.semester === course.semester; // Must be same semester
        return false;
    }).filter((c: Course) => {
        const searchText = search.toLowerCase();
        // Safe check for null/undefined strings
        return (c.code || '').toLowerCase().includes(searchText) || (c.name[language] || '').toLowerCase().includes(searchText);
    }), [allCourses, course, type, search, language]);

    useEffect(() => {
        if (isActive && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isActive]);

    return (
        <div className="relative w-full">
            <div 
                onClick={onToggle}
                className="min-h-[32px] p-1.5 border-b border-transparent hover:border-indigo-300 cursor-pointer flex flex-wrap gap-1 transition-all text-xs items-center group"
            >
                {value.length === 0 && <span className="text-slate-300 italic opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"><Plus size={10}/> Select</span>}
                {value.map((code: string) => (
                    <span key={code} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200 font-bold text-[10px] flex items-center gap-1">
                        {code}
                    </span>
                ))}
            </div>

            {isActive && (
                <>
                    <div className="fixed inset-0 z-40 cursor-default" onClick={onClose}></div>
                    <div className="absolute top-full left-0 w-72 bg-white border border-slate-200 shadow-xl rounded-lg z-50 p-2 mt-1 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100">
                        <div className="relative">
                             <Search size={12} className="absolute left-2 top-2 text-slate-400"/>
                             <input 
                                ref={inputRef}
                                className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                placeholder={language === 'vi' ? 'Tìm môn học...' : 'Search courses...'}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                             />
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                            {candidates.map((c: Course) => {
                                const isSelected = value.includes(c.code);
                                return (
                                    <div 
                                        key={c.id} 
                                        className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                        onClick={() => {
                                            const newValue = isSelected 
                                                ? value.filter((v: string) => v !== c.code)
                                                : [...value, c.code];
                                            onChange(newValue);
                                        }}
                                    >
                                        <div className={`w-3.5 h-3.5 border rounded flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                                            {isSelected && <Check size={10} className="text-white" />}
                                        </div>
                                        <span className="font-bold w-16 shrink-0">{c.code}</span>
                                        <span className="truncate flex-1 opacity-75" title={c.name[language]}>{c.name[language]}</span>
                                    </div>
                                )
                            })}
                            {candidates.length === 0 && <div className="text-center text-slate-400 text-[10px] py-4 italic">
                                {language === 'vi' ? 'Không tìm thấy môn phù hợp' : 'No matching courses found'}
                            </div>}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
});

const MappingModule: React.FC<Props> = ({ state, updateState }) => {
  const { courses, sos, courseSoMap, coursePiMap, language, knowledgeAreas, geminiConfig, generalInfo } = state;
  const t = TRANSLATIONS[language];
  
  const [activeTab, setActiveTab] = useState<'catalog' | 'so' | 'pi' | 'areas'>('catalog');
  const [filterArea, setFilterArea] = useState<string>('all');
  const [filterEssential, setFilterEssential] = useState<boolean>(false); 
  const [searchQuery, setSearchQuery] = useState('');
  const [showStats, setShowStats] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  const [statsScope, setStatsScope] = useState<'all' | 'abet'>('all');
  
  // Add Course Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCourseData, setNewCourseData] = useState<Partial<Course>>({
      code: '',
      name: { vi: '', en: '' },
      credits: 3,
      semester: 1,
      knowledgeAreaId: knowledgeAreas[0]?.id || 'other',
      type: 'REQUIRED',
      isEssential: false,
      isAbet: false
  });

  // Elective Block Selection Modal State
  const [electiveModalData, setElectiveModalData] = useState<{
      courseId: string;
      newType: 'SELECTED_ELECTIVE' | 'ELECTIVE';
  } | null>(null);
  const [newBlockName, setNewBlockName] = useState({ vi: '', en: '' });
  const [newBlockParent, setNewBlockParent] = useState<'gen' | 'fund' | 'spec'>('spec');

  // Hard Refresh Mechanisms to fix Ghosting
  const [tableVersion, setTableVersion] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // State for active relation editor (Prereq/Coreq)
  const [activeRel, setActiveRel] = useState<{ id: string, type: 'prereq' | 'coreq' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Optimization: O(1) Lookup Maps ---
  const soMappingLookup = useMemo(() => {
      const map = new Map<string, IRM>(); // Key: "courseId-soId", Value: Level
      (courseSoMap || []).forEach(m => {
          map.set(`${m.courseId}-${m.soId}`, m.level);
      });
      return map;
  }, [courseSoMap]);

  const courseMappedSoLookup = useMemo(() => {
      const map = new Map<string, Set<string>>(); // Key: CourseId, Value: Set<SoId>
      (courseSoMap || []).forEach(m => {
          if (m.level !== IRM.NONE) {
              if (!map.has(m.courseId)) map.set(m.courseId, new Set());
              map.get(m.courseId)!.add(m.soId);
          }
      });
      return map;
  }, [courseSoMap]);

  const piMappingLookup = useMemo(() => {
      const set = new Set<string>(); // Key: "courseId-piId"
      (coursePiMap || []).forEach(m => {
          set.add(`${m.courseId}-${m.piId}`);
      });
      return set;
  }, [coursePiMap]);

  const courseMap = useMemo(() => new Map(courses.map(c => [c.id, c])), [courses]);

  // Filter & Sort Logic applies to ALL views (Catalog, Matrices)
  const filteredCourses = useMemo(() => {
      let result = courses;
      
      // Global Scope Filter (ABET vs All)
      if (statsScope === 'abet') {
          result = result.filter(c => c.isAbet);
      }

      if (filterArea !== 'all') result = result.filter(c => c.knowledgeAreaId === filterArea);
      if (filterEssential) result = result.filter(c => c.isEssential);
      if (searchQuery) {
          const lower = searchQuery.toLowerCase();
          result = result.filter(c => (c.code || '').toLowerCase().includes(lower) || (c.name[language] || '').toLowerCase().includes(lower));
      }
      return result.sort((a, b) => {
          if (a.semester !== b.semester) return a.semester - b.semester;
          return a.code.localeCompare(b.code);
      });
  }, [courses, filterArea, filterEssential, searchQuery, language, statsScope]);

  // --- HELPER: Force Hard Refresh ---
  const triggerRefresh = (callback: () => void) => {
      setIsRefreshing(true);
      setTimeout(() => {
          callback();
          setTableVersion(prev => prev + 1);
          setIsRefreshing(false);
      }, 500);
  };

  // --- LOGIC: Course Type Change & Block Assignment ---
  const handleCourseTypeChange = (courseId: string, newType: string) => {
      const course = courses.find(c => c.id === courseId);
      if (!course) return;

      if (newType === 'REQUIRED') {
          // 1. Update Course Type
          // 2. Remove from ALL sub-blocks
          // 3. Add to Main List (based on mapped Knowledge Area -> Block ID guess)
          updateState(prev => {
              const nextCourses = prev.courses.map(c => c.id === courseId ? { ...c, type: 'REQUIRED' as const } : c);
              
              // Remove from sub-blocks
              const nextSubBlocks = (prev.generalInfo.moetInfo.subBlocks || []).map(sb => ({
                  ...sb,
                  courseIds: sb.courseIds.filter(id => id !== courseId)
              }));

              // Infer Parent Block from Knowledge Area
              let parentBlockId: 'gen' | 'fund' | 'spec' = 'spec';
              if (course.knowledgeAreaId === 'gen_ed') parentBlockId = 'gen';
              else if (course.knowledgeAreaId === 'fund_eng' || course.knowledgeAreaId === 'math_sci') parentBlockId = 'fund';

              const currentList = prev.generalInfo.moetInfo.programStructure[parentBlockId] || [];
              // Only add if not already there to avoid dupes
              const nextList = currentList.includes(courseId) ? currentList : [...currentList, courseId];

              return {
                  ...prev,
                  courses: nextCourses,
                  generalInfo: {
                      ...prev.generalInfo,
                      moetInfo: {
                          ...prev.generalInfo.moetInfo,
                          subBlocks: nextSubBlocks,
                          programStructure: {
                              ...prev.generalInfo.moetInfo.programStructure,
                              [parentBlockId]: nextList
                          }
                      }
                  }
              };
          });
      } else {
          // Open Modal for Elective Assignment
          setElectiveModalData({ courseId, newType: newType as any });
          setNewBlockName({ vi: 'Khối tự chọn mới', en: 'New Elective Block' });
          // Default parent based on course KA
          if (course.knowledgeAreaId === 'gen_ed') setNewBlockParent('gen');
          else if (course.knowledgeAreaId === 'fund_eng' || course.knowledgeAreaId === 'math_sci') setNewBlockParent('fund');
          else setNewBlockParent('spec');
      }
  };

  const confirmAddToBlock = (blockId: string) => {
      if (!electiveModalData) return;
      const { courseId, newType } = electiveModalData;

      updateState(prev => {
          // 1. Update Course Type
          const nextCourses = prev.courses.map(c => c.id === courseId ? { ...c, type: newType } : c);

          // 2. Add to Target Block & Remove from others
          const nextSubBlocks = (prev.generalInfo.moetInfo.subBlocks || []).map(sb => {
              // Remove if present in other blocks to prevent duplicates
              const cleanIds = sb.courseIds.filter(id => id !== courseId);
              if (sb.id === blockId) {
                  return { ...sb, courseIds: [...cleanIds, courseId] };
              }
              return { ...sb, courseIds: cleanIds };
          });

          // 3. Remove from Main Lists (gen/fund/spec/grad)
          const cleanStructure = { ...prev.generalInfo.moetInfo.programStructure };
          (Object.keys(cleanStructure) as Array<keyof typeof cleanStructure>).forEach(key => {
              cleanStructure[key] = cleanStructure[key].filter(id => id !== courseId);
          });

          return {
              ...prev,
              courses: nextCourses,
              generalInfo: {
                  ...prev.generalInfo,
                  moetInfo: {
                      ...prev.generalInfo.moetInfo,
                      subBlocks: nextSubBlocks,
                      programStructure: cleanStructure
                  }
              }
          };
      });
      setElectiveModalData(null);
  };

  const createAndAddToBlock = () => {
      if (!electiveModalData) return;
      const { courseId, newType } = electiveModalData;
      const newBlockId = `sb-${Date.now()}`;

      const newBlock: MoetSubBlock = {
          id: newBlockId,
          name: newBlockName,
          parentBlockId: newBlockParent,
          minCredits: 3,
          courseIds: [courseId],
          note: { vi: '', en: '' }
      };

      updateState(prev => {
          const nextCourses = prev.courses.map(c => c.id === courseId ? { ...c, type: newType } : c);
          
          // Remove from other sub-blocks first
          const cleanedSubBlocks = (prev.generalInfo.moetInfo.subBlocks || []).map(sb => ({
              ...sb,
              courseIds: sb.courseIds.filter(id => id !== courseId)
          }));

          // Remove from Main Lists
          const cleanStructure = { ...prev.generalInfo.moetInfo.programStructure };
          (Object.keys(cleanStructure) as Array<keyof typeof cleanStructure>).forEach(key => {
              cleanStructure[key] = cleanStructure[key].filter(id => id !== courseId);
          });

          return {
              ...prev,
              courses: nextCourses,
              generalInfo: {
                  ...prev.generalInfo,
                  moetInfo: {
                      ...prev.generalInfo.moetInfo,
                      subBlocks: [...cleanedSubBlocks, newBlock],
                      programStructure: cleanStructure
                  }
              }
          };
      });
      setElectiveModalData(null);
  };

  const updateSubBlockMinCredits = (blockId: string, credits: number) => {
      updateState(prev => {
          const nextSubBlocks = (prev.generalInfo.moetInfo.subBlocks || []).map(sb => 
              sb.id === blockId ? { ...sb, minCredits: credits } : sb
          );
          return {
              ...prev,
              generalInfo: {
                  ...prev.generalInfo,
                  moetInfo: {
                      ...prev.generalInfo.moetInfo,
                      subBlocks: nextSubBlocks
                  }
              }
          };
      });
  };

  // --- CATALOG FUNCTIONS ---
  const handleSaveNewCourse = () => {
      if (!newCourseData.code || !newCourseData.name?.vi) {
          alert(language === 'vi' ? 'Vui lòng nhập Mã môn và Tên môn học' : 'Please enter Course Code and Name');
          return;
      }

      const newCourse: Course = {
        id: `CID-${Date.now()}`,
        code: newCourseData.code || 'NEW',
        name: newCourseData.name || { vi: '', en: '' },
        credits: newCourseData.credits || 3,
        isEssential: newCourseData.isEssential || false,
        isAbet: newCourseData.isAbet || false,
        type: newCourseData.type || 'REQUIRED',
        knowledgeAreaId: newCourseData.knowledgeAreaId || 'other',
        semester: newCourseData.semester || 1,
        colIndex: 0,
        prerequisites: [],
        coRequisites: [],
        description: { vi: '', en: '' },
        textbooks: [],
        clos: { vi: [], en: [] },
        topics: [],
        assessmentPlan: [],
        instructorIds: [],
        instructorDetails: {},
        cloMap: []
      };

      updateState(prev => ({ ...prev, courses: [...prev.courses, newCourse] }));
      
      // If adding as Elective immediately, trigger modal logic or default?
      // For simplicity, just add. User can change type in table to trigger modal if needed.
      
      setIsAddModalOpen(false);
      setNewCourseData({ code: '', name: { vi: '', en: '' }, credits: 3, semester: 1, knowledgeAreaId: knowledgeAreas[0]?.id || 'other', type: 'REQUIRED', isEssential: false, isAbet: false });
  };

  const deleteCourse = (id: string) => {
    if(confirm(language === 'vi' ? 'Xóa môn học này?' : 'Delete this course?')) {
        triggerRefresh(() => {
            updateState(prev => ({ ...prev, courses: prev.courses.filter(c => c.id !== id) }));
        });
    }
  };

  const updateCourse = (id: string, field: keyof Course, value: any) => {
    updateState(prev => ({
        ...prev,
        courses: prev.courses.map(c => {
            if (c.id === id) {
                const updates: any = { [field]: value };
                if (field === 'isEssential' && value === true) {
                    updates.isAbet = true;
                }
                return { ...c, ...updates };
            }
            return c;
        })
    }));
  };

  const updateCourseName = (id: string, lang: Language, val: string) => {
    updateState(prev => ({ ...prev, courses: prev.courses.map(c => c.id === id ? { ...c, name: { ...c.name, [lang]: val } } : c) }));
  };

  const handleExportCatalog = () => {
    const headers = ['ID', 'Code', 'Name_VI', 'Name_EN', 'Credits', 'Semester', 'Type', 'Prerequisites', 'Co-requisite', 'Essential', 'ABET', 'AreaID'];
    const rows = courses.map(c => [
        c.id, c.code, `"${c.name.vi}"`, `"${c.name.en}"`, c.credits, c.semester,
        c.type,
        `"${c.prerequisites.join(', ')}"`, `"${c.coRequisites.join(', ')}"`,
        c.isEssential ? 1 : 0, c.isAbet ? 1 : 0, c.knowledgeAreaId
    ]);
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Course_Catalog_${language}.csv`;
    link.click();
  };

  const handleImportCatalog = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const text = evt.target?.result as string;
        const lines = text.split('\n');
        const newCourses: Course[] = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.trim().replace(/^"|"$/g, ''));
            if (cols.length < 5) continue;

            // Detect Old vs New Format by parsing column 6 (Index 6)
            // Old Format: [..., Semester, Prerequisites, ...] (Index 6 is Prereqs)
            // New Format: [..., Semester, Type, Prerequisites, ...] (Index 6 is Type)
            
            let typeVal: any = 'REQUIRED';
            let prereqsVal = '';
            let coreqsVal = '';
            let essentialVal = '';
            let abetVal = '';
            let areaIdVal = '';

            const potentialType = cols[6] ? cols[6].toUpperCase() : '';
            const isNewFormat = ['REQUIRED', 'ELECTIVE', 'SELECTED_ELECTIVE'].includes(potentialType);

            if (isNewFormat) {
                typeVal = potentialType;
                prereqsVal = cols[7];
                coreqsVal = cols[8];
                essentialVal = cols[9];
                abetVal = cols[10];
                areaIdVal = cols[11];
            } else {
                // Backward compatibility
                prereqsVal = cols[6];
                coreqsVal = cols[7];
                essentialVal = cols[8];
                abetVal = cols[9];
                areaIdVal = cols[10];
            }

            const [id, code, nameVi, nameEn, credits, semester] = cols;
            
            const isEssential = essentialVal === '1' || essentialVal === 'true';
            const isAbet = abetVal !== undefined ? (abetVal === '1' || abetVal === 'true') : isEssential;

            newCourses.push({
                id: id || `CID-${Date.now()}-${i}`,
                code: code || 'NEW',
                name: { vi: nameVi || '', en: nameEn || '' },
                credits: parseInt(credits) || 0,
                semester: parseInt(semester) || 1,
                type: typeVal,
                prerequisites: prereqsVal ? prereqsVal.split(',').map(s => s.trim()).filter(Boolean) : [],
                coRequisites: coreqsVal ? coreqsVal.split(',').map(s => s.trim()).filter(Boolean) : [],
                isEssential: isEssential,
                isAbet: isAbet,
                knowledgeAreaId: areaIdVal || 'other',
                colIndex: 0,
                description: { vi: '', en: '' },
                textbooks: [],
                clos: { vi: [], en: [] },
                topics: [],
                assessmentPlan: [],
                instructorIds: [],
                instructorDetails: {},
                cloMap: []
            });
        }
        if (newCourses.length > 0) {
            if (confirm(language === 'vi' ? `Tìm thấy ${newCourses.length} môn học. Cập nhật thông tin (Credits, Type, Pre-req...) cho môn đã có và thêm môn mới?` : `Found ${newCourses.length} courses. Update info (Credits, Type, Pre-req...) for existing and add new ones?`)) {
                 triggerRefresh(() => updateState(prev => {
                     const importMap = new Map(newCourses.map(c => [c.id, c]));
                     
                     // 1. Update existing
                     const updatedCourses = prev.courses.map(existing => {
                         const incoming = importMap.get(existing.id);
                         if (incoming) {
                             return {
                                 ...existing,
                                 // Fields allowed to update from CSV
                                 code: incoming.code,
                                 name: incoming.name,
                                 credits: incoming.credits,
                                 semester: incoming.semester,
                                 type: incoming.type,
                                 prerequisites: incoming.prerequisites,
                                 coRequisites: incoming.coRequisites,
                                 isEssential: incoming.isEssential,
                                 isAbet: incoming.isAbet,
                                 knowledgeAreaId: incoming.knowledgeAreaId
                                 // Preserved fields: description, textbooks, clos, topics, assessmentPlan, instructorIds, instructorDetails, cloMap
                             };
                         }
                         return existing;
                     });

                     // 2. Add truly new
                     const existingIds = new Set(prev.courses.map(c => c.id));
                     const trulyNew = newCourses.filter(c => !existingIds.has(c.id));

                     return { ...prev, courses: [...updatedCourses, ...trulyNew] };
                 }));
            }
        }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAutoTranslateCatalog = async () => {
      setIsTranslating(true);
      try {
          const targetLang = language === 'vi' ? 'en' : 'vi';
          const coursesToTranslate = courses.filter(c => !c.name[targetLang]);
          if (coursesToTranslate.length === 0) return;
          const translatedPairs = await translateCourses(coursesToTranslate, targetLang, geminiConfig);
          updateState(prev => ({
              ...prev,
              courses: prev.courses.map(c => {
                  const translation = translatedPairs.find(p => p.id === c.id);
                  if (translation) return { ...c, name: { ...c.name, [targetLang]: translation.name } };
                  return c;
              })
          }));
      } catch (error) {
          console.error(error);
          alert("Translation failed.");
      } finally {
          setIsTranslating(false);
      }
  };

  // --- MAPPING FUNCTIONS ---
  const toggleMapping = (courseId: string, soId: string) => {
    updateState(prev => {
      const currentMap = prev.courseSoMap || [];
      const existing = currentMap.find(m => m.courseId === courseId && m.soId === soId);
      let newMap = [...currentMap];
      if (existing) {
        const nextLevel = existing.level === IRM.I ? IRM.R : (existing.level === IRM.R ? IRM.M : IRM.NONE);
        if (nextLevel === IRM.NONE) {
          newMap = newMap.filter(m => !(m.courseId === courseId && m.soId === soId));
        } else {
          newMap = newMap.map(m => (m.courseId === courseId && m.soId === soId) ? { ...m, level: nextLevel } : m);
        }
      } else {
        newMap.push({ courseId, soId, level: IRM.I });
      }
      return { ...prev, courseSoMap: newMap };
    });
  };

  const togglePiMapping = (courseId: string, piId: string) => {
    updateState(prev => {
      const currentMap = prev.coursePiMap || [];
      const exists = currentMap.find(m => m.courseId === courseId && m.piId === piId);
      const newMap = exists 
        ? currentMap.filter(m => !(m.courseId === courseId && m.piId === piId)) 
        : [...currentMap, { courseId, piId }];
      return { ...prev, coursePiMap: newMap };
    });
  };

  // --- STATS LOGIC ---
  const stats = useMemo(() => {
    // 1. Filter courses based on the statsScope toggle
    const targetCourses = statsScope === 'abet' 
        ? courses.filter(c => c.isAbet) 
        : courses;
    
    // Create a Set of target course IDs for fast lookup
    const targetCourseIds = new Set(targetCourses.map(c => c.id));

    const areaMap = new Map<string, number>();
    const semesterMap = new Map<number, { total: number, areas: Record<string, number> }>();
    let totalCredits = 0;
    
    knowledgeAreas.forEach(k => areaMap.set(k.id, 0));
    
    targetCourses.forEach(c => {
        const areaId = c.knowledgeAreaId;
        areaMap.set(areaId, (areaMap.get(areaId) || 0) + c.credits);
        totalCredits += c.credits;
        
        if (!semesterMap.has(c.semester)) semesterMap.set(c.semester, { total: 0, areas: {} });
        const semData = semesterMap.get(c.semester)!;
        semData.total += c.credits;
        semData.areas[areaId] = (semData.areas[areaId] || 0) + c.credits;
    });

    const areaData = knowledgeAreas.map(k => ({
        id: k.id, name: k.name, color: k.color, value: areaMap.get(k.id) || 0,
        percentage: totalCredits > 0 ? ((areaMap.get(k.id) || 0) / totalCredits) * 100 : 0
    })).sort((a, b) => b.value - a.value);

    const semesterData = Array.from(semesterMap.entries())
        .map(([semester, data]) => ({ semester, ...data }))
        .sort((a, b) => a.semester - b.semester);
    
    const maxSemCredits = Math.max(...semesterData.map(d => d.total), 0);

    const soCoverage = sos.map(so => {
        const mappings = courseSoMap.filter(m => 
            m.soId === so.id && 
            m.level !== IRM.NONE && 
            targetCourseIds.has(m.courseId)
        );
        return {
            id: so.id, 
            code: so.code, 
            count: mappings.length,
            credits: mappings.reduce((sum, m) => sum + (courseMap.get(m.courseId)?.credits || 0), 0)
        };
    });

    return { totalCredits, areaData, semesterData, maxSemCredits, soCoverage };
  }, [courses, knowledgeAreas, sos, courseSoMap, courseMap, statsScope]);

  const exportMatrixCSV = () => {
      let headers: string[] = [], rows: string[][] = [], filename = '', footer = '';
      if (activeTab === 'so') {
          headers = ['Course Code', 'Course Name', ...sos.map(s => s.code)];
          rows = filteredCourses.map(c => [
              c.code, `"${c.name[language]}"`,
              ...sos.map(so => soMappingLookup.get(`${c.id}-${so.id}`) || '')
          ]);
          filename = `curriculum_matrix_SO_${language}.csv`;
          footer = '\n\n"Legend / Chú thích:"\n"I","Introduce / Giới thiệu"\n"R","Reinforce / Củng cố"\n"M","Master / Thuần thục"';
      } else if (activeTab === 'pi') {
          const allPis = sos.flatMap(s => s.pis);
          headers = ['Course Code', 'Course Name', ...allPis.map(p => p.code)];
          rows = filteredCourses.map(c => [
              c.code, `"${c.name[language]}"`,
              ...allPis.map(pi => piMappingLookup.has(`${c.id}-${pi.id}`) ? 'X' : '')
          ]);
          filename = `curriculum_matrix_PI_${language}.csv`;
      } else return;
      
      const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n') + footer;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
  };

  // --- DISPLAY LOGIC FOR CATALOG ---
  const organizedCatalog = useMemo(() => {
      const subBlocks = generalInfo.moetInfo.subBlocks || [];
      const blockMap = new Map<string, string>(); // CourseID -> BlockID
      subBlocks.forEach(sb => sb.courseIds.forEach(id => blockMap.set(id, sb.id)));

      // 1. Courses that are NOT in any block (Standard display)
      const standaloneCourses = filteredCourses.filter(c => !blockMap.has(c.id));

      // 2. Courses that ARE in blocks, grouped by Block
      const blockGroups = subBlocks.map(sb => {
          // Get courses belonging to this block
          const innerCourses = courses.filter(c => sb.courseIds.includes(c.id));
          
          // Filter inner courses based on the *global* search/filter (filteredCourses)
          const visibleInnerCourses = innerCourses.filter(c => 
              filteredCourses.some(fc => fc.id === c.id)
          );

          return {
              block: sb,
              courses: visibleInnerCourses
          };
      }).filter(group => group.courses.length > 0); // Only show blocks that have visible courses

      // Sort blocks by semester of the first course (approximate location)
      blockGroups.sort((a, b) => {
          const semA = a.courses.length > 0 ? Math.min(...a.courses.map(c => c.semester)) : 99;
          const semB = b.courses.length > 0 ? Math.min(...b.courses.map(c => c.semester)) : 99;
          return semA - semB;
      });

      return { standaloneCourses, blockGroups };
  }, [filteredCourses, generalInfo.moetInfo.subBlocks, courses]);

  // --- VIEWS ---
  const renderCatalogRow = (course: Course, isInner: boolean = false) => (
      <tr key={course.id} className={`hover:bg-slate-50 transition-colors group ${isInner ? 'bg-slate-50/30' : ''}`}>
          <td className={`px-6 py-3 ${isInner ? 'pl-10' : ''}`}>
              <input className={`font-mono font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none w-full ${isInner ? 'text-xs text-slate-500 italic' : 'text-indigo-600'}`} value={course.code} onChange={(e) => updateCourse(course.id, 'code', e.target.value)} />
          </td>
          <td className="px-6 py-3">
              <input className={`font-medium bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none w-full ${isInner ? 'text-xs text-slate-500 italic pl-2' : 'text-slate-700'}`} value={course.name[language]} onChange={(e) => updateCourseName(course.id, language, e.target.value)} />
          </td>
          <td className="px-6 py-3 text-center">
              <input type="number" className={`w-12 text-center px-2 py-1 rounded text-sm font-bold border-transparent focus:border-indigo-500 outline-none ${isInner ? 'bg-slate-100/50 text-slate-500' : 'bg-slate-100'}`} value={course.credits} onChange={(e) => updateCourse(course.id, 'credits', parseInt(e.target.value) || 0)} />
          </td>
          <td className="px-6 py-3 text-center">
              <input type="number" className={`w-12 text-center px-2 py-1 rounded text-sm font-bold border-transparent focus:border-indigo-500 outline-none ${isInner ? 'bg-slate-100/50 text-slate-500' : 'bg-slate-100'}`} value={course.semester} onChange={(e) => updateCourse(course.id, 'semester', parseInt(e.target.value) || 1)} />
          </td>
          <td className="px-6 py-3">
              <select 
                  className={`bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none text-xs font-bold w-full cursor-pointer ${isInner ? 'text-slate-400 italic' : 'text-slate-700'}`}
                  value={course.type}
                  onChange={(e) => handleCourseTypeChange(course.id, e.target.value)}
              >
                  <option value="REQUIRED">{language === 'vi' ? 'Bắt buộc' : 'Required'}</option>
                  <option value="SELECTED_ELECTIVE">{language === 'vi' ? 'TC Định hướng' : 'Selected Elective'}</option>
                  <option value="ELECTIVE">{language === 'vi' ? 'Tự chọn' : 'Free Elective'}</option>
              </select>
          </td>
          <td className="px-6 py-3">
              <RelationSelector course={course} type="prereq" allCourses={courses} value={course.prerequisites} onChange={val => updateCourse(course.id, 'prerequisites', val)} isActive={activeRel?.id === course.id && activeRel?.type === 'prereq'} onToggle={() => setActiveRel(activeRel?.id === course.id && activeRel?.type === 'prereq' ? null : { id: course.id, type: 'prereq' })} onClose={() => setActiveRel(null)} language={language} />
          </td>
          <td className="px-6 py-3">
              <RelationSelector course={course} type="coreq" allCourses={courses} value={course.coRequisites} onChange={val => updateCourse(course.id, 'coRequisites', val)} isActive={activeRel?.id === course.id && activeRel?.type === 'coreq'} onToggle={() => setActiveRel(activeRel?.id === course.id && activeRel?.type === 'coreq' ? null : { id: course.id, type: 'coreq' })} onClose={() => setActiveRel(null)} language={language} />
          </td>
          <td className="px-6 py-3 text-center">
              <button onClick={() => updateCourse(course.id, 'isEssential', !course.isEssential)} className={`transition-colors ${course.isEssential ? 'text-amber-500 hover:text-amber-600' : 'text-slate-200 hover:text-amber-300'}`}><Star size={18} fill={course.isEssential ? "currentColor" : "none"} /></button>
          </td>
          <td className="px-6 py-3 text-center">
              <button onClick={() => updateCourse(course.id, 'isAbet', !course.isAbet)} className={`transition-transform hover:scale-110`}>
                  <Circle size={18} 
                      color={course.isAbet ? "#ff6c2c" : "#cbd5e1"} 
                      fill={course.isAbet ? "#ff6c2c" : "none"} 
                      strokeWidth={2}
                  />
              </button>
          </td>
          <td className="px-6 py-3">
              <select className={`text-xs px-2 py-1.5 rounded border-transparent focus:ring-2 focus:ring-indigo-500 outline-none w-full font-bold cursor-pointer ${isInner ? 'bg-slate-100 text-slate-500 italic' : 'bg-indigo-50 text-indigo-700'}`} value={course.knowledgeAreaId} onChange={(e) => updateCourse(course.id, 'knowledgeAreaId', e.target.value)}>
                  {knowledgeAreas.map(k => <option key={k.id} value={k.id}>{k.name[language]}</option>)}
              </select>
          </td>
          <td className="px-6 py-3 text-center space-x-3"><button onClick={() => deleteCourse(course.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button></td>
      </tr>
  );

  const renderCatalog = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-350px)]">
        <div className="overflow-auto custom-scrollbar flex-1 relative">
            <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 shadow-sm">
                    <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase w-32">Code</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Name ({language.toUpperCase()})</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center w-24">{t.credits}</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center w-24">{t.semester}</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase w-40">{language === 'vi' ? 'Loại' : 'Type'}</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase w-48">{t.prerequisites}</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase w-48">{t.coRequisites}</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center w-24">{t.essential}</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center w-24">ABET</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase w-48">{t.knowledgeArea}</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center w-24">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {/* Render Standalone Courses First */}
                    {organizedCatalog.standaloneCourses.map(course => renderCatalogRow(course, false))}

                    {/* Render Block Groups */}
                    {organizedCatalog.blockGroups.map(group => (
                        <React.Fragment key={group.block.id}>
                            {/* Block Header Row */}
                            <tr className="bg-indigo-50/60 border-b border-indigo-100">
                                <td className="px-6 py-3 flex items-center justify-center text-indigo-400">
                                    <Layers size={18}/>
                                </td>
                                <td className="px-6 py-3">
                                    <div className="font-bold text-indigo-800 text-sm">{group.block.name[language]}</div>
                                </td>
                                <td className="px-6 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1 bg-white px-2 py-1.5 rounded-lg border border-indigo-100 shadow-sm w-fit mx-auto group/input">
                                        <span className="text-[10px] font-bold text-indigo-400 uppercase select-none">Min</span>
                                        <input 
                                            type="number" 
                                            className="w-10 text-center text-xs font-bold text-indigo-700 outline-none bg-transparent hover:bg-indigo-50 focus:bg-indigo-50 rounded transition-colors"
                                            value={group.block.minCredits}
                                            onChange={(e) => updateSubBlockMinCredits(group.block.id, parseInt(e.target.value) || 0)}
                                            onClick={(e) => e.stopPropagation()} // Prevent row click if any
                                        />
                                    </div>
                                </td>
                                <td colSpan={1} className="px-6 py-3 text-center">
                                    <span className="text-xs text-indigo-400 italic">--</span>
                                </td>
                                <td className="px-6 py-3">
                                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{language === 'vi' ? 'Khối Tự Chọn' : 'Elective Block'}</span>
                                </td>
                                <td colSpan={6} className="px-6 py-3"></td>
                            </tr>
                            
                            {/* Inner Courses */}
                            {group.courses.map(course => renderCatalogRow(course, true))}
                        </React.Fragment>
                    ))}

                    {filteredCourses.length === 0 && <tr><td colSpan={11} className="text-center py-10 text-slate-400 italic">No courses found matching filter.</td></tr>}
                </tbody>
            </table>
        </div>
    </div>
  );

  const renderKnowledgeAreas = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-350px)] animate-in fade-in">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2"><Layers size={16} className="text-indigo-600"/> {t.knowledgeAreaTable}</h3>
            <button onClick={() => {
                const newId = `KA-${Date.now()}`;
                triggerRefresh(() => updateState(prev => ({ ...prev, knowledgeAreas: [...prev.knowledgeAreas, { id: newId, name: { vi: 'Khối mới', en: 'New Area' }, color: 'slate' }] })));
            }} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-indigo-700"><Plus size={14} /> {t.addArea}</button>
        </div>
        <div className="overflow-auto p-6">
            <div className="grid grid-cols-1 gap-4 max-w-4xl mx-auto">
                {knowledgeAreas.map((area, idx) => (
                    <div key={area.id} className="flex gap-4 items-center bg-slate-50 p-4 rounded-xl border border-slate-200 group hover:border-indigo-300 transition-colors">
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: AREA_HEX_COLORS[area.color] || '#cbd5e1' }}><Layers size={20} className="text-white" /></div>
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">ID</label><input className="w-full text-xs font-mono font-bold bg-slate-200 text-slate-500 border border-transparent rounded px-2 py-1.5" value={area.id} disabled /></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Name (VI)</label><input className="w-full text-sm font-bold bg-white border border-slate-200 rounded px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none" value={area.name.vi} onChange={(e) => { const next = [...knowledgeAreas]; next[idx].name.vi = e.target.value; updateState(prev => ({ ...prev, knowledgeAreas: next })); }} /></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Name (EN)</label><input className="w-full text-sm font-bold bg-white border border-slate-200 rounded px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none" value={area.name.en} onChange={(e) => { const next = [...knowledgeAreas]; next[idx].name.en = e.target.value; updateState(prev => ({ ...prev, knowledgeAreas: next })); }} /></div>
                        </div>
                        <div className="w-32"><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Color</label><select className="w-full text-xs font-bold bg-white border border-slate-200 rounded px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" value={area.color} onChange={(e) => { const next = [...knowledgeAreas]; next[idx].color = e.target.value; updateState(prev => ({ ...prev, knowledgeAreas: next })); }}>{Object.keys(AREA_HEX_COLORS).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                        <button onClick={() => { if(confirm('Delete this area?')) triggerRefresh(() => updateState(prev => ({ ...prev, knowledgeAreas: prev.knowledgeAreas.filter(a => a.id !== area.id) }))); }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );

  const renderStats = () => {
    const size = 120, strokeWidth = 15, radius = (size - strokeWidth) / 2, circumference = 2 * Math.PI * radius;
    let offset = 0;
    const chartHeight = 120, paddingTop = 15, chartWidth = 300, barWidth = 18, barGap = 12, maxVal = Math.max(stats.maxSemCredits, 20);
    const maxSOCount = Math.max(...stats.soCoverage.map(s => s.count), 1);
    const maxSOCredits = Math.max(...stats.soCoverage.map(s => s.credits), 1);

    if (!showStats) return <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm flex justify-center cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setShowStats(true)}><div className="flex items-center gap-2 text-xs font-bold text-slate-500"><PieChart size={14} /> {language === 'vi' ? 'Hiển thị thống kê' : 'Show Statistics'} <ChevronDown size={14} /></div></div>;

    return (
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm relative animate-in slide-in-from-top-2 fade-in duration-300">
            <div className="absolute top-2 right-2">
                <button onClick={() => setShowStats(false)} className="text-slate-300 hover:text-slate-500 p-1"><ChevronUp size={16} /></button>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                
                {/* Pie Chart: Credit Distribution */}
                <div className="flex items-center gap-6 border-b xl:border-b-0 xl:border-r border-slate-100 pb-4 xl:pb-0 xl:pr-6">
                    <div className="relative w-28 h-28 shrink-0">
                        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
                            <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
                            {stats.areaData.map((item) => {
                                const dash = (item.percentage / 100) * circumference;
                                const segment = <circle key={item.id} cx={size/2} cy={size/2} r={radius} fill="none" stroke={AREA_HEX_COLORS[item.color] || '#94a3b8'} strokeWidth={strokeWidth} strokeDasharray={`${dash} ${circumference}`} strokeDashoffset={-offset} className="transition-all duration-500 hover:opacity-80" strokeOpacity="1" />;
                                offset += dash; return segment;
                            })}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-xl font-black text-slate-800">{stats.totalCredits}</span><span className="text-[8px] uppercase font-bold text-slate-400">Total TC</span></div>
                    </div>
                    <div className="pl-2 flex-1 w-full">{stats.areaData.map(item => <div key={item.id} className="flex items-center gap-2 mb-1.5"><div className={`w-2 h-2 rounded-full shrink-0`} style={{ backgroundColor: AREA_HEX_COLORS[item.color] || '#94a3b8' }} /><div className="flex justify-between w-full"><div className="text-[10px] font-bold text-slate-700 leading-tight truncate">{item.name[language]}</div><div className="text-[10px] text-slate-500 ml-2 whitespace-nowrap">{item.value} ({item.percentage.toFixed(0)}%)</div></div></div>)}</div>
                </div>

                {/* Bar Chart: Credits/Semester */}
                <div className="border-b xl:border-b-0 xl:border-r border-slate-100 pb-4 xl:pb-0 xl:pr-6">
                    <div className="flex items-center gap-2 mb-2"><BarChart3 size={14} className="text-slate-400" /><h3 className="text-xs font-bold text-slate-700">{language === 'vi' ? 'Tín chỉ theo Học kỳ' : 'Credits / Semester'}</h3></div>
                    <div className="w-full overflow-x-auto">
                        <div style={{ minWidth: stats.semesterData.length * (barWidth + barGap) }}>
                            <svg width="100%" height={chartHeight + 35} viewBox={`0 0 ${Math.max(chartWidth, stats.semesterData.length * (barWidth + barGap))} ${chartHeight + 35}`}>
                                {stats.semesterData.map((d, i) => {
                                    let yStack = paddingTop + chartHeight;
                                    const x = i * (barWidth + barGap) + 10;
                                    return <g key={d.semester}>
                                        {Object.entries(d.areas).map(([areaId, cred]) => { const h = (Number(cred) / maxVal) * chartHeight; yStack -= h; return <rect key={areaId} x={x} y={yStack} width={barWidth} height={h} fill={AREA_HEX_COLORS[knowledgeAreas.find(a => a.id === areaId)?.color || 'slate'] || '#94a3b8'} />; })}
                                        <text x={x + barWidth/2} y={yStack - 3} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#64748b">{d.total}</text>
                                        <text x={x + barWidth/2} y={paddingTop + chartHeight + 12} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#334155">HK{d.semester}</text>
                                    </g>;
                                })}
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Chart: SO Coverage */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <Grid3X3 size={14} className="text-slate-400" />
                        <h3 className="text-xs font-bold text-slate-700">{language === 'vi' ? 'Độ phủ SO' : 'SO Coverage'}</h3>
                    </div>
                    <div className="space-y-4 max-h-[160px] overflow-y-auto custom-scrollbar pr-2">
                        {stats.soCoverage.map(so => (
                            <div key={so.id} className="flex gap-3 items-center">
                                <div className="w-6 shrink-0 flex flex-col justify-center items-center">
                                    <span className="text-[10px] font-black text-slate-400">{so.code.replace('SO-', '')}</span>
                                </div>
                                <div className="flex-1 space-y-1.5">
                                    {/* Course Count Bar */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-indigo-500 rounded-full" 
                                                style={{ width: `${(so.count / maxSOCount) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-[9px] font-bold text-indigo-600 w-10 text-right">{so.count} {language === 'vi' ? 'môn' : 'crs'}</span>
                                    </div>
                                    {/* Credits Bar */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-emerald-500 rounded-full" 
                                                style={{ width: `${(so.credits / maxSOCredits) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-[9px] font-bold text-emerald-600 w-10 text-right">{so.credits} TC</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const renderSoMatrix = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-350px)]">
        <div className="overflow-auto custom-scrollbar flex-1 relative">
            <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-30 shadow-sm">
                    <tr>
                        <th className="sticky left-0 top-0 z-40 bg-white p-4 border-b border-r border-slate-200 text-left min-w-[250px] text-xs font-bold uppercase text-slate-500 shadow-sm">
                            <div className="flex items-center justify-between"><span>{language === 'vi' ? 'Môn học \\ SOs' : 'Course \\ SOs'}</span><span className="text-[10px] font-normal text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">{filteredCourses.length} items</span></div>
                        </th>
                        {sos.map(so => (
                            <th key={so.id} className="p-4 border-b border-slate-200 min-w-[60px] text-center bg-slate-50 group relative">
                                <span className="font-black text-indigo-600 cursor-help">{so.code}</span>
                                <div className="absolute hidden group-hover:block z-50 top-full left-1/2 -translate-x-1/2 w-64 p-3 bg-slate-800 text-white text-[10px] rounded-xl shadow-xl font-normal text-left normal-case mt-2">{so.description[language]}</div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredCourses.map(course => {
                        const hexColor = AREA_HEX_COLORS[knowledgeAreas.find(k => k.id === course.knowledgeAreaId)?.color || 'slate'];
                        return (
                            <tr key={course.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="sticky left-0 bg-white z-20 p-3 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: hexColor }}></div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2"><div className="font-bold text-slate-700 text-sm truncate cursor-help" title={`ID: ${course.id}`}>{course.code}</div>{course.isEssential && <Star size={10} className="text-amber-500 fill-amber-500" />}</div>
                                            <div className="text-[10px] text-slate-400 truncate max-w-[180px]" title={course.name[language]}>{course.name[language]}</div>
                                        </div>
                                    </div>
                                </td>
                                {sos.map(so => {
                                    const level = soMappingLookup.get(`${course.id}-${so.id}`) || '';
                                    let bgColor = 'bg-white', textColor = 'text-slate-300';
                                    if (level === IRM.I) { bgColor = 'bg-sky-100'; textColor = 'text-sky-700'; }
                                    else if (level === IRM.R) { bgColor = 'bg-indigo-100'; textColor = 'text-indigo-700'; }
                                    else if (level === IRM.M) { bgColor = 'bg-purple-100'; textColor = 'text-purple-700'; }
                                    return (
                                        <td key={so.id} onClick={() => toggleMapping(course.id, so.id)} className="p-1 text-center cursor-pointer select-none border-r border-slate-50 last:border-r-0">
                                            <div className={`w-8 h-8 mx-auto rounded flex items-center justify-center font-black text-xs transition-all ${bgColor} ${textColor} ${level ? 'shadow-sm scale-105' : 'border border-slate-100 hover:border-indigo-200'}`}>{level}</div>
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    </div>
  );

  const renderPiMatrix = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-350px)]">
        <div className="overflow-auto custom-scrollbar flex-1 relative">
            <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-30 shadow-sm">
                    <tr className="bg-slate-50">
                        <th rowSpan={2} className="sticky left-0 top-0 z-40 bg-white p-4 border-b border-r border-slate-200 text-left min-w-[250px] text-xs font-bold uppercase text-slate-500 shadow-sm">
                            <div className="flex items-center justify-between"><span>{language === 'vi' ? 'Môn học \\ PIs' : 'Course \\ PIs'}</span><span className="text-[10px] font-normal text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">{filteredCourses.length} items</span></div>
                        </th>
                        {sos.map(so => <th key={so.id} colSpan={(so.pis || []).length} className="p-2 border-b border-r border-slate-200 text-center text-xs font-bold text-indigo-600 uppercase bg-indigo-50/50">{so.code}</th>)}
                    </tr>
                    <tr className="bg-slate-50">
                        {sos.map(so => (so.pis || []).map(pi => (
                            <th key={pi.id} className="p-3 border-b border-slate-200 min-w-[50px] text-center text-[10px] font-bold text-slate-600 group relative cursor-help hover:bg-slate-100 transition-colors">
                                {pi.code}
                                <div className="absolute hidden group-hover:block z-50 top-full left-1/2 -translate-x-1/2 w-64 p-3 bg-slate-800 text-white text-[10px] rounded-xl shadow-xl font-normal text-left normal-case mt-2"><p className="font-bold mb-1 text-indigo-300">{so.code} - PI {pi.code}</p>{pi.description[language]}</div>
                            </th>
                        )))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredCourses.map(course => {
                        const courseMappedSOs = courseMappedSoLookup.get(course.id);
                        return (
                            <tr key={course.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="sticky left-0 bg-white z-20 p-3 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3"><div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: AREA_HEX_COLORS[knowledgeAreas.find(k => k.id === course.knowledgeAreaId)?.color || 'slate'] }}></div><div className="min-w-0"><div className="flex items-center gap-2"><div className="font-bold text-slate-700 text-sm truncate cursor-help" title={`ID: ${course.id}`}>{course.code}</div>{course.isEssential && <Star size={10} className="text-amber-500 fill-amber-500" />}</div><div className="text-[10px] text-slate-400 truncate max-w-[180px]" title={course.name[language]}>{course.name[language]}</div></div></div>
                                </td>
                                {sos.map(so => (so.pis || []).map(pi => {
                                    const isMapped = piMappingLookup.has(`${course.id}-${pi.id}`);
                                    const isSoMapped = courseMappedSOs ? courseMappedSOs.has(so.id) : false;
                                    
                                    return (
                                        <td key={pi.id} onClick={() => togglePiMapping(course.id, pi.id)} className={`p-1 text-center cursor-pointer select-none border-r border-slate-50 last:border-r-0 ${isSoMapped && !isMapped ? 'bg-amber-50/50 hover:bg-amber-100/50' : ''}`}>
                                            <div className={`w-6 h-6 mx-auto rounded flex items-center justify-center transition-all ${isMapped ? 'bg-emerald-500 text-white shadow-sm scale-110' : (isSoMapped ? 'bg-white border border-amber-200 text-amber-300' : 'bg-white border border-slate-100 text-slate-200 hover:border-emerald-200')}`}>{isMapped && <Check size={14} strokeWidth={3} />}</div>
                                        </td>
                                    );
                                }))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-12 relative">
        <AILoader isVisible={isTranslating || isRefreshing} message={isRefreshing ? (language === 'vi' ? 'Đang làm mới dữ liệu...' : 'Refreshing data...') : (language === 'vi' ? 'Đang dịch...' : 'Translating...')} subMessage={isRefreshing ? (language === 'vi' ? 'Đang cập nhật bảng để loại bỏ dữ liệu thừa...' : 'Updating tables to clear ghost data...') : undefined} />
        
        {/* Elective Block Modal */}
        {electiveModalData && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/20">
                    <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            <BoxSelect size={18} className="text-indigo-600"/>
                            {language === 'vi' ? 'Chọn Khối tự chọn' : 'Select Elective Block'}
                        </h3>
                        <button onClick={() => setElectiveModalData(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20}/></button>
                    </div>
                    
                    <div className="p-6 space-y-6">
                        {/* Option 1: Existing Blocks */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{language === 'vi' ? 'Thêm vào khối có sẵn' : 'Add to Existing Block'}</label>
                            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                {(generalInfo.moetInfo.subBlocks || []).map(sb => (
                                    <button 
                                        key={sb.id} 
                                        onClick={() => confirmAddToBlock(sb.id)}
                                        className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-sm font-medium flex justify-between items-center group"
                                    >
                                        <span>{sb.name[language]}</span>
                                        <span className="text-[10px] text-slate-400 bg-white px-2 py-1 rounded border border-slate-100 group-hover:border-indigo-200">
                                            {sb.minCredits} cr
                                        </span>
                                    </button>
                                ))}
                                {(generalInfo.moetInfo.subBlocks || []).length === 0 && (
                                    <div className="text-center text-xs text-slate-400 italic py-2 border-2 border-dashed border-slate-100 rounded-lg">
                                        {language === 'vi' ? 'Chưa có khối nào.' : 'No existing blocks.'}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="h-px bg-slate-200 flex-1"></div>
                            <span className="text-xs font-bold text-slate-400 uppercase">OR</span>
                            <div className="h-px bg-slate-200 flex-1"></div>
                        </div>

                        {/* Option 2: New Block */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-3 block flex items-center gap-2">
                                <Plus size={12}/> {language === 'vi' ? 'Tạo khối mới' : 'Create New Block'}
                            </label>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 mb-1 block">Name (VI/EN)</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input 
                                            className="w-full p-2 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                                            placeholder="Tên Tiếng Việt"
                                            value={newBlockName.vi}
                                            onChange={e => setNewBlockName({ ...newBlockName, vi: e.target.value })}
                                        />
                                        <input 
                                            className="w-full p-2 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                                            placeholder="English Name"
                                            value={newBlockName.en}
                                            onChange={e => setNewBlockName({ ...newBlockName, en: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 mb-1 block">Category</label>
                                    <select 
                                        className="w-full p-2 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white cursor-pointer"
                                        value={newBlockParent}
                                        onChange={e => setNewBlockParent(e.target.value as any)}
                                    >
                                        <option value="spec">{language === 'vi' ? 'Chuyên ngành (Specialized)' : 'Specialized Engineering'}</option>
                                        <option value="fund">{language === 'vi' ? 'Cơ sở ngành (Fundamental)' : 'Fundamental Engineering'}</option>
                                        <option value="gen">{language === 'vi' ? 'Đại cương (General)' : 'General Education'}</option>
                                    </select>
                                </div>
                                <button 
                                    onClick={createAndAddToBlock}
                                    disabled={!newBlockName.vi}
                                    className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                >
                                    <Plus size={14}/> {language === 'vi' ? 'Tạo và Thêm' : 'Create & Add'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Stats Panel (Collapsible) */}
        {renderStats()}

        {/* Unified Main Toolbar - Always Visible */}
        <div className="flex flex-col xl:flex-row justify-between items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm gap-4 sticky top-0 z-40">
             {/* Left: Tab Navigation */}
             <div className="flex p-1 bg-slate-100 rounded-lg shrink-0 overflow-x-auto w-full xl:w-auto">
                <button onClick={() => setActiveTab('catalog')} className={`px-4 py-2 rounded-md text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'catalog' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Book size={14} /> {t.catalog}</button>
                <button onClick={() => setActiveTab('so')} className={`px-4 py-2 rounded-md text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'so' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Grid3X3 size={14} /> {t.soMatrix}</button>
                <button onClick={() => setActiveTab('pi')} className={`px-4 py-2 rounded-md text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'pi' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><ListChecks size={14} /> {t.piMatrix}</button>
                <button onClick={() => setActiveTab('areas')} className={`px-4 py-2 rounded-md text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'areas' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Layers size={14} /> {t.knowledgeAreaTable}</button>
             </div>

             {/* Right: Global Filters & Search */}
             <div className="flex items-center gap-4 px-2 w-full xl:w-auto justify-end overflow-x-auto">
                 {/* Global Search */}
                 <div className="relative min-w-[180px]">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <input 
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder={language === 'vi' ? "Tìm môn học..." : "Search courses..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                 </div>

                 {/* ABET/All Scope Toggle (Moved from Stats) */}
                 <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
                    <button 
                        onClick={() => setStatsScope('abet')} 
                        className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${statsScope === 'abet' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        ABET
                    </button>
                    <button 
                        onClick={() => setStatsScope('all')} 
                        className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${statsScope === 'all' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        ALL
                    </button>
                 </div>

                 {/* Essential Filter */}
                 <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition shrink-0">
                     <input type="checkbox" checked={filterEssential} onChange={(e) => { const checked = e.target.checked; triggerRefresh(() => setFilterEssential(checked)); }} className="rounded text-indigo-600 focus:ring-0 w-3.5 h-3.5" />
                     <span className="text-xs font-bold text-slate-700 select-none flex items-center gap-1"><Star size={12} className="fill-amber-400 text-amber-400" /> {t.filterEssential}</span>
                 </label>

                 {/* Area Filter */}
                 <div className="flex items-center gap-2 shrink-0">
                     <Filter size={14} className="text-slate-400" />
                     <select className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[120px]" value={filterArea} onChange={(e) => setFilterArea(e.target.value)}>
                         <option value="all">{t.allCategories}</option>
                         {knowledgeAreas.map(k => <option key={k.id} value={k.id}>{k.name[language]}</option>)}
                     </select>
                 </div>

                 {/* Exports */}
                 {activeTab !== 'catalog' && activeTab !== 'areas' && (
                     <button onClick={exportMatrixCSV} className="bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-900 transition shadow-sm shrink-0">
                         <Download size={14} /> CSV
                     </button>
                 )}
             </div>
        </div>

        {/* View Specific Actions: Catalog Only */}
        {activeTab === 'catalog' && (
            <div className="flex justify-end gap-2 animate-in fade-in slide-in-from-top-2">
                <button onClick={handleAutoTranslateCatalog} disabled={isTranslating} className="bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-2 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition shadow-sm disabled:opacity-50">
                    <Globe size={12} className={isTranslating ? "animate-spin" : ""} /> {isTranslating ? (language === 'vi' ? 'Đang dịch...' : 'Translating...') : (language === 'vi' ? 'Dịch tự động' : 'Auto Translate')}
                </button>
                <div className="h-6 w-px bg-slate-300 mx-1"></div>
                <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleImportCatalog} />
                <button onClick={() => fileInputRef.current?.click()} className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-2 hover:bg-emerald-100 transition shadow-sm"><FileSpreadsheet size={12} /> {language === 'vi' ? 'Nhập CSV' : 'Import CSV'}</button>
                <button onClick={handleExportCatalog} className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-2 hover:bg-slate-200 transition shadow-sm"><Download size={12} /> {language === 'vi' ? 'Xuất CSV' : 'Export CSV'}</button>
                <button onClick={() => setIsAddModalOpen(true)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-sm ml-2"><Plus size={12} /> {t.addCourse}</button>
            </div>
        )}

        <div key={tableVersion} className="animate-in fade-in duration-500">
            {activeTab === 'catalog' && renderCatalog()}
            {activeTab === 'so' && renderSoMatrix()}
            {activeTab === 'pi' && renderPiMatrix()}
            {activeTab === 'areas' && renderKnowledgeAreas()}
        </div>

        {/* Add Course Modal */}
        {isAddModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/20">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 text-lg">{language === 'vi' ? 'Thêm Môn học Mới' : 'Add New Course'}</h3>
                        <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20}/></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{language === 'vi' ? 'Mã môn' : 'Course Code'}</label>
                            <input className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" value={newCourseData.code} onChange={e => setNewCourseData({...newCourseData, code: e.target.value})} placeholder="e.g. ENG 101" autoFocus />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Tên (VI)</label>
                                <input className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={newCourseData.name?.vi} onChange={e => setNewCourseData({...newCourseData, name: { ...newCourseData.name!, vi: e.target.value }})} placeholder="Tên tiếng Việt" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Name (EN)</label>
                                <input className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={newCourseData.name?.en} onChange={e => setNewCourseData({...newCourseData, name: { ...newCourseData.name!, en: e.target.value }})} placeholder="English Name" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t.credits}</label>
                                <input type="number" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" value={newCourseData.credits} onChange={e => setNewCourseData({...newCourseData, credits: parseInt(e.target.value) || 0})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t.semester}</label>
                                <input type="number" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" value={newCourseData.semester} onChange={e => setNewCourseData({...newCourseData, semester: parseInt(e.target.value) || 1})} />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{language === 'vi' ? 'Loại môn học' : 'Course Type'}</label>
                            <select 
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                                value={newCourseData.type}
                                onChange={e => setNewCourseData({...newCourseData, type: e.target.value as any})}
                            >
                                <option value="REQUIRED">{language === 'vi' ? 'Bắt buộc' : 'Required'}</option>
                                <option value="SELECTED_ELECTIVE">{language === 'vi' ? 'TC Định hướng' : 'Selected Elective'}</option>
                                <option value="ELECTIVE">{language === 'vi' ? 'Tự chọn' : 'Free Elective'}</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t.knowledgeArea}</label>
                            <select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" value={newCourseData.knowledgeAreaId} onChange={e => setNewCourseData({...newCourseData, knowledgeAreaId: e.target.value})}>
                                {knowledgeAreas.map(k => <option key={k.id} value={k.id}>{k.name[language]}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-4 pt-2">
                            <label className="flex items-center gap-2 cursor-pointer p-2 border border-slate-200 rounded-lg hover:bg-slate-50 flex-1">
                                <input type="checkbox" className="rounded text-indigo-600 focus:ring-0" checked={newCourseData.isEssential} onChange={e => setNewCourseData({...newCourseData, isEssential: e.target.checked, isAbet: e.target.checked ? true : newCourseData.isAbet})} />
                                <span className="text-xs font-bold text-slate-700">{t.essential}</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer p-2 border border-slate-200 rounded-lg hover:bg-slate-50 flex-1">
                                <input type="checkbox" className="rounded text-orange-500 focus:ring-0" checked={newCourseData.isAbet} onChange={e => setNewCourseData({...newCourseData, isAbet: e.target.checked})} />
                                <span className="text-xs font-bold text-slate-700">ABET</span>
                            </label>
                        </div>
                    </div>
                    <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                        <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors">Cancel</button>
                        <button onClick={handleSaveNewCourse} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 flex items-center gap-2">
                            <Save size={14}/> {language === 'vi' ? 'Lưu môn học' : 'Save Course'}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default MappingModule;
