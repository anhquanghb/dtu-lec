import React, { useState, useEffect } from 'react';
import { AppState } from './types';
import { INITIAL_STATE } from './constants';
import Layout from './components/Layout';
import StrategyModule from './modules/StrategyModule';
import OutcomesModule from './modules/OutcomesModule';
import MappingModule from './modules/MappingModule';
import FlowchartModule from './modules/FlowchartModule';
import SyllabusModule from './modules/SyllabusModule';
import LibraryModule from './modules/LibraryModule';
import FacultyModule from './modules/FacultyModule';
import AnalyticsModule from './modules/AnalyticsModule';
import GeneralInfoModule from './modules/GeneralInfoModule';
import TransformationModule from './modules/TransformationModule';
import SettingsModule from './modules/SettingsModule';
import UserManagementModule from './modules/UserManagementModule';
import JSONInputModule from './modules/JSONInputModule';

// Mock Login Component
const LoginScreen = ({ onLogin }: { onLogin: () => void }) => (
  <div className="flex flex-col items-center justify-center h-screen bg-slate-100">
    <div className="bg-white p-8 rounded-xl shadow-xl text-center">
      <h1 className="text-2xl font-bold mb-4 text-indigo-700">DTU Pro-Editor</h1>
      <p className="mb-6 text-slate-600">Please sign in to access the curriculum system.</p>
      <button onClick={onLogin} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors">
        Sign In with Google
      </button>
    </div>
  </div>
);

const App: React.FC = () => {
  // Load state from localStorage or use INITIAL_STATE
  const [state, setState] = useState<AppState>(() => {
    try {
        const saved = localStorage.getItem('appState');
        return saved ? JSON.parse(saved) : INITIAL_STATE;
    } catch (e) {
        console.error("Failed to load state", e);
        return INITIAL_STATE;
    }
  });

  const [currentModule, setCurrentModule] = useState('flowchart');
  // For SyllabusModule coordination
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('appState', JSON.stringify(state));
  }, [state]);

  const updateState = (updater: (prev: AppState) => AppState) => {
    setState(prev => updater(prev));
  };

  const handleLogin = () => {
    // Mock login logic - typically handled via OAuth
    updateState(prev => ({
        ...prev,
        currentUser: prev.users[0] // Login as Admin 'u1' for demo
    }));
  };

  const handleLogout = () => {
    updateState(prev => ({ ...prev, currentUser: null }));
  };

  const handleExport = () => {
    const date = new Date().toISOString().split('T')[0];
    
    // Filter out hardcoded admin 'u1' for export to keep data clean if needed
    // AND STRIP API KEY
    const exportState = {
        ...state,
        users: state.users.filter(u => u.id !== 'u1'),
        geminiConfig: {
            ...state.geminiConfig,
            apiKey: undefined // Ensure API key is NOT exported
        }
    };

    const majorCode = state.generalInfo.moetInfo.majorCode || 'UnknownCode';
    const specNameRaw = state.generalInfo.moetInfo.specializationName['en'] || 
                        state.generalInfo.moetInfo.specializationName[state.language] || 
                        'General';
    
    const sanitize = (str: string) => str.trim().replace(/[^a-zA-Z0-9-_]/g, '_');
    const specName = sanitize(specNameRaw);
    const safeMajorCode = sanitize(majorCode);

    const filename = `PROG_Data_${safeMajorCode}_${specName}_${date}.json`;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportState, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", filename);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          try {
              const parsed = JSON.parse(evt.target?.result as string);
              if (confirm("Restore state from file? This will overwrite current data.")) {
                  setState(prev => ({ 
                      ...parsed, 
                      currentUser: prev.currentUser || parsed.currentUser,
                      // Preserve existing API key if present in current state, ignore import key
                      geminiConfig: {
                          ...parsed.geminiConfig,
                          apiKey: prev.geminiConfig?.apiKey
                      }
                  })); 
              }
          } catch(e) {
              alert("Import failed. Invalid JSON.");
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  // Auth Guard
  if (state.authEnabled && !state.currentUser) {
      return <LoginScreen onLogin={handleLogin} />;
  }

  const renderModule = () => {
    switch (currentModule) {
      case 'strategy': return <StrategyModule state={state} updateState={updateState} />;
      case 'outcomes': return <OutcomesModule state={state} updateState={updateState} />;
      case 'mapping': return <MappingModule state={state} updateState={updateState} />;
      case 'flowchart': return <FlowchartModule state={state} updateState={updateState} onCourseNavigate={(id) => { setSelectedCourseId(id); setCurrentModule('syllabus'); }} />;
      case 'syllabus': return <SyllabusModule state={state} updateState={updateState} selectedCourseId={selectedCourseId} setSelectedCourseId={setSelectedCourseId} />;
      case 'library': return <LibraryModule state={state} updateState={updateState} />;
      case 'faculty': return <FacultyModule state={state} updateState={updateState} />;
      case 'analytics': return <AnalyticsModule state={state} updateState={updateState} />;
      case 'general': return <GeneralInfoModule state={state} updateState={updateState} />;
      case 'transformation': return <TransformationModule state={state} updateState={updateState} />;
      case 'settings': return <SettingsModule state={state} updateState={updateState} onExport={handleExport} onImport={handleImport} />;
      case 'users': return <UserManagementModule state={state} updateState={updateState} />;
      case 'json-input': return <JSONInputModule state={state} updateState={updateState} />;
      default: return <FlowchartModule state={state} updateState={updateState} onCourseNavigate={(id) => { setSelectedCourseId(id); setCurrentModule('syllabus'); }} />;
    }
  };

  return (
    <Layout 
      state={state} 
      setLanguage={(lang) => updateState(prev => ({ ...prev, language: lang }))}
      currentModule={currentModule}
      setCurrentModule={setCurrentModule}
      onExport={handleExport}
      onImport={handleImport}
      onLogout={handleLogout}
    >
      {renderModule()}
    </Layout>
  );
};

export default App;