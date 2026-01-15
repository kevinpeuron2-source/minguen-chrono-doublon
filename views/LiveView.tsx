import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Race, Participant, Passage, ParticipantStatus } from '../types';
import { formatDuration } from '../utils/time';
import { Trophy, Users, Timer, Activity, Star, Search, MapPin, CheckCircle2, ChevronRight, Info } from 'lucide-react';

const LiveView: React.FC = () => {
  const [races, setRaces] = useState<Race[]>([]);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [eventName, setEventName] = useState('Chargement...');
  const [selectedRaceId, setSelectedRaceId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('minguen_favs');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const unsubRaces = onSnapshot(collection(db, 'races'), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Race));
      setRaces(list);
      if (list.length > 0 && !selectedRaceId) setSelectedRaceId(list[0].id);
    });
    const unsubParts = onSnapshot(collection(db, 'participants'), snap => {
      setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Participant)));
    });
    const qPassages = query(collection(db, 'passages'), orderBy('timestamp', 'desc'));
    const unsubPassages = onSnapshot(qPassages, snap => {
      setPassages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Passage)));
    });
    const unsubSettings = onSnapshot(doc(db, 'settings', 'event'), (snap) => {
      if (snap.exists()) {
        setEventName(snap.data().name);
      } else {
        setEventName('Minguen Live');
      }
    });

    return () => {
      unsubRaces();
      unsubParts();
      unsubPassages();
      unsubSettings();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('minguen_favs', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (bib: string) => {
    setFavorites(prev => prev.includes(bib) ? prev.filter(b => b !== bib) : [...prev, bib]);
  };

  const selectedRace = useMemo(() => races.find(r => r.id === selectedRaceId), [races, selectedRaceId]);

  const liveParticipants = useMemo(() => {
    if (!selectedRaceId || !selectedRace) return [];
    
    const mandatoryCps = selectedRace.checkpoints.filter(cp => cp.isMandatory);
    const mandatoryIds = new Set(mandatoryCps.map(cp => cp.id));
    mandatoryIds.add('finish');

    return participants
      .filter(p => p.raceId === selectedRaceId)
      .map(p => {
        const pPassages = passages.filter(pas => pas.participantId === p.id)
          .sort((a, b) => a.timestamp - b.timestamp);
        
        // Tous les passages pour l'affichage des points sur la barre
        const lastPassage = pPassages[pPassages.length - 1];
        const isFinished = pPassages.some(pas => pas.checkpointId === 'finish');
        
        // Passages obligatoires uniquement pour le CLASSEMENT
        const mandatoryPassages = pPassages.filter(pas => mandatoryIds.has(pas.checkpointId));
        const lastMandatoryPassage = mandatoryPassages[mandatoryPassages.length - 1];

        return {
          ...p,
          passages: pPassages,
          mandatoryPassages,
          lastPassage,
          lastMandatoryPassage,
          isFinished,
          // La progression est calculée sur les points obligatoires + arrivée
          progress: (mandatoryPassages.length / (mandatoryCps.length + 1)) * 100
        };
      })
      .sort((a, b) => {
        // 1. Priorité à ceux qui ont passé le plus de points OBLIGATOIRES
        if (a.mandatoryPassages.length !== b.mandatoryPassages.length) {
          return b.mandatoryPassages.length - a.mandatoryPassages.length;
        }
        // 2. À nombre égal de points obligatoires, le plus rapide au DERNIER POINT OBLIGATOIRE
        if (a.lastMandatoryPassage && b.lastMandatoryPassage) {
          return a.lastMandatoryPassage.timestamp - b.lastMandatoryPassage.timestamp;
        }
        return 0;
      });
  }, [participants, passages, selectedRaceId, selectedRace]);

  const filteredParticipants = liveParticipants.filter(p => 
    p.bib.includes(searchTerm) || 
    p.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.firstName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const favParticipants = liveParticipants.filter(p => favorites.includes(p.bib));

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans pb-20">
      <header className="bg-[#1e293b] border-b border-slate-800 p-6 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="bg-white p-1.5 rounded-xl shadow-lg shrink-0">
                <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-black text-blue-400 tracking-tighter leading-none truncate uppercase">{eventName}</h1>
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">by K. PEURON • MINGUEN CHRONO</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live National</span>
                </div>
              </div>
            </div>
            <select 
              className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-300 outline-none focus:border-blue-500"
              value={selectedRaceId}
              onChange={e => setSelectedRaceId(e.target.value)}
            >
              {races.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher un dossard ou un nom..."
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-slate-200 font-medium placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        {selectedRace && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/40 p-5 rounded-3xl border border-slate-800">
              <Timer className="text-blue-400 mb-2" size={20} />
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Temps Course</p>
              <p className="text-xl font-black text-white mono">
                {selectedRace.startTime ? formatDuration(Date.now() - selectedRace.startTime).split('.')[0] : '--:--:--'}
              </p>
            </div>
            <div className="bg-slate-800/40 p-5 rounded-3xl border border-slate-800">
              <Users className="text-emerald-400 mb-2" size={20} />
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Engagés</p>
              <p className="text-xl font-black text-white">{liveParticipants.length}</p>
            </div>
            <div className="bg-slate-800/40 p-5 rounded-3xl border border-slate-800">
              <CheckCircle2 className="text-amber-400 mb-2" size={20} />
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Arrivés</p>
              <p className="text-xl font-black text-white">{liveParticipants.filter(p => p.isFinished).length}</p>
            </div>
            <div className="bg-slate-800/40 p-5 rounded-3xl border border-slate-800">
              <Activity className="text-purple-400 mb-2" size={20} />
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">En Course</p>
              <p className="text-xl font-black text-white">{liveParticipants.filter(p => !p.isFinished && p.lastPassage).length}</p>
            </div>
          </div>
        )}

        {favParticipants.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Star size={16} className="text-amber-400 fill-amber-400" /> Mes Coureurs Suivis
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {favParticipants.map(p => (
                <RunnerCard key={p.id} runner={p} race={selectedRace} onToggleFav={toggleFavorite} isFav={true} />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
            <Trophy size={16} className="text-blue-400" /> Classement Live
          </h2>
          <div className="space-y-3">
            {filteredParticipants.length > 0 ? (
              filteredParticipants.map((p, i) => (
                <RunnerCard 
                  key={p.id} 
                  runner={p} 
                  race={selectedRace} 
                  onToggleFav={toggleFavorite} 
                  isFav={favorites.includes(p.bib)}
                  rank={i + 1}
                />
              ))
            ) : (
              <div className="py-20 text-center bg-slate-800/20 rounded-[2.5rem] border border-dashed border-slate-800">
                <Search size={48} className="mx-auto text-slate-700 mb-4" />
                <p className="font-bold text-slate-500">Aucun coureur trouvé</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

// Fixed RunnerCard to use React.FC to properly handle the key prop in TypeScript
const RunnerCard: React.FC<{ 
  runner: any, 
  race?: Race, 
  onToggleFav: (bib: string) => void, 
  isFav: boolean, 
  rank?: number 
}> = ({ runner, race, onToggleFav, isFav, rank }) => {
  return (
    <div className="bg-[#1e293b] rounded-[2rem] p-5 border border-slate-800 hover:border-blue-500/30 transition-all shadow-xl">
      <div className="flex items-center gap-4 mb-4">
        <div className="relative">
          <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black ${
            runner.isFinished ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-400'
          }`}>
            <span className="text-[10px] leading-none mb-1 opacity-50">N°</span>
            <span className="text-xl leading-none">{runner.bib}</span>
          </div>
          {rank && (
            <div className="absolute -top-2 -left-2 w-6 h-6 bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-400">
              {rank}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-black uppercase text-slate-100 truncate">{runner.lastName} {runner.firstName}</h3>
            <button onClick={() => onToggleFav(runner.bib)} className="shrink-0 transition-transform active:scale-125">
              <Star size={18} className={isFav ? 'text-amber-400 fill-amber-400' : 'text-slate-600'} />
            </button>
          </div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter truncate">
            {runner.club || 'Individuel'} • {runner.category}
          </p>
        </div>

        <div className="text-right">
          <p className="text-lg font-black text-blue-400 mono">
            {runner.lastPassage ? formatDuration(runner.lastPassage.netTime).split('.')[0] : '--:--:--'}
          </p>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
            {runner.isFinished ? 'ARRIVÉ' : 'EN COURSE'}
          </p>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t border-slate-800/50">
        <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase mb-1">
          <span>Progression</span>
          <span className="text-blue-400">{Math.round(runner.progress)}%</span>
        </div>
        
        <div className="relative h-2 bg-slate-900 rounded-full flex items-center">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${runner.isFinished ? 'bg-emerald-500' : 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)]'}`}
            style={{ width: `${runner.progress}%` }}
          />
          <div className="absolute inset-0 flex justify-between px-0.5">
            <div className="w-1 h-1 bg-white/20 rounded-full my-auto"></div>
            {race?.checkpoints.map(cp => {
              const pos = (cp.distance / race.distance) * 100;
              const isPassed = runner.passages.some((pas: any) => pas.checkpointId === cp.id);
              return (
                <div 
                  key={cp.id}
                  className={`w-1 h-1 rounded-full my-auto transition-colors ${isPassed ? 'bg-white' : 'bg-slate-700'} ${!cp.isMandatory ? 'opacity-30' : ''}`}
                  style={{ position: 'absolute', left: `${pos}%` }}
                />
              );
            })}
            <div className={`w-1.5 h-1.5 rounded-full my-auto ${runner.isFinished ? 'bg-white' : 'bg-slate-700'}`}></div>
          </div>
        </div>

        {runner.lastPassage && (
          <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-xl border border-slate-800/50">
            <MapPin size={10} className="text-blue-400" />
            <span className="text-[9px] font-black text-slate-400 uppercase">
              Dernier passage : <span className="text-slate-200">{runner.lastPassage.checkpointName}</span>
              {!race?.checkpoints.find(c => c.id === runner.lastPassage.checkpointId)?.isMandatory && runner.lastPassage.checkpointId !== 'finish' && (
                <span className="ml-2 text-slate-600">(Optionnel - Pas de rang)</span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveView;
