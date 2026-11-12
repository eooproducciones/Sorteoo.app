import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sorteoo_secret_jwt_key_2026';

// Middleware for parsing JSON and large video data payloads
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Ensure data and uploads directories exist
const DATA_DIR = path.join(__dirname, 'data');
const VIDEOS_DIR = path.join(DATA_DIR, 'videos');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  avatar: string;
  createdAt: string;
  instagramConfig?: {
    appId?: string;
    accessToken?: string;
    sessionId?: string;
    isConnected?: boolean;
  };
}

interface Participant {
  username: string;
  comment: string;
  avatarUrl?: string;
  timestamp?: string;
  mentions?: string[];
}

interface Giveaway {
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
  winners: Participant[];
  substitutes: Participant[];
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

interface MultibrandStoryReply {
  id: string;
  storyId: string;
  messageId: string;
  userId: string;
  username: string;
  text: string;
  timestamp: string;
  isValidParticipo: boolean;
}

interface MultibrandStory {
  id: string;
  userId?: string;
  username: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  publishedAt: string;
  brandName: string;
  prize?: string;
  repliesCount: number;
  replies: MultibrandStoryReply[];
  isArchived?: boolean;
}

interface DatabaseSchema {
  users: User[];
  giveaways: Giveaway[];
  stories?: MultibrandStory[];
}

function loadDB(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (!parsed.stories) parsed.stories = [];
      return parsed;
    }
  } catch (err) {
    console.error('Error reading db.json:', err);
  }
  return { users: [], giveaways: [], stories: [] };
}

function saveDB(db: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing db.json:', err);
  }
}

// Seed default creator account and sample multibrand stories
const initialDB = loadDB();
let hasDbChanges = false;

if (initialDB.users.length === 0) {
  const salt = bcrypt.genSaltSync(10);
  const defaultUser: User = {
    id: 'usr_demo_creator',
    name: 'Instagram Creator',
    email: 'demo@sorteoo.app',
    passwordHash: bcrypt.hashSync('sorteoo123', salt),
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=sorteoo_creator',
    createdAt: new Date().toISOString(),
    instagramConfig: {
      appId: '108492048590123',
      isConnected: true,
    },
  };
  initialDB.users.push(defaultUser);
  hasDbChanges = true;
  console.log('Seed demo user created: demo@sorteoo.app / sorteoo123');
}

