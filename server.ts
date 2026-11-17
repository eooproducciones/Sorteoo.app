import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegStatic from 'ffmpeg-static';
import {
  isSupabaseEnabled,
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  listGiveawaysByUser,
  listGiveawaysByIds,
  claimGuestGiveaways,
  findGiveawayById,
  findGiveawayByVerificationCode,
  createGiveaway,
  updateGiveawayVideo,
  deleteGiveawayRecord,
  uploadVideoToSupabaseStorage,
  downloadVideoFromSupabaseStorage,
  deleteVideosFromSupabaseStorage,
  listStories,
  findStoryById,
  getFirstStory,
  createStory,
  updateStory,
  deleteStory,
  addStoryReply,
  listStoriesByIds,
  ADMIN_EMAIL,
  sanitizeUserForClient,
  ensureAdminUserRecord,
  getPaymentSettings,
  updatePaymentSettings,
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCouponCode,
  redeemFreeCouponOrder,
  createPendingPaymentOrder,
  getPaymentOrderById,
  markPaymentOrderApproved,
  listPaymentOrders,
  savePendingDrawConfig,
  getPendingDrawConfig,
  type UserRecord as User,
  type ParticipantRecord as Participant,
  type GiveawayRecord as Giveaway,
  type MultibrandStoryReplyRecord as MultibrandStoryReply,
  type MultibrandStoryRecord as MultibrandStory,
} from './src/db/supabaseStore.ts';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

function resolveFfmpegBinary(): string {
  const bundled = typeof ffmpegStatic === 'string' ? ffmpegStatic : '';
  if (bundled && fs.existsSync(bundled)) {
    try {
      fs.chmodSync(bundled, 0o755);
    } catch {
      // ignore chmod errors on read-only FS
    }
    return bundled;
  }
  return 'ffmpeg';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sorteoo_secret_jwt_key_2026';

// Middleware for parsing JSON and large video data payloads
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Scratch / local fallback directories
const DATA_DIR = path.join(__dirname, 'data');
const VIDEOS_DIR = path.join(DATA_DIR, 'videos');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

// Auth Helper
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso no proporcionado' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
    req.user = decoded;
    next();
  });
}

function requireAdmin(req: any, res: any, next: any) {
  const emailLower = String(req.user?.email || '').trim().toLowerCase();
  if (req.user?.role === 'admin' || emailLower === ADMIN_EMAIL) {
    return next();
  }
  return res.status(403).json({ error: 'Acceso restringido al administrador' });
}

function getOptionalUserFromReq(req: any): { id: string; email?: string; role?: string } | null {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}

async function seedAdminAccount() {
  try {
    const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'river??2??';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);
    await ensureAdminUserRecord(passwordHash);
  } catch (err: any) {
    console.warn('Admin seed warning:', err?.message || err);
  }
}

function maskSecretToken(token: string): string {
  const clean = (token || '').trim();
  if (!clean) return '';
  if (clean.length <= 12) return '••••' + clean.slice(-4);
  return `${clean.slice(0, 10)}••••${clean.slice(-4)}`;
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Auth: Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail === ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Esta cuenta está reservada para administración' });
    }

    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(400).json({ error: 'Ya existe una cuenta con este correo electrónico' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name.trim())}`,
      createdAt: new Date().toISOString(),
      role: 'user',
      instagramConfig: { isConnected: false },
    };

    const createdUser = await createUser(newUser);
    const safeUser = sanitizeUserForClient(createdUser);
    const token = jwt.sign(
      { id: safeUser.id, email: safeUser.email, role: safeUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Cuenta creada con éxito',
      token,
      user: safeUser,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error en el servidor al registrar' });
  }
});

// 2. Auth: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Introduce correo y contraseña' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail === ADMIN_EMAIL) {
      await seedAdminAccount();
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas. Comprueba tu correo y contraseña' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas. Comprueba tu correo y contraseña' });
    }

    const safeUser = sanitizeUserForClient(user);
    const token = jwt.sign(
      { id: safeUser.id, email: safeUser.email, role: safeUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: safeUser,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error al iniciar sesión' });
  }
});

// 3. Auth: Current User
app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    return res.json({ user: sanitizeUserForClient(user) });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al consultar usuario' });
  }
});

// 4. Auth: Update Profile
app.put('/api/auth/profile', authenticateToken, async (req: any, res) => {
  try {
    const { name, avatar, instagramConfig } = req.body;
    const updatedUser = await updateUser(req.user.id, {
      name: name ? name.trim() : undefined,
      avatar: avatar || undefined,
      instagramConfig: instagramConfig || undefined,
    });
    if (!updatedUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.json({ message: 'Perfil actualizado', user: sanitizeUserForClient(updatedUser) });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

// 5. Auth: Password Reset Request
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Ingresa tu correo electrónico' });
  }
  return res.json({
    message: 'Si el correo está registrado en sorteoo.app, recibirás instrucciones para restablecer tu contraseña.',
  });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Token o contraseña no válidos (mínimo 6 caracteres)' });
  }
  try {
    const decoded: any = jwt.verify(resetToken, JWT_SECRET);
    if (!decoded.reset) {
      return res.status(400).json({ error: 'Token no válido' });
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    const updated = await updateUser(decoded.id, { passwordHash });
    if (!updated) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    return res.json({ message: 'Contraseña actualizada con éxito' });
  } catch (err) {
    return res.status(400).json({ error: 'El enlace de recuperación ha expirado o es inválido' });
  }
});

// ----------------------------------------------------
// INSTAGRAM URL PARSER & PARTICIPANTS IMPORT
// ----------------------------------------------------

// In-memory cache for Instagram images (prevents redundant downloads and avoids rate-limits)
const imageCache = new Map<string, { buffer: Buffer; contentType: string; expires: number }>();

// Image Proxy for Instagram CDN (bypasses referrer blocking and Meta CDN restrictions)
app.get('/api/instagram/image-proxy', async (req, res) => {
  const targetUrl = req.query.url as string;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  if (!targetUrl || !targetUrl.startsWith('http')) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(generateFallbackPostSvg('Publicación de Instagram'));
  }

  // Check cache first
  const cached = imageCache.get(targetUrl);
  if (cached && cached.expires > Date.now()) {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    return res.send(cached.buffer);
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0.0',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Referer': '',
      },
    });

    if (response.ok) {
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Keep cache size bounded to last 200 images
      if (imageCache.size > 200) {
        const firstKey = imageCache.keys().next().value;
        if (firstKey) imageCache.delete(firstKey);
      }
      imageCache.set(targetUrl, {
        buffer,
        contentType,
        expires: Date.now() + 24 * 3600 * 1000, // 24 hours
      });

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      return res.send(buffer);
    }

    // Try secondary fetch without custom headers
    const fallbackRes = await fetch(targetUrl);
    if (fallbackRes.ok) {
      const contentType = fallbackRes.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await fallbackRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      return res.send(buffer);
    }

    // Never redirect to Instagram CDN (browser would get 403 Forbidden due to referer)
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(generateFallbackPostSvg('Instagram'));
  } catch (err) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(generateFallbackPostSvg('Instagram'));
  }
});

function generateFallbackPostSvg(label: string): string {
  const safeLabel = (label || 'Instagram').replace(/[<>&"]/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <defs>
      <linearGradient id="igGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#EF4444" />
        <stop offset="50%" stop-color="#F43F5E" />
        <stop offset="100%" stop-color="#F59E0B" />
      </linearGradient>
    </defs>
    <rect width="400" height="400" fill="#131722" />
    <rect x="20" y="20" width="360" height="360" rx="24" fill="url(#igGrad)" opacity="0.12" stroke="url(#igGrad)" stroke-width="2" />
    <g transform="translate(150, 140)">
      <rect x="0" y="0" width="100" height="100" rx="26" fill="none" stroke="url(#igGrad)" stroke-width="8" />
      <circle cx="50" cy="50" r="24" fill="none" stroke="url(#igGrad)" stroke-width="8" />
      <circle cx="76" cy="24" r="6" fill="#F59E0B" />
    </g>
    <text x="200" y="280" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" fill="#FFFFFF" text-anchor="middle">
      ${safeLabel}
    </text>
    <text x="200" y="305" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#94A3B8" text-anchor="middle">
      Publicación oficial
    </text>
  </svg>`;
}

