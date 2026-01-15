import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Participant, Race, ParticipantStatus, RaceType, RaceStatus } from '../types';
import { Users, Search, Filter, Trash2, Edit2, UserPlus, X, CheckCircle2, AlertCircle, FileUp, ArrowRight, Settings2, Sparkles } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import { parseCSV } from '../utils/csv';

const ParticipantsView: React.FC = () => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRaceId, setSelectedRaceId] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const { setDbError } = useDatabase();

  // CSV Import States
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importLoading, setImportLoading] = useState(false);

  const [newPart, setNewPart] = useState<Partial<Participant>>({
    bib: '', firstName: '', lastName: '', gender: 'M', category: 'SENIOR', club: '', status: ParticipantStatus.REGISTERED, raceId: ''
  });

  const handleError = useCallback((err: any) => {
    setDbError(err.message);
  }, [setDbError]);

  useEffect(() => {
    const unsubRaces = onSnapshot(collection(db, 'races'), (snap) => {
      setRaces(snap.docs.map(d => ({ id: d.id, ...d.data() } as Race)));
    }, handleError);

    const unsubParts = onSnapshot(collection(db, 'participants'), (snap) => {
      setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Participant)));
    }, handleError);

    return () => { unsubRaces(); unsubParts(); };
  }, [handleError]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const data = parseCSV(text);
      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        setCsvHeaders(headers);
        setCsvData(data);
        
        const autoMap: Record<string, string> = {};
        const fields = ['bib', 'lastName', 'firstName', 'gender', 'category', 'club', 'race'];
        const synonyms: Record<string, string[]> = {
          bib: ['dossard', 'bib', 'num', 'n°'],
          lastName: ['nom', 'lastname', 'name'],
          firstName: ['prenom', 'firstname'],
          gender: ['sexe', 'gender', 's'],
          category: ['categorie', 'category', 'cat'],
          club: ['club', 'equipe', 'team'],
          race: ['course', 'épreuve', 'distance', 'race']
        };

        fields.forEach(field => {
          const match = headers.find(h => 
            h.toLowerCase() === field.toLowerCase() || 
            synonyms[field]?.some(s => h.toLowerCase().includes(s))
          );
          if (match) autoMap[field] = match;
        });

        setMapping(autoMap);
        setShowMappingModal(true);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const executeImport = async () => {
    setImportLoading(true);
    try {
      const batch = writeBatch(db);
      const raceMap = new Map<string, string>();
      races.forEach(r => raceMap.set(r.name.toLowerCase(), r.id));

      for (const row of csvData) {
        let raceId = '';
        const raceValue = row[mapping.race];

        if (raceValue) {
          const existingId = raceMap.get(String(raceValue).toLowerCase());
          if (existingId) {
            raceId = existingId;
          } else {
            const newRaceRef = await addDoc(collection(db, 'races'), {
              name: String(raceValue),
              distance: parseFloat(String(raceValue).match(/\d+/)?.[0] || '10'),
              status: RaceStatus.READY,
              type: RaceType.GROUP,
              checkpoints: []
            });
            raceId = newRaceRef.id;
            raceMap.set(String(raceValue).toLowerCase(), raceId);
          }
        } else if (races.length > 0) {
          raceId = races[0].id;
        }

        const pRef = doc(collection(db, 'participants'));
        batch.set(pRef, {
          bib: String(row[mapping.bib] || ''),
          lastName: String(row[mapping.lastName] || '').toUpperCase(),
          firstName: String(row[mapping.firstName] || ''),
          gender: String(row[mapping.gender] || 'M').toUpperCase().startsWith('F') ? 'F' : 'M',
          category: String(row[mapping.category] || 'SENIOR').toUpperCase(),
          club: String(row[mapping.club] || ''),
          raceId: raceId,
          status: ParticipantStatus.REGISTERED
        });
      }

      await batch.commit();
      setShowMappingModal(false);
      alert(`${csvData.length} participants importés avec succès !`);
    } catch (err: any) {
      alert("Erreur lors de l'import : " + err.message);
    } finally {
      setImportLoading(false);
    }
  };

  const handleSave = async () => {
    if (!newPart.bib || !newPart.lastName || !newPart.raceId) {
      alert("Dossard, Nom et Course obligatoires");
      return;
    }

    try {
      if (editingId) {
        const partRef = doc(db, 'participants', editingId);
        await updateDoc(partRef, {
          bib: newPart.bib,
          firstName: newPart.firstName,
          lastName: newPart.lastName?.toUpperCase(),
          gender: newPart.gender,
          category: newPart.category?.toUpperCase(),
          club: newPart.club,
          raceId: newPart.raceId,
          status: newPart.status
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'participants'), { 
          ...newPart, 
          lastName: newPart.lastName?.toUpperCase(),
          category: newPart.category?.toUpperCase(),
          status: ParticipantStatus.REGISTERED 
        });
      }
      setShowAddModal(false);
      setNewPart({ bib: '', firstName: '', lastName: '', gender: 'M', category: 'SENIOR', club: '', status: ParticipantStatus.REGISTERED, raceId: '' });
    } catch (err: any) {
      alert("Erreur lors de l'enregistrement : " + err.message);
    }
  };

  const openEditModal = (p: Participant) => {
    setNewPart({
      bib: p.bib,
      firstName: p.firstName,
      lastName: p.lastName,
      gender: p.gender,
      category: p.category,
      club: p.club || '',
      raceId: p.raceId,
      status: p.status
    });
    setEditingId(p.id);
    setShowAddModal(true);
  };

  const deleteParticipant = async (id: string) => {
    if (confirm("Supprimer ce participant ?")) {
      await deleteDoc(doc(db, 'participants', id));
    }
  };

  const filteredParticipants = participants.filter(p => {
    const matchesSearch = `${p.firstName} ${p.lastName} ${p.bib}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRace = selectedRaceId === 'all' || p.raceId === selectedRaceId;
    return matchesSearch && matchesRace;
  }).sort((a, b) => {
    const bibA = parseInt(a.bib) || 0;
    const bibB = parseInt(b.bib) || 0;
    return bibA - bibB;
  });

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Gestion des Engagés</h1>
          <p className="text-slate-500 font-medium">Contrôle et import de la base de données coureurs</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <label className="flex-1 md:flex-initial bg-white border-2 border-slate-100 text-slate-600 px-6 py-4 rounded-[2rem] font-black flex items-center justify-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors shadow-sm">
            <FileUp size={20} /> Importer CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>
          <button 
            onClick={() => {
              setEditingId(null);
              setNewPart({ bib: '', firstName: '', lastName: '', gender: 'M', category: 'SENIOR', club: '', status: ParticipantStatus.REGISTERED, raceId: races.length > 0 ? races[0].id : '' });
              setShowAddModal(true);
            }}
            className="flex-1 md:flex-initial bg-blue-600 text-white px-8 py-4 rounded-[2rem] font-black flex items-center justify-center gap-3 shadow-xl shadow-blue-100 hover:scale-105 transition-transform"
          >
            <UserPlus size={24} /> Ajouter
          </button>
        </div>
      </header>

      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
          <input 
            type="text" 
            placeholder="Nom, prénom ou n° de dossard..."
            className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl pl-14 pr-6 py-4 font-bold text-slate-900 outline-none focus:border-blue-500 transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Filter className="text-slate-300" size={20} />
          <select 
            className="bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 py-4 font-bold text-slate-900 outline-none focus:border-blue-500 transition-all cursor-pointer"
            value={selectedRaceId}
            onChange={e => setSelectedRaceId(e.target.value)}
          >
            <option value="all">Toutes les épreuves</option>
            {races.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                <th className="py-6 px-8">Dossard</th>
                <th className="py-6 px-6">Concurrent</th>
                <th className="py-6 px-6">Épreuve</th>
                <th className="py-6 px-6">Catégorie</th>
                <th className="py-6 px-6">Statut</th>
                <th className="py-6 px-8 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredParticipants.map(p => {
                const race = races.find(r => r.id === p.raceId);
                return (
                  <tr key={p.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-6 px-8">
                      <span className="text-2xl font-black mono text-blue-600">#{p.bib}</span>
                    </td>
                    <td className="py-6 px-6">
                      <div className="font-black text-slate-900 uppercase leading-tight">{p.lastName} {p.firstName}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{p.club || 'Individuel'}</div>
                    </td>
                    <td className="py-6 px-6">
                       <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-3 py-1 rounded-full uppercase">
                         {race?.name || 'Non assignée'}
                       </span>
                    </td>
                    <td className="py-6 px-6">
                       <div className="flex gap-2">
                         <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${p.gender === 'F' ? 'bg-pink-50 text-pink-600' : 'bg-blue-50 text-blue-600'}`}>{p.gender}</span>
                         <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">{p.category}</span>
                       </div>
                    </td>
                    <td className="py-6 px-6">
                      <div className="flex items-center gap-2">
                        {p.status === ParticipantStatus.FINISHED ? (
                          <div className="flex items-center gap-1.5 text-emerald-500 font-black text-[10px] uppercase">
                            <CheckCircle2 size={14} /> Arrivé
                          </div>
                        ) : p.status === ParticipantStatus.DNF ? (
                          <div className="flex items-center gap-1.5 text-red-500 font-black text-[10px] uppercase">
                            <AlertCircle size={14} /> Abandon
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-400 font-black text-[10px] uppercase">
                            <div className="w-2 h-2 rounded-full bg-slate-300"></div> En attente
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-6 px-8 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openEditModal(p)}
                          className="p-3 bg-slate-100 text-slate-400 hover:text-blue-600 rounded-xl transition-colors"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => deleteParticipant(p.id)}
                          className="p-3 bg-slate-100 text-slate-400 hover:text-red-500 rounded-xl transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showMappingModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3.5rem] p-12 w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-10">
              <div>
                <h2 className="text-4xl font-black text-slate-900 flex items-center gap-4">
                  <Sparkles className="text-blue-500" size={36} /> Assistant d'Import
                </h2>
                <p className="text-slate-500 font-medium mt-2">Liez les colonnes de votre fichier aux champs de Minguen Chrono</p>
              </div>
              <button onClick={() => setShowMappingModal(false)} className="p-4 hover:bg-slate-100 rounded-full text-slate-400"><X size={32}/></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              {[
                { id: 'bib', label: 'Dossard', icon: '#' },
                { id: 'lastName', label: 'Nom de famille', icon: 'N' },
                { id: 'firstName', label: 'Prénom', icon: 'P' },
                { id: 'gender', label: 'Sexe (M/F)', icon: 'S' },
                { id: 'category', label: 'Catégorie', icon: 'C' },
                { id: 'club', label: 'Club / Team', icon: 'T' },
                { id: 'race', label: 'Course / Distance', icon: 'R' },
              ].map(field => (
                <div key={field.id} className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center font-black">{field.icon}</span>
                    Champ {field.label}
                  </label>
                  <select 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-900 outline-none focus:border-blue-500 transition-all cursor-pointer"
                    value={mapping[field.id] || ''}
                    onChange={e => setMapping({...mapping, [field.id]: e.target.value})}
                  >
                    <option value="">-- Ignorer ce champ --</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-12 p-6 bg-blue-50 rounded-[2rem] border border-blue-100 flex items-center gap-4">
               <Settings2 size={24} className="text-blue-600" />
               <p className="text-sm font-bold text-blue-800">
                 <strong>Magie de Minguen :</strong> Si la colonne "Course" contient de nouveaux noms, ils seront créés automatiquement dans votre liste d'épreuves.
               </p>
            </div>

            <div className="flex gap-6 mt-12">
              <button onClick={() => setShowMappingModal(false)} className="flex-1 py-6 font-black text-slate-400 text-xl">Annuler</button>
              <button 
                onClick={executeImport} 
                disabled={importLoading || !mapping.bib || !mapping.lastName}
                className="flex-2 bg-blue-600 text-white px-12 py-6 rounded-[2rem] font-black text-xl shadow-2xl shadow-blue-200 hover:scale-105 transition-transform disabled:opacity-30 flex items-center justify-center gap-4"
              >
                {importLoading ? 'Importation en cours...' : <>Lancer l'importation <ArrowRight size={24} /></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black text-slate-900">{editingId ? 'Modifier le Concurrent' : 'Nouveau Concurrent'}</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={24}/></button>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2 col-span-2 md:col-span-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dossard</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-2xl text-blue-600 outline-none focus:border-blue-500"
                  value={newPart.bib}
                  onChange={e => setNewPart({...newPart, bib: e.target.value})}
                  placeholder="000"
                />
              </div>
              <div className="space-y-2 col-span-2 md:col-span-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Épreuve</label>
                <select 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-lg outline-none focus:border-blue-500"
                  value={newPart.raceId}
                  onChange={e => setNewPart({...newPart, raceId: e.target.value})}
                >
                  <option value="">Choisir...</option>
                  {races.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              <div className="space-y-2 col-span-2 md:col-span-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nom</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black outline-none focus:border-blue-500 uppercase"
                  value={newPart.lastName}
                  onChange={e => setNewPart({...newPart, lastName: e.target.value})}
                  placeholder="NOM"
                />
              </div>
              <div className="space-y-2 col-span-2 md:col-span-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prénom</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black outline-none focus:border-blue-500"
                  value={newPart.firstName}
                  onChange={e => setNewPart({...newPart, firstName: e.target.value})}
                  placeholder="Prénom"
                />
              </div>

              <div className="space-y-2 col-span-2 md:col-span-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sexe</label>
                <select 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black outline-none focus:border-blue-500"
                  value={newPart.gender}
                  onChange={e => setNewPart({...newPart, gender: e.target.value})}
                >
                  <option value="M">Masculin (M)</option>
                  <option value="F">Féminin (F)</option>
                </select>
              </div>
              <div className="space-y-2 col-span-2 md:col-span-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Catégorie</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black outline-none focus:border-blue-500 uppercase"
                  value={newPart.category}
                  onChange={e => setNewPart({...newPart, category: e.target.value})}
                  placeholder="SENIOR, V1, ESP..."
                />
              </div>

              <div className="space-y-2 col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Club / Équipe</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black outline-none focus:border-blue-500"
                  value={newPart.club}
                  onChange={e => setNewPart({...newPart, club: e.target.value})}
                  placeholder="Nom du club ou individuel"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-10">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-5 font-black text-slate-400 hover:bg-slate-50 rounded-2xl">Annuler</button>
              <button 
                onClick={handleSave} 
                className="flex-1 bg-blue-600 text-white py-5 rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
              >
                {editingId ? 'Mettre à jour' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParticipantsView;