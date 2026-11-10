import React, { useState, useEffect } from 'react';
import { Giveaway } from '../types/giveaway';
import { api } from '../services/api';
import {
  Calendar,
  Trophy,
  Users,
  Video,
  Download,
  Trash2,
  ExternalLink,
  Search,
  PlusCircle,
  Eye,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface MyGiveawaysViewProps {
  onNewGiveaway: () => void;
  onSelectGiveaway: (giveaway: Giveaway) => void;
}

export const MyGiveawaysView: React.FC<MyGiveawaysViewProps> = ({
  onNewGiveaway,
  onSelectGiveaway,
}) => {
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadGiveaways();
  }, []);

  const loadGiveaways = async () => {
    setLoading(true);
    try {
      const res = await api.getGiveaways();
      setGiveaways(res.giveaways);
    } catch (err) {
      console.error('Error loading giveaways:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('¿Estás seguro de que deseas eliminar este sorteo de tu historial?')) {
      return;
    }
    setDeletingId(id);
    try {
      await api.deleteGiveaway(id);
      setGiveaways((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      alert('Error al eliminar el sorteo');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredGiveaways = giveaways.filter(
    (g) =>
      g.audit.verificationCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.postDetails.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.winners.some((w) => w.username.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Mis Sorteos
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Historial de sorteos realizados, resultados certificados y videos descargables.
          </p>
        </div>

        <button
          onClick={onNewGiveaway}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Crear sorteo</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por código, autor o ganador..."
            className="w-full pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-64 bg-neutral-900/60 border border-neutral-800 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : filteredGiveaways.length === 0 ? (
        /* Empty State */
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-amber-400/80" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">
            {searchTerm ? 'No se encontraron resultados' : 'Todavía no has realizado ningún sorteo'}
          </h3>
          <p className="text-xs text-neutral-400 mb-6">
            {searchTerm
              ? 'Intenta con otro término de búsqueda.'
              : 'Pega el enlace de una publicación de Instagram y crea tu primer sorteo con video automático en minutos.'}
          </p>
          <button
            onClick={onNewGiveaway}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Crear mi primer sorteo
          </button>
        </div>
      ) : (
        /* Grid of Giveaways */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGiveaways.map((giveaway) => {
            const formattedDate = new Date(giveaway.createdAt).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={giveaway.id}
                onClick={() => onSelectGiveaway(giveaway)}
                className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-5 flex flex-col justify-between transition-all hover:shadow-xl cursor-pointer group"
              >
                <div>
                  {/* Top Bar inside Card */}
                  <div className="flex items-center justify-between text-xs text-neutral-400 mb-3">
                    <span className="font-mono text-[11px] text-neutral-400">
                      {giveaway.audit.verificationCode}
                    </span>
                    <span className="text-[11px] flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Finalizado
                    </span>
                  </div>

                  {/* Post title */}
                  <h3 className="text-sm font-bold text-white group-hover:text-rose-400 transition-colors truncate">
                    @{giveaway.postDetails.author}
                  </h3>
                  <p className="text-xs text-neutral-400 truncate mt-0.5">
                    {giveaway.postDetails.caption || 'Sorteo oficial'}
                  </p>

                  {/* Winners preview */}
                  <div className="mt-4 p-3 bg-neutral-950/70 rounded-xl border border-neutral-800/80 space-y-1.5">
                    <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5" />
                      Ganador{giveaway.winners.length > 1 ? 'es' : ''}:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {giveaway.winners.slice(0, 2).map((w, i) => (
                        <span
                          key={i}
                          className="text-xs font-bold text-white bg-neutral-800 px-2 py-0.5 rounded"
                        >
                          @{w.username}
                        </span>
                      ))}
                      {giveaway.winners.length > 2 && (
                        <span className="text-xs text-neutral-400 self-center">
                          +{giveaway.winners.length - 2} más
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats strip */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-neutral-400">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="tabular-nums">
                        {giveaway.validParticipantsCount} participantes
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{formattedDate}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-5 pt-4 border-t border-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {giveaway.video?.hasVideo ? (
                      <a
                        href={`/api/giveaways/${giveaway.id}/download-video`}
                        download={`sorteoo_${giveaway.id}.mp4`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold transition-colors"
                        title="Descargar video vertical (9:16)"
                      >
                        <Video className="w-3.5 h-3.5 text-rose-400" />
                        <span>Descargar video</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-neutral-500">Sin video</span>
                    )}

                    <span className="text-xs text-neutral-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      Auditado
                    </span>
                  </div>

                  <button
                    onClick={(e) => handleDelete(giveaway.id, e)}
                    disabled={deletingId === giveaway.id}
                    className="p-1.5 text-neutral-500 hover:text-rose-400 transition-colors rounded-lg"
                    title="Eliminar sorteo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
