
import React, { useState, useMemo, useRef } from 'react';
import { AppState, Course, CoverageLevel } from '../types';
import { TRANSLATIONS } from '../constants';
import { PieChart, BarChart2, TrendingUp, BookOpen, Users, Award, Target, Layers, CheckCircle2, AlertTriangle, BrainCircuit, Sparkles, Microscope, Activity, Download, Image, Share2, Library } from 'lucide-react';
import { getGeminiResponse } from '../services/geminiService';
import AILoader from '../components/AILoader';
import html2canvas from 'html2canvas';

interface Props {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

// Helper to map knowledge area colors to Hex for SVG
const getColorHex = (colorName: string) => {
    const map: Record<string, string> = {
        blue: '#3b82f6', indigo: '#6366f1', purple: '#a855f7',
        green: '#22c55e', slate: '#64748b', red: '#ef4444',
        orange: '#f97316', yellow: '#eab308', emerald: '#10b981',
        teal: '#14b8a6', cyan: '#06b6d4', sky: '#0ea5e9'
    };
    return map[colorName] || '#cbd5e1';
};

// Internal reusable component for Charts with Export actions
interface ChartCardProps {
    title: string;
    icon: React.ReactNode;
    id: string;
    children: React.ReactNode;
    onExportPng: () => void;
    onExportCsv: () => void;
}

const ChartCard: React.FC<ChartCardProps> = ({ 
    title, 
    icon, 
    id, 
    children, 
    onExportPng, 
    onExportCsv 
}) => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {icon} {title}
            </h3>
            <div className="flex gap-1">
                <button onClick={onExportPng} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Export Image (PNG)">
                    <Image size={18} />
                </button>
                <button onClick={onExportCsv} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Export Data (CSV)">
                    <Download size={18} />
                </button>
            </div>
        </div>
        <div id={id} className="flex-1 bg-white">
            {children}
        </div>
    </div>
);