function generateAvatarSvg(username: string): string {
  const initial = (username || 'G')[0].toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <defs>
      <linearGradient id="avGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#EC4899" />
        <stop offset="50%" stop-color="#8B5CF6" />
        <stop offset="100%" stop-color="#3B82F6" />
      </linearGradient>
    </defs>
    <circle cx="100" cy="100" r="100" fill="url(#avGrad)" />
    <text x="100" y="125" font-family="system-ui, -apple-system, sans-serif" font-size="76" font-weight="900" fill="#FFFFFF" text-anchor="middle">
      ${initial}
    </text>
  </svg>`;
}

// User avatar proxy endpoint: fetches user's Instagram profile pic via SocialData or proxies it
app.get('/api/instagram/user-avatar', async (req, res) => {
  const username = (req.query.username as string || '').replace(/^@/, '').trim();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  if (!username) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(generateAvatarSvg('?'));
  }

  // Fast exit for list names (spaces), numbers, or custom non-Instagram labels
  if (
    username.includes(' ') ||
    username.startsWith('sorteo_') ||
    username.startsWith('lista_') ||
    username.startsWith('Número') ||
    username.startsWith('#') ||
    username.length > 30 ||
    /[!$%^&*()+=[\]{};':"\\|,<>/?]/.test(username)
  ) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(generateAvatarSvg(username));
  }

  // Check cache
  const cacheKey = `avatar_${username.toLowerCase()}`;
  const cached = imageCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    return res.send(cached.buffer);
  }

  try {
    const infoData = await fetchSocialData('/v1/info', { username_or_id_or_url: username }, 4000);
    const picUrl = infoData?.data?.profile_pic_url_hd || infoData?.data?.profile_pic_url;
    if (picUrl) {
      const picRes = await fetch(picUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
          'Referer': '',
        },
      });
      if (picRes.ok) {
        const contentType = picRes.headers.get('content-type') || 'image/jpeg';
        const buffer = Buffer.from(await picRes.arrayBuffer());
        if (imageCache.size > 200) {
          const firstKey = imageCache.keys().next().value;
          if (firstKey) imageCache.delete(firstKey);
        }
        imageCache.set(cacheKey, { buffer, contentType, expires: Date.now() + 24 * 3600 * 1000 });
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        return res.send(buffer);
      }
    }
  } catch (e) {
    // ignore
  }

  // Fallback avatar SVG
  res.setHeader('Content-Type', 'image/svg+xml');
  return res.send(generateAvatarSvg(username));
});

// SocialData API Configuration for live public Instagram data
const SOCIAL_DATA_BASE = 'https://api.socialdataapi.com/ig';
const SOCIAL_DATA_AUTH = process.env.SOCIALDATA_API_KEY
  ? (process.env.SOCIALDATA_API_KEY.startsWith('Bearer ')
      ? process.env.SOCIALDATA_API_KEY
      : `Bearer ${process.env.SOCIALDATA_API_KEY}`)
  : 'Bearer u1x7IarHgvcJYWkR5-3v-w';

async function fetchSocialData(endpoint: string, params: Record<string, string>, timeoutMs = 25000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const query = new URLSearchParams(params).toString();
    const url = `${SOCIAL_DATA_BASE}${endpoint}?${query}`;
    const response = await fetch(url, {
      headers: {
        Authorization: SOCIAL_DATA_AUTH,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`SocialData API HTTP ${response.status}: ${errorText}`);
    }
    return response.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function isSocialDataPrivateError(err: any): boolean {
  const msg = String(err?.message || err || '');
  return /HTTP\s*403\b/i.test(msg) || /private[\s_-]*account/i.test(msg);
}

function isSocialDataNotFoundError(err: any): boolean {
  const msg = String(err?.message || err || '');
  return (
    /HTTP\s*404\b/i.test(msg) ||
    /user[\s_-]*not[\s_-]*found|not[\s_-]*found|does[\s_-]*not[\s_-]*exist/i.test(msg)
  );
}

// Real Instagram Wall/Profile Feed Endpoint
app.post('/api/instagram/profile-feed', async (req, res) => {
  const { username, paginationToken } = req.body;
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Por favor introduce un usuario de Instagram válido' });
  }

  let cleanUser = username.trim().replace(/^@/, '');
  const urlMatch = cleanUser.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/i);
  if (urlMatch) {
    cleanUser = urlMatch[1];
  }
  cleanUser = cleanUser.split(/[/?#]/)[0].toLowerCase();

  if (cleanUser.length < 1) {
    return res.status(400).json({ error: 'El usuario de Instagram debe tener al menos 1 caracter' });
  }

  try {
    const postsParams: Record<string, string> = { username_or_id_or_url: cleanUser };
    if (paginationToken && typeof paginationToken === 'string') {
      postsParams.pagination_token = paginationToken;
    }

    let postsResponse: any = null;
    let postsPrivateFlag = false;
    let postsNotFoundFlag = false;
    let postsUnexpectedErr: any = null;

    try {
      postsResponse = await fetchSocialData('/v1/posts', postsParams, 20000);
    } catch (postsErr: any) {
      if (isSocialDataPrivateError(postsErr)) {
        postsPrivateFlag = true;
      } else if (isSocialDataNotFoundError(postsErr)) {
        postsNotFoundFlag = true;
      } else {
        postsUnexpectedErr = postsErr;
      }
    }

    const items = postsResponse?.data?.items || postsResponse?.data || [];
    const postsPaginationToken = postsResponse?.pagination_token || null;

    let userData = postsResponse?.data?.user || (Array.isArray(items) && items.length > 0 ? items[0].user : null);
    let infoNotFoundFlag = false;

    if (!userData && !postsNotFoundFlag) {
      try {
        const infoData = await fetchSocialData('/v1/info', { username_or_id_or_url: cleanUser }, 15000);
        userData = infoData?.data;
      } catch (infoErr: any) {
        if (isSocialDataPrivateError(infoErr)) {
          postsPrivateFlag = true;
        } else if (isSocialDataNotFoundError(infoErr)) {
          infoNotFoundFlag = true;
        }
      }
    }

    if (postsPrivateFlag || userData?.is_private) {
      const profileAvatar = userData?.profile_pic_url_hd || userData?.profile_pic_url;
      return res.json({
        success: true,
        isRealLive: true,
        isPrivate: true,
        message: `La cuenta @${cleanUser} es privada. Instagram solo permite cargar publicaciones y comentarios de cuentas públicas.`,
        profile: {
          username: userData?.username || cleanUser,
          name: userData?.full_name || userData?.username || cleanUser,
          avatar: profileAvatar
            ? `/api/instagram/image-proxy?url=${encodeURIComponent(profileAvatar)}`
            : `/api/instagram/user-avatar?username=${encodeURIComponent(cleanUser)}`,
          bio: userData?.biography || '',
          followersCount: userData?.follower_count || userData?.followers_count || 0,
          postsCount: userData?.media_count || 0,
          isPrivate: true,
          posts: [],
        },
      });
    }

    if (userData) {
      const profileAvatar = userData.profile_pic_url_hd || userData.profile_pic_url;

      let realPosts: any[] = [];
      if (Array.isArray(items) && items.length > 0) {
        realPosts = items.map((item: any, idx: number) => {
          const caption = item.caption?.text || '';
          const commentsCount = item.comment_count ?? 0;
          const likes = item.like_count ?? 0;
          const candidateUrl =
            item.thumbnail_url ||
            item.image_versions?.items?.[0]?.url ||
            item.image_versions?.additional_items?.first_frame?.url ||
            item.image_versions?.candidates?.[0]?.url ||
            item.image_versions2?.candidates?.[0]?.url ||
            item.display_url ||
            '';
          const timestamp = item.taken_at_timestamp
            ? new Date(item.taken_at_timestamp * 1000)
            : item.taken_at
            ? new Date(item.taken_at * 1000)
            : new Date();

          return {
            shortcode: item.code || `post_${idx}`,
            postUrl: item.code ? `https://www.instagram.com/p/${item.code}/` : `https://www.instagram.com/${cleanUser}/`,
            caption: caption || `Publicación de @${cleanUser}`,
            imageUrl: candidateUrl ? `/api/instagram/image-proxy?url=${encodeURIComponent(candidateUrl)}` : '',
            likes,
            commentsCount,
            date: timestamp.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
            isVideo: Boolean(item.is_video),
            isGiveaway: /sorteo|giveaway|premio|ganador|participa|concurso|participá/i.test(caption),
          };
        });
      }

      return res.json({
        success: true,
        isRealLive: true,
        isPrivate: false,
        profile: {
          username: userData.username || cleanUser,
          name: userData.full_name || userData.username || cleanUser,
          avatar: profileAvatar
            ? `/api/instagram/image-proxy?url=${encodeURIComponent(profileAvatar)}`
            : `/api/instagram/user-avatar?username=${encodeURIComponent(cleanUser)}`,
          bio: userData.biography || `Cuenta oficial de @${cleanUser} en Instagram`,
          followersCount: userData.follower_count || userData.followers_count || 0,
          postsCount: userData.media_count || realPosts.length,
          isPrivate: false,
          posts: realPosts,
          paginationToken: postsPaginationToken,
        },
      });
    }

    if (postsNotFoundFlag || infoNotFoundFlag || !postsUnexpectedErr) {
      return res.status(404).json({
        error: `No se encontró la cuenta pública @${cleanUser} en Instagram. Verifica que el usuario esté bien escrito.`,
      });
    }

    throw postsUnexpectedErr;
  } catch (apiErr: any) {
    if (isSocialDataPrivateError(apiErr)) {
      return res.json({
        success: true,
        isRealLive: true,
        isPrivate: true,
        message: `La cuenta @${cleanUser} es privada. Instagram solo permite cargar publicaciones y comentarios de cuentas públicas.`,
        profile: {
          username: cleanUser,
          name: cleanUser,
          avatar: `/api/instagram/user-avatar?username=${encodeURIComponent(cleanUser)}`,
          bio: '',
          followersCount: 0,
          postsCount: 0,
          isPrivate: true,
          posts: [],
        },
      });
    }
    if (isSocialDataNotFoundError(apiErr)) {
      return res.status(404).json({
        error: `No se encontró la cuenta pública @${cleanUser} en Instagram. Verifica que el usuario esté bien escrito.`,
      });
    }
    console.warn(`SocialData posts fetch failed for @${cleanUser}:`, apiErr.message);
    return res.status(502).json({
      error: `No se pudieron cargar las publicaciones de @${cleanUser} en este momento. Verifica que la cuenta exista y sea pública e intenta nuevamente.`,
    });
  }
});

// ----------------------------------------------------
// PROGRESSIVE COMMENT LOADING JOBS + CACHE + PREFETCH
// ----------------------------------------------------
interface CommentJob {
  jobId: string;
  shortcode: string;
  status: 'loading' | 'done' | 'error';
  author: string;
  caption: string;
  imageUrl: string;
  likes: number;
  totalCommentsInPost: number;
  pagesFetched: number;
  maxPercent: number;
  participants: Participant[];
  error?: string;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  promise?: Promise<void>;
}

const commentJobs = new Map<string, CommentJob>();
const shortcodeToJobId = new Map<string, string>();
const COMMENT_JOB_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const COMMENT_JOB_CLEANUP_TTL_MS = 15 * 60 * 1000;

function cleanupExpiredCommentJobs() {
  const now = Date.now();
  for (const [id, job] of commentJobs.entries()) {
    if (now - job.updatedAt > COMMENT_JOB_CLEANUP_TTL_MS) {
      commentJobs.delete(id);
      if (shortcodeToJobId.get(job.shortcode) === id) {
        shortcodeToJobId.delete(job.shortcode);
      }
    }
  }
}

function extractInstagramShortcode(postUrl: string): string {
  if (!postUrl || typeof postUrl !== 'string') return 'post_selected';
  const regex = /instagram\.com\/(?:p|reel|tv|reels)\/([A-Za-z0-9_-]+)/i;
  const match = postUrl.match(regex);
  if (match) return match[1];
  if (!postUrl.startsWith('http')) {
    const cleaned = postUrl.replace(/[^A-Za-z0-9_-]/g, '');
    return cleaned || 'post_selected';
  }
  return 'post_selected';
}

