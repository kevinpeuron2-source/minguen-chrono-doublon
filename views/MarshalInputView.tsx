import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, doc, setDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { Race, Participant, Passage, MarshalPresence } from '../types';
import { MapPin, Shield, User, Send, CheckCircle2, Timer } from 'lucide-react';

const MarshalInputView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [isRegistered, setIsRegistered] = useState(false);
  const [marshalName, setMarshalName] = useState('');
  const [bibInput, setBibInput] = useState('');
  const [races, setRaces] = useState<Race[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [recentPassages, setRecentPassages] = useState<Passage[]>([]);
  
  const raceId = searchParams.get('raceId') || '';
  const cpId = searchParams.get('cpId') || '';
  const marshalId = useRef(crypto.randomUUID());

  useEffect(() => {
    onSnapshot(collection(db, 'races'), snap => {
      setRaces(snap.docs.map(d => ({ id: d.id, ...d.data() } as Race)));
    });
    if (raceId) {
      onSnapshot(query(collection(db, 'participants'), where('raceId', '==', raceId)), snap => {
        setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Participant)));
      });
    }
  }, [raceId]);

  useEffect(() => {
    if (!isRegistered) return;
    const interval = setInterval(async () => {
      const race = races.find(r => r.id === raceId);
      const cp = race?.checkpoints.find(c => c.id === cpId);
      await setDoc(doc(db, 'active_marshals', marshalId.current), {
        id: marshalId.current,
        name: marshalName,
        stationName: cp?.name || 'Poste',
        raceId,
        checkpointId: cpId,
        lastActive: Date.now()
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [isRegistered, marshalName, raceId, cpId, races]);

  const handlePointage = async () => {
    const part = participants.find(p => p.bib === bibInput);
    const race = races.find(r => r.id === raceId);
    if (!part || !race) return;

    const timestamp = Date.now();
    const netTime = timestamp - (part.startTime || race.startTime || timestamp);

    await addDoc(collection(db, 'passages'), {
      participantId: part.id,
      bib: part.bib,
      checkpointId: cpId,
      checkpointName: race.checkpoints.find(c => c.id === cpId)?.name || 'CP',
      timestamp,
      netTime
    });
    setBibInput('');
  };

  if (!isRegistered) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl">
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center text-white mb-6 shadow-xl">
            <Shield size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Identification Signaleur</h2>
          <p className="text-slate-500 mb-8 font-medium">Votre nom apparaîtra au PC Course pour la supervision.</p>
          <input 
            type="text" 
            placeholder="Votre Prénom / Nom"
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black mb-4 outline-none focus:border-blue-500"
            value={marshalName}
            onChange={e => setMarshalName(e.target.value)}
          />
          <button 
            disabled={!marshalName}
            onClick={() => setIsRegistered(true)}
            className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black shadow-lg disabled:opacity-50"
          >
            ACTIVER MON POSTE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6">
      <div className="max-w-md mx-auto w-full space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center justify-between">
           <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-pulse">
               <CheckCircle2 size={20} />
             </div>
             <div>
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Poste actif</p>
               <p className="font-black text-slate-900 uppercase">{marshalName}</p>
             </div>
           </div>
        </div>

        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl text-center">
           <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4 block">Saisie Dossard</span>
           <input 
             type="number" 
             className="w-full bg-transparent text-center text-8xl font-black mono outline-none border-b-2 border-slate-800 focus:border-blue-500 mb-8"
             value={bibInput}
             onChange={e => setBibInput(e.target.value)}
             placeholder="000"
             onKeyDown={e => e.key === 'Enter' && handlePointage()}
           />
           <button 
            onClick={handlePointage}
            className="w-full bg-blue-600 py-6 rounded-3xl font-black text-xl shadow-xl shadow-blue-900 active:scale-95 transition-all flex items-center justify-center gap-3"
           >
             VALIDER PASSAGE <Send size={24} />
           </button>
        </div>

        <div className="text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
           by K. PEURON
        </div>
      </div>
    </div>
  );
};

export default MarshalInputView;