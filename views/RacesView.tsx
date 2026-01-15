import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Race, RaceStatus, RaceType, Checkpoint, ParticipantStatus } from '../types';
import { Flag, Plus, Trash2, Play, Square, Share2, MapPin, X, RotateCcw, Loader2 } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';

const RacesView: React.FC = () => {
  const [races, setRaces] = useState<Race[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const { setDbError } = useDatabase();
  const [newRace, setNewRace] = useState<Partial<Race>>({
    name: '', distance: 0, type: RaceType.GROUP, status: RaceStatus.READY, checkpoints: []
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'races'), (snap) => {
      setRaces(snap.docs.map(d => ({ id: d.id, ...d.data() } as Race)));
    }, (err) => {
      console.error("Erreur Snapshot Races:", err);
      setDbError(err.message);
    });
    return unsub;
  }, [setDbError]);

  const handleAddRace = async () => {
    if (!newRace.name) return;
    try {
      await addDoc(collection(db, 'races'), { ...newRace, status: RaceStatus.READY, checkpoints: [] });
      setShowAddModal(false);
      setNewRace({ name: '', distance: 0, type: RaceType.GROUP, status: RaceStatus.READY, checkpoints: [] });
    } catch (err: any) {
      alert("Erreur lors de la création : " + err.message);
    }
  };

  const deleteRace = async (id: string) => {
    if (confirm("Supprimer cette course et tous les participants associés ?")) {
      try {
        await deleteDoc(doc(db, 'races', id));
      } catch (err: any) {
        alert("Erreur suppression : " + err.message);
      }
    }
  };

  const startRace = async (id: string) => {
    try {
      await updateDoc(doc(db, 'races', id), { 
        status: RaceStatus.RUNNING, 
        startTime: Date.now() 
      });
    } catch (err: any) {
      alert("Erreur démarrage : " + err.message);
    }
  };

  const stopRace = async (id: string) => {
    try {
      await updateDoc(doc(db, 'races', id), { status: RaceStatus.FINISHED });
    } catch (err: any) {
      alert("Erreur arrêt : " + err.message);
    }
  };

  const resetRace = async (raceId: string) => {
    if (!confirm("⚠️ RÉINITIALISATION TOTALE\n\nCette action va :\n1. Remettre le chrono à zéro\n2. Supprimer TOUS les temps enregistrés\n3. Remettre tous les coureurs au départ\n\nContinuer ?")) {
      return;
    }

    setResettingId(raceId);
    try {
      console.log("Processus de réinitialisation lancé pour :", raceId);

      // 1. Récupérer les participants de cette course spécifique
      const pQuery = query(collection(db, 'participants'), where('raceId', '==', raceId));
      const pSnap = await getDocs(pQuery);
      const pIds = pSnap.docs.map(d => d.id);

      // 2. Récupérer les passages liés aux participants de cette course
      let allPassageRefs: any[] = [];
      if (pIds.length > 0) {
        // Firebase limite la clause 'in' à 30 éléments. On segmente par paquets de 30.
        for (let i = 0; i < pIds.length; i += 30) {
          const chunk = pIds.slice(i, i + 30);
          const pasQuery = query(collection(db, 'passages'), where('participantId', 'in', chunk));
          const pasSnap = await getDocs(pasQuery);
          pasSnap.forEach(d => allPassageRefs.push(d.ref));
        }
      }

      console.log(`${pIds.length} participants et ${allPassageRefs.length} passages à nettoyer.`);

      // 3. Préparer les opérations en masse (Batch)
      // On regroupe tout dans une liste d'opérations pour les traiter par lots de 400
      const operations: { ref: any, type: 'update' | 'delete', data?: any }[] = [];

      // A. Mettre à jour les participants (Statut -> Inscrit, Chrono -> null)
      pSnap.docs.forEach(pDoc => {
        operations.push({
          ref: pDoc.ref,
          type: 'update',
          data: { status: ParticipantStatus.REGISTERED, startTime: null }
        });
      });

      // B. Supprimer tous les passages enregistrés
      allPassageRefs.forEach(ref => {
        operations.push({
          ref: ref,
          type: 'delete'
        });
      });

      // 4. Exécuter les opérations de nettoyage par batchs
      if (operations.length > 0) {
        for (let i = 0; i < operations.length; i += 400) {
          const batch = writeBatch(db);
          const chunk = operations.slice(i, i + 400);
          chunk.forEach(op => {
            if (op.type === 'update') batch.update(op.ref, op.data);
            else if (op.type === 'delete') batch.delete(op.ref);
          });
          await batch.commit();
          console.log(`Lot de nettoyage ${Math.floor(i/400) + 1} validé.`);
        }
      }

      // 5. EN DERNIER : Remettre la course à zéro (Statut READY + Chrono null)
      // Cela garantit que le bouton "Play" ne revient que quand tout le reste est fini
      await updateDoc(doc(db, 'races', raceId), {
        status: RaceStatus.READY,
        startTime: null
      });

      console.log("Réinitialisation terminée avec succès.");
      alert("La course a été réinitialisée. Vous pouvez relancer un départ.");
    } catch (err: any) {
      console.error("Erreur fatale lors du reset :", err);
      alert("La réinitialisation a échoué : " + err.message);
    } finally {
      setResettingId(null);
    }
  };

  const generateShareLink = (raceId: string, cpId: string) => {
    try {
      const baseUrl = window.location.origin + window.location.pathname;
      const link = `${baseUrl}#/signaleur-terrain?raceId=${raceId}&cpId=${cpId}`;
      navigator.clipboard.writeText(link);
      alert("Lien signaleur terrain copié !");
    } catch (err) {
      alert("Erreur lors de la copie du lien.");
    }
  };

  const addCheckpoint = async (race: Race) => {
    const name = prompt("Nom du point de passage ?");
    if (!name) return;
    const distanceStr = prompt("Distance (km) ?") || "0";
    const distance = parseFloat(distanceStr);
    
    const newCp: Checkpoint = {
      id: crypto.randomUUID(),
      name,
      distance,
      isMandatory: true
    };
    
    try {
      await updateDoc(doc(db, 'races', race.id), {
        checkpoints: [...race.checkpoints, newCp]
      });
    } catch (err: any) {
      alert("Erreur ajout checkpoint : " + err.message);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Gestion des Courses</h1>
          <p className="text-slate-500 font-medium">Configurez vos épreuves et points de passage</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-8 py-4 rounded-[2rem] font-black flex items-center gap-3 shadow-xl shadow-blue-100 hover:scale-105 transition-transform"
        >
          <Plus size={24} /> Nouvelle Course
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {races.map(race => (
          <div key={race.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl ${race.status === RaceStatus.RUNNING ? 'bg-emerald-500' : 'bg-slate-100'} text-white shadow-lg transition-colors`}>
                  <Flag size={24} className={race.status === RaceStatus.RUNNING ? 'text-white' : 'text-slate-400'} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase">{race.name}</h2>
                  <div className="flex gap-4 mt-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{race.distance} KM</span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{race.type}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                      race.status === RaceStatus.RUNNING ? 'bg-emerald-100 text-emerald-600' : 
                      race.status === RaceStatus.FINISHED ? 'bg-blue-100 text-blue-600' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {race.status}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                {resettingId === race.id ? (
                  <div className="p-4 bg-slate-100 text-slate-400 rounded-2xl flex items-center gap-2 font-black text-xs uppercase">
                    <Loader2 size={20} className="animate-spin" /> Reset...
                  </div>
                ) : (
                  <>
                    {race.status === RaceStatus.READY && (
                      <button 
                        onClick={() => startRace(race.id)} 
                        className="p-4 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 shadow-lg transition-all active:scale-90" 
                        title="Démarrer la course"
                      >
                        <Play size={20} />
                      </button>
                    )}
                    {race.status === RaceStatus.RUNNING && (
                      <button 
                        onClick={() => stopRace(race.id)} 
                        className="p-4 bg-red-500 text-white rounded-2xl hover:bg-red-600 shadow-lg transition-all active:scale-90" 
                        title="Arrêter la course"
                      >
                        <Square size={20} />
                      </button>
                    )}
                    {(race.status === RaceStatus.RUNNING || race.status === RaceStatus.FINISHED) && (
                      <button 
                        onClick={() => resetRace(race.id)} 
                        className="p-4 bg-amber-500 text-white rounded-2xl hover:bg-amber-600 shadow-lg transition-all active:scale-90" 
                        title="Réinitialiser la course"
                      >
                        <RotateCcw size={20} />
                      </button>
                    )}
                  </>
                )}
                <button 
                  onClick={() => deleteRace(race.id)} 
                  className="p-4 bg-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-colors" 
                  title="Supprimer"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            <div className="border-t border-slate-50 pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <MapPin size={16} /> Points de Passage ({race.checkpoints.length})
                </h3>
                <button 
                  onClick={() => addCheckpoint(race)} 
                  className="text-blue-600 text-xs font-black uppercase hover:underline"
                >
                  + Ajouter un point
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {race.checkpoints.map(cp => (
                  <div key={cp.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center hover:border-blue-200 transition-colors">
                    <div>
                      <p className="font-black text-slate-900 uppercase text-sm">{cp.name}</p>
                      <p className="text-[10px] font-bold text-slate-400">{cp.distance} KM</p>
                    </div>
                    <button 
                      onClick={() => generateShareLink(race.id, cp.id)}
                      className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                      title="Copier le lien signaleur"
                    >
                      <Share2 size={16} />
                    </button>
                  </div>
                ))}
                {race.checkpoints.length === 0 && (
                  <p className="text-slate-300 italic text-xs col-span-full">Aucun point de contrôle configuré</p>
                )}
              </div>
            </div>
          </div>
        ))}
        {races.length === 0 && (
          <div className="py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
             <Flag size={48} className="mx-auto text-slate-200 mb-4" />
             <p className="text-slate-400 font-bold uppercase tracking-widest">Aucune course configurée</p>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black text-slate-900 uppercase">Nouvelle Course</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><X size={24}/></button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nom de l'épreuve</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-xl outline-none focus:border-blue-500 transition-all"
                  value={newRace.name}
                  onChange={e => setNewRace({...newRace, name: e.target.value})}
                  placeholder="EX: TRAIL DES MINGUEN 12KM"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Distance (KM)</label>
                  <input 
                    type="number" 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black outline-none focus:border-blue-500 transition-all"
                    value={newRace.distance}
                    onChange={e => setNewRace({...newRace, distance: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</label>
                  <select 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black cursor-pointer outline-none focus:border-blue-500 transition-all"
                    value={newRace.type}
                    onChange={e => setNewRace({...newRace, type: e.target.value as RaceType})}
                  >
                    <option value={RaceType.GROUP}>DÉPART GROUPÉ</option>
                    <option value={RaceType.TIME_TRIAL}>CONTRE LA MONTRE</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-5 font-black text-slate-400 hover:text-slate-600 transition-colors">Annuler</button>
                <button onClick={handleAddRace} className="flex-1 bg-blue-600 text-white py-5 rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">Créer la course</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RacesView;