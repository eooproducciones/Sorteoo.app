import React, { useState, useEffect } from 'react';
import { Giveaway } from '../types/giveaway';
import {
  Download,
  Share2,
  Trophy,
  Users,
  CheckCircle,
  Calendar,
  ExternalLink,
  ShieldCheck,
  RotateCcw,
  ListOrdered,
  Instagram,
  Copy,
  Check,
  AlertCircle,
  FileCheck,
  X,
  FileText,
  MessageCircle,
  Smartphone
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface GiveawayResultsViewProps {
  giveaway: Giveaway;
  videoBlob: Blob | null;
  videoDataUrl: string | null;
  recordingError?: string;
  isPreparingVideo?: boolean;
  waitForVideoReady?: () => Promise<void>;
  onNewGiveaway: () => void;
  onGoToHistory: () => void;
}

export const GiveawayResultsView: React.FC<GiveawayResultsViewProps> = ({
  giveaway,
  videoBlob,
  videoDataUrl,
  recordingError,
  isPreparingVideo = false,
  waitForVideoReady,
  onNewGiveaway,
  onGoToHistory,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [downloadingVideo, setDownloadingVideo] = useState(false);
  const [videoStatusError, setVideoStatusError] = useState<string | null>(null);

  const cachedMovFileRef = React.useRef<File | null>(null);
  const fetchPromiseRef = React.useRef<Promise<File> | null>(null);

  useEffect(() => {
    cachedMovFileRef.current = null;
    fetchPromiseRef.current = null;
    setVideoStatusError(null);
  }, [giveaway.id]);

  useEffect(() => {
    // Launch a celebratory confetti blast on mounting results view
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF4B72', '#7E3AF2', '#F59E0B', '#3B82F6', '#10B981'],
      });
    } catch (e) {
      // ignore
    }
  }, [giveaway.id]);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isLocalUnplayableWebm = Boolean(
    isAppleMobile &&
    videoDataUrl?.startsWith('blob:') &&
    (videoBlob?.type || '').toLowerCase().includes('webm')
  );

  const videoSrc =
    isLocalUnplayableWebm
      ? null
      : (videoDataUrl || (giveaway.video?.hasVideo ? `/api/giveaways/${giveaway.id}/video-stream` : null));

  const formatName = (u: string) => {
    if (!u) return '';
    if (u.startsWith('Número') || u.startsWith('#') || u.includes(' ')) return u;
    return `@${u.replace(/^@/, '')}`;
  };

  // Wait for upload + deterministic server .MOV generation
  const fetchMovVideoFile = async (): Promise<File> => {
    if (cachedMovFileRef.current) {
      return cachedMovFileRef.current;
    }
    if (fetchPromiseRef.current) {
      return fetchPromiseRef.current;
    }

    const task = (async () => {
      if (waitForVideoReady) {
        await waitForVideoReady();
      }

      // Poll status briefly if ffmpeg conversion is still active on the server
      for (let attempt = 0; attempt < 45; attempt++) {
        try {
          const statusRes = await fetch(`/api/giveaways/${giveaway.id}/video-status`, {
            cache: 'no-store',
          });
          if (!statusRes.ok) break;
          const status = await statusRes.json();
          if (!status.converting) break;
        } catch {
          break;
        }
        await new Promise((r) => setTimeout(r, 300));
      }

      const response = await fetch(`/api/giveaways/${giveaway.id}/download-video`, { cache: 'no-store' });

      if (response.ok) {
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        const rawBlob = await response.blob();
        if (rawBlob.size >= 1000 && (contentType.includes('video/quicktime') || contentType.includes('video/mp4'))) {
          const videoFile = new File([rawBlob], `sorteoo_ganadores_${giveaway.id}.mov`, {
            type: 'video/quicktime',
          });
          cachedMovFileRef.current = videoFile;
          return videoFile;
        }
      }

      throw new Error('No se pudo preparar el video. Intentá nuevamente.');
    })();

    fetchPromiseRef.current = task;
    try {
      return await task;
    } finally {
      fetchPromiseRef.current = null;
    }
  };

  // Pre-cache .MOV in background so Download & WhatsApp Share Sheet trigger instantaneously
  useEffect(() => {
    if (!isPreparingVideo && giveaway.video?.hasVideo && !cachedMovFileRef.current) {
      fetchMovVideoFile().catch(() => {
        // Silent prefetch; explicit tap will retry and surface any error
      });
    }
  }, [isPreparingVideo, giveaway.id, giveaway.video?.hasVideo]);

  // Download universal .MOV compatible across devices and browsers
  const handleDownloadVideo = async () => {
    setVideoStatusError(null);
    setDownloadingVideo(true);
    try {
      const videoFile = await fetchMovVideoFile();
      const url = URL.createObjectURL(videoFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = videoFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err: any) {
      console.warn('Video download error:', err);
      setVideoStatusError(
        err?.message || 'No se pudo descargar el video. Intentá nuevamente.'
      );
    } finally {
      setTimeout(() => setDownloadingVideo(false), 400);
    }
  };

  // Generate Instagram Post Caption text (with Multimarcas brand & prize support)
  const generateInstagramCaption = () => {
    const isMultibrand = Boolean(
      giveaway.multibrandMeta?.isMultibrand ||
      giveaway.winners.some((w) => w.assignedBrand || w.assignedPrize)
    );

    let winnersList = '';
    if (isMultibrand) {
      winnersList = giveaway.winners
        .map((w, idx) => {
          const brandText = w.assignedBrand ? ` [@${w.assignedBrand.replace(/^@/, '')}]` : '';
          const prizeText = w.assignedPrize ? ` - Premio: ${w.assignedPrize}` : '';
          return `Premio ${idx + 1}${brandText}: ${formatName(w.username)}${prizeText}`;
        })
        .join('\n');
    } else {
      winnersList = giveaway.winners
        .map((w, idx) => `Ganador ${idx + 1}: ${formatName(w.username)}`)
        .join('\n');
    }

    let text = `🎉 ¡TENEMOS GANADORES DE NUESTRO SORTEO OFICIAL! 🎉\n\n`;
    if (isMultibrand) {
      text += `Modalidad: Sorteo Multimarcas (1 Ganador por Emprendimiento)\n`;
    }
    text += `Publicación: @${giveaway.postDetails.author}\n\n`;
    text += `🏆 LISTA OFICIAL DE GANADORES:\n${winnersList}\n\n`;

    if (giveaway.substitutes && giveaway.substitutes.length > 0) {
      const subsList = giveaway.substitutes
        .map((s, idx) => `Suplente ${idx + 1}: ${formatName(s.username)}`)
        .join('\n');
      text += `🥈 SUPLENTES DE RESERVA:\n${subsList}\n\n`;
    }

    text += `🔒 Certificado de Transparencia: ${giveaway.audit.verificationCode}\n`;
    text += `Verificado públicamente en https://sorteoo.app/#verify-${giveaway.audit.verificationCode}\n\n`;
    text += `¡Felicidades a los ganadores! Envíanos un mensaje directo para coordinar la entrega de tu premio 🎁✨`;

    return text;
  };

  // Open the interactive Instagram and multi-app share modal
  const handleOpenInstagramShare = () => {
    setShareModalOpen(true);
  };

  // Native mobile sharing handler with pre-cached lightweight .MOV file
  const handleNativeMobileShare = async () => {
    const shareText = generateInstagramCaption();
    setVideoStatusError(null);
    try {
      let fileToShare: File | null = cachedMovFileRef.current;
      if (!fileToShare) {
        setDownloadingVideo(true);
        try {
          fileToShare = await fetchMovVideoFile();
        } catch {
          fileToShare = null;
        } finally {
          setDownloadingVideo(false);
        }
      }

      if (navigator.share && fileToShare && navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
        await navigator.share({
          files: [fileToShare],
        });
        return;
      } else if (navigator.share) {
        await navigator.share({
          title: 'Ganadores Sorteo Instagram - sorteoo.app',
          text: shareText,
          url: `${window.location.origin}/#verify-${giveaway.audit.verificationCode}`,
        });
        return;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.warn('Native mobile share error:', err);
      setVideoStatusError('Para enviar por WhatsApp o Instagram, primero tocá "Descargar video" y elegilo desde tu galería.');
    }
  };

  const copyInstagramCaption = () => {
    const text = generateInstagramCaption();
    navigator.clipboard.writeText(text);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  const copyVerificationCode = () => {
    navigator.clipboard.writeText(giveaway.audit.verificationCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyVerificationLink = () => {
    const link = `${window.location.origin}/#verify-${giveaway.audit.verificationCode}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Generate PNG Certificate
  const downloadCertificate = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dark sleek certificate background
    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 6;
    ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

    // Inner subtle border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(55, 55, canvas.width - 110, canvas.height - 110);

    // Brand
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 48px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('sorteoo.app', canvas.width / 2, 120);

    ctx.fillStyle = '#F59E0B';
    ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('CERTIFICADO OFICIAL DE VALIDEZ Y TRANSPARENCIA', canvas.width / 2, 165);

    // Post info
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '500 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      `Publicación: @${giveaway.postDetails.author} (${giveaway.validParticipantsCount} participantes)`,
      canvas.width / 2,
      220
    );

    // Winners box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(150, 260, 900, 250);
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    ctx.strokeRect(150, 260, 900, 250);

    ctx.fillStyle = '#10B981';
    ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`LISTA OFICIAL DE GANADORES (${giveaway.winners.length})`, canvas.width / 2, 305);

    giveaway.winners.slice(0, 4).forEach((w, i) => {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
      const prizeExtra = w.assignedPrize ? ` [${w.assignedPrize}]` : '';
      ctx.fillText(`Ganador ${i + 1}: ${formatName(w.username)}${prizeExtra}`, canvas.width / 2, 360 + i * 40);
    });

    if (giveaway.winners.length > 4) {
      ctx.fillStyle = '#F59E0B';
      ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`... y ${giveaway.winners.length - 4} ganadores más`, canvas.width / 2, 360 + 4 * 40);
    }

    // Verification Code & SHA-256
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '600 24px "JetBrains Mono", monospace';
    ctx.fillText(`Código de Validación: ${giveaway.audit.verificationCode}`, canvas.width / 2, 570);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '400 16px "JetBrains Mono", monospace';
    ctx.fillText(`Hash SHA-256: ${giveaway.audit.sha256Hash}`, canvas.width / 2, 610);

    const formattedDate = new Date(giveaway.audit.drawnAt).toLocaleString('es-ES', {
      dateStyle: 'full',
      timeStyle: 'medium',
    });
    ctx.fillText(`Fecha y hora de ejecución: ${formattedDate}`, canvas.width / 2, 640);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '400 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Verificable públicamente en https://sorteoo.app', canvas.width / 2, 700);

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `certificado_sorteoo_${giveaway.id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isMultibrand = Boolean(
    giveaway.multibrandMeta?.isMultibrand ||
    giveaway.winners.some((w) => w.assignedBrand || w.assignedPrize)
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-8">
      {/* Top Banner */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-bold mb-3 shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          Sorteo finalizado con éxito
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight">
          ¡Lista Oficial de Ganadores!
        </h1>
        <p className="mt-2 text-sm text-neutral-600 max-w-xl mx-auto">
          {isMultibrand
            ? `Sorteo Multimarcas con ${giveaway.winners.length} ganador${giveaway.winners.length > 1 ? 'es' : ''} asignados a sus respectivos emprendimientos y video en formato vertical listo para Reels y Stories.`
            : `Proceso completado con ${giveaway.winners.length} ganador${giveaway.winners.length > 1 ? 'es' : ''} con igual validez y video grabado en formato vertical listo para Reels y Stories.`}
        </p>
      </div>

      {/* ====================================================================== */}
      {/* 🎬 1. VIDEO HERO SECTION (FIRST IN RESULTS AS REQUESTED BY USER)       */}
      {/* ====================================================================== */}
      <div className="bg-white border-2 border-rose-400/40 rounded-3xl p-5 sm:p-7 shadow-xl shadow-rose-500/5 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8">
          {/* Vertical 9:16 Video Player Container */}
          <div className="w-full max-w-[260px] sm:max-w-[280px] shrink-0 mx-auto">
            <div className="relative aspect-[9/16] bg-neutral-100 rounded-2xl overflow-hidden shadow-2xl border-2 border-neutral-200 ring-4 ring-rose-500/20">
              {videoSrc ? (
                <video
                  key={videoSrc}
                  src={videoSrc}
                  controls
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : isLocalUnplayableWebm || isPreparingVideo ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-neutral-50">
                  <div className="w-9 h-9 rounded-full border-4 border-rose-500 border-t-transparent animate-spin mb-3" />
                  <p className="text-xs text-neutral-800 font-bold">Preparando vista previa...</p>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-neutral-50">
                  <AlertCircle className="w-10 h-10 text-amber-500 mb-2" />
                  <p className="text-xs text-neutral-800 font-bold">Video no disponible</p>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    {recordingError || 'El navegador no generó la vista de video.'}
                  </p>
                </div>
              )}
              {/* Badge Overlay */}
              <div className="absolute top-3 left-3 pointer-events-none">
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/90 backdrop-blur-md text-neutral-900 px-2.5 py-1 rounded-md border border-neutral-200 shadow-sm">
                  9:16 Vertical
                </span>
              </div>
            </div>
          </div>

          {/* Action Center Beside / Below Video */}
          <div className="flex-1 w-full space-y-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200 text-[11px] font-black uppercase tracking-wider mb-2">
                ⭐ Lo más importante
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-neutral-900">
                Video Oficial del Sorteo
              </h2>
              <p className="text-xs sm:text-sm text-neutral-600 mt-1 leading-relaxed">
                El video vertical del sorteo está listo para descargar y compartir directo en tus Stories, Reels o WhatsApp.
              </p>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-2.5 py-1">
              <div className="bg-neutral-50 border border-neutral-200 p-2.5 rounded-xl text-center">
                <span className="text-[10px] text-neutral-500 block font-semibold">Ganadores</span>
                <span className="text-sm sm:text-base font-black text-amber-600">
                  {giveaway.winners.length}
                </span>
              </div>
              <div className="bg-neutral-50 border border-neutral-200 p-2.5 rounded-xl text-center">
                <span className="text-[10px] text-neutral-500 block font-semibold">Participantes</span>
                <span className="text-sm sm:text-base font-black text-neutral-900">
                  {giveaway.validParticipantsCount}
                </span>
              </div>
              <div className="bg-neutral-50 border border-neutral-200 p-2.5 rounded-xl text-center">
                <span className="text-[10px] text-neutral-500 block font-semibold">Estado</span>
                <span className="text-sm sm:text-base font-black text-emerald-600">
                  Certificado
                </span>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="space-y-2.5 pt-1">
              {videoStatusError && (
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{videoStatusError}</span>
                </div>
              )}

              {/* Descargar Video Button (.MOV) */}
              <button
                type="button"
                onClick={handleDownloadVideo}
                disabled={downloadingVideo}
                className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-95 disabled:opacity-60 text-white text-sm sm:text-base font-black rounded-2xl shadow-xl shadow-rose-500/25 transition-all transform active:scale-[0.98] cursor-pointer"
              >
                <Download className="w-5 h-5 shrink-0" />
                <span>{downloadingVideo ? 'Descargando video...' : 'Descargar video'}</span>
              </button>

              {/* Direct Mobile Share (iOS "Guardar en Fotos" / WhatsApp / Instagram) */}
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  type="button"
                  onClick={handleNativeMobileShare}
                  disabled={downloadingVideo || isPreparingVideo}
                  className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 bg-neutral-900 hover:bg-black disabled:opacity-60 text-white text-sm sm:text-base font-black rounded-2xl shadow-lg transition-all transform active:scale-[0.98] cursor-pointer"
                >
                  <Share2 className="w-5 h-5 shrink-0" />
                  <span>{isPreparingVideo ? 'Preparando video...' : 'Enviar por WhatsApp / Guardar en Fotos'}</span>
                </button>
              )}

              {/* Compartir en Instagram Button */}
              <button
                type="button"
                onClick={handleOpenInstagramShare}
                className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-fuchsia-600 via-rose-600 to-amber-500 hover:opacity-95 text-white text-sm sm:text-base font-black rounded-2xl shadow-lg transition-all transform active:scale-[0.98] cursor-pointer"
              >
                <Instagram className="w-5 h-5 shrink-0" />
                <span>Compartir en Instagram</span>
              </button>
            </div>

            {/* Secondary Navigation */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onNewGiveaway}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Crear Nuevo Sorteo</span>
              </button>
              <button
                type="button"
                onClick={onGoToHistory}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900 text-xs font-semibold rounded-xl border border-neutral-200 transition-colors cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Mis Sorteos</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* 🏆 2. GANADORES OFICIALES Y DETALLES DEL SORTEO                         */}
      {/* ====================================================================== */}
      <div className="space-y-6">
        {/* Winners List Card */}
        <div className="bg-white border border-neutral-200/90 shadow-xl rounded-3xl p-5 sm:p-7 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold shadow-xs">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-neutral-900">
                  Lista Oficial de Ganadores ({giveaway.winners.length})
                </h2>
                <p className="text-xs text-neutral-500">
                  {isMultibrand
                    ? '1 ganador seleccionado por cada emprendimiento'
                    : 'Todos los ganadores tienen igual categoría y validez oficial'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={copyInstagramCaption}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-colors shrink-0 cursor-pointer"
            >
              {copiedCaption ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-neutral-600" />}
              <span>{copiedCaption ? '¡Lista copiada!' : 'Copiar texto para post'}</span>
            </button>
          </div>

          {/* Cards for each winner (With Multimarcas brand & prize prominent) */}
          <div className="space-y-3">
            {giveaway.winners.map((winner, index) => (
              <div
                key={index}
                className="bg-neutral-50 border border-neutral-200 hover:border-neutral-300 rounded-2xl p-4 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 font-black text-xs flex items-center justify-center shrink-0 border border-amber-200">
                      #{index + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm sm:text-base text-neutral-900">
                          {formatName(winner.username)}
                        </span>
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Ganador {index + 1}
                        </span>
                      </div>

                      {winner.comment && (
                        <p className="text-xs text-neutral-600 italic truncate mt-1">
                          “{winner.comment}”
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Multibrand specific brand & prize details */}
                  {(winner.assignedBrand || winner.assignedPrize) && (
                    <div className="sm:text-right bg-white sm:bg-transparent p-2.5 sm:p-0 rounded-xl border sm:border-0 border-neutral-200 shrink-0">
                      {winner.assignedBrand && (
                        <div className="inline-flex items-center gap-1 text-xs font-black text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-lg">
                          <Instagram className="w-3 h-3 text-rose-600" />
                          <span>@{winner.assignedBrand.replace(/^@/, '')}</span>
                        </div>
                      )}
                      {winner.assignedPrize && (
                        <p className="text-xs font-bold text-amber-700 mt-1">
                          Premio: {winner.assignedPrize}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Substitutes / Suplentes */}
        {giveaway.substitutes && giveaway.substitutes.length > 0 && (
          <div className="bg-white border border-neutral-200/90 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-neutral-100 text-neutral-600 flex items-center justify-center">
                <ListOrdered className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-neutral-900">
                  Suplentes de Reserva ({giveaway.substitutes.length})
                </h3>
                <p className="text-xs text-neutral-500">
                  En orden de prioridad oficial si algún ganador no cumple los requisitos
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {giveaway.substitutes.map((sub, idx) => (
                <div
                  key={idx}
                  className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-900">{formatName(sub.username)}</span>
                    <span className="text-[10px] text-purple-700 font-semibold bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                      Suplente {idx + 1}
                    </span>
                  </div>
                  {sub.comment && (
                    <p className="text-[11px] text-neutral-500 truncate mt-1">“{sub.comment}”</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verificador de Transparencia & Certificado Oficial */}
        <div className="bg-white border border-neutral-200/90 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm sm:text-base font-bold text-neutral-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>Certificado del Verificador de Transparencia</span>
            </h3>
            <span className="text-[11px] text-neutral-500">
              {new Date(giveaway.audit.drawnAt).toLocaleDateString('es-ES', {
                dateStyle: 'medium',
              })}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-200">
              <span className="text-neutral-500 block mb-1">Código del Verificador</span>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-neutral-900">
                  {giveaway.audit.verificationCode}
                </span>
                <button
                  type="button"
                  onClick={copyVerificationCode}
                  className="p-1 hover:text-neutral-900 text-neutral-500 transition-colors cursor-pointer"
                  title="Copiar código"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-200">
              <span className="text-neutral-500 block mb-1">Participantes válidos</span>
              <span className="font-bold text-neutral-900 tabular-nums">
                {giveaway.validParticipantsCount} de {giveaway.totalParticipantsDetected}
              </span>
            </div>

            <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-200">
              <span className="text-neutral-500 block mb-1">Hash SHA-256</span>
              <span className="font-mono text-[10px] text-neutral-600 truncate block">
                {giveaway.audit.sha256Hash}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              onClick={downloadCertificate}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-900 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>Descargar Certificado (PNG)</span>
            </button>

            <button
              type="button"
              onClick={copyVerificationLink}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl border border-neutral-200 transition-colors cursor-pointer"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-rose-600" />}
              <span>{copiedLink ? '¡Enlace copiado!' : 'Copiar enlace público del Verificador'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* 📱 3. INTERACTIVE INSTAGRAM SHARING MODAL                              */}
      {/* ====================================================================== */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white border-2 border-rose-400/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShareModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-800 rounded-xl bg-neutral-100 transition-colors cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] flex items-center justify-center text-white shadow-lg shadow-rose-500/25 shrink-0">
                <Instagram className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-neutral-900">Compartir en Instagram</h3>
                <p className="text-xs text-neutral-500">
                  Subí el video a tus Historias o Reels en 3 pasos sencillos
                </p>
              </div>
            </div>

            {/* Step-by-Step Practical Sharing Action Flow */}
            <div className="space-y-3">
              {/* Step 1: Download Video (.MOV) */}
              <button
                type="button"
                onClick={handleDownloadVideo}
                disabled={downloadingVideo}
                className="w-full flex items-center justify-between p-3.5 bg-gradient-to-r from-rose-50 via-pink-50 to-amber-50 hover:from-rose-100 hover:to-amber-100 border-2 border-rose-300/80 rounded-2xl transition-all text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#F58529] to-[#DD2A7B] text-white flex items-center justify-center shadow-xs shrink-0">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-200/60 text-rose-800">
                        Paso 1
                      </span>
                      <span className="text-xs sm:text-sm font-black text-neutral-900">
                        Descargar Video
                      </span>
                    </div>
                    <span className="text-[11px] text-neutral-600 block mt-0.5">
                      Guarda el video oficial del sorteo en tu dispositivo
                    </span>
                  </div>
                </div>
                <span className="text-xs font-black text-[#DD2A7B] shrink-0 group-hover:scale-105 transition-transform">
                  {downloadingVideo ? 'Descargando...' : 'Descargar'}
                </span>
              </button>

              {/* Step 2: Copy Winners Caption Text */}
              <button
                type="button"
                onClick={copyInstagramCaption}
                className="w-full flex items-center justify-between p-3.5 bg-neutral-50 hover:bg-neutral-100 border-2 border-neutral-200 hover:border-emerald-300 rounded-2xl transition-all text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs shrink-0">
                    {copiedCaption ? <Check className="w-5 h-5 stroke-[3]" /> : <Copy className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                        Paso 2
                      </span>
                      <span className="text-xs sm:text-sm font-black text-neutral-900">
                        {copiedCaption ? '¡Texto oficial copiado!' : 'Copiar texto para el pie de foto'}
                      </span>
                    </div>
                    <span className="text-[11px] text-neutral-500 block mt-0.5">
                      Incluye ganadores, menciones y código verificador
                    </span>
                  </div>
                </div>
                <span className="text-xs font-black text-emerald-600 shrink-0">
                  {copiedCaption ? '¡Copiado!' : 'Copiar'}
                </span>
              </button>

              {/* Step 3: Open Instagram App or Web */}
              <a
                href="https://www.instagram.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between p-3.5 bg-gradient-to-r from-neutral-50 to-purple-50 hover:from-neutral-100 hover:to-purple-100 border-2 border-neutral-200 hover:border-purple-300 rounded-2xl transition-all text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#8134AF] to-[#DD2A7B] text-white flex items-center justify-center shadow-xs shrink-0">
                    <Instagram className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                        Paso 3
                      </span>
                      <span className="text-xs sm:text-sm font-black text-neutral-900">
                        Abrir Instagram
                      </span>
                    </div>
                    <span className="text-[11px] text-neutral-500 block mt-0.5">
                      Tocá '+' o 'Tu historia' y subí el video descargado
                    </span>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-[#8134AF] group-hover:translate-x-0.5 transition-transform shrink-0" />
              </a>

              {/* Native Mobile Share Button (if supported on mobile browsers) */}
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  type="button"
                  onClick={handleNativeMobileShare}
                  className="w-full flex items-center justify-between p-3.5 bg-neutral-900 hover:bg-black text-white rounded-2xl transition-all text-left cursor-pointer shadow-md group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-black block">
                        Compartir directo desde el celular
                      </span>
                      <span className="text-[11px] text-neutral-300 block">
                        Abre el menú de compartir de tu iPhone o Android
                      </span>
                    </div>
                  </div>
                  <Share2 className="w-4 h-4 text-white group-hover:scale-110 transition-transform shrink-0" />
                </button>
              )}

              {/* WhatsApp Share Option */}
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(generateInstagramCaption())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-2xl transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-black text-emerald-950 block">
                      Enviar resultados por WhatsApp
                    </span>
                    <span className="text-[11px] text-emerald-700 block">
                      Comparte el texto y el enlace verificador en chats o grupos
                    </span>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-emerald-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

