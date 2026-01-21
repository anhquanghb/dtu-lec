
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppState, Faculty, FacultyTitles, FacultyTitle, FacultyListItem, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { Search, Plus, Trash2, Edit2, User, GraduationCap, Briefcase, Award, ScrollText, Mail, Download, X, BookOpen, Layers, Star, Briefcase as BriefcaseIcon, Settings, List, BarChart3, Medal, Activity, Languages, Sparkles, Loader2, FileText, Phone, MapPin, FileJson, Upload, Filter } from 'lucide-react';
import { importFacultyFromPdf, translateContent } from '../services/geminiService';
import { exportFacultyCvPdf } from '../services/FacultyExportPDF';
import AILoader from '../components/AILoader';

interface Props {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const FacultyModule: React.FC<Props> = ({ state, updateState }) => {
  const { faculties, language, geminiConfig, facultyTitles, courses } = state;
  const t = TRANSLATIONS[language];
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [editLanguage, setEditLanguage] = useState<Language>(language);
  
  // JSON Import Modal State
  const [isJsonModalOpen, setJsonModalOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  
  // Refs for file inputs
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Edit Form Tabs
  const [editFormTab, setEditFormTab] = useState<'info' | 'edu' | 'exp' | 'research' | 'achievements' | 'activities'>('info');

  // Sync edit language with app language initially or when changed
  useEffect(() => {
      setEditLanguage(language);
  }, [language]);

  // --- Filtering & Sorting ---
  const filteredFaculties = useMemo(() => {
    // 1. Filter by Search
    let filtered = faculties.filter(f => 
      (f.name[language] || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // 2. Sort by Vietnamese Name (Last Word)
    return filtered.sort((a, b) => {
        const getNameParts = (name: string) => name.trim().split(/\s+/);
        const nameA = a.name[language] || a.name['en'] || '';
        const nameB = b.name[language] || b.name['en'] || '';
        
        const partsA = getNameParts(nameA);
        const partsB = getNameParts(nameB);
        
        const lastNameA = partsA[partsA.length - 1].toLowerCase();
        const lastNameB = partsB[partsB.length - 1].toLowerCase();

        // Compare last name first
        const comparison = lastNameA.localeCompare(lastNameB, 'vi');
        
        // If last names are equal, compare the full string to ensure consistent order
        return comparison !== 0 ? comparison : nameA.localeCompare(nameB, 'vi');
    });
  }, [faculties, searchQuery, language]);

  // --- Actions ---
  const handleAdd = () => {
    const newFaculty: Faculty = {
      id: `fac-${Date.now()}`,
      name: { vi: 'Giảng viên Mới', en: 'New Faculty' },
      rank: { vi: '', en: '' },
      degree: { vi: '', en: '' },
      academicTitle: { vi: '', en: '' },
      position: { vi: '', en: '' },
      experience: { vi: '0', en: '0' },
      workload: 0,
      educationList: [],
      academicExperienceList: [],
      nonAcademicExperienceList: [],
      publicationsList: [],
      certificationsList: [],
      membershipsList: [],
      honorsList: [],
      serviceActivitiesList: [],
      professionalDevelopmentList: []
    };
    updateState(prev => ({ ...prev, faculties: [...prev.faculties, newFaculty] }));
    setEditingId(newFaculty.id);
    setEditFormTab('info');
  };

  const handleDelete = (id: string) => {
    if (confirm(language === 'vi' ? "Xóa giảng viên này?" : "Delete this faculty member?")) {
      updateState(prev => ({ ...prev, faculties: prev.faculties.filter(f => f.id !== id) }));
      if (editingId === id) setEditingId(null);
    }
  };

  const updateFaculty = (id: string, field: keyof Faculty, value: any) => {
    updateState(prev => ({
      ...prev,
      faculties: prev.faculties.map(f => f.id === id ? { ...f, [field]: value } : f)
    }));
  };
  
  const updateFacultyLang = (id: string, field: keyof Faculty, lang: 'vi'|'en', value: string) => {
     updateState(prev => ({
      ...prev,
      faculties: prev.faculties.map(f => {
          if (f.id !== id) return f;
          const current = f[field] as any;
          return { ...f, [field]: { ...current, [lang]: value } };
      })
    }));
  };

  const handleTranslateProfile = async () => {
      const faculty = faculties.find(f => f.id === editingId);
      if (!faculty) return;
      
      setIsAiLoading(true);
      try {
          const targetLang = editLanguage === 'vi' ? 'en' : 'vi';
          const sourceLang = editLanguage;
          
          const translateList = async (list: FacultyListItem[]) => {
              const itemsToTranslate = list.filter(item => item.content[sourceLang] && !item.content[targetLang]);
              if (itemsToTranslate.length === 0) return list;

              const translatedItems = await Promise.all(list.map(async (item) => {
                  if (item.content[sourceLang] && !item.content[targetLang]) {
                      const translated = await translateContent(item.content[sourceLang], targetLang, geminiConfig);
                      return { ...item, content: { ...item.content, [targetLang]: translated || '' } };
                  }
                  return item;
              }));
              return translatedItems;
          };

          const translatePubs = async (list: any[]) => {
               return await Promise.all(list.map(async (item) => {
                  if (item.text[sourceLang] && !item.text[targetLang]) {
                      const translated = await translateContent(item.text[sourceLang], targetLang, geminiConfig);
                      return { ...item, text: { ...item.text, [targetLang]: translated || '' } };
                  }
                  return item;
              }));
          };

          const newHonors = await translateList(faculty.honorsList);
          const newCerts = await translateList(faculty.certificationsList);
          const newMembers = await translateList(faculty.membershipsList);
          const newService = await translateList(faculty.serviceActivitiesList);
          const newDev = await translateList(faculty.professionalDevelopmentList);
          const newPubs = await translatePubs(faculty.publicationsList);

          // Translate basic info if missing
          const newName = faculty.name[targetLang] ? faculty.name[targetLang] : await translateContent(faculty.name[sourceLang], targetLang, geminiConfig);
          
          updateState(prev => ({
              ...prev,
              faculties: prev.faculties.map(f => f.id === faculty.id ? {
                  ...f,
                  name: { ...f.name, [targetLang]: newName },
                  honorsList: newHonors,
                  certificationsList: newCerts,
                  membershipsList: newMembers,
                  serviceActivitiesList: newService,
                  professionalDevelopmentList: newDev,
                  publicationsList: newPubs
              } : f)
          }));
          alert(language === 'vi' ? "Đã dịch xong!" : "Translation complete!");
          
      } catch (e) {
          console.error(e);
          alert("Auto-translation failed.");
      } finally {
          setIsAiLoading(false);
      }
  };

  // --- Imports & Exports ---
  const handleAiImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      // Ensure we are in editing mode (this should always be true if called from modal)
      if (!editingId) return;

      setIsAiLoading(true);
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split(',')[1]) : reject(new Error("Failed"));
            reader.readAsDataURL(file);
        });
        const data = await importFacultyFromPdf(base64, geminiConfig);
        if (data) {
            // Overwrite existing faculty with extracted data
            updateState(prev => ({
                ...prev,
                faculties: prev.faculties.map(f => {
                    if (f.id === editingId) {
                        return {
                            ...f,
                            ...data, // Spread extracted data to overwrite
                            id: f.id // Preserve ID
                        };
                    }
                    return f;
                })
            }));
            alert(language === 'vi' ? "Đã cập nhật thông tin từ CV thành công!" : "Successfully updated profile from CV!");
        } else {
            alert("Failed to extract data from CV.");
        }
      } catch (err) {
          console.error(err);
          alert("Error processing PDF.");
      } finally {
          setIsAiLoading(false);
          e.target.value = '';
      }
  };

  const handleExportPdf = (faculty: Faculty) => {
      exportFacultyCvPdf(faculty, editLanguage);
  };

  const handleExportJson = (faculty: Faculty) => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(faculty, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `CV_${faculty.name.vi.replace(/\s+/g, '_')}_${Date.now()}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  // --- Sub-Components ---

  // Reusable component for rendering list sections (Honors, Certifications, etc.)
  const RenderDynamicList = ({ 
      title, 
      items, 
      field, 
      icon: Icon, 
      iconColor 
  }: { 
      title: string, 
      items: FacultyListItem[], 
      field: keyof Faculty, 
      icon: any, 
      iconColor: string 
  }) => {
      const faculty = faculties.find(f => f.id === editingId);
      if (!faculty) return null;

      return (
          <div className="mb-8 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-50">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                      <Icon size={18} className={iconColor}/> {title}
                  </h4>
                  <button 
                      onClick={() => updateFaculty(faculty.id, field, [...items, { id: Date.now().toString(), content: { vi: '', en: '' } }])}
                      className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:bg-indigo-100 transition-colors"
                  >
                      <Plus size={14}/> {editLanguage === 'vi' ? 'Thêm' : 'Add'}
                  </button>
              </div>
              <div className="space-y-3">
                  {items.map((item, idx) => (
                      <div key={item.id} className="flex gap-2 items-center group">
                          <span className="text-[10px] font-bold text-slate-400 w-5 text-right flex-shrink-0">#{idx + 1}</span>
                          
                          {/* Single Input for Current Selected Language */}
                          <div className="flex-1 relative">
                              <input 
                                  className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                                  placeholder={editLanguage === 'vi' ? "Nhập nội dung..." : "Enter content..."}
                                  value={item.content[editLanguage]}
                                  onChange={e => {
                                      const newList = [...items];
                                      newList[idx].content[editLanguage] = e.target.value;
                                      updateFaculty(faculty.id, field, newList);
                                  }}
                              />
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                  {/* Status Indicator for OTHER language */}
                                  {item.content[editLanguage === 'vi' ? 'en' : 'vi'] ? (
                                      <span className="text-[8px] font-bold text-emerald-500 bg-emerald-50 px-1 rounded border border-emerald-100 cursor-help" title="Translation available">
                                          {editLanguage === 'vi' ? 'EN' : 'VI'} OK
                                      </span>
                                  ) : (
                                      <span className="text-[8px] font-bold text-amber-500 bg-amber-50 px-1 rounded border border-amber-100 cursor-help" title="Translation missing">
                                          {editLanguage === 'vi' ? 'EN' : 'VI'} --
                                      </span>
                                  )}
                              </div>
                          </div>

                          {/* Delete Button */}
                          <button 
                              onClick={() => updateFaculty(faculty.id, field, items.filter((_, i) => i !== idx))} 
                              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          >
                              <Trash2 size={16}/>
                          </button>
                      </div>
                  ))}
                  {items.length === 0 && (
                      <div className="text-center text-xs text-slate-400 italic py-6 border-2 border-dashed border-slate-100 rounded-lg bg-slate-50/50">
                          {editLanguage === 'vi' ? 'Chưa có dữ liệu. Nhấn "Thêm" để bắt đầu.' : 'No items added. Click "Add" to start.'}
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const renderEditForm = () => {
      const faculty = faculties.find(f => f.id === editingId);
      if (!faculty) return null;

      const tabs = [
          { id: 'info', label: editLanguage === 'vi' ? 'Thông tin chung' : 'General Info', icon: User },
          { id: 'edu', label: editLanguage === 'vi' ? 'Đào tạo' : 'Education', icon: GraduationCap },
          { id: 'exp', label: editLanguage === 'vi' ? 'Kinh nghiệm' : 'Experience', icon: Briefcase },
          { id: 'research', label: editLanguage === 'vi' ? 'Nghiên cứu' : 'Research', icon: BookOpen },
          { id: 'achievements', label: editLanguage === 'vi' ? 'Thành tích' : 'Achievements', icon: Award },
          { id: 'activities', label: editLanguage === 'vi' ? 'Hoạt động' : 'Activities', icon: Activity },
      ];

      return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center p-6 border-b border-slate-100">
                      <div>
                          <h3 className="text-xl font-bold text-slate-800">{editLanguage === 'vi' ? 'Hồ sơ Giảng viên' : 'Faculty Profile'}</h3>
                          <p className="text-sm text-slate-500">{faculty.name[language]}</p>
                      </div>
                      <div className="flex gap-2 items-center">
                          {/* Language Switcher */}
                          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 mr-2">
                              <button 
                                  onClick={() => setEditLanguage('vi')} 
                                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${editLanguage === 'vi' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                              >
                                  VI
                              </button>
                              <button 
                                  onClick={() => setEditLanguage('en')} 
                                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${editLanguage === 'en' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                              >
                                  EN
                              </button>
                          </div>

                          {/* AI Actions Group */}
                          <div className="flex gap-2 mr-2">
                              {/* Import PDF */}
                              <input type="file" ref={pdfInputRef} className="hidden" accept=".pdf" onChange={handleAiImport} />
                              <button 
                                  onClick={() => pdfInputRef.current?.click()}
                                  disabled={isAiLoading}
                                  className="bg-indigo-50 text-indigo-600 border border-indigo-100 px-3 py-2 rounded-lg text-xs font-bold hover:bg-indigo-100 flex items-center gap-2 transition-colors disabled:opacity-50"
                                  title={editLanguage === 'vi' ? 'Nhập nội dung từ CV (PDF)' : 'Import content from CV (PDF)'}
                              >
                                  <ScrollText size={16}/> {editLanguage === 'vi' ? 'Nhập PDF' : 'Import PDF'}
                              </button>

                              {/* AI Translate */}
                              <button 
                                  onClick={handleTranslateProfile}
                                  disabled={isAiLoading}
                                  className="bg-indigo-50 text-indigo-600 border border-indigo-100 px-3 py-2 rounded-lg text-xs font-bold hover:bg-indigo-100 flex items-center gap-2 transition-colors disabled:opacity-50"
                                  title={editLanguage === 'vi' ? 'Dịch tự động các trường còn thiếu' : 'Auto-translate missing fields'}
                              >
                                  {isAiLoading ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>} {editLanguage === 'vi' ? 'Dịch AI' : 'AI Translate'}
                              </button>
                          </div>

                          <div className="h-8 w-px bg-slate-200 mx-2"></div>

                          {/* JSON Group */}
                          <div className="flex gap-2">
                              {/* Import JSON */}
                              <button 
                                  onClick={() => setJsonModalOpen(true)} 
                                  className="px-3 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 flex items-center gap-2 transition-colors"
                                  title={editLanguage === 'vi' ? 'Cập nhật từ JSON' : 'Update from JSON'}
                              >
                                  <Upload size={16}/> {editLanguage === 'vi' ? 'Nhập JSON' : 'Import JSON'}
                              </button>

                              {/* Export JSON */}
                              <button 
                                  onClick={() => handleExportJson(faculty)} 
                                  className="px-3 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 flex items-center gap-2 transition-colors"
                                  title={editLanguage === 'vi' ? 'Xuất CV dạng JSON' : 'Export CV JSON'}
                              >
                                  <FileJson size={16}/> {editLanguage === 'vi' ? 'Xuất JSON' : 'Export JSON'}
                              </button>
                          </div>

                          {/* Export PDF */}
                          <button onClick={() => handleExportPdf(faculty)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-sm shadow-indigo-200 transition-transform active:scale-95">
                              <Download size={16}/> {editLanguage === 'vi' ? 'Xuất CV PDF' : 'Export CV PDF'}
                          </button>
                          
                          <button onClick={() => setEditingId(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg">
                              <X size={24}/>
                          </button>
                      </div>
                  </div>

                  <div className="flex flex-1 overflow-hidden">
                      {/* ... tabs sidebar ... */}
                      <div className="w-64 bg-slate-50 border-r border-slate-100 p-4 space-y-1">
                          {tabs.map(tab => (
                              <button
                                  key={tab.id}
                                  onClick={() => setEditFormTab(tab.id as any)}
                                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${editFormTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                              >
                                  <tab.icon size={18}/> {tab.label}
                              </button>
                          ))}
                      </div>

                      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/30">
                          {editFormTab === 'info' && (
                              <div className="space-y-6 max-w-3xl">
                                  {/* ... info form ... */}
                                  <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                                      <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><User size={18} className="text-indigo-600"/> {editLanguage === 'vi' ? 'Thông tin cá nhân' : 'Personal Info'} ({editLanguage.toUpperCase()})</h4>
                                      <div className="grid grid-cols-1 gap-4">
                                          <div>
                                              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{editLanguage === 'vi' ? 'Họ và tên' : 'Full Name'}</label>
                                              <input className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                                                  value={faculty.name[editLanguage]} 
                                                  onChange={e => updateFacultyLang(faculty.id, 'name', editLanguage, e.target.value)} 
                                                  placeholder={editLanguage === 'vi' ? "Nhập họ tên..." : "Enter full name..."}
                                              />
                                          </div>
                                          <div className="grid grid-cols-2 gap-4">
                                              <div>
                                                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{editLanguage === 'vi' ? 'Chức danh' : 'Rank'}</label>
                                                  <select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={faculty.rank.en} onChange={e => {
                                                      const selected = facultyTitles.ranks.find(r => r.name.en === e.target.value);
                                                      if (selected) updateFaculty(faculty.id, 'rank', selected.name);
                                                  }}>
                                                      <option value="">{editLanguage === 'vi' ? 'Chọn...' : 'Select...'}</option>
                                                      {facultyTitles.ranks.map(r => <option key={r.id} value={r.name.en}>{r.name[editLanguage]}</option>)}
                                                  </select>
                                              </div>
                                              <div>
                                                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{editLanguage === 'vi' ? 'Học vị' : 'Degree'}</label>
                                                  <select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={faculty.degree.en} onChange={e => {
                                                      const selected = facultyTitles.degrees.find(d => d.name.en === e.target.value);
                                                      if (selected) updateFaculty(faculty.id, 'degree', selected.name);
                                                  }}>
                                                      <option value="">{editLanguage === 'vi' ? 'Chọn...' : 'Select...'}</option>
                                                      {facultyTitles.degrees.map(d => <option key={d.id} value={d.name.en}>{d.name[editLanguage]}</option>)}
                                                  </select>
                                              </div>
                                          </div>
                                          <div className="grid grid-cols-2 gap-4">
                                              <div>
                                                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{editLanguage === 'vi' ? 'Học hàm' : 'Academic Title'}</label>
                                                  <select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={faculty.academicTitle.en} onChange={e => {
                                                      const selected = facultyTitles.academicTitles.find(t => t.name.en === e.target.value);
                                                      if (selected) updateFaculty(faculty.id, 'academicTitle', selected.name);
                                                  }}>
                                                      <option value="">{editLanguage === 'vi' ? 'Chọn...' : 'Select...'}</option>
                                                      {facultyTitles.academicTitles.map(t => <option key={t.id} value={t.name.en}>{t.name[editLanguage]}</option>)}
                                                  </select>
                                              </div>
                                               <div>
                                                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{editLanguage === 'vi' ? 'Chức vụ' : 'Position'}</label>
                                                  <select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={faculty.position.en} onChange={e => {
                                                      const selected = facultyTitles.positions.find(t => t.name.en === e.target.value);
                                                      if (selected) updateFaculty(faculty.id, 'position', selected.name);
                                                  }}>
                                                      <option value="">{editLanguage === 'vi' ? 'Chọn...' : 'Select...'}</option>
                                                      {facultyTitles.positions.map(t => <option key={t.id} value={t.name.en}>{t.name[editLanguage]}</option>)}
                                                  </select>
                                              </div>
                                          </div>
                                      </div>
                                  </div>

                                  <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                                      <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Phone size={18} className="text-emerald-600"/> {editLanguage === 'vi' ? 'Liên hệ & Công tác' : 'Contact & Work'}</h4>
                                      <div className="grid grid-cols-2 gap-4">
                                          <div className="col-span-2 md:col-span-1"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Email</label><input className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg" value={faculty.email || ''} onChange={e => updateFaculty(faculty.id, 'email', e.target.value)} /></div>
                                          <div className="col-span-2 md:col-span-1"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{editLanguage === 'vi' ? 'Điện thoại' : 'Phone'}</label><input className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg" value={faculty.tel || ''} onChange={e => updateFaculty(faculty.id, 'tel', e.target.value)} /></div>
                                          <div className="col-span-2 md:col-span-1"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{editLanguage === 'vi' ? 'Văn phòng' : 'Office'}</label><input className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg" value={faculty.office || ''} onChange={e => updateFaculty(faculty.id, 'office', e.target.value)} /></div>
                                          <div className="col-span-2 md:col-span-1"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{editLanguage === 'vi' ? 'Số năm kinh nghiệm' : 'Experience (Years)'}</label><input type="number" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg" value={faculty.experience.vi} onChange={e => updateFaculty(faculty.id, 'experience', {vi: e.target.value, en: e.target.value})} /></div>
                                      </div>
                                  </div>
                              </div>
                          )}

                          {editFormTab === 'edu' && (
                              <div className="space-y-4">
                                  {faculty.educationList.map((edu, idx) => (
                                      <div key={idx} className="p-4 bg-white rounded-xl border border-slate-200 relative group shadow-sm">
                                          <button onClick={() => updateFaculty(faculty.id, 'educationList', faculty.educationList.filter((_, i) => i !== idx))} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                                          <div className="grid grid-cols-6 gap-4">
                                              <div className="col-span-1">
                                                  <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">{editLanguage === 'vi' ? 'Năm' : 'Year'}</label>
                                                  <input className="w-full p-2 border border-slate-200 rounded text-sm bg-slate-50" value={edu.year} onChange={e => { const n = [...faculty.educationList]; n[idx].year = e.target.value; updateFaculty(faculty.id, 'educationList', n); }} placeholder="Year" />
                                              </div>
                                              <div className="col-span-2">
                                                  <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">{editLanguage === 'vi' ? 'Bằng cấp' : 'Degree'} ({editLanguage})</label>
                                                  <input className="w-full p-2 border border-slate-200 rounded text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none" value={edu.degree[editLanguage]} onChange={e => { const n = [...faculty.educationList]; n[idx].degree = {...n[idx].degree, [editLanguage]: e.target.value}; updateFaculty(faculty.id, 'educationList', n); }} placeholder={editLanguage === 'vi' ? "Tên bằng cấp" : "Degree Name"} />
                                              </div>
                                              <div className="col-span-3">
                                                  <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">{editLanguage === 'vi' ? 'Nơi đào tạo' : 'Institution'} ({editLanguage})</label>
                                                  <input className="w-full p-2 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={edu.institution[editLanguage]} onChange={e => { const n = [...faculty.educationList]; n[idx].institution = {...n[idx].institution, [editLanguage]: e.target.value}; updateFaculty(faculty.id, 'educationList', n); }} placeholder={editLanguage === 'vi' ? "Tên trường" : "Institution Name"} />
                                              </div>
                                          </div>
                                      </div>
                                  ))}
                                  <button onClick={() => updateFaculty(faculty.id, 'educationList', [...faculty.educationList, { id: Date.now().toString(), degree: { vi: '', en: '' }, discipline: { vi: '', en: '' }, institution: { vi: '', en: '' }, year: '' }])} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2 bg-slate-50/50"><Plus size={16}/> {editLanguage === 'vi' ? 'Thêm quá trình đào tạo' : 'Add Education'}</button>
                              </div>
                          )}

                          {editFormTab === 'exp' && (
                              <div className="space-y-8">
                                  <div>
                                      <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b border-slate-200"><Briefcase size={18} className="text-indigo-600"/> {editLanguage === 'vi' ? 'Kinh nghiệm Học thuật' : 'Academic Experience'}</h4>
                                      <div className="space-y-3">
                                          {faculty.academicExperienceList.map((exp, idx) => (
                                              <div key={idx} className="p-4 bg-white rounded-xl border border-slate-200 relative group shadow-sm">
                                                  <button onClick={() => updateFaculty(faculty.id, 'academicExperienceList', faculty.academicExperienceList.filter((_, i) => i !== idx))} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                                                  <div className="grid grid-cols-4 gap-3">
                                                      <div>
                                                          <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">{editLanguage === 'vi' ? 'Thời gian' : 'Period'}</label>
                                                          <input className="w-full p-2 border border-slate-200 rounded text-sm bg-slate-50" value={exp.period} onChange={e => { const n = [...faculty.academicExperienceList]; n[idx].period = e.target.value; updateFaculty(faculty.id, 'academicExperienceList', n); }} />
                                                      </div>
                                                      <div className="col-span-3 flex gap-2">
                                                          <div className="flex-1">
                                                              <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">{editLanguage === 'vi' ? 'Nơi công tác' : 'Institution'} ({editLanguage})</label>
                                                              <input className="w-full p-2 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={exp.institution[editLanguage]} onChange={e => { const n = [...faculty.academicExperienceList]; n[idx].institution[editLanguage] = e.target.value; updateFaculty(faculty.id, 'academicExperienceList', n); }} />
                                                          </div>
                                                          <div className="flex-1">
                                                              <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">{editLanguage === 'vi' ? 'Chức vụ/Vị trí' : 'Title/Rank'} ({editLanguage})</label>
                                                              <input className="w-full p-2 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={exp.title[editLanguage]} onChange={e => { const n = [...faculty.academicExperienceList]; n[idx].title[editLanguage] = e.target.value; updateFaculty(faculty.id, 'academicExperienceList', n); }} />
                                                          </div>
                                                      </div>
                                                  </div>
                                              </div>
                                          ))}
                                          <button onClick={() => updateFaculty(faculty.id, 'academicExperienceList', [...faculty.academicExperienceList, { id: Date.now().toString(), institution: { vi: '', en: '' }, rank: { vi: '', en: '' }, title: { vi: '', en: '' }, period: '', isFullTime: true }])} className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"><Plus size={14}/> {editLanguage === 'vi' ? 'Thêm Kinh nghiệm' : 'Add Academic Exp'}</button>
                                      </div>
                                  </div>
                                  <div>
                                      <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b border-slate-200"><BriefcaseIcon size={18} className="text-emerald-600"/> {editLanguage === 'vi' ? 'Kinh nghiệm Phi học thuật' : 'Non-Academic Experience'}</h4>
                                      <div className="space-y-3">
                                          {faculty.nonAcademicExperienceList.map((exp, idx) => (
                                              <div key={idx} className="p-4 bg-white rounded-xl border border-slate-200 relative group shadow-sm">
                                                  <button onClick={() => updateFaculty(faculty.id, 'nonAcademicExperienceList', faculty.nonAcademicExperienceList.filter((_, i) => i !== idx))} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                                                  <div className="grid grid-cols-4 gap-3">
                                                      <div>
                                                          <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">{editLanguage === 'vi' ? 'Thời gian' : 'Period'}</label>
                                                          <input className="w-full p-2 border border-slate-200 rounded text-sm bg-slate-50" value={exp.period} onChange={e => { const n = [...faculty.nonAcademicExperienceList]; n[idx].period = e.target.value; updateFaculty(faculty.id, 'nonAcademicExperienceList', n); }} />
                                                      </div>
                                                      <div className="col-span-3 space-y-2">
                                                          <div className="flex gap-2">
                                                              <div className="flex-1">
                                                                  <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">{editLanguage === 'vi' ? 'Công ty/Tổ chức' : 'Company'} ({editLanguage})</label>
                                                                  <input className="w-full p-2 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={exp.company[editLanguage]} onChange={e => { const n = [...faculty.nonAcademicExperienceList]; n[idx].company[editLanguage] = e.target.value; updateFaculty(faculty.id, 'nonAcademicExperienceList', n); }} />
                                                              </div>
                                                              <div className="flex-1">
                                                                  <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">{editLanguage === 'vi' ? 'Chức danh' : 'Title'} ({editLanguage})</label>
                                                                  <input className="w-full p-2 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={exp.title[editLanguage]} onChange={e => { const n = [...faculty.nonAcademicExperienceList]; n[idx].title[editLanguage] = e.target.value; updateFaculty(faculty.id, 'nonAcademicExperienceList', n); }} />
                                                              </div>
                                                          </div>
                                                          <div>
                                                              <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">{editLanguage === 'vi' ? 'Mô tả' : 'Description'} ({editLanguage})</label>
                                                              <input className="w-full p-2 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={exp.description[editLanguage]} onChange={e => { const n = [...faculty.nonAcademicExperienceList]; n[idx].description[editLanguage] = e.target.value; updateFaculty(faculty.id, 'nonAcademicExperienceList', n); }} />
                                                          </div>
                                                      </div>
                                                  </div>
                                              </div>
                                          ))}
                                          <button onClick={() => updateFaculty(faculty.id, 'nonAcademicExperienceList', [...faculty.nonAcademicExperienceList, { id: Date.now().toString(), company: { vi: '', en: '' }, title: { vi: '', en: '' }, description: { vi: '', en: '' }, period: '', isFullTime: true }])} className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"><Plus size={14}/> {editLanguage === 'vi' ? 'Thêm Kinh nghiệm' : 'Add Non-Academic Exp'}</button>
                                      </div>
                                  </div>
                              </div>
                          )}

                          {editFormTab === 'research' && (
                              <div className="space-y-4">
                                  {/* ... research form ... */}
                                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                      <h4 className="font-bold text-slate-700 flex items-center gap-2"><BookOpen size={18} className="text-indigo-600"/> {editLanguage === 'vi' ? 'Công bố Khoa học' : 'Publications'} ({editLanguage})</h4>
                                      <button onClick={() => updateFaculty(faculty.id, 'publicationsList', [...(faculty.publicationsList || []), { id: Date.now().toString(), text: { vi: '', en: '' } }])} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:bg-indigo-100"><Plus size={14}/> {editLanguage === 'vi' ? 'Thêm' : 'Add'}</button>
                                  </div>
                                  <div className="space-y-2">
                                      {(faculty.publicationsList || []).map((pub, idx) => (
                                          <div key={idx} className="flex gap-2 items-start group">
                                              <span className="text-xs font-bold text-slate-400 mt-2 w-6 text-right">{idx + 1}.</span>
                                              <div className="flex-1 relative">
                                                  <textarea 
                                                      className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" 
                                                      rows={2} 
                                                      value={pub.text[editLanguage]} 
                                                      onChange={e => { const n = [...(faculty.publicationsList || [])]; n[idx].text[editLanguage] = e.target.value; updateFaculty(faculty.id, 'publicationsList', n); }} 
                                                      placeholder={editLanguage === 'vi' ? "Nhập thông tin công bố..." : "Enter publication details..."}
                                                  />
                                                  <div className="absolute right-2 top-2">
                                                       {pub.text[editLanguage === 'vi' ? 'en' : 'vi'] ? <span className="w-2 h-2 rounded-full bg-emerald-400 block" title="Translation available"></span> : <span className="w-2 h-2 rounded-full bg-amber-400 block" title="Missing translation"></span>}
                                                  </div>
                                              </div>
                                              <button onClick={() => updateFaculty(faculty.id, 'publicationsList', faculty.publicationsList!.filter((_, i) => i !== idx))} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity mt-1"><Trash2 size={16}/></button>
                                          </div>
                                      ))}
                                      {faculty.publicationsList.length === 0 && <div className="text-center text-slate-400 text-xs italic py-8 border-2 border-dashed border-slate-200 rounded-xl">{editLanguage === 'vi' ? 'Chưa có công bố nào' : 'No publications added'}</div>}
                                  </div>
                              </div>
                          )}

                          {editFormTab === 'achievements' && (
                              <div className="space-y-8">
                                  <RenderDynamicList 
                                      title={editLanguage === 'vi' ? 'Khen thưởng & Giải thưởng' : 'Honors and Awards'}
                                      items={faculty.honorsList || []}
                                      field="honorsList"
                                      icon={Star}
                                      iconColor="text-amber-500"
                                  />
                                  <RenderDynamicList 
                                      title={editLanguage === 'vi' ? 'Chứng chỉ' : 'Certifications'}
                                      items={faculty.certificationsList || []}
                                      field="certificationsList"
                                      icon={Medal}
                                      iconColor="text-emerald-500"
                                  />
                              </div>
                          )}

                          {editFormTab === 'activities' && (
                              <div className="space-y-8">
                                  <RenderDynamicList 
                                      title={editLanguage === 'vi' ? 'Hoạt động Phục vụ cộng đồng' : 'Service Activities'}
                                      items={faculty.serviceActivitiesList || []}
                                      field="serviceActivitiesList"
                                      icon={Layers}
                                      iconColor="text-blue-500"
                                  />
                                  <RenderDynamicList 
                                      title={editLanguage === 'vi' ? 'Hoạt động Phát triển chuyên môn' : 'Professional Development'}
                                      items={faculty.professionalDevelopmentList || []}
                                      field="professionalDevelopmentList"
                                      icon={Briefcase}
                                      iconColor="text-purple-500"
                                  />
                                  <RenderDynamicList 
                                      title={editLanguage === 'vi' ? 'Thành viên tổ chức' : 'Memberships'}
                                      items={faculty.membershipsList || []}
                                      field="membershipsList"
                                      icon={User}
                                      iconColor="text-slate-500"
                                  />
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="h-full flex flex-col relative">
      <AILoader isVisible={isAiLoading} message={language === 'vi' ? 'Đang xử lý...' : 'Processing...'} />
      {renderEditForm()}

      {/* JSON Import Modal */}
      {isJsonModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[70vh] flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                          <FileJson size={20} className="text-indigo-600"/>
                          {language === 'vi' ? 'Cập nhật từ JSON (Giữ ID gốc)' : 'Update from JSON (Preserve ID)'}
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
                      <button 
                          onClick={() => {
                              try {
                                  if (!jsonText.trim()) return;
                                  const parsed = JSON.parse(jsonText);
                                  // Handle both single object or array (take first)
                                  const data = Array.isArray(parsed) ? parsed[0] : parsed;
                                  
                                  if (!editingId) return;

                                  updateState(prev => ({
                                      ...prev,
                                      faculties: prev.faculties.map(f => {
                                          if (f.id === editingId) {
                                              return {
                                                  ...f,
                                                  ...data, // Overwrite with JSON data
                                                  id: f.id // FORCE KEEP EXISTING ID to preserve relationships
                                              };
                                          }
                                          return f;
                                      })
                                  }));

                                  setJsonModalOpen(false);
                                  setJsonText('');
                                  alert(language === 'vi' ? "Cập nhật thành công!" : "Updated successfully!");
                              } catch (err) {
                                  alert(language === 'vi' ? 'Lỗi: JSON không hợp lệ' : 'Error: Invalid JSON');
                              }
                          }} 
                          className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 shadow-lg flex items-center gap-2"
                      >
                          <Upload size={16}/> {language === 'vi' ? 'Cập nhật' : 'Update'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Toolbar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0 mb-6">
          <div className="flex items-center gap-4">
              <div className="relative w-64">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Search faculty..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                  />
              </div>
          </div>
          
          <div className="flex gap-2">
              <button onClick={handleAdd} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-sm">
                  <Plus size={16} /> {language === 'vi' ? 'Thêm mới' : 'Add Faculty'}
              </button>
          </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredFaculties.map(f => (
                <div key={f.id} className="group bg-slate-50 rounded-xl p-4 border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col gap-3 relative cursor-pointer" onClick={() => { setEditingId(f.id); setEditFormTab('info'); }}>
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 font-bold shadow-sm">
                                {f.name[language]?.charAt(0) || <User size={20}/>}
                            </div>
                            <div>
                                <div className="font-bold text-slate-800 text-sm line-clamp-1">{f.name[language]}</div>
                                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{f.rank[language]}</div>
                            </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                            <button onClick={() => { setEditingId(f.id); setEditFormTab('info'); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 size={14}/></button>
                            <button onClick={() => handleDelete(f.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                        </div>
                    </div>
                    
                    <div className="space-y-2 mt-1">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                            <GraduationCap size={14} className="text-indigo-400"/>
                            <span className="truncate">{f.degree[language] || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Mail size={14} className="text-emerald-400"/>
                            <span className="truncate">{f.email || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div className="pt-3 border-t border-slate-200 mt-auto flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded border border-slate-100">{f.experience[language] || 0} years exp</span>
                        {f.educationList.length > 0 && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{f.educationList.length} Degrees</span>}
                    </div>
                </div>
            ))}
            {filteredFaculties.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    {language === 'vi' ? 'Không tìm thấy giảng viên nào.' : 'No faculty found.'}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default FacultyModule;
