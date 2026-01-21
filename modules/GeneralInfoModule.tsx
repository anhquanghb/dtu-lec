
import React, { useState, useRef, useEffect } from 'react';
import { AppState, GeneralInfo } from '../types';
import { School, Building2, MapPin, Contact, History, GraduationCap, Globe, AlertTriangle, Link as LinkIcon, Sparkles, BookOpen, Calendar, Bold, Italic, Underline, List as ListIcon, ListOrdered } from 'lucide-react';
import { translateBatch } from '../services/geminiService';
import { TRANSLATIONS } from '../constants';
import AILoader from '../components/AILoader';

interface Props {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

// --- Simple WYSIWYG Editor Component (Reused from TransformationModule logic) ---
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

const GeneralInfoModule: React.FC<Props> = ({ state, updateState }) => {
  const { generalInfo, language, geminiConfig } = state;
  const [isTranslating, setIsTranslating] = useState(false);

  const tStrings = TRANSLATIONS[language];

  // --- Common Helpers ---
  const updateField = (field: keyof GeneralInfo, value: any) => {
    updateState(prev => ({
      ...prev,
      generalInfo: { ...prev.generalInfo, [field]: value }
    }));
  };

  const updateLangField = (field: 'university' | 'school' | 'programName' | 'contact' | 'history' | 'deliveryModes' | 'locations' | 'defaultSubjectName' | 'publicDisclosure', value: string) => {
    updateState(prev => ({
      ...prev,
      generalInfo: {
        ...prev.generalInfo,
        [field]: { ...prev.generalInfo[field], [language]: value }
      }
    }));
  };

  const updateEvaluation = (field: 'weaknesses' | 'actions' | 'status', value: string) => {
    updateState(prev => ({
      ...prev,
      generalInfo: {
        ...prev.generalInfo,
        previousEvaluations: {
          ...prev.generalInfo.previousEvaluations,
          [field]: { ...prev.generalInfo.previousEvaluations[field], [language]: value }
        }
      }
    }));
  };

  const handleAutoTranslate = async () => {
    setIsTranslating(true);
    try {
      const nextInfo = JSON.parse(JSON.stringify(generalInfo)); // Deep copy to safely mutate
      const otherLang = language === 'vi' ? 'en' : 'vi';
      const toTranslate: Record<string, string> = {};

      const mainFields: ('university' | 'school' | 'programName' | 'contact' | 'history' | 'deliveryModes' | 'locations' | 'defaultSubjectName' | 'publicDisclosure')[] = 
          ['university', 'school', 'programName', 'contact', 'history', 'deliveryModes', 'locations', 'defaultSubjectName', 'publicDisclosure'];
          
      mainFields.forEach(field => {
          if (!nextInfo[field][language] && nextInfo[field][otherLang]) {
          toTranslate[field] = nextInfo[field][otherLang];
          }
      });

      const evalFields: ('weaknesses' | 'actions' | 'status')[] = ['weaknesses', 'actions', 'status'];
      evalFields.forEach(field => {
          if (!nextInfo.previousEvaluations[field][language] && nextInfo.previousEvaluations[field][otherLang]) {
          toTranslate[`eval_${field}`] = nextInfo.previousEvaluations[field][otherLang];
          }
      });

      if (Object.keys(toTranslate).length === 0) {
        setIsTranslating(false);
        return;
      }

      const translated = await translateBatch(toTranslate, language, geminiConfig);

      Object.keys(translated).forEach(key => {
        if (key.startsWith('eval_')) {
        const field = key.replace('eval_', '');
        if (nextInfo.previousEvaluations[field]) {
            nextInfo.previousEvaluations[field][language] = translated[key];
        }
        } else {
        if (nextInfo[key]) {
            nextInfo[key][language] = translated[key];
        }
        }
      });

      updateState(prev => ({ ...prev, generalInfo: nextInfo }));
    } catch (e) {
      console.error(e);
      alert(language === 'vi' ? "Lỗi dịch thuật. Vui lòng kiểm tra API Key." : "Translation failed. Please check your API Key.");
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <AILoader isVisible={isTranslating} message={language === 'vi' ? 'Đang dịch thuật...' : 'Translating...'} />
      <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-6 shrink-0">
        <button 
          className={`py-4 text-sm font-bold border-b-2 transition-colors border-indigo-600 text-indigo-600`}
        >
          {language === 'vi' ? 'Thông tin chung (ABET)' : 'General Info (ABET)'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in">
            <div className="flex justify-end mb-4">
                <button 
                    onClick={handleAutoTranslate} 
                    disabled={isTranslating} 
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-sm disabled:opacity-50"
                >
                    <Sparkles size={16} /> 
                    {isTranslating ? (language === 'vi' ? 'Đang dịch...' : 'Translating...') : tStrings.autoTranslate}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <InfoCard 
                    icon={<School className="text-indigo-500" />} 
                    title={language === 'vi' ? '1. Đại học' : '1. University'} 
                    value={generalInfo.university[language]}
                    onChange={(v) => updateLangField('university', v)}
                />
                <InfoCard 
                    icon={<Building2 className="text-emerald-500" />} 
                    title={language === 'vi' ? '2. Khoa/Trường' : '2. School/Faculty'} 
                    value={generalInfo.school[language]}
                    onChange={(v) => updateLangField('school', v)}
                />
                <InfoCard 
                    icon={<BookOpen className="text-purple-500" />} 
                    title={language === 'vi' ? '3. Tên chương trình' : '3. Program Name'} 
                    value={generalInfo.programName[language]}
                    onChange={(v) => updateLangField('programName', v)}
                />
                <InfoCard 
                    icon={<Calendar className="text-blue-500" />} 
                    title={language === 'vi' ? 'Năm học bắt đầu' : 'Start Academic Year'} 
                    value={generalInfo.academicYear}
                    onChange={(v) => updateField('academicYear', v)}
                />
                <div className="md:col-span-2 lg:col-span-4">
                    <InfoCard 
                    icon={<Contact className="text-amber-500" />} 
                    title={language === 'vi' ? '4. Thông tin liên hệ' : '4. Contact Information'} 
                    value={generalInfo.contact[language]}
                    onChange={(v) => updateLangField('contact', v)}
                    isTextArea
                    />
                </div>
            </div>

            <div className="space-y-8">
                <NarrativeSection 
                    icon={<History size={20} />} 
                    title={language === 'vi' ? '5. Lịch sử chương trình' : '5. Program History'} 
                    value={generalInfo.history[language]}
                    onChange={(v) => updateLangField('history', v)}
                />
                <NarrativeSection 
                    icon={<GraduationCap size={20} />} 
                    title={language === 'vi' ? '6. Phương thức đào tạo' : '6. Program Delivery Modes'} 
                    value={generalInfo.deliveryModes[language]}
                    onChange={(v) => updateLangField('deliveryModes', v)}
                />
                <NarrativeSection 
                    icon={<MapPin size={20} />} 
                    title={language === 'vi' ? '7. Cơ sở đào tạo' : '7. Program Locations'} 
                    value={generalInfo.locations[language]}
                    onChange={(v) => updateLangField('locations', v)}
                />
            </div>

            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                <Globe size={20} className="text-indigo-600" />
                <h3 className="font-bold text-slate-800">{language === 'vi' ? '8. Công khai thông tin' : '8. Public Disclosure'}</h3>
                </div>
                <div className="p-6">
                    <RichTextEditor 
                        value={generalInfo.publicDisclosure[language]} 
                        onChange={(v) => updateLangField('publicDisclosure', v)}
                        placeholder={language === 'vi' ? "Nhập thông tin công khai..." : "Enter public disclosure information..."}
                    />
                </div>
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-amber-500">
                <div className="p-6 border-b border-slate-100 bg-amber-50/30 flex items-center gap-2">
                <AlertTriangle size={20} className="text-amber-600" />
                <h3 className="font-bold text-slate-800">
                    {language === 'vi' 
                    ? '9. Các thiếu sót, điểm yếu hoặc lo ngại từ (các) lần đánh giá trước và các hành động được thực hiện để giải quyết chúng' 
                    : '9. Deficiencies, Weaknesses or Concerns from Previous Evaluation(s) and the Actions Taken to Address Them'}
                </h3>
                </div>
                <div className="p-8 space-y-8">
                <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{language === 'vi' ? 'Điểm yếu / Thiếu sót' : 'Weaknesses / Deficiencies'}</h4>
                    <textarea 
                    className="w-full min-h-[100px] p-4 bg-amber-50/50 border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm text-slate-700"
                    value={generalInfo.previousEvaluations.weaknesses[language]}
                    onChange={(e) => updateEvaluation('weaknesses', e.target.value)}
                    placeholder="..."
                    />
                </div>
                <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{language === 'vi' ? 'Hành động khắc phục' : 'Actions Taken'}</h4>
                    <textarea 
                    className="w-full min-h-[100px] p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-700"
                    value={generalInfo.previousEvaluations.actions[language]}
                    onChange={(e) => updateEvaluation('actions', e.target.value)}
                    placeholder="..."
                    />
                </div>
                <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{language === 'vi' ? 'Trạng thái hiện tại' : 'Current Status'}</h4>
                    <textarea 
                    className="w-full min-h-[80px] p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-slate-700"
                    value={generalInfo.previousEvaluations.status[language]}
                    onChange={(e) => updateEvaluation('status', e.target.value)}
                    placeholder="..."
                    />
                </div>
                </div>
            </section>
        </div>
      </div>
    </div>
  );
};

const InfoCard = ({ icon, title, value, onChange, isTextArea }: { icon: React.ReactNode, title: string, value: string, onChange: (v: string) => void, isTextArea?: boolean }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center gap-3 mb-4">
      {icon}
      <h3 className="font-bold text-slate-700 text-sm">{title}</h3>
    </div>
    {isTextArea ? (
      <textarea 
        className="w-full min-h-[100px] p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    ) : (
      <input 
        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    )}
  </div>
);

const NarrativeSection = ({ icon, title, value, onChange }: { icon: React.ReactNode, title: string, value: string, onChange: (v: string) => void }) => (
  <section>
    <div className="flex items-center gap-2 mb-3">
      <div className="p-2 bg-white border border-slate-200 rounded-lg shadow-sm text-indigo-600">
        {icon}
      </div>
      <h3 className="font-bold text-lg text-slate-800">{title}</h3>
    </div>
    <textarea 
      className="w-full min-h-[150px] p-6 bg-white border border-slate-200 rounded-2xl shadow-sm text-sm leading-relaxed text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </section>
);

export default GeneralInfoModule;
