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
  | 'disaster_prep'     // 防災・ポータブル電源・ソーラーパネル
  | 'water_purifier'    // 携帯浄水器・ペット配慮長期保存水（軟水）
  | 'rescue_supplies';  // 多頭保護現場厳選ヘビーユース消耗品（シーツ・消臭等）

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
  tweet_id?: string;   // X API投稿成功時のツイートID
  created_at: string;
  updated_at: string;
}

export interface GeneratedVariation {
  id: string;
  tone: ToneId;
  toneName: string;
  content: string;
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

// 自動パイプラインの1回ごとの実行ログ・結果
export interface AutomatedExecutionResult {
  id: string;
  executedAt: string;
  timeSlot?: TimeSlot;
  mode: PipelineMode;
  modeReason: string;
  topicTitle: string;
  genre: 'life' | 'pet';
  content: string;
  replyText?: string; // Xのリプライツリー用テキスト（カタログ・ストアフロント誘導）
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
    error?: string;
  };
  threadsResult?: {
    success: boolean;
    postId?: string;
    postUrl?: string;
    error?: string;
  };
}