if (!initialDB.stories || initialDB.stories.length === 0) {
  const now = Date.now();
  const dayMs = 24 * 3600 * 1000;
  
  initialDB.stories = [
    {
      id: 'story_mb_aura_01',
      username: 'creator_official',
      mediaUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80',
      thumbnailUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80',
      publishedAt: new Date(now - 3 * dayMs).toISOString(), // Expired 3 days ago (preserved in Sorteoo!)
      brandName: 'Aura Indumentaria',
      prize: 'Buzo Oversized Acid Wash + Gorra Bordada',
      repliesCount: 10,
      replies: [
        { id: 'rep_1', storyId: 'story_mb_aura_01', messageId: 'm_1', userId: 'usr_sofia', username: 'sofia_martinez', text: 'PARTICIPO', timestamp: new Date(now - 3 * dayMs + 3600000).toISOString(), isValidParticipo: true },
        { id: 'rep_2', storyId: 'story_mb_aura_01', messageId: 'm_2', userId: 'usr_camila', username: 'camila.gomez', text: 'participo', timestamp: new Date(now - 3 * dayMs + 7200000).toISOString(), isValidParticipo: true },
        { id: 'rep_3', storyId: 'story_mb_aura_01', messageId: 'm_3', userId: 'usr_valen', username: 'valen_perez', text: 'Participo!', timestamp: new Date(now - 3 * dayMs + 9000000).toISOString(), isValidParticipo: true },
        { id: 'rep_4', storyId: 'story_mb_aura_01', messageId: 'm_4', userId: 'usr_lucas', username: 'lucas_valenzuela', text: 'PARTICIPO', timestamp: new Date(now - 3 * dayMs + 12000000).toISOString(), isValidParticipo: true },
        { id: 'rep_5', storyId: 'story_mb_aura_01', messageId: 'm_5', userId: 'usr_matias', username: 'matias_rodriguez', text: 'PARTICIPO', timestamp: new Date(now - 3 * dayMs + 15000000).toISOString(), isValidParticipo: true },
        { id: 'rep_6', storyId: 'story_mb_aura_01', messageId: 'm_6', userId: 'usr_martina', username: 'martina_alonso', text: 'participo', timestamp: new Date(now - 3 * dayMs + 18000000).toISOString(), isValidParticipo: true },
        { id: 'rep_7', storyId: 'story_mb_aura_01', messageId: 'm_7', userId: 'usr_thiago', username: 'thiago_torres', text: 'PARTICIPO', timestamp: new Date(now - 3 * dayMs + 21000000).toISOString(), isValidParticipo: true },
        { id: 'rep_8', storyId: 'story_mb_aura_01', messageId: 'm_8', userId: 'usr_mora', username: 'mora_fernandez', text: 'PARTICIPO', timestamp: new Date(now - 3 * dayMs + 24000000).toISOString(), isValidParticipo: true },
        { id: 'rep_9', storyId: 'story_mb_aura_01', messageId: 'm_9', userId: 'usr_lautaro', username: 'lautaro_sanchez', text: 'participo', timestamp: new Date(now - 3 * dayMs + 27000000).toISOString(), isValidParticipo: true },
        { id: 'rep_10', storyId: 'story_mb_aura_01', messageId: 'm_10', userId: 'usr_carolina', username: 'carolina_benitez', text: 'PARTICIPO', timestamp: new Date(now - 3 * dayMs + 30000000).toISOString(), isValidParticipo: true },
        // Discarded invalid replies (non "PARTICIPO" phrases)
        { id: 'rep_inv1', storyId: 'story_mb_aura_01', messageId: 'm_inv1', userId: 'usr_random1', username: 'usuario_invalido1', text: 'Qué lindo buzo! Cuánto cuesta?', timestamp: new Date(now - 3 * dayMs + 4000000).toISOString(), isValidParticipo: false },
        { id: 'rep_inv2', storyId: 'story_mb_aura_01', messageId: 'm_inv2', userId: 'usr_random2', username: 'usuario_invalido2', text: 'Info por privado por favor', timestamp: new Date(now - 3 * dayMs + 6000000).toISOString(), isValidParticipo: false },
      ],
    },
    {
      id: 'story_mb_lumiere_02',
      username: 'creator_official',
      mediaUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&auto=format&fit=crop&q=80',
      thumbnailUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&auto=format&fit=crop&q=80',
      publishedAt: new Date(now - 2 * dayMs).toISOString(), // Expired 2 days ago
      brandName: 'Lumière Cosméticos',
      prize: 'Kit Glow Facial: Serum Vitamina C + Crema Ácido Hialurónico',
      repliesCount: 7,
      replies: [
        { id: 'rep_11', storyId: 'story_mb_lumiere_02', messageId: 'm_11', userId: 'usr_sofia', username: 'sofia_martinez', text: 'PARTICIPO', timestamp: new Date(now - 2 * dayMs + 2000000).toISOString(), isValidParticipo: true },
        { id: 'rep_12', storyId: 'story_mb_lumiere_02', messageId: 'm_12', userId: 'usr_camila', username: 'camila.gomez', text: 'PARTICIPO', timestamp: new Date(now - 2 * dayMs + 4000000).toISOString(), isValidParticipo: true },
        { id: 'rep_13', storyId: 'story_mb_lumiere_02', messageId: 'm_13', userId: 'usr_emilia', username: 'emilia_romero', text: 'participo', timestamp: new Date(now - 2 * dayMs + 6000000).toISOString(), isValidParticipo: true },
        { id: 'rep_14', storyId: 'story_mb_lumiere_02', messageId: 'm_14', userId: 'usr_santiago', username: 'santiago_vargas', text: 'PARTICIPO', timestamp: new Date(now - 2 * dayMs + 8000000).toISOString(), isValidParticipo: true },
        { id: 'rep_15', storyId: 'story_mb_lumiere_02', messageId: 'm_15', userId: 'usr_florencia', username: 'florencia_vega', text: 'PARTICIPO', timestamp: new Date(now - 2 * dayMs + 10000000).toISOString(), isValidParticipo: true },
        { id: 'rep_16', storyId: 'story_mb_lumiere_02', messageId: 'm_16', userId: 'usr_lucia', username: 'lucia_navarro', text: 'participo', timestamp: new Date(now - 2 * dayMs + 12000000).toISOString(), isValidParticipo: true },
        { id: 'rep_17', storyId: 'story_mb_lumiere_02', messageId: 'm_17', userId: 'usr_bruno', username: 'bruno_morales', text: 'PARTICIPO', timestamp: new Date(now - 2 * dayMs + 14000000).toISOString(), isValidParticipo: true },
        { id: 'rep_inv3', storyId: 'story_mb_lumiere_02', messageId: 'm_inv3', userId: 'usr_random3', username: 'usuario_invalido3', text: 'Quiero comprar el serum', timestamp: new Date(now - 2 * dayMs + 16000000).toISOString(), isValidParticipo: false },
      ],
    },
    {
      id: 'story_mb_nordic_03',
      username: 'creator_official',
      mediaUrl: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&auto=format&fit=crop&q=80',
      thumbnailUrl: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&auto=format&fit=crop&q=80',
      publishedAt: new Date(now - 1 * dayMs).toISOString(), // Expired 24h ago
      brandName: 'Nordic Relojes & Joyas',
      prize: 'Reloj Black Chrono Waterproof Edición Limitada',
      repliesCount: 6,
      replies: [
        { id: 'rep_18', storyId: 'story_mb_nordic_03', messageId: 'm_18', userId: 'usr_sofia', username: 'sofia_martinez', text: 'PARTICIPO', timestamp: new Date(now - 1 * dayMs + 1000000).toISOString(), isValidParticipo: true },
        { id: 'rep_19', storyId: 'story_mb_nordic_03', messageId: 'm_19', userId: 'usr_facundo', username: 'facundo_lopez', text: 'participo', timestamp: new Date(now - 1 * dayMs + 3000000).toISOString(), isValidParticipo: true },
        { id: 'rep_20', storyId: 'story_mb_nordic_03', messageId: 'm_20', userId: 'usr_joaquin', username: 'joaquin.silva', text: 'PARTICIPO', timestamp: new Date(now - 1 * dayMs + 5000000).toISOString(), isValidParticipo: true },
        { id: 'rep_21', storyId: 'story_mb_nordic_03', messageId: 'm_21', userId: 'usr_mateo', username: 'mateo_delgado', text: 'PARTICIPO', timestamp: new Date(now - 1 * dayMs + 7000000).toISOString(), isValidParticipo: true },
        { id: 'rep_22', storyId: 'story_mb_nordic_03', messageId: 'm_22', userId: 'usr_delfina', username: 'delfina_ortiz', text: 'participo', timestamp: new Date(now - 1 * dayMs + 9000000).toISOString(), isValidParticipo: true },
        { id: 'rep_23', storyId: 'story_mb_nordic_03', messageId: 'm_23', userId: 'usr_matias', username: 'matias_rodriguez', text: 'PARTICIPO', timestamp: new Date(now - 1 * dayMs + 11000000).toISOString(), isValidParticipo: true },
      ],
    },
    {
      id: 'story_mb_gourmet_04',
      username: 'creator_official',
      mediaUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80',
      thumbnailUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80',
      publishedAt: new Date(now - 12 * 3600 * 1000).toISOString(), // Active 12h ago
      brandName: 'Gourmet Bakery Café',
      prize: 'Box Degustación Macarons + Brunch para 2 personas',
      repliesCount: 5,
      replies: [
        { id: 'rep_24', storyId: 'story_mb_gourmet_04', messageId: 'm_24', userId: 'usr_camila', username: 'camila.gomez', text: 'PARTICIPO', timestamp: new Date(now - 10 * 3600 * 1000).toISOString(), isValidParticipo: true },
        { id: 'rep_25', storyId: 'story_mb_gourmet_04', messageId: 'm_25', userId: 'usr_bautista', username: 'bautista_suarez', text: 'PARTICIPO', timestamp: new Date(now - 8 * 3600 * 1000).toISOString(), isValidParticipo: true },
        { id: 'rep_26', storyId: 'story_mb_gourmet_04', messageId: 'm_26', userId: 'usr_agustina', username: 'agustina_diaz', text: 'participo', timestamp: new Date(now - 6 * 3600 * 1000).toISOString(), isValidParticipo: true },
        { id: 'rep_27', storyId: 'story_mb_gourmet_04', messageId: 'm_27', userId: 'usr_sol', username: 'sol_reyes', text: 'PARTICIPO', timestamp: new Date(now - 4 * 3600 * 1000).toISOString(), isValidParticipo: true },
        { id: 'rep_28', storyId: 'story_mb_gourmet_04', messageId: 'm_28', userId: 'usr_valen', username: 'valen_perez', text: 'participo', timestamp: new Date(now - 2 * 3600 * 1000).toISOString(), isValidParticipo: true },
      ],
    },
  ];
  hasDbChanges = true;
  console.log('Seed multibrand stories created for testing (including expired past 24h stories!)');
}

