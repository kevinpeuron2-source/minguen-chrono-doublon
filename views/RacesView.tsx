import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Race, RaceStatus, RaceType, Checkpoint, ParticipantStatus, GlobalCombinedPost } from '../types';
import { Flag, Plus, Trash2, Play, Square, Share2, MapPin, X, RotateCcw, Loader2, Layers, Link as LinkIcon, CheckCircle2, ChevronRight, Activity } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';

const RacesView: React.FC = () => {
  const [races, setRaces] = useState<Race[]>([]);
  const [globalCombinedPosts, setGlobalCombinedPosts] = useState<GlobalCombinedPost[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGlobalModal, setShowGlobalModal] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const { setDbError } = useDatabase();

  const [newRace, setNewRace] = useState<Partial<Race>>({
    name: '', distance: 0, type: RaceType.GROUP, status: RaceStatus.READY, checkpoints: []
  });

  // États pour la création d'un poste multi-course
  const [globalName, setGlobalName] = useState('');
  const [tempAssignments, setTempAssignments] = useState<{raceId: string, checkpointId: string}[]>([]);

  useEffect(() => {
    const unsubRaces = onSnapshot(collection(db, 'races'), (snap) => {
      setRaces(snap.docs.map(d => ({ id: d.id, ...d.data() } as Race)));
    }, (err) => setDbError(err.message));

    const unsubGlobal = onSnapshot(collection(db, 'global_combined_posts'), (snap) => {
      setGlobalCombinedPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as GlobalCombinedPost)));
    });

    return () => { unsubRaces(); unsubGlobal(); };
  }, [setDbError]);

  const handleAddRace = async () => {
    if (!newRace.name) return;
    try {
      await addDoc(collection(db, 'races'), { ...newRace, status: RaceStatus.READY, checkpoints: [] });
      setShowAddModal(false);
      setNewRace({ name: '', distance: 0, type: RaceType.GROUP, status: RaceStatus.READY, checkpoints: [] });
    } catch (err: any) { alert(err.message); }
  };

  const deleteRace = async (id: string) => {
    if (confirm("Supprimer cette course ?")) await deleteDoc(doc(db, 'races', id));
  };

  const startRace = async (id: string) => {
    await updateDoc(doc(db, 'races', id), { status: RaceStatus.RUNNING, startTime: Date.now() });
  };

  const stopRace = async (id: string) => {
    await updateDoc(doc(db, 'races', id), { status: RaceStatus.FINISHED });
  };

  const resetRace = async (raceId: string) => {
    if (!confirm("Réinitialiser totalement cette course ?")) return;
    setResettingId(raceId);
    try {
      const pQuery = query(collection(db, 'participants'), where('raceId', '==', raceId));
      const pSnap = await getDocs(pQuery);
      const pIds = pSnap.docs.map(d => d.id);

      let allPassageRefs: any[] = [];
      if (pIds.length > 0) {
        for (let i = 0; i < pIds.length; i += 30) {
          const chunk = pIds.slice(i, i + 30);
          const pasQuery = query(collection(db, 'passages'), where('participantId', 'in', chunk));
          const pasSnap = await getDocs(pasQuery);
          pasSnap.forEach(d => allPassageRefs.push(d.ref));
        }
      }

      const batch = writeBatch(db);
      pSnap.docs.forEach(pDoc => batch.update(pDoc.ref, { status: ParticipantStatus.REGISTERED, startTime: null }));
      allPassageRefs.forEach(ref => batch.delete(ref));
      await batch.commit();

      await updateDoc(doc(db, 'races', raceId), { status: RaceStatus.READY, startTime: null });
      alert("Réinitialisation terminée.");
    } catch (err: any) { alert(err.message); } finally { setResettingId(null); }
  };

  const generateShareLink = (raceId: string, cpId: string) => {
    const link = `${window.location.origin}${window.location.pathname}#/signaleur-terrain?raceId=${raceId}&cpId=${cpId}`;
    navigator.clipboard.writeText(link);
    alert("Lien signaleur copié !");
  };

  const generateGlobalLink = (postId: string) => {
    const link = `${window.location.origin}${window.location.pathname}#/signaleur-terrain?combinedPostId=${postId}`;
    navigator.clipboard.writeText(link);
    alert("Lien poste multi-course copié !");
  };

  const addCheckpoint = async (race: Race) => {
    const name = prompt("Nom du point ?");
    if (!name) return;
    const distance = parseFloat(prompt("Distance (km) ?") || "0");
    const newCp = { id: crypto.randomUUID(), name, distance, isMandatory: true };
    await updateDoc(doc(db, 'races', race.id), { checkpoints: [...race.checkpoints, newCp] });
  };

  const deleteCheckpoint = async (race: Race, cpId: string) => {
    if (!confirm("Supprimer ce point de passage ?")) return;
    const updatedCheckpoints = race.checkpoints.filter(cp => cp.id !== cpId);
    await updateDoc(doc(db, 'races', race.id), { checkpoints: updatedCheckpoints });
  };

  const updateSegment = async (race: Race, index: number) => {
    const currentSegments = race.segments || [];
    const currentValue = currentSegments[index] || "Discipline";
    const newValue = prompt("Discipline pour ce segment ?", currentValue);
    
    if (newValue !== null) {
      const newSegments = [...currentSegments];
      // On s'assure d'avoir assez de places dans le tableau
      const requiredSegments = race.checkpoints.length + 1;
      while (newSegments.length < requiredSegments) newSegments.push("Course");
      
      newSegments[index] = newValue;
      await updateDoc(doc(db, 'races', race.id), { segments: newSegments });
    }
  };

  const handleCreateGlobalPost = async () => {
    if (!globalName || tempAssignments.length < 2) {
      alert("Nom requis et au moins 2 points de courses différentes.");
      return;
    }

    const assignments = tempAssignments.map(ta => {
      const race = races.find(r => r.id === ta.raceId);
      const cp = race?.checkpoints.find(c => c.id === ta.checkpointId);
      return {
        raceId: ta.raceId,
        raceName: race?.name || 'Inconnue',
        checkpointId: ta.checkpointId,
        checkpointName: cp?.name || 'Point'
      };
    });

    try {
      await addDoc(collection(db, 'global_combined_posts'), { name: globalName, assignments });
      setShowGlobalModal(false);
      setGlobalName('');
      setTempAssignments([]);
    } catch (err: any) { alert(err.message); }
  };

  const deleteGlobalPost = async (id: string) => {
    if (confirm("Supprimer ce poste multi-course ?")) await deleteDoc(doc(db, 'global_combined_posts', id));
  };

  return (
    <div className="space-y-10 pb-20">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Épreuves & Logistique</h1>
          <p className="text-slate-500 font-medium">Configurez vos courses et vos postes de pointage</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowGlobalModal(true)}
            className="bg-emerald-600 text-white px-6 py-4 rounded-[1.5rem] font-black flex items-center gap-3 shadow-lg shadow-emerald-100 hover:scale-105 transition-transform"
          >
            <Layers size={20} /> Poste Multi-Course
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-8 py-4 rounded-[2rem] font-black flex items-center gap-3 shadow-xl shadow-blue-100 hover:scale-105 transition-transform"
          >
            <Plus size={24} /> Nouvelle Course
          </button>
        </div>
      </header>

      {/* SECTION DES POSTES MULTI-COURSES */}
      {globalCombinedPosts.length > 0 && (
        <section className="bg-emerald-50/50 p-8 rounded-[3rem] border border-emerald-100/50">
          <div className="flex items-center gap-3 mb-6">
            <Layers className="text-emerald-600" size={24} />
            <h2 className="text-xl font-black text-emerald-900 uppercase">Postes de Pointage Groupés (Multi-Épreuves)</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {globalCombinedPosts.map(post => (
              <div key={post.id} className="bg-white p-6 rounded-[2rem] border border-emerald-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                <div>
                  <h3 className="font-black text-slate-900 uppercase text-lg mb-2">{post.name}</h3>
                  <div className="space-y-1">
                    {post.assignments.map((as, i) => (
                      <p key={i} className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
                        <CheckCircle2 size={10} className="text-emerald-500" /> {as.raceName} : {as.checkpointName}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button 
                    onClick={() => generateGlobalLink(post.id)}
                    className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-emerald-600"
                  >
                    <LinkIcon size={14} /> Copier le Lien
                  </button>
                  <button 
                    onClick={() => deleteGlobalPost(post.id)}
                    className="p-3 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-8">
        {races.map(race => {
          const numSegments = race.checkpoints.length + 1;
          const segments = race.segments || Array(numSegments).fill("Course");

          return (
            <div key={race.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-6">
                  <div className={`p-5 rounded-3xl ${race.status === RaceStatus.RUNNING ? 'bg-emerald-500' : 'bg-slate-100'} text-white shadow-lg`}>
                    <Flag size={28} className={race.status === RaceStatus.RUNNING ? 'text-white' : 'text-slate-400'} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">{race.name}</h2>
                    <div className="flex gap-6 mt-2">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{race.distance} KM</span>
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{race.type}</span>
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${
                        race.status === RaceStatus.RUNNING ? 'bg-emerald-100 text-emerald-600 shadow-sm shadow-emerald-100' : 
                        race.status === RaceStatus.FINISHED ? 'bg-blue-100 text-blue-600' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {race.status}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  {resettingId === race.id ? (
                    <div className="p-4 bg-slate-100 text-slate-400 rounded-2xl flex items-center gap-2 font-black text-xs uppercase">
                      <Loader2 size={20} className="animate-spin" /> Reset...
                    </div>
                  ) : (
                    <>
                      {race.status === RaceStatus.READY && (
                        <button onClick={() => startRace(race.id)} className="p-5 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 shadow-lg transition-all active:scale-90">
                          <Play size={24} />
                        </button>
                      )}
                      {race.status === RaceStatus.RUNNING && (
                        <button onClick={() => stopRace(race.id)} className="p-5 bg-red-500 text-white rounded-2xl hover:bg-red-600 shadow-lg transition-all active:scale-90">
                          <Square size={24} />
                        </button>
                      )}
                      {(race.status === RaceStatus.RUNNING || race.status === RaceStatus.FINISHED) && (
                        <button onClick={() => resetRace(race.id)} className="p-5 bg-amber-500 text-white rounded-2xl hover:bg-amber-600 shadow-lg transition-all active:scale-90">
                          <RotateCcw size={24} />
                        </button>
                      )}
                    </>
                  )}
                  <button onClick={() => deleteRace(race.id)} className="p-5 bg-slate-50 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-colors">
                    <Trash2 size={24} />
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-50 pt-8 space-y-10">
                {/* SECTION CHECKPOINTS */}
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                      <MapPin size={18} /> Points de Passage ({race.checkpoints.length})
                    </h3>
                    <button 
                      onClick={() => addCheckpoint(race)} 
                      className="bg-slate-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-blue-50 transition-colors"
                    >
                      + Nouveau point
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {race.checkpoints.map(cp => (
                      <div key={cp.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex justify-between items-center hover:border-blue-200 transition-colors group relative">
                        <div className="flex-1">
                          <p className="font-black text-slate-900 uppercase text-sm">{cp.name}</p>
                          <p className="text-[10px] font-bold text-slate-400">{cp.distance} KM</p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => generateShareLink(race.id, cp.id)}
                            className="p-3 bg-white text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm"
                            title="Partager ce point"
                          >
                            <Share2 size={16} />
                          </button>
                          <button 
                            onClick={() => deleteCheckpoint(race, cp.id)}
                            className="p-3 bg-white text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shadow-sm"
                            title="Supprimer ce point"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SECTION MULTI-ACTIVITÉS (LIGNE DE SEGMENTS) */}
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                    <Activity size={18} /> Segments & Disciplines
                  </h3>
                  
                  <div className="relative pt-6 pb-2">
                    {/* Points fixes de la ligne (Start / Checkpoints / Finish) */}
                    <div className="absolute top-[21px] left-0 right-0 h-1 bg-slate-100 rounded-full"></div>
                    
                    <div className="flex justify-between items-center relative z-10">
                      {/* Départ */}
                      <div className="flex flex-col items-center">
                        <div className="w-4 h-4 rounded-full bg-slate-300 border-4 border-white shadow-sm"></div>
                        <span className="text-[8px] font-black text-slate-400 mt-1 uppercase">Départ</span>
                      </div>

                      {/* Segments éditables entre les points */}
                      <div className="flex-1 flex justify-around px-2 gap-2">
                        {segments.map((discipline, idx) => (
                          <button
                            key={idx}
                            onClick={() => updateSegment(race, idx)}
                            className="flex-1 bg-white border border-slate-200 hover:border-blue-500 hover:bg-blue-50 rounded-lg py-2 px-1 text-center transition-all group"
                          >
                            <p className="text-[10px] font-black text-blue-600 uppercase truncate">
                              {discipline || "Course"}
                            </p>
                            <div className="h-0.5 w-4 bg-blue-100 mx-auto mt-1 rounded-full group-hover:bg-blue-300"></div>
                          </button>
                        ))}
                      </div>

                      {/* Arrivée */}
                      <div className="flex flex-col items-center">
                        <div className="w-4 h-4 rounded-full bg-blue-600 border-4 border-white shadow-sm"></div>
                        <span className="text-[8px] font-black text-blue-600 mt-1 uppercase">Arrivée</span>
                      </div>
                    </div>

                    {/* Affichage des noms de checkpoints sous la ligne pour contexte */}
                    <div className="flex justify-between mt-4 px-2 opacity-30">
                       <div className="w-8"></div>
                       {race.checkpoints.map((cp, idx) => (
                         <div key={idx} className="flex-1 text-center">
                           <span className="text-[7px] font-black text-slate-400 uppercase truncate px-2 block">{cp.name}</span>
                         </div>
                       ))}
                       <div className="w-8"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL AJOUT COURSE */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-lg shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black text-slate-900 uppercase">Nouvelle Course</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={24}/></button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nom complet</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-xl outline-none focus:border-blue-500 transition-all"
                  value={newRace.name}
                  onChange={e => setNewRace({...newRace, name: e.target.value})}
                  placeholder="EX: TRAIL 15KM"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Distance (KM)</label>
                  <input 
                    type="number" 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black outline-none focus:border-blue-500 transition-all"
                    value={newRace.distance}
                    onChange={e => setNewRace({...newRace, distance: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Type</label>
                  <select 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black outline-none focus:border-blue-500 transition-all cursor-pointer"
                    value={newRace.type}
                    onChange={e => setNewRace({...newRace, type: e.target.value as RaceType})}
                  >
                    <option value={RaceType.GROUP}>GROUPÉ</option>
                    <option value={RaceType.TIME_TRIAL}>C.L.M</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4 pt-8">
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-5 font-black text-slate-400">Annuler</button>
                <button onClick={handleAddRace} className="flex-2 bg-blue-600 text-white py-5 rounded-2xl font-black shadow-lg shadow-blue-100">Créer l'épreuve</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL POSTE MULTI-COURSE */}
      {showGlobalModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-2xl shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black text-slate-900 uppercase">Fusionner des points de courses</h2>
              <button onClick={() => setShowGlobalModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={24}/></button>
            </div>
            
            <div className="space-y-8">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nom du poste (ex: RAVITO CARREFOUR SUD)</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-lg outline-none focus:border-emerald-500 transition-all"
                  value={globalName}
                  onChange={e => setGlobalName(e.target.value)}
                  placeholder="EX: POINT CONTRÔLE COMMUN"
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Points à regrouper</h3>
                  <button 
                    onClick={() => setTempAssignments([...tempAssignments, {raceId: '', checkpointId: ''}])}
                    className="text-emerald-600 text-xs font-black uppercase"
                  >
                    + Ajouter une course
                  </button>
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                  {tempAssignments.map((assignment, index) => (
                    <div key={index} className="flex gap-3 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <select 
                        className="flex-1 bg-white border-none rounded-xl px-4 py-3 font-bold text-xs outline-none"
                        value={assignment.raceId}
                        onChange={e => {
                          const newAs = [...tempAssignments];
                          newAs[index].raceId = e.target.value;
                          newAs[index].checkpointId = '';
                          setTempAssignments(newAs);
                        }}
                      >
                        <option value="">Choisir Course...</option>
                        {races.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      <select 
                        className="flex-1 bg-white border-none rounded-xl px-4 py-3 font-bold text-xs outline-none"
                        value={assignment.checkpointId}
                        onChange={e => {
                          const newAs = [...tempAssignments];
                          newAs[index].checkpointId = e.target.value;
                          setTempAssignments(newAs);
                        }}
                        disabled={!assignment.raceId}
                      >
                        <option value="">Choisir Point...</option>
                        {races.find(r => r.id === assignment.raceId)?.checkpoints.map(cp => (
                          <option key={cp.id} value={cp.id}>{cp.name}</option>
                        ))}
                      </select>
                      <button 
                        onClick={() => setTempAssignments(tempAssignments.filter((_, i) => i !== index))}
                        className="p-2 text-slate-300 hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {tempAssignments.length === 0 && (
                    <div className="py-6 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                      <p className="text-xs font-bold text-slate-300 uppercase">Aucun point sélectionné</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-8">
                <button onClick={() => setShowGlobalModal(false)} className="flex-1 py-5 font-black text-slate-400">Annuler</button>
                <button 
                  onClick={handleCreateGlobalPost}
                  disabled={!globalName || tempAssignments.length < 2}
                  className="flex-2 bg-emerald-600 text-white py-5 rounded-2xl font-black shadow-lg disabled:opacity-30"
                >
                  Générer le Poste Global
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RacesView;