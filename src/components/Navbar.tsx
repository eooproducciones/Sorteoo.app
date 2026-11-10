import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles,
  User as UserIcon,
  Menu,
  X,
  ShieldCheck,
  PlusCircle,
  Gift,
  Trophy,
  LogOut,
  ChevronDown
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onNewGiveaway: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onNewGiveaway,
}) => {
  const { user, openAuthModal, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const navigateTo = (tab: string) => {
    setCurrentTab(tab);
    setMobileMenuOpen(false);
    setProfileDropdownOpen(false);
  };

  const handleStartGiveaway = () => {
    onNewGiveaway();
    setMobileMenuOpen(false);
    setProfileDropdownOpen(false);
  };

  // Close desktop dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 w-full max-w-full overflow-x-hidden shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
        {/* Brand Logo with New Cartoon Gift Mascot */}
        <button
          onClick={() => navigateTo('home')}
          className="text-xl sm:text-2xl font-black tracking-tight text-neutral-900 whitespace-nowrap shrink-0 flex items-center gap-2.5 focus:outline-none group cursor-pointer"
        >
          <img
            src="/assets/aistudio/Regalo_sonriente_con_lazo_y_destellos_f63477b8.png"
            alt="sorteoo logo"
            className="w-9 h-9 sm:w-10 sm:h-10 object-contain drop-shadow-sm group-hover:scale-105 transition-transform"
          />
          <div className="flex items-baseline">
            <span className="bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 bg-clip-text text-transparent font-black">
              sorteoo
            </span>
            <span className="text-neutral-900 font-black">.app</span>
          </div>
        </button>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-neutral-600">
          <button
            onClick={() => navigateTo('home')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'home' ? 'text-neutral-900 font-extrabold' : 'hover:text-neutral-900 text-neutral-600'
            }`}
          >
            Inicio
          </button>

          <button
            onClick={handleStartGiveaway}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'create'
                ? 'bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 text-white font-extrabold shadow-md shadow-rose-500/25'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Crear Sorteo</span>
          </button>

          <button
            onClick={() => navigateTo('verify')}
            className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'verify' ? 'text-neutral-900 font-extrabold' : 'hover:text-neutral-900 text-neutral-600'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Verificador</span>
          </button>
        </nav>

        {/* Desktop User Profile with Submenu & Mobile Hamburger Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Desktop User Profile Button with Dropdown Submenu */}
          <div className="hidden md:block relative" ref={dropdownRef}>
            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                    currentTab === 'profile' || currentTab === 'my-giveaways' || profileDropdownOpen
                      ? 'bg-neutral-100 border-rose-300 text-neutral-900 shadow-sm'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:text-neutral-900 hover:border-neutral-300'
                  }`}
                >
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-red-500 to-amber-500 flex items-center justify-center text-[10px] font-black text-white shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-bold max-w-[110px] truncate">
                    {user.name}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Submenu Dropdown */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white border border-neutral-200 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-2 border-b border-neutral-100 mb-1">
                      <span className="text-[11px] font-semibold text-neutral-400 block truncate">
                        Conectado como
                      </span>
                      <strong className="text-xs text-neutral-900 block truncate">
                        {user.email}
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigateTo('profile')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                        currentTab === 'profile' ? 'bg-rose-50 text-rose-600 font-bold' : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900'
                      }`}
                    >
                      <UserIcon className="w-4 h-4 text-rose-500" />
                      <span>Mi Perfil</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateTo('my-giveaways')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                        currentTab === 'my-giveaways' ? 'bg-rose-50 text-rose-600 font-bold' : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900'
                      }`}
                    >
                      <Trophy className="w-4 h-4 text-amber-500" />
                      <span>Mis Sorteos</span>
                    </button>

                    <div className="pt-1 mt-1 border-t border-neutral-100">
                      <button
                        type="button"
                        onClick={() => {
                          logout();
                          setProfileDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-rose-500 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Cerrar sesión</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigateTo('my-giveaways')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                    currentTab === 'my-giveaways'
                      ? 'bg-neutral-100 border-neutral-300 text-neutral-900'
                      : 'text-neutral-600 hover:text-neutral-900 border-transparent'
                  }`}
                >
                  Mis Sorteos
                </button>
                <button
                  onClick={() => openAuthModal('login')}
                  className="px-4 py-2 text-xs font-black text-white bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 hover:to-amber-600 rounded-xl shadow-md shadow-rose-500/20 transition-all whitespace-nowrap shrink-0 active:scale-95 cursor-pointer"
                >
                  Iniciar Sesión
                </button>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-neutral-100 border border-neutral-200 text-neutral-700 hover:text-neutral-900 focus:outline-none cursor-pointer"
            aria-label="Abrir menú de navegación"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-rose-500" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-neutral-200 bg-white px-4 py-4 space-y-2.5 shadow-xl animate-in slide-in-from-top-2 duration-150 w-full overflow-hidden">
          <button
            onClick={() => navigateTo('home')}
            className={`w-full text-left py-2.5 px-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between cursor-pointer ${
              currentTab === 'home' ? 'bg-neutral-100 text-neutral-900 font-bold' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <span>Inicio</span>
          </button>

          <button
            onClick={handleStartGiveaway}
            className="w-full text-center py-3 px-4 rounded-xl text-sm font-black bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 text-white shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>CREAR SORTEO</span>
          </button>

          <button
            onClick={() => navigateTo('verify')}
            className={`w-full text-left py-2.5 px-3 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2.5 cursor-pointer ${
              currentTab === 'verify' ? 'bg-neutral-100 text-neutral-900 font-bold' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Verificador</span>
          </button>

          {/* Profile & Mis Sorteos Section */}
          <div className="pt-2 border-t border-neutral-100 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-3 block">
              Tu Cuenta & Sorteos
            </span>

            {user ? (
              <div className="space-y-1">
                <button
                  onClick={() => navigateTo('profile')}
                  className={`w-full text-left py-2.5 px-3 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2.5 cursor-pointer ${
                    currentTab === 'profile' ? 'bg-neutral-100 text-neutral-900 font-bold' : 'text-neutral-700 hover:text-neutral-900'
                  }`}
                >
                  <UserIcon className="w-4 h-4 text-rose-500" />
                  <span>Mi Perfil ({user.name})</span>
                </button>

                <button
                  onClick={() => navigateTo('my-giveaways')}
                  className={`w-full text-left py-2.5 px-3 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2.5 cursor-pointer ${
                    currentTab === 'my-giveaways' ? 'bg-neutral-100 text-neutral-900 font-bold' : 'text-neutral-700 hover:text-neutral-900'
                  }`}
                >
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span>Mis Sorteos</span>
                </button>

                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left py-2 px-3 text-xs text-rose-500 hover:text-rose-600 font-medium flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => navigateTo('my-giveaways')}
                  className={`w-full text-left py-2.5 px-3 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2.5 cursor-pointer ${
                    currentTab === 'my-giveaways' ? 'bg-neutral-100 text-neutral-900 font-bold' : 'text-neutral-700 hover:text-neutral-900'
                  }`}
                >
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span>Mis Sorteos</span>
                </button>

                <button
                  onClick={() => {
                    openAuthModal('login');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-neutral-700 bg-neutral-100 border border-neutral-200 text-center hover:bg-neutral-200 transition-colors cursor-pointer"
                >
                  Iniciar Sesión / Registrarse
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