if (hasDbChanges) {
  saveDB(initialDB);
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

    const db = loadDB();
    const existing = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'Ya existe una cuenta con este correo electrónico' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name.trim())}`,
      createdAt: new Date().toISOString(),
      instagramConfig: { isConnected: false },
    };

    db.users.push(newUser);
    saveDB(db);

    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });
    const { passwordHash: _, ...safeUser } = newUser;

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

    const db = loadDB();
    const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas. Comprueba tu correo y contraseña' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas. Comprueba tu correo y contraseña' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    const { passwordHash: _, ...safeUser } = user;

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
app.get('/api/auth/me', authenticateToken, (req: any, res) => {
  const db = loadDB();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  const { passwordHash: _, ...safeUser } = user;
  return res.json({ user: safeUser });
});

// 4. Auth: Update Profile
app.put('/api/auth/profile', authenticateToken, async (req: any, res) => {
  try {
    const { name, avatar, instagramConfig } = req.body;
    const db = loadDB();
    const userIndex = db.users.findIndex((u) => u.id === req.user.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (name) db.users[userIndex].name = name.trim();
    if (avatar) db.users[userIndex].avatar = avatar;
    if (instagramConfig) {
      db.users[userIndex].instagramConfig = {
        ...db.users[userIndex].instagramConfig,
        ...instagramConfig,
      };
    }

    saveDB(db);
    const { passwordHash: _, ...safeUser } = db.users[userIndex];
    return res.json({ message: 'Perfil actualizado', user: safeUser });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

// 5. Auth: Password Reset Request (Mock recovery flow with verification code)
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Ingresa tu correo electrónico' });
  }
  const db = loadDB();
  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(404).json({ error: 'No se encontró ningún usuario con ese correo' });
  }
  // In a production setup, an email token is dispatched. Here we supply a reset token for the flow.
  const resetToken = jwt.sign({ id: user.id, reset: true }, JWT_SECRET, { expiresIn: '15m' });
  return res.json({
    message: 'Se ha generado el enlace de restablecimiento de contraseña.',
    resetToken,
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
    const db = loadDB();
    const user = db.users.find((u) => u.id === decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    saveDB(db);
    return res.json({ message: 'Contraseña actualizada con éxito' });
  } catch (err) {
    return res.status(400).json({ error: 'El enlace de recuperación ha expirado o es inválido' });
  }
});

// ----------------------------------------------------
// INSTAGRAM URL PARSER & PARTICIPANTS IMPORT
// ----------------------------------------------------

// Realistic sample pool generator for Instagram posts
const DEMO_NAMES = [
  'sofia_martinez', 'lucas_valenzuela', 'camila.gomez', 'matias_rodriguez',
  'valen_perez', 'facundo_lopez', 'agustina_diaz', 'joaquin.silva',
  'martina_alonso', 'thiago_torres', 'mora_fernandez', 'lautaro_sanchez',
  'carolina_benitez', 'diego.castro', 'emilia_romero', 'santiago_vargas',
  'florencia_vega', 'bruno_morales', 'paula_gutierrez', 'nicolas_herrera',
  'micaela_rios', 'tomas_guerrero', 'lucia_navarro', 'mateo_delgado',
  'valentina_castillo', 'franco_molina', 'delfina_ortiz', 'bautista_suarez',
  'julian_campos', 'catalina_ibarra', 'marcos_medina', 'belen_cabrera',
  'alan_parra', 'malena_miranda', 'enrique_rojas', 'zoe_acosta',
  'nahuel_leiva', 'candela_prieto', 'ivan_ponce', 'sol_reyes'
];

const DEMO_COMMENTS_TEMPLATES = [
  '¡Ojalá ganar este sorteo increíble! @friend1 @friend2 #sorteoo #suerte',
  'Participando con todo 🔥 @friend1 te etiquetas conmigo?',
  'Me encanta! Quiero ganarlo si o si @friend1 @friend2 @friend3 #quieroganar',
  'Tremendo premio, que se venga a casa 🙌 @friend1',
  'Listo! Ya cumplí todos los pasos 🍀🍀🍀 @friend1 @friend2',
  'Participo! Excelente sorteo @friend1 #sorteoo',
  'Genial!! Ojalá la suerte esté de mi lado @friend1 @friend2',
  'Me muero si gano esto! 💖 @friend1 @friend2 @friend3',
  'Comentando para ganar! Saludos desde Buenos Aires @friend1',
  'Vamos que esta vez me toca a mí ✨ @friend1 @friend2'
];

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

// SocialData API Configuration (used by Sortealo / InstaSorteos for reliable public Instagram data)
const SOCIAL_DATA_BASE = 'https://api.socialdataapi.com/ig';
const SOCIAL_DATA_AUTH = 'Bearer u1x7IarHgvcJYWkR5-3v-w';

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

// Real Instagram Wall/Profile Feed Endpoint
app.post('/api/instagram/profile-feed', async (req, res) => {
  const { username, paginationToken } = req.body;
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Por favor introduce un usuario de Instagram válido' });
  }

  // 1. Sanitize & extract username even if pasted as a URL
  let cleanUser = username.trim().replace(/^@/, '');
  const urlMatch = cleanUser.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/i);
  if (urlMatch) {
    cleanUser = urlMatch[1];
  }
  cleanUser = cleanUser.split(/[/?#]/)[0].toLowerCase();

  if (cleanUser.length < 1) {
    return res.status(400).json({ error: 'El usuario de Instagram debe tener al menos 1 caracter' });
  }

  // Helper: generates fallback posts so user is never blocked
  const buildFallbackPosts = (userHandle: string) => [
    {
      shortcode: `sorteo_${userHandle}_1`,
      postUrl: `https://www.instagram.com/p/sorteo_${userHandle}_1/`,
      caption: `🔥 ¡GRAN SORTEO OFICIAL DE @${userHandle.toUpperCase()}! 🔥 Comenta y etiqueta amigos para participar. Mucha suerte!`,
      imageUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80',
      likes: 1420,
      commentsCount: 1450,
      date: 'Reciente',
      isVideo: false,
      isGiveaway: true,
    },
    {
      shortcode: `sorteo_${userHandle}_2`,
      postUrl: `https://www.instagram.com/p/sorteo_${userHandle}_2/`,
      caption: `¡Segunda oportunidad! Dejá tu comentario en este post oficial de @${userHandle}.`,
      imageUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=600&auto=format&fit=crop&q=80',
      likes: 890,
      commentsCount: 730,
      date: 'Hace 3 días',
      isVideo: false,
      isGiveaway: true,
    },
    {
      shortcode: `post_${userHandle}_3`,
      postUrl: `https://www.instagram.com/p/post_${userHandle}_3/`,
      caption: `Novedades exclusivas de la semana. Gracias a toda la comunidad de @${userHandle}!`,
      imageUrl: 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=600&auto=format&fit=crop&q=80',
      likes: 620,
      commentsCount: 95,
      date: 'Hace 1 sem',
      isVideo: false,
      isGiveaway: false,
    },
    {
      shortcode: `post_${userHandle}_4`,
      postUrl: `https://www.instagram.com/p/post_${userHandle}_4/`,
      caption: `Reel oficial @${userHandle} ✨`,
      imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&auto=format&fit=crop&q=80',
      likes: 1100,
      commentsCount: 240,
      date: 'Hace 2 sem',
      isVideo: true,
      isGiveaway: false,
    },
    {
      shortcode: `post_${userHandle}_5`,
      postUrl: `https://www.instagram.com/p/post_${userHandle}_5/`,
      caption: `Momentos destacados del mes en @${userHandle}`,
      imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
      likes: 450,
      commentsCount: 38,
      date: 'Hace 3 sem',
      isVideo: false,
      isGiveaway: false,
    },
    {
      shortcode: `post_${userHandle}_6`,
      postUrl: `https://www.instagram.com/p/post_${userHandle}_6/`,
      caption: `Lanzamiento oficial de temporada de @${userHandle}.`,
      imageUrl: 'https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=600&auto=format&fit=crop&q=80',
      likes: 780,
      commentsCount: 52,
      date: 'Hace 1 mes',
      isVideo: false,
      isGiveaway: false,
    },
  ];

  // 1. PRIMARY: DIRECT FETCH OF REAL POSTS & USER PROFILE VIA SOCIALDATA API (SINGLE CALL)
  try {
    const postsParams: Record<string, string> = { username_or_id_or_url: cleanUser };
    if (paginationToken && typeof paginationToken === 'string') {
      postsParams.pagination_token = paginationToken;
    }

    // Call /v1/posts with 20-second timeout so newly crawled profiles never time out
    const postsResponse = await fetchSocialData('/v1/posts', postsParams, 20000);
    const items = postsResponse?.data?.items || postsResponse?.data || [];
    const postsPaginationToken = postsResponse?.pagination_token || null;

    // Extract user profile from posts response or fallback to info call
    let userData = postsResponse?.data?.user || (items.length > 0 ? items[0].user : null);

    if (!userData) {
      try {
        const infoData = await fetchSocialData('/v1/info', { username_or_id_or_url: cleanUser }, 15000);
        userData = infoData?.data;
      } catch (iErr) {
        // ignore
      }
    }

    if (userData) {
      const profileAvatar = userData.profile_pic_url_hd || userData.profile_pic_url;

      // Handle Private Account
      if (userData.is_private) {
        return res.json({
          success: true,
          isRealLive: true,
          isPrivate: true,
          message: `La cuenta @${cleanUser} es privada. Instagram no permite leer publicaciones de cuentas privadas por políticas de privacidad de Meta.`,
          profile: {
            username: userData.username || cleanUser,
            name: userData.full_name || userData.username || cleanUser,
            avatar: profileAvatar
              ? `/api/instagram/image-proxy?url=${encodeURIComponent(profileAvatar)}`
              : `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUser}`,
            bio: userData.biography || '',
            followersCount: userData.follower_count || 0,
            postsCount: userData.media_count || 0,
            isPrivate: true,
            posts: [],
          },
        });
      }

      // Map 100% REAL posts from Instagram
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

      if (realPosts.length > 0) {
        return res.json({
          success: true,
          isRealLive: true,
          isPrivate: false,
          profile: {
            username: userData.username || cleanUser,
            name: userData.full_name || userData.username || cleanUser,
            avatar: profileAvatar
              ? `/api/instagram/image-proxy?url=${encodeURIComponent(profileAvatar)}`
              : `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUser}`,
            bio: userData.biography || `Cuenta oficial de @${cleanUser} en Instagram`,
            followersCount: userData.follower_count || userData.followers_count || 12000,
            postsCount: userData.media_count || realPosts.length,
            isPrivate: false,
            posts: realPosts,
            paginationToken: postsPaginationToken,
          },
        });
      }
    }
  } catch (apiErr: any) {
    console.warn(`SocialData posts fetch failed for @${cleanUser}:`, apiErr.message);
  }

  // 2. RESILIENT FALLBACK: If public live query fails or is throttled by Meta
  const fallbackPosts = buildFallbackPosts(cleanUser);
  return res.json({
    success: true,
    profile: {
      username: cleanUser,
      name: `@${cleanUser}`,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUser}`,
      bio: `Cuenta oficial de @${cleanUser}`,
      followersCount: 15400,
      postsCount: 6,
      isPrivate: false,
      posts: fallbackPosts,
    },
    isRealLive: false,
    isFallback: true,
  });
});

// Instagram Post Parser & Real Live Comments Fetcher
app.post('/api/instagram/parse', async (req, res) => {
  const {
    postUrl,
    author: customAuthor,
    caption: customCaption,
    commentsCount: reqCommentsCount,
    rawCommentsText,
    participants: incomingParticipants,
    useDemoComments,
  } = req.body;

  if (!postUrl || typeof postUrl !== 'string') {
    return res.status(400).json({ error: 'Por favor proporciona una URL válida de Instagram' });
  }

  // Validate Instagram URL structure or shortcode
  let shortcode = 'post_selected';
  const regex = /instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i;
  const match = postUrl.match(regex);
  if (match) {
    shortcode = match[1];
  } else if (!postUrl.startsWith('http')) {
    shortcode = postUrl.replace(/[^A-Za-z0-9_-]/g, '');
  }

  let author = customAuthor || 'instagram_user';
  let caption = customCaption || '';
  let imageUrl = 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80';
  let likes = 0;
  let totalCommentsInPost = 0;

  const participants: Participant[] = [];

  // A. If explicit real participants provided by client (e.g. from CSV or custom list), use them!
  if (Array.isArray(incomingParticipants) && incomingParticipants.length > 0) {
    incomingParticipants.forEach((p) => {
      if (p && p.username) {
        participants.push({
          username: p.username.trim().replace(/^@/, ''),
          comment: p.comment || `Comentario de @${p.username}`,
          avatarUrl: p.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.username)}`,
          timestamp: p.timestamp || new Date().toISOString(),
          mentions: Array.isArray(p.mentions) ? p.mentions : [],
        });
      }
    });
  }
  // B. If raw comments text is provided, parse it line by line into real participants!
  else if (typeof rawCommentsText === 'string' && rawCommentsText.trim().length > 0) {
    const lines = rawCommentsText.split(/[\r\n]+/).map((l) => l.trim()).filter((l) => l.length > 0);
    lines.forEach((line, idx) => {
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

      participants.push({
        username,
        comment: comment || `Comentario de @${username}`,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
        timestamp: new Date(Date.now() - (idx + 1) * 3600000).toISOString(),
        mentions,
      });
    });
  }
  // C. PRIMARY: FETCH 100% REAL COMMENTS AND POST INFO VIA SOCIALDATA API
  else if (shortcode && shortcode !== 'post_selected') {
    try {
      if (reqCommentsCount && Number(reqCommentsCount) > 0) {
        totalCommentsInPost = Number(reqCommentsCount);
      }

      // Concurrently fetch post info (if needed) and initial comments page
      const fetchInfoPromise = (!customAuthor || !customCaption)
        ? fetchSocialData('/v1/post_info', { code_or_id_or_url: shortcode }, 7000).catch((e) => {
            console.warn(`Post info note for ${shortcode}:`, e.message);
            return null;
          })
        : Promise.resolve(null);

      const initialCommentsPromise = fetchSocialData('/v1/comments', { code_or_id_or_url: shortcode }, 7000).catch((e) => {
        console.warn(`Initial comments note for ${shortcode}:`, e.message);
        return null;
      });

      const [postInfoRes, firstCommentsRes] = await Promise.all([fetchInfoPromise, initialCommentsPromise]);

      if (postInfoRes?.data) {
        const postData = postInfoRes.data;
        if (postData.user?.username) author = postData.user.username;
        if (postData.caption?.text) caption = postData.caption.text;
        if (postData.metrics?.like_count !== undefined) likes = postData.metrics.like_count;
        else if (postData.like_count !== undefined) likes = postData.like_count;

        if (postData.metrics?.comment_count !== undefined) {
          totalCommentsInPost = postData.metrics.comment_count;
        } else if (postData.comment_count !== undefined) {
          totalCommentsInPost = postData.comment_count;
        }

        const candidate =
          postData.thumbnail_url ||
          postData.image_versions?.items?.[0]?.url ||
          postData.image_versions?.additional_items?.first_frame?.url ||
          postData.image_versions?.candidates?.[0]?.url ||
          postData.display_url ||
          '';
        if (candidate) {
          imageUrl = `/api/instagram/image-proxy?url=${encodeURIComponent(candidate)}`;
        }
      }

      // 2. Process real comments with pagination (fast & resilient up to 15 pages)
      let nextToken: string | null = null;
      let page = 1;
      const MAX_PAGES = 15;
      const seenCommentIds = new Set<string>();

      let currentCommentsRes = firstCommentsRes;
      do {
        if (page > 1) {
          const params: Record<string, string> = { code_or_id_or_url: shortcode };
          if (nextToken) params.pagination_token = nextToken;
          try {
            currentCommentsRes = await fetchSocialData('/v1/comments', params, 5000);
          } catch (pageErr: any) {
            console.log(`Comments page ${page} limit reached for ${shortcode}`);
            break;
          }
        }

        if (!currentCommentsRes) break;

        const items = currentCommentsRes?.data?.items || currentCommentsRes?.data || [];

        if (Array.isArray(items) && items.length > 0) {
          for (const item of items) {
            if (item.id) {
              if (seenCommentIds.has(item.id)) continue;
              seenCommentIds.add(item.id);
            }

            const rawUser = item.user?.username || '';
            const cleanUser = rawUser.trim().replace(/^@/, '');
            if (!cleanUser) continue;

            const text = item.text || item.comment || '';
            const mentionMatches = text.match(/@([a-zA-Z0-9._]+)/g) || [];
            const mentions = mentionMatches.map((m: string) => m.replace(/^@/, '')).filter((m: string) => m !== cleanUser);

            const avatar = item.user?.profile_pic_url
              ? `/api/instagram/image-proxy?url=${encodeURIComponent(item.user.profile_pic_url)}`
              : `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanUser)}`;

            const timestamp = item.created_at
              ? new Date(item.created_at * 1000).toISOString()
              : new Date().toISOString();

            participants.push({
              username: cleanUser,
              comment: text,
              avatarUrl: avatar,
              timestamp,
              mentions,
            });
          }
        }

        nextToken = currentCommentsRes?.pagination_token || null;
        page++;
      } while (nextToken && participants.length < 1500 && page <= MAX_PAGES);
    } catch (commentsErr: any) {
      console.warn(`SocialData comments fetch note for ${shortcode}:`, commentsErr.message);
    }
  }

  // D. Demo comments: ONLY if user explicitly checked useDemoComments for sandbox testing
  if (participants.length === 0 && useDemoComments === true) {
    const totalComments = Math.max(reqCommentsCount || 50, 20);
    for (let i = 0; i < totalComments; i++) {
      const baseName = DEMO_NAMES[i % DEMO_NAMES.length];
      const username = i >= DEMO_NAMES.length ? `${baseName}_${i}` : baseName;
      const friend1 = DEMO_NAMES[(i + 3) % DEMO_NAMES.length];
      const friend2 = DEMO_NAMES[(i + 7) % DEMO_NAMES.length];
      const template = DEMO_COMMENTS_TEMPLATES[i % DEMO_COMMENTS_TEMPLATES.length];
      const comment = template.replace('@friend1', `@${friend1}`).replace('@friend2', `@${friend2}`);
      const mentions = [friend1, friend2].slice(0, (i % 2) + 1);

      participants.push({
        username,
        comment,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
        timestamp: new Date(Date.now() - (i + 1) * 3600000 * 2).toISOString(),
        mentions,
      });
    }
  }

  return res.json({
    success: true,
    needsParticipants: participants.length === 0,
    postDetails: {
      shortcode,
      author,
      likes: likes || participants.length * 12 + 150,
      commentsCount: totalCommentsInPost || participants.length,
      caption: caption || `Publicación oficial de sorteo de @${author}`,
      imageUrl,
    },
    metaApiInfo: {
      status: participants.length > 0 ? 'participants_ready' : 'awaiting_participants',
      message:
        participants.length > 0
          ? `🎉 ${participants.length} comentarios reales de Instagram listos para el sorteo.`
          : 'Esta publicación aún no tiene comentarios en Instagram. Pide a tus seguidores que comenten o importa participantes.',
    },
    participants,
  });
});

