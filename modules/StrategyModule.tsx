
import React, { useState, useMemo } from 'react';
import { AppState, PEO, MissionConstituent } from '../types';
import { translateContent } from '../services/geminiService';
import { Sparkles, Globe, ArrowRight, Trash2, Plus, Check, Layers, Download, CheckCircle2, Target, Info } from 'lucide-react';
import { TRANSLATIONS } from '../constants';
import AILoader from '../components/AILoader';

interface Props {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const StrategyModule: React.FC<Props> = ({ state, updateState }) => {
  const { mission, peos, language, peoConstituentMap, courses, coursePeoMap, geminiConfig, peoSoMap, courseSoMap, sos } = state;
  const [isTranslating, setIsTranslating] = useState(false);
  const tStrings = TRANSLATIONS[language];

  // --- Optimization: Calculate Implied Relationships (PEO -> SO -> Course) ---
  // Ensure strict usage of Course IDs (CID) for identification
  const impliedPeoCourseLinks = useMemo(() => {
    const links = new Set<string>();
    
    // 1. Group Course IDs by SO ID (O(N))
    const coursesBySo = new Map<string, string[]>();
    (courseSoMap || []).forEach(cs => {
        if (cs.level !== '') { // Filter active mappings
            if (!coursesBySo.has(cs.soId)) {
                coursesBySo.set(cs.soId, []);
            }
            coursesBySo.get(cs.soId)?.push(cs.courseId);
        }
    });

    // 2. Map PEOs to Courses via SOs
    (peoSoMap || []).forEach(ps => {
        const mappedCourseIds = coursesBySo.get(ps.soId);
        if (mappedCourseIds) {
            mappedCourseIds.forEach(cId => {
                // Key format: PEO_ID-COURSE_ID
                links.add(`${ps.peoId}-${cId}`);
            });
        }
    });
    
    return links;
  }, [peoSoMap, courseSoMap]);

