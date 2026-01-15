import React, { useEffect, useState, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Race, Participant, RaceStatus, Passage } from '../types';
import { Trophy, Users, Activity, Flag, Edit3, Check } from 'lucide-react';
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
      setDbError(null);
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
  }, [handleError, setDbError]);

  const saveEventName = async () => {
    try {
      await setDoc(doc(db, 'settings', 'event'), { name: eventName });
      setIsEditingName(false);
    } catch (err: any) {
      setDbError(err.message);
    }
  };

  const stats = [
    { label: 'Courses', value: races.length, icon: Flag, color: 'bg-blue-500' },
    { label: 'En direct', value: races.filter(r => r.status === RaceStatus.RUNNING).length, icon: Activity, color: 'bg-emerald-500' },
    { label: 'Participants', value: participants.length, icon: Users, color: 'bg-indigo-500' },
    { label: 'Passages CP', value: passages.length, icon: Trophy, color: 'bg-amber-500' },
  ];

  const chartData = races.map(r => ({
    name: r.name,
    count: participants.filter(p => p.raceId === r.id).length
  }));

  if (isPermissionDenied) return null;

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 group">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="text-3xl font-black text-slate-900 border-b-4 border-blue-500 outline-none bg-transparent w-full max-w-lg"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && saveEventName()}
                />
                <button onClick={saveEventName} className="p-2 bg-emerald-500 text-white rounded-xl shadow-lg hover:bg-emerald-600 transition-colors">
                  <Check size={20} />
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">{eventName}</h1>
                <button 
                  onClick={() => setIsEditingName(true)}
                  className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                >
                  <Edit3 size={18} />
                </button>
              </>
            )}
          </div>
          <p className="text-slate-500 font-medium mt-1">Tableau de bord de votre événement</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center space-x-4 hover:border-blue-100 transition-colors">
              <div className={`${stat.color} p-4 rounded-2xl text-white shadow-lg`}>
                <Icon size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <p className="text-3xl font-black text-slate-900">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h2 className="text-xl font-black mb-6 flex items-center gap-2">
            <Users size={20} className="text-blue-500" />
            Répartition par course
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px'}}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7'][index % 4]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <h2 className="text-xl font-black mb-6 flex items-center gap-2">
            <Activity size={20} className="text-emerald-500" />
            Activités récentes
          </h2>
          <div className="space-y-4">
            {passages.sort((a,b) => b.timestamp - a.timestamp).slice(0, 8).map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black">
                    {p.bib}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900">{p.checkpointName}</p>
                    <p className="text-xs text-slate-400 font-medium">{new Date(p.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
                <div className="text-right">
                   <p className="font-mono font-bold text-blue-600 text-sm">OK</p>
                </div>
              </div>
            ))}
            {passages.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                Aucune activité enregistrée
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;