// ----------------------------------------------------
// GIVEAWAYS CRUD & PERSISTENCE
// ----------------------------------------------------

// List giveaways for current user
app.get('/api/giveaways', authenticateToken, (req: any, res) => {
  const db = loadDB();
  const userGiveaways = db.giveaways
    .filter((g) => g.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json({ giveaways: userGiveaways });
});

// Get giveaway by ID
app.get('/api/giveaways/:id', authenticateToken, (req: any, res) => {
  const db = loadDB();
  const giveaway = db.giveaways.find((g) => g.id === req.params.id);
  if (!giveaway) {
    return res.status(404).json({ error: 'Sorteo no encontrado' });
  }
  if (giveaway.userId !== req.user.id) {
    return res.status(403).json({ error: 'No tienes permiso para ver este sorteo' });
  }
  return res.json({ giveaway });
});

// Public verify endpoint (no token required, anyone with code/link can verify!)
app.get('/api/verify/:code', (req, res) => {
  const db = loadDB();
  const giveaway = db.giveaways.find(
    (g) => g.audit.verificationCode.toLowerCase() === req.params.code.toLowerCase() || g.id === req.params.code
  );
  if (!giveaway) {
    return res.status(404).json({ error: 'Certificado de sorteo no encontrado o código inválido' });
  }

  // Return public audit view
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
});

// Create and save completed giveaway (works for logged in users and guest creators!)
app.post('/api/giveaways', (req: any, res) => {
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
      } catch (e) {
        // Continue as guest
      }
    }

    const db = loadDB();
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

    db.giveaways.push(newGiveaway);
    saveDB(db);

    return res.status(201).json({
      message: 'Sorteo guardado correctamente',
      giveaway: newGiveaway,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error al guardar sorteo' });
  }
});
// Helper for 100% Apple QuickTime macOS, iPhone iOS Photos, WhatsApp, and Instagram compatible MP4
const convertToUniversalMp4 = async (src: string, dst: string): Promise<boolean> => {
  try {
    await execAsync(
      `ffmpeg -y -i "${src}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -map 0:v:0 -map 1:a:0 -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p -preset fast -crf 22 -r 30 -c:a aac -b:a 128k -ar 44100 -shortest -movflags +faststart "${dst}"`
    );
    return fs.existsSync(dst) && fs.statSync(dst).size > 1000;
  } catch (err: any) {
    try {
      await execAsync(
        `ffmpeg -y -i "${src}" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p -preset fast -crf 22 -r 30 -movflags +faststart "${dst}"`
      );
      return fs.existsSync(dst) && fs.statSync(dst).size > 1000;
    } catch (err2: any) {
      console.warn('ffmpeg conversion warning:', err2.message);
      return false;
    }
  }
};

