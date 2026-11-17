import React, { useEffect, useRef, useState } from 'react';
import { Participant, GiveawayAudit, MultibrandBrandConfig } from '../types/giveaway';
import { AlertCircle, Sparkles } from 'lucide-react';

interface LiveGiveawayStageProps {
  postDetails: {
    shortcode: string;
    author: string;
    caption: string;
    imageUrl?: string;
    sourceType?: 'instagram' | 'numbers' | 'csv' | 'list';
    authorAvatarUrl?: string;
    customLogoUrl?: string;
    multibrandBrandsConfig?: MultibrandBrandConfig[];
    multibrandMeta?: any;
  };
  participants: Participant[];
  winners: Participant[];
  substitutes: Participant[];
  audit: GiveawayAudit;
  onFinish: (result: {
    videoBlob: Blob | null;
    videoDataUrl: string | null;
    durationSeconds: number;
    mimeType: string;
    recordingError?: string;
  }) => void;
  onCancel?: () => void;
}

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  shape: 'rect' | 'circle' | 'star';
}

export const LiveGiveawayStage: React.FC<LiveGiveawayStageProps> = ({
  postDetails,
  participants,
  winners,
  substitutes,
  audit,
  onFinish,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<
    'countdown' | 'revealing_winner' | 'final_summary' | 'thank_you' | 'finalizing'
  >('countdown');
  const [statusMessage, setStatusMessage] = useState<string>('El sorteo comienza en...');
  const [recordingActive, setRecordingActive] = useState<boolean>(true);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastPhaseRef = useRef<string>('countdown');
  const lastStatusRef = useRef<string>('El sorteo comienza en...');

  // Preload avatars & custom logos to ensure canvas renders them instantly
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Canvas Resolution: Standard 9:16 vertical (1080 x 1920)
  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 1920;

  // Helper to load and cache an image with crossOrigin = 'anonymous' and optional fallback
  const loadAndCacheImage = (key: string, url: string, fallbackUrl?: string) => {
    if (!url || imageCache.current.has(key)) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
      imageCache.current.set(key, img);
    };
    img.onerror = () => {
      if (fallbackUrl && fallbackUrl !== url) {
        const fbImg = new Image();
        fbImg.crossOrigin = 'anonymous';
        fbImg.src = fallbackUrl;
        fbImg.onload = () => {
          imageCache.current.set(key, fbImg);
        };
      }
    };
  };

  useEffect(() => {
    // 0. Preload Cute Mascot Logo
    loadAndCacheImage('app_mascot', '/assets/aistudio/Regalo_sonriente_con_lazo_y_destellos_f63477b8.png');

    const isNonInstagram =
      postDetails.sourceType === 'list' ||
      postDetails.sourceType === 'numbers' ||
      postDetails.sourceType === 'csv' ||
      postDetails.author === 'lista_personalizada' ||
      postDetails.author === 'sorteo_por_numeros';

    const igAvatarFallback =
      !isNonInstagram && postDetails.author && !postDetails.author.startsWith('sorteo_')
        ? `/api/instagram/user-avatar?username=${encodeURIComponent(postDetails.author)}`
        : undefined;

    // 1. Preload Organizer Logo (Custom logo, or host avatar, or user-avatar endpoint)
    if (postDetails.customLogoUrl) {
      loadAndCacheImage('host_logo', postDetails.customLogoUrl, igAvatarFallback);
    } else if (postDetails.authorAvatarUrl) {
      loadAndCacheImage('host_logo', postDetails.authorAvatarUrl, igAvatarFallback);
    } else if (igAvatarFallback) {
      loadAndCacheImage('host_logo', igAvatarFallback);
    }

    // 2. Preload Winners' Avatars (Instagram profile photo or fallback avatar)
    winners.forEach((w) => {
      const cleanUser = (w.username || '').replace(/^@/, '');
      if (w.avatarUrl && (w.avatarUrl.startsWith('http') || w.avatarUrl.startsWith('/api'))) {
        loadAndCacheImage(`avatar_${cleanUser.toLowerCase()}`, w.avatarUrl);
      } else if (!isNonInstagram && cleanUser && !cleanUser.includes(' ') && !cleanUser.startsWith('#') && !cleanUser.startsWith('Número')) {
        loadAndCacheImage(`avatar_${cleanUser.toLowerCase()}`, `/api/instagram/user-avatar?username=${encodeURIComponent(cleanUser)}`);
      }
    });

    // 3. Preload a few participant avatars for roulette shuffle
    participants.slice(0, 10).forEach((p) => {
      const clean = (p.username || '').replace(/^@/, '');
      if (p.avatarUrl) {
        loadAndCacheImage(`p_${clean.toLowerCase()}`, p.avatarUrl);
      }
    });
  }, [postDetails, winners, participants]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOSWebKit = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isMacSafari = /Macintosh/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|Edg|Firefox|Android/.test(ua);

    // On all iOS browsers (WebKit) & macOS Safari prefer native MP4 if supported; on Android/Desktop Chrome prefer WebM VP8 -> ffmpeg transcode
    const mimeTypes = isIOSWebKit || isMacSafari
      ? [
          'video/mp4;codecs=avc1',
          'video/mp4',
          'video/webm;codecs=vp8',
          'video/webm',
        ]
      : [
          'video/webm;codecs=vp8',
          'video/webm;codecs=vp9',
          'video/webm',
          'video/mp4;codecs=avc1',
          'video/mp4',
        ];
    let selectedMimeType = '';
    for (const type of mimeTypes) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        selectedMimeType = type;
        break;
      }
    }

    let recorder: MediaRecorder | null = null;
    try {
      if (typeof canvas.captureStream === 'function' && typeof MediaRecorder !== 'undefined') {
        const stream = canvas.captureStream(30); // 30 FPS for smooth, efficient rendering
        const recorderOptions: MediaRecorderOptions = {
          videoBitsPerSecond: 1_400_000, // ~1.4 Mbps: sharp graphics with lightweight upload for fast mobile sharing
        };
        if (selectedMimeType) {
          recorderOptions.mimeType = selectedMimeType;
        }
        try {
          recorder = new MediaRecorder(stream, recorderOptions);
        } catch {
          recorder = new MediaRecorder(stream, selectedMimeType ? { mimeType: selectedMimeType } : undefined);
        }
        recorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        recorder.start(250);
        setRecordingActive(true);
      } else {
        setRecordingError('Grabación no compatible en este navegador. Se continuará con certificado.');
        setRecordingActive(false);
      }
    } catch (err: any) {
      console.warn('Error starting recorder:', err);
      setRecordingError('No se pudo inicializar la grabación directa.');
      setRecordingActive(false);
    }

    const updateUiPhase = (nextPhase: 'countdown' | 'revealing_winner' | 'final_summary' | 'thank_you' | 'finalizing') => {
      if (lastPhaseRef.current !== nextPhase) {
        lastPhaseRef.current = nextPhase;
        setPhase(nextPhase);
      }
    };

    const updateUiStatus = (nextStatus: string) => {
      if (lastStatusRef.current !== nextStatus) {
        lastStatusRef.current = nextStatus;
        setStatusMessage(nextStatus);
      }
    };

    // Animation timeline parameters (participants are already loaded: start countdown immediately!)
    startTimeRef.current = performance.now();
    let currentPhase: 'countdown' | 'revealing_winner' | 'final_summary' | 'thank_you' | 'done' = 'countdown';
    let phaseStartTime = performance.now();

    // Confetti particles pool
    const confetti: ConfettiParticle[] = [];
    const colors = ['#FF4B72', '#7E3AF2', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#FFFFFF', '#FBBF24'];

    function createConfettiBurst(count: number, yOrigin = 750) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 20 + 8;
        confetti.push({
          x: CANVAS_WIDTH / 2 + (Math.random() - 0.5) * 400,
          y: yOrigin,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 14,
          size: Math.random() * 18 + 8,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.25,
          shape: Math.random() > 0.4 ? 'rect' : 'circle',
        });
      }
    }

    // Dynamic timing per winner
    const totalWinners = winners.length;
    const winnerSlotDuration = totalWinners === 1 ? 4000 : totalWinners <= 4 ? 3200 : 2500;
    const countdownDuration = 3200; // 3.2s countdown (3, 2, 1, ¡SORTEANDO!)
    const finalSummaryDuration = 4200; // 4.2s final summary with all winners
    const thankYouDuration = 3800; // 3.8s animated "GRACIAS POR PARTICIPAR" + large circular IG logo outro

    let currentWinnerIdx = 0;
    let rouletteShuffleIndex = 0;
    let hasBurstForWinner = false;

    // Helper: Draw rounded rect
    function roundRect(
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number
    ) {
      c.beginPath();
      c.moveTo(x + radius, y);
      c.lineTo(x + width - radius, y);
      c.quadraticCurveTo(x + width, y, x + width, y + radius);
      c.lineTo(x + width, y + height - radius);
      c.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      c.lineTo(x + radius, y + height);
      c.quadraticCurveTo(x, y + height, x, y + height - radius);
      c.lineTo(x, y + radius);
      c.quadraticCurveTo(x, y, x + radius, y);
      c.closePath();
    }

    // Helper: Draw avatar in circle or initial fallback
    function drawAvatarCircle(
      c: CanvasRenderingContext2D,
      imgKey: string,
      fallbackName: string,
      x: number,
      y: number,
      radius: number,
      borderColor = '#F59E0B',
      borderWidth = 6
    ) {
      c.save();

      // Outer glow shadow
      c.shadowColor = borderColor;
      c.shadowBlur = 24;

      // Outer border circle
      c.beginPath();
      c.arc(x, y, radius + borderWidth / 2, 0, Math.PI * 2);
      c.strokeStyle = borderColor;
      c.lineWidth = borderWidth;
      c.stroke();
      c.shadowBlur = 0;

      // Clip area
      c.beginPath();
      c.arc(x, y, radius, 0, Math.PI * 2);
      c.clip();

      const img = imageCache.current.get(imgKey);
      if (img && img.complete && img.naturalWidth > 0) {
        c.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
      } else {
        // Gradient fallback
        const grad = c.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
        grad.addColorStop(0, '#EF4444');
        grad.addColorStop(0.5, '#F43F5E');
        grad.addColorStop(1, '#8B5CF6');
        c.fillStyle = grad;
        c.fillRect(x - radius, y - radius, radius * 2, radius * 2);

        // Initial letter
        c.fillStyle = '#FFFFFF';
        c.font = `800 ${Math.round(radius * 0.9)}px "Plus Jakarta Sans", sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const initial = (fallbackName || 'G').replace(/^@/, '')[0]?.toUpperCase() || 'G';
        c.fillText(initial, x, y);
      }

      c.restore();
    }

    // Format handle or ticket number
    const formatName = (u: string) => {
      if (!u) return '';
      if (u.startsWith('Número') || u.startsWith('#') || u.includes(' ')) return u;
      return `@${u.replace(/^@/, '')}`;
    };

    // Main render loop
    const render = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const phaseElapsed = now - phaseStartTime;

      // 1. Clean white background with soft Instagram sunset warmth
      const bgGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      bgGrad.addColorStop(0, '#FFFFFF');
      bgGrad.addColorStop(0.3, '#FFF7F5');
      bgGrad.addColorStop(0.7, '#FFFDF8');
      bgGrad.addColorStop(1, '#FFFFFF');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Ambient subtle warm radial lighting
      const ambientGlow = ctx.createRadialGradient(CANVAS_WIDTH / 2, 750, 40, CANVAS_WIDTH / 2, 750, 680);
      ambientGlow.addColorStop(0, 'rgba(244, 63, 94, 0.08)');
      ambientGlow.addColorStop(0.5, 'rgba(245, 158, 11, 0.05)');
      ambientGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = ambientGlow;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Safe area visual header with Mascot Logo (Top margin ~180px)
      ctx.save();
      const mascotImg = imageCache.current.get('app_mascot');
      const headerY = 195;
      if (mascotImg && mascotImg.complete && mascotImg.naturalWidth > 0) {
        const mascotSize = 84;
        ctx.drawImage(mascotImg, CANVAS_WIDTH / 2 - 210, headerY - 58, mascotSize, mascotSize);
        ctx.fillStyle = '#18181B';
        ctx.font = '900 50px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('sorteoo', CANVAS_WIDTH / 2 - 110, headerY);
        // Instagram sunset gradient for .app
        const appGrad = ctx.createLinearGradient(CANVAS_WIDTH / 2 + 75, headerY - 30, CANVAS_WIDTH / 2 + 180, headerY);
        appGrad.addColorStop(0, '#F58529');
        appGrad.addColorStop(0.5, '#DD2A7B');
        appGrad.addColorStop(1, '#8134AF');
        ctx.fillStyle = appGrad;
        ctx.fillText('.app', CANVAS_WIDTH / 2 + 75, headerY);
      } else {
        ctx.fillStyle = '#18181B';
        ctx.font = '900 50px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🎁 sorteoo.app', CANVAS_WIDTH / 2, headerY);
      }

      ctx.fillStyle = '#71717A';
      ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      const organizerSubtitle =
        postDetails.author && !postDetails.author.startsWith('sorteo_')
          ? `@${postDetails.author.replace(/^@/, '')} · Sorteo Oficial Certificado`
          : 'Sorteo Oficial Certificado';
      ctx.fillText(organizerSubtitle, CANVAS_WIDTH / 2, 245);

      // Header subtle accent bar
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH / 2 - 180, 275);
      ctx.lineTo(CANVAS_WIDTH / 2 + 180, 275);
      ctx.stroke();
      ctx.restore();

      // ====================================================
      // PHASE 1: COUNTDOWN ("El sorteo comienza en... 3, 2, 1, SORTEANDO")
      // ====================================================
      if (currentPhase === 'countdown') {
        // Organizer Circular Logo & Ready Badge cleanly above countdown
        const logoY = 430;
        const logoRadius = 86;
        const hostFallbackName = postDetails.author || 'Sorteo';
        drawAvatarCircle(ctx, 'host_logo', hostFallbackName, CANVAS_WIDTH / 2, logoY, logoRadius, '#DD2A7B', 7);

        ctx.save();
        ctx.fillStyle = '#10B981';
        ctx.font = '800 26px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          `✓ ${participants.length.toLocaleString()} participantes listos`,
          CANVAS_WIDTH / 2,
          logoY + logoRadius + 48
        );

        // Small top text: "El sorteo comienza en..."
        ctx.fillStyle = '#E11D48';
        ctx.font = '800 34px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '2px';
        ctx.fillText('EL SORTEO COMIENZA EN...', CANVAS_WIDTH / 2, 640);

        // 4 sub-steps: 0-750ms -> 3, 750-1500ms -> 2, 1500-2250ms -> 1, 2250-3200ms -> ¡SORTEANDO!
        const stepIdx = Math.floor(phaseElapsed / 750);
        const subElapsed = (phaseElapsed % 750) / 750;
        const scale = 1.35 - subElapsed * 0.35;
        const alpha = Math.min(1, 0.4 + (1 - subElapsed) * 0.6);

        ctx.translate(CANVAS_WIDTH / 2, 895);
        ctx.scale(scale, scale);

        if (stepIdx <= 2) {
          const numberVal = 3 - stepIdx;
          updateUiStatus(`El sorteo comienza en ${numberVal}...`);

          // Shockwave pulsing rings
          ctx.beginPath();
          ctx.arc(0, 0, 175, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(244, 63, 94, ${alpha * 0.8})`;
          ctx.lineWidth = 12;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, 0, 205 + subElapsed * 30, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(245, 158, 11, ${Math.max(0, 0.6 - subElapsed * 0.6)})`;
          ctx.lineWidth = 4;
          ctx.stroke();

          // Big Number (Crisp dark on white)
          ctx.fillStyle = `#18181B`;
          ctx.font = '900 200px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${numberVal}`, 0, 0);
        } else {
          // Final countdown pulse: "¡SORTEANDO!"
          updateUiStatus('¡SORTEANDO GANADORES!');

          ctx.fillStyle = '#E11D48';
          ctx.font = '900 76px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('¡SORTEANDO!', 0, 0);

          ctx.fillStyle = '#52525B';
          ctx.font = '700 32px "Plus Jakarta Sans", sans-serif';
          ctx.fillText('Seleccionando ganadores oficiales...', 0, 95);
        }

        ctx.restore();

        if (phaseElapsed >= countdownDuration) {
          currentPhase = 'revealing_winner';
          phaseStartTime = now;
          currentWinnerIdx = 0;
          hasBurstForWinner = false;
          updateUiPhase('revealing_winner');
        }
      }

      // ====================================================
      // PHASE 2: SEQUENTIAL WINNER REVEAL
      // ====================================================
      else if (currentPhase === 'revealing_winner') {
        const winner = winners[currentWinnerIdx];
        const isLastWinner = currentWinnerIdx >= totalWinners - 1;

        // First 25% of slot time = Roulette shuffle teaser; Remaining 75% = The Grand Winner Reveal!
        const shuffleDuration = winnerSlotDuration * 0.25;
        const isShuffling = phaseElapsed < shuffleDuration;

        if (isShuffling) {
          // Roulette shuffle state
          if (Math.floor(phaseElapsed / 50) % 2 === 0 && participants.length > 0) {
            rouletteShuffleIndex = (rouletteShuffleIndex + 1) % participants.length;
          }
          const candidate = participants[rouletteShuffleIndex] || participants[0] || winner;

          updateUiStatus(`Buscando Ganador #${currentWinnerIdx + 1}...`);

          // Shuffling Card Box
          const boxY = 620;
          const boxH = 500;
          const boxW = 860;
          const boxX = (CANVAS_WIDTH - boxW) / 2;

          ctx.save();
          ctx.fillStyle = '#FFFFFF';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
          ctx.shadowBlur = 25;
          roundRect(ctx, boxX, boxY, boxW, boxH, 32);
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.strokeStyle = '#F43F5E';
          ctx.lineWidth = 3;
          ctx.stroke();

          // Searching badge
          ctx.fillStyle = '#F43F5E';
          roundRect(ctx, CANVAS_WIDTH / 2 - 190, boxY - 26, 380, 52, 26);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`BUSCANDO GANADOR #${currentWinnerIdx + 1}`, CANVAS_WIDTH / 2, boxY + 8);

          // Shuffling candidate avatar
          const candClean = (candidate?.username || '').replace(/^@/, '');
          drawAvatarCircle(ctx, `p_${candClean.toLowerCase()}`, candClean, CANVAS_WIDTH / 2, boxY + 160, 65, '#F43F5E', 4);

          // Shuffling candidate username
          ctx.fillStyle = '#18181B';
          ctx.font = '800 48px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(formatName(candidate?.username || ''), CANVAS_WIDTH / 2, boxY + 310);

          // Shuffling candidate comment (null-safe)
          ctx.fillStyle = '#71717A';
          ctx.font = '500 26px "Plus Jakarta Sans", sans-serif';
          const rawCandComment = candidate?.comment || 'Participando en el sorteo';
          const candComment = rawCandComment.length > 55 ? rawCandComment.substring(0, 52) + '...' : rawCandComment;
          ctx.fillText(`"${candComment}"`, CANVAS_WIDTH / 2, boxY + 375);

          // PRNG Verification tag
          ctx.fillStyle = '#A1A1AA';
          ctx.font = '600 22px "JetBrains Mono", monospace';
          ctx.fillText(`Algoritmo Criptográfico Seguro · sorteoo.app`, CANVAS_WIDTH / 2, boxY + 445);
          ctx.restore();
        } else {
          // THE GRAND REVEAL OF GANADOR #{currentWinnerIdx + 1}
          if (!hasBurstForWinner) {
            hasBurstForWinner = true;
            createConfettiBurst(120, 650);
          }

          updateUiStatus(`¡GANADOR #${currentWinnerIdx + 1}: ${formatName(winner?.username || '')}!`);

          const cardY = 510;
          const isMultibrand = Boolean(winner?.assignedBrand || winner?.assignedPrize || postDetails.multibrandBrandsConfig);
          const cardH = isMultibrand ? 690 : 610;
          const cardW = 880;
          const cardX = (CANVAS_WIDTH - cardW) / 2;

          ctx.save();

          // Card white background with crisp shadow
          ctx.shadowColor = 'rgba(244, 63, 94, 0.2)';
          ctx.shadowBlur = 40;
          ctx.fillStyle = '#FFFFFF';
          roundRect(ctx, cardX, cardY, cardW, cardH, 36);
          ctx.fill();

          ctx.shadowBlur = 0;
          // Border in vibrant Instagram gradient
          const borderGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
          borderGrad.addColorStop(0, '#F58529');
          borderGrad.addColorStop(0.5, '#DD2A7B');
          borderGrad.addColorStop(1, '#8134AF');
          ctx.strokeStyle = borderGrad;
          ctx.lineWidth = 5;
          ctx.stroke();

          // Badge: "👑 GANADOR 1 👑" or "GANADOR 1 de N"
          const badgeGrad = ctx.createLinearGradient(CANVAS_WIDTH / 2 - 210, cardY - 26, CANVAS_WIDTH / 2 + 210, cardY + 26);
          badgeGrad.addColorStop(0, '#F58529');
          badgeGrad.addColorStop(0.5, '#DD2A7B');
          badgeGrad.addColorStop(1, '#8134AF');
          ctx.fillStyle = badgeGrad;
          const badgeText = totalWinners > 1 ? `👑 GANADOR ${currentWinnerIdx + 1} DE ${totalWinners} 👑` : '👑 ¡GANADOR OFICIAL! 👑';
          roundRect(ctx, CANVAS_WIDTH / 2 - 210, cardY - 26, 420, 52, 26);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '900 24px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(badgeText, CANVAS_WIDTH / 2, cardY + 9);

          // Winner extracted profile picture in large circle (180px diameter)
          const winnerClean = (winner?.username || '').replace(/^@/, '');
          const avatarKey = `avatar_${winnerClean.toLowerCase()}`;
          const avatarY = cardY + 145;
          const avatarRadius = 85; // 170px diameter

          drawAvatarCircle(ctx, avatarKey, winnerClean, CANVAS_WIDTH / 2, avatarY, avatarRadius, '#F43F5E', 7);

          // Winner username
          ctx.fillStyle = '#18181B';
          ctx.font = '900 52px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(formatName(winner?.username), CANVAS_WIDTH / 2, cardY + 305);

          // Winner comment
          ctx.fillStyle = '#52525B';
          ctx.font = 'italic 600 28px "Plus Jakarta Sans", sans-serif';
          const winComment = winner?.comment || '¡Participando en el sorteo!';
          const truncatedComment = winComment.length > 55 ? winComment.substring(0, 52) + '...' : winComment;
          ctx.fillText(`“${truncatedComment}”`, CANVAS_WIDTH / 2, cardY + 365);

          // MULTIBRAND DEDICATED SECTION: Brand name & Prize
          if (isMultibrand) {
            const brandY = cardY + 415;
            const brandW = cardW - 70;
            const brandX = cardX + 35;

            // Brand & Prize Container Box (light clean card)
            ctx.fillStyle = '#F8FAFC';
            ctx.strokeStyle = '#E2E8F0';
            ctx.lineWidth = 2;
            roundRect(ctx, brandX, brandY, brandW, 140, 24);
            ctx.fill();
            ctx.stroke();

            // Brand Instagram handle
            ctx.fillStyle = '#E11D48';
            ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
            ctx.textAlign = 'center';
            const brandHandle = winner.assignedBrand
              ? (winner.assignedBrand.startsWith('@') ? winner.assignedBrand : `@${winner.assignedBrand}`)
              : '@emprendimiento';
            ctx.fillText(`🏢 ${brandHandle}`, CANVAS_WIDTH / 2, brandY + 45);

            // Prize Capsule Badge
            const prizeText = winner.assignedPrize ? `🎁 Premio: ${winner.assignedPrize}` : '🎁 Premio Oficial';
            const prizeGrad = ctx.createLinearGradient(CANVAS_WIDTH / 2 - 260, brandY + 70, CANVAS_WIDTH / 2 + 260, brandY + 120);
            prizeGrad.addColorStop(0, '#F59E0B');
            prizeGrad.addColorStop(1, '#EF4444');
            ctx.fillStyle = prizeGrad;
            roundRect(ctx, CANVAS_WIDTH / 2 - 260, brandY + 70, 520, 50, 25);
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '900 24px "Plus Jakarta Sans", sans-serif';
            const truncPrize = prizeText.length > 36 ? prizeText.substring(0, 34) + '...' : prizeText;
            ctx.fillText(truncPrize, CANVAS_WIDTH / 2, brandY + 104);
          }

          // Verified Official Winner Badge
          const verifiedBadgeY = isMultibrand ? cardY + 600 : cardY + 465;
          ctx.fillStyle = '#10B981';
          roundRect(ctx, CANVAS_WIDTH / 2 - 180, verifiedBadgeY, 360, 56, 28);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('✓ GANADOR OFICIAL', CANVAS_WIDTH / 2, verifiedBadgeY + 36);

          ctx.restore();
        }

        // Transition to next winner OR to final summary
        if (phaseElapsed >= winnerSlotDuration) {
          if (!isLastWinner) {
            currentWinnerIdx += 1;
            phaseStartTime = now;
            hasBurstForWinner = false;
          } else {
            currentPhase = 'final_summary';
            phaseStartTime = now;
            updateUiPhase('final_summary');
            updateUiStatus('¡Lista Oficial de Ganadores!');
            createConfettiBurst(140, 500);
          }
        }
      }

      // ====================================================
      // PHASE 3: FINAL SUMMARY ("Luego a lo ultimo recien colocar la lista de ganadores completos")
      // ====================================================
      else if (currentPhase === 'final_summary') {
        updateUiStatus('¡Lista Oficial de Ganadores Completa!');

        ctx.save();
        // Title banner
        ctx.fillStyle = '#E11D48';
        ctx.font = '900 48px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🏆 ¡LISTA OFICIAL DE GANADORES! 🏆', CANVAS_WIDTH / 2, 400);

        ctx.fillStyle = '#71717A';
        ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(
          `${totalWinners} ganador${totalWinners > 1 ? 'es' : ''} certificado${totalWinners > 1 ? 's' : ''} en sorteoo.app`,
          CANVAS_WIDTH / 2,
          445
        );
        ctx.restore();

        // Render full list of winners
        const startY = 490;
        const maxVisible = totalWinners <= 3 ? totalWinners : totalWinners <= 5 ? 5 : 7;
        const rowHeight = totalWinners <= 3 ? 140 : totalWinners <= 5 ? 115 : 95;
        const listWidth = 920;
        const listX = (CANVAS_WIDTH - listWidth) / 2;

        // Auto-scroll if totalWinners > maxVisible
        let scrollOffset = 0;
        if (totalWinners > maxVisible) {
          const scrollSpeed = 0.0012;
          scrollOffset = Math.min(totalWinners - maxVisible, Math.floor(phaseElapsed * scrollSpeed));
        }

        const visibleWinners = winners.slice(scrollOffset, scrollOffset + maxVisible);

        visibleWinners.forEach((w, localIdx) => {
          const globalIdx = scrollOffset + localIdx + 1;
          const rowY = startY + localIdx * (rowHeight + 14);

          ctx.save();
          // Clean white card with soft shadow
          ctx.fillStyle = '#FFFFFF';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.06)';
          ctx.shadowBlur = 18;
          roundRect(ctx, listX, rowY, listWidth, rowHeight, 22);
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.strokeStyle = '#E4E4E7';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Badge: "Ganador X"
          const badgeW = 150;
          const rowBadgeGrad = ctx.createLinearGradient(listX + 16, rowY, listX + 16 + badgeW, rowY);
          rowBadgeGrad.addColorStop(0, '#EF4444');
          rowBadgeGrad.addColorStop(1, '#F59E0B');
          ctx.fillStyle = rowBadgeGrad;
          roundRect(ctx, listX + 16, rowY + (rowHeight - 44) / 2, badgeW, 44, 14);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '900 20px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`Ganador ${globalIdx}`, listX + 16 + badgeW / 2, rowY + rowHeight / 2 + 7);

          // Mini circular avatar
          const uClean = (w.username || '').replace(/^@/, '');
          const miniAvatarRadius = Math.round(rowHeight * 0.32);
          const miniAvatarX = listX + badgeW + 32 + miniAvatarRadius;
          const miniAvatarY = rowY + rowHeight / 2;
          drawAvatarCircle(ctx, `avatar_${uClean.toLowerCase()}`, uClean, miniAvatarX, miniAvatarY, miniAvatarRadius, '#F43F5E', 3);

          // Winner username & prize text
          ctx.textAlign = 'left';
          const textStartX = miniAvatarX + miniAvatarRadius + 20;

          if (w.assignedBrand || w.assignedPrize) {
            // Multibrand row styling
            ctx.fillStyle = '#18181B';
            ctx.font = '900 28px "Plus Jakarta Sans", sans-serif';
            ctx.fillText(formatName(w.username), textStartX, rowY + rowHeight / 2 - 8);

            ctx.fillStyle = '#D97706';
            ctx.font = '800 20px "Plus Jakarta Sans", sans-serif';
            const prizeDesc = `${w.assignedPrize || 'Premio'} · ${w.assignedBrand || ''}`;
            const truncDesc = prizeDesc.length > 36 ? prizeDesc.substring(0, 34) + '...' : prizeDesc;
            ctx.fillText(truncDesc, textStartX, rowY + rowHeight / 2 + 22);
          } else {
            // Standard giveaway row styling
            ctx.fillStyle = '#18181B';
            ctx.font = '900 32px "Plus Jakarta Sans", sans-serif';
            const nameStr = formatName(w.username);
            const truncName = nameStr.length > 26 ? nameStr.substring(0, 24) + '...' : nameStr;
            ctx.fillText(truncName, textStartX, rowY + rowHeight / 2 + 10);
          }

          // Verified Checkmark Icon
          ctx.fillStyle = '#10B981';
          ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText('✓', listX + listWidth - 24, rowY + rowHeight / 2 + 9);

          ctx.restore();
        });

        // Safe Area Footer: Audit Verification Code & Date (Bottom margin ~250px)
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(CANVAS_WIDTH / 2 - 240, 1680);
        ctx.lineTo(CANVAS_WIDTH / 2 + 240, 1680);
        ctx.stroke();

        ctx.fillStyle = '#71717A';
        ctx.font = '700 24px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Certificado: ${audit.verificationCode}`, CANVAS_WIDTH / 2, 1720);

        ctx.fillStyle = '#A1A1AA';
        ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
        const formattedDate = new Date(audit.drawnAt).toLocaleString('es-ES', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
        ctx.fillText(`Verificado en sorteoo.app · ${formattedDate}`, CANVAS_WIDTH / 2, 1760);
        ctx.restore();

        // Transition from final summary to "GRACIAS POR PARTICIPAR" animated outro
        if (phaseElapsed >= finalSummaryDuration) {
          currentPhase = 'thank_you';
          phaseStartTime = now;
          updateUiPhase('thank_you');
          updateUiStatus('¡Gracias por participar!');
          createConfettiBurst(90, 760);
        }
      }

      // ====================================================
      // PHASE 4: ANIMATED OUTRO ("¡GRACIAS POR PARTICIPAR!" + LARGE ROUND IG LOGO)
      // ====================================================
      else if (currentPhase === 'thank_you') {
        updateUiStatus('¡Gracias por participar!');

        const logoCenterX = CANVAS_WIDTH / 2;
        const logoCenterY = 760 + Math.sin(phaseElapsed * 0.004) * 10;
        const logoRadius = 160; // 320px large round organizer logo
        const pulseScale = 1 + Math.sin(phaseElapsed * 0.005) * 0.04;
        const entryProgress = Math.min(1, phaseElapsed / 550);
        const popScale = 0.75 + 0.25 * (1 - Math.pow(1 - entryProgress, 3));

        // 1. Animated rotating Instagram gradient halo ring around large circular logo
        ctx.save();
        ctx.translate(logoCenterX, logoCenterY);
        ctx.scale(pulseScale * popScale, pulseScale * popScale);

        // Outer soft glowing aura
        const outerAura = ctx.createRadialGradient(0, 0, logoRadius, 0, 0, logoRadius + 75);
        outerAura.addColorStop(0, 'rgba(221, 42, 123, 0.28)');
        outerAura.addColorStop(0.6, 'rgba(245, 133, 41, 0.14)');
        outerAura.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = outerAura;
        ctx.beginPath();
        ctx.arc(0, 0, logoRadius + 75, 0, Math.PI * 2);
        ctx.fill();

        // Spinning gradient ring
        ctx.save();
        ctx.rotate(phaseElapsed * 0.0022);
        const ringGrad = ctx.createLinearGradient(-logoRadius - 20, -logoRadius - 20, logoRadius + 20, logoRadius + 20);
        ringGrad.addColorStop(0, '#F58529');
        ringGrad.addColorStop(0.45, '#DD2A7B');
        ringGrad.addColorStop(0.8, '#8134AF');
        ringGrad.addColorStop(1, '#F58529');
        ctx.strokeStyle = ringGrad;
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.arc(0, 0, logoRadius + 22, 0, Math.PI * 2);
        ctx.stroke();

        // Orbiting sparkling stars around the circular logo
        for (let s = 0; s < 4; s++) {
          const angle = (s * Math.PI) / 2;
          const sx = Math.cos(angle) * (logoRadius + 52);
          const sy = Math.sin(angle) * (logoRadius + 52);
          const twinkle = 0.65 + 0.35 * Math.sin(phaseElapsed * 0.008 + s * 1.5);
          ctx.fillStyle = s % 2 === 0 ? '#F58529' : '#DD2A7B';
          ctx.globalAlpha = twinkle;
          ctx.beginPath();
          ctx.arc(sx, sy, 10 * twinkle, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        ctx.restore();

        // 2. Large Circular Organizer Instagram Logo inside the animated ring
        ctx.save();
        ctx.translate(logoCenterX, logoCenterY);
        ctx.scale(pulseScale * popScale, pulseScale * popScale);
        const hostFallbackName = postDetails.author || 'Sorteo';
        drawAvatarCircle(ctx, 'host_logo', hostFallbackName, 0, 0, logoRadius, '#FFFFFF', 10);
        ctx.restore();

        // 3. Organizer @handle below the large circular logo
        ctx.save();
        const hasIgHandle =
          postDetails.author &&
          !postDetails.author.startsWith('sorteo_') &&
          postDetails.author !== 'lista_personalizada';
        const displayOrganizer = hasIgHandle
          ? `@${postDetails.author.replace(/^@/, '')}`
          : 'Sorteo Oficial Certificado';

        ctx.fillStyle = '#18181B';
        ctx.font = '800 38px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(displayOrganizer, CANVAS_WIDTH / 2, logoCenterY + logoRadius + 95);

        // 4. Animated headline: "GRACIAS POR PARTICIPAR"
        const textAlpha = Math.min(1, phaseElapsed / 500);
        const textSlideY = (1 - Math.min(1, phaseElapsed / 500)) * 30;
        ctx.globalAlpha = textAlpha;

        const titleY = 1135 + textSlideY;
        const textGrad = ctx.createLinearGradient(CANVAS_WIDTH / 2 - 360, titleY - 50, CANVAS_WIDTH / 2 + 360, titleY);
        textGrad.addColorStop(0, '#F58529');
        textGrad.addColorStop(0.5, '#DD2A7B');
        textGrad.addColorStop(1, '#8134AF');
        ctx.fillStyle = textGrad;
        ctx.font = '900 66px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('¡GRACIAS POR', CANVAS_WIDTH / 2, titleY);
        ctx.fillText('PARTICIPAR!', CANVAS_WIDTH / 2, titleY + 76);

        ctx.fillStyle = '#52525B';
        ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('¡Felicidades a los ganadores y mucha suerte en el próximo!', CANVAS_WIDTH / 2, titleY + 145);

        // Verification footer
        ctx.fillStyle = '#71717A';
        ctx.font = '700 24px "JetBrains Mono", monospace';
        ctx.fillText(`Certificado: ${audit.verificationCode}`, CANVAS_WIDTH / 2, 1720);
        ctx.fillStyle = '#A1A1AA';
        ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('Verificado en sorteoo.app', CANVAS_WIDTH / 2, 1760);
        ctx.restore();

        // Finish recording after holding animated thank-you outro
        if (phaseElapsed >= thankYouDuration) {
          currentPhase = 'done';
          updateUiPhase('finalizing');
          updateUiStatus('Generando archivo de video oficial...');

          if (recorder && recorder.state === 'recording') {
            recorder.onstop = () => {
              const videoBlob = new Blob(chunksRef.current, {
                type: selectedMimeType || 'video/webm',
              });

              const objectUrl = URL.createObjectURL(videoBlob);
              onFinish({
                videoBlob,
                videoDataUrl: objectUrl,
                durationSeconds: Math.round(elapsed / 1000),
                mimeType: selectedMimeType || 'video/webm',
                recordingError: recordingError || undefined,
              });
            };
            recorder.stop();
          } else {
            onFinish({
              videoBlob: null,
              videoDataUrl: null,
              durationSeconds: Math.round(elapsed / 1000),
              mimeType: 'none',
              recordingError: recordingError || 'Grabación no disponible',
            });
          }
          return;
        }
      }

      // Draw active confetti particles
      for (let i = confetti.length - 1; i >= 0; i--) {
        const p = confetti[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.38; // gravity
        p.rotation += p.vRot;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        if (p.y > CANVAS_HEIGHT + 50) {
          confetti.splice(i, 1);
        }
      }

      if (currentPhase !== 'done') {
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (recorder && recorder.state === 'recording') {
        try {
          recorder.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] py-8 px-4 bg-[#F8F9FC]">
      {/* Top indicator bar */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between text-xs text-neutral-500 font-semibold">
        <div className="flex items-center gap-2">
          {recordingActive ? (
            <span className="flex items-center gap-1.5 text-rose-600 font-black">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              GRABANDO VIDEO VERTICAL (9:16)
            </span>
          ) : (
            <span className="text-amber-600 flex items-center gap-1 font-bold">
              <AlertCircle className="w-3.5 h-3.5" />
              Modo sin grabación directa
            </span>
          )}
        </div>
        <span className="font-mono tabular-nums text-neutral-600 font-black bg-white px-2.5 py-1 rounded-lg border border-neutral-200 shadow-2xs">
          ID: {audit.verificationCode}
        </span>
      </div>

      {/* 9:16 Live Canvas Display */}
      <div className="relative w-full max-w-[380px] aspect-[9/16] bg-white rounded-3xl overflow-hidden shadow-2xl shadow-neutral-300/60 border-2 border-neutral-200/90 ring-4 ring-rose-500/10 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-cover block"
        />

        {/* Floating status pill for the user */}
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md border border-neutral-200/90 rounded-2xl px-4 py-2.5 text-center pointer-events-none shadow-xl flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500 animate-spin shrink-0" />
          <p className="text-xs text-neutral-900 font-black truncate">{statusMessage}</p>
        </div>
      </div>

      {/* Stage notes */}
      <div className="mt-4 text-center max-w-sm">
        <p className="text-xs text-neutral-500 font-medium">
          {phase === 'finalizing'
            ? 'Completando y procesando el archivo de video para Stories y Reels...'
            : 'Grabando video vertical en alta definición 1080×1920 a 30 FPS.'}
        </p>
      </div>
    </div>
  );
};
