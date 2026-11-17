import {
  AdminPaymentSettings,
  Coupon,
  CouponValidationResult,
  Giveaway,
  PaymentConfigPublic,
  PaymentOrder,
  User,
} from '../types/giveaway';

const TOKEN_KEY = 'sorteoo_auth_token';

export const api = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  removeToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  async request(endpoint: string, options: RequestInit = {}) {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Error ${response.status}: ${response.statusText}`);
    }

    return data;
  },

  // Auth endpoints
  async register(name: string, email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    this.setToken(res.token);
    return res;
  },

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    return res;
  },

  async getMe(): Promise<{ user: User }> {
    return this.request('/api/auth/me');
  },

  async updateProfile(updates: { name?: string; avatar?: string; instagramConfig?: any }): Promise<{ user: User }> {
    return this.request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async forgotPassword(email: string): Promise<{ message: string; resetToken?: string }> {
    return this.request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(resetToken: string, newPassword: string): Promise<{ message: string }> {
    return this.request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ resetToken, newPassword }),
    });
  },

  logout() {
    this.removeToken();
  },

  // Instagram Profile Wall / Post Feed
  async getInstagramProfileFeed(
    username: string,
    paginationToken?: string
  ): Promise<{ success?: boolean; isPrivate?: boolean; message?: string; profile: any }> {
    return this.request('/api/instagram/profile-feed', {
      method: 'POST',
      body: JSON.stringify({ username, paginationToken }),
    });
  },

  // Silent background prefetch when user previews an Instagram post
  async prefetchInstagramComments(
    postUrl: string,
    author?: string,
    caption?: string,
    commentsCount?: number
  ) {
    try {
      await fetch('/api/instagram/prefetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postUrl, author, caption, commentsCount }),
      });
    } catch {
      // Best-effort prefetch
    }
  },

  // Progressive Instagram Post Parser with real-time percentage polling
  async parseInstagramPostWithProgress(
    postUrl: string,
    options: {
      author?: string;
      caption?: string;
      commentsCount?: number;
      rawCommentsText?: string;
      participants?: any[];
      forceRefresh?: boolean;
      onProgress?: (progress: {
        percent: number;
        loadedCount: number;
        totalEstimated: number;
        pagesFetched: number;
      }) => void;
    } = {}
  ) {
    const {
      author,
      caption,
      commentsCount,
      rawCommentsText,
      participants,
      forceRefresh = false,
      onProgress,
    } = options;

    const startRes = await this.request('/api/instagram/parse-start', {
      method: 'POST',
      body: JSON.stringify({
        postUrl,
        author,
        caption,
        commentsCount,
        rawCommentsText,
        participants,
        forceRefresh,
      }),
    });

    if (onProgress) {
      onProgress({
        percent: typeof startRes.percent === 'number' ? startRes.percent : startRes.status === 'done' ? 100 : 5,
        loadedCount: startRes.loadedCount || 0,
        totalEstimated: startRes.totalEstimated || commentsCount || 0,
        pagesFetched: startRes.pagesFetched || 0,
      });
    }

    if (startRes.status === 'done') {
      return startRes;
    }

    const jobId = startRes.jobId;
    const pollStartedAt = Date.now();
    const MAX_POLL_MS = 260000;

    while (Date.now() - pollStartedAt < MAX_POLL_MS) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const statusRes = await this.request(`/api/instagram/parse-status/${encodeURIComponent(jobId)}`);
      if (onProgress) {
        onProgress({
          percent: typeof statusRes.percent === 'number' ? statusRes.percent : 10,
          loadedCount: statusRes.loadedCount || 0,
          totalEstimated: statusRes.totalEstimated || commentsCount || 0,
          pagesFetched: statusRes.pagesFetched || 0,
        });
      }
      if (statusRes.status === 'done') {
        return statusRes;
      }
    }

    throw new Error('La carga de comentarios tardó demasiado. Intenta nuevamente.');
  },

  // Instagram Post Parser (backwards-compatible wrapper)
  async parseInstagramPost(
    postUrl: string,
    author?: string,
    caption?: string,
    commentsCount?: number,
    rawCommentsText?: string,
    participants?: any[]
  ) {
    return this.parseInstagramPostWithProgress(postUrl, {
      author,
      caption,
      commentsCount,
      rawCommentsText,
      participants,
    });
  },

  // Giveaways
  async getGiveaways(): Promise<{ giveaways: Giveaway[] }> {
    return this.request('/api/giveaways');
  },

  async getGiveawaysByIds(ids: string[]): Promise<{ giveaways: Giveaway[] }> {
    return this.request('/api/giveaways/by-ids', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },

  async claimGuestGiveaways(ids: string[]): Promise<{ claimedCount: number }> {
    return this.request('/api/giveaways/claim', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },

  saveLocalGiveawaySnapshot(giveaway: Giveaway) {
    try {
      if (typeof localStorage === 'undefined' || !giveaway?.id) return;
      const existing = this.getLocalGiveawaySnapshots();
      const merged = [giveaway, ...existing.filter((g) => g.id !== giveaway.id)].slice(0, 30);
      localStorage.setItem('sorteoo_recent_giveaways', JSON.stringify(merged));
    } catch {
      // Ignore storage quota errors
    }
  },

  getLocalGiveawaySnapshots(): Giveaway[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem('sorteoo_recent_giveaways');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((g) => g && g.id) : [];
    } catch {
      return [];
    }
  },

  removeLocalGiveawaySnapshot(id: string) {
    try {
      if (typeof localStorage === 'undefined') return;
      const existing = this.getLocalGiveawaySnapshots();
      localStorage.setItem(
        'sorteoo_recent_giveaways',
        JSON.stringify(existing.filter((g) => g.id !== id))
      );
    } catch {
      // ignore
    }
  },

  async getGiveawayById(id: string): Promise<{ giveaway: Giveaway }> {
    return this.request(`/api/giveaways/${id}`);
  },

  async createGiveaway(giveawayData: Partial<Giveaway>): Promise<{ giveaway: Giveaway }> {
    return this.request('/api/giveaways', {
      method: 'POST',
      body: JSON.stringify(giveawayData),
    });
  },

  async uploadGiveawayVideo(
    giveawayId: string,
    videoBase64: string,
    mimeType: string,
    durationSeconds: number
  ) {
    return this.request(`/api/giveaways/${giveawayId}/video`, {
      method: 'POST',
      body: JSON.stringify({ videoBase64, mimeType, durationSeconds }),
    });
  },

  async uploadGiveawayVideoBinary(
    giveawayId: string,
    videoBlob: Blob,
    mimeType: string,
    durationSeconds: number
  ) {
    const CHUNK_SIZE = 3 * 1024 * 1024; // 3 MB chunks safely stay far below 32 MB proxy limits
    if (videoBlob.size > 2.5 * 1024 * 1024) {
      const totalChunks = Math.ceil(videoBlob.size / CHUNK_SIZE);
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(videoBlob.size, start + CHUNK_SIZE);
        const chunk = videoBlob.slice(start, end);
        const chunkQuery = new URLSearchParams({
          chunkIndex: String(i),
          totalChunks: String(totalChunks),
          mimeType: mimeType || 'video/webm',
        }).toString();
        const chunkRes = await fetch(`/api/giveaways/${giveawayId}/video-chunk?${chunkQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: chunk,
        });
        if (!chunkRes.ok) {
          throw new Error(`Error al subir fragmento ${i + 1}/${totalChunks}: HTTP ${chunkRes.status}`);
        }
      }
      return this.request(`/api/giveaways/${giveawayId}/video-finalize`, {
        method: 'POST',
        body: JSON.stringify({
          totalChunks,
          mimeType: mimeType || 'video/webm',
          durationSeconds: durationSeconds || 12,
        }),
      });
    }

    const query = new URLSearchParams({
      mimeType: mimeType || 'video/webm',
      durationSeconds: String(durationSeconds || 12),
    }).toString();
    const res = await fetch(`/api/giveaways/${giveawayId}/video-binary?${query}`, {
      method: 'POST',
      headers: {
        'Content-Type': mimeType || 'application/octet-stream',
      },
      body: videoBlob,
    });
    if (!res.ok) {
      throw new Error(`Error al subir video binario: HTTP ${res.status}`);
    }
    return res.json();
  },

  async deleteGiveaway(id: string) {
    return this.request(`/api/giveaways/${id}`, {
      method: 'DELETE',
    });
  },

  // Multibrand API
  async getMultibrandStories(): Promise<{ stories: import('../types/giveaway').MultibrandStory[] }> {
    return this.request('/api/multibrand/stories');
  },

  async createMultibrandStory(storyData: {
    brandName: string;
    prize?: string;
    username?: string;
    mediaUrl?: string;
  }): Promise<{ message: string; story: import('../types/giveaway').MultibrandStory }> {
    return this.request('/api/multibrand/stories', {
      method: 'POST',
      body: JSON.stringify(storyData),
    });
  },

  async updateMultibrandStory(id: string, updates: { brandName?: string; prize?: string; isArchived?: boolean }) {
    return this.request(`/api/multibrand/stories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteMultibrandStory(id: string) {
    return this.request(`/api/multibrand/stories/${id}`, {
      method: 'DELETE',
    });
  },

  async addMultibrandStoryReply(storyId: string, username: string, text: string) {
    return this.request(`/api/multibrand/stories/${storyId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ username, text }),
    });
  },

  async unifyMultibrandPosts(
    postUrls: string[],
    giveawayTitle?: string,
    profileUsername?: string
  ): Promise<import('../types/giveaway').MultibrandUnifySummary> {
    return this.request('/api/multibrand/unify-posts', {
      method: 'POST',
      body: JSON.stringify({ postUrls, giveawayTitle, profileUsername }),
    });
  },

  async unifyMultibrandStories(
    storyIds: string[],
    giveawayTitle?: string
  ): Promise<import('../types/giveaway').MultibrandUnifySummary> {
    return this.request('/api/multibrand/unify-stories', {
      method: 'POST',
      body: JSON.stringify({ storyIds, giveawayTitle }),
    });
  },

  async getMetaWebhookStatus() {
    return this.request('/api/multibrand/meta-status');
  },

  // Public Verify
  async verifyCode(code: string) {
    const res = await fetch(`/api/verify/${encodeURIComponent(code)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Código no válido');
    }
    return data;
  },

  // Payments & Coupons (Checkout)
  async getPaymentConfig(): Promise<PaymentConfigPublic> {
    return this.request('/api/payments/config');
  },

  async validateCoupon(code: string): Promise<CouponValidationResult> {
    return this.request('/api/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async redeemFreeCoupon(
    code: string,
    giveawaySummary?: string
  ): Promise<{ approved: boolean; order: PaymentOrder; couponCode: string; discountPercent: number }> {
    return this.request('/api/coupons/redeem-free', {
      method: 'POST',
      body: JSON.stringify({ code, giveawaySummary }),
    });
  },

  async createMercadoPagoPreference(payload: {
    couponCode?: string;
    returnUrl: string;
    giveawaySummary?: string;
    drawConfig?: any;
  }): Promise<{
    externalReference: string;
    preferenceId: string;
    initPoint: string;
    finalAmount: number;
    discountPercent: number;
  }> {
    return this.request('/api/payments/create-preference', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getPaymentStatus(
    externalReference: string,
    paymentId?: string
  ): Promise<{
    approved: boolean;
    status: string;
    order: PaymentOrder;
    drawConfig?: any;
  }> {
    const q = paymentId ? `?paymentId=${encodeURIComponent(paymentId)}` : '';
    return this.request(`/api/payments/status/${encodeURIComponent(externalReference)}${q}`);
  },

  // Admin Panel Endpoints
  async getAdminSettings(): Promise<AdminPaymentSettings> {
    return this.request('/api/admin/settings');
  },

  async updateAdminSettings(payload: {
    mpAccessToken?: string;
    mpPublicKey?: string;
    giveawayPrice?: number;
    clearToken?: boolean;
  }): Promise<{ message: string; settings: AdminPaymentSettings }> {
    return this.request('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async getAdminCoupons(): Promise<{ coupons: Coupon[] }> {
    return this.request('/api/admin/coupons');
  },

  async createAdminCoupon(payload: {
    code: string;
    discountPercent: number;
    maxUses: number;
    description?: string;
  }): Promise<{ message: string; coupon: Coupon }> {
    return this.request('/api/admin/coupons', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateAdminCoupon(
    id: string,
    updates: { active?: boolean; discountPercent?: number; maxUses?: number; description?: string }
  ): Promise<{ message: string; coupon: Coupon }> {
    return this.request(`/api/admin/coupons/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async deleteAdminCoupon(id: string): Promise<{ message: string }> {
    return this.request(`/api/admin/coupons/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async getAdminPayments(): Promise<{ payments: PaymentOrder[] }> {
    return this.request('/api/admin/payments');
  },
};