// Binary raw video upload (lightning fast direct streaming without Base64 memory overhead)
app.post('/api/giveaways/:id/video-binary', express.raw({ type: '*/*', limit: '100mb' }), async (req: any, res) => {
  try {
    const buffer: Buffer = req.body;
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 200) {
      return res.status(400).json({ error: 'Archivo de video inválido o vacío' });
    }

    const mimeType = (req.query.mimeType as string) || 'video/webm';
    const durationSeconds = Number(req.query.durationSeconds) || 12;

    const db = loadDB();
    const giveaway = db.giveaways.find((g) => g.id === req.params.id);
    if (!giveaway) {
      return res.status(404).json({ error: 'Sorteo no encontrado' });
    }

    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const filename = `${giveaway.id}_recording.${ext}`;
    const filePath = path.join(VIDEOS_DIR, filename);

    fs.writeFileSync(filePath, buffer);

    const sizeBytes = buffer.length;
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2) + ' MB';
    const mp4Filename = `${giveaway.id}_recording.mp4`;
    const mp4FilePath = path.join(VIDEOS_DIR, mp4Filename);

    giveaway.video = {
      hasVideo: true,
      videoFileName: filename,
      mp4FileName: mp4Filename,
      videoDurationSeconds: durationSeconds,
      videoSizeFormatted: sizeMB,
      videoMimeType: mimeType,
      recordedAt: new Date().toISOString(),
    };
    saveDB(db);

    if (ext !== 'mp4' && buffer.length >= 1000) {
      convertToUniversalMp4(filePath, mp4FilePath).then((ok) => {
        if (ok) console.log(`Universal MP4 created from binary upload: ${mp4Filename}`);
      });
    }

    return res.json({
      message: 'Video binario guardado correctamente',
      video: giveaway.video,
      videoUrl: `/api/giveaways/${giveaway.id}/video-stream`,
      mp4Url: `/api/giveaways/${giveaway.id}/download-video`,
    });
  } catch (err: any) {
    console.error('Error in video-binary upload:', err);
    return res.status(500).json({ error: 'Error al procesar el archivo de video binario' });
  }
});

