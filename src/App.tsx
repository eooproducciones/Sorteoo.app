/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingHero } from './components/LandingHero';
import { LandingFeatures } from './components/LandingFeatures';
import { LandingHowItWorks } from './components/LandingHowItWorks';
import { LandingComparison } from './components/LandingComparison';
import { CreateGiveawayWizard } from './components/CreateGiveawayWizard';
import { LiveGiveawayStage } from './components/LiveGiveawayStage';
import { GiveawayResultsView } from './components/GiveawayResultsView';
import { MyGiveawaysView } from './components/MyGiveawaysView';
import { ProfileView } from './components/ProfileView';
import { VerifyView } from './components/VerifyView';
import { AdminPanelView } from './components/AdminPanelView';
import { AuthModal } from './components/AuthModal';
import { PENDING_CHECKOUT_STORAGE_KEY } from './components/CheckoutPaymentBox';
import { Giveaway, Participant, GiveawayFilters, PostDetails, GiveawayAudit } from './types/giveaway';
import { executeDraw } from './utils/giveawayLogic';
import { api } from './services/api';

function MainApp() {
  const { user, openAuthModal } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [initialWizardQuery, setInitialWizardQuery] = useState<string>('');

  // Active draw orchestration state
  const [activeDrawConfig, setActiveDrawConfig] = useState<{
    postUrl: string;
    postDetails: PostDetails;
    participants: Participant[];
    filters: GiveawayFilters;
    winnersCount: number;
    substitutesCount: number;
    winners: Participant[];
    substitutes: Participant[];
    audit: GiveawayAudit;
  } | null>(null);

  // Active completed giveaway state for Results view
  const [completedGiveaway, setCompletedGiveaway] = useState<Giveaway | null>(null);
  const [recordedVideoBlob, setRecordedVideoBlob] = useState<Blob | null>(null);
  const [recordedVideoDataUrl, setRecordedVideoDataUrl] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | undefined>(undefined);
  const [isPreparingVideo, setIsPreparingVideo] = useState<boolean>(false);
  const videoUploadPromiseRef = useRef<Promise<void> | null>(null);

  const waitForVideoReady = async () => {
    if (videoUploadPromiseRef.current) {
      await videoUploadPromiseRef.current;
    }
  };

  // Verification code from URL hash (e.g. #verify-SRT-...)
  const [initialVerifyCode, setInitialVerifyCode] = useState<string>('');
  const [mpReturnNotice, setMpReturnNotice] = useState<{
    type: 'info' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    // Check hash for direct verification links
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#verify-')) {
        const code = hash.replace('#verify-', '');
        setInitialVerifyCode(code);
        setCurrentTab('verify');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Handle return from Mercado Pago Checkout Pro
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mpRef = params.get('mp_ref') || params.get('external_reference');
    if (!mpRef) return;

    const paymentId = params.get('payment_id') || params.get('collection_id') || undefined;
    const mpStatus = params.get('mp_status') || params.get('status') || params.get('collection_status');

    // Clean URL immediately
    try {
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    } catch {
      // ignore
    }

    if (mpStatus === 'failure') {
      setMpReturnNotice({
        type: 'error',
        message: 'El pago en Mercado Pago fue cancelado o rechazado. Podés intentar nuevamente o ingresar un cupón.',
      });
      return;
    }

    setMpReturnNotice({
      type: 'info',
      message: 'Verificando tu pago en Mercado Pago para iniciar el sorteo...',
    });

    api
      .getPaymentStatus(mpRef, paymentId)
      .then((res) => {
        if (res.approved) {
          let storedDrawConfig: any = res.drawConfig || null;
          if (!storedDrawConfig) {
            try {
              const raw = localStorage.getItem(PENDING_CHECKOUT_STORAGE_KEY);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.drawConfig) storedDrawConfig = parsed.drawConfig;
              }
            } catch {
              // ignore
            }
          }
          try {
            localStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
          } catch {
            // ignore
          }

          setMpReturnNotice(null);
          if (storedDrawConfig) {
            handleStartGiveaway(storedDrawConfig);
          } else {
            setMpReturnNotice({
              type: 'info',
              message: '¡Pago aprobado! Ya podés iniciar tu sorteo.',
            });
          }
        } else {
          setMpReturnNotice({
            type: 'error',
            message: 'Tu pago todavía está pendiente de acreditación en Mercado Pago.',
          });
        }
      })
      .catch((err: any) => {
        setMpReturnNotice({
          type: 'error',
          message: err?.message || 'No se pudo confirmar el pago en Mercado Pago.',
        });
      });
  }, []);

  // Handler when user clicks "¡Sortear y Grabar Video!" in the wizard (seamless for all users, no forced login)
  const handleStartGiveaway = async (config: {
    postUrl: string;
    postDetails: PostDetails;
    participants: Participant[];
    filters: GiveawayFilters;
    winnersCount: number;
    substitutesCount: number;
  }) => {
    try {
      // 1. Execute deterministic cryptographic selection (with brand & prize assignment for Multimarcas)
      const brandsConfig = (config.postDetails as any)?.multibrandBrandsConfig;
      const hostAuthor = config.postDetails?.author;
      const drawResult = await executeDraw(
        config.participants,
        config.winnersCount,
        config.substitutesCount,
        brandsConfig,
        hostAuthor
      );

      // 2. Prepare state for live 9:16 stage
      setActiveDrawConfig({
        ...config,
        winners: drawResult.winners,
        substitutes: drawResult.substitutes,
        audit: drawResult.audit,
      });

      // 3. Immediately switch to live stage (video recording starts automatically!)
      setCurrentTab('live');
    } catch (err: any) {
      alert(err.message || 'Error al ejecutar el sorteo');
    }
  };

  // Handler when live stage completes animation and automatic video recording
  const handleFinishLiveDraw = async (result: {
    videoBlob: Blob | null;
    videoDataUrl: string | null;
    durationSeconds: number;
    mimeType: string;
    recordingError?: string;
  }) => {
    if (!activeDrawConfig) return;

    const localVideoUrl = result.videoBlob
      ? URL.createObjectURL(result.videoBlob)
      : result.videoDataUrl || null;

    setRecordedVideoBlob(result.videoBlob);
    setRecordedVideoDataUrl(localVideoUrl);
    setRecordingError(result.recordingError);

    let savedGiveaway: Giveaway;

    try {
      // 1. Save giveaway to server database
      const createRes = await api.createGiveaway({
        postUrl: activeDrawConfig.postUrl,
        postDetails: activeDrawConfig.postDetails,
        totalParticipantsDetected: activeDrawConfig.participants.length,
        validParticipantsCount: activeDrawConfig.participants.length,
        filtersApplied: activeDrawConfig.filters,
        winnersCount: activeDrawConfig.winnersCount,
        substitutesCount: activeDrawConfig.substitutesCount,
        winners: activeDrawConfig.winners,
        substitutes: activeDrawConfig.substitutes,
        audit: activeDrawConfig.audit,
        video: {
          hasVideo: Boolean(result.videoBlob),
          videoDurationSeconds: result.durationSeconds,
          videoMimeType: result.mimeType,
          recordedAt: new Date().toISOString(),
        },
        multibrandMeta: (activeDrawConfig.postDetails as any)?.multibrandMeta,
      });

      savedGiveaway = createRes.giveaway;
    } catch (err: any) {
      console.warn('Error saving giveaway to server, using local certificate:', err);
      // Fallback local display
      savedGiveaway = {
        id: `srt_${Date.now()}`,
        userId: user?.id || 'usr_local',
        postUrl: activeDrawConfig.postUrl,
        postDetails: activeDrawConfig.postDetails,
        status: 'completed',
        createdAt: new Date().toISOString(),
        totalParticipantsDetected: activeDrawConfig.participants.length,
        validParticipantsCount: activeDrawConfig.participants.length,
        filtersApplied: activeDrawConfig.filters,
        winnersCount: activeDrawConfig.winnersCount,
        substitutesCount: activeDrawConfig.substitutesCount,
        winners: activeDrawConfig.winners,
        substitutes: activeDrawConfig.substitutes,
        audit: activeDrawConfig.audit,
        video: {
          hasVideo: Boolean(result.videoBlob),
          videoDurationSeconds: result.durationSeconds,
          videoMimeType: result.mimeType,
          recordedAt: new Date().toISOString(),
        },
      };
    }

    // 2. Save recent snapshot locally (so guests & same-device users can always see it in Mis Sorteos) and switch to results immediately
    api.saveLocalGiveawaySnapshot(savedGiveaway);
    setCompletedGiveaway(savedGiveaway);
    setCurrentTab('results');

    // 3. Upload video file to server (chunked when > 2.5 MB) & update preview stream once universal MP4 is ready
    if (result.videoBlob && savedGiveaway.id) {
      setIsPreparingVideo(true);
      const blobToUpload = result.videoBlob;
      const giveawayId = savedGiveaway.id;
      const uploadTask = (async () => {
        try {
          const upRes = await api.uploadGiveawayVideoBinary(
            giveawayId,
            blobToUpload,
            result.mimeType,
            result.durationSeconds
          );
          if (upRes?.video) {
            setCompletedGiveaway((prev) => {
              if (prev && prev.id === giveawayId) {
                const updated = { ...prev, video: upRes.video };
                api.saveLocalGiveawaySnapshot(updated);
                return updated;
              }
              return prev;
            });
          }
          if (upRes?.mp4Ready) {
            setRecordedVideoDataUrl(`/api/giveaways/${giveawayId}/video-stream?v=${Date.now()}`);
          }
        } catch (binErr: any) {
          console.warn('Video upload note, checking fallback:', binErr);
          if (blobToUpload.size <= 18 * 1024 * 1024) {
            try {
              const base64DataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(new Error('No se pudo leer el video'));
                reader.readAsDataURL(blobToUpload);
              });
              if (base64DataUrl) {
                const upRes = await api.uploadGiveawayVideo(
                  giveawayId,
                  base64DataUrl,
                  result.mimeType,
                  result.durationSeconds
                );
                if (upRes?.video) {
                  setCompletedGiveaway((prev) =>
                    prev && prev.id === giveawayId ? { ...prev, video: upRes.video } : prev
                  );
                }
                if (upRes?.mp4Ready) {
                  setRecordedVideoDataUrl(`/api/giveaways/${giveawayId}/video-stream?v=${Date.now()}`);
                }
                return;
              }
            } catch (vErr: any) {
              console.warn('Base64 upload fallback error:', vErr);
            }
          }
          setRecordingError(binErr?.message || 'No se pudo subir el video al servidor.');
        }
      })().finally(() => {
        setIsPreparingVideo(false);
      });
      videoUploadPromiseRef.current = uploadTask;
    } else {
      videoUploadPromiseRef.current = null;
      setIsPreparingVideo(false);
    }
  };

  const handleSelectFromHistory = (giveaway: Giveaway) => {
    videoUploadPromiseRef.current = null;
    setIsPreparingVideo(false);
    setRecordingError(undefined);
    setCompletedGiveaway(giveaway);
    setRecordedVideoBlob(null);
    setRecordedVideoDataUrl(null);
    setCurrentTab('results');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-neutral-900 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onNewGiveaway={() => {
          setInitialWizardQuery('');
          setCurrentTab('create');
        }}
      />

      {/* Main Content View Switcher */}
      <main className="flex-1">
        {mpReturnNotice && (
          <div className="max-w-4xl mx-auto px-4 pt-4">
            <div
              className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 ${
                mpReturnNotice.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-sky-50 border-sky-200 text-sky-800'
              }`}
            >
              <span>{mpReturnNotice.message}</span>
              <button
                type="button"
                onClick={() => setMpReturnNotice(null)}
                className="text-base leading-none px-1.5 opacity-70 hover:opacity-100 cursor-pointer"
              >
                ×
              </button>
            </div>
          </div>
        )}
        {currentTab === 'home' && (
          <>
            <LandingHero
              onStartGiveaway={(query?: string) => {
                setInitialWizardQuery(query || '');
                setCurrentTab('create');
              }}
            />
            <LandingFeatures />
            <LandingHowItWorks />
            <LandingComparison />
          </>
        )}

        {currentTab === 'create' && (
          <CreateGiveawayWizard
            initialQuery={initialWizardQuery}
            onStartGiveaway={handleStartGiveaway}
            onCancel={() => setCurrentTab('home')}
          />
        )}

        {currentTab === 'live' && activeDrawConfig && (
          <LiveGiveawayStage
            postDetails={activeDrawConfig.postDetails}
            participants={activeDrawConfig.participants}
            winners={activeDrawConfig.winners}
            substitutes={activeDrawConfig.substitutes}
            audit={activeDrawConfig.audit}
            onFinish={handleFinishLiveDraw}
          />
        )}

        {currentTab === 'results' && completedGiveaway && (
          <GiveawayResultsView
            giveaway={completedGiveaway}
            videoBlob={recordedVideoBlob}
            videoDataUrl={recordedVideoDataUrl}
            recordingError={recordingError}
            isPreparingVideo={isPreparingVideo}
            waitForVideoReady={waitForVideoReady}
            onNewGiveaway={() => setCurrentTab('create')}
            onGoToHistory={() => setCurrentTab('my-giveaways')}
          />
        )}

        {currentTab === 'my-giveaways' && (
          <MyGiveawaysView
            onNewGiveaway={() => setCurrentTab('create')}
            onSelectGiveaway={handleSelectFromHistory}
          />
        )}

        {currentTab === 'profile' && (
          <ProfileView
            initialSubTab="giveaways"
            onNewGiveaway={() => setCurrentTab('create')}
            onSelectGiveaway={handleSelectFromHistory}
          />
        )}

        {currentTab === 'verify' && (
          <VerifyView
            initialCode={initialVerifyCode}
            onGoHome={() => setCurrentTab('home')}
          />
        )}

        {currentTab === 'admin' && (
          <AdminPanelView onGoHome={() => setCurrentTab('home')} />
        )}
      </main>

      {/* Footer */}
      <Footer onNavigate={setCurrentTab} />

      {/* Authentication Modal */}
      <AuthModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
