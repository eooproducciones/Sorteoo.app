export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  createdAt: string;
  instagramConfig?: {
    appId?: string;
    accessToken?: string;
    sessionId?: string;
    isConnected?: boolean;
  };
}

export interface MultibrandBrandConfig {
  id: string;
  brandInstagram: string;
  prize: string;
}

export interface Participant {
  username: string;
  comment: string;
  avatarUrl?: string;
  timestamp?: string;
  mentions?: string[];
  assignedBrand?: string;
  assignedPrize?: string;
}

export interface PostDetails {
  shortcode: string;
  author: string;
  likes: number;
  commentsCount: number;
  caption: string;
  imageUrl?: string;
  sourceType?: 'instagram' | 'numbers' | 'csv' | 'list';
  authorAvatarUrl?: string;
  customLogoUrl?: string;
  multibrandBrandsConfig?: MultibrandBrandConfig[];
  multibrandMeta?: any;
}

export interface GiveawayFilters {
  minMentions: number;
  removeDuplicateUsers: boolean;
  requiredKeyword: string;
  excludedUsers: string[];
}

export interface GiveawayAudit {
  seed: string;
  verificationCode: string;
  drawnAt: string;
  sha256Hash: string;
}

export interface GiveawayVideoMeta {
  hasVideo: boolean;
  videoFileName?: string;
  mp4FileName?: string;
  videoDurationSeconds?: number;
  videoSizeFormatted?: string;
  videoMimeType?: string;
  recordedAt?: string;
}

export interface InstagramProfilePost {
  shortcode: string;
  postUrl: string;
  caption: string;
  imageUrl: string;
  likes: number;
  commentsCount: number;
  date: string;
  isGiveaway?: boolean;
  isVideo?: boolean;
}

export interface InstagramProfile {
  username: string;
  name: string;
  avatar: string;
  bio: string;
  followersCount: number;
  postsCount: number;
  isPrivate?: boolean;
  requiresLogin?: boolean;
  posts: InstagramProfilePost[];
  paginationToken?: string | null;
}

export interface Giveaway {
  id: string;
  userId: string;
  postUrl: string;
  postDetails: PostDetails;
  status: 'completed' | 'draft';
  createdAt: string;
  totalParticipantsDetected: number;
  validParticipantsCount: number;
  filtersApplied: GiveawayFilters;
  winnersCount: number;
  substitutesCount: number;
  winners: Participant[];
  substitutes: Participant[];
  audit: GiveawayAudit;
  video: GiveawayVideoMeta;
  multibrandMeta?: {
    isMultibrand: boolean;
    mode?: 'posts' | 'stories' | 'carousel';
    brandsConfig?: MultibrandBrandConfig[];
    selectedContentsCount?: number;
    totalRawInteractions?: number;
    brands?: string[];
  };
}

export interface MultibrandStoryReply {
  id: string;
  storyId: string;
  messageId: string;
  userId: string; // Stable Instagram sender ID
  username: string;
  text: string;
  timestamp: string;
  isValidParticipo: boolean;
}

export interface MultibrandStory {
  id: string;
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

export interface MultibrandParticipant extends Participant {
  userId?: string;
  interactionsCount: number;
  contentSources: Array<{
    type: 'post' | 'story';
    title: string;
    brandName?: string;
    date?: string;
    details?: string;
  }>;
}

export interface MultibrandUnifySummary {
  giveawayName: string;
  mode: 'posts' | 'stories';
  selectedContentsCount: number;
  totalInteractionsReceived: number;
  uniqueParticipantsCount: number;
  duplicatesDiscardedCount: number;
  participants: MultibrandParticipant[];
}

