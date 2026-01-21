
import React, { useState, useMemo } from 'react';
import { AppState, SO, PI } from '../types';
import { translateContent } from '../services/geminiService';
import { Target, Plus, Trash2, Sparkles, Download, Check, ListChecks, Grid3X3, AlertCircle, ArrowRight, LayoutList, BookOpen } from 'lucide-react';
import { TRANSLATIONS } from '../constants';
import AILoader from '../components/AILoader';

interface Props {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const OutcomesModule: React.FC<Props> = ({ state, updateState }) => {
  const { sos, peos, language, peoSoMap, courseSoMap, geminiConfig } = state;
  const t = TRANSLATIONS[language];
  const [isTranslating, setIsTranslating] = useState(false);

  // --- Statistics ---
  const stats = useMemo(() => {
      const totalPIs = sos.reduce((acc, so) => acc + (so.pis?.length || 0), 0);
      const mappedPEOs = new Set(peoSoMap.map(m => m.peoId)).size;
      const unmappedSOs = sos.filter(so => !peoSoMap.some(m => m.soId === so.id)).length;
      return { totalPIs, mappedPEOs, unmappedSOs };
  }, [sos, peoSoMap]);

  // --- Optimization: Pre-calculate SO to Course Counts (CID Based) ---
  const soCourseCounts = useMemo(() => {
      const counts = new Map<string, number>();
      sos.forEach(so => {
          // Count unique course IDs mapped to this SO
          const uniqueCourses = new Set(
              courseSoMap
                  .filter(m => m.soId === so.id && m.level !== '') // Filter valid mappings
                  .map(m => m.courseId) // Use CID
          );
          counts.set(so.id, uniqueCourses.size);
      });
      return counts;
  }, [sos, courseSoMap]);

  const exportPeoSoCsv = () => {
    const headers = ['PEO Code', ...sos.map(s => s.code)];
    const rows = peos.map(peo => {
      return [
        peo.code,
        ...sos.map(so => (peoSoMap || []).some(m => m.peoId === peo.id && m.soId === so.id) ? 'X' : '')
      ];
    });
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PEO_SO_Matrix_${language}.csv`);
    link.click();
  };

  const exportSoPiCsv = () => {
    // 2-column format: SO Content | PI Content
    const headers = [
        language === 'vi' ? 'Chuẩn đầu ra (Student Outcomes)' : 'Student Outcomes',
        language === 'vi' ? 'Chỉ số thực hiện (Performance Indicators)' : 'Performance Indicators'
    ];
    const rows: string[][] = [];

    sos.forEach(so => {
        const soContent = `${so.code}: ${so.description[language]}`;
        
        if (so.pis && so.pis.length > 0) {
            so.pis.forEach(pi => {
                rows.push([
                    `"${soContent}"`,
                    `"${pi.code}: ${pi.description[language]}"`
                ]);
            });
        } else {
            rows.push([`"${soContent}"`, ""]);
        }
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SO_PI_Table_${language}.csv`;
    link.click();
  };

  const handleAutoTranslate = async () => {
    setIsTranslating(true);
    try {
        const targetLangName = language === 'vi' ? 'Vietnamese' : 'English';
        const otherLang = language === 'vi' ? 'en' : 'vi';

        // Specialized config for Outcomes module to ensure academic tone
        const academicConfig = {
            ...geminiConfig,
            prompts: {
                ...geminiConfig.prompts,
                translation: `You are an expert academic translator specializing in Higher Education accreditation documents (ABET/MOET). 
Translate the following content to ${targetLangName}.

CRITICAL GUIDELINES:
1. **Tone**: Use formal, professional, and academic language suitable for Student Outcomes (SOs) and Performance Indicators (PIs).
2. **Accuracy**: Preserve the specific nuance of educational terminology (e.g., "apply knowledge", "design systems", "conduct experiments").
3. **Structure**: Keep the original sentence structure.
4. **Output**: Return ONLY the translated text, no explanations.

Content to translate: {text}`
            }
        };

        const next = JSON.parse(JSON.stringify(sos)); // Deep copy to avoid mutation
        
        for (let i = 0; i < next.length; i++) {
            // Translate SO Description
            if (!next[i].description[language] && next[i].description[otherLang]) {
                const trans = await translateContent(next[i].description[otherLang], language, academicConfig);
                if (trans) next[i].description[language] = trans;
            }
            // Translate PIs
            for (let j = 0; j < next[i].pis.length; j++) {
                if (!next[i].pis[j].description[language] && next[i].pis[j].description[otherLang]) {
                    const trans = await translateContent(next[i].pis[j].description[otherLang], language, academicConfig);
                    if (trans) next[i].pis[j].description[language] = trans;
                }
            }
        }
        updateState(prev => ({ ...prev, sos: next }));
    } catch (e) {
        console.error("Translation error:", e);
        alert(language === 'vi' ? "Dịch thuật thất bại." : "Translation failed.");
    } finally {
        setIsTranslating(false);
    }
  };

