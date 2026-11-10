/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
import { AuthModal } from './components/AuthModal';
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

  // Verification code from URL hash (e.g. #verify-SRT-...)
  const [initialVerifyCode, setInitialVerifyCode] = useState<string>('');

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

    setRecordedVideoBlob(result.videoBlob);
    setRecordedVideoDataUrl(result.videoDataUrl);
    setRecordingError(result.recordingError);

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

      const savedGiveaway = createRes.giveaway;

      // 2. Upload video file to server if available
      if (result.videoDataUrl) {
        try {
          await api.uploadGiveawayVideo(
            savedGiveaway.id,
            result.videoDataUrl,
            result.mimeType,
            result.durationSeconds
          );
          savedGiveaway.video.hasVideo = true;
        } catch (vErr) {
          console.warn('Video upload error:', vErr);
        }
      }

      setCompletedGiveaway(savedGiveaway);
      setCurrentTab('results');
    } catch (err: any) {
      console.error('Error saving giveaway to server:', err);
      // Fallback local display
      setCompletedGiveaway({
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
        },
      });
      setCurrentTab('results');
    }
  };

  const handleSelectFromHistory = (giveaway: Giveaway) => {
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
            onNewGiveaway={() => setCurrentTab('create')}
            onGoToHistory={() => setCurrentTab('my-giveaways')}
          />
        )}

        {currentTab === 'my-giveaways' && (
          <ProfileView
            initialSubTab="giveaways"
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
