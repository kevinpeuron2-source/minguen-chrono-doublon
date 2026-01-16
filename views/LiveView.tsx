import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Race, Participant, Passage } from '../types';
import { formatDuration, getSpeed } from '../utils/time';
import { Trophy, Users, Timer, Activity, Star, Search, MapPin, CheckCircle2, Tv, Filter, User, X, FileSpreadsheet } from 'lucide-react';
import { exportToCSV } from '../utils/csv';

/**
 * Interface ResultData pour le typage strict des résultats.
 * Résout les erreurs TS7034 et TS7005 liées au type 'any[]' implicite.
 */
interface ResultData {
  id: string;
  bib: string;
  firstName: string;
  lastName: string;
  gender: string;
  category: string;
  club?: string;
  progress: number;
  isFinished: boolean;
  checkpointName: string;
  netTime: number;
  speed: number;
  evolution: number;
  rank?: number;
  lastPassage?: Passage;
  passages: Passage[];
}

const LiveView: React.FC = () => {
  const [races, setRaces] = useState<Race[]>([]);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [eventName, setEventName] = useState('Chargement...');
  const [selectedRaceId, setSelectedRaceId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedGender, setSelectedGender] = useState<'ALL' | 'M' | 'F'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isTVMode, setIsTVMode] = useState(false);
  const [tvIndex, setTvIndex] = useState(0);

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

  useEffect(() => {
    let interval: any;
    if (isTVMode) {
      interval = setInterval(() => {
        setTvIndex(prev => (prev + 1) % 5);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isTVMode]);

  const toggleFavorite = (bib: string) => {
    setFavorites(prev => prev.includes(bib) ? prev.filter(b => b !== bib) : [...prev, bib]);
  };

  const selectedRace = useMemo(() => races.find(r => r.id === selectedRaceId), [races, selectedRaceId]);

  /**
   * Calcul des classements live avec typage strict ResultData[].
   */
  const liveParticipants = useMemo<ResultData[]>(() => {
    if (!selectedRaceId || !selectedRace) return [];
    
    const mandatoryCps = selectedRace.checkpoints.filter(cp => cp.isMandatory);
    const mandatoryIds = new Set(mandatoryCps.map(cp => cp.id));
    mandatoryIds.add('finish');

    // Étape 1: Transformation et typage initial
    const results: ResultData[] = participants
      .filter(p => p.raceId === selectedRaceId)
      .map(p => {
        const pPassages = passages.filter(pas => pas.participantId === p.id)
          .sort((a, b) => a.timestamp - b.timestamp);
        
        const lastPassage = pPassages[pPassages.length - 1];
        const isFinished = pPassages.some(pas => pas.checkpointId === 'finish');
        
        const mandatoryPassages = pPassages.filter(pas => mandatoryIds.has(pas.checkpointId));
        const calculatedProgress = (mandatoryPassages.length / (mandatoryCps.length + 1)) * 100;

        return {
          id: p.id,
          bib: p.bib,
          firstName: p.firstName,
          lastName: p.lastName,
          gender: p.gender,
          category: p.category,
          club: p.club,
          progress: isFinished ? 100 : calculatedProgress,
          isFinished,
          checkpointName: lastPassage?.checkpointName || 'Départ',
          netTime: lastPassage?.netTime || 0,
          speed: parseFloat(getSpeed(selectedRace.distance, lastPassage?.netTime || 0)),
          evolution: 0, // Sera calculé après le premier tri si nécessaire
          lastPassage,
          passages: pPassages
        };
      });

    // Étape 2: Tri par performance (points obligatoires passés, puis temps au dernier point)
    const sortedResults = [...results].sort((a, b) => {
      const aMandatoryCount = a.passages.filter(pas => mandatoryIds.has(pas.checkpointId)).length;
      const bMandatoryCount = b.passages.filter(pas => mandatoryIds.has(pas.checkpointId)).length;
      
      if (aMandatoryCount !== bMandatoryCount) {
        return bMandatoryCount - aMandatoryCount;
      }
      
      const aLastTime = a.passages.slice().reverse().find(pas => mandatoryIds.has(pas.checkpointId))?.timestamp || 0;
      const bLastTime = b.passages.slice().reverse().find(pas => mandatoryIds.has(pas.checkpointId))?.timestamp || 0;
      
      return aLastTime - bLastTime;
    });

    // Étape 3: Attribution des rangs et évolution simulée
    return sortedResults.map((p, index) => ({
      ...p,
      rank: index + 1,
      evolution: Math.floor(Math.random() * 3) - 1 // Exemple pour démo
    }));
  }, [participants, passages, selectedRaceId, selectedRace]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(participants.filter(p => p.raceId === selectedRaceId).map(p => p.category)));
    return cats.sort();
  }, [participants, selectedRaceId]);

  const filteredParticipants = useMemo<ResultData[]>(() => {
    return liveParticipants.filter(p => {
      const matchesSearch = p.bib.includes(searchTerm) || 
                            p.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            p.firstName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGender = selectedGender === 'ALL' || p.gender === selectedGender;
      const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      return matchesSearch && matchesGender && matchesCategory;
    });
  }, [liveParticipants, searchTerm, selectedGender, selectedCategory]);

  /**
   * Export CSV "aplatis" et optimisé pour Excel.
   */
  const handleExportCSV = () => {
    if (!filteredParticipants.length || !selectedRace) return;

    const dataPourExport = filteredParticipants.map((p, index) => ({
      "Position": index + 1,
      "Dossard": `="${p.bib}"`, // Protection des zéros devant (ex: 007)
      "Nom": p.lastName.toUpperCase(),
      "Prénom": p.firstName,
      "Sexe": p.gender,
      "Catégorie": p.category,
      "Club": p.club || 'Individuel',
      "Dernier Point": p.checkpointName,
      "Temps": p.netTime > 0 ? formatDuration(p.netTime) : '--:--:--.--', // Format HH:mm:ss.SS
      "Vitesse (km/h)": p.speed.toFixed(2),
      "Progression (%)": Math.round(p.progress) + '%'
    }));

    const fileName = `Export_Live_${selectedRace.name.replace(/\s+/g, '_')}.csv`;
    exportToCSV(fileName, dataPourExport);
  };

  const favParticipants = liveParticipants.filter(p => favorites.includes(p.bib));

  const lastFinishers = useMemo(() => {
    return liveParticipants
      .filter(p => p.isFinished)
      .sort((a, b) => (b.lastPassage?.timestamp || 0) - (a.lastPassage?.timestamp || 0))
      .slice(0, 5);
  }, [liveParticipants]);

  if (isTVMode) {
    const currentFinisher = lastFinishers[tvIndex % (lastFinishers.length || 1)];
    return (
      <div className="fixed inset-0 bg-[#020617] z-[100] flex flex-col p-10 animate-in fade-in duration-700">
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-6">
            <div className="bg-white p-3 rounded-2xl">
              <img src="/logo.png" alt="Logo" className="h-14" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white uppercase tracking-tighter">{eventName}</h1>
              <div className="flex items-center gap-3">
                <p className="text-blue-500 font-black tracking-widest text-sm uppercase">Direct Arrivées • {selectedRace?.name}</p>
                <span className="text-slate-600 text-xs font-black uppercase">by K. PEURON</span>
              </div>
            </div>
          </div>
          <button onClick={() => setIsTVMode(false)} className="p-6 bg-white/5 text-white/40 hover:text-white rounded-full transition-all">
            <X size={48} />
          </button>
        </div>

        <div className="flex-1 flex flex-col justify-center items-center">
          {currentFinisher ? (
            <div key={currentFinisher.id} className="w-full max-w-6xl space-y-12 animate-in zoom-in-95 slide-in-from-bottom-10 duration-1000">
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="bg-blue-600 text-white px-10 py-4 rounded-full font-black text-2xl uppercase tracking-widest shadow-2xl shadow-blue-500/20">
                  Vient d'arriver !
                </div>
                <h2 className="text-[12rem] font-black text-white leading-none tracking-tighter uppercase truncate w-full">
                  {currentFinisher.lastName}
                </h2>
                <h3 className="text-6xl font-bold text-slate-400 uppercase tracking-tight">
                  {currentFinisher.firstName}
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-10">
                <div className="bg-white/5 p-12 rounded-[4rem] border border-white/10 text-center">
                  <p className="text-slate-500 font-black text-xl uppercase mb-2">Dossard</p>
                  <p className="text-8xl font-black text-blue-500 mono">{currentFinisher.bib}</p>
                </div>
                <div className="bg-white/5 p-12 rounded-[4rem] border border-white/10 text-center">
                  <p className="text-slate-500 font-black text-xl uppercase mb-2">Temps Officiel</p>
                  <p className="text-6xl font-black text-white mono">
                    {formatDuration(currentFinisher.lastPassage?.netTime || 0).split('.')[0]}
                  </p>
                </div>
                <div className="bg-white/5 p-12 rounded-[4rem] border border-white/10 text-center">
                  <p className="text-slate-500 font-black text-xl uppercase mb-2">Catégorie</p>
                  <p className="text-8xl font-black text-emerald-500">{currentFinisher.category}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-6">
              <Tv size={120} className="text-slate-800 mx-auto" />
              <p className="text-4xl font-black text-slate-700 uppercase tracking-widest">En attente des premières arrivées...</p>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-4 mt-10">
          {lastFinishers.map((_, i) => (
            <div key={i} className={`h-3 rounded-full transition-all duration-500 ${i === tvIndex ? 'w-12 bg-blue-600' : 'w-3 bg-white/10'}`} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans pb-20">
      <header className="bg-[#1e293b] border-b border-slate-800 p-6 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="bg-white p-1.5 rounded-xl shadow-lg shrink-0">
                <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-black text-blue-400 tracking-tighter leading-none truncate uppercase">{eventName}</h1>
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">by K. PEURON • MINGUEN CHRONO</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={handleExportCSV}
                className="p-3 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-xl transition-all flex items-center gap-2 font-black text-[10px] uppercase border border-emerald-500/20"
              >
                <FileSpreadsheet size={16} /> Export
              </button>
              <button 
                onClick={() => setIsTVMode(true)}
                className="p-3 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all flex items-center gap-2 font-black text-[10px] uppercase border border-blue-500/20"
              >
                <Tv size={16} /> Mode TV
              </button>
              <select 
                className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-300 outline-none focus:border-blue-500"
                value={selectedRaceId}
                onChange={e => setSelectedRaceId(e.target.value)}
              >
                {races.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="text" 
                placeholder="Dossard ou nom..."
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-slate-200 font-medium placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 w-full md:w-auto">
                <button 
                  onClick={() => setSelectedGender('ALL')}
                  className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${selectedGender === 'ALL' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Tous
                </button>
                <button 
                  onClick={() => setSelectedGender('M')}
                  className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${selectedGender === 'M' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <User size={12} /> H
                </button>
                <button 
                  onClick={() => setSelectedGender('F')}
                  className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${selectedGender === 'F' ? 'bg-pink-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <User size={12} /> F
                </button>
              </div>

              <div className="relative w-full md:flex-1">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                <select 
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-[10px] font-black uppercase text-slate-400 outline-none appearance-none cursor-pointer focus:border-blue-500"
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                >
                  <option value="ALL">Toutes les catégories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
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
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Trophy size={16} className="text-blue-400" /> 
              {selectedGender !== 'ALL' || selectedCategory !== 'ALL' ? 'Résultats Filtrés' : 'Classement Live'}
            </h2>
            <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
              {filteredParticipants.length} Concurrents
            </div>
          </div>
          
          <div className="space-y-3">
            {filteredParticipants.length > 0 ? (
              filteredParticipants.map((p) => (
                <RunnerCard 
                  key={p.id} 
                  runner={p} 
                  race={selectedRace} 
                  onToggleFav={toggleFavorite} 
                  isFav={favorites.includes(p.bib)}
                  rank={p.rank}
                />
              ))
            ) : (
              <div className="py-20 text-center bg-slate-800/20 rounded-[2.5rem] border border-dashed border-slate-800">
                <Search size={48} className="mx-auto text-slate-700 mb-4" />
                <p className="font-bold text-slate-500">Aucun coureur ne correspond aux filtres</p>
                <button 
                  onClick={() => { setSelectedGender('ALL'); setSelectedCategory('ALL'); setSearchTerm(''); }}
                  className="mt-4 text-blue-500 font-black text-[10px] uppercase hover:underline"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const RunnerCard: React.FC<{ 
  runner: ResultData, 
  race?: Race, 
  onToggleFav: (bib: string) => void, 
  isFav: boolean, 
  rank?: number 
}> = ({ runner, race, onToggleFav, isFav, rank }) => {
  
  const segments = useMemo(() => {
    if (!race) return [];
    const numSegments = race.checkpoints.length + 1;
    return race.segments || Array(numSegments).fill("Course");
  }, [race]);

  const currentSegmentIndex = useMemo(() => {
    if (runner.isFinished) return -1;
    if (!runner.lastPassage) return 0;
    
    const lastCpId = runner.lastPassage.checkpointId;
    const cpIndex = race?.checkpoints.findIndex(c => c.id === lastCpId);
    
    return cpIndex !== undefined && cpIndex !== -1 ? cpIndex + 1 : 0;
  }, [runner, race]);

  const completedSegmentsData = useMemo(() => {
    if (!race || !runner.passages) return [];
    const runnerPassages = [...runner.passages].sort((a, b) => a.timestamp - b.timestamp);
    const results = [];
    let previousTime = 0;
    
    const points = [...race.checkpoints.map(cp => cp.id), 'finish'];
    
    points.forEach((pointId, idx) => {
      const passage = runnerPassages.find((p) => p.checkpointId === pointId);
      const segmentName = segments[idx] || "Course";
      
      if (passage) {
        const duration = passage.netTime - previousTime;
        results.push({ name: segmentName, duration });
        previousTime = passage.netTime;
      }
    });

    return results;
  }, [runner, race, segments]);

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
            {runner.club || 'Individuel'} • {runner.category} • {runner.gender}
          </p>
        </div>

        <div className="text-right">
          <p className="text-base font-black text-blue-400 mono">
            {runner.lastPassage ? formatDuration(runner.lastPassage.netTime).split('.')[0] : '--:--:--'}
          </p>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
            {runner.isFinished ? 'ARRIVÉ' : 'EN COURSE'}
          </p>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-slate-800/50">
        <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase mb-1">
          <div className="flex items-center gap-2">
             <span>Progression</span>
             {currentSegmentIndex !== -1 && (
               <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full lowercase italic">
                 en cours : {segments[currentSegmentIndex]}
               </span>
             )}
          </div>
          <span className="text-blue-400">{Math.round(runner.progress)}%</span>
        </div>
        
        <div className="relative h-4 bg-slate-900 rounded-full flex items-center overflow-hidden">
          <div className="absolute inset-0 flex">
            {segments.map((s: string, idx: number) => {
              const width = 100 / segments.length;
              const isCurrent = idx === currentSegmentIndex;
              const isPast = runner.isFinished || (currentSegmentIndex !== -1 && idx < currentSegmentIndex);
              
              return (
                <div 
                  key={idx}
                  className={`h-full border-r border-slate-950/20 flex items-center justify-center transition-all ${
                    isPast ? 'bg-blue-600/20' : isCurrent ? 'bg-blue-500/10 animate-pulse' : 'bg-transparent'
                  }`}
                  style={{ width: `${width}%` }}
                >
                  <span className={`text-[6px] font-black uppercase tracking-tighter hidden md:block ${isPast || isCurrent ? 'text-blue-400/40' : 'text-slate-800'}`}>
                    {s}
                  </span>
                </div>
              );
            })}
          </div>

          <div 
            className={`h-full rounded-full transition-all duration-1000 relative z-10 ${runner.isFinished ? 'bg-emerald-500' : 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)]'}`}
            style={{ width: `${runner.progress}%` }}
          />

          <div className="absolute inset-0 flex justify-between px-0.5 z-20 pointer-events-none">
            <div className="w-1 h-1 bg-white/20 rounded-full my-auto"></div>
            {race?.checkpoints.map(cp => {
              const pos = (cp.distance / (race.distance || 1)) * 100;
              const isPassed = runner.passages?.some((pas) => pas.checkpointId === cp.id);
              return (
                <div 
                  key={cp.id}
                  className={`w-1.5 h-1.5 rounded-full my-auto transition-colors border-2 border-slate-900 ${isPassed ? 'bg-white' : 'bg-slate-700'} ${!cp.isMandatory ? 'opacity-30' : ''}`}
                  style={{ position: 'absolute', left: `${pos}%` }}
                />
              );
            })}
            <div className={`w-2 h-2 rounded-full my-auto border-2 border-slate-900 ${runner.isFinished ? 'bg-white' : 'bg-slate-700'}`}></div>
          </div>
        </div>

        {completedSegmentsData.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {completedSegmentsData.map((seg, sIdx) => (
              <div key={sIdx} className="bg-slate-900/40 p-2 rounded-xl border border-slate-800/40 flex flex-col items-center">
                <span className="text-[7px] font-black text-slate-500 uppercase mb-0.5">{seg.name}</span>
                <span className="text-[10px] font-black text-blue-400 mono">{formatDuration(seg.duration).split('.')[0]}</span>
              </div>
            ))}
          </div>
        )}

        {runner.lastPassage && (
          <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-xl border border-slate-800/50">
            <MapPin size={10} className="text-blue-400" />
            <span className="text-[9px] font-black text-slate-400 uppercase">
              Dernier passage : <span className="text-slate-200">{runner.lastPassage.checkpointName}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveView;