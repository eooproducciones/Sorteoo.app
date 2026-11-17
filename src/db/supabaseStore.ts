import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const VIDEOS_DIR = path.join(DATA_DIR, 'videos');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export const ADMIN_EMAIL = 'admin@sorteoo.app';

export interface CouponRecord {
  id: string;
  code: string;
  discountPercent: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
  description?: string;
  createdAt: string;
}

export interface PaymentOrderRecord {
  id: string;
  userId: string;
  userEmail?: string;
  method: 'mercadopago' | 'coupon_100';
  baseAmount: number;
  discountPercent: number;
  finalAmount: number;
  couponCode?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  mpPreferenceId?: string;
  mpPaymentId?: string;
  giveawaySummary?: string;
  createdAt: string;
  approvedAt?: string;
  couponCounted?: boolean;
}

export interface AdminStoreData {
  giveawayPrice: number;
  currency: 'ARS';
  mpAccessToken: string;
  mpPublicKey: string;
  coupons: CouponRecord[];
  payments: PaymentOrderRecord[];
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  avatar: string;
  createdAt: string;
  role?: 'user' | 'admin';
  instagramConfig?: {
    appId?: string;
    accessToken?: string;
    sessionId?: string;
    isConnected?: boolean;
    adminRole?: 'admin' | 'user';
    adminStore?: AdminStoreData;
  };
}

export interface ParticipantRecord {
  username: string;
  comment: string;
  avatarUrl?: string;
  timestamp?: string;
  mentions?: string[];
  assignedBrand?: string;
  assignedPrize?: string;
}

export interface GiveawayRecord {
  id: string;
  userId: string;
  postUrl: string;
  postDetails: {
    shortcode: string;
    author: string;
    likes: number;
    commentsCount: number;
    caption: string;
    imageUrl?: string;
    sourceType?: string;
  };
  status: 'completed' | 'draft';
  createdAt: string;
  totalParticipantsDetected: number;
  validParticipantsCount: number;
  filtersApplied: {
    minMentions: number;
    removeDuplicateUsers: boolean;
    requiredKeyword: string;
    excludedUsers: string[];
  };
  winnersCount: number;
  substitutesCount: number;
  winners: ParticipantRecord[];
  substitutes: ParticipantRecord[];
  audit: {
    seed: string;
    verificationCode: string;
    drawnAt: string;
    sha256Hash: string;
  };
  video: {
    hasVideo: boolean;
    videoFileName?: string;
    mp4FileName?: string;
    storageKey?: string;
    videoDurationSeconds?: number;
    videoSizeFormatted?: string;
    videoMimeType?: string;
    recordedAt?: string;
  };
  multibrandMeta?: {
    isMultibrand: boolean;
    mode: 'posts' | 'stories';
    selectedContentsCount: number;
    totalRawInteractions: number;
    brands?: string[];
  };
}

export interface MultibrandStoryReplyRecord {
  id: string;
  storyId: string;
  messageId: string;
  userId: string;
  username: string;
  text: string;
  timestamp: string;
  isValidParticipo: boolean;
}

export interface MultibrandStoryRecord {
  id: string;
  userId?: string;
  username: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  publishedAt: string;
  brandName: string;
  prize?: string;
  repliesCount: number;
  replies: MultibrandStoryReplyRecord[];
  isArchived?: boolean;
}

interface LocalDatabaseSchema {
  users: UserRecord[];
  giveaways: GiveawayRecord[];
  stories: MultibrandStoryRecord[];
  adminStore?: AdminStoreData;
}

const PENDING_CHECKOUTS_DIR = path.join(DATA_DIR, 'pending_checkouts');

const VIDEO_BUCKET = 'giveaway-videos';

const rawSupabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

let supabaseClient: SupabaseClient | null = null;
if (supabaseUrl && supabaseKey) {
  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function isSupabaseEnabled(): boolean {
  return Boolean(supabaseClient);
}

// Local JSON helpers (used only when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set)
function ensureLocalDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

function loadLocalDB(): LocalDatabaseSchema {
  ensureLocalDirs();
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        giveaways: Array.isArray(parsed.giveaways) ? parsed.giveaways : [],
        stories: Array.isArray(parsed.stories) ? parsed.stories : [],
      };
    }
  } catch (err) {
    console.error('Error reading local db.json:', err);
  }
  return { users: [], giveaways: [], stories: [] };
}

function saveLocalDB(db: LocalDatabaseSchema) {
  ensureLocalDirs();
  const tmpFile = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

function createDefaultAdminStore(): AdminStoreData {
  return {
    giveawayPrice: 5000,
    currency: 'ARS',
    mpAccessToken: '',
    mpPublicKey: '',
    coupons: [],
    payments: [],
  };
}

function normalizeAdminStore(raw: any): AdminStoreData {
  const def = createDefaultAdminStore();
  if (!raw || typeof raw !== 'object') return def;
  const price = Number(raw.giveawayPrice);
  return {
    giveawayPrice: Number.isFinite(price) && price >= 0 ? Math.round(price) : def.giveawayPrice,
    currency: 'ARS',
    mpAccessToken: typeof raw.mpAccessToken === 'string' ? raw.mpAccessToken : '',
    mpPublicKey: typeof raw.mpPublicKey === 'string' ? raw.mpPublicKey : '',
    coupons: Array.isArray(raw.coupons) ? raw.coupons : [],
    payments: Array.isArray(raw.payments) ? raw.payments : [],
  };
}

function mapUserFromRow(row: any): UserRecord {
  const emailLower = String(row.email || '').trim().toLowerCase();
  const isAdmin = emailLower === ADMIN_EMAIL || row.instagram_config?.adminRole === 'admin';
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    avatar: row.avatar || '',
    role: isAdmin ? 'admin' : 'user',
    instagramConfig: row.instagram_config || { isConnected: false },
    createdAt: row.created_at,
  };
}

export function sanitizeUserForClient(user: UserRecord) {
  const { passwordHash: _pw, instagramConfig, ...rest } = user;
  const cleanInstagramConfig = instagramConfig
    ? {
        appId: instagramConfig.appId,
        accessToken: instagramConfig.accessToken,
        sessionId: instagramConfig.sessionId,
        isConnected: Boolean(instagramConfig.isConnected),
      }
    : { isConnected: false };

  const isAdmin =
    user.email.trim().toLowerCase() === ADMIN_EMAIL ||
    user.role === 'admin' ||
    instagramConfig?.adminRole === 'admin';

  return {
    ...rest,
    role: (isAdmin ? 'admin' : 'user') as 'admin' | 'user',
    instagramConfig: cleanInstagramConfig,
  };
}

function mapGiveawayFromRow(row: any): GiveawayRecord {
  return {
    id: row.id,
    userId: row.user_id,
    postUrl: row.post_url,
    postDetails: row.post_details || {},
    status: row.status || 'completed',
    createdAt: row.created_at,
    totalParticipantsDetected: row.total_participants_detected ?? 0,
    validParticipantsCount: row.valid_participants_count ?? 0,
    filtersApplied: row.filters_applied || {},
    winnersCount: row.winners_count ?? 1,
    substitutesCount: row.substitutes_count ?? 0,
    winners: Array.isArray(row.winners) ? row.winners : [],
    substitutes: Array.isArray(row.substitutes) ? row.substitutes : [],
    audit: row.audit || {},
    video: row.video || { hasVideo: false },
    multibrandMeta: row.multibrand_meta || undefined,
  };
}

function mapReplyFromRow(row: any): MultibrandStoryReplyRecord {
  return {
    id: row.id,
    storyId: row.story_id,
    messageId: row.message_id,
    userId: row.user_id,
    username: row.username,
    text: row.text,
    timestamp: row.timestamp,
    isValidParticipo: Boolean(row.is_valid_participo),
  };
}

function mapStoryFromRow(row: any, replies: MultibrandStoryReplyRecord[] = []): MultibrandStoryRecord {
  return {
    id: row.id,
    userId: row.user_id || undefined,
    username: row.username,
    mediaUrl: row.media_url,
    thumbnailUrl: row.thumbnail_url || undefined,
    publishedAt: row.published_at,
    brandName: row.brand_name,
    prize: row.prize || undefined,
    repliesCount: row.replies_count ?? replies.filter((r) => r.isValidParticipo).length,
    replies,
    isArchived: Boolean(row.is_archived),
  };
}

// ============================================================================
// USERS
// ============================================================================
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const normalized = email.trim().toLowerCase();
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .ilike('email', normalized)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapUserFromRow(data) : null;
  }
  const db = loadLocalDB();
  return db.users.find((u) => u.email.toLowerCase() === normalized) || null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapUserFromRow(data) : null;
  }
  const db = loadLocalDB();
  return db.users.find((u) => u.id === id) || null;
}

