import React, { useState, useEffect } from 'react';
import { Giveaway } from '../types/giveaway';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  Trophy,
  Users,
  Video,
  Trash2,
  Search,
  PlusCircle,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  LogIn,
  RefreshCw,
} from 'lucide-react';

interface MyGiveawaysViewProps {
  onNewGiveaway: () => void;
  onSelectGiveaway: (giveaway: Giveaway) => void;
}

export const MyGiveawaysView: React.FC<MyGiveawaysViewProps> = ({
  onNewGiveaway,
  onSelectGiveaway,
}) => {
  const { user, openAuthModal } = useAuth();
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadGiveaways();
  }, [user?.id]);

  const loadGiveaways = async () => {
    setLoading(true);
    setErrorMsg(null);
    const localSnapshots = api.getLocalGiveawaySnapshots();
    const localIds = localSnapshots.map((g) => g.id).filter(Boolean);

    try {
      if (user) {
        // Claim any guest giveaways created on this browser into the signed-in account
        if (localIds.length > 0) {
          try {
            await api.claimGuestGiveaways(localIds);
          } catch {
            // Non-fatal if claim fails
          }
        }
        const res = await api.getGiveaways();
        const serverGiveaways = Array.isArray(res?.giveaways) ? res.giveaways : [];
        const serverIds = new Set(serverGiveaways.map((g) => g.id));
        const merged = [
          ...serverGiveaways,
          ...localSnapshots.filter((g) => !serverIds.has(g.id)),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setGiveaways(merged);
      } else if (localIds.length > 0) {
        // Refresh guest giveaways created on this browser from Supabase so video/metadata stay current
        let serverItems: Giveaway[] = [];
        try {
          const res = await api.getGiveawaysByIds(localIds);
          serverItems = Array.isArray(res?.giveaways) ? res.giveaways : [];
        } catch {
          serverItems = [];
        }
        const byId = new Map<string, Giveaway>();
        for (const item of localSnapshots) byId.set(item.id, item);
        for (const item of serverItems) byId.set(item.id, item);
        const merged = Array.from(byId.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setGiveaways(merged);
      } else {
        setGiveaways([]);
      }
    } catch (err: any) {
      console.error('Error loading giveaways:', err);
      if (localSnapshots.length > 0) {
        setGiveaways(localSnapshots);
      } else {
        setErrorMsg(err?.message || 'No se pudieron cargar tus sorteos. Intentá nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    setConfirmDeleteId(null);
    try {
      if (user) {
        await api.deleteGiveaway(id).catch(() => {
          // If it was only local/guest, still remove local snapshot
        });
      }
      api.removeLocalGiveawaySnapshot(id);
      setGiveaways((prev) => prev.filter((g) => g.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const q = searchTerm.trim().toLowerCase();
  const filteredGiveaways = giveaways.filter((g) => {
    if (!q) return true;
    const code = (g.audit?.verificationCode || '').toLowerCase();
    const author = (g.postDetails?.author || '').toLowerCase();
    const winners = Array.isArray(g.winners) ? g.winners : [];
    return (
      code.includes(q) ||
      author.includes(q) ||
      winners.some((w) => (w?.username || '').toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
            Mis Sorteos
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-600">
            Historial de sorteos realizados, resultados certificados y videos descargables en .MOV.
          </p>
        </div>

        <button
          type="button"
          onClick={onNewGiveaway}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-95 text-white text-xs sm:text-sm font-black rounded-xl shadow-lg shadow-rose-500/20 transition-all cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Crear sorteo</span>
        </button>
      </div>

      {/* Account sync banner when browsing without session */}
      {!user && (
        <div className="mb-6 bg-white border border-rose-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="text-xs sm:text-sm text-neutral-700">
            <p className="font-bold text-neutral-900">
              {giveaways.length > 0
                ? 'Mostrando los sorteos creados en este dispositivo'
                : 'Iniciá sesión para ver tus sorteos guardados en tu cuenta'}
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              Con tu cuenta iniciada, todos tus sorteos y videos quedan sincronizados entre tu celular y computadora.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl shrink-0 transition-colors cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Iniciar sesión</span>
          </button>
        </div>
      )}

      {/* Filter / Search Bar */}
      {giveaways.length > 0 && (
        <div className="mb-6">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código, cuenta o ganador..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-neutral-900 text-xs sm:text-sm focus:outline-none focus:border-rose-500 shadow-2xs"
            />
          </div>
        </div>
      )}

      {/* Error State */}
      {errorMsg && (
        <div className="mb-6 bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-rose-700">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={loadGiveaways}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-rose-200 rounded-lg font-bold hover:bg-rose-100 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reintentar</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-64 bg-white border border-neutral-200 rounded-3xl animate-pulse"
            />
          ))}
        </div>
      ) : filteredGiveaways.length === 0 ? (
        /* Empty State */
        <div className="bg-white border border-neutral-200 rounded-3xl p-10 sm:p-12 text-center max-w-md mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-500 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-neutral-900 mb-1">
            {searchTerm ? 'No se encontraron resultados' : 'Todavía no hay sorteos para mostrar'}
          </h3>
          <p className="text-xs text-neutral-500 mb-6 leading-relaxed">
            {searchTerm
              ? 'Probá con otro nombre de usuario, cuenta o código de verificación.'
              : user
                ? 'Pegá el enlace de una publicación de Instagram y creá tu primer sorteo con video automático.'
                : 'Iniciá sesión si hiciste sorteos con tu cuenta, o creá un sorteo nuevo desde este dispositivo.'}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            {!user && (
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Iniciar Sesión</span>
              </button>
            )}
            <button
              type="button"
              onClick={onNewGiveaway}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Crear sorteo</span>
            </button>
          </div>
        </div>
      ) : (
        /* Grid of Giveaways */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGiveaways.map((giveaway) => {
            const winners = Array.isArray(giveaway.winners) ? giveaway.winners : [];
            const formattedDate = giveaway.createdAt
              ? new Date(giveaway.createdAt).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

            return (
              <div
                key={giveaway.id}
                onClick={() => onSelectGiveaway(giveaway)}
                className="bg-white border border-neutral-200 hover:border-rose-300 rounded-3xl p-5 flex flex-col justify-between transition-all hover:shadow-xl shadow-sm cursor-pointer group"
              >
                <div>
                  {/* Top Bar inside Card */}
                  <div className="flex items-center justify-between text-xs text-neutral-500 mb-3">
                    <span className="font-mono text-[11px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md">
                      {giveaway.audit?.verificationCode || giveaway.id}
                    </span>
                    <span className="text-[11px] font-bold flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Finalizado
                    </span>
                  </div>

                  {/* Post title */}
                  <h3 className="text-base font-black text-neutral-900 group-hover:text-rose-600 transition-colors truncate">
                    @{giveaway.postDetails?.author || 'sorteo'}
                  </h3>
                  <p className="text-xs text-neutral-500 truncate mt-0.5">
                    {giveaway.postDetails?.caption || 'Sorteo oficial'}
                  </p>

                  {/* Winners preview */}
                  <div className="mt-4 p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-1.5">
                    <span className="text-[11px] text-amber-700 font-bold flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                      Ganador{winners.length > 1 ? 'es' : ''}:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {winners.slice(0, 2).map((w, i) => (
                        <span
                          key={i}
                          className="text-xs font-bold text-neutral-900 bg-white border border-neutral-200 px-2 py-0.5 rounded-lg"
                        >
                          {w.username?.startsWith('Número') || w.username?.startsWith('#') || w.username?.includes(' ')
                            ? w.username
                            : `@${(w.username || '').replace(/^@/, '')}`}
                        </span>
                      ))}
                      {winners.length > 2 && (
                        <span className="text-xs font-semibold text-neutral-500 self-center">
                          +{winners.length - 2} más
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats strip */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-neutral-500">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="tabular-nums font-medium">
                        {giveaway.validParticipantsCount ?? 0} participantes
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="truncate">{formattedDate}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-5 pt-4 border-t border-neutral-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {giveaway.video?.hasVideo ? (
                      <a
                        href={`/api/giveaways/${giveaway.id}/download-video`}
                        download={`sorteoo_${giveaway.id}.mov`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors"
                        title="Descargar video vertical (9:16)"
                      >
                        <Video className="w-3.5 h-3.5 text-rose-400" />
                        <span>Descargar video</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-neutral-400">Sin video</span>
                    )}

                    <span className="text-xs text-emerald-700 font-semibold hidden sm:flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      Auditado
                    </span>
                  </div>

                  {confirmDeleteId === giveaway.id ? (
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={(e) => handleConfirmDelete(giveaway.id, e)}
                        disabled={deletingId === giveaway.id}
                        className="px-2 py-1 bg-rose-600 text-white text-[11px] font-bold rounded-lg hover:bg-rose-700 cursor-pointer"
                      >
                        Eliminar
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(null);
                        }}
                        className="px-2 py-1 bg-neutral-100 text-neutral-600 text-[11px] font-semibold rounded-lg hover:bg-neutral-200 cursor-pointer"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(giveaway.id);
                      }}
                      disabled={deletingId === giveaway.id}
                      className="p-1.5 text-neutral-400 hover:text-rose-600 transition-colors rounded-lg cursor-pointer"
                      title="Eliminar sorteo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
