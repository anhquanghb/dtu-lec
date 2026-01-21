import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppState, Course, CourseTopic, AssessmentItem, LibraryResource, CloMapping, CoverageLevel, SO, Faculty, TeachingMethod, AssessmentMethod } from '../types';
import { TRANSLATIONS } from '../constants';
import { 
  Search, BookOpen, FileText, Upload, Sparkles, Plus, Trash2, 
  Layers, Download, Info, Check, FileUp, Library, 
  Clock, Hash, AlertCircle, Settings2, Star, FileJson, FileType,
  ChevronDown, Target, CheckSquare, Square, X, Percent, Save, Copy
} from 'lucide-react';
import { importSyllabusFromPdf, translateSyllabus } from '../services/geminiService';
import { exportSyllabusPdf } from '../services/SyllabusExportPDF';
import { exportSyllabusDocx } from '../services/SyllabusExportDOCx';
import AILoader from '../components/AILoader';

interface EditorProps {
    course: Course;
    state: AppState;
    updateState: (updater: (prev: AppState) => AppState) => void;
}

// --- Helper Component: Hierarchical SO/PI Selector ---
const SoPiSelector = ({ 
    sos, 
    selectedSoIds, 
    selectedPiIds, 
    onUpdate, 
    globalMappedSoIds, 
    globalMappedPiIds, 
    language 
}: { 
    sos: SO[], 
    selectedSoIds: string[], 
    selectedPiIds: string[], 
    onUpdate: (soIds: string[], piIds: string[]) => void,
    globalMappedSoIds: Set<string>,
    globalMappedPiIds: Set<string>,
    language: 'vi' | 'en'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleSo = (soId: string) => {
        const newSoIds = selectedSoIds.includes(soId) 
            ? selectedSoIds.filter(id => id !== soId)
            : [...selectedSoIds, soId];
        onUpdate(newSoIds, selectedPiIds);
    };

    const togglePi = (piId: string) => {
        const newPiIds = selectedPiIds.includes(piId)
            ? selectedPiIds.filter(id => id !== piId)
            : [...selectedPiIds, piId];
        onUpdate(selectedSoIds, newPiIds);
    };

    const displayBadges = selectedSoIds.map(sid => {
        const so = sos.find(s => s.id === sid);
        if (!so) return null;
        const myPis = (so.pis || []).filter(p => selectedPiIds.includes(p.id));
        return {
            code: so.code.replace('SO-', ''),
            piCodes: myPis.map(p => p.code)
        };
    }).filter(Boolean);

    return (
        <div className="relative" ref={containerRef}>
            <div 
                onClick={() => setIsOpen(!isOpen)} 
                className="min-h-[32px] p-1 border border-slate-200 rounded-lg bg-white hover:border-indigo-300 cursor-pointer flex flex-wrap gap-1 items-center transition-all shadow-sm"
            >
                {displayBadges.length === 0 && <span className="text-[10px] text-slate-300 px-2 italic flex items-center gap-1"><Plus size={10}/> Select</span>}
                
                {displayBadges.map((item: any, idx) => (
                    <div key={idx} className="flex items-center bg-indigo-50 border border-indigo-100 rounded overflow-hidden">
                        <span className="px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">{item.code}</span>
                        {item.piCodes.length > 0 && (
                            <span className="px-1.5 py-0.5 text-[9px] bg-white text-slate-500 border-l border-indigo-100 flex gap-0.5">
                                {item.piCodes.map((pc: string) => <span key={pc}>{pc}</span>)}
                            </span>
                        )}
                    </div>
                ))}
                
                <div className="ml-auto pr-1 text-slate-300">
                    <ChevronDown size={12} />
                </div>
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 z-50 w-72 bg-white border border-slate-200 shadow-xl rounded-xl mt-2 p-1 max-h-80 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
                    {sos.map(so => {
                        const isSoSelected = selectedSoIds.includes(so.id);
                        const isGlobalSo = globalMappedSoIds.has(so.id);
                        const hasPis = so.pis && so.pis.length > 0;

                        return (
                            <div key={so.id} className="mb-1 last:mb-0">
                                <div className={`flex items-center p-2 rounded-lg transition-colors group ${isSoSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'} ${isGlobalSo ? 'border border-amber-200 bg-amber-50/30' : ''}`}>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); toggleSo(so.id); }}
                                        className={`mr-2 transition-colors ${isSoSelected ? 'text-indigo-600' : 'text-slate-300 hover:text-slate-400'}`}
                                    >
                                        {isSoSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                    </button>
                                    
                                    <div className="flex-1 cursor-default">
                                        <div className="flex items-center justify-between">
                                            <span className={`text-xs font-bold ${isSoSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                                                {so.code}
                                            </span>
                                            {isGlobalSo && (
                                                <span className="text-[9px] text-amber-600 bg-amber-100 px-1.5 rounded flex items-center gap-1" title="Required by Curriculum Matrix">
                                                    <Target size={8} /> Matrix
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[9px] text-slate-400 line-clamp-1 leading-tight mt-0.5" title={so.description[language]}>
                                            {so.description[language]}
                                        </div>
                                    </div>
                                </div>

                                {hasPis && isSoSelected && (
                                    <div className="ml-4 pl-3 border-l-2 border-slate-100 mt-1 space-y-1">
                                        {so.pis.map(pi => {
                                            const isPiSelected = selectedPiIds.includes(pi.id);
                                            const isGlobalPi = globalMappedPiIds.has(pi.id);
                                            return (
                                                <div 
                                                    key={pi.id} 
                                                    onClick={() => togglePi(pi.id)}
                                                    className={`flex items-center p-1.5 rounded cursor-pointer transition-colors ${isPiSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'} ${isGlobalPi ? 'ring-1 ring-amber-100' : ''}`}
                                                >
                                                    <div className={`mr-2 ${isPiSelected ? 'text-indigo-500' : 'text-slate-300'}`}>
                                                        {isPiSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold text-slate-600">{pi.code}</span>
                                                            {isGlobalPi && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Matrix Requirement"></div>}
                                                        </div>
                                                        <div className="text-[9px] text-slate-400 line-clamp-1">{pi.description[language]}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const SyllabusEditorModule: React.FC<EditorProps> = ({ course, state, updateState }) => {
    const { language, geminiConfig, library, teachingMethods, assessmentMethods, faculties, sos, courseSoMap, coursePiMap, generalInfo } = state;
    const t = TRANSLATIONS[language];
    
    // Editors State
    const [editingTopicTime, setEditingTopicTime] = useState<string | null>(null);
    const [editingTopicReadings, setEditingTopicReadings] = useState<string | null>(null);
    const [instructorSearch, setInstructorSearch] = useState('');
    const [showInstructorDropdown, setShowInstructorDropdown] = useState(false);
    
    // Material State
    const [isAddingMaterial, setIsAddingMaterial] = useState(false);
    const [materialMode, setMaterialMode] = useState<'search' | 'create'>('search');
    const [materialSearch, setMaterialSearch] = useState('');
    const [newMaterial, setNewMaterial] = useState<LibraryResource>({ 
        id: '', title: '', author: '', publisher: '', year: new Date().getFullYear().toString(), 
        type: 'textbook', isEbook: false, isPrinted: true, url: '' 
    });

    // Import JSON Modal State
    const [isJsonModalOpen, setJsonModalOpen] = useState(false);
    const [jsonText, setJsonText] = useState('');

    // Process State
    const [isProcessing, setIsProcessing] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Global Matrix Expectations for this course
    const globalMatrixExpectations = useMemo(() => {
        const soIds = new Set<string>();
        (courseSoMap || []).filter(m => m.courseId === course.id && m.level !== '').forEach(m => soIds.add(m.soId));
        const piIds = new Set<string>();
        (coursePiMap || []).filter(m => m.courseId === course.id).forEach(m => piIds.add(m.piId));
        return { soIds, piIds };
    }, [course.id, courseSoMap, coursePiMap]);

    // --- Helper Functions ---
    const updateCourse = (updates: Partial<Course>) => {
        updateState(prev => ({
            ...prev,
            courses: prev.courses.map(c => c.id === course.id ? { ...c, ...updates } : c)
        }));
    };

    const updateTopic = (id: string, field: keyof CourseTopic, value: any) => {
        updateCourse({ topics: course.topics.map(t => t.id === id ? { ...t, [field]: value } : t) });
    };

    const updateTopicLang = (id: string, value: string) => {
        updateCourse({
            topics: course.topics.map(t => 
                t.id === id ? { ...t, topic: { ...t.topic, [language]: value } } : t
            )
        });
    };

    const updateAssessment = (idx: number, field: keyof AssessmentItem, value: any) => {
        const next = [...course.assessmentPlan];
        next[idx] = { ...next[idx], [field]: value };
        // If updating methodId, optionally sync default name if empty
        if (field === 'methodId') {
            const method = assessmentMethods.find(m => m.id === value);
            if (method && (!next[idx].type.vi || next[idx].type.vi === '')) {
                next[idx].type = method.name;
            }
        }
        updateCourse({ assessmentPlan: next });
    };

    const updateCloMap = (cloIdx: number, updates: Partial<CloMapping>) => {
        const currentMaps = course.cloMap || [];
        const existingIdx = currentMaps.findIndex(m => m.cloIndex === cloIdx);
        let newMaps = [...currentMaps];
        if (existingIdx >= 0) {
            newMaps[existingIdx] = { ...newMaps[existingIdx], ...updates };
        } else {
            newMaps.push({ 
                cloIndex: cloIdx, topicIds: [], teachingMethodIds: [], assessmentMethodIds: [], 
                coverageLevel: CoverageLevel.NONE, soIds: [], piIds: [], ...updates 
            });
        }
        updateCourse({ cloMap: newMaps });
    };

    const toggleInstructor = (facultyId: string) => {
        const current = course.instructorIds || [];
        let nextIds: string[];
        let nextDetails = { ...course.instructorDetails };
        
        if (current.includes(facultyId)) {
            nextIds = current.filter(id => id !== facultyId);
            delete nextDetails[facultyId];
        } else {
            nextIds = [...current, facultyId];
            if (!nextDetails[facultyId]) nextDetails[facultyId] = { classInfo: '', isMain: false };
        }
        updateCourse({ instructorIds: nextIds, instructorDetails: nextDetails });
        setInstructorSearch('');
        setShowInstructorDropdown(false);
    };

    // --- Import / Export Handlers ---
    const handleExport = async (faculty: Faculty, type: 'pdf' | 'docx') => {
        setIsExporting(true);
        try {
            if (type === 'pdf') {
                await exportSyllabusPdf(course, assessmentMethods, language, generalInfo, faculties, teachingMethods, sos);
            } else {
                await exportSyllabusDocx(course, assessmentMethods, language, generalInfo, faculties, teachingMethods, sos);
            }
        } catch (err) {
            console.error(err);
            alert("Export failed");
        } finally {
            setIsExporting(false);
        }
    };

    const exportSyllabusJson = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(course, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${course.code}_syllabus_${Date.now()}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleJsonPasteImport = () => {
        try {
            if (!jsonText.trim()) return;
            const imported = JSON.parse(jsonText);
            
            // Structural Preservation Logic:
            // We take the imported content (newC) but force the existing Catalog/Structural IDs (exC)
            const exC = course;
            
            const mergedCourse: Course = {
                ...imported, // Take content from JSON (Description, Topics, CLOs, etc.)
                // Force preserve Catalog Data from current state
                id: exC.id,
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

            updateCourse(mergedCourse);
            setJsonModalOpen(false);
            setJsonText('');
            alert(language === 'vi' ? 'Đã nhập dữ liệu JSON (Giữ nguyên cấu trúc khung chương trình)!' : 'JSON Imported (Catalog structure preserved)!');
        } catch (err) {
            alert(language === 'vi' ? 'Lỗi: JSON không hợp lệ' : 'Error: Invalid JSON');
        }
    };

    const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsProcessing(true);
        try {
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split(',')[1]) : reject(new Error("Failed"));
                reader.readAsDataURL(file);
            });
            const data = await importSyllabusFromPdf(base64, geminiConfig);
            
            if (data) {
                // Post-process data to match AppState schema and generate IDs
                const processed: Partial<Course> = {};

                if (data.description) processed.description = { ...course.description, ...data.description };
                
                if (data.clos) {
                    processed.clos = {
                        vi: data.clos.vi || course.clos.vi,
                        en: data.clos.en || course.clos.en
                    };
                }

                if (Array.isArray(data.textbooks)) {
                    processed.textbooks = data.textbooks.map((tb: any) => ({
                        resourceId: `lib-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        title: tb.title || 'Unknown',
                        author: tb.author || '',
                        publisher: tb.publisher || '',
                        year: tb.year || '',
                        type: tb.type || 'reference',
                        url: ''
                    }));
                }

                if (Array.isArray(data.topics)) {
                    processed.topics = data.topics.map((t: any, idx: number) => {
                        // Attempt to map extracted activities to teaching methods
                        const activities = Array.isArray(t.activities) ? t.activities.map((act: any) => {
                            // Find matching teaching method by code or name
                            const typeStr = typeof act.type === 'string' ? act.type : '';
                            const matchedMethod = teachingMethods.find(tm => 
                                (typeStr && (tm.code.toLowerCase() === typeStr.toLowerCase() || tm.name.en.toLowerCase().includes(typeStr.toLowerCase())))
                            );
                            return {
                                methodId: matchedMethod ? matchedMethod.id : teachingMethods[0].id, // Default to first method (usually Lecture)
                                hours: typeof act.hours === 'number' ? act.hours : 0
                            };
                        }) : [];

                        // Format Topic No to "CONT X"
                        let displayNo = t.no ? String(t.no) : `${idx + 1}`;
                        // If it's just a number or strictly numeric with optional dot
                        if (/^\d+\.?$/.test(displayNo)) {
                            displayNo = `CONT ${parseInt(displayNo, 10)}`;
                        } else if (!displayNo.toUpperCase().startsWith('CONT')) {
                            // If user text doesn't start with CONT, ensure prefix only if it looks like a short number/code
                            if (displayNo.length < 5 && !isNaN(parseInt(displayNo))) {
                                 displayNo = `CONT ${displayNo}`;
                            } else if (!t.no) {
                                // Fallback if no text provided
                                displayNo = `CONT ${idx + 1}`;
                            }
                        }

                        return {
                            id: `t-${Date.now()}-${idx}`,
                            no: displayNo,
                            topic: { vi: t.topic?.vi || '', en: t.topic?.en || '' },
                            activities: activities,
                            readingRefs: []
                        };
                    });
                }

                if (Array.isArray(data.assessmentPlan)) {
                    processed.assessmentPlan = data.assessmentPlan.map((a: any, idx: number) => {
                        // Try to find matching assessment method by name
                        const matchedMethod = assessmentMethods.find(am => {
                            const typeVi = typeof a.type?.vi === 'string' ? a.type.vi : '';
                            const typeEn = typeof a.type?.en === 'string' ? a.type.en : '';
                            
                            return (typeVi && am.name.vi.toLowerCase().includes(typeVi.toLowerCase())) ||
                                   (typeEn && am.name.en.toLowerCase().includes(typeEn.toLowerCase()));
                        });
                        
                        return {
                            id: `a-${Date.now()}-${idx}`,
                            methodId: matchedMethod ? matchedMethod.id : assessmentMethods[0].id,
                            type: { vi: a.type?.vi || '', en: a.type?.en || '' },
                            percentile: a.percentile || 0
                        };
                    });
                }

                updateCourse(processed);
                alert(language === 'vi' ? "Nhập dữ liệu AI thành công!" : "AI Import Successful!");
            }
        } catch (err) {
            console.error(err);
            alert("AI Import failed.");
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleAutoTranslate = async () => {
        setIsTranslating(true);
        try {
            const translated = await translateSyllabus(course, language, geminiConfig);
            if (translated) updateCourse(translated);
        } finally {
            setIsTranslating(false);
        }
    };

    // --- Renderers ---
    const renderSyllabus = () => {
        const creditSummary = teachingMethods.map(tm => {
            const totalHours = course.topics.reduce((sum, t) => sum + (t.activities.find(a => a.methodId === tm.id)?.hours || 0), 0) || 0;
            if (totalHours === 0) return null;
            const factor = tm.hoursPerCredit || 15;
            return { code: tm.code, credits: Math.ceil(totalHours / factor), totalHours, missing: totalHours % factor === 0 ? 0 : factor - (totalHours % factor) };
        }).filter(Boolean);
        
        const totalComputed = creditSummary?.reduce((acc: number, item: any) => acc + item.credits, 0) || 0;
        const diff = (course.credits || 0) - totalComputed;

        const mappedInSyllabusSoIds = new Set<string>();
        course.cloMap?.forEach(m => m.soIds.forEach(id => mappedInSyllabusSoIds.add(id)));
        const missingSoCoverage = Array.from(globalMatrixExpectations.soIds).filter(id => !mappedInSyllabusSoIds.has(id));

        return (
            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                {/* Instructor & Export Section */}
                <section className="bg-slate-50 p-6 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t.instructorSelect}</h4>
                        <div className="relative mb-3">
                            <div className="flex items-center gap-2 border border-slate-200 bg-white rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500">
                                <Search size={16} className="text-slate-400" />
                                <input className="flex-1 outline-none text-sm font-medium" placeholder={language === 'vi' ? "Tìm giảng viên..." : "Search instructors..."} value={instructorSearch} onChange={e => { setInstructorSearch(e.target.value); setShowInstructorDropdown(true); }} onFocus={() => setShowInstructorDropdown(true)} />
                                {showInstructorDropdown && <button onClick={() => setShowInstructorDropdown(false)}><X size={14} className="text-slate-400" /></button>}
                            </div>
                            {showInstructorDropdown && (
                                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-lg shadow-xl mt-1 z-50 max-h-48 overflow-y-auto">
                                    {faculties.filter(f => f.name[language].toLowerCase().includes(instructorSearch.toLowerCase()) && !course.instructorIds.includes(f.id)).map(f => (
                                        <button key={f.id} onClick={() => toggleInstructor(f.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">{f.name[language].charAt(0)}</div>{f.name[language]}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            {course.instructorIds.map(fid => {
                                const f = faculties.find(fac => fac.id === fid);
                                if (!f) return null;
                                const isMain = course.instructorDetails?.[fid]?.isMain;
                                return (
                                    <div key={f.id} className={`bg-white border p-2 rounded-lg flex flex-col gap-2 shadow-sm transition-colors ${isMain ? 'border-amber-200 ring-1 ring-amber-200' : 'border-slate-200'}`}>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => {
                                                    const newDetails: any = {};
                                                    Object.keys(course.instructorDetails || {}).forEach(key => { newDetails[key] = { ...course.instructorDetails[key], isMain: key === fid }; });
                                                    updateCourse({ instructorDetails: newDetails });
                                                }} className={`transition-colors ${isMain ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}>
                                                    <Star size={16} fill={isMain ? "currentColor" : "none"} />
                                                </button>
                                                <span className={`text-xs font-bold ${isMain ? 'text-slate-800' : 'text-slate-700'}`}>{f.name[language]}{isMain && <span className="ml-2 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-wider">Main</span>}</span>
                                            </div>
                                            <button onClick={() => toggleInstructor(f.id)} className="p-1 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"><X size={14} /></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between mb-1">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{language === 'vi' ? 'Xuất đề cương' : 'Export Syllabus'}</h4>
                            <div className="flex gap-2">
                                <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handlePdfImport} />
                                <button onClick={handleAutoTranslate} disabled={isTranslating} className="bg-indigo-50 border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-2 hover:bg-indigo-100 disabled:opacity-50">
                                    <Sparkles size={14} /> {t.autoTranslate}
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-2 hover:bg-amber-600 disabled:opacity-50">
                                    <FileUp size={14} /> {isProcessing ? "Reading..." : "AI Import"}
                                </button>
                            </div>
                        </div>
                        {course.instructorIds.map(fid => {
                            const f = faculties.find(fac => fac.id === fid);
                            if (!f) return null;
                            return (
                                <div key={fid} className="flex gap-2 items-center bg-white border border-slate-200 p-1.5 rounded-xl hover:border-indigo-300 transition-colors">
                                    <div className="flex-1 flex items-center gap-2 px-2">
                                        <FileText size={16} className="text-indigo-500" />
                                        <span className="text-xs font-bold text-slate-700 truncate">{f.name[language]}</span>
                                    </div>
                                    <button onClick={() => handleExport(f, 'pdf')} disabled={isExporting} className="p-2 bg-slate-100 hover:bg-indigo-100 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors" title="Export PDF"><Download size={14} /></button>
                                    <button onClick={() => handleExport(f, 'docx')} disabled={isExporting} className="p-2 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-lg transition-colors" title="Export DOCX"><FileType size={14} /></button>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Description */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest border-b pb-2"><Info size={16} /> Course Description</div>
                    <textarea className="w-full min-h-[100px] p-4 text-sm leading-relaxed bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" value={course.description[language] || ''} onChange={(e) => updateCourse({ description: { ...course.description, [language]: e.target.value } })} />
                </section>

                {/* Textbooks & Materials */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest"><BookOpen size={16} /> {t.textbook} & {t.typeReference}</div>
                        <button onClick={() => setIsAddingMaterial(true)} className="text-indigo-600 hover:text-indigo-700"><Plus size={18} /></button>
                    </div>
                    <div className="space-y-2">
                        {course.textbooks.map((tb, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200">
                                <div>
                                    <div className="text-sm font-bold text-slate-800">{tb.title}</div>
                                    <div className="text-xs text-slate-500">{tb.author} • {tb.publisher} ({tb.year})</div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${tb.type === 'textbook' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{tb.type}</span>
                                    <button onClick={() => updateCourse({ textbooks: course.textbooks.filter((_, i) => i !== idx) })} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        ))}
                        {course.textbooks.length === 0 && <div className="text-center text-slate-400 italic py-4 text-xs">No materials added.</div>}
                    </div>
                </section>

                {/* Assessment Plan */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest"><Percent size={16} /> {t.assessment}</div>
                        <button onClick={() => updateCourse({ assessmentPlan: [...course.assessmentPlan, { id: Date.now().toString(), methodId: assessmentMethods[0].id, type: { vi: '', en: '' }, percentile: 0 }] })} className="text-indigo-600 hover:text-indigo-700"><Plus size={18} /></button>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="p-3 font-bold text-slate-500 uppercase">{t.assessmentType}</th>
                                    <th className="p-3 font-bold text-slate-500 uppercase">{t.description} ({language})</th>
                                    <th className="p-3 font-bold text-slate-500 uppercase w-24 text-center">{t.percentile}</th>
                                    <th className="p-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {course.assessmentPlan.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                        <td className="p-2">
                                            <select 
                                                className="w-full p-2 bg-transparent border border-transparent hover:border-slate-200 rounded outline-none cursor-pointer"
                                                value={item.methodId}
                                                onChange={e => updateAssessment(idx, 'methodId', e.target.value)}
                                            >
                                                {assessmentMethods.map(am => <option key={am.id} value={am.id}>{am.name[language]}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <input 
                                                className="w-full p-2 bg-transparent border border-transparent hover:border-slate-200 rounded outline-none"
                                                value={item.type[language] || ''}
                                                onChange={e => {
                                                    const next = [...course.assessmentPlan];
                                                    next[idx].type = { ...next[idx].type, [language]: e.target.value };
                                                    updateCourse({ assessmentPlan: next });
                                                }}
                                                placeholder={assessmentMethods.find(m => m.id === item.methodId)?.name[language]}
                                            />
                                        </td>
                                        <td className="p-2 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <input 
                                                    type="number" 
                                                    className="w-12 text-center p-1 border border-slate-200 rounded outline-none focus:border-indigo-500"
                                                    value={item.percentile}
                                                    onChange={e => updateAssessment(idx, 'percentile', parseInt(e.target.value) || 0)}
                                                />
                                                <span className="text-slate-400">%</span>
                                            </div>
                                        </td>
                                        <td className="p-2 text-center">
                                            <button onClick={() => updateCourse({ assessmentPlan: course.assessmentPlan.filter((_, i) => i !== idx) })} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-slate-50 font-bold">
                                    <td colSpan={2} className="p-3 text-right text-slate-600 uppercase text-[10px] tracking-widest">{t.totalWeight}</td>
                                    <td className="p-3 text-center text-indigo-600">
                                        {course.assessmentPlan.reduce((sum, item) => sum + item.percentile, 0)}%
                                    </td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Topics & Schedule */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest"><Layers size={16} /> {t.courseTopicsSchedule}</div>
                        {creditSummary && creditSummary.length > 0 && (
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col items-end border-r border-slate-200 pr-4 mr-2">
                                    <span className={`text-xs font-black ${diff === 0 ? 'text-green-600' : 'text-red-500'}`}>Total: {totalComputed}/{course.credits} TC</span>
                                    {diff !== 0 && <span className="text-[9px] text-amber-500 font-bold flex items-center gap-1"><AlertCircle size={8} /> Diff: {Math.abs(diff)} TC</span>}
                                </div>
                                <div className="flex gap-3">
                                    {creditSummary.map((s: any) => (
                                        <div key={s.code} className="flex flex-col items-end">
                                            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{s.code}: {s.credits} TC <span className="text-[9px] text-slate-400 font-normal">({s.totalHours}h)</span></span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <button onClick={() => {
                            const next: CourseTopic = { id: `t-${Date.now()}`, no: `CONT ${course.topics.length + 1}`, topic: { vi: '', en: '' }, activities: [], readingRefs: [] };
                            updateCourse({ topics: [...course.topics, next] });
                        }} className="text-indigo-600 hover:text-indigo-700 ml-4"><Plus size={18} /></button>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 border-b">
                                <tr><th className="p-3 font-bold text-slate-500 uppercase w-20">{t.contentNo}</th><th className="p-3 font-bold text-slate-500 uppercase w-48">{t.amountOfTime}</th><th className="p-3 font-bold text-slate-500 uppercase">Course Topic</th><th className="p-3 font-bold text-slate-500 uppercase w-64">Readings</th><th className="p-3 w-10"></th></tr>
                            </thead>
                            <tbody className="divide-y">
                                {course.topics.map((topic: CourseTopic) => {
                                    const totalHours = (topic.activities || []).reduce((s, a) => s + a.hours, 0);
                                    const methodsStr = (topic.activities || []).map(a => `${teachingMethods.find(m => m.id === a.methodId)?.code}: ${a.hours}`).join(', ');
                                    return (
                                        <tr key={topic.id} className="hover:bg-slate-50 align-top">
                                            <td className="p-2"><input className="w-full bg-transparent p-1 outline-none font-bold" value={topic.no} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateTopic(topic.id, 'no', e.target.value)} /></td>
                                            <td className="p-2">
                                                <button onClick={() => setEditingTopicTime(topic.id)} className="w-full text-left p-1 rounded hover:bg-slate-100 group relative">
                                                    <div className="flex items-center justify-between"><div className="font-bold text-indigo-700 text-sm">{totalHours} {t.hours}</div><div className="text-slate-300 group-hover:text-indigo-500 transition-colors"><Plus size={14}/></div></div>
                                                    {methodsStr && <div className="text-[10px] text-slate-500 mt-1 font-medium bg-slate-100 inline-block px-1.5 py-0.5 rounded border border-slate-200">{methodsStr}</div>}
                                                </button>
                                            </td>
                                            <td className="p-2"><textarea className="w-full bg-transparent p-1 outline-none italic resize-none h-full" rows={2} value={topic.topic[language] || ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateTopicLang(topic.id, e.target.value)} /></td>
                                            <td className="p-2">
                                                <button onClick={() => setEditingTopicReadings(topic.id)} className="w-full text-left p-1 rounded hover:bg-slate-100 group min-h-[40px]">
                                                    {(topic.readingRefs || []).length === 0 && <span className="text-[10px] text-slate-300">+ Add Readings</span>}
                                                    {(topic.readingRefs || []).map((ref, i) => { const tb = course.textbooks.find(b => b.resourceId === ref.resourceId); return (<div key={i} className="text-[10px] text-slate-600 mb-1"><span className="font-bold">{tb ? tb.title : 'Unknown'}</span>{ref.pageRange && <span className="text-slate-400 ml-1">({ref.pageRange})</span>}</div>); })}
                                                </button>
                                            </td>
                                            <td className="p-2 text-center pt-3"><button onClick={() => updateCourse({ topics: course.topics.filter(t => t.id !== topic.id) })} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Matrix & CLO Relation */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest border-b pb-2"><Hash size={16} /> {t.cloRelationship}</div>
                    {missingSoCoverage.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 mb-4">
                            <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                            <div>
                                <h4 className="text-sm font-bold text-amber-800 mb-1">{language === 'vi' ? 'Cảnh báo độ phủ Ma trận' : 'Curriculum Matrix Coverage Warning'}</h4>
                                <p className="text-xs text-amber-700 leading-relaxed">
                                    {language === 'vi' ? `Cần đóng góp vào các chuẩn đầu ra sau: ` : `Missing required mappings for: `}
                                    <span className="font-bold">{missingSoCoverage.map(id => sos.find(s => s.id === id)?.code).join(', ')}</span>
                                </p>
                            </div>
                        </div>
                    )}
                    <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm pb-10">
                        <table className="w-full text-left text-xs min-w-[1000px]">
                            <thead className="bg-slate-50 border-b">
                                <tr><th className="p-3 font-bold text-slate-500 w-20">CLO</th><th className="p-3 font-bold text-slate-500 w-48">Related Topics</th><th className="p-3 font-bold text-slate-500 w-48">{t.teachingMethodology}</th><th className="p-3 font-bold text-slate-500 w-48">{t.assessmentType}</th><th className="p-3 font-bold text-slate-500 text-center w-24">{t.levelOfCoverage}</th><th className="p-3 font-bold text-slate-500 w-64">SOs / PIs</th></tr>
                            </thead>
                            <tbody className="divide-y">
                                {(course.clos[language] || []).map((cloText, idx) => {
                                    const map = course.cloMap?.find(m => m.cloIndex === idx) || { cloIndex: idx, topicIds: [], teachingMethodIds: [], assessmentMethodIds: [], coverageLevel: CoverageLevel.NONE, soIds: [], piIds: [] };
                                    const availableTeachingMethods = teachingMethods.filter(tm => course.topics.some(t => t.activities.some(a => a.methodId === tm.id)));
                                    const availableAssessmentMethods = assessmentMethods.filter(am => course.assessmentPlan.some(a => a.methodId === am.id));
                                    
                                    return (
                                        <tr key={idx} className="hover:bg-slate-50 align-top">
                                            <td className="p-3 font-bold text-indigo-700 bg-slate-50/50">CLO.{idx + 1}</td>
                                            <td className="p-3"><div className="flex flex-wrap gap-1">{course.topics.map(t => (<button key={t.id} onClick={() => updateCloMap(idx, { topicIds: map.topicIds.includes(t.id) ? map.topicIds.filter(i => i !== t.id) : [...map.topicIds, t.id] })} className={`px-1.5 py-0.5 border rounded text-[10px] ${map.topicIds.includes(t.id) ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-400'}`}>{t.no}</button>))}</div></td>
                                            <td className="p-3">
                                                <div className="flex flex-wrap gap-1">{availableTeachingMethods.map(tm => (
                                                    <button key={tm.id} onClick={() => updateCloMap(idx, { teachingMethodIds: map.teachingMethodIds.includes(tm.id) ? map.teachingMethodIds.filter(i => i !== tm.id) : [...map.teachingMethodIds, tm.id] })} className={`px-1.5 py-0.5 border rounded text-[10px] ${map.teachingMethodIds.includes(tm.id) ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}>{tm.code}</button>
                                                ))}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex flex-col gap-1">{availableAssessmentMethods.map(am => (
                                                    <div key={am.id} className="flex items-center gap-2" onClick={() => updateCloMap(idx, { assessmentMethodIds: map.assessmentMethodIds.includes(am.id) ? map.assessmentMethodIds.filter(i => i !== am.id) : [...map.assessmentMethodIds, am.id] })}>
                                                        <div className={`w-3 h-3 border rounded cursor-pointer ${map.assessmentMethodIds.includes(am.id) ? 'bg-emerald-500 border-emerald-600' : 'bg-white border-slate-200'}`}></div>
                                                        <span className="cursor-pointer text-slate-500">{am.name[language]}</span>
                                                    </div>
                                                ))}</div>
                                            </td>
                                            <td className="p-3 text-center"><button onClick={() => {
                                                const order = [CoverageLevel.NONE, CoverageLevel.I, CoverageLevel.R, CoverageLevel.M];
                                                updateCloMap(idx, { coverageLevel: order[(order.indexOf(map.coverageLevel as CoverageLevel) + 1) % 4] });
                                            }} className="w-8 h-8 rounded border border-slate-300 font-black flex items-center justify-center mx-auto hover:bg-slate-100 transition-colors">{map.coverageLevel || '-'}</button></td>
                                            <td className="p-3">
                                                <SoPiSelector sos={sos} selectedSoIds={map.soIds || []} selectedPiIds={map.piIds || []} globalMappedSoIds={globalMatrixExpectations.soIds} globalMappedPiIds={globalMatrixExpectations.piIds} language={language} onUpdate={(soIds, piIds) => updateCloMap(idx, { soIds, piIds })} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col relative animate-in fade-in">
            {/* ... (Keep existing AILoader, popups, and header) ... */}
            <AILoader isVisible={isProcessing || isTranslating || isExporting} message={isExporting ? "Exporting Document..." : (isTranslating ? "Translating..." : "AI Processing")} />
            
            {/* JSON Import Modal */}
            {isJsonModalOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[70vh] flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <FileJson size={20} className="text-indigo-600"/>
                                {language === 'vi' ? 'Nhập mã JSON Đề cương' : 'Paste Syllabus JSON'}
                            </h3>
                            <button onClick={() => setJsonModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                        </div>
                        <div className="flex-1 p-0 relative">
                            <textarea 
                                className="w-full h-full p-6 font-mono text-sm bg-slate-900 text-slate-100 outline-none resize-none"
                                placeholder={language === 'vi' ? 'Dán mã JSON vào đây...' : 'Paste your JSON code here...'}
                                value={jsonText}
                                onChange={e => setJsonText(e.target.value)}
                                spellCheck={false}
                            />
                        </div>
                        <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3">
                            <button onClick={() => setJsonModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-100 font-bold text-sm">
                                {language === 'vi' ? 'Hủy' : 'Cancel'}
                            </button>
                            <button onClick={handleJsonPasteImport} className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 shadow-lg flex items-center gap-2">
                                <Upload size={16}/> {language === 'vi' ? 'Nhập' : 'Import'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Popups for Editing Time/Readings (Keep existing) */}
            {editingTopicTime && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/20 backdrop-blur-sm" onClick={() => setEditingTopicTime(null)}><div className="bg-white p-4 rounded-xl shadow-xl border border-slate-200 w-80" onClick={e => e.stopPropagation()}><h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Clock size={16} /> Edit Time</h4><div className="space-y-2 mb-4">{course.topics.find(t => t.id === editingTopicTime)?.activities.map((act, idx) => (<div key={idx} className="flex gap-2 items-center"><select className="text-xs font-bold border border-slate-200 rounded p-1 flex-1" value={act.methodId} onChange={e => { const t = course.topics.find(x => x.id === editingTopicTime)!; const next = [...t.activities]; next[idx].methodId = e.target.value; updateTopic(editingTopicTime, 'activities', next); }}>{teachingMethods.map(tm => <option key={tm.id} value={tm.id}>{tm.code}</option>)}</select><input type="number" className="w-16 text-xs font-bold border border-slate-200 rounded p-1 text-center" value={act.hours} onChange={e => { const t = course.topics.find(x => x.id === editingTopicTime)!; const next = [...t.activities]; next[idx].hours = Number(e.target.value); updateTopic(editingTopicTime, 'activities', next); }} /><button onClick={() => { const t = course.topics.find(x => x.id === editingTopicTime)!; updateTopic(editingTopicTime, 'activities', t.activities.filter((_, i) => i !== idx)); }} className="text-slate-400 hover:text-red-500"><X size={14}/></button></div>))} <button onClick={() => { const t = course.topics.find(x => x.id === editingTopicTime)!; updateTopic(editingTopicTime, 'activities', [...t.activities, { methodId: teachingMethods[0].id, hours: 0 }]); }} className="w-full py-1 text-xs font-bold text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100">+ Add</button></div><div className="pt-2 border-t border-slate-100 flex justify-end"><button onClick={() => setEditingTopicTime(null)} className="px-3 py-1 bg-slate-800 text-white text-xs rounded font-bold">Done</button></div></div></div>
            )}
            {editingTopicReadings && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/20 backdrop-blur-sm" onClick={() => setEditingTopicReadings(null)}><div className="bg-white p-4 rounded-xl shadow-xl border border-slate-200 w-96" onClick={e => e.stopPropagation()}><h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Library size={16} /> Edit Readings</h4><div className="space-y-2 mb-4">{course.topics.find(t => t.id === editingTopicReadings)?.readingRefs.map((ref, idx) => (<div key={idx} className="flex gap-2 items-start bg-slate-50 p-2 rounded"><div className="flex-1 space-y-1"><select className="w-full text-xs font-bold border border-slate-200 rounded p-1" value={ref.resourceId} onChange={e => { const t = course.topics.find(x => x.id === editingTopicReadings)!; const next = [...t.readingRefs]; next[idx].resourceId = e.target.value; updateTopic(editingTopicReadings, 'readingRefs', next); }}><option value="" disabled>Select...</option>{course.textbooks.map(tb => (<option key={tb.resourceId} value={tb.resourceId}>{tb.title}</option>))}</select><input className="w-full text-[10px] border border-slate-200 rounded p-1" placeholder="Pages" value={ref.pageRange} onChange={e => { const t = course.topics.find(x => x.id === editingTopicReadings)!; const next = [...t.readingRefs]; next[idx].pageRange = e.target.value; updateTopic(editingTopicReadings, 'readingRefs', next); }} /></div><button onClick={() => { const t = course.topics.find(x => x.id === editingTopicReadings)!; updateTopic(editingTopicReadings, 'readingRefs', t.readingRefs.filter((_, i) => i !== idx)); }} className="text-slate-400 hover:text-red-500 mt-1"><X size={14}/></button></div>))} <button onClick={() => { const t = course.topics.find(x => x.id === editingTopicReadings)!; updateTopic(editingTopicReadings, 'readingRefs', [...t.readingRefs, { resourceId: '', pageRange: '' }]); }} className="w-full py-1 text-xs font-bold text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100">+ Add</button></div><div className="pt-2 border-t border-slate-100 flex justify-end"><button onClick={() => setEditingTopicReadings(null)} className="px-3 py-1 bg-slate-800 text-white text-xs rounded font-bold">Done</button></div></div></div>
            )}
            {isAddingMaterial && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsAddingMaterial(false)}><div className="bg-white rounded-xl shadow-2xl w-[600px] flex flex-col max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}><div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="font-bold text-slate-800 flex items-center gap-2"><BookOpen size={18}/> Add Material</h3><button onClick={() => setIsAddingMaterial(false)}><X size={18} className="text-slate-400" /></button></div><div className="p-4 border-b border-slate-100 flex gap-4"><button onClick={() => setMaterialMode('search')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${materialMode === 'search' ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>{t.searchLibrary}</button><button onClick={() => setMaterialMode('create')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${materialMode === 'create' ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>{t.createResource}</button></div><div className="p-6 overflow-y-auto flex-1">{materialMode === 'search' ? (<div className="space-y-4"><input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold" placeholder="Search..." value={materialSearch} onChange={e => setMaterialSearch(e.target.value)} /><div className="space-y-2">{library.filter(l => l.title.toLowerCase().includes(materialSearch.toLowerCase())).map(lib => (<div key={lib.id} className="p-3 border rounded flex justify-between items-center"><div><div className="font-bold text-sm">{lib.title}</div><div className="text-xs text-slate-500">{lib.author}</div></div><button onClick={() => { updateCourse({ textbooks: [...course.textbooks, { resourceId: lib.id, title: lib.title, author: lib.author, publisher: lib.publisher, year: lib.year, type: 'textbook' }] }); setIsAddingMaterial(false); }} className="px-3 py-1 bg-indigo-600 text-white text-xs rounded">{t.addToCourse}</button></div>))}</div></div>) : (<div className="space-y-3"><input className="w-full p-2 border rounded" placeholder="Title" value={newMaterial.title} onChange={e => setNewMaterial({...newMaterial, title: e.target.value})} /><button onClick={() => { const id = `lib-${Date.now()}`; const res = { ...newMaterial, id, type: 'textbook' as const }; updateState(prev => ({ ...prev, library: [...prev.library, res] })); updateCourse({ textbooks: [...course.textbooks, { resourceId: id, title: res.title, author: res.author, publisher: res.publisher, year: res.year, type: 'textbook' }] }); setIsAddingMaterial(false); }} className="w-full py-2 bg-indigo-600 text-white rounded text-sm font-bold">Create & Add</button></div>)}</div></div></div>
            )}

            <header className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
               <div>
                  <h2 className="text-xl font-black text-slate-800">{course.code}</h2>
                  <p className="text-sm font-medium text-slate-500">{course.name[language]}</p>
               </div>
               <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    <a 
                        href="https://gemini.google.com/gem/1ERPKel5BS-NhyaEfdUbi1DRfJ92hDKBE?usp=sharing" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="bg-white text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-2 hover:bg-indigo-50 transition shadow-sm"
                    >
                        <Sparkles size={14} /> {language === 'vi' ? 'Công cụ tạo JSON' : 'JSON Creator'}
                    </a>
                    <button onClick={exportSyllabusJson} className="bg-white text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-2 hover:bg-slate-50 transition shadow-sm"><FileJson size={14} /> JSON Export</button>
                    <button onClick={() => setJsonModalOpen(true)} className="bg-white text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-2 hover:bg-slate-50 transition shadow-sm"><Upload size={14} /> JSON Import</button>
                  </div>
               </div>
            </header>

            {renderSyllabus()}
        </div>
    );
};

export default SyllabusEditorModule;