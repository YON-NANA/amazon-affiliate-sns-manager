export type CategoryId = 
  | 'life_general' 
  | 'kitchen' 
  | 'cleaning' 
  | 'laundry' 
  | 'interior'
  | 'pet_cat' 
  | 'pet_dog' 
  | 'pet_care' 
  | 'pet_toy'
  | 'pet_travel'        // ペットと泊まれる宿・ホテル（楽天トラベル）
  | 'disaster_prep'     // 防災・ポータブル電源・ソーラーパネル
  | 'water_purifier'    // 携帯浄水器・ペット配慮長期保存水（軟水）
  | 'rescue_supplies'   // 多頭保護現場厳選ヘビーユース消耗品（シーツ・消臭等）
  | 'camp_gear';        // キャンプ・アウトドア（設営時短・防寒/快適ギア）

export interface CategoryInfo {
  id: CategoryId;
  name: string;
  icon: string;
  genre: 'life' | 'pet';
  description: string;
  popularKeywords: string[];
}

export type PlatformId = 'x' | 'threads' | 'both';

export type ToneId = 
  | 'problem_solving' // 悩み解決・ビフォーアフター
  | 'honest_review'   // リアル愛用者レビュー
  | 'deal_sale'       // セール・コスパ訴求
  | 'empathy_story'   // 共感・日常ストーリー
  | 'tips_ranking'    // プロ・裏技・ランキング
  | 'no_link_tips';   // アカバン防止用: リンク無しの純粋なお役立ち・共感知恵袋

export type PostStatus = 
  | 'draft'       // 下書き・生成直後
  | 'pending'     // 承認待ち・レビュー中
  | 'scheduled'   // 予約済み
  | 'published'   // 投稿完了
  | 'archived';   // アーカイブ

export interface Post {
  id: string;
  title: string;
  asin: string;
  amazon_url: string;
  affiliate_url: string;
  room_url?: string; // 楽天ROOMの紹介URL（コレクション/商品）
  affiliate_provider?: 'amazon' | 'rakuten' | 'room' | 'amazon_storefront'; // アフィリエイト誘導種別
  category: CategoryId;
  target_audience: string;
  platform: PlatformId;
  tone: ToneId;
  content: string;
  key_benefits: string[];
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  tags: string[];
  metrics: {
    clicks: number;
    shares?: number;
    likes?: number;
  };
  notes?: string;
  is_no_link?: boolean; // アカバン防止用のリンクなし共感ポストフラグ
  reply_content?: string; // パターンB（ノウハウ・ギブ型）時のぶら下げリプライ本文
  tweet_id?: string;   // X API投稿成功時のツイートID
  reply_tweet_id?: string; // X APIリプライ成功時のツイートID
  threads_id?: string; // Threads投稿成功時の投稿ID
  reply_threads_id?: string; // Threadsリプライ成功時の投稿ID
  is_user_curated?: boolean; // ユーザーが手動編集・承認したAI学習用お手本ポスト
  created_at: string;
  updated_at: string;
}

// カテゴリー別の楽天ROOMコレクションURL
export interface CategoryRoomUrls {
  pet?: string;
  camp?: string;
  disaster?: string;
  travel?: string;
  general?: string;
}

// カテゴリー別のAmazonストアフロント/アイデアリストURL
export interface CategoryStorefrontUrls {
  pet?: string;
  camp?: string;
  disaster?: string;
  travel?: string;
  general?: string;
}

// 楽天APIや検索AIから取得するリサーチ商品モデル
export interface ResearchProduct {
  itemId: string;
  title: string;
  price: number;
  reviewAverage: number;
  reviewCount: number;
  itemUrl: string;
  affiliateUrl?: string;
  roomUrl?: string;
  imageUrl: string;
  shopName: string;
  caption?: string;
  category: CategoryId;
  genre: 'pet' | 'camp' | 'disaster' | 'travel' | 'life';
  pointRate?: number;
  postageFlag?: number; // 0: 送料別, 1: 送料無料
}

// リサーチ用ニーズ・キーワードプリセット
export interface ResearchPreset {
  id: string;
  name: string;
  keyword: string;
  genre: 'pet' | 'camp' | 'disaster' | 'travel' | 'life';
  description: string;
  badgeText?: string;
  suggestedAngle?: string;
}

export interface GeneratedVariation {
  id: string;
  tone: ToneId;
  toneName: string;
  content: string;
  replyContent?: string; // パターンB（ノウハウ・ギブ型）用のリプライ本文
  headline: string;
  characterCount: number;
  tags: string[];
  featuresUsed: string[];
  isNoLink?: boolean;
}

export interface ProductPreset {
  asin: string;
  title: string;
  category: CategoryId;
  genre: 'life' | 'pet';
  targetAudience: string;
  benefits: string[];
  priceRange?: string;
  suggestedTones: ToneId[];
}