  const togglePeoSoCell = (peoId: string, soId: string) => {
    updateState(prev => {
      const current = prev.peoSoMap || [];
      const exists = current.find(m => m.peoId === peoId && m.soId === soId);
      if (exists) {
        return { ...prev, peoSoMap: current.filter(m => !(m.peoId === peoId && m.soId === soId)) };
      }
      return { ...prev, peoSoMap: [...current, { peoId, soId }] };
    });
  };

  const addSo = () => {
    const nextNum = sos.length > 0 ? Math.max(...sos.map(s => s.number)) + 1 : 1;
    // Standardize new ID and Code
    const newSo: SO = { 
        id: `so-${Date.now()}`, 
        number: nextNum, 
        code: `SO-${nextNum}`, 
        description: { vi: '', en: '' }, 
        pis: [] 
    };
    updateState(prev => ({ ...prev, sos: [...prev.sos, newSo] }));
  };

  const deleteSo = (id: string) => {
      if (window.confirm(language === 'vi' ? "Xóa Chuẩn đầu ra này? Các dữ liệu PIs và Mapping liên quan cũng sẽ bị xóa." : "Delete this Student Outcome? Related PIs and Mappings will also be removed.")) {
          updateState(prev => ({
              ...prev,
              sos: prev.sos.filter(s => s.id !== id),
              peoSoMap: prev.peoSoMap.filter(m => m.soId !== id),
              courseSoMap: prev.courseSoMap.filter(m => m.soId !== id),
              // Also clean up any CLO maps referencing this SO
              courses: prev.courses.map(c => ({
                  ...c,
                  cloMap: c.cloMap?.map(cm => ({
                      ...cm,
                      soIds: cm.soIds.filter(sid => sid !== id)
                  }))
              }))
          }));
      }
  };

  const updateSoDesc = (soId: string, text: string) => {
    updateState(prev => ({ ...prev, sos: prev.sos.map(s => s.id === soId ? { ...s, description: { ...s.description, [language]: text } } : s) }));
  };

  const addPi = (soId: string) => {
    updateState(prev => {
        const soIndex = prev.sos.findIndex(s => s.id === soId);
        if (soIndex === -1) return prev;
        
        const so = prev.sos[soIndex];
        const nextPiNum = (so.pis || []).length + 1;
        const newPi: PI = {
            id: `pi-${Date.now()}`,
            code: `${so.number}.${nextPiNum}`,
            description: { vi: '', en: '' }
        };
        
        const newSos = [...prev.sos];
        newSos[soIndex] = { ...so, pis: [...(so.pis || []), newPi] };
        return { ...prev, sos: newSos };
    });
  };

  const updatePi = (soId: string, piId: string, field: 'code' | 'description', value: string) => {
     updateState(prev => {
        const newSos = prev.sos.map(so => {
            if (so.id !== soId) return so;
            return {
                ...so,
                pis: (so.pis || []).map(pi => {
                    if (pi.id !== piId) return pi;
                    if (field === 'description') {
                        return { ...pi, description: { ...pi.description, [language]: value } };
                    }
                    return { ...pi, [field]: value };
                })
            };
        });
        return { ...prev, sos: newSos };
     });
  };