export async function createUser(user: UserRecord): Promise<UserRecord> {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('users')
      .insert({
        id: user.id,
        name: user.name,
        email: user.email.toLowerCase(),
        password_hash: user.passwordHash,
        avatar: user.avatar,
        instagram_config: user.instagramConfig || { isConnected: false },
        created_at: user.createdAt,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapUserFromRow(data);
  }
  const db = loadLocalDB();
  db.users.push(user);
  saveLocalDB(db);
  return user;
}

export async function updateUser(
  id: string,
  updates: Partial<Pick<UserRecord, 'name' | 'avatar' | 'instagramConfig' | 'passwordHash'>>
): Promise<UserRecord | null> {
  if (supabaseClient) {
    const existing = await findUserById(id);
    if (!existing) return null;
    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.avatar !== undefined) payload.avatar = updates.avatar;
    if (updates.passwordHash !== undefined) payload.password_hash = updates.passwordHash;
    if (updates.instagramConfig !== undefined) {
      payload.instagram_config = {
        ...existing.instagramConfig,
        ...updates.instagramConfig,
        // Always preserve internal adminRole and adminStore
        ...(existing.instagramConfig?.adminRole ? { adminRole: existing.instagramConfig.adminRole } : {}),
        ...(existing.instagramConfig?.adminStore ? { adminStore: existing.instagramConfig.adminStore } : {}),
      };
    }
    const { data, error } = await supabaseClient
      .from('users')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapUserFromRow(data);
  }
  const db = loadLocalDB();
  const idx = db.users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  if (updates.name !== undefined) db.users[idx].name = updates.name;
  if (updates.avatar !== undefined) db.users[idx].avatar = updates.avatar;
  if (updates.passwordHash !== undefined) db.users[idx].passwordHash = updates.passwordHash;
  if (updates.instagramConfig !== undefined) {
    db.users[idx].instagramConfig = {
      ...db.users[idx].instagramConfig,
      ...updates.instagramConfig,
      ...(db.users[idx].instagramConfig?.adminRole ? { adminRole: db.users[idx].instagramConfig?.adminRole } : {}),
      ...(db.users[idx].instagramConfig?.adminStore ? { adminStore: db.users[idx].instagramConfig?.adminStore } : {}),
    };
  }
  saveLocalDB(db);
  return db.users[idx];
}

export async function ensureAdminUserRecord(passwordHash: string): Promise<UserRecord> {
  const existing = await findUserByEmail(ADMIN_EMAIL);
  if (existing) {
    const existingStore = existing.instagramConfig?.adminStore
      ? normalizeAdminStore(existing.instagramConfig.adminStore)
      : createDefaultAdminStore();
    const needsConfigInit =
      !existing.instagramConfig?.adminStore || existing.instagramConfig?.adminRole !== 'admin';

    if (needsConfigInit) {
      if (supabaseClient) {
        const { data, error } = await supabaseClient
          .from('users')
          .update({
            instagram_config: {
              ...(existing.instagramConfig || { isConnected: false }),
              adminRole: 'admin',
              adminStore: existingStore,
            },
          })
          .eq('id', existing.id)
          .select('*')
          .single();
        if (!error && data) return mapUserFromRow(data);
      } else {
        const db = loadLocalDB();
        const idx = db.users.findIndex((u) => u.id === existing.id);
        if (idx !== -1) {
          db.users[idx].role = 'admin';
          db.users[idx].instagramConfig = {
            ...(db.users[idx].instagramConfig || { isConnected: false }),
            adminRole: 'admin',
            adminStore: existingStore,
          };
          saveLocalDB(db);
          return db.users[idx];
        }
      }
    }
    return { ...existing, role: 'admin' };
  }

  const adminUser: UserRecord = {
    id: `usr_admin_sorteoo`,
    name: 'Administrador Sorteoo',
    email: ADMIN_EMAIL,
    passwordHash,
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=AdminSorteoo',
    createdAt: new Date().toISOString(),
    role: 'admin',
    instagramConfig: {
      isConnected: false,
      adminRole: 'admin',
      adminStore: createDefaultAdminStore(),
    },
  };
  const created = await createUser(adminUser);
  return { ...created, role: 'admin' };
}

// ============================================================================
// GIVEAWAYS
// ============================================================================
export async function listGiveawaysByUser(userId: string): Promise<GiveawayRecord[]> {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('giveaways')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapGiveawayFromRow);
  }
  const db = loadLocalDB();
  return db.giveaways
    .filter((g) => g.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function listGiveawaysByIds(ids: string[], allowedUserId?: string): Promise<GiveawayRecord[]> {
  const cleanIds = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))).slice(0, 50);
  if (cleanIds.length === 0) return [];

  const isVisible = (g: GiveawayRecord) =>
    g.userId === 'guest_user' || (Boolean(allowedUserId) && g.userId === allowedUserId);

  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('giveaways')
      .select('*')
      .in('id', cleanIds)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapGiveawayFromRow).filter(isVisible);
  }
  const db = loadLocalDB();
  return db.giveaways
    .filter((g) => cleanIds.includes(g.id) && isVisible(g))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function claimGuestGiveaways(ids: string[], targetUserId: string): Promise<number> {
  const cleanIds = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))).slice(0, 50);
  if (cleanIds.length === 0 || !targetUserId) return 0;

  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('giveaways')
      .update({ user_id: targetUserId })
      .in('id', cleanIds)
      .eq('user_id', 'guest_user')
      .select('id');
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? data.length : 0;
  }
  const db = loadLocalDB();
  let updated = 0;
  for (const g of db.giveaways) {
    if (cleanIds.includes(g.id) && g.userId === 'guest_user') {
      g.userId = targetUserId;
      updated++;
    }
  }
  if (updated > 0) saveLocalDB(db);
  return updated;
}

