import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Race, Participant, Passage } from '../types';
import { Trophy, Printer, FileSpreadsheet, Filter, Medal, Settings2, Eye, EyeOff, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Activity } from 'lucide-react';
import { formatDuration, getSpeed } from '../utils/time';
import { exportToCSV } from '../utils/csv';

const ResultsView: React.FC = () => {
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [allPassages, setAllPassages] = useState<Passage[]>([]);
  const [expandedBibs, setExpandedBibs] = useState<string[]>([]);
  
  // États de configuration de l'édition
  const [viewMode, setViewMode] = useState<'all' | 'scratch' | 'scratch_m' | 'scratch_f' | 'category' | 'podium'>('all');
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

  // Nouveau : État pour les colonnes de segments spécifiques
  const [visibleSegments, setVisibleSegments] = useState<number[]>([]);

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
    // Réinitialiser les segments visibles lors du changement de course
    setVisibleSegments([]);
  }, [selectedRaceId]);

  const activeRace = races.find(r => r.id === selectedRaceId);
  const categories = useMemo(() => Array.from(new Set(participants.map(p => p.category))), [participants]);

  const currentRaceSegments = useMemo(() => {
    if (!activeRace) return [];
    const numSegments = activeRace.checkpoints.length + 1;
    return activeRace.segments || Array(numSegments).fill("Course");
  }, [activeRace]);

  // Calcul complexe des classements avec évolution
  const processedResults = useMemo(() => {
    if (!activeRace) return [];

    const finishers = allPassages
      .filter(p => p.checkpointId === 'finish' && participants.some(part => part.id === p.participantId))
      .map(p => {
        const participant = participants.find(part => part.id === p.participantId);
        
        return {
          ...p,
          participant,
          speed: getSpeed(activeRace.distance, p.netTime),
          evolution: Math.floor(Math.random() * 5) - 2 // Simulation d'évolution pour la démo
        };
      })
      .sort((a, b) => a.netTime - b.netTime);

    let filtered = finishers;
    if (viewMode === 'scratch_m') {
      filtered = finishers.filter(f => f.participant?.gender === 'M');
    } else if (viewMode === 'scratch_f') {
      filtered = finishers.filter(f => f.participant?.gender === 'F');
    } else if (viewMode === 'category' && selectedCat !== 'all') {
      filtered = finishers.filter(f => f.participant?.category === selectedCat);
    } else if (viewMode === 'podium') {
      filtered = finishers.slice(0, 3);
    }

    return filtered;
  }, [allPassages, participants, activeRace, viewMode, selectedCat]);

  const toggleCol = (id: keyof typeof cols) => setCols(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleSegmentCol = (idx: number) => {
    setVisibleSegments(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  // Added toggleExpand function to manage row expansion in the results table
  const toggleExpand = (bib: string) => {
    setExpandedBibs(prev => 
      prev.includes(bib) ? prev.filter(b => b !== bib) : [...prev, bib]
    );
  };

  const calculateSegments = (participantId: string) => {
    if (!activeRace) return [];
    const runnerPassages = allPassages
      .filter(p => p.participantId === participantId)
      .sort((a, b) => a.timestamp - b.timestamp);

    const segments = currentRaceSegments;
    const results: any[] = [];

    // On construit la liste ordonnée des points de passage de la course
    const points = [...activeRace.checkpoints.map(cp => cp.id), 'finish'];
    let previousTime = 0;
    
    points.forEach((pointId, idx) => {
      const passage = runnerPassages.find(p => p.checkpointId === pointId);
      const segmentName = segments[idx] || "Course";
      
      if (passage) {
        const duration = passage.netTime - previousTime;
        results.push({
          name: segmentName,
          duration: duration,
          total: passage.netTime,
          pointName: passage.checkpointName
        });
        previousTime = passage.netTime;
      } else {
        results.push({
          name: segmentName,
          duration: null,
          total: null,
          pointName: pointId === 'finish' ? 'ARRIVÉE' : activeRace.checkpoints.find(c => c.id === pointId)?.name || 'Point'
        });
      }
    });

    return results;
  };

  const handleExportCSV = () => {
    if (!processedResults.length || !activeRace) return;

    // Transformation des données pour un CSV propre et "utilisable"
    const exportData = processedResults.map((f, i) => {
      const row: any = {};
      
      // Informations de base
      row["Rang"] = i + 1;
      row["Dossard"] = f.bib;
      row["Nom"] = f.participant?.lastName || '';
      row["Prénom"] = f.participant?.firstName || '';
      row["Sexe"] = f.participant?.gender || '';
      row["Catégorie"] = f.participant?.category || '';
      row["Club"] = f.participant?.club || 'Individuel';
      row["Temps Total"] = formatDuration(f.netTime);
      row["Vitesse Moy (km/h)"] = f.speed;

      // Ajout des segments (splits)
      const segmentsData = calculateSegments(f.participantId);
      segmentsData.forEach((seg, idx) => {
        const colName = `Segment ${idx + 1} - ${seg.name}`;
        row[colName] = seg.duration ? formatDuration(seg.duration).split('.')[0] : 'N/A';
        row[`Total après ${seg.name}`] = seg.total ? formatDuration(seg.total).split('.')[0] : 'N/A';
      });

      return row;
    });

    const fileName = `Resultats_${activeRace.name.replace(/\s+/g, '_')}_${viewMode}.csv`;
    exportToCSV(fileName, exportData);
  };

  return (
    <div className="space-y-8 pb-20">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Édition des Résultats</h1>
          <p className="text-slate-500 font-medium">Composez vos classements sur mesure pour l'export ou l'affichage</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExportCSV} 
            className="bg-white border-2 border-slate-100 px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-slate-50 transition-colors"
          >
            <FileSpreadsheet size={18} className="text-emerald-600" /> CSV PROPRE
          </button>
          <button 
            onClick={() => window.print()} 
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all"
          >
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
                {[
                  { id: 'all', label: 'TOUS' },
                  { id: 'scratch', label: 'SCRATCH TOTAL' },
                  { id: 'scratch_m', label: 'SCRATCH HOMMES' },
                  { id: 'scratch_f', label: 'SCRATCH FEMMES' },
                  { id: 'category', label: 'PAR CATÉGORIE' },
                  { id: 'podium', label: 'PODIUM (TOP 3)' }
                ].map(mode => (
                  <button 
                    key={mode.id}
                    onClick={() => setViewMode(mode.id as any)}
                    className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                      viewMode === mode.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {mode.label}
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

            {/* Nouveau : Section pour les segments éditables dans la barre latérale */}
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Activity size={14} /> Temps par Segment
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {currentRaceSegments.map((seg, idx) => (
                  <button 
                    key={idx}
                    onClick={() => toggleSegmentCol(idx)}
                    className={`flex items-center justify-between px-4 py-2 rounded-xl border-2 transition-all ${
                      visibleSegments.includes(idx) ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-50 text-slate-300'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-tighter truncate max-w-[150px]">{seg}</span>
                    {visibleSegments.includes(idx) ? <Eye size={14} /> : <EyeOff size={14} />}
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
              className="text-2xl font-black text-slate-900 bg-transparent outline-none cursor-pointer"
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
                  <th className="py-6 px-4"></th>
                  {cols.rank && <th className="py-6 px-4">Rang</th>}
                  {cols.bib && <th className="py-6 px-4">Dos.</th>}
                  {cols.name && <th className="py-6 px-6">Concurrent</th>}
                  {cols.club && <th className="py-6 px-6">Club</th>}
                  {cols.cat && <th className="py-6 px-4">Cat.</th>}
                  
                  {/* Nouveau : Headers dynamiques pour les segments */}
                  {visibleSegments.map(idx => (
                    <th key={idx} className="py-6 px-4 text-emerald-600">{currentRaceSegments[idx]}</th>
                  ))}

                  {cols.time && <th className="py-6 px-6">Temps</th>}
                  {cols.speed && <th className="py-6 px-6">Vitesse</th>}
                  {cols.evolution && <th className="py-6 px-8 text-center">Évol.</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {processedResults.map((f, i) => {
                  const isExpanded = expandedBibs.includes(f.bib);
                  const segmentsData = calculateSegments(f.participantId);

                  return (
                    <React.Fragment key={f.id}>
                      <tr 
                        className={`group cursor-pointer hover:bg-slate-50/50 transition-colors ${isExpanded ? 'bg-blue-50/30' : ''}`}
                        onClick={() => toggleExpand(f.bib)}
                      >
                        <td className="py-6 px-4">
                          {isExpanded ? <ChevronUp size={16} className="text-blue-500" /> : <ChevronDown size={16} className="text-slate-300" />}
                        </td>
                        {cols.rank && (
                          <td className="py-6 px-4">
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
                            <div className="font-black text-slate-900 uppercase leading-none">{f.participant?.lastName} {f.participant?.firstName}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">{f.participant?.gender === 'F' ? 'Femme' : 'Homme'}</div>
                          </td>
                        )}
                        {cols.club && <td className="py-6 px-6 text-xs font-bold text-slate-400 uppercase">{f.participant?.club || 'Individuel'}</td>}
                        {cols.cat && <td className="py-6 px-4 font-black text-[10px] text-slate-500">{f.participant?.category}</td>}
                        
                        {/* Nouveau : Valeurs dynamiques pour les segments */}
                        {visibleSegments.map(idx => {
                          const seg = segmentsData[idx];
                          return (
                            <td key={idx} className="py-6 px-4">
                              <span className="font-black text-[11px] text-emerald-600 mono">
                                {seg?.duration ? formatDuration(seg.duration).split('.')[0] : '--:--:--'}
                              </span>
                            </td>
                          );
                        })}

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
                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={9 + visibleSegments.length} className="px-12 py-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-2">
                              {segmentsData.map((seg, sIdx) => (
                                <div key={sIdx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group/seg">
                                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-20 group-hover/seg:opacity-100 transition-opacity"></div>
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{seg.name}</span>
                                    <Activity size={14} className="text-slate-200" />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xl font-black text-slate-900 mono">{seg.duration ? formatDuration(seg.duration).split('.')[0] : '--:--:--'}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Cumulé : {seg.total ? formatDuration(seg.total).split('.')[0] : '--:--:--'}</p>
                                  </div>
                                  <div className="mt-3 pt-2 border-t border-slate-50">
                                    <span className="text-[8px] font-black text-slate-400 uppercase">Jusqu'à : {seg.pointName}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsView;