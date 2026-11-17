import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  User as UserIcon,
  Menu,
  X,
  ShieldCheck,
  PlusCircle,
  Trophy,
  LogOut,
  ChevronDown,
  KeyRound,
  LogIn,
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
  const isAdmin = Boolean(
    user && (user.role === 'admin' || user.email?.toLowerCase() === 'admin@sorteoo.app')
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

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

  // Close menus on outside pointer click or Escape
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setProfileDropdownOpen(false);
      }
      if (headerRef.current && !headerRef.current.contains(target)) {
        setMobileMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 w-full shadow-xs"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3 px-4 sm:px-6 py-3">
        {/* Brand Logo */}
        <button
          type="button"
          onClick={() => navigateTo('home')}
          className="text-xl sm:text-2xl font-black tracking-tight text-neutral-900 whitespace-nowrap shrink-0 flex items-center gap-2 focus:outline-none group cursor-pointer"
        >
          <img
            src="/assets/aistudio/Regalo_sonriente_con_lazo_y_destellos_f63477b8.png"
            alt="sorteoo logo"
            className="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-sm group-hover:scale-105 transition-transform"
          />
          <div className="flex items-baseline">
            <span className="bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 bg-clip-text text-transparent font-black">
              sorteoo
            </span>
            <span className="text-neutral-900 font-black">.app</span>
          </div>
        </button>

        {/* Desktop & Tablet Primary Actions */}
        <nav className="hidden md:flex items-center gap-5 text-xs font-bold text-neutral-600">
          <button
            type="button"
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
            type="button"
            onClick={() => navigateTo('verify')}
            className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'verify' ? 'text-neutral-900 font-extrabold' : 'hover:text-neutral-900 text-neutral-600'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Verificador</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => navigateTo('admin')}
              className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                currentTab === 'admin' ? 'text-neutral-900 font-extrabold' : 'hover:text-neutral-900 text-neutral-600'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-sky-600" />
              <span>Panel Admin</span>
            </button>
          )}
        </nav>

        {/* Desktop & Tablet Account Menu + Mobile Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Desktop / Tablet Profile Dropdown */}
          <div className="hidden md:block relative" ref={dropdownRef}>
            {user ? (
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={profileDropdownOpen}
                  aria-haspopup="menu"
                  onClick={() => setProfileDropdownOpen((prev) => !prev)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                    currentTab === 'profile' || currentTab === 'my-giveaways' || profileDropdownOpen
                      ? 'bg-neutral-100 border-rose-300 text-neutral-900 shadow-sm'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:text-neutral-900 hover:border-neutral-300'
                  }`}
                >
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-red-500 to-amber-500 flex items-center justify-center text-[10px] font-black text-white shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-bold max-w-[120px] truncate">
                    {user.name}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-neutral-500 transition-transform ${
                      profileDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {profileDropdownOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-52 bg-white border border-neutral-200 rounded-2xl shadow-2xl p-1.5 z-[80]"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => navigateTo('profile')}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                        currentTab === 'profile'
                          ? 'bg-rose-50 text-rose-600 font-bold'
                          : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900'
                      }`}
                    >
                      <UserIcon className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>Mi perfil</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => navigateTo('my-giveaways')}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                        currentTab === 'my-giveaways'
                          ? 'bg-rose-50 text-rose-600 font-bold'
                          : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900'
                      }`}
                    >
                      <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Mis sorteos</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => navigateTo('verify')}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                        currentTab === 'verify'
                          ? 'bg-emerald-50 text-emerald-700 font-bold'
                          : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Verificador</span>
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => navigateTo('admin')}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                          currentTab === 'admin'
                            ? 'bg-sky-50 text-sky-700 font-bold'
                            : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900'
                        }`}
                      >
                        <KeyRound className="w-4 h-4 text-sky-600 shrink-0" />
                        <span>Panel Admin</span>
                      </button>
                    )}

                    <div className="pt-1 mt-1 border-t border-neutral-100">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          logout();
                          setProfileDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 shrink-0" />
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
                  Mis sorteos
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="px-4 py-2 text-xs font-black text-white bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 hover:to-amber-600 rounded-xl shadow-md shadow-rose-500/20 transition-all whitespace-nowrap shrink-0 active:scale-95 cursor-pointer"
                >
                  Iniciar sesión
                </button>
              </div>
            )}
          </div>

          {/* Mobile Quick Create + Hamburger Toggle */}
          <button
            type="button"
            onClick={handleStartGiveaway}
            className="md:hidden px-3 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 text-white shadow-sm flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Crear</span>
          </button>

          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-label="Abrir menú"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-xl bg-neutral-100 border border-neutral-200 text-neutral-700 hover:text-neutral-900 focus:outline-none cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-rose-500" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Clean Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute inset-x-0 top-full border-t border-b border-neutral-200 bg-white px-4 py-3 space-y-1 shadow-2xl z-[80]">
          {user ? (
            <>
              <button
                type="button"
                onClick={() => navigateTo('profile')}
                className={`w-full text-left py-3 px-3.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-3 cursor-pointer ${
                  currentTab === 'profile'
                    ? 'bg-rose-50 text-rose-600'
                    : 'text-neutral-800 hover:bg-neutral-50'
                }`}
              >
                <UserIcon className="w-4 h-4 text-rose-500 shrink-0" />
                <span>Mi perfil</span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo('my-giveaways')}
                className={`w-full text-left py-3 px-3.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-3 cursor-pointer ${
                  currentTab === 'my-giveaways'
                    ? 'bg-rose-50 text-rose-600'
                    : 'text-neutral-800 hover:bg-neutral-50'
                }`}
              >
                <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Mis sorteos</span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo('verify')}
                className={`w-full text-left py-3 px-3.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-3 cursor-pointer ${
                  currentTab === 'verify'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-neutral-800 hover:bg-neutral-50'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Verificador</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => navigateTo('admin')}
                  className={`w-full text-left py-3 px-3.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-3 cursor-pointer ${
                    currentTab === 'admin'
                      ? 'bg-sky-50 text-sky-700'
                      : 'text-neutral-800 hover:bg-neutral-50'
                  }`}
                >
                  <KeyRound className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>Panel Admin</span>
                </button>
              )}

              <div className="pt-1.5 mt-1.5 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left py-3 px-3.5 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-3 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigateTo('my-giveaways')}
                className={`w-full text-left py-3 px-3.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-3 cursor-pointer ${
                  currentTab === 'my-giveaways'
                    ? 'bg-rose-50 text-rose-600'
                    : 'text-neutral-800 hover:bg-neutral-50'
                }`}
              >
                <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Mis sorteos</span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo('verify')}
                className={`w-full text-left py-3 px-3.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-3 cursor-pointer ${
                  currentTab === 'verify'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-neutral-800 hover:bg-neutral-50'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Verificador</span>
              </button>

              <div className="pt-1.5 mt-1.5 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => {
                    openAuthModal('login');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-3 px-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-4 h-4 shrink-0" />
                  <span>Iniciar sesión</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
};
