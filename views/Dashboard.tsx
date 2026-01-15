import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Race, Participant, RaceStatus, Passage, ParticipantStatus } from '../types';
import { Trophy, Users, Activity, Flag, Edit3, Check, ChevronRight, MapPin, PlayCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';

const Dashboard: React.FC = () => {
  const [races, setRaces] = useState<Race[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [eventName, setEventName] = useState('Mon Événement');
  const [isEditingName, setIsEditingName] = useState(false);
  const { setDbError, isPermissionDenied } = useDatabase();

  const handleError = useCallback((err: any) => {
    console.error("Firestore Error in Dashboard:", err);
    setDbError(err.message || String(err));
  }, [setDbError]);

  useEffect(() => {
    const unsubRaces = onSnapshot(collection(db, 'races'), (snap) => {
      setRaces(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Race)));
    }, handleError);

    const unsubParticipants = onSnapshot(collection(db, 'participants'), (snap) => {
      setParticipants(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Participant)));
    }, handleError);

    const unsubPassages = onSnapshot(collection(db, 'passages'), (snap) => {
      setPassages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Passage)));
    }, handleError);

    const unsubSettings = onSnapshot(doc(db, 'settings', 'event'), (snap) => {
      if (snap.exists()) {
        setEventName(snap.data().name);
      }
    }, handleError);

    return () => {
      unsubRaces();
      unsubParticipants();
      unsubPassages();
      unsubSettings();
    };
  }, [handleError]);

  const saveEventName = async () => {
    try {
      await setDoc(doc(db, 'settings', 'event'), { name: eventName });
      setIsEditingName(false);
    } catch (err: any) {
      setDbError(err.message);
    }
  };

  // Calcul du flux des coureurs par course
  const raceFlows = useMemo(() => {
    return races.map(race => {
      const raceParticipants = participants.filter(p => p.raceId === race.id);
      const activeParts = raceParticipants.filter(p => p.status !== ParticipantStatus.DNF);
      
      // Trouver le dernier passage pour chaque participant
      const lastPassagesMap = new Map<string, string>(); // participantId -> checkpointId
      
      const racePassages = passages.filter(pas => 
        raceParticipants.some(rp => rp.id === pas.participantId)
      ).sort((a, b) => a.timestamp - b.timestamp);

      racePassages.forEach(pas => {
        lastPassagesMap.set(pas.participantId, pas.checkpointId);
      });

      // Comptage par étape
      const counts: Record<string, number> = {
        'start': 0, // Inscrits n'ayant encore passé aucun point
        'finish': 0,
        'dnf': raceParticipants.filter(p => p.status === ParticipantStatus.DNF).length
      };

      race.checkpoints.forEach(cp => counts[cp.id] = 0);

      activeParts.forEach(p => {
        const lastCpId = lastPassagesMap.get(p.id);
        if (!lastCpId) {
          counts['start']++;
        } else {
          counts[lastCpId] = (counts[lastCpId] || 0) + 1;
        }
      });

      return {
        ...race,
        counts,
        total: raceParticipants.length
      };
    });
  }, [races, participants, passages]);

  const stats = [
    { label: 'Épreuves', value: races.length, icon: Flag, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Live Now', value: races.filter(r => r.status === RaceStatus.RUNNING).length, icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Athlètes', value: participants.length, icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { label: 'Passages', value: passages.length, icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-50' },
  ];

  if (isPermissionDenied) return null;

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Header avec édition du nom */}
      <header className="flex flex-col gap-6">
        <div className="flex items-center gap-4 group">
          {isEditingName ? (
            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-xl border border-blue-100">
              <input 
                type="text" 
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="text-4xl font-black text-slate-900 outline-none bg-transparent px-4 py-2 w-full max-w-2xl"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && saveEventName()}
              />
              <button onClick={saveEventName} className="p-4 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition-all active:scale-90">
                <Check size={24} />
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase">{eventName}</h1>
              <button 
                onClick={() => setIsEditingName(true)}
                className="p-3 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
              >
                <Edit3 size={24} />
              </button>
            </>
          )}
        </div>

        {/* BANDEAU DE STATISTIQUES COMPACT */}
        <div className="flex flex-wrap gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="flex items-center gap-4 bg-white px-6 py-4 rounded-[1.5rem] border border-slate-100 shadow-sm">
              <div className={`${stat.bg} ${stat.color} p-2 rounded-xl`}>
                <stat.icon size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p>
                <p className="text-xl font-black text-slate-900">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      </header>

      {/* VISUALISATION DES FLUX DE COURSE */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
            <Activity size={18} className="text-blue-500" /> Flux de course en temps réel
          </h2>
          <div className="flex gap-4">
             <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
               <div className="w-2 h-2 rounded-full bg-slate-200"></div> En attente
             </div>
             <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
               <div className="w-2 h-2 rounded-full bg-blue-500"></div> En course
             </div>
             <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
               <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Arrivé
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {raceFlows.map(race => (
            <div key={race.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden group">
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${race.status === RaceStatus.RUNNING ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                  <h3 className="text-xl font-black text-slate-900 uppercase">{race.name}</h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Engagés</span>
                  <span className="text-xl font-black text-blue-600">{race.total}</span>
                </div>
              </div>

              {/* TIMELINE VISUELLE */}
              <div className="relative pt-12 pb-6 px-4">
                {/* Ligne de base */}
                <div className="absolute top-[60px] left-8 right-8 h-1 bg-slate-100 rounded-full -z-0"></div>
                
                <div className="flex justify-between items-start relative z-10">
                  {/* DÉPART */}
                  <div className="flex flex-col items-center group/step">
                    <div className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-tighter">Départ</div>
                    <div className={`w-8 h-8 rounded-full border-4 border-white shadow-lg flex items-center justify-center transition-all ${race.counts.start > 0 ? 'bg-slate-400' : 'bg-slate-100'}`}>
                      <PlayCircle size={14} className="text-white" />
                    </div>
                    <div className="mt-4 text-center">
                      <span className="block text-xl font-black text-slate-900 leading-none">{race.counts.start}</span>
                      <span className="text-[8px] font-black text-slate-400 uppercase">En attente</span>
                    </div>
                  </div>

                  {/* CHECKPOINTS DYNAMIQUES */}
                  {race.checkpoints.map((cp, idx) => (
                    <div key={cp.id} className="flex flex-col items-center group/step">
                      <div className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-tighter truncate max-w-[80px]">{cp.name}</div>
                      <div className={`w-8 h-8 rounded-full border-4 border-white shadow-lg flex items-center justify-center transition-all ${race.counts[cp.id] > 0 ? 'bg-blue-500 scale-125' : 'bg-slate-100'}`}>
                        <MapPin size={14} className="text-white" />
                      </div>
                      <div className="mt-4 text-center">
                        <span className={`block text-xl font-black leading-none ${race.counts[cp.id] > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
                          {race.counts[cp.id]}
                        </span>
                        <span className="text-[8px] font-black text-slate-400 uppercase">Ici</span>
                      </div>
                    </div>
                  ))}

                  {/* ARRIVÉE */}
                  <div className="flex flex-col items-center group/step">
                    <div className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-tighter">Arrivée</div>
                    <div className={`w-10 h-10 rounded-full border-4 border-white shadow-lg flex items-center justify-center transition-all ${race.counts.finish > 0 ? 'bg-emerald-500 scale-110 shadow-emerald-100' : 'bg-slate-100'}`}>
                      <Trophy size={18} className="text-white" />
                    </div>
                    <div className="mt-4 text-center">
                      <span className={`block text-2xl font-black leading-none ${race.counts.finish > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                        {race.counts.finish}
                      </span>
                      <span className="text-[8px] font-black text-slate-400 uppercase">Finis</span>
                    </div>
                  </div>
                </div>

                {/* Badge DNF / Abandons (Petit badge flottant) */}
                {race.counts.dnf > 0 && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-red-50 text-red-500 px-3 py-1.5 rounded-full flex items-center gap-2 border border-red-100 shadow-sm animate-in fade-in slide-in-from-right-4">
                      <AlertTriangle size={12} />
                      <span className="text-[10px] font-black uppercase tracking-tight">{race.counts.dnf} Abandon(s)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {races.length === 0 && (
            <div className="py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
               <Flag size={48} className="mx-auto text-slate-200 mb-4" />
               <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Aucune épreuve à visualiser</p>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
              <Users size={20} className="text-blue-500" />
              Répartition par course
            </h2>
          </div>
          <div className="space-y-4">
            {raceFlows.map(rf => (
              <div key={rf.id} className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                  <span>{rf.name}</span>
                  <span>{Math.round((rf.counts.finish / rf.total) * 100) || 0}% complété</span>
                </div>
                <div className="h-3 bg-slate-50 rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-1000" 
                    style={{ width: `${(rf.counts.finish / rf.total) * 100}%` }}
                  ></div>
                  <div 
                    className="h-full bg-blue-400 transition-all duration-1000" 
                    style={{ width: `${((rf.total - rf.counts.start - rf.counts.finish - rf.counts.dnf) / rf.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-950 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          
          <h2 className="text-xl font-black mb-8 flex items-center gap-3 relative z-10">
            <Activity size={20} className="text-emerald-400" />
            Live Feed
          </h2>
          <div className="space-y-4 relative z-10">
            {passages.sort((a,b) => b.timestamp - a.timestamp).slice(0, 5).map((p, idx) => (
              <div key={p.id} className="group flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-blue-500/30 transition-all duration-300">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-black text-sm border border-blue-500/20">
                    {p.bib}
                  </div>
                  <div>
                    <p className="font-black text-[11px] uppercase tracking-tight">{p.checkpointName}</p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase">{new Date(p.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-700 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;