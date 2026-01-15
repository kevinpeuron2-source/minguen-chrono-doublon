import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Race, Participant, RaceStatus, ParticipantStatus, Passage } from '../types';
import { formatDuration } from '../utils/time';
import { Focus, Timer, CheckCircle2, ListFilter, AlertCircle, X, MapPin, AlertTriangle, Zap, Terminal } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';

const TimingView: React.FC = () => {
  const [races, setRaces] = useState<Race[]>([]);
  const [activeRaceId, setActiveRaceId] = useState<string>('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [allPassages, setAllPassages] = useState<Passage[]>([]);
  const [waitingPile, setWaitingPile] = useState<{timestamp: number, id: string}[]>([]);
  const [bibInput, setBibInput] = useState<string>('');
  const [dnfInput, setDnfInput] = useState<string>('');
  const [isFocusLocked, setIsFocusLocked] = useState<boolean>(true);
  const [lastValidation, setLastValidation] = useState<{bib: string, status: 'ok' | 'missing', name: string} | null>(null);
  const [, setTick] = useState(0);
  const { setDbError } = useDatabase();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 100);
    return () => clearInterval(interval);
  }, []);

  const handleError = useCallback((err: any) => {
    setDbError(err.message);
  }, [setDbError]);

  useEffect(() => {
    const unsubRaces = onSnapshot(collection(db, 'races'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Race));
      setRaces(list);
      if (!activeRaceId && list.length > 0) setActiveRaceId(list[0].id);
    }, handleError);

    const unsubParts = onSnapshot(collection(db, 'participants'), (snap) => {
      setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Participant)));
    }, handleError);

    const unsubPassages = onSnapshot(collection(db, 'passages'), (snap) => {
      setAllPassages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Passage)));
    }, handleError);

    return () => { unsubRaces(); unsubParts(); unsubPassages(); };
  }, [activeRaceId, handleError]);

  useEffect(() => {
    if (isFocusLocked) {
      const interval = setInterval(() => {
        if (document.activeElement !== inputRef.current && !document.querySelector('.modal')) {
          inputRef.current?.focus();
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isFocusLocked]);

  const checkMandatoryPoints = (participantId: string, raceId: string) => {
    const race = races.find(r => r.id === raceId);
    if (!race) return true;
    const mandatoryCps = race.checkpoints.filter(cp => cp.isMandatory);
    if (mandatoryCps.length === 0) return true;

    const participantPassages = allPassages.filter(pas => pas.participantId === participantId);
    const passedCpIds = new Set(participantPassages.map(p => p.checkpointId));

    return mandatoryCps.every(cp => passedCpIds.has(cp.id));
  };

  const processPassage = async (bib: string, isDNF: boolean = false) => {
    if (!bib) return;
    
    const participant = participants.find(p => p.bib === bib);
    if (!participant) {
      alert(`Dossard ${bib} inconnu !`);
      return;
    }

    const race = races.find(r => r.id === participant.raceId);
    if (!race || race.status !== RaceStatus.RUNNING) {
      alert(`La course ${race?.name || ''} n'est pas lancée !`);
      return;
    }

    if (isDNF) {
      await updateDoc(doc(db, 'participants', participant.id), { status: ParticipantStatus.DNF });
      setDnfInput('');
      return;
    }

    const hasAllPoints = checkMandatoryPoints(participant.id, race.id);

    let timestamp = Date.now();
    if (waitingPile.length > 0) {
      timestamp = waitingPile[0].timestamp;
      setWaitingPile(prev => prev.slice(1));
    }

    const netTime = timestamp - (participant.startTime || race.startTime || timestamp);

    await addDoc(collection(db, 'passages'), {
      participantId: participant.id,
      bib: participant.bib,
      checkpointId: 'finish',
      checkpointName: 'ARRIVÉE',
      timestamp,
      netTime
    });

    await updateDoc(doc(db, 'participants', participant.id), { status: ParticipantStatus.FINISHED });
    
    setLastValidation({
      bib: participant.bib,
      name: `${participant.lastName} ${participant.firstName}`,
      status: hasAllPoints ? 'ok' : 'missing'
    });

    setBibInput('');
    setTimeout(() => setLastValidation(null), 5000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const now = Date.now();
      setWaitingPile(prev => [...prev, { timestamp: now, id: crypto.randomUUID() }]);
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      processPassage(bibInput);
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide">
        {races.filter(r => r.status === RaceStatus.RUNNING).map(race => (
          <div key={race.id} className="flex-none bg-slate-950 p-6 rounded-[2rem] border-t-4 border-blue-500 shadow-2xl min-w-[240px]">
            <p className="text-[10px] font-black text-slate-500 uppercase truncate tracking-widest">{race.name}</p>
            <p className="text-3xl font-black text-white mono mt-1">
              {formatDuration(Date.now() - (race.startTime || 0)).split('.')[0]}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[4rem] p-12 border border-slate-100 shadow-[0_50px_100px_rgba(0,0,0,0.05)] relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full -mr-48 -mt-48 blur-3xl"></div>
        
        {lastValidation && (
          <div className={`absolute inset-x-0 top-0 p-6 text-center font-black animate-in slide-in-from-top-full duration-500 z-30 shadow-2xl ${
            lastValidation.status === 'ok' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white animate-pulse'
          }`}>
            <div className="flex items-center justify-center gap-4 text-xl">
              {lastValidation.status === 'ok' ? <CheckCircle2 size={32}/> : <AlertTriangle size={32}/>}
              DOSSARD {lastValidation.bib} : {lastValidation.status === 'ok' ? 'PARCOURS VALIDE' : 'CHECKPOINTS MANQUANTS !'}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-12">
          <div>
            <h2 className="text-4xl font-black text-slate-900 flex items-center gap-4">
              <Terminal className="text-blue-600" size={36} /> TERMINAL ARRIVÉE
            </h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.3em] mt-2">Saisie temps réel haute précision</p>
          </div>
          <button 
            onClick={() => setIsFocusLocked(!isFocusLocked)}
            className={`px-8 py-4 rounded-2xl font-black flex items-center gap-3 transition-all ${
              isFocusLocked ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-slate-100 text-slate-400'
            }`}
          >
            <Focus size={24} /> {isFocusLocked ? 'CAPTURE CLAVIER' : 'MODE LIBRE'}
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 bg-blue-600/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <input
            ref={inputRef}
            type="text"
            className="w-full text-center text-[16rem] font-black mono py-16 rounded-[4rem] bg-slate-50 border-4 border-slate-50 focus:border-blue-500/30 outline-none transition-all placeholder:text-slate-100 shadow-inner relative z-10"
            placeholder="000"
            value={bibInput}
            onChange={(e) => setBibInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          <button onClick={() => { const now = Date.now(); setWaitingPile(p => [...p, {timestamp: now, id: crypto.randomUUID()}])}} className="bg-amber-100/50 text-amber-700 py-10 rounded-[2.5rem] font-black text-3xl flex items-center justify-center gap-5 border-2 border-amber-200 shadow-lg shadow-amber-200/20 active:scale-95 transition-all">
            <Timer size={40} /> TOP CHRONO <span className="text-xs px-3 py-1 bg-amber-200 rounded-full">TAB</span>
          </button>
          <button onClick={() => processPassage(bibInput)} className="bg-blue-600 text-white py-10 rounded-[2.5rem] font-black text-3xl flex items-center justify-center gap-5 shadow-2xl shadow-blue-200 active:scale-95 transition-all">
            <CheckCircle2 size={40} /> VALIDER <span className="text-xs px-3 py-1 bg-white/20 rounded-full">ENTRÉE</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-slate-950 rounded-[3rem] p-10 border border-white/5 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <h3 className="text-xs font-black text-slate-500 uppercase mb-8 flex items-center gap-4 tracking-widest relative z-10">
            <ListFilter size={20} className="text-amber-500" /> Pile d'attente horodatée ({waitingPile.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 relative z-10">
            {waitingPile.map((item) => (
              <div key={item.id} className="bg-white/5 p-6 rounded-2xl border border-white/5 flex items-center justify-between hover:bg-white/10 transition-colors">
                <span className="font-black text-white mono text-xl">{new Date(item.timestamp).toLocaleTimeString()}</span>
                <button onClick={() => setWaitingPile(p => p.filter(x => x.id !== item.id))} className="p-2 text-slate-600 hover:text-red-500 transition-colors">
                  <X size={20} />
                </button>
              </div>
            ))}
            {waitingPile.length === 0 && (
              <div className="col-span-full py-10 text-center text-slate-700 font-black uppercase tracking-widest italic opacity-30">
                Aucun temps en file
              </div>
            )}
          </div>
        </div>

        <div className="bg-red-50/50 rounded-[3rem] p-10 border border-red-100 shadow-xl">
          <h3 className="text-xs font-black text-red-600 uppercase mb-8 flex items-center gap-4 tracking-widest">
            <AlertCircle size={20} /> Déclaration Abandon
          </h3>
          <div className="space-y-6">
            <div className="relative">
               <Zap className="absolute left-6 top-1/2 -translate-y-1/2 text-red-200" size={24} />
               <input 
                type="text" 
                placeholder="N° de dossard..."
                className="w-full bg-white border-2 border-red-50 rounded-2xl pl-16 pr-6 py-6 font-black text-2xl text-red-600 outline-none focus:border-red-500 shadow-sm"
                value={dnfInput}
                onChange={e => setDnfInput(e.target.value)}
              />
            </div>
            <button 
              onClick={() => processPassage(dnfInput, true)}
              className="w-full bg-red-600 text-white py-6 rounded-3xl font-black text-xl shadow-xl shadow-red-200 hover:bg-red-700 active:scale-95 transition-all uppercase tracking-widest"
            >
              Signaler DNF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimingView;