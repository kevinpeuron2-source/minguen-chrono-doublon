
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Flag, 
  Users, 
  Timer, 
  Trophy, 
  Settings,
  ShieldCheck,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import FirebaseErrorBanner from './FirebaseErrorBanner';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { dbError, isPermissionDenied } = useDatabase();
  
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
    { path: '/races', icon: Flag, label: 'Courses' },
    { path: '/participants', icon: Users, label: 'Participants' },
    { path: '/timing', icon: Timer, label: 'Chronométrage' },
    { path: '/results', icon: Trophy, label: 'Édition Résultats' },
    { path: '/signaleur', icon: ShieldCheck, label: 'Supervision Postes' },
    { path: '/admin', icon: Settings, label: 'Admin' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full z-20 transition-all duration-300">
        <div className="p-6">
          <div className="bg-white p-2 rounded-2xl mb-4 w-fit shadow-lg">
            <img 
              src="/logo.png" 
              alt="La Rand'eau Vive" 
              className="h-10 w-auto object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-blue-400 leading-none">
            MINGUEN <span className="text-white">CHRONO</span>
          </h1>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-[0.2em] font-black">by K. PEURON</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
                           (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-4 mt-4 border-t border-slate-800 space-y-2">
            <Link
              to="/live"
              target="_blank"
              className="flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-blue-400 hover:bg-blue-900/20 transition-all"
            >
              <ExternalLink size={18} />
              <span>Lien Live Public</span>
            </Link>
            <Link
              to="/remote-finish"
              target="_blank"
              className="flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-amber-400 hover:bg-amber-900/20 transition-all"
            >
              <Timer size={18} />
              <span>Terminal Saisie (+1)</span>
            </Link>
          </div>
        </nav>
        
        <div className="p-6 border-t border-slate-800 bg-slate-950/50 text-[10px] font-bold text-slate-600 uppercase tracking-tighter">
          Sync Firebase Active
        </div>
      </aside>

      <main className="flex-1 ml-64 p-8 transition-all duration-300">
        <FirebaseErrorBanner error={dbError} />
        {children}
      </main>
    </div>
  );
};

export default Layout;
