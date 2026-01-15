
import React, { useState } from 'react';
import { AlertCircle, Code, Copy, Check, ExternalLink, Settings } from 'lucide-react';

interface Props {
  error: string | null;
}

const FirebaseErrorBanner: React.FC<Props> = ({ error }) => {
  const [copied, setCopied] = useState(false);
  if (!error || !error.includes('permissions')) return null;

  const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(rules);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border-2 border-red-500 rounded-[2.5rem] p-8 mb-8 shadow-2xl shadow-red-100 animate-in slide-in-from-top-8 duration-500 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16 -z-10"></div>
      
      <div className="flex flex-col md:flex-row gap-8 items-start">
        <div className="bg-red-500 p-4 rounded-3xl text-white shadow-xl shadow-red-200">
          <Settings size={32} className="animate-spin-slow" style={{ animationDuration: '8s' }} />
        </div>
        
        <div className="flex-1 space-y-6">
          <div>
            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              Action Requise : Débloquer la Base de Données
            </h3>
            <p className="text-slate-500 font-medium mt-2 leading-relaxed">
              Firebase a bloqué l'accès car les <strong>Règles de Sécurité</strong> sont trop restrictives. 
              Suivez ces étapes pour activer la synchronisation en temps réel :
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a 
              href="https://console.firebase.google.com/project/_/database/firestore/rules" 
              target="_blank" 
              className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">1</div>
                <span className="font-bold text-slate-700">Ouvrir la Console Firebase</span>
              </div>
              <ExternalLink size={18} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
            </a>
            <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">2</div>
              <span className="font-bold text-slate-700">Coller les règles ci-dessous</span>
            </div>
          </div>

          <div className="bg-slate-900 rounded-[1.5rem] p-6 relative">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Code size={14} /> Firestore Security Rules
              </span>
              <button 
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copied ? 'Copié !' : 'Copier les règles'}
              </button>
            </div>
            <pre className="text-blue-400 text-sm font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48 scrollbar-hide">
              {rules}
            </pre>
          </div>

          <div className="bg-emerald-50 p-4 rounded-2xl flex items-center gap-3 text-emerald-800 font-bold text-sm border border-emerald-100">
            <Check size={18} className="text-emerald-500" />
            Cliquez sur "Publier" dans la console pour activer immédiatement l'application.
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirebaseErrorBanner;
