import React, { useState } from 'react';
import { collection, writeBatch, getDocs, addDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Settings, ShieldAlert, Zap, AlertCircle, CheckCircle2, Trash2, RefreshCcw, Lock, ShieldCheck, Users } from 'lucide-react';
import { RaceType, RaceStatus, ParticipantStatus, Race } from '../types';

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
    if (!confirm('ATTENTION: Toutes les données (passages, participants, courses) seront supprimées. Continuer ?')) return;
    setLoading(true);
    try {
      const collections = ['passages', 'participants', 'races', 'active_marshals'];
      for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        const batch = writeBatch(db);
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      alert('Logiciel réinitialisé à zéro.');
      window.location.reload();
    } catch (err) {
      alert('Erreur lors de la réinitialisation.');
    } finally {
      setLoading(false);
    }
  };

  const generateSimulationFromExisting = async () => {
    setLoading(true);
    try {
      // 1. Récupérer les participants existants
      const partsSnap = await getDocs(collection(db, 'participants'));
      if (partsSnap.empty) {
        alert("Aucun participant trouvé. Veuillez importer un fichier CSV ou ajouter des inscrits avant de lancer la simulation.");
        return;
      }

      // 2. Récupérer les courses pour vérifier leur état
      const racesSnap = await getDocs(collection(db, 'races'));
      const racesMap = new Map();
      racesSnap.forEach(d => racesMap.set(d.id, { id: d.id, ...d.data() } as Race));

      if (racesSnap.empty) {
        alert("Aucune épreuve configurée. La simulation a besoin de courses pour fonctionner.");
        return;
      }

      const batch = writeBatch(db);
      const now = Date.now();
      const startTimeSimulated = now - (3600000 * 1.5); // Départ simulé il y a 1h30

      // 3. Nettoyer les anciens passages pour éviter les doublons
      const oldPassages = await getDocs(collection(db, 'passages'));
      oldPassages.forEach(d => batch.delete(d.ref));

      // 4. Mettre à jour les courses non lancées
      racesSnap.forEach(raceDoc => {
        const race = raceDoc.data() as Race;
        if (race.status === RaceStatus.READY) {
          batch.update(raceDoc.ref, {
            status: RaceStatus.RUNNING,
            startTime: startTimeSimulated
          });
        }
      });

      // 5. Simuler les arrivées pour les participants
      let count = 0;
      partsSnap.forEach(pDoc => {
        const p = pDoc.data();
        const rand = Math.random();
        
        // On simule 85% d'arrivées, 10% DNF, 5% en course
        if (rand < 0.85) {
          // Cas : ARRIVÉ
          const randomNetTime = 2400000 + (Math.random() * 3600000); // Entre 40min et 1h40
          const passageRef = doc(collection(db, 'passages'));
          
          batch.set(passageRef, {
            participantId: pDoc.id,
            bib: p.bib,
            checkpointId: 'finish',
            checkpointName: 'ARRIVÉE',
            timestamp: startTimeSimulated + randomNetTime,
            netTime: randomNetTime
          });

          batch.update(pDoc.ref, { status: ParticipantStatus.FINISHED });
          count++;
        } else if (rand < 0.95) {
          // Cas : ABANDON
          batch.update(pDoc.ref, { status: ParticipantStatus.DNF });
        } else {
          // Cas : EN COURSE
          batch.update(pDoc.ref, { status: ParticipantStatus.STARTED });
        }
      });

      await batch.commit();
      alert(`Simulation réussie ! ${count} temps d'arrivée ont été générés sur la base de vos participants inscrits.`);
    } catch (err: any) {
      console.error(err);
      alert("Erreur lors de la simulation : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdminAuthenticated) {
    return (
      <div className="h-[calc(100vh-10rem)] flex items-center justify-center p-6 animate-in fade-in duration-500">
        <div className="bg-white p-12 rounded-[3.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.04)] border border-slate-100 w-full max-w-md text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16"></div>
          
          <div className="w-24 h-24 bg-slate-950 rounded-[2.2rem] flex items-center justify-center mx-auto mb-8 text-white shadow-2xl relative z-10">
            <Lock size={48} />
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tight">Accès Restreint</h2>
          <p className="text-slate-400 mb-10 font-bold uppercase text-[10px] tracking-widest">Zone de maintenance Minguen Chrono</p>
          
          <form onSubmit={handleAdminLogin} className="space-y-6 relative z-10">
            <input 
              type="password" 
              placeholder="CODE ACCÈS"
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 text-center text-4xl font-black tracking-[0.3em] focus:border-blue-500 focus:bg-white outline-none transition-all"
              value={adminCode}
              onChange={e => setAdminCode(e.target.value)}
              autoFocus
            />
            <button type="submit" className="w-full bg-slate-950 text-white py-6 rounded-2xl font-black text-xl shadow-xl hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-3">
              DÉVERROUILLER <ShieldCheck size={24} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight">Administration</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">Maintenance système et outils de test</p>
        </div>
        <button 
          onClick={() => setIsAdminAuthenticated(false)} 
          className="flex items-center gap-3 px-6 py-3 bg-slate-100 text-slate-500 font-black text-xs uppercase rounded-xl hover:bg-slate-200 transition-colors"
        >
          <Lock size={16} /> Verrouiller
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-8">
          <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-50 shadow-sm space-y-8">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-4">
              <Zap size={28} className="text-blue-600" />
              Outils de Test
            </h2>
            
            <button 
              disabled={loading} 
              onClick={generateSimulationFromExisting} 
              className="w-full text-left p-8 rounded-[2.5rem] bg-blue-50 border-2 border-blue-100 group hover:border-blue-300 transition-all active:scale-95"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-black text-blue-700 text-xl uppercase tracking-tight">Lancer Simulation</h3>
                  <p className="text-sm text-blue-500 font-medium">Génère des temps pour vos <span className="font-black">vrais inscrits</span></p>
                </div>
                <Users className="text-blue-300 group-hover:scale-110 transition-transform" size={32} />
              </div>
            </button>

            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
               <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                    <ShieldAlert size={20} />
                  </div>
                  <h3 className="font-black text-slate-900 uppercase text-sm">Diagnostic Connexion</h3>
               </div>
               <button 
                onClick={testPermissions} 
                disabled={loading} 
                className="w-full py-4 rounded-2xl font-black text-xs uppercase bg-white border-2 border-slate-200 text-slate-600 hover:border-slate-900 hover:text-slate-900 transition-all mb-4 shadow-sm"
              >
                Tester l'accès Firestore
              </button>
              {diagStatus === 'success' && (
                <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center gap-3 font-black text-xs uppercase animate-in zoom-in-95">
                  <CheckCircle2 size={16} /> Synchronisation OK
                </div>
              )}
              {diagStatus === 'error' && (
                <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 font-black text-xs uppercase animate-in zoom-in-95">
                  <AlertCircle size={16} /> Erreur de permissions
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-950 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 rounded-full -mr-24 -mt-24 blur-3xl"></div>
            <h2 className="text-2xl font-black mb-8 flex items-center gap-4 relative z-10">
              <Settings size={28} className="text-blue-500" /> 
              Préférences
            </h2>
            <div className="relative z-10">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Code Signaleur Terrain</label>
              <div className="bg-white/5 border border-white/10 rounded-[2rem] px-8 py-6 font-black text-5xl text-blue-400 mono tracking-tighter shadow-inner">
                22110
              </div>
              <p className="text-[10px] text-slate-600 mt-4 font-bold italic">
                Ce code permet aux bénévoles de se connecter à leurs postes sans accès admin complet.
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-10 rounded-[3rem] border-2 border-red-50 shadow-sm space-y-8 self-start">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-100">
              <Trash2 size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-red-600 uppercase tracking-tight">Zone Critique</h2>
              <p className="text-xs font-bold text-red-300 uppercase tracking-widest leading-none">Nettoyage de la base de données</p>
            </div>
          </div>

          <div className="p-8 rounded-[2.5rem] bg-red-50/50 border-2 border-red-100 space-y-6">
            <p className="text-xs font-bold text-red-800 leading-relaxed">
              La réinitialisation supprimera <span className="font-black">tous les coureurs, tous les temps et toutes les courses</span>. Cette action est irréversible.
            </p>
            
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-red-400 uppercase tracking-widest">Confirmation (Taper RESET)</label>
              <input 
                type="text" 
                placeholder="RESET" 
                className="w-full bg-white border-2 border-red-100 rounded-2xl px-6 py-4 font-black text-red-600 text-center text-xl outline-none focus:border-red-500 transition-all shadow-inner" 
                value={resetConfirm} 
                onChange={(e) => setResetConfirm(e.target.value)} 
              />
            </div>
            
            <button 
              disabled={loading || resetConfirm !== 'RESET'} 
              onClick={fullReset} 
              className="w-full py-6 rounded-2xl font-black bg-red-600 text-white hover:bg-red-700 disabled:opacity-20 flex items-center justify-center gap-3 shadow-2xl shadow-red-200 transition-all active:scale-95 text-lg uppercase tracking-tight"
            >
              <RefreshCcw size={24} className={loading ? 'animate-spin' : ''} />
              RAZ Logiciel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminView;