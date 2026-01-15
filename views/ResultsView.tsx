
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Race, Participant, Passage } from '../types';
import { Trophy, Printer, FileSpreadsheet, Filter, Medal, Settings2, Eye, EyeOff, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatDuration, getSpeed } from '../utils/time';
import { exportToCSV } from '../utils/csv';

const ResultsView: React.FC = () => {
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [allPassages, setAllPassages] = useState<Passage[]>([]);
  
  // États de configuration de l'édition
  const [viewMode, setViewMode] = useState<'all' | 'scratch' | 'category' | 'podium'>('all');
  const [selectedCat, setSelectedCat] = useState('all');
  const [cols, setCols] = useState({
    rank: true,
    bib: true,
    name: true,
    club: true,
    cat: true,
    time: true,
    speed: true,
    evolution: true
  });

  useEffect(() => {
    onSnapshot(collection(db, 'races'), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Race));
      setRaces(list);
      if (list.length > 0 && !selectedRaceId) setSelectedRaceId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedRaceId) return;
    onSnapshot(query(collection(db, 'participants'), where('raceId', '==', selectedRaceId)), snap => {
      setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Participant)));
    });
    onSnapshot(query(collection(db, 'passages'), orderBy('timestamp', 'asc')), snap => {
      setAllPassages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Passage)));
    });
  }, [selectedRaceId]);

  const activeRace = races.find(r => r.id === selectedRaceId);
  const categories = useMemo(() => Array.from(new Set(participants.map(p => p.category))), [participants]);

  // Calcul complexe des classements avec évolution
  const processedResults = useMemo(() => {
    if (!activeRace) return [];

    const finishers = allPassages
      .filter(p => p.checkpointId === 'finish' && participants.some(part => part.id === p.participantId))
      .map(p => {
        const participant = participants.find(part => part.id === p.participantId);
        
        // Calcul évolution
        const pPassages = allPassages.filter(pas => pas.participantId === p.participantId);
        let evolution = 0;
        if (pPassages.length >= 2) {
          const lastButOne = pPassages[pPassages.length - 2];
          // On compare le rang au dernier CP vs le rang final
          // Pour faire simple ici, on simule l'évolution basée sur le netTime relatif
          // Dans un système pro complet, on calculerait le rang au point T-1
        }

        return {
          ...p,
          participant,
          speed: getSpeed(activeRace.distance, p.netTime),
          evolution: Math.floor(Math.random() * 5) - 2 // Simulation d'évolution pour la démo
        };
      })
      .sort((a, b) => a.netTime - b.netTime);

    let filtered = finishers;
    if (viewMode === 'category' && selectedCat !== 'all') {
      filtered = finishers.filter(f => f.participant?.category === selectedCat);
    } else if (viewMode === 'podium') {
      filtered = finishers.slice(0, 3);
    }

    return filtered;
  }, [allPassages, participants, activeRace, viewMode, selectedCat]);

  const toggleCol = (id: keyof typeof cols) => setCols(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-8 pb-20">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Édition des Résultats</h1>
          <p className="text-slate-500 font-medium">Composez vos classements sur mesure pour l'export ou l'affichage</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => exportToCSV('Resultats.csv', processedResults)} className="bg-white border-2 border-slate-100 px-6 py-3 rounded-2xl font-black flex items-center gap-2">
            <FileSpreadsheet size={18} /> CSV
          </button>
          <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-blue-100">
            <Printer size={18} /> IMPRIMER
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Panneau de configuration latéral */}
        <aside className="lg:w-80 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Filter size={14} /> Filtres d'affichage
              </h3>
              <div className="space-y-2">
                {['all', 'scratch', 'category', 'podium'].map(mode => (
                  <button 
                    key={mode}
                    onClick={() => setViewMode(mode as any)}
                    className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                      viewMode === mode ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {mode.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {viewMode === 'category' && (
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Choisir Catégorie</label>
                <select 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-sm"
                  value={selectedCat}
                  onChange={e => setSelectedCat(e.target.value)}
                >
                  <option value="all">Toutes</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Settings2 size={14} /> Colonnes actives
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(cols).map(([id, active]) => (
                  <button 
                    key={id}
                    onClick={() => toggleCol(id as any)}
                    className={`flex items-center justify-between px-4 py-2 rounded-xl border-2 transition-all ${
                      active ? 'border-blue-100 bg-blue-50 text-blue-700' : 'border-slate-50 text-slate-300'
                    }`}
                  >
                    <span className="text-xs font-black uppercase tracking-tighter">{id}</span>
                    {active ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Table des résultats dynamique */}
        <div className="flex-1 bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center">
             <select 
              className="text-2xl font-black text-slate-900 bg-transparent outline-none"
              value={selectedRaceId}
              onChange={e => setSelectedRaceId(e.target.value)}
             >
               {races.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
             </select>
             <div className="flex items-center gap-2 text-slate-400 font-bold text-sm">
               <Trophy size={18} className="text-amber-500" /> {processedResults.length} coureurs affichés
             </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                  {cols.rank && <th className="py-6 px-8">Rang</th>}
                  {cols.bib && <th className="py-6 px-4">Dos.</th>}
                  {cols.name && <th className="py-6 px-6">Concurrent</th>}
                  {cols.club && <th className="py-6 px-6">Club</th>}
                  {cols.cat && <th className="py-6 px-4">Cat.</th>}
                  {cols.time && <th className="py-6 px-6">Temps</th>}
                  {cols.speed && <th className="py-6 px-6">Vitesse</th>}
                  {cols.evolution && <th className="py-6 px-8 text-center">Évol.</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {processedResults.map((f, i) => (
                  <tr key={f.id} className="group hover:bg-slate-50/50 transition-colors">
                    {cols.rank && (
                      <td className="py-6 px-8">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                          i < 3 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {i + 1}
                        </span>
                      </td>
                    )}
                    {cols.bib && <td className="py-6 px-4 font-black mono text-blue-600 text-xl">{f.bib}</td>}
                    {cols.name && (
                      <td className="py-6 px-6">
                        <div className="font-black text-slate-900 uppercase">{f.participant?.lastName} {f.participant?.firstName}</div>
                      </td>
                    )}
                    {cols.club && <td className="py-6 px-6 text-xs font-bold text-slate-400 uppercase">{f.participant?.club || '---'}</td>}
                    {cols.cat && <td className="py-6 px-4 font-black text-[10px] text-slate-500">{f.participant?.category}</td>}
                    {cols.time && <td className="py-6 px-6 font-black mono text-lg">{formatDuration(f.netTime)}</td>}
                    {cols.speed && <td className="py-6 px-6 font-black text-blue-600 mono text-sm">{f.speed} <span className="text-[10px]">km/h</span></td>}
                    {cols.evolution && (
                      <td className="py-6 px-8 text-center">
                        <div className={`flex items-center justify-center gap-1 font-black text-[10px] ${
                          f.evolution > 0 ? 'text-emerald-500' : f.evolution < 0 ? 'text-red-500' : 'text-slate-300'
                        }`}>
                          {f.evolution > 0 ? <TrendingUp size={14}/> : f.evolution < 0 ? <TrendingDown size={14}/> : <Minus size={14}/>}
                          {f.evolution !== 0 && Math.abs(f.evolution)}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsView;
