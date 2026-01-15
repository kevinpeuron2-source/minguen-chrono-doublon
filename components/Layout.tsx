import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Flag, 
  Users, 
  Timer, 
  Trophy, 
  Settings,
  ShieldCheck,
  ExternalLink,
  Menu,
  X
} from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import FirebaseErrorBanner from './FirebaseErrorBanner';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { dbError } = useDatabase();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Fermer le menu mobile lors d'un changement de page
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
    { path: '/races', icon: Flag, label: 'Épreuves' },
    { path: '/participants', icon: Users, label: 'Engagés' },
    { path: '/timing', icon: Timer, label: 'Chrono Direct' },
    { path: '/results', icon: Trophy, label: 'Résultats' },
    { path: '/signaleur', icon: ShieldCheck, label: 'Terrain' },
    { path: '/admin', icon: Settings, label: 'Configuration' },
  ];

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      {/* Overlay pour mobile - flou d'arrière-plan quand le menu est ouvert */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[40] lg:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Bouton Menu Mobile (visible uniquement sur mobile/tablette) */}
      <div className="lg:hidden fixed top-6 left-6 z-[60]">
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-4 bg-slate-950 text-white rounded-[1.25rem] shadow-2xl shadow-slate-900/40 hover:scale-105 active:scale-95 transition-all"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar - Fixe sur Desktop, Tiroir sur Mobile */}
      <aside className={`
        fixed h-full w-72 bg-slate-950 text-white flex flex-col z-[50] 
        shadow-[10px_0_40px_rgba(0,0,0,0.1)] transition-transform duration-500 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-8">
          <div className="bg-white p-3 rounded-[1.5rem] mb-6 w-fit shadow-2xl rotate-[-2deg] hover:rotate-0 transition-transform duration-500">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="h-12 w-auto object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-white leading-none">
            MINGUEN <span className="text-blue-500">CHRONO</span>
          </h1>
          <p className="text-[9px] text-slate-500 mt-2 uppercase tracking-[0.3em] font-black opacity-70">by K. PEURON</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto scrollbar-hide">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
                           (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group flex items-center space-x-3 px-6 py-4 rounded-[1.25rem] font-bold transition-all duration-300 relative overflow-hidden ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 translate-x-1' 
                    : 'text-slate-500 hover:text-white hover:bg-white/5'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-full my-3"></div>
                )}
                <Icon size={20} className={`${isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'} transition-colors`} />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-8 mt-8 border-t border-white/5 space-y-3 pb-8">
            <Link
              to="/live"
              target="_blank"
              className="flex items-center space-x-3 px-6 py-4 rounded-2xl font-bold text-blue-400 bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 transition-all"
            >
              <ExternalLink size={18} />
              <span className="text-sm">Public Live View</span>
            </Link>
            <Link
              to="/remote-finish"
              target="_blank"
              className="flex items-center space-x-3 px-6 py-4 rounded-2xl font-bold text-amber-400 bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 transition-all"
            >
              <Timer size={18} />
              <span className="text-sm">Terminal Saisie</span>
            </Link>
          </div>
        </nav>
        
        <div className="p-8 border-t border-white/5 bg-black/20">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cloud Engine Active</span>
          </div>
          <p className="text-[8px] text-slate-600 mt-2 font-bold italic uppercase">BY K. PEURON • v2.5 PRO</p>
        </div>
      </aside>

      {/* Zone de contenu principal */}
      <main className={`
        flex-1 p-6 md:p-10 transition-all duration-300 min-h-screen
        ${isMobileMenuOpen ? 'blur-sm lg:blur-none' : ''}
        lg:ml-72
      `}>
        <div className="max-w-7xl mx-auto pt-20 lg:pt-0">
          <FirebaseErrorBanner error={dbError} />
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;