  const deletePi = (soId: string, piId: string) => {
      if(!confirm(language === 'vi' ? 'Xóa chỉ số PI này?' : 'Delete this PI?')) return;
      
      updateState(prev => ({
          ...prev,
          sos: prev.sos.map(so => {
              if (so.id !== soId) return so;
              return { ...so, pis: (so.pis || []).filter(pi => pi.id !== piId) };
          }),
          // Cleanup PI Mappings
          coursePiMap: prev.coursePiMap.filter(m => m.piId !== piId)
      }));
  };

  return (
    <div className="space-y-8 pb-12">
      <AILoader isVisible={isTranslating} message={language === 'vi' ? 'Đang dịch thuật...' : 'Translating...'} />
      
      {/* Sticky Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-20">
         <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Target className="text-indigo-600"/> {t.outcomes}
            </h1>
            <div className="hidden md:flex gap-2 ml-4">
                <div className="px-3 py-1 bg-slate-50 rounded-full border border-slate-100 text-[10px] font-bold text-slate-500 flex items-center gap-1">
                    <ListChecks size={12} className="text-blue-500" /> {stats.totalPIs} PIs
                </div>
                {stats.unmappedSOs > 0 && (
                    <div className="px-3 py-1 bg-red-50 rounded-full border border-red-100 text-[10px] font-bold text-red-600 flex items-center gap-1">
                        <AlertCircle size={12} /> {stats.unmappedSOs} {language === 'vi' ? 'SO chưa liên kết PEO' : 'Unmapped SOs'}
                    </div>
                )}
            </div>
         </div>
         <div className="flex gap-2">
            <button onClick={exportSoPiCsv} className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-50 transition shadow-sm">
                <Download size={16} className="text-emerald-600" /> {language === 'vi' ? 'Xuất bảng SO-PI' : 'Export SO-PI'}
            </button>
            <button onClick={handleAutoTranslate} disabled={isTranslating} className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-50 transition shadow-sm">
                <Sparkles size={16} className={isTranslating ? "text-indigo-600" : "text-slate-400"} /> {t.autoTranslate}
            </button>
            <button onClick={addSo} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-sm">
                <Plus size={16} /> {language === 'vi' ? 'Thêm SO' : 'Add SO'}
            </button>
         </div>
      </div>

      {/* SO Cards List */}
      <div className="grid grid-cols-1 gap-6">
        {sos.map(so => {
          const courseCount = soCourseCounts.get(so.id) || 0;
          
          return (
            <div key={so.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group">
                <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center transition-colors group-hover:bg-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-black text-xs shadow-sm shadow-indigo-200">
                        {so.number}
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm tracking-wide">{so.code}</h3>
                    <span className="text-slate-300 text-xs">|</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <ListChecks size={12} className="text-slate-400"/> {(so.pis || []).length} Indicators
                    </span>
                    <span className="text-slate-300 text-xs">|</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${courseCount === 0 ? 'text-amber-500' : 'text-emerald-600'}`}>
                        <BookOpen size={12} /> {courseCount} {language === 'vi' ? 'Môn học' : 'Courses'}
                    </span>
                </div>
                <button onClick={() => deleteSo(so.id)} className="text-slate-300 hover:text-red-500 p-2 transition-colors rounded-lg hover:bg-red-50">
                    <Trash2 size={16} />
                </button>
                </div>
                
                <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: SO Description */}
                <div className="lg:col-span-5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block flex items-center gap-2">
                        <Target size={12} /> {language === 'vi' ? 'Mô tả SO' : 'Description'}
                    </label>
                    <textarea 
                        className="w-full p-4 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none h-32 leading-relaxed resize-none transition-shadow focus:bg-white" 
                        value={so.description[language]} 
                        onChange={(e) => updateSoDesc(so.id, e.target.value)} 
                        placeholder={`Enter SO description in ${language.toUpperCase()}...`} 
                    />
                </div>

                {/* Right: Performance Indicators */}
                <div className="lg:col-span-7 bg-white rounded-xl border border-slate-100 p-4 shadow-[inset_0_0_10px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-50">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <ListChecks size={14} className="text-indigo-500" />
                            Performance Indicators (PIs)
                        </h4>
                        <button onClick={() => addPi(so.id)} className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 font-bold flex items-center gap-1 transition-colors">
                            <Plus size={12} /> {language === 'vi' ? 'Thêm PI' : 'Add PI'}
                        </button>
                    </div>
                    
                    <div className="space-y-3">
                        {(so.pis || []).map(pi => (
                            <div key={pi.id} className="flex gap-3 items-start group/pi">
                                <input 
                                    className="w-14 p-2 text-[10px] font-bold bg-slate-100 text-slate-600 border border-transparent rounded text-center focus:bg-white focus:border-indigo-500 outline-none"
                                    value={pi.code}
                                    onChange={(e) => updatePi(so.id, pi.id, 'code', e.target.value)}
                                />
                                <textarea 
                                    className="flex-1 p-2 text-xs font-medium bg-white border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none resize-none min-h-[36px] overflow-hidden leading-relaxed"
                                    value={pi.description[language]}
                                    onChange={(e) => {
                                        e.target.style.height = 'auto';
                                        e.target.style.height = e.target.scrollHeight + 'px';
                                        updatePi(so.id, pi.id, 'description', e.target.value);
                                    }}
                                    placeholder={`PI Description...`}
                                    rows={1}
                                />
                                <button onClick={() => deletePi(so.id, pi.id)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover/pi:opacity-100 transition-opacity">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                        {(so.pis || []).length === 0 && (
                            <div className="flex flex-col items-center justify-center py-6 text-slate-300 border-2 border-dashed border-slate-100 rounded-lg">
                                <LayoutList size={24} className="mb-2 opacity-50"/>
                                <span className="text-xs italic">{language === 'vi' ? 'Chưa có chỉ số PI nào.' : 'No PIs defined yet.'}</span>
                            </div>
                        )}
                    </div>
                </div>
                </div>
            </div>
          );
        })}
      </div>

      {/* PEO - SO Matrix */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
           <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
             <Grid3X3 size={18} className="text-indigo-600"/> {t.peoSoMatrix}
           </h2>
           <button onClick={exportPeoSoCsv} className="text-slate-500 hover:text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border border-slate-200 bg-white hover:border-indigo-200 transition-colors">
             <Download size={14} /> CSV
           </button>
        </div>
        <div className="overflow-x-auto custom-scrollbar pb-2">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-4 border-b border-r border-slate-200 text-left bg-white text-xs font-bold uppercase text-slate-500 min-w-[200px] sticky left-0 z-10">
                    PEOs \ SOs
                </th>
                {sos.map(so => (
                    <th key={so.id} className="p-3 border-b border-slate-200 min-w-[80px] text-center bg-slate-50 font-bold text-indigo-700 text-xs group relative cursor-help">
                        {so.code}
                        <div className="absolute hidden group-hover:block z-50 bottom-full left-1/2 -translate-x-1/2 w-64 p-3 bg-slate-800 text-white text-[10px] rounded-xl shadow-xl font-normal text-left normal-case mb-2">
                            {so.description[language]}
                        </div>
                    </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {peos.map(peo => (
                <tr key={peo.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 border-b border-r border-slate-200 text-xs text-slate-700 sticky left-0 bg-white z-10 group-hover:bg-slate-50">
                      <div className="font-bold">{peo.code}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[250px]" title={peo.title[language]}>{peo.title[language]}</div>
                  </td>
                  {sos.map(so => {
                    const isChecked = (peoSoMap || []).some(m => m.peoId === peo.id && m.soId === so.id);
                    return (
                        <td key={so.id} className="p-4 border-b border-slate-100 text-center cursor-pointer" onClick={() => togglePeoSoCell(peo.id, so.id)}>
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
    </div>
  );
};

export default OutcomesModule;
