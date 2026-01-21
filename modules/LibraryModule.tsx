
import React, { useState, useMemo } from 'react';
import { AppState, LibraryResource } from '../types';
import { TRANSLATIONS } from '../constants';
import { Search, Plus, Trash2, Edit2, BookOpen, Link as LinkIcon, Check, X } from 'lucide-react';

interface Props {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const LibraryModule: React.FC<Props> = ({ state, updateState }) => {
  const { library, courses, language } = state;
  const t = TRANSLATIONS[language];
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'textbook' | 'reference'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<LibraryResource>>({});

  // Compute usage of each resource in courses
  const resourceUsage = useMemo(() => {
      const usage = new Map<string, { textbooks: string[], references: string[] }>();
      library.forEach(lib => {
          usage.set(lib.id, { textbooks: [], references: [] });
      });

      courses.forEach(c => {
          c.textbooks.forEach(tb => {
              // Note: tb.resourceId links to library item id
              if (usage.has(tb.resourceId)) {
                  if (tb.type === 'textbook') {
                      usage.get(tb.resourceId)?.textbooks.push(c.code);
                  } else {
                      usage.get(tb.resourceId)?.references.push(c.code);
                  }
              }
          });
      });
      return usage;
  }, [library, courses]);

  const filteredLibrary = library.filter(item => {
      const matchesSearch = (item.title + item.author + item.publisher).toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || item.type === filterType;
      return matchesSearch && matchesType;
  });

  const handleAdd = () => {
      const newItem: LibraryResource = {
          id: `lib-${Date.now()}`,
          title: '',
          author: '',
          publisher: '',
          year: new Date().getFullYear().toString(),
          type: 'textbook',
          isEbook: false,
          isPrinted: true,
          url: ''
      };
      updateState(prev => ({ ...prev, library: [newItem, ...prev.library] }));
      setEditingId(newItem.id);
      setEditForm(newItem);
  };

  const handleSave = () => {
      if (editingId && editForm.title) {
          updateState(prev => ({
              ...prev,
              library: prev.library.map(l => l.id === editingId ? { ...l, ...editForm } as LibraryResource : l)
          }));
          setEditingId(null);
          setEditForm({});
      }
  };

  const handleDelete = (id: string) => {
      if (confirm(language === 'vi' ? "Xóa tài liệu này?" : "Delete this resource?")) {
          updateState(prev => ({
              ...prev,
              library: prev.library.filter(l => l.id !== id),
              // Also remove references from courses
              courses: prev.courses.map(c => ({
                  ...c,
                  textbooks: c.textbooks.filter(tb => tb.resourceId !== id)
              }))
          }));
      }
  };

  const startEdit = (item: LibraryResource) => {
      setEditingId(item.id);
      setEditForm({ ...item });
  };