function parseSyncParticipantsFromRequest(body: any): Participant[] | null {
  const { rawCommentsText, participants: incomingParticipants } = body || {};

  if (Array.isArray(incomingParticipants) && incomingParticipants.length > 0) {
    const list: Participant[] = [];
    incomingParticipants.forEach((p: any) => {
      if (p && p.username) {
        list.push({
          username: String(p.username).trim().replace(/^@/, ''),
          comment: p.comment || `Comentario de @${p.username}`,
          avatarUrl: p.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.username)}`,
          timestamp: p.timestamp || new Date().toISOString(),
          mentions: Array.isArray(p.mentions) ? p.mentions : [],
        });
      }
    });
    return list;
  }

  if (typeof rawCommentsText === 'string' && rawCommentsText.trim().length > 0) {
    const list: Participant[] = [];
    const lines = rawCommentsText.split(/[\r\n]+/).map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    lines.forEach((line: string, idx: number) => {
      let username = '';
      let comment = '';

      if (line.includes(':')) {
        const colonIdx = line.indexOf(':');
        username = line.substring(0, colonIdx).trim().replace(/^@/, '');
        comment = line.substring(colonIdx + 1).trim();
      } else if (line.includes(',')) {
        const parts = line.split(',');
        username = parts[0].trim().replace(/^@/, '');
        comment = parts.slice(1).join(',').trim();
      } else if (line.startsWith('@')) {
        const firstSpace = line.indexOf(' ');
        if (firstSpace !== -1) {
          username = line.substring(1, firstSpace).trim();
          comment = line.substring(firstSpace + 1).trim();
        } else {
          username = line.substring(1).trim();
          comment = `Participante ${idx + 1}`;
        }
      } else {
        const firstSpace = line.indexOf(' ');
        if (firstSpace !== -1 && !line.startsWith('#')) {
          username = line.substring(0, firstSpace).trim();
          comment = line.substring(firstSpace + 1).trim();
        } else {
          username = line.trim();
          comment = `Participante ${idx + 1}`;
        }
      }

      if (!username) username = `participante_${idx + 1}`;

      const mentionMatches = comment.match(/@([a-zA-Z0-9._]+)/g) || [];
      const mentions = mentionMatches.map((m) => m.replace(/^@/, '')).filter((m) => m !== username);

      list.push({
        username,
        comment: comment || `Comentario de @${username}`,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
        timestamp: new Date(Date.now() - (idx + 1) * 3600000).toISOString(),
        mentions,
      });
    });
    return list;
  }

  return null;
}

function buildPostResponsePayload(job: CommentJob, includeParticipants = true) {
  const loadedCount = job.participants.length;
  const knownTotal = job.totalCommentsInPost || 0;
  const totalEstimated = knownTotal > 0 ? Math.max(knownTotal, loadedCount) : loadedCount;
  let computedPercent = 4;
  if (job.status === 'done') {
    computedPercent = 100;
  } else if (knownTotal > 0 && loadedCount > 0) {
    computedPercent = Math.min(96, Math.max(5, Math.round((loadedCount / Math.max(knownTotal, loadedCount)) * 96)));
  } else if (job.pagesFetched > 0) {
    // Conservative estimate until post_info provides totalCommentsInPost
    computedPercent = Math.min(48, 6 + job.pagesFetched * 6);
  }
  const percent = job.status === 'done' ? 100 : Math.max(job.maxPercent || 4, computedPercent);
  job.maxPercent = percent;

  return {
    success: true,
    jobId: job.jobId,
    status: job.status,
    percent,
    loadedCount,
    totalEstimated,
    pagesFetched: job.pagesFetched,
    needsParticipants: job.status === 'done' && loadedCount === 0,
    error: job.error,
    postDetails: {
      shortcode: job.shortcode,
      author: job.author,
      likes: job.likes || loadedCount * 12 + 150,
      commentsCount: job.status === 'done' && loadedCount > 0 ? loadedCount : (totalEstimated || loadedCount),
      caption: job.caption || `Publicación oficial de sorteo de @${job.author}`,
      imageUrl: job.imageUrl,
    },
    metaApiInfo: {
      status:
        job.status !== 'done'
          ? 'loading'
          : loadedCount > 0
          ? 'participants_ready'
          : 'awaiting_participants',
      message:
        job.status !== 'done'
          ? `Cargando comentarios (${percent}%)...`
          : loadedCount > 0
          ? `🎉 ${loadedCount} comentarios reales de Instagram listos para el sorteo.`
          : job.error || 'Esta publicación aún no tiene comentarios en Instagram. Pide a tus seguidores que comenten o importa participantes.',
    },
    participants: includeParticipants ? job.participants : undefined,
  };
}

function pushCommentItem(
  item: any,
  seenIds: Set<string>,
  target: Participant[],
  replyParentIds?: string[],
  excludedHostLower?: string
) {
  if (!item || typeof item !== 'object') return;

  const rawUser = item.user?.username || item.owner?.username || item.from?.username || '';
  const cleanUser = String(rawUser).trim().replace(/^@/, '');
  const cleanUserLower = cleanUser.toLowerCase();
  const text = item.text || item.comment || '';
  const itemKey = item.id ? String(item.id) : `${cleanUser}_${item.created_at || ''}_${text}`;

  const isHostComment = Boolean(excludedHostLower && cleanUserLower === excludedHostLower);

  if (cleanUser && !isHostComment && !seenIds.has(itemKey)) {
    seenIds.add(itemKey);
    const mentionMatches = String(text).match(/@([a-zA-Z0-9._]+)/g) || [];
    const mentions = mentionMatches
      .map((m: string) => m.replace(/^@/, ''))
      .filter((m: string) => m.toLowerCase() !== cleanUserLower);

    const avatar = item.user?.profile_pic_url
      ? `/api/instagram/image-proxy?url=${encodeURIComponent(item.user.profile_pic_url)}`
      : `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanUser)}`;

    const timestamp = item.created_at
      ? new Date(Number(item.created_at) * 1000).toISOString()
      : new Date().toISOString();

    target.push({
      username: cleanUser,
      comment: text,
      avatarUrl: avatar,
      timestamp,
      mentions,
    });
  }

  // Extract inline preview replies at zero extra latency
  const previews = Array.isArray(item.preview_child_comments) ? item.preview_child_comments : [];
  for (const child of previews) {
    pushCommentItem(child, seenIds, target, undefined, excludedHostLower);
  }

  // Queue parent comment ID if it has additional unexpanded replies
  if (
    replyParentIds &&
    item.id &&
    Number(item.child_comment_count || 0) > previews.length
  ) {
    replyParentIds.push(String(item.id));
  }
}

async function fetchSocialDataWithRetry(
  endpoint: string,
  params: Record<string, string>,
  timeoutMs = 12000,
  retries = 1
) {
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchSocialData(endpoint, params, timeoutMs);
    } catch (err: any) {
      lastErr = err;
      if (isSocialDataPrivateError(err) || isSocialDataNotFoundError(err) || /HTTP\s*40[01]\b/i.test(String(err?.message || ''))) {
        throw err;
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 350));
      }
    }
  }
  throw lastErr;
}

function getOrStartCommentJob(options: {
  shortcode: string;
  author?: string;
  caption?: string;
  commentsCount?: number;
  forceRefresh?: boolean;
}): CommentJob {
  cleanupExpiredCommentJobs();
  const { shortcode, author: customAuthor, caption: customCaption, commentsCount: reqCommentsCount, forceRefresh } = options;

  if (!forceRefresh) {
    const existingId = shortcodeToJobId.get(shortcode);
    const existing = existingId ? commentJobs.get(existingId) : undefined;
    if (existing) {
      const ageMs = Date.now() - existing.updatedAt;
      if (existing.status === 'loading') {
        if (reqCommentsCount && Number(reqCommentsCount) > existing.totalCommentsInPost) {
          existing.totalCommentsInPost = Number(reqCommentsCount);
        }
        return existing;
      }
      if (existing.status === 'done' && ageMs < COMMENT_JOB_CACHE_TTL_MS && existing.participants.length > 0) {
        return existing;
      }
    }
  }

  const jobId = `cjob_${shortcode}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const job: CommentJob = {
    jobId,
    shortcode,
    status: 'loading',
    author: customAuthor || 'instagram_user',
    caption: customCaption || '',
    imageUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80',
    likes: 0,
    totalCommentsInPost: reqCommentsCount && Number(reqCommentsCount) > 0 ? Number(reqCommentsCount) : 0,
    pagesFetched: 0,
    maxPercent: 4,
    participants: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  commentJobs.set(jobId, job);
  shortcodeToJobId.set(shortcode, jobId);

  job.promise = (async () => {
    const startedAt = Date.now();
    const OVERALL_DEADLINE_MS = 240000;
    const THREADS_CUTOFF_MS = 225000;
    const MAX_PAGES = 500;
    const MAX_PARTICIPANTS = 15000;
    const seenCommentIds = new Set<string>();
    const replyParentIds: string[] = [];

    const getKnownHostLower = () => {
      const clean = (job.author || '').trim().toLowerCase().replace(/^@/, '');
      return clean && clean !== 'instagram_user' ? clean : undefined;
    };

    try {
      // Run post_info concurrently without blocking comment pagination
      const infoPromise = (!customAuthor || !customCaption || !job.totalCommentsInPost)
        ? fetchSocialData('/v1/post_info', { code_or_id_or_url: shortcode }, 12000)
            .then((postInfoRes) => {
              if (postInfoRes?.data) {
                const postData = postInfoRes.data;
                if (postData.user?.username && !customAuthor) job.author = postData.user.username;
                if (postData.caption?.text && !customCaption) job.caption = postData.caption.text;
                if (postData.metrics?.like_count !== undefined) job.likes = postData.metrics.like_count;
                else if (postData.like_count !== undefined) job.likes = postData.like_count;

                const infoComments = postData.metrics?.comment_count ?? postData.comment_count;
                if (infoComments !== undefined && Number(infoComments) > job.totalCommentsInPost) {
                  job.totalCommentsInPost = Number(infoComments);
                }

                const candidate =
                  postData.thumbnail_url ||
                  postData.image_versions?.items?.[0]?.url ||
                  postData.image_versions?.additional_items?.first_frame?.url ||
                  postData.image_versions?.candidates?.[0]?.url ||
                  postData.display_url ||
                  '';
                if (candidate) {
                  job.imageUrl = `/api/instagram/image-proxy?url=${encodeURIComponent(candidate)}`;
                }
                job.updatedAt = Date.now();
              }
            })
            .catch((e: any) => {
              if (!isSocialDataPrivateError(e) && !isSocialDataNotFoundError(e)) {
                console.warn(`Post info note for ${shortcode}:`, e.message);
              }
            })
        : Promise.resolve();

      let nextToken: string | null = null;
      let page = 1;
      let firstPageError: any = null;

      while (
        page <= MAX_PAGES &&
        job.participants.length < MAX_PARTICIPANTS &&
        Date.now() - startedAt < OVERALL_DEADLINE_MS
      ) {
        // sort_by=recent retrieves the full chronological comment feed instead of Instagram's ~75-item "popular" subset
        const params: Record<string, string> = {
          code_or_id_or_url: shortcode,
          sort_by: 'recent',
        };
        if (nextToken) params.pagination_token = nextToken;

        let currentCommentsRes: any = null;
        try {
          currentCommentsRes = await fetchSocialDataWithRetry('/v1/comments', params, 20000, 2);
        } catch (pageErr: any) {
          if (page === 1) {
            firstPageError = pageErr;
          }
          if (!isSocialDataPrivateError(pageErr) && !isSocialDataNotFoundError(pageErr)) {
            console.warn(`Comments page ${page} stopped for ${shortcode}: ${pageErr?.message || pageErr}`);
          }
          break;
        }

        if (!currentCommentsRes) break;

        // Capture post owner & total directly from comments additional_data when available
        const captionAuthor = currentCommentsRes?.data?.additional_data?.caption?.user?.username;
        if (captionAuthor && (!job.author || job.author === 'instagram_user')) {
          job.author = captionAuthor;
        }
        const totalInRes = Number(currentCommentsRes?.data?.total || 0);
        if (totalInRes > job.totalCommentsInPost) {
          job.totalCommentsInPost = totalInRes;
        }

        job.pagesFetched = page;
        const items = currentCommentsRes?.data?.items || currentCommentsRes?.data || [];
        const hostLower = getKnownHostLower();

        if (Array.isArray(items) && items.length > 0) {
          for (const item of items) {
            pushCommentItem(item, seenCommentIds, job.participants, replyParentIds, hostLower);
          }
        }

        job.updatedAt = Date.now();
        nextToken = currentCommentsRes?.pagination_token || null;
        if (!nextToken || !Array.isArray(items) || items.length === 0) break;
        page++;
      }

      // Ensure post_info finished updating metadata before thread expansion / final host filter
      await infoPromise;

      // Expand ALL comment reply threads concurrently in batches (with thread pagination support)
      if (
        replyParentIds.length > 0 &&
        job.participants.length < MAX_PARTICIPANTS &&
        Date.now() - startedAt < THREADS_CUTOFF_MS
      ) {
        const uniqueParents = Array.from(new Set(replyParentIds));
        const BATCH_SIZE = 10;

        for (let i = 0; i < uniqueParents.length; i += BATCH_SIZE) {
          if (Date.now() - startedAt >= THREADS_CUTOFF_MS || job.participants.length >= MAX_PARTICIPANTS) {
            break;
          }
          const batch = uniqueParents.slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.allSettled(
            batch.map(async (commentId) => {
              const collected: any[] = [];
              let threadToken: string | null = null;
              for (let tp = 0; tp < 15; tp++) {
                const tParams: Record<string, string> = {
                  code_or_id_or_url: shortcode,
                  comment_id: commentId,
                };
                if (threadToken) tParams.pagination_token = threadToken;
                const tr = await fetchSocialData('/v1/comments_thread', tParams, 8000);
                const tItems = tr?.data?.items || tr?.data?.child_comments || tr?.data || [];
                if (Array.isArray(tItems) && tItems.length > 0) {
                  collected.push(...tItems);
                }
                threadToken = tr?.pagination_token || null;
                if (!threadToken || !Array.isArray(tItems) || tItems.length === 0) break;
              }
              return collected;
            })
          );

          const hostLower = getKnownHostLower();
          for (const res of batchResults) {
            if (res.status === 'fulfilled' && Array.isArray(res.value)) {
              for (const child of res.value) {
                pushCommentItem(child, seenCommentIds, job.participants, undefined, hostLower);
              }
            }
          }
          job.updatedAt = Date.now();
        }
      }

      // Guarantee organizer/host comments are ALWAYS excluded from the loaded pool
      const finalHostLower = getKnownHostLower();
      if (finalHostLower) {
        job.participants = job.participants.filter(
          (p) => p.username.trim().toLowerCase().replace(/^@/, '') !== finalHostLower
        );
      }

      if (job.participants.length === 0 && firstPageError) {
        if (isSocialDataPrivateError(firstPageError)) {
          job.error = 'Esta publicación pertenece a una cuenta privada de Instagram. La cuenta debe ser pública para poder leer sus comentarios.';
        } else if (isSocialDataNotFoundError(firstPageError)) {
          job.error = 'No se encontró esta publicación en Instagram o ya no está disponible.';
        } else {
          job.error = 'No se pudieron cargar los comentarios de esta publicación en este momento.';
        }
      }

      job.status = 'done';
      job.finishedAt = Date.now();
      job.updatedAt = Date.now();
    } catch (err: any) {
      if (!isSocialDataPrivateError(err) && !isSocialDataNotFoundError(err)) {
        console.warn(`SocialData comments job error for ${shortcode}:`, err?.message || err);
      }
      const finalHostLower = getKnownHostLower();
      if (finalHostLower) {
        job.participants = job.participants.filter(
          (p) => p.username.trim().toLowerCase().replace(/^@/, '') !== finalHostLower
        );
      }
      job.status = 'done'; // Finish gracefully with whatever participants were fetched
      if (job.participants.length === 0) {
        job.error = isSocialDataPrivateError(err)
          ? 'Esta publicación pertenece a una cuenta privada de Instagram. La cuenta debe ser pública para poder leer sus comentarios.'
          : isSocialDataNotFoundError(err)
          ? 'No se encontró esta publicación en Instagram o ya no está disponible.'
          : (err?.message || 'Error al cargar comentarios');
      } else {
        job.error = undefined;
      }
      job.finishedAt = Date.now();
      job.updatedAt = Date.now();
    }
  })();

  return job;
}

// Prefetch comments silently in background when user previews a post
app.post('/api/instagram/prefetch', (req, res) => {
  const { postUrl, author, caption, commentsCount } = req.body || {};
  if (!postUrl || typeof postUrl !== 'string') {
    return res.status(400).json({ error: 'URL inválida' });
  }
  const shortcode = extractInstagramShortcode(postUrl);
  if (!shortcode || shortcode === 'post_selected') {
    return res.json({ success: true, skipped: true });
  }
  const job = getOrStartCommentJob({
    shortcode,
    author,
    caption,
    commentsCount: Number(commentsCount) || 0,
  });
  return res.json({
    success: true,
    jobId: job.jobId,
    status: job.status,
    percent: buildPostResponsePayload(job, false).percent,
  });
});

// Start or attach to a progressive Instagram comments loading job
app.post('/api/instagram/parse-start', (req, res) => {
  const {
    postUrl,
    author: customAuthor,
    caption: customCaption,
    commentsCount: reqCommentsCount,
    forceRefresh,
  } = req.body || {};

  if (!postUrl || typeof postUrl !== 'string') {
    return res.status(400).json({ error: 'Por favor proporciona una URL válida de Instagram' });
  }

  const shortcode = extractInstagramShortcode(postUrl);
  const syncParticipants = parseSyncParticipantsFromRequest(req.body);

  // Fast path: CSV, manual list, numbers, or explicit demo comments
  if (syncParticipants !== null) {
    const author = customAuthor || 'instagram_user';
    const loadedCount = syncParticipants.length;
    return res.json({
      success: true,
      jobId: `sync_${Date.now()}`,
      status: 'done',
      percent: 100,
      loadedCount,
      totalEstimated: Math.max(Number(reqCommentsCount) || 0, loadedCount),
      needsParticipants: loadedCount === 0,
      postDetails: {
        shortcode,
        author,
        likes: loadedCount * 12 + 150,
        commentsCount: Number(reqCommentsCount) || loadedCount,
        caption: customCaption || `Publicación oficial de sorteo de @${author}`,
        imageUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80',
      },
      metaApiInfo: {
        status: loadedCount > 0 ? 'participants_ready' : 'awaiting_participants',
        message:
          loadedCount > 0
            ? `🎉 ${loadedCount} participantes listos para el sorteo.`
            : 'No se encontraron participantes.',
      },
      participants: syncParticipants,
    });
  }

  if (!shortcode || shortcode === 'post_selected') {
    return res.status(400).json({ error: 'No se pudo identificar la publicación de Instagram en el enlace' });
  }

  const job = getOrStartCommentJob({
    shortcode,
    author: customAuthor,
    caption: customCaption,
    commentsCount: Number(reqCommentsCount) || 0,
    forceRefresh: Boolean(forceRefresh),
  });

  // Include participants immediately only if already cached & finished
  return res.json(buildPostResponsePayload(job, job.status === 'done'));
});

// Poll progressive status & percentage of an active CommentJob
app.get('/api/instagram/parse-status/:jobId', (req, res) => {
  const job = commentJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Trabajo de carga no encontrado o expirado' });
  }
  return res.json(buildPostResponsePayload(job, job.status === 'done'));
});

// Backwards-compatible synchronous parse endpoint
app.post('/api/instagram/parse', async (req, res) => {
  const {
    postUrl,
    author: customAuthor,
    caption: customCaption,
    commentsCount: reqCommentsCount,
  } = req.body || {};

  if (!postUrl || typeof postUrl !== 'string') {
    return res.status(400).json({ error: 'Por favor proporciona una URL válida de Instagram' });
  }

  const shortcode = extractInstagramShortcode(postUrl);
  const syncParticipants = parseSyncParticipantsFromRequest(req.body);

  if (syncParticipants !== null) {
    const author = customAuthor || 'instagram_user';
    const loadedCount = syncParticipants.length;
    return res.json({
      success: true,
      needsParticipants: loadedCount === 0,
      postDetails: {
        shortcode,
        author,
        likes: loadedCount * 12 + 150,
        commentsCount: Number(reqCommentsCount) || loadedCount,
        caption: customCaption || `Publicación oficial de sorteo de @${author}`,
        imageUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80',
      },
      metaApiInfo: {
        status: loadedCount > 0 ? 'participants_ready' : 'awaiting_participants',
        message:
          loadedCount > 0
            ? `🎉 ${loadedCount} comentarios reales de Instagram listos para el sorteo.`
            : 'Esta publicación aún no tiene comentarios en Instagram. Pide a tus seguidores que comenten o importa participantes.',
      },
      participants: syncParticipants,
    });
  }

  if (shortcode && shortcode !== 'post_selected') {
    const job = getOrStartCommentJob({
      shortcode,
      author: customAuthor,
      caption: customCaption,
      commentsCount: Number(reqCommentsCount) || 0,
    });
    if (job.promise) {
      await job.promise;
    }

    return res.json(buildPostResponsePayload(job, true));
  }

  return res.json({
    success: true,
    needsParticipants: true,
    postDetails: {
      shortcode,
      author: customAuthor || 'instagram_user',
      likes: 150,
      commentsCount: 0,
      caption: customCaption || 'Publicación oficial de sorteo',
      imageUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80',
    },
    metaApiInfo: {
      status: 'awaiting_participants',
      message: 'Esta publicación aún no tiene comentarios en Instagram.',
    },
    participants: [],
  });
});

// ----------------------------------------------------
// GIVEAWAYS CRUD & PERSISTENCE (Supabase / Local)
// ----------------------------------------------------

// List giveaways for current user
app.get('/api/giveaways', authenticateToken, async (req: any, res) => {
  try {
    const userGiveaways = await listGiveawaysByUser(req.user.id);
    return res.json({ giveaways: userGiveaways });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al listar sorteos' });
  }
});

// Lookup specific giveaways created on this browser (works for guests & logged-in users)
app.post('/api/giveaways/by-ids', async (req: any, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    let allowedUserId: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded: any = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        if (decoded?.id) allowedUserId = decoded.id;
      } catch {
        // Ignore expired/invalid optional token
      }
    }
    const giveaways = await listGiveawaysByIds(ids, allowedUserId);
    return res.json({ giveaways });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al consultar sorteos guardados' });
  }
});