const AnalyticsModule: React.FC<Props> = ({ state, updateState }) => {
  const { courses, faculties, knowledgeAreas, language, sos, peos, courseSoMap, coursePiMap, teachingMethods, assessmentMethods, geminiConfig, coursePeoMap, library } = state;
  const t = TRANSLATIONS[language];
  const [scope, setScope] = useState<'all' | 'essential' | 'abet'>('all');
  const [activeTab, setActiveTab] = useState<'general' | 'coverage' | 'methods' | 'resources' | 'ai'>('general');
  const [aiReport, setAiReport] = useState<string>('');
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  // Filter courses based on scope
  const targetCourses = useMemo(() => {
    if (scope === 'essential') return courses.filter(c => c.isEssential);
    if (scope === 'abet') return courses.filter(c => c.isAbet);
    return courses;
  }, [courses, scope]);

  // --- 1. General Stats ---
  const generalStats = useMemo(() => {
    const creditsByArea: Record<string, number> = {};
    const totalCredits = targetCourses.reduce((sum, c) => sum + c.credits, 0);
    
    knowledgeAreas.forEach(area => { creditsByArea[area.id] = 0; });
    targetCourses.forEach(c => { if (creditsByArea[c.knowledgeAreaId] !== undefined) creditsByArea[c.knowledgeAreaId] += c.credits; });

    const areaChartData = knowledgeAreas.map(area => ({
        id: area.id,
        name: area.name[language],
        color: area.color,
        value: creditsByArea[area.id] || 0,
        percentage: totalCredits > 0 ? ((creditsByArea[area.id] || 0) / totalCredits * 100).toFixed(1) : '0'
    }));

    // Enhanced Semester Stats: Group by Semester AND Area
    const semesterData: Record<number, { total: number, areas: Record<string, number> }> = {};
    for (let i = 1; i <= 9; i++) semesterData[i] = { total: 0, areas: {} };
    
    targetCourses.forEach(c => {
        const sem = c.semester || 1;
        if (!semesterData[sem]) semesterData[sem] = { total: 0, areas: {} };
        
        semesterData[sem].total += c.credits;
        const areaId = c.knowledgeAreaId;
        semesterData[sem].areas[areaId] = (semesterData[sem].areas[areaId] || 0) + c.credits;
    });

    const activeInstructorIds = new Set<string>();
    targetCourses.forEach(c => c.instructorIds.forEach(id => activeInstructorIds.add(id)));
    const activeFaculties = faculties.filter(f => activeInstructorIds.has(f.id));
    const phdCount = activeFaculties.filter(f => (f.degree?.en || '').toLowerCase().includes('ph.d') || (f.degree?.vi || '').toLowerCase().includes('tiến sĩ')).length;

    return { totalCredits, areaChartData, semesterData, activeFacultyCount: activeFaculties.length, phdPercentage: activeFaculties.length > 0 ? (phdCount / activeFaculties.length * 100).toFixed(1) : '0' };
  }, [targetCourses, knowledgeAreas, language, faculties]);

  // --- 2. Coverage & Alignment Stats ---
  const coverageStats = useMemo(() => {
      // PEO Coverage
      const peoCounts = peos.map(p => ({
          id: p.id, code: p.code,
          count: coursePeoMap.filter(m => m.peoId === p.id && targetCourses.some(c => c.id === m.courseId)).length
      }));

      // SO Coverage
      const soCounts = sos.map(s => ({
          id: s.id, code: s.code,
          count: courseSoMap.filter(m => m.soId === s.id && m.level !== '' && targetCourses.some(c => c.id === m.courseId)).length
      }));

      // PI Coverage (Heatmap Data)
      const piStats = sos.flatMap(s => (s.pis || []).map(pi => {
          const mappedCount = coursePiMap.filter(m => m.piId === pi.id && targetCourses.some(c => c.id === m.courseId)).length;
          return { soCode: s.code, piCode: pi.code, count: mappedCount };
      }));

      // CLO Alignment Logic
      let totalClos = 0;
      let mappedClos = 0;
      targetCourses.forEach(c => {
          const courseClos = c.clos[language] || [];
          totalClos += courseClos.length;
          const mappedIndices = new Set(c.cloMap?.filter(m => m.soIds.length > 0).map(m => m.cloIndex));
          mappedClos += mappedIndices.size;
      });

      return { peoCounts, soCounts, piStats, totalClos, mappedClos, unmappedClos: totalClos - mappedClos };
  }, [targetCourses, peos, sos, coursePeoMap, courseSoMap, coursePiMap, language]);

  // --- 3. Methods Stats ---
  const methodStats = useMemo(() => {
      const teachingCounts: Record<string, number> = {};
      targetCourses.forEach(c => {
          const methodsInCourse = new Set<string>();
          c.topics.forEach(t => t.activities.forEach(a => methodsInCourse.add(a.methodId)));
          methodsInCourse.forEach(mid => { teachingCounts[mid] = (teachingCounts[mid] || 0) + 1; });
      });
      const teachingData = teachingMethods.map(m => ({ name: m.code, value: teachingCounts[m.id] || 0 })).sort((a, b) => b.value - a.value);

      const assessmentCounts: Record<string, number> = {};
      targetCourses.forEach(c => {
          const methodsInCourse = new Set<string>();
          c.assessmentPlan.forEach(a => methodsInCourse.add(a.methodId));
          methodsInCourse.forEach(mid => { assessmentCounts[mid] = (assessmentCounts[mid] || 0) + 1; });
      });
      const assessmentData = assessmentMethods.map(m => ({ name: m.name[language], value: assessmentCounts[m.id] || 0 })).sort((a, b) => b.value - a.value);

      return { teachingData, assessmentData };
  }, [targetCourses, teachingMethods, assessmentMethods, language]);

  // --- 4. Resource Stats (Library) ---
  const resourceStats = useMemo(() => {
      const currentYear = new Date().getFullYear();
      const ageGroups = {
          recent: 0, // 0-5 years
          mid: 0,    // 6-10 years
          old: 0,    // 11-15 years
          archived: 0 // 15+ years
      };
      
      let totalValid = 0;

      library.forEach(item => {
          const year = parseInt(item.year);
          if (isNaN(year)) return;
          
          totalValid++;
          const age = currentYear - year;
          if (age <= 5) ageGroups.recent++;
          else if (age <= 10) ageGroups.mid++;
          else if (age <= 15) ageGroups.old++;
          else ageGroups.archived++;
      });

      const data = [
          { label: language === 'vi' ? 'Mới (0-5 năm)' : 'Recent (0-5y)', value: ageGroups.recent, color: 'bg-emerald-500', textColor: 'text-emerald-600', percentage: totalValid ? (ageGroups.recent/totalValid)*100 : 0 },
          { label: language === 'vi' ? 'Trung bình (6-10 năm)' : 'Mid-term (6-10y)', value: ageGroups.mid, color: 'bg-blue-500', textColor: 'text-blue-600', percentage: totalValid ? (ageGroups.mid/totalValid)*100 : 0 },
          { label: language === 'vi' ? 'Cũ (11-15 năm)' : 'Old (11-15y)', value: ageGroups.old, color: 'bg-amber-500', textColor: 'text-amber-600', percentage: totalValid ? (ageGroups.old/totalValid)*100 : 0 },
          { label: language === 'vi' ? 'Lâu năm (>15 năm)' : 'Archived (>15y)', value: ageGroups.archived, color: 'bg-red-500', textColor: 'text-red-600', percentage: totalValid ? (ageGroups.archived/totalValid)*100 : 0 }
      ];

      return { total: library.length, data };
  }, [library, language]);

  // --- Export Helpers ---
  const handleExportImage = async (elementId: string, fileName: string) => {
      const element = document.getElementById(elementId);
      if (!element) return;
      try {
          const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
          const link = document.createElement('a');
          link.download = `${fileName}_${Date.now()}.png`;
          link.href = canvas.toDataURL();
          link.click();
      } catch (err) {
          console.error("Export Image Failed", err);
          alert("Could not export image.");
      }
  };

  const handleExportCsv = (headers: string[], rows: (string|number)[][], fileName: string) => {
      const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}_${Date.now()}.csv`;
      link.click();
  };

  // --- Specific Export Handlers ---
  const exportKnowledgeAreaCsv = () => {
      const headers = ['Area ID', 'Area Name', 'Credits', 'Percentage'];
      const rows = generalStats.areaChartData.map(a => [a.id, `"${a.name}"`, a.value, `${a.percentage}%`]);
      handleExportCsv(headers, rows, 'KnowledgeArea_Stats');
  };

  const exportSemesterCsv = () => {
      const headers = ['Semester', 'Total Credits', ...knowledgeAreas.map(k => k.name[language])];
      const rows = Object.entries(generalStats.semesterData).map(([sem, data]) => {
          const d = data as { total: number, areas: Record<string, number> };
          return [sem, d.total, ...knowledgeAreas.map(k => d.areas[k.id] || 0)];
      });
      handleExportCsv(headers, rows, 'Semester_Workload_Stats');
  };

  const exportPeoCoverageCsv = () => {
      const headers = ['PEO Code', 'Mapped Courses'];
      const rows = coverageStats.peoCounts.map(p => [p.code, p.count]);
      handleExportCsv(headers, rows, 'PEO_Coverage_Stats');
  };

  const exportSoCoverageCsv = () => {
      const headers = ['SO Code', 'Mapped Courses'];
      const rows = coverageStats.soCounts.map(s => [s.code, s.count]);
      handleExportCsv(headers, rows, 'SO_Coverage_Stats');
  };

  const exportTeachingMethodsCsv = () => {
      const headers = ['Method Code', 'Frequency'];
      const rows = methodStats.teachingData.map(m => [m.name, m.value]);
      handleExportCsv(headers, rows, 'Teaching_Method_Stats');
  };

  const exportResourceStatsCsv = () => {
      const headers = ['Age Group', 'Count', 'Percentage'];
      const rows = resourceStats.data.map(d => [d.label, d.value, `${d.percentage.toFixed(1)}%`]);
      handleExportCsv(headers, rows, 'Library_Age_Stats');
  };

  // --- AI Analysis ---
  const handleRunAiAudit = async () => {
      setIsAiAnalyzing(true);
      try {
          const prompt = `
            Act as an ABET Accreditation Specialist. Analyze the following curriculum data and provide a critical review in ${language === 'vi' ? 'Vietnamese' : 'English'}.
            
            DATA SUMMARY:
            - Courses: ${targetCourses.length} (Total Credits: ${generalStats.totalCredits})
            - PEOs: ${peos.length}, SOs: ${sos.length}
            
            COVERAGE DATA:
            - SO Coverage Counts: ${JSON.stringify(coverageStats.soCounts.map(s => `${s.code}:${s.count}`))}
            - PI Coverage Gaps: ${JSON.stringify(coverageStats.piStats.filter(p => p.count === 0).map(p => p.piCode))}
            - CLO Alignment: ${coverageStats.mappedClos}/${coverageStats.totalClos} CLOs are mapped to SOs. ${coverageStats.unmappedClos} orphaned CLOs.

            METHODOLOGY DATA:
            - Teaching Methods Used: ${JSON.stringify(methodStats.teachingData)}
            - Assessment Methods Used: ${JSON.stringify(methodStats.assessmentData)}

            RESOURCE DATA (LIBRARY):
            - Total Resources: ${resourceStats.total}
            - Age Distribution: ${JSON.stringify(resourceStats.data.map(d => `${d.label}: ${d.value} (${d.percentage.toFixed(1)}%)`))}

            PLEASE PROVIDE A REPORT WITH:
            1. **Logic & Consistency**: Are there "orphaned" CLOs? Is the mapping logic sound?
            2. **Coverage Gaps**: Are any PEOs, SOs, or PIs under-represented?
            3. **Teaching & Assessment**: Is there enough variety? Does the assessment align with modern engineering education (e.g., Projects vs Exams)?
            4. **Resources & Currency**: Are textbooks up-to-date? (Mention if >15 years old ratio is high).
            5. **Specific Recommendations**: 3-5 actionable steps to improve the curriculum design for ABET accreditation.

            Format the output using Markdown. Use bolding and bullet points effectively.
          `;
          
          const response = await getGeminiResponse(prompt, geminiConfig);
          setAiReport(response);
      } catch (error) {
          setAiReport("Error generating report. Please check your API key and connection.");
      } finally {
          setIsAiAnalyzing(false);
      }
  };

  // --- Sub-renderers ---
  const renderGeneral = () => (
      <div className="space-y-8 animate-in fade-in">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full"><BookOpen size={24}/></div>
                  <div><div className="text-sm font-medium text-slate-500">{t.credits}</div><div className="text-3xl font-black text-slate-800">{generalStats.totalCredits}</div></div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full"><Users size={24}/></div>
                  <div><div className="text-sm font-medium text-slate-500">{language === 'vi' ? 'Giảng viên phụ trách' : 'Active Instructors'}</div><div className="text-3xl font-black text-slate-800">{generalStats.activeFacultyCount}</div></div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-purple-50 text-purple-600 rounded-full"><Award size={24}/></div>
                  <div><div className="text-sm font-medium text-slate-500">PhD %</div><div className="text-3xl font-black text-slate-800">{generalStats.phdPercentage}%</div></div>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Knowledge Area */}
              <ChartCard 
                  id="chart-areas"
                  title={t.knowledgeArea} 
                  icon={<PieChart size={18} className="text-slate-400"/>}
                  onExportPng={() => handleExportImage('chart-areas', 'KnowledgeArea_Chart')}
                  onExportCsv={exportKnowledgeAreaCsv}
              >
                  <div className="space-y-4 pt-2">
                      {generalStats.areaChartData.map(area => (
                          <div key={area.id}>
                              <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs font-bold text-slate-600">{area.name}</span>
                                  <span className="text-xs font-bold text-slate-400">{area.value} cr ({area.percentage}%)</span>
                              </div>
                              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${area.percentage}%`, backgroundColor: getColorHex(area.color) }}></div>
                              </div>
                          </div>
                      ))}
                  </div>
              </ChartCard>

              {/* Semester Workload (Stacked Bar Chart) */}
              <ChartCard
                  id="chart-semester"
                  title={language === 'vi' ? 'Phân bổ theo Học kỳ' : 'Semester Workload'}
                  icon={<BarChart2 size={18} className="text-slate-400"/>}
                  onExportPng={() => handleExportImage('chart-semester', 'Semester_Workload_Chart')}
                  onExportCsv={exportSemesterCsv}
              >
                  <div className="pt-4 flex flex-col h-full">
                      {/* Chart Area */}
                      <div className="flex items-end justify-between h-56 gap-2 mb-6 border-b border-l border-slate-200 pl-2 pb-2">
                          {[1,2,3,4,5,6,7,8,9].map(sem => { 
                              const data = generalStats.semesterData[sem];
                              const maxVal = 25; // Fixed scale max
                              const barHeight = Math.min((data.total / maxVal) * 100, 100);
                              
                              return (
                                  <div key={sem} className="flex flex-col items-center gap-2 flex-1 h-full justify-end group">
                                      {/* Stacked Bar */}
                                      <div className="w-full max-w-[40px] bg-slate-100 rounded-t-sm relative flex flex-col-reverse overflow-hidden hover:opacity-90 transition-opacity cursor-help" style={{ height: `${barHeight}%` }}>
                                          {knowledgeAreas.map(ka => {
                                              const areaCredits = data.areas[ka.id] || 0;
                                              if (areaCredits === 0) return null;
                                              const segHeight = (areaCredits / data.total) * 100;
                                              return (
                                                  <div 
                                                      key={ka.id} 
                                                      style={{ height: `${segHeight}%`, backgroundColor: getColorHex(ka.color) }}
                                                      title={`${ka.name[language]}: ${areaCredits} cr`}
                                                  />
                                              );
                                          })}
                                          {/* Total Label Popup */}
                                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 font-bold">
                                              {data.total} Credits
                                          </div>
                                      </div>
                                      <span className="text-[10px] font-bold text-slate-500">S{sem}</span>
                                  </div>
                              ); 
                          })}
                      </div>
                      
                      {/* Legend */}
                      <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center">
                          {knowledgeAreas.map(ka => (
                              <div key={ka.id} className="flex items-center gap-1.5">
                                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: getColorHex(ka.color) }}></div>
                                  <span className="text-[9px] font-semibold text-slate-600">{ka.name[language]}</span>
                              </div>
                          ))}
                      </div>
                  </div>
              </ChartCard>
          </div>
      </div>
  );

  const renderCoverage = () => {
      const maxCount = Math.max(...coverageStats.soCounts.map(s => s.count), 1);
      return (
          <div className="space-y-8 animate-in fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <ChartCard
                      id="chart-peo"
                      title="PEO Coverage"
                      icon={<Target size={18} className="text-indigo-600"/>}
                      onExportPng={() => handleExportImage('chart-peo', 'PEO_Coverage')}
                      onExportCsv={exportPeoCoverageCsv}
                  >
                      <div className="space-y-3 pt-2">
                          {coverageStats.peoCounts.map(p => (
                              <div key={p.id} className="flex items-center gap-3">
                                  <span className="w-12 text-xs font-bold text-slate-500">{p.code}</span>
                                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min((p.count / targetCourses.length) * 100 * 2, 100)}%` }}></div>
                                  </div>
                                  <span className="text-xs font-bold text-slate-700">{p.count}</span>
                              </div>
                          ))}
                      </div>
                  </ChartCard>

                  <ChartCard
                      id="chart-so"
                      title="SO/PLO Coverage"
                      icon={<Target size={18} className="text-emerald-600"/>}
                      onExportPng={() => handleExportImage('chart-so', 'SO_Coverage')}
                      onExportCsv={exportSoCoverageCsv}
                  >
                      <div className="space-y-3 pt-2">
                          {coverageStats.soCounts.map(s => (
                              <div key={s.id} className="flex items-center gap-3">
                                  <span className="w-12 text-xs font-bold text-slate-500">{s.code}</span>
                                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(s.count / maxCount) * 100}%` }}></div>
                                  </div>
                                  <span className="text-xs font-bold text-slate-700">{s.count}</span>
                              </div>
                          ))}
                      </div>
                  </ChartCard>
              </div>

              {/* PI Heatmap & CLO Alignment */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                      <ChartCard
                          id="chart-pi"
                          title="PI Coverage Heatmap"
                          icon={<Layers size={18} className="text-purple-600"/>}
                          onExportPng={() => handleExportImage('chart-pi', 'PI_Heatmap')}
                          onExportCsv={() => alert("CSV export for Heatmap coming soon.")}
                      >
                          <div className="grid grid-cols-6 gap-2 pt-2">
                              {coverageStats.piStats.map((pi, idx) => (
                                  <div key={idx} className={`p-2 rounded text-center border ${pi.count === 0 ? 'bg-red-50 border-red-100' : (pi.count < 3 ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100')}`}>
                                      <div className="text-[10px] font-bold text-slate-500">{pi.piCode}</div>
                                      <div className={`text-sm font-black ${pi.count === 0 ? 'text-red-500' : (pi.count < 3 ? 'text-amber-500' : 'text-green-600')}`}>{pi.count}</div>
                                  </div>
                              ))}
                          </div>
                      </ChartCard>
                  </div>
                  
                  <ChartCard
                      id="chart-clo"
                      title="CLO Alignment"
                      icon={<CheckCircle2 size={18} className="text-blue-600"/>}
                      onExportPng={() => handleExportImage('chart-clo', 'CLO_Alignment')}
                      onExportCsv={() => {}}
                  >
                      <div className="flex-1 flex flex-col justify-center items-center h-full pt-4">
                          <div className="relative w-32 h-32 mb-4">
                              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                                  <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.8"/>
                                  <path className="text-blue-500 transition-all duration-1000" strokeDasharray={`${(coverageStats.mappedClos / coverageStats.totalClos) * 100}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.8"/>
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center flex-col">
                                  <span className="text-2xl font-black text-slate-800">{((coverageStats.mappedClos / coverageStats.totalClos) * 100 || 0).toFixed(0)}%</span>
                                  <span className="text-[8px] uppercase font-bold text-slate-400">Mapped</span>
                              </div>
                          </div>
                          <div className="w-full space-y-2">
                              <div className="flex justify-between text-xs"><span className="text-slate-500">Total CLOs:</span><span className="font-bold">{coverageStats.totalClos}</span></div>
                              <div className="flex justify-between text-xs"><span className="text-slate-500">Mapped to SO:</span><span className="font-bold text-blue-600">{coverageStats.mappedClos}</span></div>
                              <div className="flex justify-between text-xs"><span className="text-slate-500">Orphaned:</span><span className="font-bold text-red-500">{coverageStats.unmappedClos}</span></div>
                          </div>
                      </div>
                  </ChartCard>
              </div>
          </div>
      );
  };

  const renderMethods = () => (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
          <ChartCard
              id="chart-teaching"
              title={language === 'vi' ? 'Phương pháp Giảng dạy' : 'Teaching Methods'}
              icon={<Microscope size={18} className="text-indigo-600"/>}
              onExportPng={() => handleExportImage('chart-teaching', 'Teaching_Methods')}
              onExportCsv={exportTeachingMethodsCsv}
          >
              <div className="space-y-3 pt-2">
                  {methodStats.teachingData.map((m, i) => (
                      <div key={i} className="flex items-center gap-3">
                          <span className="w-24 text-xs font-bold text-slate-500 truncate">{m.name}</span>
                          <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min((m.value / targetCourses.length) * 100, 100)}%` }}></div>
                          </div>
                          <span className="text-xs font-bold text-slate-700 w-8 text-right">{m.value}</span>
                      </div>
                  ))}
              </div>
          </ChartCard>

          <ChartCard
              id="chart-assessment"
              title={language === 'vi' ? 'Phương pháp Đánh giá' : 'Assessment Methods'}
              icon={<Activity size={18} className="text-emerald-600"/>}
              onExportPng={() => handleExportImage('chart-assessment', 'Assessment_Methods')}
              onExportCsv={() => {}}
          >
              <div className="space-y-3 pt-2">
                  {methodStats.assessmentData.map((m, i) => (
                      <div key={i} className="flex items-center gap-3">
                          <span className="w-32 text-xs font-bold text-slate-500 truncate">{m.name}</span>
                          <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((m.value / targetCourses.length) * 100, 100)}%` }}></div>
                          </div>
                          <span className="text-xs font-bold text-slate-700 w-8 text-right">{m.value}</span>
                      </div>
                  ))}
              </div>
          </ChartCard>
      </div>
  );

  const renderResources = () => (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
          <ChartCard
              id="chart-resources"
              title={language === 'vi' ? 'Phân bố độ tuổi tài liệu' : 'Resource Age Distribution'}
              icon={<Library size={18} className="text-amber-600"/>}
              onExportPng={() => handleExportImage('chart-resources', 'Library_Age_Distribution')}
              onExportCsv={exportResourceStatsCsv}
          >
              <div className="space-y-4 pt-2">
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg mb-2">
                      <span className="text-xs font-bold text-slate-600">{language === 'vi' ? 'Tổng số tài liệu' : 'Total Resources'}</span>
                      <span className="text-lg font-black text-indigo-600">{resourceStats.total}</span>
                  </div>
                  {resourceStats.data.map((d, i) => (
                      <div key={i}>
                          <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-slate-600">{d.label}</span>
                              <span className={`text-xs font-bold ${d.textColor}`}>{d.value} ({d.percentage.toFixed(1)}%)</span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${d.color}`} style={{ width: `${d.percentage}%` }}></div>
                          </div>
                      </div>
                  ))}
                  <div className="text-[10px] text-slate-400 italic text-center pt-2">
                      {language === 'vi' ? '* Dựa trên Năm xuất bản' : '* Based on Publication Year'}
                  </div>
              </div>
          </ChartCard>
      </div>
  );

  const renderAiReview = () => (
      <div className="h-full flex flex-col animate-in fade-in">
          <AILoader isVisible={isAiAnalyzing} message={language === 'vi' ? 'Đang kiểm toán chương trình...' : 'Auditing Curriculum...'} />
          
          <div className="bg-gradient-to-r from-slate-900 to-indigo-900 p-8 rounded-2xl shadow-xl mb-6 text-white flex justify-between items-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
              <div className="relative z-10">
                  <h2 className="text-2xl font-black mb-2 flex items-center gap-3"><BrainCircuit size={28}/> AI Program Auditor</h2>
                  <p className="text-indigo-200 text-sm max-w-lg">
                      {language === 'vi' 
                        ? 'Sử dụng AI để phân tích logic ma trận, độ phủ chuẩn đầu ra, sự đa dạng của phương pháp đánh giá và đề xuất cải tiến.' 
                        : 'Use AI to analyze matrix logic, outcome coverage, assessment diversity, and improvement suggestions.'}
                  </p>
              </div>
              <button 
                  onClick={handleRunAiAudit}
                  disabled={isAiAnalyzing}
                  className="relative z-10 bg-white text-indigo-900 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-50 transition-all shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50"
              >
                  <Sparkles size={18}/> {language === 'vi' ? 'Chạy kiểm toán ngay' : 'Run Audit Now'}
              </button>
          </div>

          {aiReport ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex-1 overflow-y-auto custom-scrollbar prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-slate-800 prose-p:text-slate-600 prose-li:text-slate-600 prose-strong:text-indigo-700">
                  <div className="flex justify-end mb-4">
                      <button onClick={() => {
                          const blob = new Blob([aiReport], { type: 'text/markdown' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `AI_Audit_Report_${Date.now()}.md`;
                          a.click();
                      }} className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600">
                          <Download size={14}/> Export Markdown
                      </button>
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: aiReport.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
              </div>
          ) : (
              <div className="flex-1 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                  <Microscope size={48} className="mb-4 opacity-20"/>
                  <p className="font-medium">{language === 'vi' ? 'Chưa có báo cáo nào. Nhấn nút phía trên để bắt đầu.' : 'No report generated yet. Click the button above to start.'}</p>
              </div>
          )}
      </div>
  );

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header & Controls */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0">
          <div className="flex items-center gap-6">
              <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="text-indigo-600"/> {t.analytics}
              </h1>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button onClick={() => setActiveTab('general')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'general' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>{language === 'vi' ? 'Tổng quan' : 'Overview'}</button>
                  <button onClick={() => setActiveTab('coverage')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'coverage' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>{language === 'vi' ? 'Độ phủ & Liên kết' : 'Coverage & Alignment'}</button>
                  <button onClick={() => setActiveTab('methods')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'methods' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>{language === 'vi' ? 'Phương pháp' : 'Methods'}</button>
                  <button onClick={() => setActiveTab('resources')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'resources' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>{language === 'vi' ? 'Tài nguyên' : 'Resources'}</button>
                  <button onClick={() => setActiveTab('ai')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${activeTab === 'ai' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Sparkles size={12}/> AI Audit</button>
              </div>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setScope('all')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${scope === 'all' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>{language === 'vi' ? 'Toàn bộ' : 'All Courses'}</button>
              <button onClick={() => setScope('abet')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${scope === 'abet' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>ABET</button>
              <button onClick={() => setScope('essential')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${scope === 'essential' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>{language === 'vi' ? 'Cốt lõi' : 'Essential Only'}</button>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
          {activeTab === 'general' && renderGeneral()}
          {activeTab === 'coverage' && renderCoverage()}
          {activeTab === 'methods' && renderMethods()}
          {activeTab === 'resources' && renderResources()}
          {activeTab === 'ai' && renderAiReview()}
      </div>
    </div>
  );
};

export default AnalyticsModule;
