import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  User,
  Mail,
  Calendar,
  LogOut,
  Save,
  Instagram,
  CheckCircle2,
  Info,
  Trophy,
  Settings,
  LogIn
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
  const { user, updateProfile, logout, openAuthModal } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'giveaways' | 'settings'>(initialSubTab);

  const [name, setName] = useState(user?.name || '');
  const [appId, setAppId] = useState(user?.instagramConfig?.appId || '');
  const [accessToken, setAccessToken] = useState(user?.instagramConfig?.accessToken || '');
  const [sessionId] = useState(user?.instagramConfig?.sessionId || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAppId(user.instagramConfig?.appId || '');
      setAccessToken(user.instagramConfig?.accessToken || '');
    }
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white border border-neutral-200 rounded-3xl p-8 sm:p-10 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-500 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-neutral-900 mb-2">
            Iniciá sesión en tu cuenta
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600 max-w-md mx-auto mb-6">
            Accedé a tu perfil para guardar y ver todos tus sorteos y videos desde cualquier dispositivo.
          </p>
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-95 text-white text-xs sm:text-sm font-black rounded-xl shadow-lg shadow-rose-500/20 transition-all cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Iniciar Sesión / Registrarse</span>
          </button>
        </div>
      </div>
    );
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
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-8 overflow-x-hidden">
      {/* Profile Header Card */}
      <div className="bg-white border border-neutral-200 rounded-3xl p-5 sm:p-7 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] p-0.5 shadow-lg shrink-0">
            <div className="w-full h-full rounded-2xl bg-white flex items-center justify-center overflow-hidden">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-xl sm:text-2xl font-black text-neutral-900">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-neutral-900 truncate">{user.name}</h1>
                <span className="text-xs text-rose-600 font-bold block mt-0.5">
                  Cuenta Oficial sorteoo.app
                </span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 rounded-xl text-xs font-semibold transition-colors self-center sm:self-auto cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-500" />
                <span>Cerrar sesión</span>
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-neutral-500">
              <span className="flex items-center gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span className="truncate">{user.email}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                Miembro desde {registrationDate}
              </span>
            </div>
          </div>
        </div>

        {/* Profile Submenu Navigation Tabs */}
        <div className="mt-6 pt-5 border-t border-neutral-100 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('giveaways')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'giveaways'
                ? 'bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white shadow-md shadow-rose-500/20'
                : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Mis Sorteos Realizados</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'settings'
                ? 'bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white shadow-md shadow-rose-500/20'
                : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Ajustes & Credenciales</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {/* SUBTAB 1: MIS SORTEOS */}
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
          <div className="bg-white border border-neutral-200 rounded-3xl p-5 sm:p-7 space-y-5 shadow-sm">
            <h2 className="text-sm font-bold text-neutral-900 border-b border-neutral-100 pb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-rose-500" />
              <span>Información Personal</span>
            </h2>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Nombre o Marca de Creador
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 focus:border-rose-500 rounded-xl text-neutral-900 text-xs focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full px-4 py-2.5 bg-neutral-100 border border-neutral-200 rounded-xl text-neutral-500 text-xs cursor-not-allowed font-mono"
              />
              <span className="text-[11px] text-neutral-500 mt-1 block">
                Vinculado a tus certificados de verificación.
              </span>
            </div>
          </div>

          {/* Meta Graph API settings */}
          <div className="bg-white border border-neutral-200 rounded-3xl p-5 sm:p-7 space-y-5 shadow-sm">
            <div className="border-b border-neutral-100 pb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Instagram className="w-4 h-4 text-rose-500" />
                <span>Integración Meta & Instagram Graph API</span>
              </h2>
              <span className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                Opcional
              </span>
            </div>

            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-600 space-y-1.5 leading-relaxed">
              <p className="text-neutral-900 font-semibold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-500" />
                <span>¿Para qué sirve configurar la API oficial?</span>
              </p>
              <p>
                sorteoo.app funciona de forma automática con cualquier perfil público de Instagram sin credenciales. Si gestionas cuentas comerciales con millones de comentarios, puedes agregar tu Token oficial de Meta.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Meta App ID
                </label>
                <input
                  type="text"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="Ej: 108492048590123"
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 text-xs font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  User Access Token
                </label>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="EAA..."
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 text-xs font-mono focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-95 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-rose-500/20 transition-all active:scale-95 cursor-pointer"
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
