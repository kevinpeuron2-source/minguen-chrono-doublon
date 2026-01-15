
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { MarshalPresence, Race } from '../types';
import { Shield, Signal, MapPin, User, Clock, AlertCircle } from 'lucide-react';

const SignaleurView: React.FC = () => {
  const [marshals, setMarshals] = useState<MarshalPresence[]>([]);
  const [races, setRaces] = useState<Race[]>([]);

  useEffect(() => {
    const unsubRaces = onSnapshot(collection(db, 'races'), snap => {
      setRaces(snap.docs.map(d => ({ id: d.id, ...d.data() } as Race)));
    });
    const unsubMarshals = onSnapshot(collection(db, 'active_marshals'), snap => {
      setMarshals(snap.docs.map(d => ({ id: d.id, ...d.data() } as MarshalPresence)));
    });
    return () => { unsubRaces(); unsubMarshals(); };
  }, []);

  const getStatus = (lastActive: number) => {
    const now = Date.now();
    if (now - lastActive < 30000) return 'online';
    if (now - lastActive < 120000) return 'away';
    return 'offline';
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Supervision Terrain</h1>
        <p className="text-slate-500 font-medium">État de connexion des signaleurs et des postes de contrôle</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {marshals.map((m) => {
          const status = getStatus(m.lastActive);
          const race = races.find(r => r.id === m.raceId);
          return (
            <div key={m.id} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl overflow-hidden relative">
              <div className={`absolute top-0 right-0 w-2 h-full ${
                status === 'online' ? 'bg-emerald-500' : status === 'away' ? 'bg-amber-500' : 'bg-slate-300'
              }`}></div>
              
              <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl ${status === 'online' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                  <Shield size={24} />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {status === 'online' ? 'Live' : 'Déconnecté'}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase">{m.name}</h3>
                  <p className="text-blue-600 font-bold text-sm flex items-center gap-2">
                    <MapPin size={14} /> {m.stationName}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-50 space-y-2">
                  <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase">
                    <span>Course assignée</span>
                    <span className="text-slate-900">{race?.name || 'Inconnue'}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase">
                    <span>Dernier signe de vie</span>
                    <span className="text-slate-900">{new Date(m.lastActive).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {marshals.length === 0 && (
          <div className="col-span-full py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
            <AlertCircle size={48} className="mb-4" />
            <p className="font-black uppercase tracking-widest">Aucun signaleur connecté pour le moment</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignaleurView;
