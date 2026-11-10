import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  ShieldCheck,
  Trophy,
  Users,
  Calendar,
  ExternalLink,
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface VerifyViewProps {
  initialCode?: string;
  onGoHome: () => void;
}

export const VerifyView: React.FC<VerifyViewProps> = ({ initialCode = '', onGoHome }) => {
  const [code, setCode] = useState(initialCode);
  const [auditData, setAuditData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialCode) {
      handleVerify(initialCode);
    }
  }, [initialCode]);

  const handleVerify = async (codeToVerify: string) => {
    if (!codeToVerify.trim()) return;
    setLoading(true);
    setError(null);
    setAuditData(null);
    try {
      const data = await api.verifyCode(codeToVerify.trim());
      setAuditData(data);
    } catch (err: any) {
      setError(err.message || 'Código de certificado no encontrado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 sm:py-12 overflow-x-hidden">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-semibold mb-3">
          <ShieldCheck className="w-4 h-4" />
          <span>Verificador Oficial de Sorteos</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Verificador de Transparencia
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-neutral-400 max-w-md mx-auto leading-relaxed">
          Cualquier persona puede comprobar la validez y resultados inmutables de un sorteo realizado en sorteoo.app ingresando el código del verificador.
        </p>
      </div>

      {/* Code Search Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleVerify(code);
        }}
        className="mb-8"
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Introduce código del verificador (ej: SRT-1X9A-7B)"
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-xs font-mono uppercase focus:outline-none focus:border-rose-500 shadow-inner"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="px-7 py-3 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 hover:to-amber-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-500/20 transition-all disabled:opacity-50 shrink-0"
          >
            {loading ? 'Consultando...' : 'Comprobar en Verificador'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Verified Certificate Card */}
      {auditData && (
        <div className="bg-neutral-900 border border-emerald-500/40 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Sorteo Auténtico y Verificado</h2>
                <span className="text-xs font-mono text-neutral-400">
                  {auditData.audit.verificationCode}
                </span>
              </div>
            </div>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-md font-semibold">
              VÁLIDO
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
              <span className="text-neutral-500 block mb-1">Autor de la publicación</span>
              <span className="font-bold text-white text-sm">@{auditData.postAuthor}</span>
            </div>

            <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
              <span className="text-neutral-500 block mb-1">Fecha de sorteo</span>
              <span className="font-semibold text-neutral-200">
                {new Date(auditData.drawnAt).toLocaleString('es-ES', {
                  dateStyle: 'full',
                  timeStyle: 'medium',
                })}
              </span>
            </div>
          </div>

          {/* Winners list */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <Trophy className="w-4 h-4" />
              Ganadores Oficiales Registrados:
            </h3>
            <div className="space-y-2">
              {auditData.winners.map((w: any, idx: number) => (
                <div
                  key={idx}
                  className="bg-neutral-950 border border-neutral-800 p-3 rounded-xl flex items-center justify-between text-xs"
                >
                  <span className="font-bold text-white">@{w.username}</span>
                  <span className="text-neutral-400 italic truncate max-w-xs ml-4">
                    “{w.comment}”
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Technical proof */}
          <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800/80 space-y-2 text-[11px] font-mono text-neutral-400">
            <div className="flex justify-between">
              <span>Semilla PRNG:</span>
              <span className="text-neutral-300">{auditData.audit.seed}</span>
            </div>
            <div className="flex justify-between">
              <span>Hash Criptográfico (SHA-256):</span>
              <span className="text-emerald-400 break-all">{auditData.audit.sha256Hash}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