app.post('/api/giveaways/:id/video', (req: any, res) => {
  try {
    const { videoBase64, mimeType, durationSeconds } = req.body;
    if (!videoBase64) {
      return res.status(400).json({ error: 'No se recibió archivo de video' });
    }

    const db = loadDB();
    const giveaway = db.giveaways.find((g) => g.id === req.params.id);
    if (!giveaway) {
      return res.status(404).json({ error: 'Sorteo no encontrado' });
    }

    // Determine extension
    const ext = mimeType && mimeType.includes('mp4') ? 'mp4' : 'webm';
    const filename = `${giveaway.id}_recording.${ext}`;
    const filePath = path.join(VIDEOS_DIR, filename);

    // Strip data URI prefix cleanly
    const commaIndex = videoBase64.indexOf(',');
    const base64Data = commaIndex !== -1 ? videoBase64.substring(commaIndex + 1) : videoBase64;
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length < 200) {
      return res.status(400).json({ error: 'Archivo de video inválido o vacío' });
    }

    fs.writeFileSync(filePath, buffer);

    const sizeBytes = buffer.length;
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2) + ' MB';
    const mp4Filename = `${giveaway.id}_recording.mp4`;
    const mp4FilePath = path.join(VIDEOS_DIR, mp4Filename);

    giveaway.video = {
      hasVideo: true,
      videoFileName: filename,
      mp4FileName: mp4Filename,
      videoDurationSeconds: durationSeconds || 12,
      videoSizeFormatted: sizeMB,
      videoMimeType: mimeType || `video/${ext}`,
      recordedAt: new Date().toISOString(),
    };

    saveDB(db);

    // Asynchronous ffmpeg conversion to universal H.264 MP4 if original is WebM and valid
    if (ext !== 'mp4' && buffer.length >= 1000) {
      convertToUniversalMp4(filePath, mp4FilePath).then((ok) => {
        if (ok) console.log(`Video universal MP4 ready: ${mp4Filename}`);
      });
    }

    return res.json({
      message: 'Video guardado correctamente',
      video: giveaway.video,
      videoUrl: `/api/giveaways/${giveaway.id}/video-stream`,
      mp4Url: `/api/giveaways/${giveaway.id}/download-video`,
    });
  } catch (err: any) {
    console.error('Error saving video:', err);
    return res.status(500).json({ error: 'Error al procesar el archivo de video' });
  }
});