export async function findGiveawayById(id: string): Promise<GiveawayRecord | null> {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('giveaways')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapGiveawayFromRow(data) : null;
  }
  const db = loadLocalDB();
  return db.giveaways.find((g) => g.id === id) || null;
}

export async function findGiveawayByVerificationCode(code: string): Promise<GiveawayRecord | null> {
  const cleanCode = code.trim();
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('giveaways')
      .select('*')
      .or(`verification_code.ilike.${cleanCode},id.eq.${cleanCode}`)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapGiveawayFromRow(data) : null;
  }
  const db = loadLocalDB();
  return (
    db.giveaways.find(
      (g) =>
        g.audit?.verificationCode?.toLowerCase() === cleanCode.toLowerCase() ||
        g.id === cleanCode
    ) || null
  );
}

export async function createGiveaway(giveaway: GiveawayRecord): Promise<GiveawayRecord> {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('giveaways')
      .insert({
        id: giveaway.id,
        user_id: giveaway.userId,
        post_url: giveaway.postUrl,
        post_details: giveaway.postDetails,
        status: giveaway.status,
        created_at: giveaway.createdAt,
        total_participants_detected: giveaway.totalParticipantsDetected,
        valid_participants_count: giveaway.validParticipantsCount,
        filters_applied: giveaway.filtersApplied,
        winners_count: giveaway.winnersCount,
        substitutes_count: giveaway.substitutesCount,
        winners: giveaway.winners,
        substitutes: giveaway.substitutes,
        audit: giveaway.audit,
        video: giveaway.video,
        multibrand_meta: giveaway.multibrandMeta || null,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapGiveawayFromRow(data);
  }
  const db = loadLocalDB();
  db.giveaways.push(giveaway);
  saveLocalDB(db);
  return giveaway;
}

export async function updateGiveawayVideo(
  id: string,
  video: GiveawayRecord['video']
): Promise<GiveawayRecord | null> {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('giveaways')
      .update({ video })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapGiveawayFromRow(data) : null;
  }
  const db = loadLocalDB();
  const giveaway = db.giveaways.find((g) => g.id === id);
  if (!giveaway) return null;
  giveaway.video = video;
  saveLocalDB(db);
  return giveaway;
}

export async function deleteGiveawayRecord(id: string): Promise<boolean> {
  if (supabaseClient) {
    const { error } = await supabaseClient.from('giveaways').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }
  const db = loadLocalDB();
  const idx = db.giveaways.findIndex((g) => g.id === id);
  if (idx === -1) return false;
  db.giveaways.splice(idx, 1);
  saveLocalDB(db);
  return true;
}

