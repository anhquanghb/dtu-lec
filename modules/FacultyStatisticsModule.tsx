import React, { useMemo } from 'react';
import { Faculty, Course, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { PieChart, BarChart2, TrendingUp, Users, Award, BookOpen, UserCheck } from 'lucide-react';

interface Props {
  faculties: Faculty[];
  courses: Course[];
  language: Language;
  scope: 'all' | 'abet';
  setScope: (scope: 'all' | 'abet') => void;
}

const FacultyStatisticsModule: React.FC<Props> = ({ faculties, courses, language, scope, setScope }) => {
  const t = TRANSLATIONS[language];

  // --- Stats Calculation ---
  const stats: {
      total: number;
      degrees: Record<string, number>;
      ranks: Record<string, number>;
      academicTitles: Record<string, number>;
      phdCount: number;
      profCount: number;
      avgExp: string;
  } = useMemo(() => {
    const total = faculties.length;
    
    // 1. Degree Stats & Specific Counts
    let phdCount = 0;
    const degrees = faculties.reduce((acc, f) => {
        const d = f.degree[language] || 'Unknown';
        acc[d] = (acc[d] || 0) + 1;
        
        // Count PhDs (checking both lang versions for safety)
        const dLower = ((f.degree?.vi || '') + ' ' + (f.degree?.en || '')).toLowerCase();
        if (dLower.includes('tiến sĩ') || dLower.includes('ph.d') || dLower.includes('doctor')) {
            phdCount++;
        }
        return acc;
    }, {} as Record<string, number>);

    // 2. Rank/Title Stats & Specific Counts
    let profCount = 0;
    const ranks = faculties.reduce((acc, f) => {
        const r = f.rank[language] || 'Unknown';
        acc[r] = (acc[r] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const academicTitles = faculties.reduce((acc, f) => {
        const at = f.academicTitle[language];
        if (at && at !== 'Không' && at !== 'None') {
            acc[at] = (acc[at] || 0) + 1;
            // Count Professors/Assoc. Profs
            const atLower = ((f.academicTitle?.vi || '') + ' ' + (f.academicTitle?.en || '')).toLowerCase();
            if (atLower.includes('giáo sư') || atLower.includes('professor')) {
                profCount++;
            }
        }
        return acc;
    }, {} as Record<string, number>);

    // 3. Average Experience (String representation)
    const avgExp = total > 0 ? (faculties.reduce((acc, f) => acc + (parseInt(f.experience?.vi || '0') || 0), 0) / total).toFixed(1) : '0';

    return { total, degrees, ranks, academicTitles, phdCount, profCount, avgExp };
  }, [faculties, language]);

  return (
    <div className="space-y-6 animate-in fade-in">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full"><Users size={24}/></div>
                <div>
                    <div className="text-sm font-medium text-slate-500">{language === 'vi' ? 'Tổng số giảng viên' : 'Total Faculty'}</div>
                    <div className="text-2xl font-black text-slate-800">{stats.total}</div>
                </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full"><Award size={24}/></div>
                <div>
                    <div className="text-sm font-medium text-slate-500">PhD / Doctorate</div>
                    <div className="text-2xl font-black text-slate-800">{stats.phdCount} <span className="text-sm font-normal text-slate-400">({((stats.phdCount / stats.total) * 100 || 0).toFixed(0)}%)</span></div>
                </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-full"><BookOpen size={24}/></div>
                <div>
                    <div className="text-sm font-medium text-slate-500">{language === 'vi' ? 'Giáo sư / PGS' : 'Prof / Assoc. Prof'}</div>
                    <div className="text-2xl font-black text-slate-800">{stats.profCount}</div>
                </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-full"><TrendingUp size={24}/></div>
                <div>
                    <div className="text-sm font-medium text-slate-500">{language === 'vi' ? 'Kinh nghiệm TB' : 'Avg Experience'}</div>
                    <div className="text-2xl font-black text-slate-800">{stats.avgExp} <span className="text-sm font-normal text-slate-400">years</span></div>
                </div>
            </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><PieChart size={18} className="text-indigo-500"/> {language === 'vi' ? 'Phân bố theo Học vị' : 'Degree Distribution'}</h3>
                <div className="space-y-3">
                    {Object.entries(stats.degrees).sort((a,b) => b[1] - a[1]).map(([deg, count]) => (
                        <div key={deg}>
                            <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                                <span>{deg}</span>
                                <span>{count} ({((count as number / stats.total) * 100).toFixed(1)}%)</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${(count as number / stats.total) * 100}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><BarChart2 size={18} className="text-emerald-500"/> {language === 'vi' ? 'Phân bố theo Chức danh' : 'Rank Distribution'}</h3>
                <div className="space-y-3">
                    {Object.entries(stats.ranks).sort((a,b) => b[1] - a[1]).map(([rank, count]) => (
                        <div key={rank}>
                            <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                                <span>{rank}</span>
                                <span>{count}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(count as number / stats.total) * 100}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><UserCheck size={18} className="text-purple-500"/> {language === 'vi' ? 'Danh sách Giảng viên' : 'Faculty List'}</h3>
             <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm border-collapse">
                     <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                         <tr>
                             <th className="p-3">Name</th>
                             <th className="p-3">Rank</th>
                             <th className="p-3">Degree</th>
                             <th className="p-3">Experience</th>
                             <th className="p-3">Full-time?</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                         {faculties.map(f => (
                             <tr key={f.id} className="hover:bg-slate-50">
                                 <td className="p-3 font-bold text-slate-700">{f.name[language]}</td>
                                 <td className="p-3">{f.rank[language]}</td>
                                 <td className="p-3">{f.degree[language]}</td>
                                 <td className="p-3">{f.experience[language]} years</td>
                                 <td className="p-3">
                                     {/* Assumption: Check employment type if available or assume FT if unspecified/default */}
                                     <span className={`px-2 py-1 rounded text-[10px] font-bold ${f.employmentType === 'PT' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                         {f.employmentType === 'PT' ? 'Part-time' : 'Full-time'}
                                     </span>
                                 </td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </div>
        </div>
    </div>
  );
};

export default FacultyStatisticsModule;