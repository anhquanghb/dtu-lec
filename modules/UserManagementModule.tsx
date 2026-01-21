import React, { useState } from 'react';
import { AppState, Role } from '../types';
import { TRANSLATIONS } from '../constants';
import { Users, Search, Shield, ShieldOff, Trash2, Mail, User as UserIcon } from 'lucide-react';

interface Props {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const UserManagementModule: React.FC<Props> = ({ state, updateState }) => {
  const { users, language, currentUser } = state;
  const t = TRANSLATIONS[language];
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter(u => 
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleRole = (userId: string) => {
      updateState(prev => ({
          ...prev,
          users: prev.users.map(u => u.id === userId ? { ...u, role: u.role === 'ADMIN' ? 'USER' : 'ADMIN' } : u)
      }));
  };

  const deleteUser = (userId: string) => {
      if (confirm(language === 'vi' ? "Xóa người dùng này?" : "Delete this user?")) {
          updateState(prev => ({
              ...prev,
              users: prev.users.filter(u => u.id !== userId)
          }));
      }
  };

  return (
    <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Users size={20} className="text-indigo-600"/> {t.userManagement}
            </h1>
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                    className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">{t.userName}</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Email</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">{t.userRole}</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">{t.lastActive}</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredUsers.map(user => (
                        <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="p-4">
                                <div className="flex items-center gap-3">
                                    <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}`} className="w-8 h-8 rounded-full" alt="avatar"/>
                                    <span className="font-bold text-slate-700 text-sm">{user.name}</span>
                                </div>
                            </td>
                            <td className="p-4">
                                <div className="flex items-center gap-2 text-slate-600 text-sm">
                                    <Mail size={14} className="text-slate-400"/> {user.email}
                                </div>
                            </td>
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${user.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {user.role}
                                </span>
                            </td>
                            <td className="p-4 text-xs text-slate-500 font-mono">
                                {new Date(user.lastLogin).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-right">
                                {currentUser?.id !== user.id && (
                                    <div className="flex justify-end gap-2">
                                        <button 
                                            onClick={() => toggleRole(user.id)}
                                            className="p-2 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-colors"
                                            title={user.role === 'ADMIN' ? t.demoteToUser : t.promoteToAdmin}
                                        >
                                            {user.role === 'ADMIN' ? <ShieldOff size={16}/> : <Shield size={16}/>}
                                        </button>
                                        <button 
                                            onClick={() => deleteUser(user.id)}
                                            className="p-2 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
                                            title={t.deleteUser}
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );
};

export default UserManagementModule;
