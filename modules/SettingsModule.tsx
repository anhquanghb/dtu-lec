
import React, { useState, useRef, useEffect } from 'react';
import { AppState, GeminiConfig, Course, PEO, SO, GeneralInfo, IRM } from '../types';
import { TRANSLATIONS, INITIAL_STATE } from '../constants';
import { 
  Save, Upload, Download, Key, Database, FileUp, Sparkles, 
  AlertTriangle, RefreshCw, Trash2, MessageSquare, ChevronDown, 
  ChevronUp, Check, BrainCircuit, Send, Layout, Play, History as HistoryIcon,
  Code, Eye, X, Info, HelpCircle, Shield, ShieldOff, FileJson, CheckCircle2, ListFilter
} from 'lucide-react';
import { importProgramFromPdf, getGeminiResponse } from '../services/geminiService';
import AILoader from '../components/AILoader';

interface Props {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

// --- Import Options Type ---
type ImportSection = 'general' | 'strategy' | 'courses' | 'faculty' | 'matrices' | 'settings';

const SettingsModule: React.FC<Props> = ({ state, updateState, onExport }) => {
  const { language, geminiConfig, courses, peos, sos, authEnabled } = state;
  const t = TRANSLATIONS[language];
  
  // Basic Config State
  const [model, setModel] = useState(geminiConfig.model);
  const [apiKey, setApiKey] = useState(geminiConfig.apiKey || '');
  const [prompts, setPrompts] = useState(geminiConfig.prompts);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const programFileRef = useRef<HTMLInputElement>(null);

  // Advanced Import State
  const jsonImportRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<AppState | null>(null);
  const [importOptions, setImportOptions] = useState<Record<ImportSection, boolean>>({
      general: true,
      strategy: true,
      courses: true,
      faculty: true,
      matrices: true,
      settings: true
  });

  // AI Canvas Chat State
  const [canvasMessages, setCanvasMessages] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const [canvasInput, setCanvasInput] = useState('');
  const [isCanvasLoading, setIsCanvasLoading] = useState(false);
  const [draftData, setDraftData] = useState<any>(null);
  const canvasScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (canvasScrollRef.current) {
        canvasScrollRef.current.scrollTop = canvasScrollRef.current.scrollHeight;
    }
  }, [canvasMessages]);

  const saveConfig = () => {
    updateState(prev => ({
      ...prev,
      geminiConfig: {
        ...prev.geminiConfig,
        model,
        apiKey: apiKey.trim() || undefined,
        prompts
      }
    }));
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const toggleAuthRequirement = () => {
    const newValue = !authEnabled;
    const confirmMsg = language === 'vi' 
      ? (newValue ? "Bật yêu cầu đăng nhập bằng Google?" : "Tắt yêu cầu đăng nhập? Bất kỳ ai có liên kết đều có thể truy cập hệ thống.") 
      : (newValue ? "Enable Google Sign-In requirement?" : "Disable login requirement? Anyone with the link can access the system.");

    if (confirm(confirmMsg)) {
        updateState(prev => ({ ...prev, authEnabled: newValue }));
    }
  };

  // --- Normalization Logic ---
  const normalizeIncomingData = (data: any): AppState => {
      // 1. Start with Initial State as baseline to ensure structure
      const base: AppState = JSON.parse(JSON.stringify(INITIAL_STATE));

      // 2. Normalize General Info (Deep Merge)
      const mergedGeneralInfo: GeneralInfo = {
          ...base.generalInfo,
          ...(data.generalInfo || {}),
          previousEvaluations: { ...base.generalInfo.previousEvaluations, ...(data.generalInfo?.previousEvaluations || {}) },
          moetInfo: {
              ...base.generalInfo.moetInfo,
              ...(data.generalInfo?.moetInfo || {}),
              programStructure: { ...base.generalInfo.moetInfo.programStructure, ...(data.generalInfo?.moetInfo?.programStructure || {}) }
          }
      };

      // 3. Normalize Courses (Ensure Arrays)
      const normalizedCourses = Array.isArray(data.courses) ? data.courses.map((c: any) => ({
          ...c,
          // Ensure critical fields exist or have defaults
          credits: typeof c.credits === 'number' ? c.credits : 0,
          isEssential: !!c.isEssential,
          isAbet: c.isAbet !== undefined ? c.isAbet : !!c.isEssential, // Legacy support
          instructorDetails: c.instructorDetails || {},
          cloMap: Array.isArray(c.cloMap) ? c.cloMap.map((cm: any) => ({ ...cm, piIds: Array.isArray(cm.piIds) ? cm.piIds : [] })) : [],
          textbooks: Array.isArray(c.textbooks) ? c.textbooks : [],
          topics: Array.isArray(c.topics) ? c.topics : [],
          assessmentPlan: Array.isArray(c.assessmentPlan) ? c.assessmentPlan : []
      })) : [];

      // 4. Normalize Faculty
      const normalizedFaculty = Array.isArray(data.faculties) ? data.faculties : [];

      // 5. Return fully normalized state
      return {
          ...base,
          language: data.language || 'en', // Keep import language or default
          authEnabled: data.authEnabled !== undefined ? data.authEnabled : base.authEnabled,
          currentUser: base.currentUser, // Do not overwrite current user session
          users: Array.isArray(data.users) ? data.users : base.users,
          mission: data.mission || base.mission,
          peos: Array.isArray(data.peos) ? data.peos : [],
          sos: Array.isArray(data.sos) ? data.sos : [],
          courses: normalizedCourses,
          faculties: normalizedFaculty,
          knowledgeAreas: Array.isArray(data.knowledgeAreas) ? data.knowledgeAreas : base.knowledgeAreas,
          teachingMethods: Array.isArray(data.teachingMethods) ? data.teachingMethods : base.teachingMethods,
          assessmentMethods: Array.isArray(data.assessmentMethods) ? data.assessmentMethods : base.assessmentMethods,
          facultyTitles: data.facultyTitles || base.facultyTitles,
          geminiConfig: { ...base.geminiConfig, ...(data.geminiConfig || {}) },
          generalInfo: mergedGeneralInfo,
          library: Array.isArray(data.library) ? data.library : [],
          courseSoMap: Array.isArray(data.courseSoMap) ? data.courseSoMap : [],
          coursePiMap: Array.isArray(data.coursePiMap) ? data.coursePiMap : [],
          coursePeoMap: Array.isArray(data.coursePeoMap) ? data.coursePeoMap : [],
          peoSoMap: Array.isArray(data.peoSoMap) ? data.peoSoMap : [],
          peoConstituentMap: Array.isArray(data.peoConstituentMap) ? data.peoConstituentMap : [],
      };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const rawData = JSON.parse(event.target?.result as string);
              const normalized = normalizeIncomingData(rawData);
              setPendingImport(normalized);
              e.target.value = ''; // Reset input
          } catch (err) {
              alert(language === 'vi' ? "Lỗi: File JSON không hợp lệ." : "Error: Invalid JSON file.");
          }
      };
      reader.readAsText(file);
  };

  const confirmImport = () => {
      if (!pendingImport) return;

      updateState(prev => {
          const nextState = { ...prev };

          if (importOptions.general) {
              nextState.generalInfo = pendingImport.generalInfo;
              nextState.mission = pendingImport.mission;
              nextState.library = pendingImport.library;
          }
          if (importOptions.strategy) {
              nextState.peos = pendingImport.peos;
              nextState.sos = pendingImport.sos;
          }
          if (importOptions.courses) {
              nextState.courses = pendingImport.courses;
              nextState.knowledgeAreas = pendingImport.knowledgeAreas;
              nextState.teachingMethods = pendingImport.teachingMethods;
              nextState.assessmentMethods = pendingImport.assessmentMethods;
          }
          if (importOptions.faculty) {
              nextState.faculties = pendingImport.faculties;
              nextState.facultyTitles = pendingImport.facultyTitles;
          }
          if (importOptions.matrices) {
              nextState.courseSoMap = pendingImport.courseSoMap;
              nextState.coursePiMap = pendingImport.coursePiMap;
              nextState.coursePeoMap = pendingImport.coursePeoMap;
              nextState.peoSoMap = pendingImport.peoSoMap;
              nextState.peoConstituentMap = pendingImport.peoConstituentMap;
          }
          if (importOptions.settings) {
              // Crucial: Preserve the User's Local API Key
              const currentApiKey = prev.geminiConfig?.apiKey;
              nextState.geminiConfig = {
                  ...pendingImport.geminiConfig,
                  apiKey: currentApiKey // Retain current local key, do not overwrite with null or imported key
              };
              nextState.users = pendingImport.users;
              nextState.authEnabled = pendingImport.authEnabled;
          }

          return nextState;
      });

      setPendingImport(null);
      alert(language === 'vi' ? "Nhập dữ liệu thành công!" : "Data imported successfully!");
  };

  const handleCanvasChat = async () => {
    if (!canvasInput.trim() || isCanvasLoading) return;

    const userText = canvasInput;
    setCanvasMessages(prev => [...prev, { role: 'user', text: userText }]);
    setCanvasInput('');
    setIsCanvasLoading(true);

    try {
        const schemaContext = `
            You are the "AI Data Architect" for the ABET Master system.
            SYSTEM SCHEMA:
            - Course: { code: string, name: {vi, en}, credits: number, semester: number, type: 'REQUIRED'|'ELECTIVE'|'SELECTED_ELECTIVE', knowledgeAreaId: string, prerequisites: string[] }
            - PEO: { code: string, title: {vi, en}, description: {vi, en} }
            - SO: { number: number, code: string, description: {vi, en}, pis: {code, description: {vi, en}}[] }

            KNOWLEDGE AREAS: ${state.knowledgeAreas.map(ka => `${ka.id} (${ka.name.vi})`).join(', ')}

            RULES:
            1. If the user asks to create or update data, respond with a text message AND a JSON block.
            2. The JSON block must have this structure: {"type": "COURSE_BULK" | "PEO_BULK" | "SO_BULK", "data": [...array of objects fitting schema...]}
            3. CRITICAL: If mandatory fields (like credits or knowledgeAreaId) are missing from user prompt, use common sense defaults but notify the user in text.
            4. If data is incomplete, ask the user to provide the missing parts.
            5. Current counts: ${courses.length} courses, ${peos.length} PEOs, ${sos.length} SOs.
            6. Respond in ${language === 'vi' ? 'Vietnamese' : 'English'}.
        `;

        const response = await getGeminiResponse(`${schemaContext}\nUser Request: ${userText}`, geminiConfig);
        
        // Extract JSON if present
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const extracted = JSON.parse(jsonMatch[0]);
                setDraftData(extracted);
                // Clean the response text for display
                const cleanText = response.replace(/```json[\s\S]*```/g, '').replace(/\{[\s\S]*\}/g, '').trim();
                setCanvasMessages(prev => [...prev, { role: 'ai', text: cleanText || (language === 'vi' ? "Tôi đã chuẩn bị dữ liệu trong Canvas bên phải." : "I have prepared the data in the Canvas on the right.") }]);
            } catch (e) {
                setCanvasMessages(prev => [...prev, { role: 'ai', text: response }]);
            }
        } else {
            setCanvasMessages(prev => [...prev, { role: 'ai', text: response }]);
        }
    } catch (err) {
        setCanvasMessages(prev => [...prev, { role: 'ai', text: "Error communicating with AI. Please check settings." }]);
    } finally {
        setIsCanvasLoading(false);
    }
  };

  const commitDraftData = () => {
      if (!draftData) return;
      
      updateState(prev => {
          const next = { ...prev };
          if (draftData.type === 'COURSE_BULK') {
              const newCourses = draftData.data.map((c: any) => ({
                  ...c,
                  id: c.id || `CID-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  isEssential: c.isEssential ?? false,
                  type: c.type || 'REQUIRED',
                  knowledgeAreaId: c.knowledgeAreaId || 'other',
                  colIndex: 0,
                  prerequisites: c.prerequisites || [],
                  coRequisites: c.coRequisites || [],
                  description: c.description || { vi: '', en: '' },
                  textbooks: [],
                  clos: { vi: [], en: [] },
                  topics: [],
                  assessmentPlan: [],
                  instructorIds: [],
                  instructorDetails: {},
                  cloMap: []
              }));
              next.courses = [...next.courses, ...newCourses];
          } else if (draftData.type === 'PEO_BULK') {
              const newPeos = draftData.data.map((p: any) => ({
                  ...p,
                  id: `PEO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
              }));
              next.peos = [...next.peos, ...newPeos];
          } else if (draftData.type === 'SO_BULK') {
              const newSos = draftData.data.map((s: any) => ({
                  ...s,
                  id: `SO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  pis: (s.pis || []).map((pi: any) => ({ ...pi, id: `PI-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` }))
              }));
              next.sos = [...next.sos, ...newSos];
          }
          return next;
      });

      alert(language === 'vi' ? "Đã cập nhật dữ liệu thành công!" : "Data updated successfully!");
      setDraftData(null);
  };

  const clearData = () => {
      const msg = language === 'vi' 
        ? 'CẢNH BÁO: Thao tác này sẽ xóa TOÀN BỘ dữ liệu thiết kế (Môn học, Giảng viên, PEOs, SOs, Sứ mạng, Thư viện và các Ma trận liên kết). Bạn có chắc chắn muốn thực hiện?' 
        : 'WARNING: This will clear ALL design data (Courses, Faculty, PEOs, SOs, Mission, Library, and all Mapping Matrices). Are you sure?';

      if (confirm(msg)) {
          updateState(prev => ({
              ...prev,
              // Clear Curriculum Design Core
              courses: [],
              faculties: [],
              library: [],
              peos: [],
              sos: [],
              mission: {
                  text: { vi: '', en: '' },
                  constituents: []
              },
              // Clear All Mapping Matrices
              courseSoMap: [],
              coursePiMap: [],
              coursePeoMap: [],
              peoSoMap: [],
              peoConstituentMap: [],
              // Reset Program Specifications
              generalInfo: {
                  ...prev.generalInfo,
                  history: { vi: '', en: '' },
                  contact: { vi: '', en: '' },
                  deliveryModes: { vi: '', en: '' },
                  locations: { vi: '', en: '' },
                  previousEvaluations: {
                      weaknesses: { vi: '', en: '' },
                      actions: { vi: '', en: '' },
                      status: { vi: '', en: '' }
                  },
                  moetInfo: {
                      ...prev.generalInfo.moetInfo,
                      generalObjectives: { vi: '', en: '' },
                      specificObjectives: [],
                      programStructure: { gen: [], fund: [], spec: [], grad: [] },
                      courseObjectiveMap: []
                  }
              }
          }));
          alert(language === 'vi' ? "Dữ liệu đã được xóa sạch." : "Data has been cleared.");
      }
  };

  const normalizeData = () => {
    const confirmMsg = language === 'vi' 
        ? "Thao tác này sẽ:\n1. Chuẩn hóa ID cho Môn học và Giảng viên.\n2. Xóa các liên kết mapping bị lỗi.\n3. Xoá bỏ môn học thừa trong Cấu trúc chương trình (Module 8) không tồn tại trong danh mục.\n\nTiếp tục?" 
        : "This will:\n1. Standardize IDs for Courses and Faculty.\n2. Remove broken mapping links.\n3. Remove orphaned courses in Program Structure (Module 8) that do not exist in the catalog.\n\nContinue?";

    if (!confirm(confirmMsg)) return;

    updateState(prev => {
        const idMap = {
            courses: new Map<string, string>(),
            faculty: new Map<string, string>(),
        };

        const genId = (prefix: string, seed: string | number) => `${prefix}-${seed}`;

        const newFaculties = prev.faculties.map((f, i) => {
            const safeName = f.name[prev.language].normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 10);
            const newId = genId('fac', `${safeName}_${i}`);
            idMap.faculty.set(f.id, newId);
            return { ...f, id: newId };
        });

        const newCourses = prev.courses.map((c, i) => {
            let baseId = c.code.trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '');
            if (!baseId || baseId.length < 2) baseId = genId('CID', i);
            if (Array.from(idMap.courses.values()).includes(baseId)) baseId = `${baseId}_${i}`;
            idMap.courses.set(c.id, baseId);
            
            const newInstructorIds = c.instructorIds.map(fid => idMap.faculty.get(fid) || fid).filter(id => newFaculties.some(f => f.id === id));
            const newInstructorDetails: any = {};
            Object.keys(c.instructorDetails || {}).forEach(oldFid => {
                const newFid = idMap.faculty.get(oldFid);
                if (newFid && newFaculties.some(f => f.id === newFid)) {
                    newInstructorDetails[newFid] = c.instructorDetails![oldFid];
                }
            });

            return { ...c, id: baseId, instructorIds: newInstructorIds, instructorDetails: newInstructorDetails };
        });

        const newCourseSoMap = prev.courseSoMap.map(m => ({ ...m, courseId: idMap.courses.get(m.courseId) || m.courseId })).filter(m => newCourses.some(c => c.id === m.courseId));
        const newCoursePiMap = prev.coursePiMap.map(m => ({ ...m, courseId: idMap.courses.get(m.courseId) || m.courseId })).filter(m => newCourses.some(c => c.id === m.courseId));
        const newCoursePeoMap = prev.coursePeoMap.map(m => ({ ...m, courseId: idMap.courses.get(m.courseId) || m.courseId })).filter(m => newCourses.some(c => c.id === m.courseId));

        const cleanStructureList = (list: string[] = []) => list.map(id => idMap.courses.get(id) || id).filter(id => newCourses.some(c => c.id === id));

        const newProgramStructure = {
            gen: cleanStructureList(prev.generalInfo.moetInfo.programStructure.gen),
            fund: cleanStructureList(prev.generalInfo.moetInfo.programStructure.fund),
            spec: cleanStructureList(prev.generalInfo.moetInfo.programStructure.spec),
            grad: cleanStructureList(prev.generalInfo.moetInfo.programStructure.grad),
        };

        const newCourseObjectiveMap = (prev.generalInfo.moetInfo.courseObjectiveMap || []).map(str => {
            const [cid, oid] = str.split('|');
            const newCid = idMap.courses.get(cid) || cid;
            return newCourses.some(c => c.id === newCid) ? `${newCid}|${oid}` : null;
        }).filter(Boolean) as string[];

        return {
            ...prev,
            courses: newCourses, faculties: newFaculties, courseSoMap: newCourseSoMap, coursePiMap: newCoursePiMap, coursePeoMap: newCoursePeoMap,
            generalInfo: { ...prev.generalInfo, moetInfo: { ...prev.generalInfo.moetInfo, programStructure: newProgramStructure, courseObjectiveMap: newCourseObjectiveMap } }
        };
    });
    alert(language === 'vi' ? "Dữ liệu đã được chuẩn hóa và làm sạch!" : "Data normalized and cleaned!");
  };

  const handleProgramAiImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAiProcessing(true);
    try {
        const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split(',')[1]) : reject(new Error("Failed"));
            reader.readAsDataURL(file);
        });
        const data = await importProgramFromPdf(base64, geminiConfig);
        if (data) {
            // High level merge logic...
            updateState(prev => ({ ...prev })); 
            alert("Import successful!");
        }
    } catch (e) {
        alert("Import failed.");
    } finally {
        setIsAiProcessing(false);
    }
  };

  const OptionCheckbox = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: (v: boolean) => void }) => (
      <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${checked ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:border-indigo-200'}`}>
          <div className={`w-5 h-5 rounded flex items-center justify-center border ${checked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
              {checked && <Check size={14} className="text-white"/>}
          </div>
          <input type="checkbox" className="hidden" checked={checked} onChange={e => onChange(e.target.checked)} />
          <span className={`text-xs font-bold ${checked ? 'text-indigo-700' : 'text-slate-600'}`}>{label}</span>
      </label>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-12 p-8 animate-in fade-in">
      <AILoader isVisible={isAiProcessing} message={language === 'vi' ? 'Đang phân tích chương trình...' : 'Analyzing Program...'} />
      
      {/* Import Preview Modal */}
      {pendingImport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-white/20">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                              <RefreshCw size={24}/>
                          </div>
                          <div>
                              <h3 className="text-lg font-black text-slate-800">{language === 'vi' ? 'Chuẩn hóa & Nhập dữ liệu' : 'Normalize & Import Data'}</h3>
                              <p className="text-xs text-slate-500 font-medium">{language === 'vi' ? 'Dữ liệu đã được chuẩn hóa lên phiên bản mới nhất.' : 'Data has been normalized to the latest schema version.'}</p>
                          </div>
                      </div>
                      <button onClick={() => setPendingImport(null)} className="p-2 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors"><X size={20}/></button>
                  </div>
                  
                  <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                              <div className="text-2xl font-black text-slate-700">{pendingImport.courses.length}</div>
                              <div className="text-[10px] uppercase font-bold text-slate-400">{language === 'vi' ? 'Môn học' : 'Courses'}</div>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                              <div className="text-2xl font-black text-slate-700">{pendingImport.faculties.length}</div>
                              <div className="text-[10px] uppercase font-bold text-slate-400">{language === 'vi' ? 'Giảng viên' : 'Faculty'}</div>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                              <div className="text-2xl font-black text-slate-700">{pendingImport.peos.length + pendingImport.sos.length}</div>
                              <div className="text-[10px] uppercase font-bold text-slate-400">PEOs + SOs</div>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                              <div className="text-2xl font-black text-slate-700">{pendingImport.courseSoMap.length}</div>
                              <div className="text-[10px] uppercase font-bold text-slate-400">Mappings</div>
                          </div>
                      </div>

                      {/* Import Options */}
                      <div className="space-y-3">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ListFilter size={12}/> {language === 'vi' ? 'Tùy chọn nhập liệu' : 'Import Options'}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <OptionCheckbox label={language === 'vi' ? 'Thông tin chung & Sứ mạng' : 'General Info & Mission'} checked={importOptions.general} onChange={v => setImportOptions({...importOptions, general: v})} />
                              <OptionCheckbox label={language === 'vi' ? 'Mục tiêu & Chuẩn đầu ra (PEOs/SOs)' : 'Strategy & Outcomes'} checked={importOptions.strategy} onChange={v => setImportOptions({...importOptions, strategy: v})} />
                              <OptionCheckbox label={language === 'vi' ? 'Môn học & Khối kiến thức' : 'Courses & Knowledge Areas'} checked={importOptions.courses} onChange={v => setImportOptions({...importOptions, courses: v})} />
                              <OptionCheckbox label={language === 'vi' ? 'Danh sách Giảng viên' : 'Faculty List'} checked={importOptions.faculty} onChange={v => setImportOptions({...importOptions, faculty: v})} />
                              <OptionCheckbox label={language === 'vi' ? 'Các Ma trận (Mapping Matrices)' : 'Mapping Matrices'} checked={importOptions.matrices} onChange={v => setImportOptions({...importOptions, matrices: v})} />
                              <OptionCheckbox label={language === 'vi' ? 'Cấu hình & Tài khoản' : 'Config & Accounts'} checked={importOptions.settings} onChange={v => setImportOptions({...importOptions, settings: v})} />
                          </div>
                      </div>

                      <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 flex gap-3 items-start">
                          <Info size={16} className="text-amber-500 shrink-0 mt-0.5"/>
                          <p className="text-xs text-amber-700 leading-relaxed">
                              {language === 'vi' ? 'Lưu ý: Dữ liệu hiện tại sẽ bị ghi đè dựa trên các mục bạn đã chọn. Các mục không chọn sẽ giữ nguyên dữ liệu cũ.' : 'Note: Current data will be overwritten based on your selection. Unselected sections will retain existing data.'}
                          </p>
                      </div>
                  </div>

                  <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                      <button onClick={() => setPendingImport(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors">Cancel</button>
                      <button onClick={confirmImport} className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 flex items-center gap-2">
                          <CheckCircle2 size={14}/> {language === 'vi' ? 'Xác nhận Nhập' : 'Confirm Import'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Security & Access Settings */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-indigo-600">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Shield className="text-indigo-600" size={20}/> {t.security}
            </h2>
            <div 
              onClick={toggleAuthRequirement}
              className={`w-14 h-7 rounded-full flex items-center p-1 cursor-pointer transition-all duration-300 ${authEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
            >
              <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${authEnabled ? 'translate-x-7' : 'translate-x-0'} flex items-center justify-center`}>
                {authEnabled ? <Shield size={12} className="text-indigo-600"/> : <ShieldOff size={12} className="text-slate-400"/>}
              </div>
            </div>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl flex items-start gap-4">
            <div className={`p-2 rounded-lg ${authEnabled ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                {authEnabled ? <Shield size={20}/> : <AlertTriangle size={20}/>}
            </div>
            <div>
                <p className="text-sm font-bold text-slate-800">
                    {authEnabled ? t.authRequirement + ": ENABLED" : t.authRequirement + ": DISABLED"}
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {authEnabled ? t.authEnabledDesc : t.authDisabledDesc}
                </p>
            </div>
        </div>
      </section>

      {/* AI Configuration */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Key className="text-indigo-600" size={20}/> AI Configuration (Gemini)
        </h2>
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Model</label>
                    <select 
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={model}
                        onChange={e => setModel(e.target.value)}
                    >
                        <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast)</option>
                        <option value="gemini-3-pro-preview">Gemini 3 Pro (High Quality)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">API Key (Optional)</label>
                    <input 
                        type="password"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="System default if empty..."
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                    />
                </div>
                <div className="md:col-span-2">
                    <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-start gap-2">
                      <Info size={14} className="inline mt-0.5 text-indigo-500 shrink-0" />
                      <span>
                        {language === 'vi' 
                          ? 'Nếu bạn nhập API Key ở đây, nó sẽ được ưu tiên sử dụng thay cho biến môi trường hệ thống. Key này chỉ lưu trong trình duyệt của bạn và KHÔNG được xuất ra khi bạn "Xuất dữ liệu".' 
                          : 'If you enter an API Key here, it will be used instead of the system environment variable. This key is stored locally in your browser and is NOT exported when you use "Export Data".'}
                      </span>
                    </p>
                </div>
            </div>

            <div className="border-t border-slate-100 pt-4 mt-2">
                <button 
                    onClick={() => setShowPrompts(!showPrompts)}
                    className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
                >
                    <MessageSquare size={14} /> 
                    {language === 'vi' ? 'Tùy chỉnh Prompts nâng cao' : 'Advanced Prompt Customization'}
                    {showPrompts ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                </button>
                {showPrompts && (
                    <div className="mt-4 space-y-4 animate-in slide-in-from-top-2">
                        {Object.entries(prompts).map(([key, value]) => (
                            <div key={key}>
                                <label className="block text-[9px] font-black text-slate-400 mb-1 uppercase tracking-wider">{key}</label>
                                <textarea 
                                    className="w-full p-3 border border-slate-200 rounded-xl text-xs font-mono bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-y"
                                    value={value}
                                    onChange={e => setPrompts(prev => ({ ...prev, [key]: e.target.value }))}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <button 
                onClick={saveConfig}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
            >
                {showSuccess ? <Check size={16}/> : <Save size={16}/>} {language === 'vi' ? 'Lưu thay đổi' : 'Save Configuration'}
            </button>
        </div>
      </section>

      {/* Data Management */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Database className="text-emerald-600" size={20}/> {language === 'vi' ? 'Quản lý Dữ liệu' : 'Data Management'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button onClick={onExport} className="p-6 border border-slate-200 rounded-2xl hover:bg-slate-50 flex flex-col items-center gap-3 transition-all group hover:border-emerald-300 text-left">
                <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform"><Download size={24}/></div>
                <div className="text-center md:text-left">
                    <span className="font-bold text-slate-800 block">{language === 'vi' ? 'Xuất dữ liệu' : 'Export Data'}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest">JSON Format</span>
                </div>
            </button>
            <label className="p-6 border border-slate-200 rounded-2xl hover:bg-slate-50 flex flex-col items-center gap-3 transition-all cursor-pointer group hover:border-blue-300">
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform"><Upload size={24}/></div>
                <div className="text-center md:text-left">
                    <span className="font-bold text-slate-800 block">{language === 'vi' ? 'Nhập dữ liệu' : 'Import Data'}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest">JSON Format</span>
                </div>
                <input type="file" ref={jsonImportRef} className="hidden" accept=".json" onChange={handleFileSelect} />
            </label>
            <label className="p-6 border-2 border-dashed border-indigo-200 bg-indigo-50/20 rounded-2xl hover:bg-indigo-50/50 flex flex-col items-center gap-3 transition-all cursor-pointer group">
                <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-lg shadow-indigo-200"><Sparkles size={24}/></div>
                <div className="text-center md:text-left">
                    <span className="font-bold text-indigo-700 block">{language === 'vi' ? 'Nhập CTĐT (AI)' : 'Import Program (AI)'}</span>
                    <span className="text-[10px] text-indigo-400 uppercase tracking-widest">Auto-PDF Parse</span>
                </div>
                <input type="file" ref={programFileRef} className="hidden" accept=".pdf" onChange={handleProgramAiImport} />
            </label>
        </div>
      </section>

      {/* AI Data Architect (Canvas) */}
      <section className="bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-800 relative min-h-[600px] flex flex-col">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none"></div>
        
        {/* Header */}
        <div className="p-8 border-b border-slate-800 bg-slate-950/60 backdrop-blur-xl flex justify-between items-center z-10">
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/20 rotate-3">
                    <BrainCircuit className="text-white" size={32} />
                </div>
                <div>
                    <h3 className="text-xl font-black text-white tracking-tight uppercase">AI Data Architect</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        <p className="text-[10px] text-indigo-400 font-mono uppercase tracking-[0.2em]">{language === 'vi' ? 'Nhập liệu thông minh kiểu Canvas' : 'Smart Canvas Data Entry'}</p>
                    </div>
                </div>
            </div>
            <div className="flex gap-4">
                <button 
                    onClick={() => { setCanvasMessages([]); setDraftData(null); }} 
                    className="p-3 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all border border-slate-700" 
                    title="Clear All"
                >
                    <RefreshCw size={20}/>
                </button>
            </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row min-h-0 z-10">
            {/* Chat Pane */}
            <div className="flex-1 flex flex-col border-r border-slate-800/50 p-8">
                <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar mb-6 pr-4" ref={canvasScrollRef}>
                    {canvasMessages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-60 max-w-sm mx-auto">
                            <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center mb-6">
                                <MessageSquare size={40} className="text-indigo-400" />
                            </div>
                            <h4 className="text-white font-bold mb-2">{language === 'vi' ? 'Bắt đầu thiết kế dữ liệu' : 'Start Architecting Data'}</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                {language === 'vi' 
                                    ? "Yêu cầu AI tạo hàng loạt môn học, chuẩn đầu ra hoặc mục tiêu. AI sẽ đảm bảo dữ liệu đúng chuẩn và hỏi thêm nếu thiếu thông tin."
                                    : "Ask AI to generate bulk courses, SOs, or PEOs. AI will ensure schema compliance and ask for clarification if info is missing."}
                            </p>
                            <div className="grid grid-cols-1 gap-2 mt-8 w-full">
                                <button onClick={() => setCanvasInput(language === 'vi' ? "Tạo giúp tôi 5 môn học cơ sở ngành về Khoa học dữ liệu." : "Create 5 fundamental courses for Data Science.")} className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-lg hover:bg-indigo-500/20 transition-all text-left">
                                    "Create 5 Data Science courses..."
                                </button>
                                <button onClick={() => setCanvasInput(language === 'vi' ? "Đề xuất danh sách 7 Student Outcomes (SOs) cho ngành Kỹ thuật Điện." : "Suggest 7 Student Outcomes (SOs) for Electrical Engineering.")} className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-2 rounded-lg hover:bg-purple-500/20 transition-all text-left">
                                    "Suggest 7 SOs for Electrical Eng..."
                                </button>
                            </div>
                        </div>
                    )}
                    {canvasMessages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                            <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-2xl ${
                                msg.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-tr-none' 
                                : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none ring-1 ring-white/5'
                            }`}>
                                <div className="whitespace-pre-wrap">{msg.text}</div>
                                {msg.role === 'ai' && draftData && i === canvasMessages.length - 1 && (
                                    <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center gap-2 text-[10px] font-bold text-indigo-400">
                                        <Info size={12}/> {language === 'vi' ? 'Dữ liệu thô đã sẵn sàng bên phải' : 'Raw data ready in the canvas'}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isCanvasLoading && (
                        <div className="flex justify-start">
                            <div className="bg-slate-800 rounded-2xl rounded-tl-none p-4 border border-slate-700 flex gap-2">
                                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-75"></div>
                                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-150"></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-500"></div>
                    <input 
                        className="relative w-full bg-slate-950 border border-slate-800 text-white rounded-2xl pl-5 pr-16 py-5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-600 shadow-2xl"
                        placeholder={language === 'vi' ? "Yêu cầu kiến trúc dữ liệu mới..." : "Request new data architecture..."}
                        value={canvasInput}
                        onChange={e => setCanvasInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCanvasChat()}
                        disabled={isCanvasLoading}
                    />
                    <button 
                        onClick={handleCanvasChat}
                        disabled={!canvasInput.trim() || isCanvasLoading}
                        className="absolute right-3 top-3 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all disabled:opacity-30 shadow-lg"
                    >
                        <Send size={20} />
                    </button>
                </div>
            </div>

            {/* Canvas Pane */}
            <div className="w-full lg:w-[500px] bg-slate-950/40 flex flex-col p-8 border-t lg:border-t-0 lg:border-l border-slate-800 relative">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Layout size={18} className="text-indigo-400" />
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">
                             {language === 'vi' ? 'Live Canvas Preview' : 'Live Canvas Preview'}
                        </h4>
                    </div>
                    {draftData && (
                        <div className="flex items-center gap-2">
                             <span className="bg-amber-500/10 text-amber-500 px-2.5 py-1 rounded-full text-[9px] font-black uppercase border border-amber-500/20 flex items-center gap-1.5">
                                <Eye size={10}/> {language === 'vi' ? 'Chờ kiểm tra' : 'Review Pending'}
                             </span>
                        </div>
                    )}
                </div>

                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden flex flex-col shadow-inner">
                    {!draftData ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-12 text-center">
                            <Code size={48} className="mb-6 opacity-10" />
                            <p className="text-xs font-medium italic opacity-40 max-w-[200px]">
                                {language === 'vi' ? 'Dữ liệu được tạo sẽ hiển thị ở đây để bạn kiểm tra trước khi lưu.' : 'Generated data will appear here for your review before commitment.'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="p-5 bg-slate-800/40 border-b border-slate-800 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="bg-indigo-50/20 text-indigo-400 p-2 rounded-lg">
                                        <Code size={16}/>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black text-white uppercase block">{draftData.type}</span>
                                        <span className="text-[9px] text-slate-500 font-bold">{draftData.data.length} items detected</span>
                                    </div>
                                </div>
                                <button onClick={() => setDraftData(null)} className="p-2 text-slate-500 hover:text-red-400 transition-colors"><X size={18}/></button>
                            </div>
                            
                            {/* Visual List Preview (better than raw JSON) */}
                            <div className="flex-1 overflow-auto p-4 custom-scrollbar-dark bg-slate-950/30">
                                <div className="space-y-2">
                                    {draftData.data.map((item: any, idx: number) => (
                                        <div key={idx} className="p-3 bg-slate-900/50 border border-slate-800 rounded-xl flex items-center gap-3 group hover:border-indigo-500/30 transition-all">
                                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500 group-hover:text-indigo-400 transition-colors">
                                                {item.code || item.number || idx + 1}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[11px] font-bold text-slate-300 truncate">
                                                    {typeof item.name === 'object' ? item.name[language] : (typeof item.title === 'object' ? item.title[language] : item.description?.[language] || 'Incomplete Data')}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1">
                                                    {item.credits && <span className="text-[9px] font-bold text-slate-500 uppercase">{item.credits} Credits</span>}
                                                    {item.semester && <span className="text-[9px] font-bold text-slate-500 uppercase">Sem {item.semester}</span>}
                                                    {item.type && <span className="text-[9px] font-bold text-slate-500 uppercase">{item.type}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Raw JSON Toggle if needed */}
                                <details className="mt-6 border-t border-slate-800 pt-4">
                                    <summary className="text-[9px] font-black text-slate-600 uppercase cursor-pointer hover:text-slate-400 transition-colors list-none flex items-center gap-2">
                                        <HelpCircle size={10}/> {language === 'vi' ? 'Xem mã JSON thô' : 'View Raw JSON'}
                                    </summary>
                                    <pre className="mt-4 text-[10px] text-emerald-500/80 font-mono leading-relaxed bg-slate-950 p-4 rounded-xl overflow-auto max-h-40">
                                        {JSON.stringify(draftData.data, null, 2)}
                                    </pre>
                                </details>
                            </div>

                            <div className="p-6 bg-slate-950/80 border-t border-slate-800 backdrop-blur-md">
                                <button 
                                    onClick={commitDraftData}
                                    className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:from-emerald-500 hover:to-teal-500 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-emerald-900/20 ring-1 ring-white/10"
                                >
                                    <Play size={18} fill="currentColor" /> {language === 'vi' ? 'Cập nhật vào hệ thống' : 'Commit to Database'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
      </section>
      
      {/* Advanced Tools */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
         <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={20}/> {language === 'vi' ? 'Công cụ hệ thống nâng cao' : 'Advanced System Tools'}
        </h2>
        <div className="space-y-4">
            <p className="text-sm text-slate-600 font-medium">
                {language === 'vi' ? 'Sử dụng các công cụ này để làm sạch dữ liệu. Hãy sao lưu dữ liệu trước khi thực hiện.' : 'Use these tools to fix data inconsistencies. Backup your data before proceeding.'}
            </p>
            <div className="flex flex-wrap gap-4">
                <button 
                    onClick={normalizeData}
                    className="bg-amber-100 text-amber-700 px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-amber-200 border border-amber-200 transition-all shadow-sm"
                >
                    <RefreshCw size={16}/> {language === 'vi' ? 'Chuẩn hóa ID & Làm sạch' : 'Normalize & Clean'}
                </button>
                <button 
                    onClick={clearData}
                    className="bg-red-50 text-red-600 px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-red-100 border border-red-200 transition-all shadow-sm"
                >
                    <Trash2 size={16}/> {language === 'vi' ? 'Xóa toàn bộ' : 'Clear All Data'}
                </button>
            </div>
        </div>
      </section>
      
      <style>{`
        .custom-scrollbar-dark::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar-dark::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-dark::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar-dark::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
};

export default SettingsModule;
