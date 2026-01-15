
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Race, Participant, RaceStatus, ParticipantStatus, Passage } from '../types';
import { formatDuration } from '../utils/time';
// Added AlertTriangle to imports to fix line 159 error
import { Focus, Timer, CheckCircle2, ListFilter, AlertCircle, X, MapPin, AlertTriangle } from 'lucide-react';
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

    // Vérification des points manqués avant validation
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
    <div className="space-y-6 pb-20">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {races.filter(r => r.status === RaceStatus.RUNNING).map(race => (
          <div key={race.id} className="bg-slate-900 p-4 rounded-2xl border-l-4 border-blue-500 shadow-xl">
            <p className="text-[10px] font-black text-slate-500 uppercase truncate">{race.name}</p>
            <p className="text-xl font-black text-white mono">
              {formatDuration(Date.now() - (race.startTime || 0)).split('.')[0]}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[3rem] p-10 border-4 border-blue-600 shadow-2xl relative overflow-hidden">
        {/* Alerte Visuelle dernier passage */}
        {lastValidation && (
          <div className={`absolute inset-x-0 top-0 p-4 text-center font-black animate-in slide-in-from-top-full duration-300 ${
            lastValidation.status === 'ok' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white animate-pulse'
          }`}>
            <div className="flex items-center justify-center gap-3">
              {lastValidation.status === 'ok' ? <CheckCircle2 size={24}/> : <AlertTriangle size={24}/>}
              DOSSARD {lastValidation.bib} ({lastValidation.name}) : {lastValidation.status === 'ok' ? 'PARCOURS COMPLET' : 'CHECKPOINTS MANQUANTS !'}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-10 pt-8">
          <div>
            <h2 className="text-3xl font-black text-blue-600">LIGNE D'ARRIVÉE</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Saisie dossard & validation temps réel</p>
          </div>
          <button 
            onClick={() => setIsFocusLocked(!isFocusLocked)}
            className={`px-6 py-3 rounded-2xl font-black flex items-center gap-2 transition-all ${
              isFocusLocked ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-slate-100 text-slate-400'
            }`}
          >
            <Focus size={20} /> {isFocusLocked ? 'CLAVIER CAPTIF' : 'CLAVIER LIBRE'}
          </button>
        </div>

        <input
          ref={inputRef}
          type="text"
          className="w-full text-center text-[12rem] font-black mono py-12 rounded-[2.5rem] bg-slate-50 border-4 border-slate-100 focus:border-blue-500 outline-none transition-all placeholder:text-slate-100"
          placeholder="000"
          value={bibInput}
          onChange={(e) => setBibInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <button onClick={() => { const now = Date.now(); setWaitingPile(p => [...p, {timestamp: now, id: crypto.randomUUID()}])}} className="bg-amber-100 text-amber-700 py-8 rounded-[2rem] font-black text-2xl flex items-center justify-center gap-4 border-b-8 border-amber-200 active:border-b-0 active:translate-y-2 transition-all">
            <Timer size={32} /> TOP CHRONO (TAB)
          </button>
          <button onClick={() => processPassage(bibInput)} className="bg-blue-600 text-white py-8 rounded-[2rem] font-black text-2xl flex items-center justify-center gap-4 border-b-8 border-blue-800 active:border-b-0 active:translate-y-2 transition-all shadow-xl shadow-blue-100">
            <CheckCircle2 size={32} /> VALIDER (ENTRÉE)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-amber-50 rounded-[2.5rem] p-8 border-2 border-amber-100 shadow-sm">
          <h3 className="text-sm font-black text-amber-600 uppercase mb-6 flex items-center gap-3">
            <ListFilter size={20} /> File d'attente des temps ({waitingPile.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {waitingPile.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border-2 border-amber-200 flex items-center justify-between animate-in zoom-in-95">
                <span className="font-black text-amber-700 mono text-lg">{new Date(item.timestamp).toLocaleTimeString()}</span>
                <button onClick={() => setWaitingPile(p => p.filter(x => x.id !== item.id))} className="p-2 text-red-300 hover:text-red-500 transition-colors">
                  <X size={20} />
                </button>
              </div>
            ))}
            {waitingPile.length === 0 && (
              <div className="col-span-full py-6 text-center text-amber-300 font-bold italic">Aucun temps en attente</div>
            )}
          </div>
        </div>

        <div className="bg-red-50 rounded-[2.5rem] p-8 border-2 border-red-100 shadow-sm">
          <h3 className="text-sm font-black text-red-600 uppercase mb-6 flex items-center gap-3">
            <AlertCircle size={20} /> Signalement Abandons
          </h3>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="N° de dossard..."
              className="w-full bg-white border-2 border-red-100 rounded-2xl px-6 py-4 font-black text-lg outline-none focus:border-red-500"
              value={dnfInput}
              onChange={e => setDnfInput(e.target.value)}
            />
            <button 
              onClick={() => processPassage(dnfInput, true)}
              className="w-full bg-red-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-red-100 hover:bg-red-700 transition-all"
            >
              DÉCLARER DNF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimingView;