// ============================================================================
// SUPABASE STORAGE (VIDEOS)
// ============================================================================
export async function uploadVideoToSupabaseStorage(
  storageKey: string,
  localFilePath: string,
  contentType = 'video/mp4'
): Promise<boolean> {
  if (!supabaseClient || !fs.existsSync(localFilePath)) return false;
  try {
    const buffer = fs.readFileSync(localFilePath);
    const { error } = await supabaseClient.storage.from(VIDEO_BUCKET).upload(storageKey, buffer, {
      contentType,
      upsert: true,
    });
    if (error) {
      console.warn('Supabase storage upload warning:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('Supabase storage upload error:', err?.message || err);
    return false;
  }
}

export async function downloadVideoFromSupabaseStorage(storageKey: string): Promise<Buffer | null> {
  if (!supabaseClient || !storageKey) return null;
  try {
    const { data, error } = await supabaseClient.storage.from(VIDEO_BUCKET).download(storageKey);
    if (error || !data) return null;
    const arr = await data.arrayBuffer();
    return Buffer.from(arr);
  } catch {
    return null;
  }
}

export async function deleteVideosFromSupabaseStorage(keys: string[]): Promise<void> {
  if (!supabaseClient || keys.length === 0) return;
  try {
    await supabaseClient.storage.from(VIDEO_BUCKET).remove(keys);
  } catch {
    // ignore cleanup warnings
  }
}

// ============================================================================
// MULTIBRAND STORIES & REPLIES
// ============================================================================
export async function listStories(): Promise<MultibrandStoryRecord[]> {
  if (supabaseClient) {
    const { data: storiesRows, error } = await supabaseClient
      .from('multibrand_stories')
      .select('*')
      .order('published_at', { ascending: false });
    if (error) throw new Error(error.message);
    if (!storiesRows || storiesRows.length === 0) return [];

    const storyIds = storiesRows.map((s: any) => s.id);
    const { data: replyRows } = await supabaseClient
      .from('multibrand_story_replies')
      .select('*')
      .in('story_id', storyIds);

    const repliesByStory = new Map<string, MultibrandStoryReplyRecord[]>();
    for (const r of replyRows || []) {
      const mapped = mapReplyFromRow(r);
      const list = repliesByStory.get(mapped.storyId) || [];
      list.push(mapped);
      repliesByStory.set(mapped.storyId, list);
    }

    return storiesRows.map((row: any) => mapStoryFromRow(row, repliesByStory.get(row.id) || []));
  }
  const db = loadLocalDB();
  return db.stories;
}

export async function findStoryById(id: string): Promise<MultibrandStoryRecord | null> {
  if (supabaseClient) {
    const { data: row, error } = await supabaseClient
      .from('multibrand_stories')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;

    const { data: replyRows } = await supabaseClient
      .from('multibrand_story_replies')
      .select('*')
      .eq('story_id', id);

    return mapStoryFromRow(row, (replyRows || []).map(mapReplyFromRow));
  }
  const db = loadLocalDB();
  return db.stories.find((s) => s.id === id) || null;
}

export async function getFirstStory(): Promise<MultibrandStoryRecord | null> {
  if (supabaseClient) {
    const { data: row, error } = await supabaseClient
      .from('multibrand_stories')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ? mapStoryFromRow(row, []) : null;
  }
  const db = loadLocalDB();
  return db.stories[0] || null;
}

export async function createStory(story: MultibrandStoryRecord): Promise<MultibrandStoryRecord> {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('multibrand_stories')
      .insert({
        id: story.id,
        user_id: story.userId || null,
        username: story.username,
        media_url: story.mediaUrl,
        thumbnail_url: story.thumbnailUrl || null,
        published_at: story.publishedAt,
        brand_name: story.brandName,
        prize: story.prize || null,
        replies_count: story.repliesCount,
        is_archived: Boolean(story.isArchived),
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapStoryFromRow(data, []);
  }
  const db = loadLocalDB();
  db.stories.unshift(story);
  saveLocalDB(db);
  return story;
}

export async function updateStory(
  id: string,
  updates: Partial<Pick<MultibrandStoryRecord, 'brandName' | 'prize' | 'isArchived'>>
): Promise<MultibrandStoryRecord | null> {
  if (supabaseClient) {
    const payload: Record<string, any> = {};
    if (updates.brandName !== undefined) payload.brand_name = updates.brandName;
    if (updates.prize !== undefined) payload.prize = updates.prize;
    if (updates.isArchived !== undefined) payload.is_archived = updates.isArchived;

    const { data, error } = await supabaseClient
      .from('multibrand_stories')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapStoryFromRow(data, []) : null;
  }
  const db = loadLocalDB();
  const story = db.stories.find((s) => s.id === id);
  if (!story) return null;
  if (updates.brandName !== undefined) story.brandName = updates.brandName;
  if (updates.prize !== undefined) story.prize = updates.prize;
  if (updates.isArchived !== undefined) story.isArchived = updates.isArchived;
  saveLocalDB(db);
  return story;
}

export async function deleteStory(id: string): Promise<boolean> {
  if (supabaseClient) {
    const { error } = await supabaseClient.from('multibrand_stories').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }
  const db = loadLocalDB();
  const idx = db.stories.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  db.stories.splice(idx, 1);
  saveLocalDB(db);
  return true;
}

export async function addStoryReply(reply: MultibrandStoryReplyRecord): Promise<boolean> {
  if (supabaseClient) {
    const { error } = await supabaseClient.from('multibrand_story_replies').insert({
      id: reply.id,
      story_id: reply.storyId,
      message_id: reply.messageId,
      user_id: reply.userId,
      username: reply.username,
      text: reply.text,
      timestamp: reply.timestamp,
      is_valid_participo: reply.isValidParticipo,
    });
    if (error) throw new Error(error.message);

    const { count } = await supabaseClient
      .from('multibrand_story_replies')
      .select('id', { count: 'exact', head: true })
      .eq('story_id', reply.storyId)
      .eq('is_valid_participo', true);

    await supabaseClient
      .from('multibrand_stories')
      .update({ replies_count: count || 0 })
      .eq('id', reply.storyId);
    return true;
  }
  const db = loadLocalDB();
  const story = db.stories.find((s) => s.id === reply.storyId);
  if (!story) return false;
  story.replies.push(reply);
  story.repliesCount = story.replies.filter((r) => r.isValidParticipo).length;
  saveLocalDB(db);
  return true;
}

export async function listStoriesByIds(ids: string[]): Promise<MultibrandStoryRecord[]> {
  if (supabaseClient) {
    const { data: storiesRows, error } = await supabaseClient
      .from('multibrand_stories')
      .select('*')
      .in('id', ids);
    if (error) throw new Error(error.message);
    if (!storiesRows || storiesRows.length === 0) return [];

    const { data: replyRows } = await supabaseClient
      .from('multibrand_story_replies')
      .select('*')
      .in('story_id', ids);

    const repliesByStory = new Map<string, MultibrandStoryReplyRecord[]>();
    for (const r of replyRows || []) {
      const mapped = mapReplyFromRow(r);
      const list = repliesByStory.get(mapped.storyId) || [];
      list.push(mapped);
      repliesByStory.set(mapped.storyId, list);
    }
    return storiesRows.map((row: any) => mapStoryFromRow(row, repliesByStory.get(row.id) || []));
  }
  const db = loadLocalDB();
  return db.stories.filter((s) => ids.includes(s.id));
}

// ============================================================================
// ADMIN SETTINGS, COUPONS & MERCADO PAGO PAYMENTS (PERSISTENT IN SUPABASE)
// ============================================================================
let adminStoreLock: Promise<any> = Promise.resolve();

function withAdminStoreLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = adminStoreLock.then(fn, fn);
  adminStoreLock = run.catch(() => undefined);
  return run;
}

async function readAdminStore(): Promise<AdminStoreData> {
  if (supabaseClient) {
    const adminUser = await findUserByEmail(ADMIN_EMAIL);
    if (adminUser?.instagramConfig?.adminStore) {
      return normalizeAdminStore(adminUser.instagramConfig.adminStore);
    }
    return createDefaultAdminStore();
  }
  const db = loadLocalDB();
  return normalizeAdminStore(db.adminStore);
}

async function writeAdminStore(nextStore: AdminStoreData): Promise<AdminStoreData> {
  const normalized = normalizeAdminStore(nextStore);
  // Bound recent payment history to 250 entries to keep JSONB payload compact
  if (normalized.payments.length > 250) {
    normalized.payments = normalized.payments.slice(0, 250);
  }

  if (supabaseClient) {
    const adminUser = await findUserByEmail(ADMIN_EMAIL);
    if (!adminUser) {
      throw new Error('Usuario administrador no inicializado');
    }
    const nextConfig = {
      ...(adminUser.instagramConfig || { isConnected: false }),
      adminRole: 'admin' as const,
      adminStore: normalized,
    };
    const { error } = await supabaseClient
      .from('users')
      .update({ instagram_config: nextConfig })
      .eq('id', adminUser.id);
    if (error) throw new Error(error.message);
    return normalized;
  }

  const db = loadLocalDB();
  db.adminStore = normalized;
  const adminIdx = db.users.findIndex((u) => u.email.toLowerCase() === ADMIN_EMAIL);
  if (adminIdx !== -1) {
    db.users[adminIdx].instagramConfig = {
      ...(db.users[adminIdx].instagramConfig || { isConnected: false }),
      adminRole: 'admin',
      adminStore: normalized,
    };
  }
  saveLocalDB(db);
  return normalized;
}

export async function getPaymentSettings() {
  const store = await readAdminStore();
  return {
    giveawayPrice: store.giveawayPrice,
    currency: store.currency,
    mpAccessToken: store.mpAccessToken,
    mpPublicKey: store.mpPublicKey,
  };
}

export async function updatePaymentSettings(updates: {
  mpAccessToken?: string;
  mpPublicKey?: string;
  giveawayPrice?: number;
  clearToken?: boolean;
}) {
  return withAdminStoreLock(async () => {
    const store = await readAdminStore();
    if (updates.clearToken) {
      store.mpAccessToken = '';
    } else if (typeof updates.mpAccessToken === 'string' && updates.mpAccessToken.trim().length > 0) {
      store.mpAccessToken = updates.mpAccessToken.trim();
    }
    if (typeof updates.mpPublicKey === 'string') {
      store.mpPublicKey = updates.mpPublicKey.trim();
    }
    if (updates.giveawayPrice !== undefined) {
      const parsedPrice = Math.round(Number(updates.giveawayPrice));
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        throw new Error('El valor del sorteo debe ser un monto válido');
      }
      store.giveawayPrice = parsedPrice;
    }
    await writeAdminStore(store);
    return {
      giveawayPrice: store.giveawayPrice,
      currency: store.currency,
      mpAccessToken: store.mpAccessToken,
      mpPublicKey: store.mpPublicKey,
    };
  });
}

export async function listCoupons(): Promise<CouponRecord[]> {
  const store = await readAdminStore();
  return [...store.coupons].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function createCoupon(input: {
  code: string;
  discountPercent: number;
  maxUses: number;
  description?: string;
}): Promise<CouponRecord> {
  return withAdminStoreLock(async () => {
    const store = await readAdminStore();
    const cleanCode = String(input.code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');

    if (cleanCode.length < 2) {
      throw new Error('El código del cupón debe tener al menos 2 caracteres alfanuméricos');
    }
    if (store.coupons.some((c) => c.code.toUpperCase() === cleanCode)) {
      throw new Error(`Ya existe un cupón con el código ${cleanCode}`);
    }

    const discountPercent = Math.round(Number(input.discountPercent));
    if (!Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 100) {
      throw new Error('El porcentaje de descuento debe estar entre 1% y 100%');
    }

    const maxUses = Math.round(Number(input.maxUses));
    if (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > 100000) {
      throw new Error('La cantidad de usos debe ser al menos 1');
    }

    const newCoupon: CouponRecord = {
      id: `cpn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      code: cleanCode,
      discountPercent,
      maxUses,
      usedCount: 0,
      active: true,
      description: input.description ? String(input.description).trim() : undefined,
      createdAt: new Date().toISOString(),
    };

    store.coupons.unshift(newCoupon);
    await writeAdminStore(store);
    return newCoupon;
  });
}

export async function updateCoupon(
  id: string,
  updates: Partial<Pick<CouponRecord, 'active' | 'discountPercent' | 'maxUses' | 'description'>>
): Promise<CouponRecord | null> {
  return withAdminStoreLock(async () => {
    const store = await readAdminStore();
    const idx = store.coupons.findIndex((c) => c.id === id);
    if (idx === -1) return null;

    const current = store.coupons[idx];
    if (updates.active !== undefined) current.active = Boolean(updates.active);
    if (updates.discountPercent !== undefined) {
      const pct = Math.round(Number(updates.discountPercent));
      if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
        throw new Error('El porcentaje debe estar entre 1% y 100%');
      }
      current.discountPercent = pct;
    }
    if (updates.maxUses !== undefined) {
      const maxU = Math.round(Number(updates.maxUses));
      if (!Number.isFinite(maxU) || maxU < 1) {
        throw new Error('La cantidad de usos debe ser al menos 1');
      }
      current.maxUses = maxU;
    }
    if (updates.description !== undefined) {
      current.description = updates.description ? String(updates.description).trim() : undefined;
    }

    store.coupons[idx] = current;
    await writeAdminStore(store);
    return current;
  });
}

export async function deleteCoupon(id: string): Promise<boolean> {
  return withAdminStoreLock(async () => {
    const store = await readAdminStore();
    const idx = store.coupons.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    store.coupons.splice(idx, 1);
    await writeAdminStore(store);
    return true;
  });
}

function computeDiscountBreakdown(basePrice: number, coupon: CouponRecord) {
  const discountPercent = Math.min(100, Math.max(1, Math.round(coupon.discountPercent)));
  const discountAmount = Math.round((basePrice * discountPercent) / 100);
  const finalAmount = discountPercent >= 100 ? 0 : Math.max(0, basePrice - discountAmount);
  return {
    basePrice,
    discountPercent,
    discountAmount,
    finalAmount,
    isFree: finalAmount === 0,
    remainingUses: Math.max(0, coupon.maxUses - coupon.usedCount),
  };
}

export async function validateCouponCode(code: string) {
  const cleanCode = String(code || '').trim().toUpperCase();
  if (!cleanCode) {
    throw new Error('Ingresa un código de cupón');
  }
  const store = await readAdminStore();
  const coupon = store.coupons.find((c) => c.code.toUpperCase() === cleanCode);
  if (!coupon) {
    throw new Error('El código de cupón ingresado no existe');
  }
  if (!coupon.active) {
    throw new Error('Este cupón se encuentra pausado o inactivo');
  }
  if (coupon.usedCount >= coupon.maxUses) {
    throw new Error('Este cupón ya alcanzó el límite máximo de usos');
  }

  return {
    valid: true,
    code: coupon.code,
    description: coupon.description,
    ...computeDiscountBreakdown(store.giveawayPrice, coupon),
  };
}

export async function redeemFreeCouponOrder(
  code: string,
  meta: { userId: string; userEmail?: string; giveawaySummary?: string }
): Promise<{ order: PaymentOrderRecord; coupon: CouponRecord }> {
  return withAdminStoreLock(async () => {
    const store = await readAdminStore();
    const cleanCode = String(code || '').trim().toUpperCase();
    const couponIdx = store.coupons.findIndex((c) => c.code.toUpperCase() === cleanCode);
    if (couponIdx === -1) {
      throw new Error('El código de cupón ingresado no existe');
    }
    const coupon = store.coupons[couponIdx];
    if (!coupon.active) {
      throw new Error('Este cupón se encuentra pausado o inactivo');
    }
    if (coupon.usedCount >= coupon.maxUses) {
      throw new Error('Este cupón ya alcanzó el límite máximo de usos');
    }
    if (coupon.discountPercent < 100) {
      throw new Error('Este cupón no cubre el 100% del sorteo; debes completar el saldo por Mercado Pago.');
    }

    coupon.usedCount += 1;
    store.coupons[couponIdx] = coupon;

    const order: PaymentOrderRecord = {
      id: `pay_free_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: meta.userId || 'guest_user',
      userEmail: meta.userEmail,
      method: 'coupon_100',
      baseAmount: store.giveawayPrice,
      discountPercent: 100,
      finalAmount: 0,
      couponCode: coupon.code,
      status: 'approved',
      giveawaySummary: meta.giveawaySummary,
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      couponCounted: true,
    };

    store.payments.unshift(order);
    await writeAdminStore(store);
    return { order, coupon };
  });
}

export async function createPendingPaymentOrder(input: {
  id: string;
  userId: string;
  userEmail?: string;
  baseAmount: number;
  discountPercent: number;
  finalAmount: number;
  couponCode?: string;
  mpPreferenceId: string;
  giveawaySummary?: string;
}): Promise<PaymentOrderRecord> {
  return withAdminStoreLock(async () => {
    const store = await readAdminStore();
    const order: PaymentOrderRecord = {
      id: input.id,
      userId: input.userId || 'guest_user',
      userEmail: input.userEmail,
      method: 'mercadopago',
      baseAmount: input.baseAmount,
      discountPercent: input.discountPercent,
      finalAmount: input.finalAmount,
      couponCode: input.couponCode,
      status: 'pending',
      mpPreferenceId: input.mpPreferenceId,
      giveawaySummary: input.giveawaySummary,
      createdAt: new Date().toISOString(),
      couponCounted: false,
    };
    store.payments.unshift(order);
    await writeAdminStore(store);
    return order;
  });
}

export async function getPaymentOrderById(id: string): Promise<PaymentOrderRecord | null> {
  const store = await readAdminStore();
  return store.payments.find((p) => p.id === id) || null;
}

export async function markPaymentOrderApproved(
  id: string,
  mpPaymentId?: string
): Promise<PaymentOrderRecord | null> {
  return withAdminStoreLock(async () => {
    const store = await readAdminStore();
    const idx = store.payments.findIndex((p) => p.id === id);
    if (idx === -1) return null;

    const order = store.payments[idx];
    order.status = 'approved';
    if (!order.approvedAt) {
      order.approvedAt = new Date().toISOString();
    }
    if (mpPaymentId) {
      order.mpPaymentId = mpPaymentId;
    }

    // Consume coupon use exactly once on payment approval
    if (order.couponCode && !order.couponCounted) {
      const cIdx = store.coupons.findIndex(
        (c) => c.code.toUpperCase() === order.couponCode!.toUpperCase()
      );
      if (cIdx !== -1) {
        store.coupons[cIdx].usedCount += 1;
      }
      order.couponCounted = true;
    }

    store.payments[idx] = order;
    await writeAdminStore(store);
    return order;
  });
}

export async function listPaymentOrders(): Promise<PaymentOrderRecord[]> {
  const store = await readAdminStore();
  return [...store.payments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// Temporary local persistence for Mercado Pago redirect recovery
export function savePendingDrawConfig(ref: string, drawConfig: any) {
  if (!ref || !drawConfig) return;
  try {
    ensureLocalDirs();
    if (!fs.existsSync(PENDING_CHECKOUTS_DIR)) {
      fs.mkdirSync(PENDING_CHECKOUTS_DIR, { recursive: true });
    }
    // Cleanup files older than 24 hours
    const now = Date.now();
    for (const file of fs.readdirSync(PENDING_CHECKOUTS_DIR)) {
      const fp = path.join(PENDING_CHECKOUTS_DIR, file);
      try {
        const st = fs.statSync(fp);
        if (now - st.mtimeMs > 24 * 3600 * 1000) fs.unlinkSync(fp);
      } catch {
        // ignore
      }
    }
    const cleanRef = ref.replace(/[^a-zA-Z0-9_-]/g, '');
    fs.writeFileSync(
      path.join(PENDING_CHECKOUTS_DIR, `${cleanRef}.json`),
      JSON.stringify(drawConfig),
      'utf-8'
    );
  } catch {
    // ignore disk errors
  }
}

export function getPendingDrawConfig(ref: string): any | null {
  if (!ref) return null;
  try {
    const cleanRef = ref.replace(/[^a-zA-Z0-9_-]/g, '');
    const fp = path.join(PENDING_CHECKOUTS_DIR, `${cleanRef}.json`);
    if (!fs.existsSync(fp)) return null;
    return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  } catch {
    return null;
  }
}
