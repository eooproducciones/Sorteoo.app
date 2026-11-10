import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { X, Mail, Lock, User, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { authModalOpen, authModalMode, closeAuthModal, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(authModalMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!authModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else if (mode === 'register') {
        if (!name.trim()) throw new Error('Por favor introduce tu nombre');
        await register(name, email, password);
      } else if (mode === 'forgot') {
        const res = await api.forgotPassword(email);
        setSuccessMsg(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Error en la solicitud');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = () => {
    setEmail('demo@sorteoo.app');
    setPassword('sorteoo123');
    setMode('login');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-white rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand & Title */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-extrabold text-white">
            <span className="bg-gradient-to-r from-rose-500 to-indigo-500 bg-clip-text text-transparent">
              sorteoo
            </span>
            .app
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            {mode === 'login' && 'Inicia sesión para gestionar tus sorteos'}
            {mode === 'register' && 'Crea tu cuenta gratuita de creador'}
            {mode === 'forgot' && 'Recupera el acceso a tu cuenta'}
          </p>
        </div>

        {/* Quick Demo Button */}
        {mode === 'login' && (
          <div className="mb-4">
            <button
              type="button"
              onClick={fillDemoAccount}
              className="w-full py-2 px-3 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-xs text-neutral-300 rounded-xl flex items-center justify-between transition-colors"
            >
              <span>Probar con cuenta Demo (1 clic)</span>
              <span className="font-mono text-rose-400 font-semibold">demo@sorteoo.app</span>
            </button>
          </div>
        )}

        {/* Tabs for Login / Register */}
        {mode !== 'forgot' && (
          <div className="flex p-1 bg-neutral-950 rounded-xl border border-neutral-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                mode === 'login' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                mode === 'register' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Registrarse
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Nombre o Marca
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre o @cuenta"
                  className="w-full pl-9 pr-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-neutral-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full pl-9 pr-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-neutral-300">Contraseña</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-[11px] text-rose-400 hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-neutral-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg transition-all"
          >
            <span>
              {loading
                ? 'Procesando...'
                : mode === 'login'
                ? 'Ingresar a mi cuenta'
                : mode === 'register'
                ? 'Crear cuenta'
                : 'Enviar enlace'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {mode === 'forgot' && (
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => setMode('login')}
              className="text-xs text-neutral-400 hover:text-white"
            >
              ← Volver al inicio de sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