// Stream or download video file
app.get('/api/giveaways/:id/video-stream', (req, res) => {
  try {
    const db = loadDB();
    const giveaway = db.giveaways.find((g) => g.id === req.params.id);
    if (!giveaway || !giveaway.video.hasVideo || !giveaway.video.videoFileName) {
      return res.status(404).json({ error: 'Video no disponible para este sorteo' });
    }

    const filePath = path.join(VIDEOS_DIR, giveaway.video.videoFileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'El archivo físico de video no se encuentra en el servidor' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const contentType = giveaway.video.videoMimeType || 'video/webm';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al reproducir o descargar video' });
  }
});

// Dedicated video download endpoint converting to universal MP4 (QuickTime macOS, iOS, Android, Windows, WhatsApp)
app.get(['/api/giveaways/:id/download-video', '/api/giveaways/:id/download-mp4'], async (req, res) => {
  try {
    const db = loadDB();
    const giveaway = db.giveaways.find((g) => g.id === req.params.id);
    if (!giveaway || !giveaway.video?.hasVideo || !giveaway.video?.videoFileName) {
      return res.status(404).json({ error: 'Video no disponible para este sorteo' });
    }

    const mp4Filename = giveaway.video.mp4FileName || `${giveaway.id}_recording.mp4`;
    const mp4Path = path.join(VIDEOS_DIR, mp4Filename);
    const originalPath = path.join(VIDEOS_DIR, giveaway.video.videoFileName);

    // If universal MP4 already exists and is healthy, serve it immediately
    if (fs.existsSync(mp4Path)) {
      const stat = fs.statSync(mp4Path);
      if (stat.size >= 1000) {
        res.writeHead(200, {
          'Content-Length': stat.size,
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="sorteoo_${giveaway.id}.mp4"`,
        });
        return fs.createReadStream(mp4Path).pipe(res);
      }
    }

    // If MP4 does not exist yet, convert on the fly using strict macOS QuickTime & iOS compatible flags
    if (fs.existsSync(originalPath)) {
      const origStat = fs.statSync(originalPath);
      if (origStat.size >= 1000) {
        try {
          await execAsync(
            `ffmpeg -y -i "${originalPath}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -map 0:v:0 -map 1:a:0 -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p -preset fast -crf 22 -r 30 -c:a aac -b:a 128k -ar 44100 -shortest -movflags +faststart "${mp4Path}"`
          );
          if (fs.existsSync(mp4Path)) {
            const stat = fs.statSync(mp4Path);
            res.writeHead(200, {
              'Content-Length': stat.size,
              'Content-Type': 'video/mp4',
              'Content-Disposition': `attachment; filename="sorteoo_${giveaway.id}.mp4"`,
            });
            return fs.createReadStream(mp4Path).pipe(res);
          }
        } catch (cErr: any) {
          // Fallback conversion without lavfi audio
          try {
            await execAsync(
              `ffmpeg -y -i "${originalPath}" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p -preset fast -crf 22 -r 30 -movflags +faststart "${mp4Path}"`
            );
            if (fs.existsSync(mp4Path)) {
              const stat = fs.statSync(mp4Path);
              res.writeHead(200, {
                'Content-Length': stat.size,
                'Content-Type': 'video/mp4',
                'Content-Disposition': `attachment; filename="sorteoo_${giveaway.id}.mp4"`,
              });
              return fs.createReadStream(mp4Path).pipe(res);
            }
          } catch (cErr2: any) {
            console.warn('ffmpeg on-the-fly conversion note:', cErr2.message);
          }
        }
      }

      // Fallback: serve original
      res.writeHead(200, {
        'Content-Length': origStat.size,
        'Content-Type': giveaway.video.videoMimeType || 'video/webm',
        'Content-Disposition': `attachment; filename="sorteoo_${giveaway.id}.${giveaway.video.videoFileName?.endsWith('.mp4') ? 'mp4' : 'webm'}"`,
      });
      return fs.createReadStream(originalPath).pipe(res);
    }

    return res.status(404).json({ error: 'Archivo de video no encontrado en el servidor' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al procesar descarga de MP4' });
  }
});

// Delete giveaway
app.delete('/api/giveaways/:id', authenticateToken, (req: any, res) => {
  const db = loadDB();
  const index = db.giveaways.findIndex((g) => g.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Sorteo no encontrado' });
  }
  if (db.giveaways[index].userId !== req.user.id) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  // Remove video file if exists
  if (db.giveaways[index].video?.videoFileName) {
    const vPath = path.join(VIDEOS_DIR, db.giveaways[index].video.videoFileName!);
    if (fs.existsSync(vPath)) {
      try {
        fs.unlinkSync(vPath);
      } catch (e) {
        // ignore
      }
    }
  }

  db.giveaways.splice(index, 1);
  saveDB(db);
  return res.json({ message: 'Sorteo eliminado' });
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
app.post('/api/webhooks/instagram', (req, res) => {
  try {
    const body = req.body;
    if (body.object === 'instagram' || body.entry) {
      const db = loadDB();
      if (!db.stories) db.stories = [];

      let capturedCount = 0;
      for (const entry of body.entry || []) {
        for (const messagingEvent of entry.messaging || []) {
          const sender = messagingEvent.sender;
          const senderId = sender?.id || `user_${Date.now()}`;
          const message = messagingEvent.message;
          if (!message || !message.text) continue;

          const text = String(message.text).trim();
          // Filter strictly: normalized text must match "PARTICIPO"
          const cleanNormalized = text.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '');
          const isValidParticipo = cleanNormalized === 'PARTICIPO';

          // Link to story if referral exists, otherwise to first active registered story
          const storyRefId = message.reply_to?.story?.id || messagingEvent.postback?.referral?.story_id;
          let targetStory = storyRefId ? db.stories.find((s) => s.id === storyRefId) : db.stories[0];

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
            targetStory.replies.push(replyObj);
            targetStory.repliesCount = targetStory.replies.filter((r) => r.isValidParticipo).length;
            capturedCount++;
          }
        }
      }
      saveDB(db);
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
app.get('/api/multibrand/stories', (_req, res) => {
  const db = loadDB();
  const stories = (db.stories || []).map((s) => ({
    ...s,
    repliesCount: s.replies ? s.replies.filter((r) => r.isValidParticipo).length : 0,
    totalRawReplies: s.replies ? s.replies.length : 0,
  }));
  return res.json({ stories });
});

// Register or import a new Story to the persistent registry
app.post('/api/multibrand/stories', (req, res) => {
  try {
    const { brandName, prize, username, mediaUrl, publishedAt } = req.body;
    if (!brandName) {
      return res.status(400).json({ error: 'El nombre de la marca es obligatorio' });
    }

    const db = loadDB();
    if (!db.stories) db.stories = [];

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

    db.stories.unshift(newStory);
    saveDB(db);

    return res.status(201).json({
      message: 'Historia registrada con éxito en el archivo persistente',
      story: newStory,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error al registrar historia' });
  }
});

// Update story
app.put('/api/multibrand/stories/:id', (req, res) => {
  try {
    const { brandName, prize, isArchived } = req.body;
    const db = loadDB();
    const story = (db.stories || []).find((s) => s.id === req.params.id);
    if (!story) {
      return res.status(404).json({ error: 'Historia no encontrada en el registro' });
    }

    if (brandName) story.brandName = brandName.trim();
    if (prize !== undefined) story.prize = prize.trim();
    if (isArchived !== undefined) story.isArchived = Boolean(isArchived);

    saveDB(db);
    return res.json({ message: 'Historia actualizada', story });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al actualizar historia' });
  }
});

// Delete story
app.delete('/api/multibrand/stories/:id', (req, res) => {
  try {
    const db = loadDB();
    if (!db.stories) db.stories = [];
    const idx = db.stories.findIndex((s) => s.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Historia no encontrada' });
    }
    db.stories.splice(idx, 1);
    saveDB(db);
    return res.json({ message: 'Historia eliminada del registro' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al eliminar historia' });
  }
});

// Add manual/test reply to a story (tests PARTICIPO filter live)
app.post('/api/multibrand/stories/:id/reply', (req, res) => {
  try {
    const { username, text } = req.body;
    if (!username || !text) {
      return res.status(400).json({ error: 'Ingresa usuario y mensaje' });
    }

    const cleanUser = username.trim().replace(/^@/, '');
    const cleanText = text.trim();
    const cleanNormalized = cleanText.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '');
    const isValidParticipo = cleanNormalized === 'PARTICIPO';

    const db = loadDB();
    const story = (db.stories || []).find((s) => s.id === req.params.id);
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

    story.replies.push(replyObj);
    story.repliesCount = story.replies.filter((r) => r.isValidParticipo).length;
    saveDB(db);

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

      // Gather comments for this post
      let postComments: Participant[] = [];

      try {
        // Attempt SocialData fetch
        const commentsRes = await fetchSocialData('/v1/comments', { code_or_id_or_url: shortcode });
        const items = commentsRes?.data?.items || commentsRes?.data || [];
        if (Array.isArray(items) && items.length > 0) {
          for (const item of items) {
            const rawUser = item.user?.username || '';
            const cleanUser = rawUser.trim().replace(/^@/, '');
            if (!cleanUser) continue;
            postComments.push({
              username: cleanUser,
              comment: item.text || item.comment || '',
              avatarUrl: item.user?.profile_pic_url
                ? `/api/instagram/image-proxy?url=${encodeURIComponent(item.user.profile_pic_url)}`
                : `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanUser)}`,
              timestamp: item.created_at ? new Date(item.created_at * 1000).toISOString() : new Date().toISOString(),
            });
          }
        }
      } catch (err: any) {
        console.warn(`Could not fetch SocialData for post ${shortcode}:`, err.message);
      }

      // If post has no external comments, generate a consistent set from sample pool for sandbox testing
      if (postComments.length === 0) {
        const poolStart = (pIdx * 7) % DEMO_NAMES.length;
        const count = 18 + (pIdx % 3) * 5;
        for (let i = 0; i < count; i++) {
          const uName = DEMO_NAMES[(poolStart + i) % DEMO_NAMES.length];
          const template = DEMO_COMMENTS_TEMPLATES[(i + pIdx) % DEMO_COMMENTS_TEMPLATES.length];
          postComments.push({
            username: uName,
            comment: template.replace(/@friend\d/g, `@${profileUsername || 'marca'}`),
            avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${uName}`,
            timestamp: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
          });
        }
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
app.post('/api/multibrand/unify-stories', (req, res) => {
  try {
    const { storyIds, giveawayTitle } = req.body;
    if (!Array.isArray(storyIds) || storyIds.length === 0) {
      return res.status(400).json({ error: 'Debes seleccionar al menos una historia de marca' });
    }

    const db = loadDB();
    const stories = (db.stories || []).filter((s) => storyIds.includes(s.id));

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

      // Filter only valid replies matching "PARTICIPO"
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
app.get('/api/multibrand/meta-status', (_req, res) => {
  const db = loadDB();
  return res.json({
    webhookConfigured: true,
    webhookEndpoint: '/api/webhooks/instagram',
    verifyToken: process.env.META_VERIFY_TOKEN || 'sorteoo_webhook_token_2026',
    totalStoriesInRegistry: db.stories?.length || 0,
    acceptedKeywords: ['PARTICIPO', 'participo', 'Participo'],
    ruleDescription: 'Unificación estricta: 1 participación por persona única.',
  });
});

// ----------------------------------------------------
// VITE SETUP (Full-stack integration)
// ----------------------------------------------------
async function startServer() {
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
