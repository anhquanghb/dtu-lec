
import React, { useState } from 'react';
import { AppState, Course } from '../types';

interface Props {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const CatalogModule: React.FC<Props> = ({ state, updateState }) => {
  // Destructured knowledgeAreas from state
  const { courses, language, knowledgeAreas, generalInfo } = state;
  const [editingId, setEditingId] = useState<string | null>(null);

  const deleteCourse = (id: string) => {
    if (confirm("Delete this course?")) {
      updateState(prev => ({ ...prev, courses: prev.courses.filter(c => c.id !== id) }));
    }
  };

  const toggleEssential = (id: string) => {
    updateState(prev => ({
      ...prev,
      courses: prev.courses.map(c => c.id === id ? { ...c, isEssential: !c.isEssential } : c)
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-slate-800">Course Catalog</h2>
        <button 
          onClick={() => {
            const newCourse: Course = {
              id: Date.now().toString(),
              code: generalInfo.defaultSubjectCode || 'NEW',
              name: generalInfo.defaultSubjectName ? { ...generalInfo.defaultSubjectName } : { vi: 'Môn mới', en: 'New Course' },
              credits: generalInfo.defaultCredits || 3,
              isEssential: false,
              type: 'REQUIRED',
              // Fixed: Use knowledgeAreaId and a default ID string
              knowledgeAreaId: knowledgeAreas?.[0]?.id || 'other',
              semester: 1,
              colIndex: 0,
              prerequisites: [],
              // Added missing required properties and fixed topics initialization
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
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
        >
          <i className="fas fa-plus"></i> Add Course
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Code</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Name ({language.toUpperCase()})</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Credits</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Essential</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Area</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {courses.map(course => (
              <tr key={course.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-mono font-bold text-indigo-600">{course.code}</td>
                <td className="px-6 py-4 font-medium text-slate-700">{course.name[language]}</td>
                <td className="px-6 py-4 text-center">
                  <span className="bg-slate-100 px-2 py-1 rounded text-sm font-bold">
                    {course.credits}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                   <button 
                    onClick={() => toggleEssential(course.id)}
                    className={`text-xl ${course.isEssential ? 'text-amber-500' : 'text-slate-300'}`}
                   >
                     <i className="fas fa-star"></i>
                   </button>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded uppercase font-bold">
                    {/* Fixed: Use knowledgeAreaId property */}
                    {course.knowledgeAreaId.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 space-x-2">
                  <button className="text-slate-400 hover:text-indigo-600"><i className="fas fa-edit"></i></button>
                  <button onClick={() => deleteCourse(course.id)} className="text-slate-400 hover:text-red-600"><i className="fas fa-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CatalogModule;