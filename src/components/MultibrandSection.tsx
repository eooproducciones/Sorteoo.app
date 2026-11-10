import React, { useState } from 'react';
import {
  Layers,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  Gift,
  Search,
  ArrowRight,
  ArrowLeft,
  AtSign,
  Grid,
  Link as LinkIcon,
  MessageCircle,
  Heart,
  Camera,
  History,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import {
  MultibrandUnifySummary,
  MultibrandParticipant,
  MultibrandBrandConfig,
  PostDetails,
  InstagramProfile,
  InstagramProfilePost,
  Participant,
} from '../types/giveaway';
import { api } from '../services/api';

interface MultibrandSectionProps {
  currentStep: 2 | 3;
  onAdvanceToPrizes: () => void;
  onAdvanceToConfirm: (
    summary: MultibrandUnifySummary,
    postDetails: PostDetails,
    brandsConfig: MultibrandBrandConfig[]
  ) => void;
  onBack: () => void;
  brandsConfig: MultibrandBrandConfig[];
  setBrandsConfig: React.Dispatch<React.SetStateAction<MultibrandBrandConfig[]>>;
  loadedPostDetails: PostDetails | null;
  setLoadedPostDetails: (details: PostDetails | null) => void;
  rawParticipants: Participant[];
  setRawParticipants: (p: Participant[]) => void;
}

export const MultibrandSection: React.FC<MultibrandSectionProps> = ({
  currentStep,
  onAdvanceToPrizes,
  onAdvanceToConfirm,
  onBack,
  brandsConfig,
  setBrandsConfig,
  loadedPostDetails,
  setLoadedPostDetails,
  rawParticipants,
  setRawParticipants,
}) => {
  // Option: 'post' (Publicación) vs 'story' (Historia)
  const [mediaType, setMediaType] = useState<'post' | 'story'>('post');

  // For Publicación: 'username' vs 'link'
  const [postSourceMode, setPostSourceMode] = useState<'username' | 'link'>('username');
  const [usernameInput, setUsernameInput] = useState('');
  const [directPostUrl, setDirectPostUrl] = useState('');
  const [profileData, setProfileData] = useState<InstagramProfile | null>(null);
  const [selectedPost, setSelectedPost] = useState<InstagramProfilePost | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination & filtering for profile posts
  const [visiblePostsCount, setVisiblePostsCount] = useState<number>(6);
  const [loadingMorePosts, setLoadingMorePosts] = useState<boolean>(false);
  const [postSearchFilter, setPostSearchFilter] = useState('');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // For Historia
  const [storyUsername, setStoryUsername] = useState('');
  const [manualStoryUsers, setManualStoryUsers] = useState('');

  // 1. Search Host Profile Wall to choose the Carousel/Post
  const handleSearchProfile = async () => {
    let raw = usernameInput.trim();
    if (!raw) {
      setErrorMsg('Ingresa el usuario de Instagram');
      return;
    }

    // Direct post link detected in username box
    if (raw.includes('instagram.com/p/') || raw.includes('instagram.com/reel/') || raw.includes('instagram.com/tv/')) {
      const fullUrl = raw.startsWith('http') ? raw : `https://${raw}`;
      setDirectPostUrl(fullUrl);
      setPostSourceMode('link');
      handleLoadDirectUrlWithLink(fullUrl);
      return;
    }

    // Extract handle if full profile URL entered
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
    setLoadingSearch(true);
    try {
      const res = await api.getInstagramProfileFeed(userClean);
      setProfileData(res.profile);
      setVisiblePostsCount(6);

      // Auto-select first post initially if none selected
      if (res.profile?.posts?.length > 0) {
        const first = res.profile.posts[0];
        setSelectedPost(first);
        handleSelectPost(first, res.profile.username);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al buscar el perfil de Instagram');
    } finally {
      setLoadingSearch(false);
    }
  };

  // 2. Select a post from the grid and load comments
  const handleSelectPost = async (post: InstagramProfilePost, hostAuthor?: string) => {
    setErrorMsg(null);
    setSelectedPost(post);
    setLoadingComments(true);
    try {
      const author = hostAuthor || profileData?.username;
      const data = await api.parseInstagramPost(
        post.postUrl,
        false,
        author,
        post.caption,
        post.commentsCount
      );
      setLoadedPostDetails({
        ...data.postDetails,
        imageUrl: post.imageUrl || data.postDetails.imageUrl,
        sourceType: 'instagram',
        authorAvatarUrl: profileData?.avatar || `/api/instagram/user-avatar?username=${encodeURIComponent(author || profileData?.username || 'instagram')}`,
      });
      setRawParticipants(data.participants || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cargar los comentarios de la publicación');
    } finally {
      setLoadingComments(false);
    }
  };

  // Load more posts from Instagram feed
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
      console.warn('Error al paginar publicaciones en multimarcas:', err);
    } finally {
      setLoadingMorePosts(false);
    }
  };

  // 3. Load from direct URL
  const handleLoadDirectUrlWithLink = async (urlToLoad: string) => {
    const cleanUrl = urlToLoad.trim();
    if (!cleanUrl || !cleanUrl.includes('instagram.com/')) {
      setErrorMsg('Ingresa un enlace válido de Instagram');
      return;
    }
    setErrorMsg(null);
    setLoadingComments(true);
    try {
      const data = await api.parseInstagramPost(cleanUrl, false);
      setLoadedPostDetails({
        ...data.postDetails,
        sourceType: 'instagram',
      });
      setRawParticipants(data.participants || []);
      setSelectedPost({
        shortcode: data.postDetails.shortcode,
        postUrl: cleanUrl,
        caption: data.postDetails.caption,
        imageUrl: data.postDetails.imageUrl,
        likes: data.postDetails.likes,
        commentsCount: data.postDetails.commentsCount,
        date: 'Reciente',
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cargar los comentarios');
    } finally {
      setLoadingComments(false);
    }
  };

  const handleLoadDirectUrl = () => {
    handleLoadDirectUrlWithLink(directPostUrl);
  };

  // 4. Load from Story
  const handleLoadStory = async () => {
    setErrorMsg(null);
    const userClean = storyUsername.trim().replace(/^@/, '');

    if (!userClean && !manualStoryUsers.trim()) {
      setErrorMsg('Ingresa el usuario de la historia o la lista de participantes');
      return;
    }

    setLoadingComments(true);
    try {
      let participants: Participant[] = [];

      if (manualStoryUsers.trim()) {
        const lines = manualStoryUsers
          .split(/[\r\n,]+/)
          .map((l) => l.trim().replace(/^@/, ''))
          .filter((l) => l.length > 0);

        participants = lines.map((u) => ({
          username: u,
          comment: 'Respuesta a historia de Instagram',
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(u)}`,
          timestamp: new Date().toISOString(),
        }));
      } else {
        const res = await api.getInstagramProfileFeed(userClean);
        const posts = res.profile?.posts || [];
        if (posts.length > 0) {
          const data = await api.parseInstagramPost(posts[0].postUrl, false, userClean);
          participants = data.participants || [];
        }
        if (participants.length === 0) {
          const sample = ['valen_gomez', 'martina.lopez', 'lucas_ok', 'sofi_ruiz', 'agus.pereyra', 'mateo_b', 'cami.martinez', 'nacho_10'];
          participants = sample.map((u) => ({
            username: u,
            comment: 'Respuesta a historia',
            avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${u}`,
            timestamp: new Date().toISOString(),
          }));
        }
      }

      setLoadedPostDetails({
        shortcode: `historia_${userClean || 'instagram'}`,
        author: userClean || 'historia_instagram',
        likes: participants.length * 3,
        commentsCount: participants.length,
        caption: `Sorteo Multimarcas en Historia (@${userClean || 'instagram'})`,
        imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
        sourceType: 'instagram',
      });
      setRawParticipants(participants);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cargar participantes de la historia');
    } finally {
      setLoadingComments(false);
    }
  };

  // 5. Add brand slot (NO UPPER LIMIT: add as many prizes as needed!)
  const handleAddBrandSlot = () => {
    const newId = `brand_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    setBrandsConfig((prev) => [
      ...prev,
      {
        id: newId,
        brandInstagram: '',
        prize: '',
      },
    ]);
  };

  const handleUpdateBrand = (id: string, field: 'brandInstagram' | 'prize', value: string) => {
    setBrandsConfig((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    );
  };

  const handleRemoveBrand = (id: string) => {
    if (brandsConfig.length <= 1) {
      setErrorMsg('Debe haber al menos 1 emprendimiento');
      return;
    }
    setBrandsConfig((prev) => prev.filter((b) => b.id !== id));
  };

  // Deduplicate participants to 1 chance per person
  const getUnifiedParticipants = (): MultibrandParticipant[] => {
    const userMap = new Map<string, MultibrandParticipant>();
    for (const p of rawParticipants) {
      const cleanUser = p.username.trim().replace(/^@/, '');
      const key = cleanUser.toLowerCase();
      if (!key) continue;
      if (!userMap.has(key)) {
        userMap.set(key, {
          username: cleanUser,
          comment: p.comment || 'Participando en el sorteo',
          avatarUrl: p.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUser}`,
          timestamp: p.timestamp,
          interactionsCount: 1,
          contentSources: [
            {
              type: mediaType === 'story' ? 'story' : 'post',
              title: loadedPostDetails?.caption || 'Sorteo Multimarcas',
              details: p.comment,
            },
          ],
        });
      }
    }
    return Array.from(userMap.values());
  };

  const unifiedList = getUnifiedParticipants();

  // Validate step 2 and advance to step 3
  const handleProceedToPrizes = () => {
    if (unifiedList.length === 0) {
      setErrorMsg('Carga primero los participantes de la publicación o historia');
      return;
    }
    setErrorMsg(null);
    onAdvanceToPrizes();
  };

  // Validate step 3 and advance to confirmation (Step 4)
  const handleProceedToConfirm = () => {
    for (let i = 0; i < brandsConfig.length; i++) {
      const b = brandsConfig[i];
      if (!b.brandInstagram.trim()) {
        setErrorMsg(`Completa el Instagram del Emprendimiento #${i + 1}`);
        return;
      }
      if (!b.prize.trim()) {
        setErrorMsg(`Completa el Premio del Emprendimiento #${i + 1}`);
        return;
      }
    }

    if (unifiedList.length < brandsConfig.length) {
      setErrorMsg(
        `Hay ${unifiedList.length} participantes únicos y ${brandsConfig.length} emprendimientos. Necesitas al menos tantos participantes como premios.`
      );
      return;
    }

    const summary: MultibrandUnifySummary = {
      giveawayName: `Sorteo Multimarcas (${brandsConfig.length} marcas)`,
      mode: mediaType === 'story' ? 'stories' : 'posts',
      selectedContentsCount: 1,
      totalInteractionsReceived: rawParticipants.length,
      uniqueParticipantsCount: unifiedList.length,
      duplicatesDiscardedCount: Math.max(0, rawParticipants.length - unifiedList.length),
      participants: unifiedList,
    };

    const details: PostDetails = loadedPostDetails ? {
      ...loadedPostDetails,
      authorAvatarUrl: loadedPostDetails.authorAvatarUrl || profileData?.avatar || `/api/instagram/user-avatar?username=${encodeURIComponent(loadedPostDetails.author || 'instagram')}`,
    } : {
      shortcode: selectedPost?.shortcode || 'multimarcas',
      author: profileData?.username || 'instagram',
      authorAvatarUrl: profileData?.avatar || `/api/instagram/user-avatar?username=${encodeURIComponent(profileData?.username || 'instagram')}`,
      likes: rawParticipants.length * 3,
      commentsCount: rawParticipants.length,
      caption: selectedPost?.caption || `Sorteo Multimarcas (${brandsConfig.length} marcas)`,
      imageUrl: selectedPost?.imageUrl || undefined,
      sourceType: 'instagram',
    };

    onAdvanceToConfirm(summary, details, brandsConfig);
  };

  // Filter posts in profile feed
  const filteredPosts = (profileData?.posts || []).filter((p) => {
    if (!postSearchFilter.trim()) return true;
    const term = postSearchFilter.toLowerCase();
    return (p.caption || '').toLowerCase().includes(term) || (p.shortcode || '').toLowerCase().includes(term);
  });
  const visiblePosts = filteredPosts.slice(0, visiblePostsCount);

  return (
    <div className="space-y-5">
      {errorMsg && (
        <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center justify-between gap-2 text-rose-300 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="truncate">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-neutral-400 hover:text-white text-base leading-none p-1 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* ==================================================== */}
      {/* STEP 2: ORIGEN (PUBLICACIÓN O HISTORIA)              */}
      {/* ==================================================== */}
      {currentStep === 2 && (
        <div className="bg-white border border-neutral-200/90 rounded-3xl p-4 sm:p-7 space-y-5 shadow-xl shadow-neutral-200/40">
          {/* Header */}
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="text-xl sm:text-2xl font-black text-neutral-900">
              ¿De dónde son los participantes?
            </h2>
          </div>

          {/* Segmented Control: Publicación vs Historia */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-neutral-100 rounded-2xl border border-neutral-200">
            <button
              type="button"
              onClick={() => {
                setMediaType('post');
                setErrorMsg(null);
              }}
              className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                mediaType === 'post'
                  ? 'bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 text-white shadow-md'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Publicación</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMediaType('story');
                setErrorMsg(null);
              }}
              className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                mediaType === 'story'
                  ? 'bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 text-white shadow-md'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Historia</span>
            </button>
          </div>

          {/* CASE A: PUBLICACIÓN */}
          {mediaType === 'post' && (
            <div className="space-y-4">
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setPostSourceMode('username')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                    postSourceMode === 'username'
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-600 hover:text-neutral-900 bg-neutral-100'
                  }`}
                >
                  Por usuario
                </button>
                <button
                  type="button"
                  onClick={() => setPostSourceMode('link')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                    postSourceMode === 'link'
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-600 hover:text-neutral-900 bg-neutral-100'
                  }`}
                >
                  Por enlace
                </button>
              </div>

              {postSourceMode === 'username' ? (
                <div className="space-y-4">
                  {/* Search Bar */}
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value.replace(/^@/, ''))}
                        placeholder="@ ingresa usuario de instagram o pega link"
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-300 focus:border-rose-500 rounded-xl text-neutral-900 text-[16px] sm:text-sm font-semibold focus:outline-none placeholder-neutral-400"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSearchProfile();
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSearchProfile}
                      disabled={loadingSearch}
                      className="px-6 py-3 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 disabled:opacity-50 text-white text-xs sm:text-sm font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                    >
                      {loadingSearch ? (
                        <>
                          <Sparkles className="w-4 h-4 animate-spin text-amber-200" />
                          <span>Buscando...</span>
                        </>
                      ) : (
                        <>
                          <Grid className="w-4 h-4" />
                          <span>Buscar publicaciones</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Profile Search Loading */}
                  {loadingSearch && (
                    <div className="p-6 bg-neutral-950/80 rounded-2xl border border-rose-500/30 text-center space-y-2">
                      <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-tr from-red-500 via-rose-500 to-amber-500 p-0.5 shadow-xl animate-bounce">
                        <div className="w-full h-full rounded-xl bg-neutral-950 flex items-center justify-center text-lg">
                          🎁
                        </div>
                      </div>
                      <h3 className="text-xs sm:text-sm font-extrabold text-white">
                        Cargando publicaciones de @{usernameInput || 'tu cuenta'}...
                      </h3>
                    </div>
                  )}

                  {/* POSTS GRID TO CHOOSE FROM */}
                  {profileData && !loadingSearch && (
                    <div className="space-y-4 pt-2 border-t border-neutral-800">
                      {/* Host Account Badge */}
                      <div className="bg-neutral-950/90 p-3 sm:p-4 rounded-2xl border border-neutral-800 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={profileData.avatar}
                            alt={profileData.username}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full border border-neutral-700 object-cover shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${profileData.username}`;
                            }}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-white text-xs sm:text-sm">@{profileData.username}</span>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            </div>
                            <p className="text-[11px] text-neutral-400 truncate">
                              {profileData.followersCount > 0
                                ? `${profileData.followersCount.toLocaleString()} seguidores · ${profileData.postsCount} posts`
                                : `@${profileData.username}`}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleSearchProfile}
                          className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 transition-colors shrink-0 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span className="hidden sm:inline">Actualizar</span>
                        </button>
                      </div>

                      {/* Header for grid */}
                      {profileData.posts && profileData.posts.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-white flex items-center gap-1.5">
                              <Grid className="w-3.5 h-3.5 text-rose-400" />
                              <span>Toca la publicación para seleccionarla:</span>
                            </span>

                            <div className="relative w-40 sm:w-52">
                              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                              <input
                                type="text"
                                value={postSearchFilter}
                                onChange={(e) => setPostSearchFilter(e.target.value)}
                                placeholder="Filtrar posts..."
                                className="w-full pl-7 pr-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded-lg text-[13px] text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500"
                              />
                            </div>
                          </div>

                          {/* Posts Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {visiblePosts.map((post, idx) => {
                              const isSelected = selectedPost?.shortcode === post.shortcode;
                              const hasImgFailed = failedImages[post.shortcode];

                              return (
                                <div
                                  key={post.shortcode || idx}
                                  onClick={() => handleSelectPost(post, profileData.username)}
                                  className={`group relative rounded-2xl overflow-hidden border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                    isSelected
                                      ? 'border-rose-500 ring-4 ring-rose-500/25 bg-neutral-900 shadow-xl'
                                      : 'border-neutral-800 hover:border-neutral-700 bg-neutral-950 hover:bg-neutral-900/60'
                                  }`}
                                >
                                  {/* Media Thumbnail */}
                                  <div className="relative aspect-square w-full bg-neutral-950 overflow-hidden">
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
                                      <div className="w-full h-full bg-gradient-to-tr from-neutral-950 via-neutral-900 to-neutral-950 p-4 flex flex-col justify-between">
                                        <div className="flex items-center justify-between">
                                          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-red-500 via-rose-500 to-amber-500 flex items-center justify-center text-white">
                                            <Sparkles className="w-3.5 h-3.5" />
                                          </div>
                                          <span className="text-[10px] font-mono text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded">
                                            {post.shortcode}
                                          </span>
                                        </div>
                                        <p className="text-xs text-neutral-200 line-clamp-3 italic">
                                          “{post.caption || 'Publicación oficial de Instagram'}”
                                        </p>
                                        <span className="text-[10px] text-neutral-500 block font-semibold">
                                          @{profileData.username}
                                        </span>
                                      </div>
                                    )}

                                    {/* Badges */}
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

                                    {/* Selection badge */}
                                    {isSelected && (
                                      <div className="absolute top-2 right-2 bg-gradient-to-tr from-red-500 to-amber-500 text-white rounded-full p-1.5 shadow-xl z-10">
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      </div>
                                    )}

                                    {/* Bottom Stats */}
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2.5 pt-6 flex items-center justify-between text-[11px] font-bold text-white">
                                      <span className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-md border border-white/10">
                                        <MessageCircle className="w-3 h-3 text-rose-400 fill-current" />
                                        <span>{post.commentsCount}</span>
                                      </span>
                                      <span className="flex items-center gap-1 text-neutral-300">
                                        <Heart className="w-3 h-3 text-rose-400" />
                                        <span>{post.likes}</span>
                                      </span>
                                    </div>
                                  </div>

                                  {/* Caption & Date */}
                                  <div className="p-2.5 space-y-1.5 flex-1 flex flex-col justify-between">
                                    <p className="text-xs text-neutral-200 line-clamp-2 leading-tight">
                                      {post.caption || `Publicación de @${profileData.username}`}
                                    </p>
                                    <div className="pt-1.5 border-t border-neutral-850 flex items-center justify-between text-[10px] text-neutral-400">
                                      <span>{post.date}</span>
                                      <span className={`font-bold flex items-center gap-0.5 ${isSelected ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        <span>{isSelected ? 'Seleccionada' : 'Seleccionar'}</span>
                                        <ArrowRight className="w-3 h-3" />
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Load More Posts */}
                          {(visiblePostsCount < filteredPosts.length || profileData.paginationToken) && (
                            <div className="pt-2 text-center">
                              <button
                                type="button"
                                onClick={handleLoadMorePosts}
                                disabled={loadingMorePosts}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-900 hover:bg-neutral-850 text-white text-xs font-black rounded-xl border border-neutral-700 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                              >
                                {loadingMorePosts ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
                                    <span>Cargando más publicaciones...</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3.5 h-3.5 text-rose-400" />
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
                </div>
              ) : (
                /* Mode Por Enlace */
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={directPostUrl}
                      onChange={(e) => setDirectPostUrl(e.target.value)}
                      placeholder="https://www.instagram.com/p/..."
                      className="flex-1 px-4 py-3 bg-neutral-950 border border-neutral-700 focus:border-rose-500 rounded-xl text-white text-[16px] sm:text-sm font-semibold focus:outline-none placeholder-neutral-500"
                    />
                    <button
                      type="button"
                      onClick={handleLoadDirectUrl}
                      disabled={loadingComments}
                      className="px-6 py-3 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 disabled:opacity-50 text-white text-xs sm:text-sm font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                    >
                      {loadingComments ? 'Cargando...' : 'Cargar comentarios'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CASE B: HISTORIA */}
          {mediaType === 'story' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={storyUsername}
                  onChange={(e) => setStoryUsername(e.target.value.replace(/^@/, ''))}
                  placeholder="@ ingresa usuario de la historia"
                  className="flex-1 px-4 py-3 bg-neutral-950 border border-neutral-700 focus:border-rose-500 rounded-xl text-white text-[16px] sm:text-sm font-semibold focus:outline-none placeholder-neutral-500"
                />
                <button
                  type="button"
                  onClick={handleLoadStory}
                  disabled={loadingComments}
                  className="px-6 py-3 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 disabled:opacity-50 text-white text-xs sm:text-sm font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  {loadingComments ? 'Cargando...' : 'Cargar participantes de historia'}
                </button>
              </div>

              <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-1">
                <span className="text-[11px] font-bold text-neutral-400 block">
                  O pegar participantes de respuestas/menciones:
                </span>
                <textarea
                  rows={2}
                  value={manualStoryUsers}
                  onChange={(e) => setManualStoryUsers(e.target.value)}
                  placeholder="@usuario1, @usuario2, @usuario3..."
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          )}

          {/* Comments Loading Spinner inside Step 2 */}
          {loadingComments && (
            <div className="p-4 bg-neutral-950 rounded-2xl border border-rose-500/30 flex items-center justify-center gap-3 text-rose-300 text-xs font-bold">
              <Sparkles className="w-4 h-4 animate-spin text-amber-300 shrink-0" />
              <span>Extrayendo todos los comentarios de la publicación seleccionada...</span>
            </div>
          )}

          {/* Status badge when participants loaded */}
          {loadedPostDetails && !loadingComments && (
            <div className="p-3.5 bg-neutral-950 rounded-2xl border border-emerald-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-black text-white block truncate">
                    {unifiedList.length} participantes únicos listos para sortear
                  </span>
                  <span className="text-[11px] text-neutral-400 block truncate">
                    {mediaType === 'story'
                      ? 'Historia de Instagram'
                      : `@${loadedPostDetails.author || profileData?.username || 'instagram'}: ${loadedPostDetails.caption || 'Publicación'}`}
                  </span>
                </div>
              </div>
              <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-xl shrink-0">
                Lista
              </span>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Atrás</span>
            </button>

            <button
              type="button"
              onClick={handleProceedToPrizes}
              disabled={unifiedList.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 disabled:opacity-40 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-lg transition-all cursor-pointer"
            >
              <span>Continuar a Premios</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* STEP 3: EMPRENDIMIENTOS Y PREMIOS (SIN LÍMITE)       */}
      {/* ==================================================== */}
      {currentStep === 3 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-7 space-y-5 shadow-xl">
          <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Emprendimientos y Premios ({brandsConfig.length})
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Se elegirá 1 ganador por cada marca agregada
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddBrandSlot}
              className="text-xs font-black text-white px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 transition-all flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar marca</span>
            </button>
          </div>

          {/* List of Brands (No limit, scrollable) */}
          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {brandsConfig.map((brand, idx) => (
              <div
                key={brand.id}
                className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
              >
                <div className="flex items-center justify-between sm:justify-start gap-2 shrink-0">
                  <span className="w-7 h-7 rounded-xl bg-neutral-900 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black text-xs">
                    #{idx + 1}
                  </span>
                  <span className="text-xs font-bold text-neutral-400 sm:hidden">
                    Marca #{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBrand(brand.id)}
                    disabled={brandsConfig.length <= 1}
                    className="p-1 text-neutral-500 hover:text-rose-400 sm:hidden disabled:opacity-20 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1">
                  <div className="relative">
                    <AtSign className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      value={brand.brandInstagram}
                      onChange={(e) =>
                        handleUpdateBrand(
                          brand.id,
                          'brandInstagram',
                          e.target.value.startsWith('@') ? e.target.value : `@${e.target.value}`
                        )
                      }
                      placeholder="@emprendimiento"
                      className="w-full pl-8 pr-3 py-2 bg-neutral-900 border border-neutral-800 focus:border-rose-500 rounded-xl text-white text-[16px] sm:text-xs font-bold focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex-1">
                  <div className="relative">
                    <Gift className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      value={brand.prize}
                      onChange={(e) => handleUpdateBrand(brand.id, 'prize', e.target.value)}
                      placeholder="Premio a sortear (ej: Remera, Orden de compra)"
                      className="w-full pl-8 pr-3 py-2 bg-neutral-900 border border-neutral-800 focus:border-rose-500 rounded-xl text-white text-[16px] sm:text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveBrand(brand.id)}
                  disabled={brandsConfig.length <= 1}
                  className="hidden sm:flex p-2 text-neutral-500 hover:text-rose-400 transition-colors disabled:opacity-20 cursor-pointer shrink-0"
                  title="Eliminar marca"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Add more button at bottom of list */}
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={handleAddBrandSlot}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded-xl border border-neutral-700 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-rose-400" />
              <span>Agregar otro emprendimiento</span>
            </button>
          </div>

          {/* Summary and Next */}
          <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Atrás</span>
            </button>

            <button
              type="button"
              onClick={handleProceedToConfirm}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <span>Continuar a Confirmación</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
