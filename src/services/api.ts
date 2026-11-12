import { Giveaway, Participant, User } from '../types/giveaway';

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
  async getInstagramProfileFeed(username: string, paginationToken?: string): Promise<{ profile: any }> {
    return this.request('/api/instagram/profile-feed', {
      method: 'POST',
      body: JSON.stringify({ username, paginationToken }),
    });
  },

  // Instagram Post Parser
  async parseInstagramPost(
    postUrl: string,
    useDemoComments: boolean = false,
    author?: string,
    caption?: string,
    commentsCount?: number,
    rawCommentsText?: string,
    participants?: any[]
  ) {
    return this.request('/api/instagram/parse', {
      method: 'POST',
      body: JSON.stringify({
        postUrl,
        useDemoComments,
        author,
        caption,
        commentsCount,
        rawCommentsText,
        participants,
      }),
    });
  },

  // Giveaways
  async getGiveaways(): Promise<{ giveaways: Giveaway[] }> {
    return this.request('/api/giveaways');
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
};