// Claim guest giveaways created on this device when user logs into their account
app.post('/api/giveaways/claim', authenticateToken, async (req: any, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const claimedCount = await claimGuestGiveaways(ids, req.user.id);
    return res.json({ claimedCount });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al vincular sorteos a tu cuenta' });
  }
});

// Get giveaway by ID
app.get('/api/giveaways/:id', authenticateToken, async (req: any, res) => {
  try {
    const giveaway = await findGiveawayById(req.params.id);
    if (!giveaway) {
      return res.status(404).json({ error: 'Sorteo no encontrado' });
    }
    if (giveaway.userId !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para ver este sorteo' });
    }
    return res.json({ giveaway });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al consultar sorteo' });
  }
});

// Public verify endpoint (no token required, anyone with code/link can verify!)
app.get('/api/verify/:code', async (req, res) => {
  try {
    const giveaway = await findGiveawayByVerificationCode(req.params.code);
    if (!giveaway) {
      return res.status(404).json({ error: 'Certificado de sorteo no encontrado o código inválido' });
    }

    return res.json({
      verified: true,
      giveawayId: giveaway.id,
      postUrl: giveaway.postUrl,
      postAuthor: giveaway.postDetails.author,
      createdAt: giveaway.createdAt,
      drawnAt: giveaway.audit.drawnAt,
      winnersCount: giveaway.winnersCount,
      substitutesCount: giveaway.substitutesCount,
      totalParticipants: giveaway.validParticipantsCount,
      winners: giveaway.winners,
      substitutes: giveaway.substitutes,
      audit: giveaway.audit,
      hasVideo: giveaway.video.hasVideo,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al verificar certificado' });
  }
});

// Create and save completed giveaway (works for logged in users and guest creators!)
app.post('/api/giveaways', async (req: any, res) => {
  try {
    const {
      postUrl,
      postDetails,
      totalParticipantsDetected,
      validParticipantsCount,
      filtersApplied,
      winnersCount,
      substitutesCount,
      winners,
      substitutes,
      audit,
      video,
      multibrandMeta,
    } = req.body;

    if (!postUrl || !winners || winners.length === 0) {
      return res.status(400).json({ error: 'Faltan datos requeridos del sorteo' });
    }

    let userId = 'guest_user';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded: any = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        if (decoded?.id) userId = decoded.id;
      } catch {
        // Continue as guest
      }
    }

    const newGiveaway: Giveaway = {
      id: `srt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      postUrl,
      postDetails: postDetails || {
        shortcode: 'custom',
        author: 'instagram_user',
        likes: 0,
        commentsCount: validParticipantsCount,
        caption: 'Sorteo de Instagram',
      },
      status: 'completed',
      createdAt: new Date().toISOString(),
      totalParticipantsDetected: totalParticipantsDetected || validParticipantsCount,
      validParticipantsCount,
      filtersApplied: filtersApplied || {
        minMentions: 0,
        removeDuplicateUsers: true,
        requiredKeyword: '',
        excludedUsers: [],
      },
      winnersCount: winnersCount || winners.length,
      substitutesCount: substitutesCount || (substitutes ? substitutes.length : 0),
      winners,
      substitutes: substitutes || [],
      audit: audit || {
        seed: Math.random().toString(36).substring(2),
        verificationCode: `SRT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
        drawnAt: new Date().toISOString(),
        sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
      video: video || {
        hasVideo: false,
      },
      multibrandMeta: multibrandMeta || undefined,
    };

    const saved = await createGiveaway(newGiveaway);

    return res.status(201).json({
      message: 'Sorteo guardado correctamente',
      giveaway: saved,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error al guardar sorteo' });
  }
});
// Active transcoding promises per giveawayId to prevent duplicate or partial-file races
const activeVideoConversions = new Map<string, Promise<boolean>>();

// Universal 720x1280 H.264 Main Level 4.0 yuv420p BT.709 CFR 30fps + AAC Stereo + faststart
// Lightweight (~1.5-3 MB) so WhatsApp, iPhone Photos, Instagram, Mac, and Android send & play in seconds
const convertToUniversalMp4 = async (src: string, dst: string): Promise<boolean> => {
  const ffmpegBin = resolveFfmpegBinary();
  const tmpDst = `${dst}.tmp.${Date.now()}.mp4`;
  const cleanupTmp = () => {
    try {
      if (fs.existsSync(tmpDst)) fs.unlinkSync(tmpDst);
    } catch {
      // ignore
    }
  };

  try {
    await execFileAsync(
      ffmpegBin,
      [
        '-y',
        '-loglevel', 'error',
        '-i', src,
        '-f', 'lavfi',
        '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-vf', 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,format=yuv420p',
        '-c:v', 'libx264',
        '-profile:v', 'main',
        '-level', '4.0',
        '-pix_fmt', 'yuv420p',
        '-colorspace', 'bt709',
        '-color_primaries', 'bt709',
        '-color_trc', 'bt709',
        '-preset', 'superfast',
        '-crf', '24',
        '-maxrate', '1300k',
        '-bufsize', '2600k',
        '-vsync', 'cfr',
        '-r', '30',
        '-g', '60',
        '-sc_threshold', '0',
        '-c:a', 'aac',
        '-b:a', '96k',
        '-ar', '44100',
        '-shortest',
        '-movflags', '+faststart',
        '-brand', 'mp42',
        '-f', 'mp4',
        tmpDst,
      ],
      { maxBuffer: 10 * 1024 * 1024, timeout: 120000 }
    );
    if (fs.existsSync(tmpDst) && fs.statSync(tmpDst).size > 1000) {
      fs.renameSync(tmpDst, dst);
      return true;
    }
    cleanupTmp();
    return false;
  } catch (err: any) {
    cleanupTmp();
    console.warn('ffmpeg primary conversion fallback:', err?.message || err);
    try {
      await execFileAsync(
        ffmpegBin,
        [
          '-y',
          '-loglevel', 'error',
          '-i', src,
          '-f', 'lavfi',
          '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-vf', 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,format=yuv420p',
          '-c:v', 'libx264',
          '-profile:v', 'baseline',
          '-level', '4.0',
          '-pix_fmt', 'yuv420p',
          '-preset', 'superfast',
          '-crf', '25',
          '-maxrate', '1300k',
          '-bufsize', '2600k',
          '-vsync', 'cfr',
          '-r', '30',
          '-g', '60',
          '-c:a', 'aac',
          '-b:a', '96k',
          '-ar', '44100',
          '-shortest',
          '-movflags', '+faststart',
          '-f', 'mp4',
          tmpDst,
        ],
        { maxBuffer: 10 * 1024 * 1024, timeout: 120000 }
      );
      if (fs.existsSync(tmpDst) && fs.statSync(tmpDst).size > 1000) {
        fs.renameSync(tmpDst, dst);
        return true;
      }
      cleanupTmp();
      return false;
    } catch (err2: any) {
      cleanupTmp();
      console.error('ffmpeg conversion error:', err2?.message || err2);
      return false;
    }
  }
};

const ensureUniversalMp4 = (giveawayId: string, rawPath: string, mp4Path: string): Promise<boolean> => {
  const existing = activeVideoConversions.get(giveawayId);
  if (existing) return existing;

  const task = (async () => {
    try {
      return await convertToUniversalMp4(rawPath, mp4Path);
    } finally {
      activeVideoConversions.delete(giveawayId);
    }
  })();

  activeVideoConversions.set(giveawayId, task);
  return task;
};

const ensureUniversalMov = async (mp4Path: string, movPath: string): Promise<boolean> => {
  if (fs.existsSync(movPath) && fs.statSync(movPath).size >= 1000) return true;
  const tmpMov = `${movPath}.tmp.${Date.now()}.mov`;
  try {
    await execFileAsync(
      resolveFfmpegBinary(),
      ['-y', '-loglevel', 'error', '-i', mp4Path, '-c', 'copy', '-movflags', '+faststart', '-f', 'mov', tmpMov],
      { maxBuffer: 10 * 1024 * 1024, timeout: 60000 }
    );
    if (fs.existsSync(tmpMov) && fs.statSync(tmpMov).size > 1000) {
      fs.renameSync(tmpMov, movPath);
      return true;
    }
    try { if (fs.existsSync(tmpMov)) fs.unlinkSync(tmpMov); } catch { /* ignore */ }
    return false;
  } catch (movErr: any) {
    try { if (fs.existsSync(tmpMov)) fs.unlinkSync(tmpMov); } catch { /* ignore */ }
    console.warn('MOV remux warning:', movErr?.message || movErr);
    return false;
  }
};

async function finalizeUploadedRawVideo(
  giveaway: Giveaway,
  rawFilename: string,
  rawFilePath: string,
  mimeType: string,
  durationSeconds: number
) {
  const mp4Filename = `${giveaway.id}_universal.mp4`;
  const mp4FilePath = path.join(VIDEOS_DIR, mp4Filename);
  const movFilePath = path.join(VIDEOS_DIR, `${giveaway.id}_universal.mov`);

  const fileSize = fs.existsSync(rawFilePath) ? fs.statSync(rawFilePath).size : 0;
  const mp4Ready = fileSize >= 1000
    ? await ensureUniversalMp4(giveaway.id, rawFilePath, mp4FilePath)
    : false;

  if (mp4Ready && fs.existsSync(mp4FilePath)) {
    await ensureUniversalMov(mp4FilePath, movFilePath);
  }

  const finalSizeBytes = mp4Ready && fs.existsSync(mp4FilePath)
    ? fs.statSync(mp4FilePath).size
    : fileSize;
  const sizeMB = (finalSizeBytes / (1024 * 1024)).toFixed(2) + ' MB';

  let storageKey: string | undefined;
  if (isSupabaseEnabled()) {
    if (mp4Ready && fs.existsSync(mp4FilePath)) {
      const uploaded = await uploadVideoToSupabaseStorage(mp4Filename, mp4FilePath, 'video/mp4');
      if (uploaded) storageKey = mp4Filename;
    } else if (fs.existsSync(rawFilePath)) {
      const uploaded = await uploadVideoToSupabaseStorage(rawFilename, rawFilePath, mimeType);
      if (uploaded) storageKey = rawFilename;
    }
  }

  const videoMeta: Giveaway['video'] = {
    hasVideo: true,
    videoFileName: rawFilename,
    mp4FileName: mp4Filename,
    storageKey,
    videoDurationSeconds: durationSeconds,
    videoSizeFormatted: sizeMB,
    videoMimeType: mp4Ready ? 'video/mp4' : mimeType,
    recordedAt: new Date().toISOString(),
  };

  const updated = await updateGiveawayVideo(giveaway.id, videoMeta);
  return {
    message: 'Video guardado correctamente',
    mp4Ready,
    movReady: mp4Ready && fs.existsSync(movFilePath),
    video: updated?.video || videoMeta,
    videoUrl: `/api/giveaways/${giveaway.id}/video-stream`,
    mp4Url: `/api/giveaways/${giveaway.id}/download-video?format=mp4`,
    movUrl: `/api/giveaways/${giveaway.id}/download-video`,
  };
}

// Chunked binary video upload (bypasses Cloud Run / reverse-proxy 32 MB body limits for long giveaways)
app.post('/api/giveaways/:id/video-chunk', express.raw({ type: '*/*', limit: '10mb' }), async (req: any, res) => {
  try {
    const buffer: Buffer = req.body;
    const chunkIndex = Number(req.query.chunkIndex);
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0 || Number.isNaN(chunkIndex) || chunkIndex < 0) {
      return res.status(400).json({ error: 'Chunk de video inválido' });
    }
    const partPath = path.join(VIDEOS_DIR, `${req.params.id}.part.${chunkIndex}`);
    fs.writeFileSync(partPath, buffer);
    return res.json({ ok: true, chunkIndex, bytes: buffer.length });
  } catch (err: any) {
    console.error('Error saving video chunk:', err);
    return res.status(500).json({ error: 'Error al guardar fragmento de video' });
  }
});

app.post('/api/giveaways/:id/video-finalize', async (req: any, res) => {
  try {
    const { totalChunks, mimeType = 'video/webm', durationSeconds = 12 } = req.body || {};
    const count = Number(totalChunks);
    if (!count || count < 1 || count > 200) {
      return res.status(400).json({ error: 'Número de fragmentos inválido' });
    }

    const giveaway = await findGiveawayById(req.params.id);
    if (!giveaway) {
      return res.status(404).json({ error: 'Sorteo no encontrado' });
    }

    const rawExt = String(mimeType).includes('mp4') ? 'raw.mp4' : 'raw.webm';
    const rawFilename = `${giveaway.id}_${rawExt}`;
    const rawFilePath = path.join(VIDEOS_DIR, rawFilename);

    const partBuffers: Buffer[] = [];
    for (let i = 0; i < count; i++) {
      const partPath = path.join(VIDEOS_DIR, `${giveaway.id}.part.${i}`);
      if (!fs.existsSync(partPath)) {
        return res.status(400).json({ error: `Falta el fragmento ${i} del video` });
      }
      partBuffers.push(fs.readFileSync(partPath));
    }
    fs.writeFileSync(rawFilePath, Buffer.concat(partBuffers));

    for (let i = 0; i < count; i++) {
      const partPath = path.join(VIDEOS_DIR, `${giveaway.id}.part.${i}`);
      try { fs.unlinkSync(partPath); } catch { /* ignore */ }
    }

    const result = await finalizeUploadedRawVideo(
      giveaway,
      rawFilename,
      rawFilePath,
      String(mimeType),
      Number(durationSeconds) || 12
    );
    return res.json(result);
  } catch (err: any) {
    console.error('Error finalizing chunked video:', err);
    return res.status(500).json({ error: 'Error al ensamblar el video' });
  }
});

// Binary raw video upload (transcodes deterministically to universal H.264 Main Level 4.1 MP4)
app.post('/api/giveaways/:id/video-binary', express.raw({ type: '*/*', limit: '100mb' }), async (req: any, res) => {
  try {
    const buffer: Buffer = req.body;
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 200) {
      return res.status(400).json({ error: 'Archivo de video inválido o vacío' });
    }

    const mimeType = (req.query.mimeType as string) || 'video/webm';
    const durationSeconds = Number(req.query.durationSeconds) || 12;

    const giveaway = await findGiveawayById(req.params.id);
    if (!giveaway) {
      return res.status(404).json({ error: 'Sorteo no encontrado' });
    }

    const rawExt = mimeType.includes('mp4') ? 'raw.mp4' : 'raw.webm';
    const rawFilename = `${giveaway.id}_${rawExt}`;
    const rawFilePath = path.join(VIDEOS_DIR, rawFilename);

    fs.writeFileSync(rawFilePath, buffer);
    const result = await finalizeUploadedRawVideo(giveaway, rawFilename, rawFilePath, mimeType, durationSeconds);
    return res.json(result);
  } catch (err: any) {
    console.error('Error in video-binary upload:', err);
    return res.status(500).json({ error: 'Error al procesar el archivo de video binario' });
  }
});

app.post('/api/giveaways/:id/video', async (req: any, res) => {
  try {
    const { videoBase64, mimeType, durationSeconds } = req.body;
    if (!videoBase64) {
      return res.status(400).json({ error: 'No se recibió archivo de video' });
    }

    const giveaway = await findGiveawayById(req.params.id);
    if (!giveaway) {
      return res.status(404).json({ error: 'Sorteo no encontrado' });
    }

    const rawExt = mimeType && mimeType.includes('mp4') ? 'raw.mp4' : 'raw.webm';
    const rawFilename = `${giveaway.id}_${rawExt}`;
    const rawFilePath = path.join(VIDEOS_DIR, rawFilename);

    const mp4Filename = `${giveaway.id}_universal.mp4`;
    const mp4FilePath = path.join(VIDEOS_DIR, mp4Filename);

    const commaIndex = videoBase64.indexOf(',');
    const base64Data = commaIndex !== -1 ? videoBase64.substring(commaIndex + 1) : videoBase64;
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length < 200) {
      return res.status(400).json({ error: 'Archivo de video inválido o vacío' });
    }

    fs.writeFileSync(rawFilePath, buffer);
    const result = await finalizeUploadedRawVideo(
      giveaway,
      rawFilename,
      rawFilePath,
      mimeType || 'video/webm',
      durationSeconds || 12
    );
    return res.json(result);
  } catch (err: any) {
    console.error('Error saving video:', err);
    return res.status(500).json({ error: 'Error al procesar el archivo de video' });
  }
});

// Check video transcoding / availability status
app.get('/api/giveaways/:id/video-status', async (req, res) => {
  try {
    const giveaway = await findGiveawayById(req.params.id);
    if (!giveaway) {
      return res.status(404).json({ error: 'Sorteo no encontrado' });
    }
    const mp4Filename = giveaway.video?.mp4FileName || `${giveaway.id}_universal.mp4`;
    const mp4Path = path.join(VIDEOS_DIR, mp4Filename);
    const converting = activeVideoConversions.has(giveaway.id);
    const mp4Ready =
      !converting &&
      ((fs.existsSync(mp4Path) && fs.statSync(mp4Path).size >= 1000) ||
        Boolean(giveaway.video?.storageKey?.endsWith('.mp4')));
    return res.json({
      hasVideo: Boolean(giveaway.video?.hasVideo),
      converting,
      mp4Ready,
    });
  } catch {
    return res.status(500).json({ error: 'Error al consultar estado del video' });
  }
});

// Stream video file (prefers universal H.264 MP4 when ready)
app.get('/api/giveaways/:id/video-stream', async (req, res) => {
  try {
    const giveaway = await findGiveawayById(req.params.id);
    if (!giveaway || !giveaway.video?.hasVideo) {
      return res.status(404).json({ error: 'Video no disponible para este sorteo' });
    }

    const pending = activeVideoConversions.get(giveaway.id);
    if (pending) {
      await pending;
    }

    const mp4Filename = giveaway.video.mp4FileName || `${giveaway.id}_universal.mp4`;
    const mp4Path = path.join(VIDEOS_DIR, mp4Filename);
    const rawFilename = giveaway.video.videoFileName || `${giveaway.id}_raw.webm`;
    const rawPath = path.join(VIDEOS_DIR, rawFilename);

    const hasValidMp4Header = (p: string): boolean => {
      try {
        if (!fs.existsSync(p) || fs.statSync(p).size < 1000) return false;
        const fd = fs.openSync(p, 'r');
        const hdr = Buffer.alloc(12);
        fs.readSync(fd, hdr, 0, 12, 0);
        fs.closeSync(fd);
        return hdr.subarray(4, 8).toString('ascii') === 'ftyp';
      } catch {
        return false;
      }
    };

    let filePath = '';
    let contentType = 'video/mp4';

    if (hasValidMp4Header(mp4Path)) {
      filePath = mp4Path;
      contentType = 'video/mp4';
    } else {
      if (fs.existsSync(mp4Path)) {
        try { fs.unlinkSync(mp4Path); } catch { /* ignore */ }
      }
      if (giveaway.video.storageKey && isSupabaseEnabled()) {
        const remoteBuf = await downloadVideoFromSupabaseStorage(giveaway.video.storageKey);
        if (remoteBuf && remoteBuf.length >= 1000) {
          const isRemoteMp4 = remoteBuf.subarray(4, 8).toString('ascii') === 'ftyp';
          if (isRemoteMp4) {
            fs.writeFileSync(mp4Path, remoteBuf);
            filePath = mp4Path;
            contentType = 'video/mp4';
          } else {
            fs.writeFileSync(rawPath, remoteBuf);
            const converted = await ensureUniversalMp4(giveaway.id, rawPath, mp4Path);
            if (converted && hasValidMp4Header(mp4Path)) {
              filePath = mp4Path;
              contentType = 'video/mp4';
              const uploaded = await uploadVideoToSupabaseStorage(mp4Filename, mp4Path, 'video/mp4');
              if (uploaded) {
                await updateGiveawayVideo(giveaway.id, {
                  ...giveaway.video,
                  mp4FileName: mp4Filename,
                  storageKey: mp4Filename,
                  videoMimeType: 'video/mp4',
                  videoSizeFormatted: (fs.statSync(mp4Path).size / (1024 * 1024)).toFixed(2) + ' MB',
                });
              }
            }
          }
        }
      }
    }

    if (!filePath && fs.existsSync(rawPath) && fs.statSync(rawPath).size >= 1000) {
      const converted = await ensureUniversalMp4(giveaway.id, rawPath, mp4Path);
      if (converted && hasValidMp4Header(mp4Path)) {
        filePath = mp4Path;
        contentType = 'video/mp4';
      } else {
        filePath = rawPath;
        contentType = giveaway.video.videoMimeType || 'video/webm';
      }
    }

    if (!filePath) {
      return res.status(404).json({ error: 'El archivo físico de video no se encuentra en el servidor' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
        'Content-Type': contentType,
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al reproducir video' });
  }
});

// Dedicated universal MP4 download endpoint (verifies ftyp MP4 header, NEVER serves WebM to iPhone/WhatsApp)
app.get(['/api/giveaways/:id/download-video', '/api/giveaways/:id/download-mp4'], async (req, res) => {
  try {
    const giveaway = await findGiveawayById(req.params.id);
    if (!giveaway || !giveaway.video?.hasVideo) {
      return res.status(404).json({ error: 'Video no disponible para este sorteo' });
    }

    const pending = activeVideoConversions.get(giveaway.id);
    if (pending) {
      await pending;
    }

    const mp4Filename = giveaway.video.mp4FileName || `${giveaway.id}_universal.mp4`;
    const mp4Path = path.join(VIDEOS_DIR, mp4Filename);
    const rawFilename = giveaway.video.videoFileName || `${giveaway.id}_raw.webm`;
    const rawPath = path.join(VIDEOS_DIR, rawFilename);

    const hasValidMp4Header = (p: string): boolean => {
      try {
        if (!fs.existsSync(p) || fs.statSync(p).size < 1000) return false;
        const fd = fs.openSync(p, 'r');
        const hdr = Buffer.alloc(12);
        fs.readSync(fd, hdr, 0, 12, 0);
        fs.closeSync(fd);
        return hdr.subarray(4, 8).toString('ascii') === 'ftyp';
      } catch {
        return false;
      }
    };

    if (!hasValidMp4Header(mp4Path)) {
      if (fs.existsSync(mp4Path)) {
        try { fs.unlinkSync(mp4Path); } catch { /* ignore */ }
      }
      if (giveaway.video.storageKey && isSupabaseEnabled()) {
        const remoteBuf = await downloadVideoFromSupabaseStorage(giveaway.video.storageKey);
        if (remoteBuf && remoteBuf.length >= 1000) {
          const isRemoteMp4 = remoteBuf.subarray(4, 8).toString('ascii') === 'ftyp';
          if (isRemoteMp4) {
            fs.writeFileSync(mp4Path, remoteBuf);
          } else {
            fs.writeFileSync(rawPath, remoteBuf);
          }
        }
      }
      if (!hasValidMp4Header(mp4Path) && fs.existsSync(rawPath) && fs.statSync(rawPath).size >= 1000) {
        const converted = await ensureUniversalMp4(giveaway.id, rawPath, mp4Path);
        if (converted && hasValidMp4Header(mp4Path) && isSupabaseEnabled()) {
          const uploaded = await uploadVideoToSupabaseStorage(mp4Filename, mp4Path, 'video/mp4');
          if (uploaded) {
            await updateGiveawayVideo(giveaway.id, {
              ...giveaway.video,
              mp4FileName: mp4Filename,
              storageKey: mp4Filename,
              videoMimeType: 'video/mp4',
              videoSizeFormatted: (fs.statSync(mp4Path).size / (1024 * 1024)).toFixed(2) + ' MB',
            });
          }
        }
      }
    }

    if (hasValidMp4Header(mp4Path)) {
      const requestedFormat = String(req.query.format || 'mov').toLowerCase();
      if (requestedFormat !== 'mp4') {
        const movPath = path.join(VIDEOS_DIR, `${giveaway.id}_universal.mov`);
        await ensureUniversalMov(mp4Path, movPath);
        if (fs.existsSync(movPath) && fs.statSync(movPath).size >= 1000) {
          const movStat = fs.statSync(movPath);
          res.writeHead(200, {
            'Content-Length': movStat.size,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-store',
            'Content-Type': 'video/quicktime',
            'Content-Disposition': `attachment; filename="sorteoo_${giveaway.id}.mov"`,
          });
          return fs.createReadStream(movPath).pipe(res);
        }
      }

      const stat = fs.statSync(mp4Path);
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="sorteoo_${giveaway.id}.mp4"`,
      });
      return fs.createReadStream(mp4Path).pipe(res);
    }

    if (!giveaway.video.storageKey && !fs.existsSync(rawPath) && !hasValidMp4Header(mp4Path)) {
      return res.status(404).json({ error: 'Este video no alcanzó a guardarse en el servidor; realiza un nuevo sorteo para generarlo.' });
    }

    return res.status(500).json({ error: 'No se pudo generar el video compatible. Intenta nuevamente.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al procesar descarga de video' });
  }
});

// Delete giveaway
app.delete('/api/giveaways/:id', authenticateToken, async (req: any, res) => {
  try {
    const giveaway = await findGiveawayById(req.params.id);
    if (!giveaway) {
      return res.status(404).json({ error: 'Sorteo no encontrado' });
    }
    if (giveaway.userId !== req.user.id) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const filesToDelete = [
      giveaway.video?.videoFileName,
      giveaway.video?.mp4FileName,
      `${giveaway.id}_universal.mov`,
      giveaway.video?.storageKey,
    ].filter(Boolean) as string[];

    for (const fname of filesToDelete) {
      const vPath = path.join(VIDEOS_DIR, fname);
      if (fs.existsSync(vPath)) {
        try {
          fs.unlinkSync(vPath);
        } catch {
          // ignore
        }
      }
    }

    if (isSupabaseEnabled()) {
      await deleteVideosFromSupabaseStorage(Array.from(new Set(filesToDelete)));
    }

    await deleteGiveawayRecord(giveaway.id);
    return res.json({ message: 'Sorteo eliminado' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al eliminar sorteo' });
  }
});

// ----------------------------------------------------
// MULTIBRAND GIVEAWAY API & META INSTAGRAM WEBHOOKS
// ----------------------------------------------------

// Meta Webhook Verification (Handshake)
app.get('/api/webhooks/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'sorteoo_webhook_token_2026';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Meta Webhook] Verificado exitosamente con token:', token);
    return res.status(200).send(challenge);
  }
  console.warn('[Meta Webhook] Token de verificación inválido:', token);
  return res.status(403).send('Forbidden: Token de verificación incorrecto');
});

// Meta Webhook Ingestion (Captures story replies and filters for "PARTICIPO")
app.post('/api/webhooks/instagram', async (req, res) => {
  try {
    const body = req.body;
    if (body.object === 'instagram' || body.entry) {
      let capturedCount = 0;
      for (const entry of body.entry || []) {
        for (const messagingEvent of entry.messaging || []) {
          const sender = messagingEvent.sender;
          const senderId = sender?.id || `user_${Date.now()}`;
          const message = messagingEvent.message;
          if (!message || !message.text) continue;

          const text = String(message.text).trim();
          const cleanNormalized = text.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '');
          const isValidParticipo = cleanNormalized === 'PARTICIPO';

          const storyRefId = message.reply_to?.story?.id || messagingEvent.postback?.referral?.story_id;
          const targetStory = storyRefId ? await findStoryById(storyRefId) : await getFirstStory();

          if (targetStory) {
            const replyObj: MultibrandStoryReply = {
              id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              storyId: targetStory.id,
              messageId: message.mid || `mid_${Date.now()}`,
              userId: senderId,
              username: sender?.username || `usuario_${senderId.slice(-4)}`,
              text,
              timestamp: new Date().toISOString(),
              isValidParticipo,
            };
            await addStoryReply(replyObj);
            capturedCount++;
          }
        }
      }
      console.log(`[Meta Webhook] Procesados ${capturedCount} mensajes de historias.`);
      return res.status(200).send('EVENT_RECEIVED');
    }
    return res.sendStatus(404);
  } catch (err: any) {
    console.error('Error procesando webhook de Meta:', err);
    return res.status(500).send('Error');
  }
});

// Get registered Multibrand stories (persistent history past 24 hours)
app.get('/api/multibrand/stories', async (_req, res) => {
  try {
    const allStories = await listStories();
    const stories = allStories.map((s) => ({
      ...s,
      repliesCount: s.replies ? s.replies.filter((r) => r.isValidParticipo).length : s.repliesCount || 0,
      totalRawReplies: s.replies ? s.replies.length : 0,
    }));
    return res.json({ stories });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al consultar historias' });
  }
});

// Register or import a new Story to the persistent registry
app.post('/api/multibrand/stories', async (req, res) => {
  try {
    const { brandName, prize, username, mediaUrl, publishedAt } = req.body;
    if (!brandName) {
      return res.status(400).json({ error: 'El nombre de la marca es obligatorio' });
    }

    const newStory: MultibrandStory = {
      id: `story_mb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      username: username?.replace(/^@/, '') || 'sorteoo_creator',
      brandName: brandName.trim(),
      prize: prize?.trim() || 'Premio especial de la marca',
      mediaUrl: mediaUrl || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80',
      thumbnailUrl: mediaUrl || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80',
      publishedAt: publishedAt || new Date().toISOString(),
      repliesCount: 0,
      replies: [],
    };

    const created = await createStory(newStory);

    return res.status(201).json({
      message: 'Historia registrada con éxito en el archivo persistente',
      story: created,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error al registrar historia' });
  }
});

// Update story
app.put('/api/multibrand/stories/:id', async (req, res) => {
  try {
    const { brandName, prize, isArchived } = req.body;
    const story = await updateStory(req.params.id, {
      brandName: brandName ? brandName.trim() : undefined,
      prize: prize !== undefined ? prize.trim() : undefined,
      isArchived: isArchived !== undefined ? Boolean(isArchived) : undefined,
    });
    if (!story) {
      return res.status(404).json({ error: 'Historia no encontrada en el registro' });
    }

    return res.json({ message: 'Historia actualizada', story });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al actualizar historia' });
  }
});

// Delete story
app.delete('/api/multibrand/stories/:id', async (req, res) => {
  try {
    const deleted = await deleteStory(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Historia no encontrada' });
    }
    return res.json({ message: 'Historia eliminada del registro' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al eliminar historia' });
  }
});

// Add reply to a story
app.post('/api/multibrand/stories/:id/reply', async (req, res) => {
  try {
    const { username, text } = req.body;
    if (!username || !text) {
      return res.status(400).json({ error: 'Ingresa usuario y mensaje' });
    }

    const cleanUser = username.trim().replace(/^@/, '');
    const cleanText = text.trim();
    const cleanNormalized = cleanText.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '');
    const isValidParticipo = cleanNormalized === 'PARTICIPO';

    const story = await findStoryById(req.params.id);
    if (!story) {
      return res.status(404).json({ error: 'Historia no encontrada' });
    }

    const replyObj: MultibrandStoryReply = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      storyId: story.id,
      messageId: `manual_${Date.now()}`,
      userId: `usr_${cleanUser.toLowerCase()}`,
      username: cleanUser,
      text: cleanText,
      timestamp: new Date().toISOString(),
      isValidParticipo,
    };

    await addStoryReply(replyObj);

    return res.status(201).json({
      message: isValidParticipo
        ? `¡Respuesta válida registrada! Participante @${cleanUser} sumado.`
        : `Respuesta descartada: No contiene exactamente 'PARTICIPO'.`,
      reply: replyObj,
      isValidParticipo,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al agregar respuesta' });
  }
});

// Unify multiple posts comments with strict rule: 1 participation per person
app.post('/api/multibrand/unify-posts', async (req, res) => {
  try {
    const { postUrls, giveawayTitle, profileUsername } = req.body;
    if (!Array.isArray(postUrls) || postUrls.length === 0) {
      return res.status(400).json({ error: 'Debes seleccionar al menos una publicación para el sorteo multimarcas' });
    }

    interface UnifiedUser {
      username: string;
      avatarUrl: string;
      comment: string;
      interactionsCount: number;
      contentSources: Array<{
        type: 'post' | 'story';
        title: string;
        date?: string;
        details?: string;
      }>;
    }

    const userMap = new Map<string, UnifiedUser>();
    let totalInteractionsReceived = 0;

    for (let pIdx = 0; pIdx < postUrls.length; pIdx++) {
      const url = postUrls[pIdx];
      const match = url.match(/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
      const shortcode = match ? match[1] : `post_${pIdx + 1}`;
      const postTitle = `Publicación ${pIdx + 1} (${shortcode})`;

      // Gather ALL paginated comments for this post using recent feed
      let postComments: Participant[] = [];

      try {
        const job = getOrStartCommentJob({
          shortcode,
          author: profileUsername ? String(profileUsername).replace(/^@/, '').trim() : undefined,
        });
        if (job.promise) {
          await job.promise;
        }
        postComments = [...job.participants];
      } catch (err: any) {
        console.warn(`Could not fetch SocialData for post ${shortcode}:`, err.message);
      }

      totalInteractionsReceived += postComments.length;

      // Unify with strict 1 participation per person
      for (const comment of postComments) {
        const key = comment.username.toLowerCase();
        if (userMap.has(key)) {
          const existing = userMap.get(key)!;
          existing.interactionsCount++;
          existing.contentSources.push({
            type: 'post',
            title: postTitle,
            date: comment.timestamp,
            details: comment.comment,
          });
        } else {
          userMap.set(key, {
            username: comment.username,
            avatarUrl: comment.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${comment.username}`,
            comment: comment.comment,
            interactionsCount: 1,
            contentSources: [
              {
                type: 'post',
                title: postTitle,
                date: comment.timestamp,
                details: comment.comment,
              },
            ],
          });
        }
      }
    }

    const participants = Array.from(userMap.values());
    const uniqueParticipantsCount = participants.length;
    const duplicatesDiscardedCount = totalInteractionsReceived - uniqueParticipantsCount;

    return res.json({
      giveawayName: giveawayTitle || `Sorteo Multimarcas (${postUrls.length} publicaciones)`,
      mode: 'posts',
      selectedContentsCount: postUrls.length,
      totalInteractionsReceived,
      uniqueParticipantsCount,
      duplicatesDiscardedCount,
      participants,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error al unificar publicaciones' });
  }
});

// Unify multiple brand stories replies with strict rule: 1 participation per person
app.post('/api/multibrand/unify-stories', async (req, res) => {
  try {
    const { storyIds, giveawayTitle } = req.body;
    if (!Array.isArray(storyIds) || storyIds.length === 0) {
      return res.status(400).json({ error: 'Debes seleccionar al menos una historia de marca' });
    }

    const stories = await listStoriesByIds(storyIds);

    if (stories.length === 0) {
      return res.status(404).json({ error: 'No se encontraron las historias seleccionadas en el registro' });
    }

    interface UnifiedStoryUser {
      username: string;
      avatarUrl: string;
      comment: string;
      interactionsCount: number;
      contentSources: Array<{
        type: 'post' | 'story';
        title: string;
        brandName?: string;
        date?: string;
        details?: string;
      }>;
    }

    const userMap = new Map<string, UnifiedStoryUser>();
    let totalInteractionsReceived = 0;
    const brandsList: string[] = [];

    for (const story of stories) {
      if (!brandsList.includes(story.brandName)) {
        brandsList.push(story.brandName);
      }

      const validReplies = (story.replies || []).filter((r) => r.isValidParticipo);
      totalInteractionsReceived += validReplies.length;

      for (const reply of validReplies) {
        const key = reply.username.toLowerCase();
        const storyTitle = `Historia de ${story.brandName}`;
        const prizeInfo = story.prize ? `Premio: ${story.prize}` : 'Respuesta válida: PARTICIPO';

        if (userMap.has(key)) {
          const existing = userMap.get(key)!;
          existing.interactionsCount++;
          existing.contentSources.push({
            type: 'story',
            title: storyTitle,
            brandName: story.brandName,
            date: reply.timestamp,
            details: prizeInfo,
          });
        } else {
          userMap.set(key, {
            username: reply.username,
            avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(reply.username)}`,
            comment: reply.text || 'PARTICIPO',
            interactionsCount: 1,
            contentSources: [
              {
                type: 'story',
                title: storyTitle,
                brandName: story.brandName,
                date: reply.timestamp,
                details: prizeInfo,
              },
            ],
          });
        }
      }
    }

    const participants = Array.from(userMap.values());
    const uniqueParticipantsCount = participants.length;
    const duplicatesDiscardedCount = totalInteractionsReceived - uniqueParticipantsCount;

    return res.json({
      giveawayName: giveawayTitle || `Sorteo Multimarcas (${brandsList.join(' + ')})`,
      mode: 'stories',
      selectedContentsCount: stories.length,
      brands: brandsList,
      totalInteractionsReceived,
      uniqueParticipantsCount,
      duplicatesDiscardedCount,
      participants,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error al unificar historias' });
  }
});

// Meta Webhook configuration status
app.get('/api/multibrand/meta-status', async (_req, res) => {
  try {
    const stories = await listStories();
    return res.json({
      webhookConfigured: true,
      webhookEndpoint: '/api/webhooks/instagram',
      verifyToken: process.env.META_VERIFY_TOKEN || 'sorteoo_webhook_token_2026',
      totalStoriesInRegistry: stories.length,
      acceptedKeywords: ['PARTICIPO', 'participo', 'Participo'],
      ruleDescription: 'Unificación estricta: 1 participación por persona única.',
      storageMode: isSupabaseEnabled() ? 'supabase' : 'local',
    });
  } catch {
    return res.status(500).json({ error: 'Error al consultar estado' });
  }
});

// ----------------------------------------------------
// PAYMENTS, COUPONS & MERCADO PAGO PRODUCTION API
// ----------------------------------------------------

app.get('/api/payments/config', async (_req, res) => {
  try {
    const settings = await getPaymentSettings();
    return res.json({
      giveawayPrice: settings.giveawayPrice,
      currency: settings.currency,
      mpConfigured: Boolean(settings.mpAccessToken && settings.mpAccessToken.trim().length > 10),
      mpPublicKey: settings.mpPublicKey || '',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Error al obtener configuración de pago' });
  }
});

app.post('/api/coupons/validate', async (req, res) => {
  try {
    const { code } = req.body || {};
    const validation = await validateCouponCode(code);
    return res.json(validation);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Cupón inválido' });
  }
});

app.post('/api/coupons/redeem-free', async (req: any, res) => {
  try {
    const { code, giveawaySummary } = req.body || {};
    if (!code) {
      return res.status(400).json({ error: 'Código de cupón requerido' });
    }
    const reqUser = getOptionalUserFromReq(req);
    const { order, coupon } = await redeemFreeCouponOrder(code, {
      userId: reqUser?.id || 'guest_user',
      userEmail: reqUser?.email,
      giveawaySummary: giveawaySummary ? String(giveawaySummary).slice(0, 140) : undefined,
    });
    return res.json({
      approved: true,
      order,
      couponCode: coupon.code,
      discountPercent: coupon.discountPercent,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'No se pudo canjear el cupón' });
  }
});

app.post('/api/payments/create-preference', async (req: any, res) => {
  try {
    const { couponCode, returnUrl, giveawaySummary, drawConfig } = req.body || {};
    const settings = await getPaymentSettings();

    if (!settings.mpAccessToken || settings.mpAccessToken.trim().length < 10) {
      return res.status(400).json({
        error: 'Mercado Pago aún no está configurado en el Panel de Administración.',
      });
    }

    let baseAmount = settings.giveawayPrice;
    let discountPercent = 0;
    let finalAmount = baseAmount;
    let appliedCode: string | undefined;

    if (couponCode && String(couponCode).trim().length > 0) {
      const check = await validateCouponCode(String(couponCode));
      baseAmount = check.basePrice;
      discountPercent = check.discountPercent;
      finalAmount = check.finalAmount;
      appliedCode = check.code;
      if (finalAmount === 0) {
        return res.status(400).json({
          error: 'Este cupón tiene 100% de descuento; usá el botón directo sin Mercado Pago.',
        });
      }
    }

    const reqUser = getOptionalUserFromReq(req);
    const externalReference = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const baseAppUrl =
      (typeof returnUrl === 'string' && returnUrl.startsWith('http') ? returnUrl : '') ||
      process.env.APP_URL ||
      `${req.protocol}://${req.get('host')}`;
    const cleanReturnBase = baseAppUrl.split('?')[0].split('#')[0].replace(/\/+$/, '');

    const backUrls = {
      success: `${cleanReturnBase}/?mp_ref=${encodeURIComponent(externalReference)}&mp_status=approved`,
      failure: `${cleanReturnBase}/?mp_ref=${encodeURIComponent(externalReference)}&mp_status=failure`,
      pending: `${cleanReturnBase}/?mp_ref=${encodeURIComponent(externalReference)}&mp_status=pending`,
    };

    const preferencePayload: Record<string, any> = {
      items: [
        {
          id: 'sorteo_sorteoo_app',
          title: 'Sorteo Certificado - sorteoo.app',
          description: giveawaySummary ? String(giveawaySummary).slice(0, 200) : 'Sorteo oficial con video 9:16 y certificado',
          quantity: 1,
          currency_id: 'ARS',
          unit_price: Number(finalAmount),
        },
      ],
      external_reference: externalReference,
      back_urls: backUrls,
      statement_descriptor: 'SORTEOO.APP',
    };

    if (cleanReturnBase.startsWith('https://')) {
      preferencePayload.auto_return = 'approved';
      preferencePayload.notification_url = `${cleanReturnBase}/api/payments/webhook`;
    }

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.mpAccessToken.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferencePayload),
    });

    const mpData: any = await mpResponse.json().catch(() => ({}));
    if (!mpResponse.ok || !mpData?.id || !mpData?.init_point) {
      console.error('Mercado Pago preference error:', mpResponse.status, mpData);
      const mpErrMsg =
        mpData?.message ||
        mpData?.cause?.[0]?.description ||
        'No se pudo iniciar el checkout con Mercado Pago. Verifica tu Access Token de producción.';
      return res.status(502).json({ error: mpErrMsg });
    }

    await createPendingPaymentOrder({
      id: externalReference,
      userId: reqUser?.id || 'guest_user',
      userEmail: reqUser?.email,
      baseAmount,
      discountPercent,
      finalAmount,
      couponCode: appliedCode,
      mpPreferenceId: String(mpData.id),
      giveawaySummary: giveawaySummary ? String(giveawaySummary).slice(0, 140) : undefined,
    });

    if (drawConfig) {
      savePendingDrawConfig(externalReference, drawConfig);
    }

    return res.json({
      externalReference,
      preferenceId: mpData.id,
      initPoint: mpData.init_point,
      finalAmount,
      discountPercent,
    });
  } catch (err: any) {
    console.error('Error creating Mercado Pago preference:', err);
    return res.status(500).json({ error: err?.message || 'Error al generar el enlace de pago' });
  }
});

async function queryMercadoPagoApproval(
  accessToken: string,
  externalReference: string,
  paymentId?: string
): Promise<{ approved: boolean; status: string; mpPaymentId?: string }> {
  const headers = { Authorization: `Bearer ${accessToken.trim()}` };

  if (paymentId) {
    try {
      const pRes = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
        headers,
      });
      if (pRes.ok) {
        const pData: any = await pRes.json();
        if (
          pData?.external_reference === externalReference &&
          pData?.status === 'approved'
        ) {
          return { approved: true, status: 'approved', mpPaymentId: String(pData.id) };
        }
        if (pData?.status) {
          return { approved: false, status: String(pData.status), mpPaymentId: String(pData.id) };
        }
      }
    } catch {
      // fall through to search endpoint
    }
  }

  try {
    const searchUrl = `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&external_reference=${encodeURIComponent(externalReference)}`;
    const sRes = await fetch(searchUrl, { headers });
    if (sRes.ok) {
      const sData: any = await sRes.json();
      const results: any[] = Array.isArray(sData?.results) ? sData.results : [];
      const approvedPayment = results.find((r) => r?.status === 'approved');
      if (approvedPayment) {
        return { approved: true, status: 'approved', mpPaymentId: String(approvedPayment.id) };
      }
      if (results[0]?.status) {
        return { approved: false, status: String(results[0].status), mpPaymentId: String(results[0].id) };
      }
    }
  } catch {
    // ignore transient search errors
  }

  return { approved: false, status: 'pending' };
}

app.get('/api/payments/status/:ref', async (req, res) => {
  try {
    const ref = String(req.params.ref || '').trim();
    const paymentId = typeof req.query.paymentId === 'string' ? req.query.paymentId.trim() : undefined;
    if (!ref) {
      return res.status(400).json({ error: 'Referencia de pago inválida' });
    }

    let order = await getPaymentOrderById(ref);
    if (!order) {
      return res.status(404).json({ error: 'Orden de pago no encontrada' });
    }

    if (order.status === 'approved') {
      return res.json({
        approved: true,
        status: 'approved',
        order,
        drawConfig: getPendingDrawConfig(ref),
      });
    }

    const settings = await getPaymentSettings();
    if (settings.mpAccessToken) {
      const mpCheck = await queryMercadoPagoApproval(settings.mpAccessToken, ref, paymentId);
      if (mpCheck.approved) {
        const updated = await markPaymentOrderApproved(ref, mpCheck.mpPaymentId);
        if (updated) order = updated;
        return res.json({
          approved: true,
          status: 'approved',
          order,
          drawConfig: getPendingDrawConfig(ref),
        });
      }
      return res.json({
        approved: false,
        status: mpCheck.status || order.status,
        order,
      });
    }

    return res.json({
      approved: false,
      status: order.status,
      order,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Error al verificar el pago' });
  }
});

app.post('/api/payments/webhook', async (req, res) => {
  try {
    const paymentId = req.body?.data?.id || req.query?.['data.id'] || req.query?.id;
    const topic = req.body?.type || req.query?.topic || req.query?.type;
    if (paymentId && (!topic || String(topic).includes('payment'))) {
      const settings = await getPaymentSettings();
      if (settings.mpAccessToken) {
        const pRes = await fetch(
          `https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(paymentId))}`,
          { headers: { Authorization: `Bearer ${settings.mpAccessToken.trim()}` } }
        );
        if (pRes.ok) {
          const pData: any = await pRes.json();
          if (pData?.status === 'approved' && pData?.external_reference) {
            await markPaymentOrderApproved(String(pData.external_reference), String(pData.id));
          }
        }
      }
    }
    return res.status(200).json({ received: true });
  } catch {
    return res.status(200).json({ received: true });
  }
});

// ----------------------------------------------------
// ADMIN PANEL ENDPOINTS (admin@sorteoo.app ONLY)
// ----------------------------------------------------

app.get('/api/admin/settings', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const settings = await getPaymentSettings();
    return res.json({
      giveawayPrice: settings.giveawayPrice,
      currency: settings.currency,
      hasAccessToken: Boolean(settings.mpAccessToken && settings.mpAccessToken.trim().length > 0),
      accessTokenMasked: maskSecretToken(settings.mpAccessToken),
      mpPublicKey: settings.mpPublicKey || '',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Error al cargar configuración' });
  }
});

app.put('/api/admin/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { mpAccessToken, mpPublicKey, giveawayPrice, clearToken } = req.body || {};
    const updated = await updatePaymentSettings({
      mpAccessToken,
      mpPublicKey,
      giveawayPrice,
      clearToken: Boolean(clearToken),
    });
    return res.json({
      message: 'Configuración de Mercado Pago guardada correctamente',
      settings: {
        giveawayPrice: updated.giveawayPrice,
        currency: updated.currency,
        hasAccessToken: Boolean(updated.mpAccessToken && updated.mpAccessToken.trim().length > 0),
        accessTokenMasked: maskSecretToken(updated.mpAccessToken),
        mpPublicKey: updated.mpPublicKey || '',
      },
    });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Error al guardar configuración' });
  }
});

app.get('/api/admin/coupons', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const coupons = await listCoupons();
    return res.json({ coupons });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Error al listar cupones' });
  }
});

app.post('/api/admin/coupons', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { code, discountPercent, maxUses, description } = req.body || {};
    const coupon = await createCoupon({ code, discountPercent, maxUses, description });
    return res.status(201).json({ message: 'Cupón creado correctamente', coupon });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Error al crear cupón' });
  }
});

app.patch('/api/admin/coupons/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { active, discountPercent, maxUses, description } = req.body || {};
    const coupon = await updateCoupon(req.params.id, { active, discountPercent, maxUses, description });
    if (!coupon) {
      return res.status(404).json({ error: 'Cupón no encontrado' });
    }
    return res.json({ message: 'Cupón actualizado', coupon });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Error al actualizar cupón' });
  }
});

app.delete('/api/admin/coupons/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const deleted = await deleteCoupon(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Cupón no encontrado' });
    }
    return res.json({ message: 'Cupón eliminado' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Error al eliminar cupón' });
  }
});

app.get('/api/admin/payments', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const payments = await listPaymentOrders();
    return res.json({ payments });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Error al listar pagos' });
  }
});

// ----------------------------------------------------
// VITE SETUP (Full-stack integration)
// ----------------------------------------------------
async function startServer() {
  await seedAdminAccount();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`sorteoo.app server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
