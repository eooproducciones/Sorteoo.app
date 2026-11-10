import React, { useState, useRef } from 'react';
import {
  Participant,
  GiveawayFilters,
  PostDetails,
  InstagramProfile,
  InstagramProfilePost,
  MultibrandUnifySummary,
  MultibrandBrandConfig,
} from '../types/giveaway';
import { api } from '../services/api';
import { filterParticipants } from '../utils/giveawayLogic';
import { MultibrandSection } from './MultibrandSection';
import {
  AtSign,
  Link as LinkIcon,
  Play,
  Grid,
  Heart,
  MessageCircle,
  Sparkles,
  Search,
  Check,
  Hash,
  FileText,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Upload,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  X,
  Layers,
  Radio,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Gift,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';

interface CreateGiveawayWizardProps {
  initialQuery?: string;
  onStartGiveaway: (config: {
    postUrl: string;
    postDetails: PostDetails;
    participants: Participant[];
    filters: GiveawayFilters;
    winnersCount: number;
    substitutesCount: number;
  }) => void;
  onCancel: () => void;
}

export const CreateGiveawayWizard: React.FC<CreateGiveawayWizardProps> = ({
  initialQuery,
  onStartGiveaway,
  onCancel,
}) => {
  const [step, setStep] = useState<number>(1);

  // Active Giveaway Mode
  const [activeSource, setActiveSource] = useState<
    'multibrand' | 'username' | 'link' | 'list' | 'numbers' | 'csv' | 'lives'
  >('multibrand');

  const modalitiesScrollRef = useRef<HTMLDivElement>(null);

  // Multibrand brands state
  const [multibrandBrands, setMultibrandBrands] = useState<MultibrandBrandConfig[]>([
    { id: 'b1', brandInstagram: '@aura_indumentaria', prize: 'Buzo Oversized' },
    { id: 'b2', brandInstagram: '@lumiere_cosmetica', prize: 'Set Skincare Facial' },
    { id: 'b3', brandInstagram: '@nordic_relojes', prize: 'Reloj Minimalista' },
  ]);
  const [multibrandBrandsConfig, setMultibrandBrandsConfig] = useState<MultibrandBrandConfig[] | null>(null);

  // Instagram Username & Wall
  const [targetUsername, setTargetUsername] = useState(
    initialQuery && !initialQuery.includes('instagram.com') ? initialQuery.trim().replace(/^@/, '') : ''
  );
  const [profileData, setProfileData] = useState<InstagramProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [selectedPost, setSelectedPost] = useState<InstagramProfilePost | null>(null);
  const [postToSelectModal, setPostToSelectModal] = useState<InstagramProfilePost | null>(null);
  const [postSearchFilter, setPostSearchFilter] = useState('');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [visiblePostsCount, setVisiblePostsCount] = useState<number>(6);
  const [loadingMorePosts, setLoadingMorePosts] = useState<boolean>(false);

  // Direct URL
  const [directUrl, setDirectUrl] = useState(
    initialQuery && initialQuery.includes('instagram.com') ? initialQuery.trim() : 'https://www.instagram.com/p/DAxK79qO3b/'
  );

  // Manual text list
  const [manualListText, setManualListText] = useState('');

  // Number Range (e.g. 1 to 1000)
  const [numMin, setNumMin] = useState<number>(1);
  const [numMax, setNumMax] = useState<number>(100);

  // CSV File
  const [, setCsvContent] = useState('');

  // Custom Logo for list/numbers/csv video intro animation
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setCustomLogoUrl(dataUrl);
      if (postDetails) {
        setPostDetails((prev) => (prev ? { ...prev, customLogoUrl: dataUrl } : null));
      }
    };
    reader.readAsDataURL(file);
  };

  // Shared parsing states
  const [loadingComments, setLoadingComments] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [postDetails, setPostDetails] = useState<PostDetails | null>(null);
  const [rawParticipants, setRawParticipants] = useState<Participant[]>([]);
  const [sourceType, setSourceType] = useState<'instagram' | 'numbers' | 'csv' | 'list'>('instagram');

  // Filters (Duplicates default to FALSE, empty excluded users)
  const [filters, setFilters] = useState<GiveawayFilters>({
    minMentions: 0,
    removeDuplicateUsers: false,
    requiredKeyword: '',
    excludedUsers: [],
  });

  const [newExcludedItem, setNewExcludedItem] = useState('');

  // Winners and Substitutes
  const [winnersCount, setWinnersCount] = useState<number>(1);
  const [substitutesCount, setSubstitutesCount] = useState<number>(0);

  // Dynamic step configuration per modality
  const getModalityMeta = () => {
    switch (activeSource) {
      case 'multibrand':
        return {
          name: 'Sorteo Multimarcas',
          totalSteps: 4,
          steps: [
            { num: 1, label: 'Modalidad' },
            { num: 2, label: 'Publicación / Historia' },
            { num: 3, label: 'Marcas y Premios' },
            { num: 4, label: 'Confirmación' },
          ],
        };
      case 'username':
        return {
          name: 'Sorteo por usuario',
          totalSteps: 5,
          steps: [
            { num: 1, label: 'Modalidad' },
            { num: 2, label: 'Publicación' },
            { num: 3, label: 'Filtros' },
            { num: 4, label: 'Ganadores' },
            { num: 5, label: 'Confirmación' },
          ],
        };
      case 'link':
        return {
          name: 'Sorteo por enlace',
          totalSteps: 5,
          steps: [
            { num: 1, label: 'Modalidad' },
            { num: 2, label: 'Enlace' },
            { num: 3, label: 'Filtros' },
            { num: 4, label: 'Ganadores' },
            { num: 5, label: 'Confirmación' },
          ],
        };
      case 'list':
        return {
          name: 'Sorteo por lista',
          totalSteps: 4,
          steps: [
            { num: 1, label: 'Modalidad' },
            { num: 2, label: 'Participantes' },
            { num: 3, label: 'Ganadores' },
            { num: 4, label: 'Confirmación' },
          ],
        };
      case 'numbers':
        return {
          name: 'Sorteo por números',
          totalSteps: 4,
          steps: [
            { num: 1, label: 'Modalidad' },
            { num: 2, label: 'Rango numérico' },
            { num: 3, label: 'Ganadores' },
            { num: 4, label: 'Confirmación' },
          ],
        };
      case 'csv':
        return {
          name: 'Sorteo por archivo CSV',
          totalSteps: 4,
          steps: [
            { num: 1, label: 'Modalidad' },
            { num: 2, label: 'Subir archivo' },
            { num: 3, label: 'Ganadores' },
            { num: 4, label: 'Confirmación' },
          ],
        };
      case 'lives':
      default:
        return {
          name: 'Sorteo de lives',
          totalSteps: 1,
          steps: [{ num: 1, label: 'Modalidad' }],
        };
    }
  };

  const currentMeta = getModalityMeta();

  // Search profile feed
  const handleSearchProfileWall = async (overrideUser?: string) => {
    let raw = (overrideUser || targetUsername || '').trim();
    if (!raw) {
      setErrorMsg('Por favor ingresa un nombre de usuario de Instagram');
      return;
    }

    // If user pasted a post link directly into the username box
    if (raw.includes('instagram.com/p/') || raw.includes('instagram.com/reel/') || raw.includes('instagram.com/tv/')) {
      const fullUrl = raw.startsWith('http') ? raw : `https://${raw}`;
      setDirectUrl(fullUrl);
      handleConfirmDirectLink();
      return;
    }

    // Clean user handle (extract if pasted as profile URL)
    let userClean = raw.replace(/^@/, '');
    const urlMatch = userClean.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/i);
    if (urlMatch) {
      userClean = urlMatch[1];
    }
    userClean = userClean.split(/[/?#]/)[0];

    if (!userClean) {
      setErrorMsg('Usuario de Instagram inválido');
      return;
    }

    setErrorMsg(null);
    setLoadingProfile(true);
    try {
      const data = await api.getInstagramProfileFeed(userClean);
      setProfileData(data.profile);
      setVisiblePostsCount(6);
      if (data.profile?.posts?.length > 0) {
        setSelectedPost(data.profile.posts[0]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al buscar el perfil de Instagram');
    } finally {
      setLoadingProfile(false);
    }
  };

  // Load more posts
  const handleLoadMorePosts = async () => {
    if (filteredPosts.length > visiblePostsCount) {
      setVisiblePostsCount((prev) => prev + 6);
      return;
    }
    if (!profileData?.paginationToken) return;

    setLoadingMorePosts(true);
    try {
      const data = await api.getInstagramProfileFeed(
        profileData.username,
        profileData.paginationToken
      );
      if (data.profile?.posts) {
        setProfileData((prev) => {
          if (!prev) return data.profile;
          const existingCodes = new Set(prev.posts.map((p: InstagramProfilePost) => p.shortcode));
          const newPosts = data.profile.posts.filter((p: InstagramProfilePost) => !existingCodes.has(p.shortcode));
          return {
            ...prev,
            paginationToken: data.profile.paginationToken,
            posts: [...prev.posts, ...newPosts],
          };
        });
        setVisiblePostsCount((prev) => prev + 6);
      }
    } catch (err: any) {
      console.error('Error al paginar publicaciones:', err);
    } finally {
      setLoadingMorePosts(false);
    }
  };

  // Confirm selected post from Instagram wall and advance to filters
  const handleConfirmWallPost = async (postToConfirm?: InstagramProfilePost) => {
    const target = postToConfirm || selectedPost;
    if (!target || !profileData) {
      setErrorMsg('Por favor selecciona la publicación que deseas sortear');
      return;
    }
    setErrorMsg(null);
    setSelectedPost(target);
    setPostToSelectModal(null);
    setStep(3); // Advance directly to filters step
    setLoadingComments(true);
    try {
      const data = await api.parseInstagramPost(
        target.postUrl,
        false,
        profileData.username,
        target.caption,
        target.commentsCount
      );
      setPostDetails({
        ...data.postDetails,
        imageUrl: target.imageUrl || data.postDetails.imageUrl,
        sourceType: 'instagram',
        authorAvatarUrl: profileData?.avatar || `/api/instagram/user-avatar?username=${encodeURIComponent(profileData?.username || target.caption || 'instagram')}`,
      });
      setRawParticipants(data.participants || []);
      setSourceType('instagram');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cargar los comentarios de la publicación');
    } finally {
      setLoadingComments(false);
    }
  };

  // Direct Link confirmation
  const handleConfirmDirectLink = async () => {
    setErrorMsg(null);
    if (!directUrl.trim()) {
      setErrorMsg('Por favor ingresa la URL de la publicación o reel de Instagram');
      return;
    }
    setLoadingComments(true);
    try {
      const data = await api.parseInstagramPost(directUrl.trim(), false);
      setPostDetails({
        ...data.postDetails,
        sourceType: 'instagram',
        authorAvatarUrl: data.postDetails.author ? `/api/instagram/user-avatar?username=${encodeURIComponent(data.postDetails.author)}` : undefined,
      });
      setRawParticipants(data.participants || []);
      setSourceType('instagram');
      setStep(3); // Advance directly to filters step
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con la publicación de Instagram');
    } finally {
      setLoadingComments(false);
    }
  };

  // Number range generator
  const handleGenerateNumbers = () => {
    setErrorMsg(null);
    if (numMax <= numMin) {
      setErrorMsg('El número final debe ser mayor al número inicial');
      return;
    }
    const count = numMax - numMin + 1;
    if (count > 20000) {
      setErrorMsg('El rango no puede superar los 20,000 números');
      return;
    }

    const participants: Participant[] = [];
    for (let i = numMin; i <= numMax; i++) {
      participants.push({
        username: `#${i}`,
        comment: `Boleto o número participante #${i}`,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=num_${i}`,
        timestamp: new Date().toISOString(),
      });
    }

    setPostDetails({
      shortcode: `num_${numMin}_to_${numMax}`,
      author: 'sorteo_por_numeros',
      likes: count,
      commentsCount: count,
      caption: `Sorteo por números del #${numMin} al #${numMax}`,
      imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
      sourceType: 'numbers',
      customLogoUrl: customLogoUrl || undefined,
    });

    setRawParticipants(participants);
    setSourceType('numbers');
    setFilters({
      minMentions: 0,
      removeDuplicateUsers: true,
      requiredKeyword: '',
      excludedUsers: [],
    });
    setStep(3); // Moves to Winners step
  };

  // Manual text or CSV list processing
  const handleProcessTextList = (text: string, type: 'csv' | 'list') => {
    setErrorMsg(null);
    const content = text.trim();
    if (!content) {
      setErrorMsg('Por favor escribe o pega la lista de participantes');
      return;
    }

    const lines = content.split(/[\r\n]+/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) {
      setErrorMsg('No se detectaron participantes válidos');
      return;
    }

    const isPureNumbers = lines.every((l) => /^[#]?\d+$/.test(l.replace(/,/g, '').trim()));
    const participants: Participant[] = [];

    lines.forEach((line, idx) => {
      let username = '';
      let comment = '';

      if (isPureNumbers) {
        const clean = line.replace(/,/g, '').trim();
        username = clean.startsWith('#') ? clean : `#${clean}`;
        comment = `Boleto participante ${username}`;
      } else if (line.includes(',')) {
        const parts = line.split(',');
        username = parts[0].trim().replace(/^@/, '');
        comment = parts.slice(1).join(',').trim() || `Participante ${idx + 1}`;
      } else {
        username = line.trim().replace(/^@/, '');
        comment = `Participante registrado: ${line.trim()}`;
      }

      participants.push({
        username,
        comment,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
        timestamp: new Date().toISOString(),
      });
    });

    setPostDetails({
      shortcode: isPureNumbers ? 'sorteo_numeros' : 'lista_participantes',
      author: isPureNumbers ? 'sorteo_por_numeros' : 'lista_personalizada',
      likes: participants.length,
      commentsCount: participants.length,
      caption: isPureNumbers
        ? `Sorteo entre ${participants.length} números`
        : `Sorteo entre ${participants.length} participantes`,
      imageUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80',
      sourceType: isPureNumbers ? 'numbers' : type,
      customLogoUrl: customLogoUrl || undefined,
    });

    setRawParticipants(participants);
    setSourceType(isPureNumbers ? 'numbers' : type);
    if (isPureNumbers) {
      setFilters({ minMentions: 0, removeDuplicateUsers: true, requiredKeyword: '', excludedUsers: [] });
    }
    setStep(3); // Moves to Winners step
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      handleProcessTextList(text, 'csv');
    };
    reader.readAsText(file);
  };

  // Add excluded user/number
  const handleAddExcludedItem = () => {
    if (!newExcludedItem.trim()) return;
    const clean = newExcludedItem.trim().replace(/^@/, '');
    if (!filters.excludedUsers.includes(clean)) {
      setFilters({
        ...filters,
        excludedUsers: [...filters.excludedUsers, clean],
      });
    }
    setNewExcludedItem('');
  };

  const handleRemoveExcludedItem = (item: string) => {
    setFilters({
      ...filters,
      excludedUsers: filters.excludedUsers.filter((u) => u !== item),
    });
  };

  // Compute live filter results
  const filterResults = filterParticipants(rawParticipants, filters);

  // Multibrand Unification confirmed callback: receives configured brands (1 winner per brand)
  const handleConfirmMultibrand = (
    summary: MultibrandUnifySummary,
    details: PostDetails,
    brandsConfig: MultibrandBrandConfig[]
  ) => {
    setMultibrandBrandsConfig(brandsConfig);
    setPostDetails({
      ...details,
      sourceType: 'instagram',
    });
    setRawParticipants(summary.participants);
    setSourceType('instagram');
    setWinnersCount(brandsConfig.length); // 1 winner per participating brand!
    setFilters({
      minMentions: 0,
      removeDuplicateUsers: false,
      requiredKeyword: '',
      excludedUsers: [],
    });
    setStep(4); // Advance to confirmation for multibrand
  };

  const handleStart = () => {
    const totalRequired = winnersCount + substitutesCount;
    if (filterResults.validParticipants.length < totalRequired) {
      setErrorMsg(
        `Participantes válidos insuficientes (${filterResults.validParticipants.length}). Se necesitan al menos ${totalRequired} (${winnersCount} ganadores + ${substitutesCount} suplentes).`
      );
      return;
    }

    if (!postDetails) return;

    const finalPostDetails: PostDetails = {
      ...postDetails,
      customLogoUrl: customLogoUrl || postDetails.customLogoUrl || undefined,
      authorAvatarUrl: postDetails.authorAvatarUrl || profileData?.avatar || undefined,
      multibrandBrandsConfig: multibrandBrandsConfig || undefined,
      multibrandMeta: multibrandBrandsConfig
        ? {
            isMultibrand: true,
            brandsConfig: multibrandBrandsConfig,
            brands: multibrandBrandsConfig.map((b) => b.brandInstagram),
          }
        : undefined,
    } as any;

    onStartGiveaway({
      postUrl: postDetails.shortcode ? `https://www.instagram.com/p/${postDetails.shortcode}/` : 'https://sorteoo.app',
      postDetails: finalPostDetails,
      participants: filterResults.validParticipants,
      filters,
      winnersCount,
      substitutesCount: activeSource === 'multibrand' ? 0 : substitutesCount,
    });
  };

  // Filter profile posts in wall search
  const filteredPosts = (profileData?.posts || []).filter((p) => {
    if (!postSearchFilter.trim()) return true;
    const term = postSearchFilter.toLowerCase();
    return (p.caption || '').toLowerCase().includes(term) || (p.shortcode || '').toLowerCase().includes(term);
  });
  const visiblePosts = filteredPosts.slice(0, visiblePostsCount);

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8 overflow-x-hidden">
      {/* Top Header & Breadcrumb Progress */}
      <div className="mb-5 sm:mb-6">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <button
            type="button"
            onClick={step === 1 ? onCancel : () => setStep((prev) => Math.max(1, prev - 1))}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{step === 1 ? 'Volver al inicio' : 'Paso anterior'}</span>
          </button>
          <span className="text-xs font-bold bg-white border border-neutral-200 text-neutral-700 px-3 py-1 rounded-full shadow-xs">
            Paso {step} de {currentMeta.totalSteps}
          </span>
        </div>

        {/* Dynamic Step Progress Pills */}
        <div
          className="grid gap-1.5 sm:gap-2"
          style={{ gridTemplateColumns: `repeat(${currentMeta.totalSteps}, minmax(0, 1fr))` }}
        >
          {currentMeta.steps.map((s) => (
            <div
              key={s.num}
              title={s.label}
              className={`h-2 rounded-full transition-all ${
                step >= s.num ? 'bg-gradient-to-r from-red-500 via-rose-500 to-amber-500' : 'bg-neutral-200'
              }`}
            />
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700 text-xs shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* ==================================================== */}
      {/* STEP 1: MODALITY SELECTION ONLY (SOBER & INTUITIVE) */}
      {/* ==================================================== */}
      {step === 1 && (
        <div className="space-y-5">
          <h1 className="text-xl sm:text-2xl font-black text-neutral-900 text-center sm:text-left">
            ¿Cómo deseas realizar tu sorteo?
          </h1>

          {/* Large Card Horizontal Scroll Carousel */}
          <div className="relative">
            {/* Scroll Navigation Chevrons */}
            <button
              type="button"
              onClick={() => {
                if (modalitiesScrollRef.current) {
                  modalitiesScrollRef.current.scrollBy({ left: -240, behavior: 'smooth' });
                }
              }}
              className="hidden sm:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-neutral-300 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 items-center justify-center shadow-lg transition-all cursor-pointer"
              aria-label="Desplazar a la izquierda"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (modalitiesScrollRef.current) {
                  modalitiesScrollRef.current.scrollBy({ left: 240, behavior: 'smooth' });
                }
              }}
              className="hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-neutral-300 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 items-center justify-center shadow-lg transition-all cursor-pointer"
              aria-label="Desplazar a la derecha"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Scrollable Track */}
            <div
              ref={modalitiesScrollRef}
              className="flex items-stretch gap-3 overflow-x-auto pb-4 pt-1 px-1 scroll-smooth snap-x snap-mandatory scrollbar-none"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {/* 1. Sorteo Multimarcas */}
              <button
                type="button"
                onClick={() => setActiveSource('multibrand')}
                className={`flex-none w-[205px] sm:w-[225px] snap-start p-4 sm:p-5 rounded-2xl text-left transition-all border cursor-pointer flex flex-col justify-between ${
                  activeSource === 'multibrand'
                    ? 'bg-gradient-to-b from-rose-50 to-white border-2 border-rose-500 shadow-xl shadow-rose-500/15 ring-4 ring-rose-500/20'
                    : 'bg-white hover:bg-neutral-50/80 border-2 border-neutral-200/90 hover:border-neutral-300 shadow-xs text-neutral-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-500 via-rose-500 to-amber-500 flex items-center justify-center text-white shrink-0 shadow-md">
                      <Layers className="w-5 h-5" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                      1 Ganador x Marca
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-neutral-900 leading-tight">
                    Sorteo Multimarcas
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                    Unificá marcas y premios en un solo sorteo
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                  <span className={`text-[11px] font-bold ${activeSource === 'multibrand' ? 'text-rose-600' : 'text-neutral-400'}`}>
                    {activeSource === 'multibrand' ? 'Seleccionado' : 'Elegir'}
                  </span>
                  <div className={`w-3 h-3 rounded-full ${activeSource === 'multibrand' ? 'bg-rose-500 ring-4 ring-rose-200 animate-pulse' : 'bg-neutral-300'}`} />
                </div>
              </button>

              {/* 2. Sorteo por usuario */}
              <button
                type="button"
                onClick={() => setActiveSource('username')}
                className={`flex-none w-[205px] sm:w-[225px] snap-start p-4 sm:p-5 rounded-2xl text-left transition-all border cursor-pointer flex flex-col justify-between ${
                  activeSource === 'username'
                    ? 'bg-gradient-to-b from-rose-50 to-white border-2 border-rose-500 shadow-xl shadow-rose-500/15 ring-4 ring-rose-500/20'
                    : 'bg-white hover:bg-neutral-50/80 border-2 border-neutral-200/90 hover:border-neutral-300 shadow-xs text-neutral-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                      <AtSign className="w-5 h-5" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                      Recomendado
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-neutral-900 leading-tight">
                    Sorteo por usuario
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                    @ cuenta de Instagram y muro
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                  <span className={`text-[11px] font-bold ${activeSource === 'username' ? 'text-rose-600' : 'text-neutral-400'}`}>
                    {activeSource === 'username' ? 'Seleccionado' : 'Elegir'}
                  </span>
                  <div className={`w-3 h-3 rounded-full ${activeSource === 'username' ? 'bg-rose-500 ring-4 ring-rose-200 animate-pulse' : 'bg-neutral-300'}`} />
                </div>
              </button>

              {/* 3. Sorteo por enlace */}
              <button
                type="button"
                onClick={() => setActiveSource('link')}
                className={`flex-none w-[205px] sm:w-[225px] snap-start p-4 sm:p-5 rounded-2xl text-left transition-all border cursor-pointer flex flex-col justify-between ${
                  activeSource === 'link'
                    ? 'bg-gradient-to-b from-indigo-50 to-white border-2 border-rose-500 shadow-xl shadow-rose-500/15 ring-4 ring-rose-500/20'
                    : 'bg-white hover:bg-neutral-50/80 border-2 border-neutral-200/90 hover:border-neutral-300 shadow-xs text-neutral-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                      <LinkIcon className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-neutral-900 leading-tight">
                    Sorteo por enlace
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                    URL directa de post o reel
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                  <span className={`text-[11px] font-bold ${activeSource === 'link' ? 'text-rose-600' : 'text-neutral-400'}`}>
                    {activeSource === 'link' ? 'Seleccionado' : 'Elegir'}
                  </span>
                  <div className={`w-3 h-3 rounded-full ${activeSource === 'link' ? 'bg-rose-500 ring-4 ring-rose-200 animate-pulse' : 'bg-neutral-300'}`} />
                </div>
              </button>

              {/* 4. Sorteo por lista */}
              <button
                type="button"
                onClick={() => setActiveSource('list')}
                className={`flex-none w-[205px] sm:w-[225px] snap-start p-4 sm:p-5 rounded-2xl text-left transition-all border cursor-pointer flex flex-col justify-between ${
                  activeSource === 'list'
                    ? 'bg-gradient-to-b from-pink-50 to-white border-2 border-rose-500 shadow-xl shadow-rose-500/15 ring-4 ring-rose-500/20'
                    : 'bg-white hover:bg-neutral-50/80 border-2 border-neutral-200/90 hover:border-neutral-300 shadow-xs text-neutral-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-neutral-900 leading-tight">
                    Sorteo por lista
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                    Pegar lista de participantes
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                  <span className={`text-[11px] font-bold ${activeSource === 'list' ? 'text-rose-600' : 'text-neutral-400'}`}>
                    {activeSource === 'list' ? 'Seleccionado' : 'Elegir'}
                  </span>
                  <div className={`w-3 h-3 rounded-full ${activeSource === 'list' ? 'bg-rose-500 ring-4 ring-rose-200 animate-pulse' : 'bg-neutral-300'}`} />
                </div>
              </button>

              {/* 5. Sorteo por números */}
              <button
                type="button"
                onClick={() => setActiveSource('numbers')}
                className={`flex-none w-[205px] sm:w-[225px] snap-start p-4 sm:p-5 rounded-2xl text-left transition-all border cursor-pointer flex flex-col justify-between ${
                  activeSource === 'numbers'
                    ? 'bg-gradient-to-b from-amber-50 to-white border-2 border-rose-500 shadow-xl shadow-rose-500/15 ring-4 ring-rose-500/20'
                    : 'bg-white hover:bg-neutral-50/80 border-2 border-neutral-200/90 hover:border-neutral-300 shadow-xs text-neutral-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <Hash className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-neutral-900 leading-tight">
                    Sorteo por números
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                    Rifas y números del 1 al N
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                  <span className={`text-[11px] font-bold ${activeSource === 'numbers' ? 'text-rose-600' : 'text-neutral-400'}`}>
                    {activeSource === 'numbers' ? 'Seleccionado' : 'Elegir'}
                  </span>
                  <div className={`w-3 h-3 rounded-full ${activeSource === 'numbers' ? 'bg-rose-500 ring-4 ring-rose-200 animate-pulse' : 'bg-neutral-300'}`} />
                </div>
              </button>

              {/* 6. Sorteo por archivo csv */}
              <button
                type="button"
                onClick={() => setActiveSource('csv')}
                className={`flex-none w-[205px] sm:w-[225px] snap-start p-4 sm:p-5 rounded-2xl text-left transition-all border cursor-pointer flex flex-col justify-between ${
                  activeSource === 'csv'
                    ? 'bg-gradient-to-b from-emerald-50 to-white border-2 border-rose-500 shadow-xl shadow-rose-500/15 ring-4 ring-rose-500/20'
                    : 'bg-white hover:bg-neutral-50/80 border-2 border-neutral-200/90 hover:border-neutral-300 shadow-xs text-neutral-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-neutral-900 leading-tight">
                    Sorteo por archivo csv
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                    Subir archivo Excel o CSV
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                  <span className={`text-[11px] font-bold ${activeSource === 'csv' ? 'text-rose-600' : 'text-neutral-400'}`}>
                    {activeSource === 'csv' ? 'Seleccionado' : 'Elegir'}
                  </span>
                  <div className={`w-3 h-3 rounded-full ${activeSource === 'csv' ? 'bg-rose-500 ring-4 ring-rose-200 animate-pulse' : 'bg-neutral-300'}`} />
                </div>
              </button>

              {/* 7. Sorteo de lives (vivos) MUY PRONTO! */}
              <button
                type="button"
                onClick={() => setActiveSource('lives')}
                className={`flex-none w-[205px] sm:w-[225px] snap-start p-4 sm:p-5 rounded-2xl text-left transition-all border cursor-pointer flex flex-col justify-between ${
                  activeSource === 'lives'
                    ? 'bg-gradient-to-b from-amber-50 to-white border-2 border-amber-500 shadow-xl shadow-amber-500/15 ring-4 ring-amber-500/20'
                    : 'bg-white/80 hover:bg-white border-2 border-dashed border-neutral-300 text-neutral-400'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <Radio className="w-5 h-5 animate-pulse" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                      MUY PRONTO!
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-neutral-900 leading-tight">
                    Sorteo de lives (vivos)
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                    En directo por chat en vivo
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-600">
                    {activeSource === 'lives' ? 'Seleccionado' : 'Próximamente'}
                  </span>
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                </div>
              </button>
            </div>
          </div>

          {/* Action Bar below selector */}
          <div className="pt-2">
            {activeSource === 'lives' ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-1">
                <span className="text-xs font-bold text-amber-800">
                  El sorteo de transmisiones en vivo estará disponible muy pronto.
                </span>
                <p className="text-[11px] text-neutral-600">
                  Selecciona otra modalidad arriba para continuar con tu sorteo.
                </p>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200/90 shadow-sm">
                <div className="text-left w-full sm:w-auto">
                  <span className="text-[11px] text-neutral-500 uppercase tracking-wider block font-bold">
                    Modalidad seleccionada
                  </span>
                  <strong className="text-base sm:text-lg font-black text-neutral-900">
                    {currentMeta.name}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 hover:via-rose-600 hover:to-amber-600 text-white font-black text-sm rounded-xl shadow-xl shadow-rose-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* STEP 2: PARTICIPANTS / POST SELECTION                */}
      {/* ==================================================== */}
      {step === 2 && (
        <div>
          {/* Multibrand Mode: Step 2 in MultibrandSection */}
          {activeSource === 'multibrand' && (
            <MultibrandSection
              currentStep={2}
              onAdvanceToPrizes={() => setStep(3)}
              onAdvanceToConfirm={handleConfirmMultibrand}
              onBack={() => setStep(1)}
              brandsConfig={multibrandBrands}
              setBrandsConfig={setMultibrandBrands}
              loadedPostDetails={postDetails}
              setLoadedPostDetails={setPostDetails}
              rawParticipants={rawParticipants}
              setRawParticipants={setRawParticipants}
            />
          )}

          {/* Username Mode: Step 2 Post Search & Wall */}
          {activeSource === 'username' && (
            <div className="bg-white border border-neutral-200/90 rounded-3xl p-5 sm:p-7 shadow-xl shadow-neutral-200/50 space-y-4">
              <div className="border-b border-neutral-100 pb-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-rose-500 uppercase tracking-wider block mb-0.5">
                    Paso 2
                  </span>
                  <h2 className="text-lg sm:text-xl font-black text-neutral-900">
                    Selecciona la publicación
                  </h2>
                </div>
              </div>

              {/* In-step Error notification */}
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2 text-rose-700 text-xs">
                  <span className="font-semibold">{errorMsg}</span>
                  <button
                    type="button"
                    onClick={() => setErrorMsg(null)}
                    className="text-neutral-400 hover:text-neutral-700 text-base leading-none p-1 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Input for Username */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={targetUsername}
                    onChange={(e) => setTargetUsername(e.target.value.replace(/^@/, ''))}
                    placeholder="@ ingresa usuario de instagram o pega link"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-300 focus:border-rose-500 rounded-xl text-neutral-900 text-[16px] sm:text-sm font-semibold focus:outline-none focus:bg-white transition-all placeholder-neutral-400"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchProfileWall();
                      }
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleSearchProfileWall()}
                  disabled={loadingProfile}
                  className="px-6 py-3 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 hover:via-rose-600 hover:to-amber-600 disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95 cursor-pointer"
                >
                  {loadingProfile ? (
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 animate-spin text-amber-200" />
                      <span>Buscando...</span>
                    </span>
                  ) : (
                    <>
                      <Grid className="w-4 h-4" />
                      <span>BUSCAR PUBLICACIONES</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick direct post URL fallback */}
              <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-600 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                <span className="text-[11px] text-neutral-600 font-medium">¿Tienes el link directo del post?</span>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="url"
                    value={directUrl}
                    onChange={(e) => setDirectUrl(e.target.value)}
                    placeholder="https://instagram.com/p/..."
                    className="flex-1 sm:w-64 px-2.5 py-1.5 bg-white border border-neutral-300 rounded-lg text-[13px] text-neutral-900 focus:outline-none focus:border-rose-500"
                  />
                  <button
                    type="button"
                    onClick={handleConfirmDirectLink}
                    disabled={loadingComments}
                    className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-lg text-xs cursor-pointer shrink-0 transition-colors"
                  >
                    {loadingComments ? 'Cargando...' : 'Cargar'}
                  </button>
                </div>
              </div>

              {/* Loading State */}
              {loadingProfile && (
                <div className="p-8 bg-neutral-50 rounded-2xl border border-rose-200 text-center space-y-3">
                  <img
                    src="/assets/aistudio/Regalo_sonriente_con_lazo_y_destellos_f63477b8.png"
                    alt="Cargando"
                    className="w-14 h-14 mx-auto animate-bounce object-contain drop-shadow-md"
                  />
                  <h3 className="text-sm sm:text-base font-extrabold text-neutral-900">
                    Cargando muro de @{targetUsername || 'tu cuenta'}...
                  </h3>
                  <p className="text-xs text-neutral-500">Un momentito por favor</p>
                </div>
              )}

              {/* Profile Details & Posts Wall */}
              {profileData && !loadingProfile && (
                <div className="space-y-4 pt-2 border-t border-neutral-100">
                  <div className="bg-neutral-50 p-3 sm:p-4 rounded-2xl border border-neutral-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={profileData.avatar}
                        alt={profileData.username}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-full border-2 border-white shadow-xs object-cover shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${profileData.username}`;
                        }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-neutral-900 text-sm">@{profileData.username}</span>
                          {!profileData.isPrivate && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-500 truncate">
                          {profileData.followersCount > 0
                            ? `${profileData.followersCount.toLocaleString()} seguidores · ${profileData.postsCount} posts`
                            : `@${profileData.username}`}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSearchProfileWall()}
                      className="inline-flex items-center gap-1 text-[11px] text-neutral-600 hover:text-neutral-900 px-3 py-1.5 rounded-lg bg-white border border-neutral-200 shadow-xs transition-colors shrink-0 cursor-pointer font-bold"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span className="hidden sm:inline">Actualizar</span>
                    </button>
                  </div>

                  {/* POSTS GRID */}
                  {profileData.posts && profileData.posts.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                          <Grid className="w-3.5 h-3.5 text-rose-500" />
                          <span>Elige una publicación:</span>
                        </span>

                        <div className="relative w-44 sm:w-56">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                          <input
                            type="text"
                            value={postSearchFilter}
                            onChange={(e) => setPostSearchFilter(e.target.value)}
                            placeholder="Filtrar posts..."
                            className="w-full pl-8 pr-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-[16px] sm:text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-rose-500"
                          />
                        </div>
                      </div>

                      {/* Post cards grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                        {visiblePosts.map((post, idx) => {
                          const isSelected = selectedPost?.shortcode === post.shortcode;
                          const hasImgFailed = failedImages[post.shortcode];

                          return (
                            <div
                              key={post.shortcode || idx}
                              onClick={() => {
                                setSelectedPost(post);
                                setPostToSelectModal(post);
                              }}
                              className={`group relative rounded-2xl overflow-hidden border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                isSelected
                                  ? 'border-rose-500 ring-4 ring-rose-500/20 bg-white shadow-xl shadow-rose-500/15'
                                  : 'border-neutral-200 hover:border-neutral-300 bg-white shadow-xs hover:shadow-md'
                              }`}
                            >
                              <div className="relative aspect-square w-full bg-neutral-100 overflow-hidden">
                                {!hasImgFailed && post.imageUrl ? (
                                  <img
                                    src={post.imageUrl}
                                    alt={`Post ${post.shortcode}`}
                                    referrerPolicy="no-referrer"
                                    crossOrigin="anonymous"
                                    loading="lazy"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    onError={() => {
                                      setFailedImages((prev) => ({ ...prev, [post.shortcode]: true }));
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-tr from-neutral-100 via-white to-neutral-100 p-4 flex flex-col justify-between">
                                    <div className="flex items-center justify-between">
                                      <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-red-500 via-rose-500 to-amber-500 flex items-center justify-center text-white">
                                        <Sparkles className="w-3.5 h-3.5" />
                                      </div>
                                      <span className="text-[10px] font-mono text-neutral-500 bg-neutral-200 px-1.5 py-0.5 rounded">
                                        {post.shortcode}
                                      </span>
                                    </div>
                                    <p className="text-xs text-neutral-700 line-clamp-3 italic">
                                      “{post.caption || 'Publicación oficial de Instagram'}”
                                    </p>
                                    <span className="text-[10px] text-neutral-500 block font-semibold">
                                      @{profileData.username}
                                    </span>
                                  </div>
                                )}

                                <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
                                  {post.isGiveaway && (
                                    <span className="bg-gradient-to-r from-red-500 to-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-md">
                                      SORTEO 🎁
                                    </span>
                                  )}
                                  <span className="bg-black/75 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-white/10">
                                    {post.isVideo ? 'Reel 🎬' : 'Post 📷'}
                                  </span>
                                </div>

                                {isSelected && (
                                  <div className="absolute top-2 right-2 bg-gradient-to-tr from-red-500 to-amber-500 text-white rounded-full p-1.5 shadow-xl z-10">
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  </div>
                                )}

                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2.5 pt-6 flex items-center justify-between text-[11px] font-bold text-white">
                                  <span className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-md border border-white/10">
                                    <MessageCircle className="w-3 h-3 text-rose-400 fill-current" />
                                    <span>{post.commentsCount}</span>
                                  </span>
                                  <span className="flex items-center gap-1 text-neutral-200">
                                    <Heart className="w-3 h-3 text-rose-400" />
                                    <span>{post.likes}</span>
                                  </span>
                                </div>
                              </div>

                              <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between">
                                <p className="text-xs text-neutral-800 font-medium line-clamp-2 leading-tight">
                                  {post.caption || `Publicación de @${profileData.username}`}
                                </p>
                                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
                                  <span>{post.date}</span>
                                  <span className="text-rose-600 font-bold group-hover:underline flex items-center gap-0.5">
                                    <span>Elegir</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Load More Posts Button */}
                      {(visiblePostsCount < filteredPosts.length || profileData.paginationToken) && (
                        <div className="pt-3 text-center">
                          <button
                            type="button"
                            onClick={handleLoadMorePosts}
                            disabled={loadingMorePosts}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-neutral-50 text-neutral-800 text-xs sm:text-sm font-black rounded-xl border border-neutral-300 transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                          >
                            {loadingMorePosts ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin text-rose-500" />
                                <span>Cargando más publicaciones...</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4 text-rose-500" />
                                <span>Cargar más publicaciones</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Atrás</span>
                </button>
              </div>
            </div>
          )}

          {/* Link Mode: Direct URL input */}
          {activeSource === 'link' && (
            <div className="bg-white border border-neutral-200/90 rounded-3xl p-5 sm:p-7 shadow-xl shadow-neutral-200/50 space-y-4">
              <div className="border-b border-neutral-100 pb-3">
                <span className="text-xs font-bold text-rose-500 uppercase tracking-wider block mb-0.5">
                  Paso 2
                </span>
                <h2 className="text-lg sm:text-xl font-black text-neutral-900">
                  Pega el enlace de la publicación
                </h2>
              </div>

              <input
                type="url"
                value={directUrl}
                onChange={(e) => setDirectUrl(e.target.value)}
                placeholder="https://www.instagram.com/p/..."
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-300 focus:border-rose-500 focus:bg-white rounded-xl text-neutral-900 text-[16px] sm:text-sm font-mono focus:outline-none"
              />

              <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Atrás</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDirectLink}
                  disabled={loadingComments}
                  className="px-6 py-2.5 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 hover:to-amber-600 disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loadingComments ? <span>Cargando comentarios...</span> : <span>Cargar comentarios</span>}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* List Mode: Textarea */}
          {activeSource === 'list' && (
            <div className="bg-white border border-neutral-200/90 rounded-3xl p-5 sm:p-7 shadow-xl shadow-neutral-200/50 space-y-4">
              <div className="border-b border-neutral-100 pb-3">
                <span className="text-xs font-bold text-rose-500 uppercase tracking-wider block mb-0.5">
                  Paso 2
                </span>
                <h2 className="text-lg sm:text-xl font-black text-neutral-900">
                  Lista de participantes
                </h2>
              </div>

              <textarea
                rows={6}
                value={manualListText}
                onChange={(e) => setManualListText(e.target.value)}
                placeholder={`Sofia Martinez\nLucas Valenzuela\nCamila Gomez\n...o @usuario, comentario`}
                className="w-full p-3.5 bg-neutral-50 border border-neutral-300 focus:border-rose-500 focus:bg-white rounded-xl text-neutral-900 text-[16px] sm:text-xs font-mono focus:outline-none"
              />

              {/* Logo para el video (opcional) */}
              <div className="p-3.5 sm:p-4 bg-neutral-50 rounded-2xl border border-neutral-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full border-2 border-dashed border-neutral-300 bg-white overflow-hidden flex items-center justify-center shrink-0">
                    {customLogoUrl ? (
                      <img src={customLogoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-5 h-5 text-neutral-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-neutral-900 block">Logo para el video (opcional)</span>
                    <p className="text-[11px] text-neutral-500 truncate">
                      {customLogoUrl ? 'Logo cargado para la intro del video' : 'Agrega el logo o foto de tu marca para la animación'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {customLogoUrl && (
                    <button
                      type="button"
                      onClick={() => setCustomLogoUrl(null)}
                      className="px-2.5 py-1.5 text-xs text-rose-600 hover:text-rose-700 font-bold transition-colors cursor-pointer"
                    >
                      Quitar
                    </button>
                  )}
                  <label className="cursor-pointer px-3.5 py-2 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-bold rounded-xl border border-neutral-300 transition-colors inline-flex items-center gap-1.5 shadow-xs">
                    <Upload className="w-3.5 h-3.5 text-amber-500" />
                    <span>{customLogoUrl ? 'Cambiar' : 'Cargar logo'}</span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Atrás</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleProcessTextList(manualListText, 'list')}
                  className="px-6 py-2.5 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 hover:to-amber-600 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continuar con lista</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Numbers Mode: Range */}
          {activeSource === 'numbers' && (
            <div className="bg-white border border-neutral-200/90 rounded-3xl p-5 sm:p-7 shadow-xl shadow-neutral-200/50 space-y-4">
              <div className="border-b border-neutral-100 pb-3">
                <span className="text-xs font-bold text-rose-500 uppercase tracking-wider block mb-0.5">
                  Paso 2
                </span>
                <h2 className="text-lg sm:text-xl font-black text-neutral-900">
                  Rango numérico
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-xs">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">Desde</label>
                  <input
                    type="number"
                    value={numMin}
                    onChange={(e) => setNumMin(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-neutral-900 text-[16px] sm:text-xs font-mono font-bold focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">Hasta</label>
                  <input
                    type="number"
                    value={numMax}
                    onChange={(e) => setNumMax(parseInt(e.target.value, 10) || 100)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-neutral-900 text-[16px] sm:text-xs font-mono font-bold focus:bg-white"
                  />
                </div>
              </div>

              {/* Logo para el video (opcional) */}
              <div className="p-3.5 sm:p-4 bg-neutral-50 rounded-2xl border border-neutral-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full border-2 border-dashed border-neutral-300 bg-white overflow-hidden flex items-center justify-center shrink-0">
                    {customLogoUrl ? (
                      <img src={customLogoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-5 h-5 text-neutral-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-neutral-900 block">Logo para el video (opcional)</span>
                    <p className="text-[11px] text-neutral-500 truncate">
                      {customLogoUrl ? 'Logo cargado para la intro del video' : 'Agrega el logo o foto de tu marca para la animación'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {customLogoUrl && (
                    <button
                      type="button"
                      onClick={() => setCustomLogoUrl(null)}
                      className="px-2.5 py-1.5 text-xs text-rose-600 hover:text-rose-700 font-bold transition-colors cursor-pointer"
                    >
                      Quitar
                    </button>
                  )}
                  <label className="cursor-pointer px-3.5 py-2 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-bold rounded-xl border border-neutral-300 transition-colors inline-flex items-center gap-1.5 shadow-xs">
                    <Upload className="w-3.5 h-3.5 text-amber-500" />
                    <span>{customLogoUrl ? 'Cambiar' : 'Cargar logo'}</span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Atrás</span>
                </button>
                <button
                  type="button"
                  onClick={handleGenerateNumbers}
                  className="px-6 py-2.5 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 hover:to-amber-600 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Generar {Math.max(0, numMax - numMin + 1)} boletos</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* CSV Mode */}
          {activeSource === 'csv' && (
            <div className="bg-white border border-neutral-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-neutral-200/50 space-y-5 text-center">
              <div className="border-b border-neutral-100 pb-3 text-left">
                <span className="text-xs font-bold text-rose-500 uppercase tracking-wider block mb-0.5">
                  Paso 2
                </span>
                <h2 className="text-lg sm:text-xl font-black text-neutral-900">
                  Subir archivo CSV o Excel
                </h2>
              </div>

              <div className="py-4">
                <label className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 bg-neutral-900 hover:bg-neutral-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-colors">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>Elegir archivo .csv o .txt</span>
                  <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              {/* Logo para el video (opcional) */}
              <div className="p-3.5 sm:p-4 bg-neutral-50 rounded-2xl border border-neutral-200 flex items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full border-2 border-dashed border-neutral-300 bg-white overflow-hidden flex items-center justify-center shrink-0">
                    {customLogoUrl ? (
                      <img src={customLogoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-5 h-5 text-neutral-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-neutral-900 block">Logo para el video (opcional)</span>
                    <p className="text-[11px] text-neutral-500 truncate">
                      {customLogoUrl ? 'Logo cargado para la intro del video' : 'Agrega el logo o foto de tu marca para la animación'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {customLogoUrl && (
                    <button
                      type="button"
                      onClick={() => setCustomLogoUrl(null)}
                      className="px-2.5 py-1.5 text-xs text-rose-600 hover:text-rose-700 font-bold transition-colors cursor-pointer"
                    >
                      Quitar
                    </button>
                  )}
                  <label className="cursor-pointer px-3.5 py-2 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-bold rounded-xl border border-neutral-300 transition-colors inline-flex items-center gap-1.5 shadow-xs">
                    <Upload className="w-3.5 h-3.5 text-amber-500" />
                    <span>{customLogoUrl ? 'Cambiar' : 'Cargar logo'}</span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-neutral-100 text-left">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Atrás</span>
                </button>
              </div>
            </div>
          )}

          {/* Modal popup when clicking a post in username mode */}
          {postToSelectModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-md animate-in fade-in duration-150">
              <div className="bg-white border-2 border-rose-500/30 rounded-3xl p-5 sm:p-6 w-full max-w-sm sm:max-w-md shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => setPostToSelectModal(null)}
                  className="absolute top-4 right-4 p-1.5 rounded-full bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                  aria-label="Cerrar ventana"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-3.5 pr-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-neutral-100 overflow-hidden shrink-0 border border-neutral-200">
                    {postToSelectModal.imageUrl ? (
                      <img
                        src={postToSelectModal.imageUrl}
                        alt="Preview"
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${postToSelectModal.shortcode}`;
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">
                        🎁
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 block">
                      Publicación lista para sortear
                    </span>
                    <strong className="text-neutral-900 text-sm sm:text-base block truncate">
                      💬 {postToSelectModal.commentsCount} comentarios
                    </strong>
                    <p className="text-xs text-neutral-600 line-clamp-2 leading-tight">
                      {postToSelectModal.caption || `Publicación de @${profileData?.username}`}
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const p = postToSelectModal;
                      setPostToSelectModal(null);
                      if (p) {
                        handleConfirmWallPost(p);
                      }
                    }}
                    className="w-full py-4 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 hover:via-rose-600 hover:to-amber-600 text-white font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-rose-500/25 transition-all flex items-center justify-center gap-2 transform active:scale-95 cursor-pointer"
                  >
                    <span>Seleccionar este post</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* STEP 3: DYNAMIC STEP (MARCAS FOR MULTIBRAND, FILTERS FOR USERNAME/LINK, WINNERS FOR LIST/NUMBERS) */}
      {/* ==================================================== */}
      {step === 3 && (
        <div>
          {/* Multibrand: Brands and Prizes configuration */}
          {activeSource === 'multibrand' && (
            <MultibrandSection
              currentStep={3}
              onAdvanceToPrizes={() => setStep(3)}
              onAdvanceToConfirm={handleConfirmMultibrand}
              onBack={() => setStep(2)}
              brandsConfig={multibrandBrands}
              setBrandsConfig={setMultibrandBrands}
              loadedPostDetails={postDetails}
              setLoadedPostDetails={setPostDetails}
              rawParticipants={rawParticipants}
              setRawParticipants={setRawParticipants}
            />
          )}

          {/* Username and Link: Filters */}
          {(activeSource === 'username' || activeSource === 'link') && (
            <div className="bg-white border border-neutral-200/90 shadow-xl shadow-neutral-200/40 rounded-3xl p-5 sm:p-7 space-y-5">
              <div className="border-b border-neutral-100 pb-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-rose-600 uppercase tracking-wider block mb-0.5">
                    Paso 3
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-neutral-900">
                    Filtros del Sorteo
                  </h2>
                </div>
                {postDetails && (
                  <span className="text-xs font-bold text-neutral-700 bg-neutral-100 border border-neutral-200 px-3 py-1 rounded-xl">
                    @{postDetails.author || 'instagram'}
                  </span>
                )}
              </div>

              {loadingComments ? (
                <div className="py-12 px-4 bg-neutral-50 rounded-2xl border border-rose-200 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-red-500 via-rose-500 to-amber-500 p-0.5 shadow-xl animate-pulse">
                    <div className="w-full h-full rounded-2xl bg-white flex items-center justify-center p-2">
                      <img
                        src="/assets/aistudio/Regalo_sonriente_con_lazo_y_destellos_f63477b8.png"
                        alt="Cargando"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-black text-neutral-900">
                      Cargando todos los comentarios de Instagram...
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-600 max-w-md mx-auto">
                      Recopilando todos los comentarios para garantizar un sorteo justo.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-neutral-200 text-xs font-bold text-rose-600 shadow-xs">
                    <Sparkles className="w-4 h-4 animate-spin text-amber-500" />
                    <span>Extrayendo participantes reales...</span>
                  </div>
                </div>
              ) : (
                <>
                  {/* Summary of Comments Loaded */}
                  <div className="bg-neutral-50 p-3.5 sm:p-4 rounded-2xl border border-neutral-200 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-xs text-neutral-500 block">Comentarios detectados</span>
                      <strong className="text-sm sm:text-base font-black text-neutral-900 truncate block">
                        {postDetails?.commentsCount && postDetails.commentsCount > rawParticipants.length
                          ? `${rawParticipants.length} de ${postDetails.commentsCount}`
                          : `${rawParticipants.length} comentarios`}
                      </strong>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs text-neutral-500 block">Válidos para sortear</span>
                      <strong className="text-sm sm:text-base font-black text-emerald-600 block">
                        {filterResults.validParticipants.length}
                      </strong>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    {/* Mentions filter */}
                    <div className="p-3.5 sm:p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2.5">
                      <h4 className="text-xs sm:text-sm font-bold text-neutral-900">
                        Tiene que mencionar?
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setFilters({ ...filters, minMentions: 0 })}
                          className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                            filters.minMentions === 0
                              ? 'bg-rose-500 border-rose-500 text-white shadow-md'
                              : 'bg-white border-neutral-200 text-neutral-600 hover:text-neutral-900'
                          }`}
                        >
                          Sin menciones
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilters({ ...filters, minMentions: filters.minMentions > 0 ? filters.minMentions : 1 })}
                          className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                            filters.minMentions > 0
                              ? 'bg-rose-500 border-rose-500 text-white shadow-md'
                              : 'bg-white border-neutral-200 text-neutral-600 hover:text-neutral-900'
                          }`}
                        >
                          Con menciones
                        </button>
                      </div>
                    </div>

                    {/* Duplicate comments filter */}
                    <div className="flex items-center justify-between p-3.5 sm:p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-neutral-900">
                          Eliminar comentarios duplicados
                        </h4>
                        <p className="text-[11px] text-neutral-500">
                          {filters.removeDuplicateUsers ? '1 oportunidad por usuario' : 'Permite múltiples comentarios'}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={filters.removeDuplicateUsers}
                        onChange={(e) => setFilters({ ...filters, removeDuplicateUsers: e.target.checked })}
                        className="w-5 h-5 accent-rose-500 rounded cursor-pointer"
                      />
                    </div>

                    {/* Keyword filter */}
                    <div className="p-3.5 sm:p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-1.5">
                      <h4 className="text-xs sm:text-sm font-bold text-neutral-900">
                        Palabra clave o hashtag
                      </h4>
                      <input
                        type="text"
                        value={filters.requiredKeyword}
                        onChange={(e) => setFilters({ ...filters, requiredKeyword: e.target.value })}
                        placeholder="ej: #sorteo o QUIEROGANAR"
                        className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-neutral-900 text-[16px] sm:text-xs focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>

                    {/* Excluded users filter */}
                    <div className="p-3.5 sm:p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2.5 overflow-hidden">
                      <h4 className="text-xs sm:text-sm font-bold text-neutral-900">
                        Excluir usuarios
                      </h4>
                      <div className="flex flex-col sm:flex-row gap-2 w-full">
                        <input
                          type="text"
                          value={newExcludedItem}
                          onChange={(e) => setNewExcludedItem(e.target.value)}
                          placeholder="@usuario"
                          className="w-full flex-1 min-w-0 px-3.5 py-2.5 bg-white border border-neutral-300 focus:border-rose-500 rounded-xl text-neutral-900 text-[16px] sm:text-xs focus:outline-none transition-colors"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddExcludedItem();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleAddExcludedItem}
                          className="w-full sm:w-auto shrink-0 px-5 py-2.5 bg-neutral-800 hover:bg-neutral-900 active:bg-black text-white text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer text-center"
                        >
                          Excluir
                        </button>
                      </div>

                      {filters.excludedUsers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {filters.excludedUsers.map((item) => (
                            <span
                              key={item}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-neutral-200 text-neutral-800 rounded-lg text-xs font-medium"
                            >
                              <span>@{item}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveExcludedItem(item)}
                                className="text-neutral-500 hover:text-rose-600 cursor-pointer font-bold"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Atrás</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 hover:via-rose-600 hover:to-amber-600 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-lg shadow-rose-500/20 transition-all active:scale-95 cursor-pointer"
                    >
                      <span>Elegir ganadores</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* List, Numbers, CSV: Winners and Substitutes */}
          {(activeSource === 'list' || activeSource === 'numbers' || activeSource === 'csv') && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-7 space-y-5">
              <div className="border-b border-neutral-800 pb-3">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block mb-0.5">
                  Paso 3
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Ganadores y Suplentes
                </h2>
              </div>

              {/* Winners Slider */}
              <div className="p-4 sm:p-5 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">Cantidad de Ganadores</h4>
                    <p className="text-xs text-neutral-400">Premios a sortear</p>
                  </div>
                  <div className="px-3.5 py-1 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 text-white rounded-xl text-base font-black">
                    {winnersCount}
                  </div>
                </div>

                <input
                  type="range"
                  min={1}
                  max={Math.min(50, Math.max(1, filterResults.validParticipants.length))}
                  value={winnersCount}
                  onChange={(e) => setWinnersCount(parseInt(e.target.value, 10))}
                  className="w-full h-2.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
              </div>

              {/* Substitutes Slider */}
              <div className="p-4 sm:p-5 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">Cantidad de Suplentes</h4>
                    <p className="text-xs text-neutral-400">De reserva</p>
                  </div>
                  <div className="px-3.5 py-1 bg-neutral-800 text-neutral-200 rounded-xl text-base font-black">
                    {substitutesCount}
                  </div>
                </div>

                <input
                  type="range"
                  min={0}
                  max={10}
                  value={substitutesCount}
                  onChange={(e) => setSubstitutesCount(parseInt(e.target.value, 10))}
                  className="w-full h-2.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Atrás</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 hover:to-amber-600 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  <span>Revisar y sortear</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* STEP 4: WINNERS (FOR USERNAME/LINK) OR CONFIRMATION (FOR MULTIBRAND/LIST/NUMBERS/CSV) */}
      {/* ==================================================== */}
      {step === 4 && (
        <div>
          {/* If Username or Link: Step 4 is Winners Slider */}
          {(activeSource === 'username' || activeSource === 'link') && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-7 space-y-5">
              <div className="border-b border-neutral-800 pb-3">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block mb-0.5">
                  Paso 4
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Ganadores y Suplentes
                </h2>
              </div>

              {/* Winners Slider Only */}
              <div className="p-4 sm:p-5 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">Cantidad de Ganadores</h4>
                    <p className="text-xs text-neutral-400">Premios oficiales a sortear</p>
                  </div>
                  <div className="px-3.5 py-1 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 text-white rounded-xl text-base font-black">
                    {winnersCount}
                  </div>
                </div>

                <input
                  type="range"
                  min={1}
                  max={Math.min(50, Math.max(1, filterResults.validParticipants.length))}
                  value={winnersCount}
                  onChange={(e) => setWinnersCount(parseInt(e.target.value, 10))}
                  className="w-full h-2.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
              </div>

              {/* Substitutes Slider Only */}
              <div className="p-4 sm:p-5 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">Cantidad de Suplentes</h4>
                    <p className="text-xs text-neutral-400">De reserva si el ganador no responde</p>
                  </div>
                  <div className="px-3.5 py-1 bg-neutral-800 text-neutral-200 rounded-xl text-base font-black">
                    {substitutesCount}
                  </div>
                </div>

                <input
                  type="range"
                  min={0}
                  max={10}
                  value={substitutesCount}
                  onChange={(e) => setSubstitutesCount(parseInt(e.target.value, 10))}
                  className="w-full h-2.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Atrás</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 hover:via-rose-600 hover:to-amber-600 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  <span>Revisar y sortear</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* If Multibrand: Step 4 is Final Confirmation & Launch */}
          {activeSource === 'multibrand' && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-7 space-y-5">
              <div className="border-b border-neutral-800 pb-3">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block mb-0.5">
                  Paso 4
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Confirmación Sorteo Multimarcas
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800 space-y-1">
                  <span className="text-neutral-400 block font-medium">Marcas participantes</span>
                  <p className="font-extrabold text-amber-400 text-base">
                    {multibrandBrandsConfig?.length || multibrandBrands.length} emprendimientos
                  </p>
                  <p className="text-neutral-400 text-[11px]">1 ganador asignado por cada marca</p>
                </div>

                <div className="bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800 space-y-1">
                  <span className="text-neutral-400 block font-medium">Participantes Válidos</span>
                  <p className="font-extrabold text-emerald-400 text-base">
                    {filterResults.validParticipants.length} participantes
                  </p>
                  <p className="text-neutral-400 text-[11px]">Publicación o Historias unificadas</p>
                </div>
              </div>

              {/* Brands summary preview */}
              <div className="bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800 space-y-2">
                <span className="text-xs font-bold text-white block">Premios a sortear:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {(multibrandBrandsConfig || multibrandBrands).map((b, i) => (
                    <div
                      key={b.id || i}
                      className="p-2.5 bg-neutral-900 rounded-xl border border-neutral-800 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-rose-400 block truncate">{b.brandInstagram}</span>
                        <span className="text-[11px] text-neutral-300 block truncate">{b.prize}</span>
                      </div>
                      <Gift className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Atrás</span>
                </button>
                <button
                  type="button"
                  onClick={handleStart}
                  className="w-full sm:w-auto min-w-[280px] sm:min-w-[340px] flex items-center justify-center gap-3 py-5 px-8 sm:px-12 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 hover:via-rose-600 hover:to-amber-600 text-white text-base sm:text-lg font-black rounded-full shadow-2xl shadow-rose-500/40 ring-4 ring-rose-500/30 hover:ring-rose-400/60 transition-all transform hover:scale-105 active:scale-95 cursor-pointer uppercase tracking-wider animate-pulse"
                >
                  <Play className="w-6 h-6 fill-current text-white shrink-0" />
                  <span>COMENZAR SORTEOO</span>
                  <Sparkles className="w-5 h-5 text-amber-200 shrink-0" />
                </button>
              </div>
            </div>
          )}

          {/* If List, Numbers, CSV: Step 4 is Final Confirmation & Launch */}
          {(activeSource === 'list' || activeSource === 'numbers' || activeSource === 'csv') && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-7 space-y-5">
              <div className="border-b border-neutral-800 pb-3">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block mb-0.5">
                  Paso 4
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Confirmación del Sorteo
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800 space-y-1">
                  <span className="text-neutral-400 block font-medium">Modalidad</span>
                  <p className="font-bold text-white text-sm">{currentMeta.name}</p>
                </div>

                <div className="bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800 space-y-1">
                  <span className="text-neutral-400 block font-medium">Participantes Válidos</span>
                  <p className="font-extrabold text-emerald-400 text-base">
                    {filterResults.validParticipants.length} participantes
                  </p>
                </div>

                <div className="bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800 space-y-1">
                  <span className="text-neutral-400 block font-medium">Ganadores</span>
                  <p className="font-bold text-amber-400 text-sm">
                    {winnersCount} Ganador{winnersCount > 1 ? 'es' : ''} {substitutesCount > 0 ? `+ ${substitutesCount} Suplente(s)` : ''}
                  </p>
                </div>

                <div className="bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800 space-y-1">
                  <span className="text-neutral-400 block font-medium">Grabación</span>
                  <p className="font-bold text-rose-400 flex items-center gap-1.5 text-sm">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Video 9:16 oficial</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Atrás</span>
                </button>
                <button
                  type="button"
                  onClick={handleStart}
                  className="w-full sm:w-auto min-w-[280px] sm:min-w-[340px] flex items-center justify-center gap-3 py-5 px-8 sm:px-12 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 hover:via-rose-600 hover:to-amber-600 text-white text-base sm:text-lg font-black rounded-full shadow-2xl shadow-rose-500/40 ring-4 ring-rose-500/30 hover:ring-rose-400/60 transition-all transform hover:scale-105 active:scale-95 cursor-pointer uppercase tracking-wider animate-pulse"
                >
                  <Play className="w-6 h-6 fill-current text-white shrink-0" />
                  <span>COMENZAR SORTEOO</span>
                  <Sparkles className="w-5 h-5 text-amber-200 shrink-0" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* STEP 5: FINAL CONFIRMATION (FOR USERNAME & LINK)     */}
      {/* ==================================================== */}
      {step === 5 && (activeSource === 'username' || activeSource === 'link') && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-7 space-y-5">
          <div className="border-b border-neutral-800 pb-3">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block mb-0.5">
              Paso 5
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Confirmación del Sorteo
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800 space-y-1">
              <span className="text-neutral-400 block font-medium">Publicación</span>
              <p className="font-bold text-white truncate text-sm">
                @{postDetails?.author || 'instagram_user'}
              </p>
              <p className="text-neutral-400 text-[11px] truncate">{postDetails?.caption}</p>
            </div>

            <div className="bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800 space-y-1">
              <span className="text-neutral-400 block font-medium">Participantes Válidos</span>
              <p className="font-extrabold text-emerald-400 text-base">
                {filterResults.validParticipants.length} comentarios
              </p>
            </div>

            <div className="bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800 space-y-1">
              <span className="text-neutral-400 block font-medium">Ganadores</span>
              <p className="font-bold text-amber-400 text-sm">
                {winnersCount} Ganador{winnersCount > 1 ? 'es' : ''} {substitutesCount > 0 ? `+ ${substitutesCount} Suplente(s)` : ''}
              </p>
            </div>

            <div className="bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800 space-y-1">
              <span className="text-neutral-400 block font-medium">Verificador & Video</span>
              <p className="font-bold text-rose-400 flex items-center gap-1.5 text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Video 9:16 oficial</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => setStep(4)}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Atrás</span>
            </button>
            <button
              type="button"
              onClick={handleStart}
              className="w-full sm:w-auto min-w-[280px] sm:min-w-[340px] flex items-center justify-center gap-3 py-5 px-8 sm:px-12 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 hover:via-rose-600 hover:to-amber-600 text-white text-base sm:text-lg font-black rounded-full shadow-2xl shadow-rose-500/40 ring-4 ring-rose-500/30 hover:ring-rose-400/60 transition-all transform hover:scale-105 active:scale-95 cursor-pointer uppercase tracking-wider animate-pulse"
            >
              <Play className="w-6 h-6 fill-current text-white shrink-0" />
              <span>COMENZAR SORTEOO</span>
              <Sparkles className="w-5 h-5 text-amber-200 shrink-0" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
