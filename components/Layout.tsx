import React, { useState } from 'react';
import { TRANSLATIONS } from '../constants';
import { AppState, Language } from '../types';
import { Settings, Users, LogOut, ShieldCheck, Menu, X, ChevronLeft, ChevronRight, UserCog, FileJson } from 'lucide-react';

interface LayoutProps {
  state: AppState;
  setLanguage: (lang: Language) => void;
  currentModule: string;
  setCurrentModule: (mod: string) => void;
  children: React.ReactNode;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ state, setLanguage, currentModule, setCurrentModule, children, onLogout }) => {
  const { language, currentUser } = state;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const t = TRANSLATIONS[language];

  // Default guest avatar and info if no user logged in
  const defaultAvatar = "https://ui-avatars.com/api/?name=Guest&background=64748b&color=fff";
  const displayAvatar = currentUser?.avatar || defaultAvatar;
  const displayName = currentUser?.name || "Guest User";
  const displayRole = currentUser?.role || "VISITOR";

  const menuItems = [
    // { id: 'strategy', icon: 'fa-bullseye', label: t.strategy },
    // { id: 'outcomes', icon: 'fa-award', label: t.outcomes },
    // { id: 'mapping', icon: 'fa-table-cells', label: t.mapping },
    { id: 'flowchart', icon: 'fa-diagram-project', label: t.flowchart },
    { id: 'syllabus', icon: 'fa-file-lines', label: t.syllabus },
    { id: 'library', icon: 'fa-book', label: t.library }, // Added Library Item
    { id: 'faculty', icon: 'fa-users', label: t.faculty },
    // { id: 'analytics', icon: 'fa-brain', label: t.analytics },
    // { id: 'general', icon: 'fa-info-circle', label: t.general },
    // { id: 'transformation', icon: 'fa-random', label: t.transformation },
  ];

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      {/* Brand Header */}
      <div className="p-6 flex items-center justify-between border-b border-slate-800">
        <div className={`flex items-center gap-3 transition-opacity duration-300 ${!isSidebarOpen && 'lg:opacity-0'}`}>
          <i className="fas fa-graduation-cap text-indigo-400 text-xl"></i>
          <span className="text-xl font-bold tracking-tight">DTU Pro-Editor</span>
        </div>
        <button 
          onClick={toggleSidebar} 
          className="hidden lg:flex p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition-all"
        >
          {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
        <button 
          onClick={toggleMobileMenu} 
          className="lg:hidden p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"
        >
          <X size={20} />
        </button>
      </div>

      {/* Profile Section */}
      <div className={`p-4 bg-slate-800/30 flex items-center gap-3 border-b border-slate-800 overflow-hidden ${!isSidebarOpen ? 'lg:justify-center' : ''}`}>
        <img 
          src={displayAvatar} 
          className="w-10 h-10 rounded-full border-2 border-indigo-500/30 shrink-0" 
          alt="avatar" 
        />
        {isSidebarOpen && (
          <div className="min-w-0 flex-1 animate-in fade-in slide-in-from-left-2">
            <div className="text-xs font-bold text-white truncate">{displayName}</div>
            <div className="mt-1">
              <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${
                displayRole === 'ADMIN' ? 'bg-indigo-600 text-white' : 'bg-slate-600 text-slate-300'
              }`}>
                {displayRole}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => {
              setCurrentModule(item.id);
              if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
              currentModule === item.id 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' 
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            } ${!isSidebarOpen ? 'lg:justify-center lg:px-0' : ''}`}
            title={item.label}
          >
            <i className={`fas ${item.icon} w-5 text-center text-xs opacity-70`}></i>
            {(isSidebarOpen || window.innerWidth < 1024) && (
              <span className="font-medium text-xs truncate animate-in fade-in slide-in-from-left-1">{item.label}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer Navigation */}
      <div className="p-4 border-t border-slate-800 space-y-1">
        
        {/* Settings */}
        <button
          onClick={() => {
            setCurrentModule('settings');
            if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
            currentModule === 'settings' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          } ${!isSidebarOpen ? 'lg:justify-center lg:px-0' : ''}`}
          title={t.settings}
        >
          <Settings size={18} />
          {(isSidebarOpen || window.innerWidth < 1024) && (
            <span className="font-medium text-xs animate-in fade-in slide-in-from-left-1">{t.settings}</span>
          )}
        </button>

        {/* User Management (Admin Only) */}
        {currentUser?.role === 'ADMIN' && (
          <button
            onClick={() => {
              setCurrentModule('users');
              if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
              currentModule === 'users' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            } ${!isSidebarOpen ? 'lg:justify-center lg:px-0' : ''}`}
            title={t.users}
          >
            <UserCog size={18} />
            {(isSidebarOpen || window.innerWidth < 1024) && (
              <span className="font-medium text-xs animate-in fade-in slide-in-from-left-1">{t.users}</span>
            )}
          </button>
        )}
        
        {/* Logout */}
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left ${!isSidebarOpen ? 'lg:justify-center lg:px-0' : ''}`}
          title={t.logout}
        >
          <LogOut size={18} />
          {(isSidebarOpen || window.innerWidth < 1024) && (
            <span className="font-medium text-xs animate-in fade-in slide-in-from-left-1">{t.logout}</span>
          )}
        </button>

        {/* Language Selection */}
        {(isSidebarOpen || window.innerWidth < 1024) ? (
          <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-black px-3 pt-4 tracking-widest animate-in fade-in">
            <span>Lang</span>
            <div className="flex gap-3">
              <button onClick={() => setLanguage('vi')} className={language === 'vi' ? 'text-indigo-400' : 'hover:text-slate-300'}>VI</button>
              <button onClick={() => setLanguage('en')} className={language === 'en' ? 'text-indigo-400' : 'hover:text-slate-300'}>EN</button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center pt-4 text-[10px] font-black text-slate-600">
            {language.toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop Sidebar */}
      <aside 
        className={`hidden lg:flex flex-col shrink-0 transition-all duration-300 ease-in-out border-r border-slate-800 ${
          isSidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[100] flex">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={toggleMobileMenu}></div>
          <aside className="relative w-72 h-full shadow-2xl animate-in slide-in-from-left duration-300">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden text-left">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleMobileMenu} 
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-lg lg:text-xl font-bold text-slate-800 tracking-tight truncate max-w-[200px] md:max-w-none">
              {menuItems.find(m => m.id === currentModule)?.label || (currentModule === 'settings' ? t.settings : currentModule === 'users' ? t.users : currentModule === 'json-input' ? (language === 'vi' ? 'Nhập JSON' : 'JSON Input') : '')}
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider items-center gap-2 border border-emerald-100 shadow-sm">
               <ShieldCheck size={14} /> Duy Tan University 2026
             </div>
             {/* Small indicator of collapsed sidebar on desktop */}
             {!isSidebarOpen && (
                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500">
                   <Menu size={12} />
                </div>
             )}
          </div>
        </header>

        {/* Dynamic Module Content */}
        <section className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
          {children}
        </section>
      </main>
    </div>
  );
};

export default Layout;