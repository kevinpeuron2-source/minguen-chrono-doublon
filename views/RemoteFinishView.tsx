
import React, { useState, useEffect, useRef } from 'react';
// Added "where" to imports to fix the error on line 26
import { collection, onSnapshot, addDoc, updateDoc, doc, query, orderBy, limit, deleteDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Race, Participant, Passage, ParticipantStatus, RaceStatus } from '../types';
import { formatDuration } from '../utils/time';
import { Timer, History, Trash2, Undo2, AlertCircle, CheckCircle2, User } from 'lucide-react';

const RemoteFinishView: React.FC = () => {
  const [races, setRaces] = useState<Race[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [recentPassages, setRecentPassages] = useState<Passage[]>([]);
  const [bibInput, setBibInput] = useState('');
  const [activeRaceId, setActiveRaceId] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onSnapshot(collection(db, 'races'), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Race));
      setRaces(list);
      if (list.length > 0 && !activeRaceId) setActiveRaceId(list[0].id);
    });
    onSnapshot(collection(db, 'participants'), snap => {
      setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Participant)));
    });
    const q = query(collection(db, 'passages'), where('checkpointId', '==', 'finish'), orderBy('timestamp', 'desc'), limit(15));
    onSnapshot(q, snap => {
      setRecentPassages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Passage)));
    });
  }, [activeRaceId]);

  const activeRace = races.find(r => r.id === activeRaceId);

  const handleValidation = async () => {
    const part = participants.find(p => p.bib === bibInput);
    if (!part || !activeRace) return;

    const timestamp = Date.now();
    const netTime = timestamp - (part.startTime || activeRace.startTime || timestamp);

    await addDoc(collection(db, 'passages'), {
      participantId: part.id,
      bib: part.bib,
      checkpointId: 'finish',
      checkpointName: 'ARRIVÉE',
      timestamp,
      netTime
    });
    await updateDoc(doc(db, 'participants', part.id), { status: ParticipantStatus.FINISHED });
    setBibInput('');
    inputRef.current?.focus();
  };

  const deletePassage = async (passage: Passage) => {
    if (confirm("Supprimer ce passage et remettre le coureur en course ?")) {
      await deleteDoc(doc(db, 'passages', passage.id));
      await updateDoc(doc(db, 'participants', passage.participantId), { status: ParticipantStatus.STARTED });
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 font-sans">
      <header className="flex justify-between items-center mb-12">
        <div className="flex items-center gap-6">
          <div className="bg-blue-600 p-4 rounded-3xl shadow-xl">
            <Timer size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">TERMINAL D'ARRIVÉE</h1>
            <p className="text-slate-400 font-bold uppercase text-xs tracking-[0.2em]">Synchronisation Firebase Temps Réel</p>
          </div>
        </div>
        
        <div className="text-right">
           <p className="text-5xl font-black mono text-blue-400">
             {activeRace?.startTime ? formatDuration(Date.now() - activeRace.startTime).split('.')[0] : '--:--:--'}
           </p>
           <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">Chrono Officiel : {activeRace?.name}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-white rounded-[3.5rem] p-12 text-slate-900 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 -z-0"></div>
             
             <div className="relative z-10 space-y-8">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Saisie Rapide</span>
                  <select 
                    className="bg-slate-100 border-none rounded-xl px-4 py-2 font-bold text-sm"
                    value={activeRaceId}
                    onChange={e => setActiveRaceId(e.target.value)}
                  >
                    {races.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>

                <input 
                  ref={inputRef}
                  type="number"
                  className="w-full text-center text-[14rem] font-black mono py-10 rounded-[3rem] bg-slate-50 border-4 border-slate-100 focus:border-blue-600 outline-none transition-all"
                  value={bibInput}
                  onChange={e => setBibInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleValidation()}
                  placeholder="000"
                  autoFocus
                />

                <button 
                  onClick={handleValidation}
                  className="w-full bg-blue-600 text-white py-8 rounded-[2.5rem] font-black text-3xl shadow-2xl shadow-blue-200 active:scale-95 transition-all"
                >
                  VALIDER ARRIVÉE
                </button>
             </div>
           </div>
        </div>

        <div className="space-y-6">
           <div className="bg-slate-800 rounded-[2.5rem] p-8 border border-slate-700">
             <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-3">
               <History size={18} /> Historique récent
             </h3>
             <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-hide">
                {recentPassages.map(p => {
                  const runner = participants.find(part => part.id === p.participantId);
                  return (
                    <div key={p.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-700 flex items-center justify-between group">
                       <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-blue-600/10 text-blue-400 rounded-xl flex items-center justify-center font-black text-xl">
                           {p.bib}
                         </div>
                         <div>
                           <p className="font-black text-sm uppercase truncate w-32">{runner?.lastName}</p>
                           <p className="text-[10px] font-mono text-slate-500">{formatDuration(p.netTime)}</p>
                         </div>
                       </div>
                       <button 
                        onClick={() => deletePassage(p)}
                        className="p-3 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                       >
                         <Undo2 size={18} />
                       </button>
                    </div>
                  );
                })}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default RemoteFinishView;
