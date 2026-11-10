import React from 'react';

interface FooterProps {
  onNavigate: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-white border-t border-neutral-200 py-10 px-4 sm:px-6 w-full overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-center md:text-left flex items-center gap-3">
          <img
            src="/assets/aistudio/Regalo_sonriente_con_lazo_y_destellos_f63477b8.png"
            alt="sorteoo logo"
            className="w-9 h-9 object-contain drop-shadow-xs"
          />
          <div>
            <span className="text-lg font-black tracking-tight text-neutral-900 flex items-center justify-center md:justify-start">
              <span className="bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 bg-clip-text text-transparent">
                sorteoo
              </span>
              <span>.app</span>
            </span>
            <p className="text-xs text-neutral-500 mt-0.5">
              Sorteos certificados con video vertical automático para Reels y Stories.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-5 text-xs font-semibold text-neutral-600">
          <button onClick={() => onNavigate('home')} className="hover:text-neutral-900 transition-colors cursor-pointer">
            Inicio
          </button>
          <button onClick={() => onNavigate('create')} className="hover:text-neutral-900 transition-colors cursor-pointer">
            Crear Sorteo
          </button>
          <button onClick={() => onNavigate('profile')} className="hover:text-neutral-900 transition-colors cursor-pointer">
            Mis Sorteos
          </button>
          <button onClick={() => onNavigate('verify')} className="hover:text-neutral-900 transition-colors cursor-pointer">
            Verificador
          </button>
          <span className="text-neutral-300">·</span>
          <span className="text-neutral-400">© {new Date().getFullYear()} sorteoo.app</span>
        </div>
      </div>
    </footer>
  );
};