  const exportPeoCourseCsv = () => {
    const essential = courses.filter(c => c.isEssential);
    // Use Code for display headers, but logic relies on IDs
    const headers = ['PEO Code', 'PEO Title', ...essential.map(c => c.code)];
    const rows = peos.map(peo => {
      return [
        peo.code,
        `"${peo.title[language]}"`,
        ...essential.map(c => (coursePeoMap || []).some(m => m.peoId === peo.id && m.courseId === c.id) ? 'X' : '')
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PEO_Essential_Course_Matrix_${language}.csv`);
    link.click();
  };

  const exportPeoMissionCsv = () => {
    const constituents = mission.constituents || [];
    // Transposed export: Rows are Constituents, Cols are PEOs
    const headers = ['Mission Constituent', ...peos.map(p => p.code)];

    const rows = constituents.map(mc => {
      return [
        `"${mc.description[language]}"`,
        ...peos.map(peo =>
          (peoConstituentMap || []).some(m => m.peoId === peo.id && m.constituentId === mc.id) ? 'X' : ''
        )
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Mission_PEO_Alignment_${language}.csv`;
    link.click();
  };

  const handleMissionTextChange = (text: string) => {
    updateState(prev => ({
      ...prev,
      mission: {
        ...prev.mission,
        text: { ...prev.mission.text, [language]: text }
      }
    }));
  };

  const addConstituent = () => {
    const newId = `MC-${Date.now()}`; // Standardized ID prefix
    const newConstituent: MissionConstituent = {
      id: newId,
      description: { vi: '', en: '' }
    };
    updateState(prev => ({
      ...prev,
      mission: { ...prev.mission, constituents: [...(prev.mission.constituents || []), newConstituent] }
    }));
  };

  const deleteConstituent = (id: string) => {
    if (window.confirm(language === 'vi' ? "Xoá thành phần này?" : "Delete this constituent?")) {
      updateState(prev => ({
        ...prev,
        mission: { ...prev.mission, constituents: (prev.mission.constituents || []).filter(c => c.id !== id) },
        peoConstituentMap: (prev.peoConstituentMap || []).filter(m => m.constituentId !== id)
      }));
    }
  };

  const updateConstituent = (id: string, text: string) => {
    updateState(prev => ({
      ...prev,
      mission: {
        ...prev.mission,
        constituents: (prev.mission.constituents || []).map(c => 
          c.id === id ? { ...c, description: { ...c.description, [language]: text } } : c
        )
      }
    }));
  };

  const addPeo = () => {
      const nextNum = peos.length + 1;
      const newPeo: PEO = {
          id: `PEO-${Date.now()}`,
          code: `PEO-${nextNum}`,
          title: { vi: 'Tiêu đề PEO mới', en: 'New PEO Title' },
          description: { vi: '', en: '' }
      };
      updateState(prev => ({ ...prev, peos: [...prev.peos, newPeo] }));
  };

  const deletePeo = (id: string) => {
    if (window.confirm(language === 'vi' ? "Xoá PEO này? Các liên kết liên quan cũng sẽ bị xóa." : "Delete this PEO? Related mappings will also be removed.")) {
      updateState(prev => ({
        ...prev,
        peos: (prev.peos || []).filter(p => p.id !== id),
        peoConstituentMap: (prev.peoConstituentMap || []).filter(m => m.peoId !== id),
        coursePeoMap: (prev.coursePeoMap || []).filter(m => m.peoId !== id),
        peoSoMap: (prev.peoSoMap || []).filter(m => m.peoId !== id)
      }));
    }
  };

  const togglePeoConstituentCell = (peoId: string, constituentId: string) => {
    updateState(prev => {
      const currentMap = prev.peoConstituentMap || [];
      const exists = currentMap.find(m => m.peoId === peoId && m.constituentId === constituentId);
      if (exists) {
        return { ...prev, peoConstituentMap: currentMap.filter(m => !(m.peoId === peoId && m.constituentId === constituentId)) };
      }
      return { ...prev, peoConstituentMap: [...currentMap, { peoId, constituentId }] };
    });
  };

  const togglePeoCourseCell = (peoId: string, courseId: string) => {
    updateState(prev => {
      const currentMap = prev.coursePeoMap || [];
      const exists = currentMap.find(m => m.peoId === peoId && m.courseId === courseId);
      if (exists) {
        return { ...prev, coursePeoMap: currentMap.filter(m => !(m.peoId === peoId && m.courseId === courseId)) };
      }
      return { ...prev, coursePeoMap: [...currentMap, { peoId, courseId }] };
    });
  };

  const handleAutoTranslate = async () => {
    setIsTranslating(true);
    try {
        const targetLangName = language === 'vi' ? 'Vietnamese' : 'English';
        const otherLang = language === 'vi' ? 'en' : 'vi';

        // Specialized config for Strategy module to ensure academic tone
        const academicConfig = {
            ...geminiConfig,
            prompts: {
                ...geminiConfig.prompts,
                translation: `You are an expert academic translator specializing in Higher Education accreditation documents (ABET/MOET). 
Translate the following content to ${targetLangName}.

CRITICAL GUIDELINES:
1. **Tone**: Use formal, professional, and academic language suitable for university mission statements and educational objectives.
2. **Accuracy**: Preserve the specific nuance of educational terminology (e.g., "produce solutions", "ethical responsibility", "lifelong learning").
3. **Structure**: Keep the original sentence structure and formatting.
4. **Output**: Return ONLY the translated text, no explanations.

Content to translate: {text}`
            }
        };

        const newMission = { ...mission };
        
        // Translate Constituents
        if (newMission.constituents) {
            for (let i = 0; i < newMission.constituents.length; i++) {
                const c = newMission.constituents[i];
                if (!c.description[language] && c.description[otherLang]) {
                    const trans = await translateContent(c.description[otherLang], language, academicConfig);
                    if (trans) c.description[language] = trans;
                }
            }
        }
        
        // Translate Main Mission Text if missing
        if (!newMission.text[language] && newMission.text[otherLang]) {
             const trans = await translateContent(newMission.text[otherLang], language, academicConfig);
             if (trans) newMission.text[language] = trans;
        }

        const newPeos = peos.map(p => ({...p, title: {...p.title}, description: {...p.description}}));
        for (let i = 0; i < newPeos.length; i++) {
            const p = newPeos[i];
            if (!p.title[language] && p.title[otherLang]) {
                const trans = await translateContent(p.title[otherLang], language, academicConfig);
                if (trans) p.title[language] = trans;
            }
            if (!p.description[language] && p.description[otherLang]) {
                const trans = await translateContent(p.description[otherLang], language, academicConfig);
                if (trans) p.description[language] = trans;
            }
        }
        updateState(prev => ({ ...prev, mission: newMission, peos: newPeos }));
    } catch (e) {
        console.error("Translation error:", e);
        alert(language === 'vi' ? "Dịch thuật thất bại." : "Translation failed.");
    } finally {
        setIsTranslating(false);
    }
  };

  // Filter essential courses and sort by code
  const essentialCourses = useMemo(() => {
      return (courses || [])
        .filter(c => c.isEssential)
        .sort((a, b) => a.code.localeCompare(b.code));
  }, [courses]);

  return (
    <div className="space-y-12 pb-12">
      <AILoader isVisible={isTranslating} message={language === 'vi' ? 'Đang dịch thuật...' : 'Translating...'} />
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-20">
         <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Target className="text-indigo-600"/> {tStrings.strategy}
         </h1>
         <button onClick={handleAutoTranslate} disabled={isTranslating} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition">
            <Sparkles size={16} /> {tStrings.autoTranslate}
         </button>
      </div>

      {/* Mission Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                <Globe className="text-indigo-500" size={20} /> {tStrings.mission}
            </h2>
            <textarea 
                className="w-full p-4 border border-slate-200 rounded-lg text-sm leading-relaxed resize-none flex-1 focus:ring-2 focus:ring-indigo-500 outline-none" 
                value={mission?.text?.[language] || ''} 
                onChange={(e) => handleMissionTextChange(e.target.value)} 
                placeholder={language === 'vi' ? "Nhập tuyên bố sứ mạng của chương trình..." : "Enter program mission statement..."}
            />
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-full max-h-[300px]">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Mission Constituents</h3>
                <button onClick={addConstituent} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 font-bold flex items-center gap-1 transition-colors">
                    <Plus size={14} /> {language === 'vi' ? 'Thêm' : 'Add'}
                </button>
            </div>
            <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-2">
                {mission?.constituents?.map((c, idx) => (
                    <div key={c.id} className="flex gap-2 items-center group">
                        <span className="text-[10px] font-bold text-slate-400 w-6">#{idx+1}</span>
                        <input 
                            className="flex-1 bg-slate-50 px-3 py-2 rounded-lg text-sm border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                            value={c.description?.[language] || ''} 
                            onChange={(e) => updateConstituent(c.id, e.target.value)} 
                            placeholder="..."
                        />
                        <button onClick={() => deleteConstituent(c.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* PEOs Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold flex items-center gap-2"><Target size={20} className="text-indigo-600"/> Program Educational Objectives (PEOs)</h2>
            <button 
                onClick={addPeo}
                className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-900 transition"
            >
                <Plus size={14} /> Add PEO
            </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {peos?.map((peo, idx) => (
            <div key={peo.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 group relative hover:border-indigo-300 transition-colors">
              <div className="flex items-center justify-between mb-3">
                 <div className="flex items-center gap-2">
                     <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-sm">{peo.code}</span>
                     <input 
                        className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none text-sm font-bold text-slate-700 w-full"
                        value={peo.title?.[language] || ''}
                        onChange={(e) => {
                            const next = [...peos];
                            next[idx].title[language] = e.target.value;
                            updateState(prev => ({ ...prev, peos: next }));
                        }}
                        placeholder="PEO Title"
                     />
                 </div>
                 <button onClick={() => deletePeo(peo.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
              </div>
              <textarea 
                className="w-full p-3 border border-slate-200 bg-white rounded-lg text-xs leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-20" 
                value={peo.description?.[language] || ''} 
                onChange={(e) => {
                    const next = [...peos];
                    next[idx].description[language] = e.target.value;
                    updateState(prev => ({ ...prev, peos: next }));
                }} 
                placeholder="PEO Description"
              />
            </div>
          ))}
        </div>
      </div>

      {/* PEO - Mission Alignment Matrix */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
           <h2 className="text-base font-bold text-slate-800">{tStrings.alignmentPeoMission}</h2>
           <button onClick={exportPeoMissionCsv} className="text-slate-500 hover:text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border border-slate-200 bg-white hover:border-indigo-200">
             <Download size={14} /> CSV
           </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white z-10 p-4 border-b border-r border-slate-200 min-w-[300px] text-left text-xs font-bold uppercase text-slate-500">
                  {language === 'vi' ? 'Thành phần Sứ mạng \\ PEOs' : 'Mission Constituents \\ PEOs'}
                </th>
                {peos?.map((peo) => (
                  <th key={peo.id} className="p-4 border-b border-slate-200 min-w-[100px] text-center text-xs font-bold text-slate-700 bg-slate-50 relative group">
                    <div className="cursor-help transition-colors group-hover:text-indigo-600">{peo.code}</div>
                    <div className="absolute hidden group-hover:block z-50 top-full left-1/2 -translate-x-1/2 w-64 p-3 bg-slate-800 text-white text-[10px] rounded-xl shadow-xl font-normal text-left normal-case mt-1">
                      <p className="font-bold mb-1 text-indigo-300">{peo.title[language]}</p>
                      {peo.description[language]}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mission.constituents?.map((mc, idx) => (
                <tr key={mc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="sticky left-0 bg-white z-10 p-4 border-b border-r border-slate-200 text-left">
                    <div className="font-bold text-slate-700 text-xs leading-relaxed">{mc.description[language] || `Constituent ${idx + 1}`}</div>
                  </td>
                  {peos?.map((peo) => {
                    const isChecked = (peoConstituentMap || []).some(m => m.peoId === peo.id && m.constituentId === mc.id);
                    return (
                      <td key={peo.id} className="border-b border-slate-100 text-center p-4 cursor-pointer" onClick={() => togglePeoConstituentCell(peo.id, mc.id)}>
                        <div className={`w-5 h-5 rounded border mx-auto flex items-center justify-center transition-all ${isChecked ? 'bg-indigo-600 border-indigo-600 shadow-sm scale-110' : 'bg-white border-slate-300 hover:border-indigo-300'}`}>
                           {isChecked && <Check size={12} className="text-white" />}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PEO - Essential Courses Matrix */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
           <h2 className="text-base font-bold text-slate-800">{tStrings.mappingPeoCourse}</h2>
           <div className="flex gap-2">
                <div className="flex items-center gap-4 text-[10px] font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 mr-2">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-indigo-600 rounded-full"></div> {language === 'vi' ? 'Trực tiếp' : 'Direct'}</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-amber-400 rounded-full"></div> {language === 'vi' ? 'Gián tiếp (qua SO)' : 'Implied (via SO)'}</span>
                </div>
               <button onClick={exportPeoCourseCsv} className="text-slate-500 hover:text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border border-slate-200 bg-white hover:border-indigo-200">
                 <Download size={14} /> CSV
               </button>
           </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar pb-2">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white z-10 p-3 border-b border-r border-slate-200 min-w-[200px] text-left text-xs font-bold uppercase text-slate-500">PEOs</th>
                {essentialCourses.map(course => (
                  <th key={course.id} className="p-3 border-b border-slate-200 min-w-[80px] text-center text-[10px] font-bold text-indigo-700 bg-slate-50 group relative">
                      <div className="cursor-help whitespace-nowrap">{course.code}</div>
                      <div className="absolute hidden group-hover:block z-50 top-full left-1/2 -translate-x-1/2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow font-normal text-center mt-1">
                          <p className="font-bold text-indigo-300 mb-1">{course.name[language]}</p>
                          <p className="text-[9px] text-slate-400">ID: {course.id}</p>
                      </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {peos?.map(peo => (
                <tr key={peo.id} className="hover:bg-slate-50 transition-colors">
                  <td className="sticky left-0 bg-white z-10 p-3 border-b border-r border-slate-200 text-left">
                    <div className="font-bold text-slate-700 text-xs">{peo.code}</div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[180px]">{peo.title[language]}</div>
                  </td>
                  {essentialCourses.map(course => {
                    const isChecked = (coursePeoMap || []).some(m => m.courseId === course.id && m.peoId === peo.id);
                    // Use cached calculation for implied link (O(1) lookup using ID key)
                    const isImplied = impliedPeoCourseLinks.has(`${peo.id}-${course.id}`);

                    return (
                      <td 
                        key={course.id} 
                        className={`border-b border-slate-100 text-center p-3 cursor-pointer transition-colors ${!isChecked && isImplied ? 'bg-amber-50/30' : ''}`} 
                        onClick={() => togglePeoCourseCell(peo.id, course.id)}
                      >
                        <div className={`w-5 h-5 rounded border mx-auto flex items-center justify-center transition-all ${isChecked ? 'bg-indigo-600 border-indigo-600' : (isImplied ? 'bg-amber-100 border-amber-300' : 'bg-white border-slate-300')}`}>
                           {isChecked && <Check size={12} className="text-white" />}
                           {!isChecked && isImplied && <div className="w-2 h-2 bg-amber-500 rounded-full"></div>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StrategyModule;
