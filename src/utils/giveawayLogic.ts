import { Participant, GiveawayFilters, GiveawayAudit } from '../types/giveaway';

export interface FilterResult {
  validParticipants: Participant[];
  excludedCount: number;
  reasons: {
    duplicateUser: number;
    insufficientMentions: number;
    missingKeyword: number;
    blacklist: number;
  };
}

export function filterParticipants(
  rawParticipants: Participant[],
  filters: GiveawayFilters
): FilterResult {
  const reasons = {
    duplicateUser: 0,
    insufficientMentions: 0,
    missingKeyword: 0,
    blacklist: 0,
  };

  const seenUsers = new Set<string>();
  const excludedLower = new Set(filters.excludedUsers.map((u) => u.trim().toLowerCase().replace('@', '')));
  const requiredKeywordLower = filters.requiredKeyword.trim().toLowerCase();

  const validParticipants: Participant[] = [];

  for (const p of rawParticipants) {
    const cleanUser = p.username.trim().toLowerCase().replace('@', '');

    // 1. Blacklist check
    if (excludedLower.has(cleanUser)) {
      reasons.blacklist++;
      continue;
    }

    // 2. Duplicate user check
    if (filters.removeDuplicateUsers) {
      if (seenUsers.has(cleanUser)) {
        reasons.duplicateUser++;
        continue;
      }
      seenUsers.add(cleanUser);
    }

    // 3. Mentions count check
    // Count @ mentions in text or array
    const mentionsInText = (p.comment.match(/@[A-Za-z0-9_.]+/g) || []).length;
    const mentionsCount = Math.max(p.mentions?.length || 0, mentionsInText);
    if (filters.minMentions > 0 && mentionsCount < filters.minMentions) {
      reasons.insufficientMentions++;
      continue;
    }

    // 4. Keyword check
    if (requiredKeywordLower && !p.comment.toLowerCase().includes(requiredKeywordLower)) {
      reasons.missingKeyword++;
      continue;
    }

    validParticipants.push(p);
  }

  const excludedCount = rawParticipants.length - validParticipants.length;

  return {
    validParticipants,
    excludedCount,
    reasons,
  };
}

// Cryptographically secure random integer between 0 and max (exclusive)
function secureRandomInt(max: number): number {
  if (max <= 0) return 0;
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  return array[0] % max;
}

// Compute SHA-256 for audit integrity
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface DrawResult {
  winners: Participant[];
  substitutes: Participant[];
  audit: GiveawayAudit;
}

export async function executeDraw(
  participants: Participant[],
  winnersCount: number,
  substitutesCount: number,
  brandsConfig?: Array<{ brandInstagram: string; prize: string }>
): Promise<DrawResult> {
  if (participants.length === 0) {
    throw new Error('No hay participantes válidos para sortear');
  }

  // Count unique individuals in the pool
  const uniqueUsers = new Set(participants.map((p) => p.username.trim().toLowerCase().replace('@', '')));
  const totalRequired = winnersCount + substitutesCount;
  if (uniqueUsers.size < totalRequired) {
    throw new Error(
      `Participantes únicos insuficientes (${uniqueUsers.size}). Se necesitan al menos ${totalRequired} personas distintas (${winnersCount} ganadores + ${substitutesCount} suplentes). Cada persona solo puede ganar una vez.`
    );
  }

  // Work on a mutable copy of pool
  let pool = [...participants];
  const selected: Participant[] = [];
  const chosenUsernames = new Set<string>();

  for (let i = 0; i < totalRequired; i++) {
    if (pool.length === 0) break;
    const randomIndex = secureRandomInt(pool.length);
    const chosen = pool[randomIndex];
    selected.push(chosen);

    const chosenKey = chosen.username.trim().toLowerCase().replace('@', '');
    chosenUsernames.add(chosenKey);

    // CRITICAL: Eliminate ALL entries/comments belonging to this person so they CANNOT win again or be selected twice!
    pool = pool.filter((p) => p.username.trim().toLowerCase().replace('@', '') !== chosenKey);
  }

  // For Multimarcas: each winner is assigned to 1 participating brand & prize!
  const winners = selected.slice(0, winnersCount).map((w, idx) => {
    if (brandsConfig && brandsConfig[idx]) {
      return {
        ...w,
        assignedBrand: brandsConfig[idx].brandInstagram,
        assignedPrize: brandsConfig[idx].prize,
      };
    }
    return w;
  });

  const substitutes = selected.slice(winnersCount, winnersCount + substitutesCount);

  // Generate audit cryptographic receipt
  const drawnAt = new Date().toISOString();
  const seed = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const verificationCode = `SRT-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;

  const auditPayload = JSON.stringify({
    seed,
    drawnAt,
    verificationCode,
    poolSize: participants.length,
    winners: winners.map((w) => w.username),
    substitutes: substitutes.map((s) => s.username),
  });

  const sha256Hash = await sha256(auditPayload);

  return {
    winners,
    substitutes,
    audit: {
      seed,
      verificationCode,
      drawnAt,
      sha256Hash,
    },
  };
}
