import React, { useEffect, useState, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Race, Participant, RaceStatus, Passage } from '../types';
import { Trophy, Users, Activity, Flag, Edit3, Check, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
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

  const stats = [
    { label: 'Courses', value: races.length, icon: Flag, color: 'from-blue-600 to-blue-700', shadow: 'shadow-blue-200' },
    { label: 'Live', value: races.filter(r => r.status === RaceStatus.RUNNING).length, icon: Activity, color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-200' },
    { label: 'Inscrits', value: participants.length, icon: Users, color: 'from-indigo-600 to-violet-700', shadow: 'shadow-indigo-200' },
    { label: 'Passages', value: passages.length, icon: Trophy, color: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-200' },
  ];

  const chartData = races.map(r => ({
    name: r.name,
    count: participants.filter(p => p.raceId === r.id).length
  }));

  if (isPermissionDenied) return null;

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <header className="flex justify-between items-end">
        <div>
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
          <p className="text-slate-400 font-bold mt-2 uppercase tracking-[0.2em] text-xs">Aperçu global des performances en temps réel</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="group bg-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.02)] border border-slate-100 flex flex-col items-start space-y-4 hover:border-blue-200 hover:translate-y-[-5px] transition-all duration-300">
              <div className={`bg-gradient-to-br ${stat.color} p-4 rounded-2xl text-white ${stat.shadow} shadow-lg group-hover:scale-110 transition-transform`}>
                <Icon size={28} />
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-4xl font-black text-slate-900 mt-1">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.02)] border border-slate-100">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <Users size={24} className="text-blue-500" />
              Répartition des Athlètes
            </h2>
          </div>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 900}} 
                  dy={15}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 900}} 
                />
                <Tooltip 
                  cursor={{fill: '#f8fafc', radius: 12}}
                  contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', padding: '20px', fontWeight: 'bold'}}
                />
                <Bar dataKey="count" radius={[12, 12, 0, 0]} barSize={45}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#2563eb', '#4f46e5', '#7c3aed', '#9333ea'][index % 4]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-950 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          
          <h2 className="text-2xl font-black mb-8 flex items-center gap-3 relative z-10">
            <Activity size={24} className="text-emerald-400" />
            Live Feed
          </h2>
          <div className="space-y-4 relative z-10">
            {passages.sort((a,b) => b.timestamp - a.timestamp).slice(0, 7).map((p, idx) => (
              <div key={p.id} className="group flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-blue-500/30 transition-all duration-300">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-black text-lg border border-blue-500/20">
                    {p.bib}
                  </div>
                  <div>
                    <p className="font-black text-sm uppercase tracking-tight">{p.checkpointName}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">{new Date(p.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-700 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </div>
            ))}
            {passages.length === 0 && (
              <div className="text-center py-20 text-slate-600 flex flex-col items-center gap-4">
                <Activity size={40} className="opacity-20" />
                <p className="font-bold text-sm uppercase tracking-widest opacity-50">En attente de données...</p>
              </div>
            )}
          </div>
          
          {passages.length > 0 && (
            <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <button className="text-[10px] font-black text-blue-400 uppercase tracking-widest hover:text-white transition-colors">Voir tous les passages</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;