  return (
    <div className="space-y-6 h-full flex flex-col relative">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0 gap-4">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <BookOpen size={20} className="text-indigo-600"/> {t.library}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4">
                {/* Search */}
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                        placeholder={language === 'vi' ? "Tìm kiếm..." : "Search resources..."}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Filters Group */}
                <div className="flex items-center gap-2">
                    {/* Category Filter */}
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button onClick={() => setFilterType('all')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === 'all' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>{t.allCategories}</button>
                        <button onClick={() => setFilterType('textbook')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === 'textbook' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>{t.typeTextbook}</button>
                        <button onClick={() => setFilterType('reference')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === 'reference' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>{t.typeReference}</button>
                    </div>
                </div>

                <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

                <button onClick={handleAdd} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-sm">
                    <Plus size={16} /> {t.createResource}
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-sm">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <tr>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase w-1/3">Resource Info</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase w-48">Details</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Usage (Courses)</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right w-24">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredLibrary.map(item => (
                        <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${editingId === item.id ? 'bg-indigo-50/30' : ''}`}>
                            {editingId === item.id ? (
                                // Editing Mode
                                <>
                                    <td className="p-4 align-top space-y-2">
                                        <input className="w-full p-2 border border-slate-200 rounded text-sm font-bold" placeholder="Title" value={editForm.title || ''} onChange={e => setEditForm({...editForm, title: e.target.value})} />
                                        <div className="flex gap-2">
                                            <input className="flex-1 p-2 border border-slate-200 rounded text-xs" placeholder="Author" value={editForm.author || ''} onChange={e => setEditForm({...editForm, author: e.target.value})} />
                                            <input className="w-24 p-2 border border-slate-200 rounded text-xs" placeholder="Year" value={editForm.year || ''} onChange={e => setEditForm({...editForm, year: e.target.value})} />
                                        </div>
                                        <input className="w-full p-2 border border-slate-200 rounded text-xs" placeholder="Publisher" value={editForm.publisher || ''} onChange={e => setEditForm({...editForm, publisher: e.target.value})} />
                                    </td>
                                    <td className="p-4 align-top space-y-2">
                                        <select className="w-full p-2 border border-slate-200 rounded text-xs" value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value as any})}>
                                            <option value="textbook">{t.typeTextbook}</option>
                                            <option value="reference">{t.typeReference}</option>
                                        </select>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={editForm.isEbook} onChange={e => setEditForm({...editForm, isEbook: e.target.checked})} /> Ebook</label>
                                            <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={editForm.isPrinted} onChange={e => setEditForm({...editForm, isPrinted: e.target.checked})} /> Printed</label>
                                        </div>
                                        <input className="w-full p-2 border border-slate-200 rounded text-xs" placeholder="URL (Optional)" value={editForm.url || ''} onChange={e => setEditForm({...editForm, url: e.target.value})} />
                                    </td>
                                    <td className="p-4 align-top">
                                        <div className="text-xs text-slate-400 italic">Usage info not editable</div>
                                    </td>
                                    <td className="p-4 align-top text-right space-y-2">
                                        <button onClick={handleSave} className="p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 w-full flex justify-center"><Check size={16}/></button>
                                        <button onClick={() => setEditingId(null)} className="p-2 bg-slate-200 text-slate-600 rounded hover:bg-slate-300 w-full flex justify-center"><X size={16}/></button>
                                    </td>
                                </>
                            ) : (
                                // View Mode
                                <>
                                    <td className="p-4 align-top">
                                        <div className="font-bold text-slate-800 text-sm">{item.title}</div>
                                        <div className="text-xs text-slate-500 mt-1">{item.author}</div>
                                        <div className="text-xs text-slate-400">{item.publisher} • {item.year}</div>
                                        {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center gap-1 mt-1"><LinkIcon size={10}/> Link</a>}
                                    </td>
                                    <td className="p-4 align-top">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase mb-1 inline-block ${item.type === 'textbook' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {item.type === 'textbook' ? t.typeTextbook : t.typeReference}
                                        </span>
                                        <div className="flex gap-2 text-[10px] text-slate-500 mt-1">
                                            {item.isEbook && <span className="px-1.5 py-0.5 border rounded">Ebook</span>}
                                            {item.isPrinted && <span className="px-1.5 py-0.5 border rounded">Printed</span>}
                                        </div>
                                    </td>
                                    <td className="p-4 align-top">
                                        {resourceUsage.get(item.id) && (
                                            <div className="flex flex-wrap gap-1">
                                                {resourceUsage.get(item.id)?.textbooks.map(code => (
                                                    <span key={code} className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded text-[10px] font-bold">{code} (T)</span>
                                                ))}
                                                {resourceUsage.get(item.id)?.references.map(code => (
                                                    <span key={code} className="px-1.5 py-0.5 bg-slate-50 border border-slate-100 text-slate-600 rounded text-[10px]">{code} (R)</span>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 align-top text-right">
                                        <div className="flex justify-end gap-1">
                                            <button onClick={() => startEdit(item)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"><Edit2 size={16}/></button>
                                            <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </>
                            )}
                        </tr>
                    ))}
                    {filteredLibrary.length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">No resources found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );
};

export default LibraryModule;
