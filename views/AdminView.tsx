import React, { useState } from 'react';
import { collection, writeBatch, getDocs, addDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Settings, ShieldAlert, Zap, AlertCircle, CheckCircle2, Trash2, RefreshCcw, Lock, ShieldCheck } from 'lucide-react';
import { RaceType, RaceStatus, ParticipantStatus } from '../types';

const AdminView: React.FC = () => {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [diagStatus, setDiagStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [resetConfirm, setResetConfirm] = useState('');

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminCode === '1805') {
      setIsAdminAuthenticated(true);
    } else {
      alert('Code administrateur incorrect');
    }
  };

  const testPermissions = async () => {
    setLoading(true);
    setDiagStatus('idle');
    try {
      await getDocs(collection(db, 'races'));
      setDiagStatus('success');
    } catch (err) {
      setDiagStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const fullReset = async () => {
    if (resetConfirm !== 'RESET') {
      alert('Veuillez saisir "RESET" pour confirmer.');
      return;
    }
    if (!confirm('ATTENTION: Toutes les données seront supprimées. Continuer ?')) return;
    setLoading(true);
    try {
      const collections = ['passages', 'participants', 'races'];
      for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        const batch = writeBatch(db);
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      alert('Logiciel réinitialisé.');
      window.location.reload();
    } catch (err) {
      alert('Erreur lors de la réinitialisation.');
    } finally {
      setLoading(false);
    }
  };

  const generateMockData = async () => {
    setLoading(true);
    try {
      const raceRef = await addDoc(collection(db, 'races'), {
        name: "Course Test Démo",
        distance: 10,
        type: RaceType.GROUP,
        status: RaceStatus.RUNNING,
        startTime: Date.now() - 3600000, 
        checkpoints: [{ id: 'cp1', name: 'Minguen Sud', distance: 5, isMandatory: true }]
      });

      const batch = writeBatch(db);
      for (let i = 1; i <= 20; i++) {
        const pRef = doc(collection(db, 'participants'));
        batch.set(pRef, {
          bib: String(100 + i),
          firstName: `Prénom_${i}`,
          lastName: `NOM_${i}`,
          gender: i % 2 === 0 ? 'M' : 'F',
          category: 'SENIOR',
          raceId: raceRef.id,
          status: i < 5 ? ParticipantStatus.FINISHED : ParticipantStatus.STARTED
        });
        if (i < 5) {
          const passageRef = doc(collection(db, 'passages'));
          batch.set(passageRef, {
            participantId: pRef.id,
            bib: String(100 + i),
            checkpointId: 'finish',
            checkpointName: 'ARRIVÉE',
            timestamp: Date.now(),
            netTime: 3600000 + (i * 120000)
          });
        }
      }
      await batch.commit();
      alert('Données générées.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdminAuthenticated) {
    return (
      <div className="h-[calc(100vh-10rem)] flex items-center justify-center p-6">
        <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 w-full max-w-md text-center">
          <div className="w-24 h-24 bg-slate-900 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-white shadow-2xl">
            <Lock size={48} />
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-2">Accès Restreint</h2>
          <p className="text-slate-500 mb-10 font-medium">Zone réservée aux administrateurs</p>
          <form onSubmit={handleAdminLogin} className="space-y-6">
            <input 
              type="password" 
              placeholder="Code Admin"
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 text-center text-3xl font-black tracking-widest focus:border-slate-900 outline-none transition-all"
              value={adminCode}
              onChange={e => setAdminCode(e.target.value)}
              autoFocus
            />
            <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xl shadow-xl hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-3">
              DÉVERROUILLER <ShieldCheck size={24} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Administration</h1>
          <p className="text-slate-500">Maintenance et configurations avancées</p>
        </div>
        <button onClick={() => setIsAdminAuthenticated(false)} className="p-4 bg-slate-100 text-slate-500 rounded-2xl hover:text-red-500 transition-colors">
          <Lock size={20} />
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-red-50 space-y-6 shadow-sm">
          <h2 className="text-xl font-black text-red-600 flex items-center gap-2"><Trash2 size={22} /> Zone de Danger</h2>
          <div className="p-6 rounded-3xl bg-red-50 border border-red-100 space-y-4">
            <label className="block text-[10px] font-black text-red-400 uppercase tracking-widest mb-2">Confirmer la suppression (Tapez RESET)</label>
            <input type="text" placeholder="RESET" className="w-full bg-white border-2 border-red-100 rounded-2xl px-4 py-3 font-black text-red-600 text-center outline-none" value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} />
            <button disabled={loading || resetConfirm !== 'RESET'} onClick={fullReset} className="w-full py-4 rounded-2xl font-black bg-red-600 text-white hover:bg-red-700 disabled:opacity-30 flex items-center justify-center gap-2 shadow-xl shadow-red-200"><RefreshCcw size={18} className={loading ? 'animate-spin' : ''} /> RÉINITIALISATION COMPLÈTE</button>
          </div>
          <button disabled={loading} onClick={generateMockData} className="w-full text-left p-6 rounded-3xl bg-blue-50 border border-blue-100 group"><div className="flex items-center justify-between"><div><h3 className="font-black text-blue-600">Simulation</h3><p className="text-sm text-blue-400">Course test démo</p></div><Zap className="text-blue-300" /></div></button>
        </div>
        
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h2 className="text-xl font-black mb-6 flex items-center gap-2"><ShieldAlert size={20} className="text-amber-500" /> Diagnostic</h2>
            <button onClick={testPermissions} disabled={loading} className="w-full py-4 rounded-2xl font-bold bg-slate-900 text-white disabled:opacity-50 mb-4">Tester Firestore</button>
            {diagStatus === 'success' && <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center gap-3 font-bold"><CheckCircle2 size={18} /> Permissions Validées !</div>}
            {diagStatus === 'error' && <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 font-bold"><AlertCircle size={18} /> Échec d'accès</div>}
          </div>
          
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Settings size={20} className="text-slate-400" /> Préférences</h2>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase mb-2">Code Signaleur Actuel</label>
              <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-3xl text-blue-600 mono">22110</div>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-tighter">Code à fournir aux bénévoles sur le terrain</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminView;