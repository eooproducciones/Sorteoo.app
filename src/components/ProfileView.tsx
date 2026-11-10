import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  User,
  Mail,
  Calendar,
  LogOut,
  Save,
  Key,
  Shield,
  Instagram,
  CheckCircle2,
  ExternalLink,
  Info,
  Sparkles,
  Trophy,
  Settings
} from 'lucide-react';
import { MyGiveawaysView } from './MyGiveawaysView';
import { Giveaway } from '../types/giveaway';

interface ProfileViewProps {
  initialSubTab?: 'giveaways' | 'settings';
  onNewGiveaway?: () => void;
  onSelectGiveaway?: (giveaway: Giveaway) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  initialSubTab = 'giveaways',
  onNewGiveaway = () => {},
  onSelectGiveaway = () => {},
}) => {
  const { user, updateProfile, logout } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'giveaways' | 'settings'>(initialSubTab);

  const [name, setName] = useState(user?.name || '');
  const [appId, setAppId] = useState(user?.instagramConfig?.appId || '');
  const [accessToken, setAccessToken] = useState(user?.instagramConfig?.accessToken || '');
  const [sessionId, setSessionId] = useState(user?.instagramConfig?.sessionId || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile({
        name,
        instagramConfig: {
          appId,
          accessToken,
          sessionId,
          isConnected: Boolean((accessToken && accessToken.length > 10) || (sessionId && sessionId.length > 5)),
        },
      });
      setMessage('Perfil y credenciales guardados con éxito');
    } catch (err: any) {
      setMessage('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const registrationDate = new Date(user.createdAt).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-8 overflow-x-hidden">
      {/* Profile Header Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-7 mb-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-red-500 via-rose-500 to-amber-500 p-0.5 shadow-lg shrink-0">
            <div className="w-full h-full rounded-2xl bg-neutral-950 flex items-center justify-center overflow-hidden">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-xl sm:text-2xl font-black text-white">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white truncate">{user.name}</h1>
                <span className="text-xs text-rose-400 font-bold block mt-0.5">
                  Cuenta Oficial sorteoo.app
                </span>
              </div>
              <button
                onClick={logout}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl text-xs font-semibold transition-colors self-center sm:self-auto"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>Cerrar sesión</span>
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-neutral-400">
              <span className="flex items-center gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <span className="truncate">{user.email}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                Miembro desde {registrationDate}
              </span>
            </div>
          </div>
        </div>

        {/* Profile Submenu Navigation Tabs (User Request: "mis sorteos debe estar adentro del perfil como un submenu") */}
        <div className="mt-6 pt-5 border-t border-neutral-800/80 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('giveaways')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'giveaways'
                ? 'bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 text-white shadow-md shadow-rose-500/20'
                : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Mis Sorteos Realizados</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'settings'
                ? 'bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 text-white shadow-md shadow-rose-500/20'
                : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Ajustes & Credenciales</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-2 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* SUBTAB 1: MIS SORTEOS (Embedded directly in Profile view) */}
      {activeSubTab === 'giveaways' && (
        <div>
          <MyGiveawaysView
            onNewGiveaway={onNewGiveaway}
            onSelectGiveaway={onSelectGiveaway}
          />
        </div>
      )}

      {/* SUBTAB 2: AJUSTES Y CONFIGURACIÓN */}
      {activeSubTab === 'settings' && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-7 space-y-5">
            <h2 className="text-sm font-bold text-white border-b border-neutral-800 pb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-rose-400" />
              <span>Información Personal</span>
            </h2>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Nombre o Marca de Creador
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-rose-500 rounded-xl text-white text-xs focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full px-4 py-2.5 bg-neutral-950/50 border border-neutral-800/60 rounded-xl text-neutral-500 text-xs cursor-not-allowed font-mono"
              />
              <span className="text-[11px] text-neutral-500 mt-1 block">
                Vinculado a tus certificados de verificación.
              </span>
            </div>
          </div>

          {/* Meta Graph API settings */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-7 space-y-5">
            <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Instagram className="w-4 h-4 text-rose-400" />
                <span>Integración Meta & Instagram Graph API</span>
              </h2>
              <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded">
                Opcional
              </span>
            </div>

            <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-400 space-y-1.5 leading-relaxed">
              <p className="text-neutral-200 font-semibold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-400" />
                <span>¿Para qué sirve configurar la API oficial?</span>
              </p>
              <p>
                sorteoo.app funciona de forma automática con cualquier perfil público de Instagram sin credenciales. Si gestionas cuentas comerciales con millones de comentarios, puedes agregar tu Token oficial de Meta.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Meta App ID
                </label>
                <input
                  type="text"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="Ej: 108492048590123"
                  className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  User Access Token
                </label>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="EAA..."
                  className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 hover:to-amber-600 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-rose-500/20 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