// ユーザーが登録・ストックしたマイ商品
export interface CustomProduct {
  id: string;
  asin: string;
  title: string;
  category: CategoryId;
  genre: 'life' | 'pet';
  amazon_url: string;
  affiliate_url: string;
  default_benefits: string[];
  price_hint?: string;
  tags?: string[];
  notes?: string;
  created_at: string;
}

// 今日のトレンド・企画案
export interface DailyTrendIdea {
  id: string;
  seasonContext: string; // 例: 10月換毛期、秋の行楽シーズン、冬支度
  genre: 'life' | 'pet';
  category: CategoryId;
  suggestedKeyword: string; // 例: 猫 抜け毛 ブラシ
  themeTitle: string; // 例: 【秋の換毛期対策】ソファの毛玉地獄から脱出する神ブラシ特集
  targetAudience: string; // 例: 毎日のコロコロ掃除に疲れた猫・犬飼い
  angle: string; // 訴求切り口
  sampleSearchUrl: string; // Amazon検索URL
}

// 生活リズムに合わせた配信時間帯
export type TimeSlot = 'morning' | 'noon' | 'night';

// 自動化パイプラインの動作モード
export type PipelineMode = 'harvest' | 'nurture'; // harvest: 刈り取り, nurture: 育成

// 高単価商品選定アルゴリズム用の候補モデル
export interface CandidateProduct {
  name: string;
  asin: string;
  price: number; // 推定価格（円）
  rating: number; // レビュー評価星 (1.0〜5.0)
  reviewCount?: number;
  benefits: string[];
  category: CategoryId;
  targetAudience: string;
  reason?: string;
}

// ==========================================
// 2026-11-06 改訂版：計画型・セット制 投稿ルール用モデル
// ==========================================

export type PostSetTag = '暮らし・共感' | '宿紹介' | 'その他';

export type PostSetStatus = 'unused' | 'used';

export interface PostSet {
  id: string;
  title?: string; // 管理用メモ（任意）
  mediaFilename: string; // public/media-stock/ 内のファイル名（写真または動画）
  mediaType: 'image' | 'video';
  mediaUrl?: string; // 表示・配信用URL
  textThreads: string; // Threads用投稿文
  textX: string; // X用投稿文（Threadsと同じ場合は同文面）
  tag: PostSetTag; // 分類タグ（暮らし・共感／宿紹介／その他）
  status: PostSetStatus; // 状態（unused: 未使用 ／ used: 使用済み）
  publishedAt: string | null; // 投稿日時（未使用時は null）
  // 宿紹介時の必須確認項目
  isPetConditionVerified?: boolean; // ペット同伴条件を1軒ずつ確認済みか
  reviewSourceCitation?: string; // 「泊まった人の声」の出典メモ
  // 例外的にアフィリエイトリンクを含む場合（先頭に「PR」明記必須）
  hasExceptionAffiliateLink?: boolean;
  // 配信結果ログ
  xPostId?: string;
  xPostUrl?: string;
  threadsPostId?: string;
  threadsPostUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileHpSettings {
  hpUrl: string; // HPのURL（未定時は仮置き、確定後に差し替え）
  isHpUrlConfirmed: boolean;
  profileBioThreads: string;
  profileBioX: string;
  updatedAt: string;
}

// 自動パイプラインの1回ごとの実行ログ・結果
export interface AutomatedExecutionResult {
  id: string;
  executedAt: string;
  skipped?: boolean; // 未使用セットが無い日にスキップされた場合 true
  skipReason?: string;
  usedSet?: PostSet; // 投稿に使用されたセット
  remainingUnusedCount?: number; // 残りの未使用セット在庫数
  timeSlot?: TimeSlot;
  mode: PipelineMode;
  modeReason: string;
  topicTitle: string;
  genre: 'life' | 'pet';
  content: string;
  contentThreads?: string;
  replyText?: string; // ※改訂ルールによりリプライは使用しない（互換性のため型のみ維持）
  catalogUrls?: {
    amazonStorefront?: string;
    rakutenRoom?: string;
    affiliateUrl?: string;
  };
  isNoLink: boolean;
  selectedProduct?: CandidateProduct;
  affiliateUrl?: string;
  attachedMedia?: {
    filename: string;
    localPath: string;
    publicUrl?: string;
  };
  xResult?: {
    success: boolean;
    postId?: string;
    postUrl?: string;
    replyPostId?: string;
    replyError?: string;
    error?: string;
  };
  threadsResult?: {
    success: boolean;
    postId?: string;
    postUrl?: string;
    replyPostId?: string;
    replyError?: string;
    error?: string;
  };
}
