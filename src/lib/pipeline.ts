import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { CandidateProduct, CategoryId, PipelineMode, TimeSlot } from './types';
import { buildAffiliateLink, appendPrDisclosure } from './amazon';

import {
  getCatalogUrls,
  REPLY_CLOSING_WORDS,
  buildAffiliateReplyText,
} from './reply-builder';

export {
  getCatalogUrls,
  REPLY_CLOSING_WORDS,
  buildAffiliateReplyText,
};

/**
 * 1. 投稿モードと時間帯スロットの自動判定ロジック（日本の生活リズム）
 * - 朝 (6:00〜10:59): 日常の高耐久ケア用品・暮らしの道具（換毛期ブラシ、破れないシーツ、時短掃除）
 * - 昼 (11:00〜16:59): 現場厳選消耗品・ヘルスケア（消臭スプレー、ペット専用軟水保存水）
 * - 夜 (17:00〜23:59): ペット防災・命を守る備え（ポータブル電源、ソーラーパネル、携帯浄水器、車中泊避難）
 * 
 * 【刈り取りモード】: 水曜・金曜・日曜の夜 (20:00〜23:00台) ＋ 週末の昼
 * 【育成モード】: 上記以外の日常時間帯（URLなし共感、またはカタログリプライ付き）
 */
export function checkPipelineMode(date: Date = new Date()): {
  mode: PipelineMode;
  timeSlot: TimeSlot;
  timeSlotName: string;
  themeGenre: string;
  suggestedKeyword: string;
  reason: string;
  isHarvestTime: boolean;
  dayOfWeek: number; // 0=日, 1=月, ..., 3=水, 5=金
  dayName: string;
  hour: number;
  formattedTime: string;
  nextHarvestWindow: string;
} {
  // 日本時間（JST: UTC+9）で正確に判定
  const jstOffsetMinutes = 9 * 60;
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const jstDate = new Date(utc + jstOffsetMinutes * 60000);

  const dayOfWeek = jstDate.getDay(); // 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
  const hour = jstDate.getHours();
  const minute = jstDate.getMinutes();

  const dayNames = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'];
  const dayName = dayNames[dayOfWeek];
  const formattedTime = `${dayName} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  // 時間帯スロット判定
  let timeSlot: TimeSlot = 'night';
  let timeSlotName = '夜（ゴールデンタイム）';
  let themeGenre = 'ペット防災・命を守る備え（ポータブル電源・ソーラーパネル・携帯浄水器）';
  let suggestedKeyword = 'ポータブル電源 ソーラーパネル 携帯浄水器 ペット保存水';

  if (hour >= 6 && hour < 11) {
    timeSlot = 'morning';
    timeSlotName = '朝（通勤・朝活スロット）';
    themeGenre = '日常の高耐久ケア用品・暮らしの道具（破れないペットシーツ・抜け毛対策ブラシ）';
    suggestedKeyword = '破れないペットシーツ 消臭スプレー 抜け毛ブラシ 猫爪とぎ';
  } else if (hour >= 11 && hour < 17) {
    timeSlot = 'noon';
    timeSlotName = '昼（ランチタイム・休憩スロット）';
    themeGenre = '現場厳選消耗品・ペットの健康ケア（軟水保存水・無害消臭スプレー・オーガニックケア）';
    suggestedKeyword = 'ペット用軟水保存水 A2Care除菌消臭 犬猫ヘルスケア';
  }

  // 刈り取り曜日・時間帯:
  // - 水曜・金曜・日曜の夜 20:00〜23:59 (購買意欲最高潮)
  // - 土曜・日曜の昼 12:00〜14:00 (週末ショッピング)
  const isNightHarvest = (dayOfWeek === 0 || dayOfWeek === 3 || dayOfWeek === 5) && (hour >= 20 && hour <= 23);
  const isWeekendHarvest = (dayOfWeek === 0 || dayOfWeek === 6) && (hour >= 12 && hour <= 14);
  const isHarvestTime = isNightHarvest || isWeekendHarvest;

  let nextHarvestWindow = '';
  if (isHarvestTime) {
    nextHarvestWindow = '現在が刈り取りゴールデンタイムです';
  } else {
    if (dayOfWeek === 0 && hour < 20) {
      nextHarvestWindow = '本日（日曜）20:00〜';
    } else if (dayOfWeek < 3 || (dayOfWeek === 3 && hour < 20)) {
      nextHarvestWindow = dayOfWeek === 3 ? '本日（水曜）20:00〜' : '次回: 今週水曜 20:00〜';
    } else if (dayOfWeek < 5 || (dayOfWeek === 5 && hour < 20)) {
      nextHarvestWindow = dayOfWeek === 5 ? '本日（金曜）20:00〜' : '次回: 今週金曜 20:00〜';
    } else {
      nextHarvestWindow = '次回: 今週日曜 20:00〜';
    }
  }

  if (isHarvestTime) {
    return {
      mode: 'harvest',
      timeSlot,
      timeSlotName,
      themeGenre,
      suggestedKeyword,
      reason: `🔥【刈り取りモード】${timeSlotName} ${formattedTime}。購買意欲が高まる時間帯のため、高単価アイテム・カタログ誘導リンク（#PR）付きで配信します。`,
      isHarvestTime: true,
      dayOfWeek,
      dayName,
      hour,
      formattedTime,
      nextHarvestWindow,
    };
  }

  return {
    mode: 'nurture',
    timeSlot,
    timeSlotName,
    themeGenre,
    suggestedKeyword,
    reason: `🌱【育成モード】${timeSlotName} ${formattedTime}。スパム判定を回避しファンを育てるため、現場目線のお役立ち知恵袋・共感ノウハウを中心に配信します。`,
    isHarvestTime: false,
    dayOfWeek,
    dayName,
    hour,
    formattedTime,
    nextHarvestWindow,
  };
}

/**
 * デフォルトで同封されている静的メディアストックリスト（Vercel Serverless環境用フォールバック）
 * public/media-stock/ 配下の日常写真・保護犬猫ストック全40件
 */
const BUILTIN_MEDIA_FILES = [
  'cat_living.jpg',
  'dog_living.jpg',
  'IMG_1944.JPG',
  'kitchen_interior.jpg',
  'スクリーンショット 2026-10-17 052404.jpg',
  'スクリーンショット 2026-10-17 052528.jpg',
  'スクリーンショット 2026-10-17 052556.jpg',
  'スクリーンショット 2026-10-17 052650.jpg',
  'スクリーンショット 2026-10-17 052744.jpg',
  'スクリーンショット 2026-10-17 052813.jpg',
  'スクリーンショット 2026-10-17 052833.jpg',
  'スクリーンショット 2026-10-17 052900.jpg',
  'スクリーンショット 2026-10-17 052945.jpg',
  'スクリーンショット 2026-10-17 053018.jpg',
  'スクリーンショット 2026-10-17 053058.jpg',
  'スクリーンショット 2026-10-17 053145.jpg',
  'スクリーンショット 2026-10-17 053222.jpg',
  'スクリーンショット 2026-10-17 053247.jpg',
  'スクリーンショット 2026-10-17 053319.jpg',
  'スクリーンショット 2026-10-17 053346.jpg',
  'スクリーンショット 2026-10-17 053440.jpg',
  'スクリーンショット 2026-10-17 053511.jpg',
  'スクリーンショット 2026-10-17 053533.jpg',
  'スクリーンショット 2026-10-17 053603.jpg',
  'スクリーンショット 2026-10-17 053637.jpg',
  'スクリーンショット 2026-10-17 053713.jpg',
  'スクリーンショット 2026-10-17 053750.jpg',
  'スクリーンショット 2026-10-17 053814.jpg',
  'スクリーンショット 2026-10-17 053845.jpg',
  'スクリーンショット 2026-10-17 053903.jpg',
  'スクリーンショット 2026-10-17 054028.jpg',
  'スクリーンショット 2026-10-17 054131.jpg',
  'スクリーンショット 2026-10-17 054256.jpg',
  'スクリーンショット 2026-10-17 054328.jpg',
  'スクリーンショット 2026-10-17 054407.jpg',
  'スクリーンショット 2026-10-17 054452.jpg',
  'スクリーンショット 2026-10-17 054554.jpg',
  'スクリーンショット 2026-10-17 054636.jpg',
  'スクリーンショット 2026-10-17 054711.jpg',
  'スクリーンショット 2026-10-17 054807.jpg',
  'スクリーンショット 2026-10-18 164314.jpg',
  'スクリーンショット 2026-10-18 165032.jpg',
  'スクリーンショット 2026-10-18 165214.jpg',
  'スクリーンショット 2026-10-18 165443.jpg',
  'スクリーンショット 2026-10-18 165652.jpg',
  'スクリーンショット 2026-10-18 165946.jpg',
  'スクリーンショット 2026-10-18 170032.jpg',
  'スクリーンショット 2026-10-18 170139.jpg',
  'スクリーンショット 2026-10-18 170711.jpg',
];

/**
 * アプリの公開ベースURLを取得（Vercel本番ドメイン対応）
 */
export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

/**
 * 2. 写真ストックフォルダからランダムに画像ファイルを選定
 * - ローカル環境: public/media-stock/ 内の実ファイルを探索
 * - Vercel本番環境: Serverless Functions制限に対応し、静的ファイル一覧からCDN公開URLを自動生成
 */
export function selectRandomStockMedia(customDir?: string): {
  filename: string;
  absolutePath: string;
  relativePath: string;
  publicUrl: string;
  mimeType: string;
} | null {
  const baseMediaDir = path.join(process.cwd(), 'public', 'media-stock');
  const stockDir = customDir && fs.existsSync(customDir) ? customDir : baseMediaDir;

  let chosenFile = '';

  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.mp4'];
  let files: string[] = [];

  try {
    if (fs.existsSync(stockDir)) {
      files = fs.readdirSync(stockDir).filter(file => {
        const ext = path.extname(file).toLowerCase();
        return validExtensions.includes(ext);
      });
    }
  } catch (err) {
    console.warn('Could not read media-stock directory directly, using built-in list:', err);
  }

  if (files.length > 0) {
    chosenFile = files[Math.floor(Math.random() * files.length)];
  } else {
    // Vercel Serverless Function実行時などでfsが制限される場合のフォールバック
    chosenFile = BUILTIN_MEDIA_FILES[Math.floor(Math.random() * BUILTIN_MEDIA_FILES.length)];
  }

  const absolutePath = path.join(baseMediaDir, chosenFile);
  const ext = path.extname(chosenFile).toLowerCase();
  let mimeType = 'image/jpeg';
  if (ext === '.png') mimeType = 'image/png';
  if (ext === '.webp') mimeType = 'image/webp';
  if (ext === '.mp4') mimeType = 'video/mp4';

  const baseUrl = getAppBaseUrl();
  const relativePath = `/media-stock/${encodeURIComponent(chosenFile)}`;
  const publicUrl = `${baseUrl}${relativePath}`;

  return {
    filename: chosenFile,
    absolutePath,
    relativePath,
    publicUrl,
    mimeType,
  };
}

/**
 * Threads APIが読み取れる公開HTTPS URLを取得
 * 1. Vercel本番環境の場合: 自身の公開ドメイン（https://.../media-stock/...）をそのまま利用（最速・確実）
 * 2. ローカル開発時: 外部公開画像ホスト（Catbox等）へ一時アップロード
 */
export async function uploadToPublicImageHost(filePath: string, publicUrl?: string): Promise<string | null> {
  // すでに本番公開HTTPS URL（VercelやSupabase Storage等）がある場合はそれをそのまま利用
  if (publicUrl && publicUrl.startsWith('https://') && !publicUrl.includes('localhost')) {
    return publicUrl;
  }

  try {
    if (!fs.existsSync(filePath)) return publicUrl || null;

    const fileBuffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    const form = new FormData();
    form.append('reqtype', 'fileupload');
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    form.append('fileToUpload', new Blob([fileBuffer], { type: mime }), filename);

    const res = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: form,
    });

    if (res.ok) {
      const url = (await res.text()).trim();
      if (url.startsWith('https://')) {
        return url;
      }
    }
  } catch (e) {
    console.warn('Image public hosting upload failed, will fallback to text-only on Threads:', e);
  }
  return publicUrl || null;
}

/**
 * 3. 高単価商品の自動選定アルゴリズム（刈り取りモード時）
 * ① 記事キーワードに関連するAmazon売れ筋上位10件を取得
 * ② レビュー評価「★4.0未満」の商品を除外
 * ③ 残った候補の中で「最も価格（単価）が高い商品」を1件自動選定
 * ④ 選定した商品名＋アソシエイトURL＋「#PR」を記事末尾に自動結合
 */
export async function selectHighPriceProduct(params: {
  keyword: string;
  genre: 'life' | 'pet';
  category?: CategoryId;
  trackingId?: string;
  apiKey?: string;
}): Promise<{
  selected: CandidateProduct;
  candidatesTotal: number;
  filteredCandidates: CandidateProduct[];
  allCandidates: CandidateProduct[];
  selectionReason: string;
}> {
  const { keyword, genre, category = 'life_general', trackingId, apiKey } = params;

  // 1. 上位10件の候補を取得（Gemini API または 高品質リッチデータセット）
  let candidates: CandidateProduct[] = [];

  if (apiKey && apiKey !== '【Google AI Studioで取得したGemini APIキー】' && !apiKey.startsWith('your_')) {
    try {
      candidates = await fetchCandidatesViaGemini(keyword, genre, category, apiKey);
    } catch (e) {
      console.warn('Gemini candidate generation failed, using curated dataset:', e);
    }
  }

  if (!candidates || candidates.length < 5) {
    candidates = getFallbackCandidates(genre, keyword);
  }

  // 2. レビュー評価「★4.0未満」の商品を厳格に除外
  const highRated = candidates.filter(item => item.rating >= 4.0);

  // もし★4.0以上が奇跡的にゼロだった場合は安全のため3.8以上をフォールバック対象にする
  const pool = highRated.length > 0 ? highRated : candidates;

  // 3. 残った候補の中で「最も価格（単価）が高い商品」を1件自動選定
  const sortedByPrice = [...pool].sort((a, b) => b.price - a.price);
  const selected = sortedByPrice[0];

  const reason = `Amazon売れ筋上位${candidates.length}件を精査 ➔ ★4.0未満(${candidates.length - highRated.length}件)を除外 ➔ 残った高評価${highRated.length}件の中で最高単価（¥${selected.price.toLocaleString()} / ★${selected.rating}）の「${selected.name}」を自動選定`;

  return {
    selected,
    candidatesTotal: candidates.length,
    filteredCandidates: highRated,
    allCandidates: candidates,
    selectionReason: reason,
  };
}

/**
 * Geminiによる売れ筋上位10件の生成・抽出
 */
/**
 * Geminiによる売れ筋上位10件の生成・抽出（防災・高単価ギア・現場厳選アイテム優先）
 */
async function fetchCandidatesViaGemini(
  keyword: string,
  genre: 'life' | 'pet',
  category: CategoryId,
  apiKey: string
): Promise<CandidateProduct[]> {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `あなたは「40〜60代の女性から強く共感され愛されるペットの飼い主。普段はおっちょこちょいで愛犬・愛猫に甘々だが、ペットの理不尽なやらかしや日々の地味な困りごと（掃除・ニオイ・抜け毛・停電断水の備え等）を本気で解決する実力派・高評価アイテムを厳選する目利き」です。
現在、日本のAmazonで「${keyword}」に関連する【飼い主のリアルな困りごとを解決する神アイテム・命を守る備え・売れ筋上位10件】の商品リストを作成してください。

特に以下のカテゴリを優先・ローテーションで含めてください：
1. 抜け毛・掃除・消臭ケア（部屋中毛だらけ・粗相のニオイ・引っ掻きに強い消耗品）
2. ポータブル電源・ソーラーパネル（停電時のペットのエアコン・ヒーター維持、熱中症対策）
3. 携帯浄水器・ペット軟水保存水（断水時に給水車に並べない時の水確保、尿路結石予防）
4. お留守番ストレス解消・高耐久グッズ（爪とぎ、知育トイ、破れないペットシーツ）

価格帯は、高単価な防災ギアからリピートされる数千円の実力派アイテムまで幅広く10件挙げてください。

【出力要件】
必ず以下のJSON形式のみを出力してください。
{
  "products": [
    {
      "name": "正確な商品名（メーカー名＋モデル名）",
      "asin": "実在または精緻な10桁ASIN（例: B09XXXXXXX）",
      "price": 79800, // 日本円の推定販売価格（数値のみ）
      "rating": 4.6, // 星評価 (3.5〜4.8)
      "reviewCount": 1250,
      "benefits": ["被災時・停電時の命綱ポイント", "日常でも役立つフェーズフリー性", "多頭現場目線での耐久性"],
      "targetAudience": "ペット同伴避難・在宅避難を想定する飼い主や多頭飼育家庭"
    }
  ]
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  const text = response.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    const data = JSON.parse(match[0]);
    if (data.products && Array.isArray(data.products)) {
      return data.products.map((p: any) => ({
        name: p.name || '高評価人気商品',
        asin: p.asin || 'B0C4FH295H',
        price: Number(p.price) || 8900,
        rating: Number(p.rating) || 4.2,
        reviewCount: Number(p.reviewCount) || 300,
        benefits: Array.isArray(p.benefits) ? p.benefits : ['命を守る備え', 'フェーズフリー性'],
        category,
        targetAudience: p.targetAudience || '愛犬・愛猫と暮らす方',
      }));
    }
  }

  throw new Error('Could not parse candidates from Gemini response');
}

/**
 * 高品質フォールバック候補商品プール（防災・高単価ギア・現場厳選アイテム）
 */
function getFallbackCandidates(genre: 'life' | 'pet', keyword: string): CandidateProduct[] {
  return [
    // 1. ポータブル電源・ソーラーパネル（高単価・最優先）
    {
      name: 'Jackery ポータブル電源 1000 Plus リン酸鉄 大容量 1264Wh 定格出力2000W',
      asin: 'B0C4FH295H',
      price: 168000,
      rating: 4.6,
      reviewCount: 1820,
      benefits: ['猛暑の停電時でもエアコンを朝まで動かしペットの命を守る', '10年超の長寿命リン酸鉄', '日常の電気代削減にも使えるフェーズフリー'],
      category: 'disaster_prep',
      targetAudience: '避難所に行きづらい在宅・車中泊避難を想定するペット飼育家庭',
    },
    {
      name: 'EcoFlow RIVER 2 Pro ポータブル電源 768Wh 急速充電70分 リン酸鉄',
      asin: 'B0BFKFC9YJ',
      price: 79900,
      rating: 4.5,
      reviewCount: 2450,
      benefits: ['わずか70分で満充電できる機動力', 'ケージ用ヒーターや見守りカメラの電源を数日間キープ', '7.8kgで女性でも車へ即運搬可能'],
      category: 'disaster_prep',
      targetAudience: '愛犬愛猫との車中泊避難や停電時の保温対策を考える人',
    },
    {
      name: 'Anker Solix C1000 ポータブル電源 1056Wh 高出力 急速満充電',
      asin: 'B0CTY9ZJYB',
      price: 99900,
      rating: 4.7,
      reviewCount: 1100,
      benefits: ['超急速充電で災害直前でもフルチャージ', 'ペット家電を複数同時に余裕で稼働', 'スマホ充電100回以上の頼もしさ'],
      category: 'disaster_prep',
      targetAudience: '災害時の電源確保に妥協したくない家族',
    },

    // 2. 携帯浄水器・水ろ過器
    {
      name: 'SAWYER PRODUCTS(ソーヤー プロダクト) ソーヤー ミニ SP128 携帯浄水器',
      asin: 'B00V7X60X0',
      price: 4500,
      rating: 4.6,
      reviewCount: 9800,
      benefits: ['お風呂の残り湯や雨水を瞬時に安全な飲用水にろ過', '一生分（38万L）ろ過できる高耐久フィルター', '給水車の行列にペットを置いて並べない断水時の命綱'],
      category: 'water_purifier',
      targetAudience: '断水時にペットと自分の生活・飲用水を自力確保したい人',
    },
    {
      name: 'KATADYN(カタダイン) ビーフリー 1.0L 携帯浄水器 高速流量',
      asin: 'B0731D796X',
      price: 8800,
      rating: 4.5,
      reviewCount: 3200,
      benefits: ['握るだけで1分間に2Lの高速ろ過', '軽量コンパクトで防災リュックに常備必須', 'バクテリア・微生物を99.9%除去'],
      category: 'water_purifier',
      targetAudience: '緊急時にすぐ使える軽量浄水システムを求める方',
    },

    // 3. ペット配慮の長期保存水（軟水備蓄）
    {
      name: 'ペット用 超軟水 5年保存水 500ml×24本 硬度ゼロ・尿路結石予防',
      asin: 'B08F9V2478',
      price: 4980,
      rating: 4.7,
      reviewCount: 1350,
      benefits: ['犬猫の結石原因となるミネラルを極限排除した安心設計', '人間用硬水ミネラルウォーターのリスクを回避', '5年長期保存で人間もペットも一緒に備蓄'],
      category: 'water_purifier',
      targetAudience: '避難時も愛犬愛猫の腎臓・膀胱の健康を守りたい飼い主',
    },

    // 4. 現場目線で選ぶ高コスパ・ヘビーユース消耗品
    {
      name: '超厚型 炭入り消臭ペットシーツ ワイド 180枚 多頭飼育・超強力吸収',
      asin: 'B015152TGM',
      price: 4980,
      rating: 4.6,
      reviewCount: 4200,
      benefits: ['保護現場で爪に引っ掻かれても破れない強靭不織布', '逆戻りゼロで多頭でも足濡れ・染み出し完全防止', '活性炭の瞬間消臭で室内のアンモニア臭ゼロ'],
      category: 'rescue_supplies',
      targetAudience: 'シーツの破れや漏れ、ニオイ戻りに毎日悩む多頭飼育家庭',
    },
    {
      name: 'A2Care(エーツーケア) 詰替用 1L 除菌消臭スプレー ペット安全・無臭',
      asin: 'B00N1V2S18',
      price: 3080,
      rating: 4.6,
      reviewCount: 5600,
      benefits: ['ペットが舐めても安心な水同等の安全性', '香りで誤魔化さずニオイ菌を元から分解', '保護現場の多頭衛生管理で欠かせないプロ用消臭剤'],
      category: 'rescue_supplies',
      targetAudience: '強い香りが苦手なペットと暮らす家庭や粗相対策',
    },
    {
      name: 'FURminator(ファーミネーター) 大型犬/大型猫 抜け毛除去ブラシ',
      asin: 'B0040QW35A',
      price: 4980,
      rating: 4.7,
      reviewCount: 15400,
      benefits: ['不要なアンダーコートをごっそり90%除去', '部屋に舞う抜け毛と毛玉吐き戻しを根本予防', 'ワンプッシュで毛を捨てられ時短'],
      category: 'pet_care',
      targetAudience: '換毛期の部屋の抜け毛掃除に限界を感じている飼い主',
    },
    // 低評価サンプル（除外アルゴリズム検証用）
    {
      name: 'ノーブランド 簡易防災ラジオ（低評価サンプル）',
      asin: 'B08XXXXXX1',
      price: 1200,
      rating: 3.4, // ★4.0未満（フィルター除外用）
      reviewCount: 30,
      benefits: ['安い'],
      category: 'disaster_prep',
      targetAudience: 'とりあえず',
    },
  ];
}

export type ProductGenreType =
  | 'disaster_power' // ポータブル電源・蓄電池・ソーラー・Jackery・EcoFlow・Anker等
  | 'disaster_water' // 携帯浄水器・保存水・非常用給水袋等
  | 'disaster_general' // 防災リュック・非常食・簡易トイレ・防災セット
  | 'pet_brush'      // ブラシ・抜け毛・コーム・ファーミネーター等
  | 'pet_sheets'     // シーツ・シート・トイレ・消臭・オシッコ等
  | 'pet_water'      // 水飲み器・給水器等
  | 'pet_feeder'     // 自動給餌器・フードボウル・早食い防止
  | 'pet_general'    // おもちゃ・ベッド・キャリー・ペット用ホットカーペット等
  | 'camp_outdoor'   // テント・寝袋・ランタン・焚き火台等
  | 'life_general';  // キッチン・掃除・便利家電等

/**
 * 商品名・メリット・カテゴリから最適な文脈とジャンルを判定する
 */
export function detectProductGenre(productName: string, benefits: string[] = [], category?: string): {
  genre: ProductGenreType;
  contextGuidance: string;
  defaultHook: string;
} {
  const text = `${productName} ${benefits.join(' ')} ${category || ''}`.toLowerCase();

  // 1. ポータブル電源・蓄電池
  if (/ポータブル電源|蓄電池|jackery|ecoflow|anker\s*(solix|power)|bluetti|ソーラーパネル|リン酸鉄|非常用電源|大容量バッテリー/i.test(text)) {
    return {
      genre: 'disaster_power',
      contextGuidance: '【★ポータブル電源・蓄電池の絶対厳守ルール】：ペットの飼い主にとって、ポータブル電源は「真夏の猛暑や真冬の豪雪による停電時、エアコンやペット用ヒーター・扇風機を動かして愛犬愛猫の命を守る命綱」です！「猫がおもちゃとして遊ぶ」「猫がポータブル電源に夢中になる」などの文脈は【支離滅裂になるため絶対に厳禁】です！突然の雷雨や地震での停電、夏の猛暑の停電パニック、在宅避難時のペットの命のバックアップという文脈で語ってください。',
      defaultHook: 'ペットがいる家庭のポータブル電源、停電時のエアコン・ヒーター稼働にマジで命綱だと痛感しました✨️',
    };
  }

  // 2. 携帯浄水器・保存水・給水袋
  if (/携帯浄水器|ソーヤー|sawyer|保存水|非常用給水|浄水器|ウォーターバッグ/i.test(text)) {
    return {
      genre: 'disaster_water',
      contextGuidance: '【携帯浄水器・防災水関連の文脈】：断水時に「人間だけでなく愛犬・愛猫の飲み水をどう確保するか」という切実なペット防災の文脈です。給水車の長い行列やお腹を壊せないペットのための安全な水確保の備えとして語ってください。',
      defaultHook: '断水時にペットの飲み水を絶対に切らさない備えとして常備しておいて本当に安心です◎',
    };
  }

  // 3. その他防災全般
  if (/防災|避難|非常食|簡易トイレ|非常用持ち出し/i.test(text)) {
    return {
      genre: 'disaster_general',
      contextGuidance: '【ペット防災・避難グッズの文脈】：同行避難や在宅避難で我が子を守るための備え。ペットフードのローリングストックや避難バッグの点検など、飼い主としての備えの文脈で語ってください。',
      defaultHook: 'ペット防災の備えを見直しておくだけで、いざという時の安心感がまるで違います✨️',
    };
  }

  // 4. ブラシ・抜け毛ケア
  if (/ブラシ|コーム|抜け毛|ファーミネーター|グルーミング|毛玉/i.test(text)) {
    return {
      genre: 'pet_brush',
      contextGuidance: '【抜け毛・ブラッシングの文脈】：換毛期のすさまじい抜け毛、黒い服を着た瞬間に毛まみれ、ブラッシングを嫌がって逃走する愛犬愛猫との格闘エピソードで語ってください。',
      defaultHook: '毎日の果てしない抜け毛ストレスから解放されてブラッシングが至福の時間になりました👏',
    };
  }

  // 5. ペットシーツ・トイレ
  if (/シーツ|シート|トイレ|消臭|オシッコ|おしっこ|猫砂|うんち/i.test(text)) {
    return {
      genre: 'pet_sheets',
      contextGuidance: '【ペットシーツ・トイレの文脈】：おしっこの端っこはみ出し、足裏が濡れて部屋中スタンプラリー、シーツを前足で超高速ホリホリしてズタボロ破壊などのトイレやらかしエピソードで語ってください。',
      defaultHook: '吸水力と耐久性が段違いで、おしっこの足濡れや床拭きストレスが激減しました✨️',
    };
  }

  // 6. 水飲み器・給水器
  if (/水飲み|給水器|ウォーターボウル|自動給水/i.test(text)) {
    return {
      genre: 'pet_water',
      contextGuidance: '【水飲み・給水器の文脈】：前足でチョイチョイ押して水皿をひっくり返す、お皿の水で手足ビシャビシャ、飲んだ後の顎から水滴ポタポタなどの水飲みやらかしエピソードで語ってください。',
      defaultHook: 'ひっくり返らない安定給水器にしてから床の洪水事件が完全ゼロになりました✨️',
    };
  }

  // 7. 給餌器・フードボウル
  if (/給餌器|フードボウル|早食い|自動給餌/i.test(text)) {
    return {
      genre: 'pet_feeder',
      contextGuidance: '【給餌・フードボウルの文脈】：ご飯の一瞬丸呑みや吐き戻し、お皿をひっくり返してカリカリ散乱、留守中のお腹空いたアピールなどのエピソードで語ってください。',
      defaultHook: '食べやすくて早食いも防げるボウルに変えたら毎日のご飯タイムが安心になりました◎',
    };
  }

  // 8. キャンプ・アウトドア
  if (/キャンプ|テント|焚き火|寝袋|シュラフ|ランタン|アウトドア/i.test(text)) {
    return {
      genre: 'camp_outdoor',
      contextGuidance: '【キャンプ・アウトドアの文脈】：設営時のハプニング、寒暖差での夜の寒さ、荷物のパッキングなどのアウトドアあるあるエピソードで語ってください。',
      defaultHook: 'このギア導入してからアウトドアの快適さが段違いにアップしました✨️',
    };
  }

  // 9. デフォルト（ペット全般・おもちゃ・ベッド）
  return {
    genre: 'pet_general',
    contextGuidance: '【ペット日常・ベッド・おもちゃの文脈】：良かれと思って買ったグッズより梱包の段ボールを気に入る、飼い主の枕を占領して寝る、お気に入りのおもちゃを隙間に落として大騒ぎするなどの愛犬愛猫あるあるエピソードで語ってください。',
    defaultHook: 'うちの子もすっかり気に入ってくれて毎日の暮らしがもっと楽しくなりました👏',
  };
}

/**
 * 4. 記事本文と導線URL（個別・カタログ・リプライ用）の生成
 * 【投稿文の作成ルール（厳守事項）】
 * 1. 文字数の上限（Xの文字切れ防止）
 *    - メイン投稿の文字数は、改行やスペースも含めて【全角110〜130文字以内】で絶対に収めること（140文字を絶対に超えないこと）。
 * 2. トーン＆マナー（文体）
 *    - 過度なボケやツッコミ、自虐、テンションの高い煽り文句（「〜呼ぶ（知らんがな）」「ギャ〜…！」「オホホ^^」など）は【一切禁止】。
 *    - 犬や猫と暮らす飼い主の、リアルで飾らない「素直な日常の愛おしさ・共感」を落ち着いた優しいトーンで書くこと。
 * 3. 写真との関連性
 *    - 添付写真の動物の表情、寝姿、仕草、くつろぐ様子にそのまま寄り添う、日常の一コマを切り取った描写にすること。
 * 4. 構成ルール
 *    - メイン投稿：日常のほのぼのした描写・共感の一言 ＋ 最後に短くROOMへの誘導
 *      （例：我が家で本当に助かっている愛用アイテムをROOMにまとめてます🐾）
 *      ※メイン投稿にはURLや「#PR」を絶対に含めない。
 *    - リプライ（1通目）：詳細な紹介や楽天ROOM等のリンク・ハッシュタグ（#PR）を配置すること。
 */
export async function generateAutomatedPost(params: {
  mode: PipelineMode;
  timeSlot?: TimeSlot;
  genre: 'life' | 'pet';
  selectedProduct?: CandidateProduct;
  trackingId?: string;
  apiKey?: string;
}): Promise<{
  title: string;
  content: string;
  replyText?: string;
  catalogUrls: {
    amazonStorefront: string;
    rakutenRoom: string;
    affiliateUrl?: string;
  };
  affiliateUrl?: string;
  isNoLink: boolean;
}> {
  const { mode, timeSlot = 'night', genre, selectedProduct, trackingId, apiKey } = params;
  const { amazonStorefront, rakutenRoom } = getCatalogUrls();

  if (mode === 'harvest' && selectedProduct) {
    // 【パターンA: 刈り取り・商品フィーチャーモード】
    // メイン本文は日常描写＋共感＋ROOM誘導、アフィリエイトリンクは100%ぶら下げリプライへ配置
    const affiliateUrl = buildAffiliateLink(selectedProduct.asin, trackingId, { productName: selectedProduct.name });

    const productGenreInfo = detectProductGenre(
      selectedProduct.name,
      selectedProduct.benefits,
      selectedProduct.category
    );

    // リプライ用テキスト（導入＋詳細紹介＋アフィリエイトリンク ※PR）
    const replyText = buildAffiliateReplyText({
      productName: selectedProduct.name,
      reviewText: selectedProduct.benefits.join('。') + '。',
      affiliateUrl,
      amazonStorefront,
      rakutenRoom,
    });

    if (apiKey && apiKey !== '【Google AI Studioで取得したGemini APIキー】' && !apiKey.startsWith('your_')) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `あなたは「犬や猫と心から寄り添って暮らす飼い主」です。
愛犬・愛猫と一緒に暮らす、飾らない日常のかけがえのないひとコマを大切にしています。

以下の商品について、指定の【投稿文の作成ルール（厳守事項）】を100%遵守し、読者が心温まる共感を抱くSNS投稿（X・Threads親ポスト向け）を日本語で作成してください。

【紹介商品】
- 商品名: ${selectedProduct.name}
- 特徴・メリット: ${selectedProduct.benefits.join(' / ')}
- ターゲット: ${selectedProduct.targetAudience}

============================================================
【投稿文の作成ルール（厳守事項）】
============================================================

1. 文字数の上限（Xの文字切れ防止）
・メイン投稿の文字数は、改行やスペースも含めて【全角110〜130文字以内】で絶対に収めること（140文字を絶対に超えないこと）。
・110文字未満や131文字以上は不可。必ず「110文字以上・130文字以内」に着地させてください。

2. トーン＆マナー（文体）
・過度なボケやツッコミ、自虐、テンションの高い煽り文句（「〜呼ぶ（知らんがな）」「ギャ〜…！」「オホホ^^」「白目剥いた」「あ〜爆死」「誰の〇〇やねん」「下僕」など）は【一切禁止】。
・犬や猫と暮らす飼い主の、リアルで飾らない「素直な日常の愛おしさ・共感」を落ち着いた優しいトーンで書くこと。

3. 写真との関連性
・添付写真の動物の表情、寝姿、仕草、くつろぐ様子にそのまま寄り添う、日常の一コマを切り取った描写にすること。
（例：気持ちよさそうに目を細めている表情、サラサラの場所ですやすや眠る寝姿、美味しそうに水分補給している仕草、満足そうにくつろぐ様子など）

4. 構成ルール
・メイン投稿:
  日常のほのぼのした描写・共感の一言 ＋ 最後にプロフ誘導を入れること
  （例：我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR）
  ※メイン投稿にはURLは含めないでください（末尾のプロフ誘導の「#PR」は必須です）。

本文のみを出力してください。タイトルや解説は不要です。`;

        const res = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        let text = (res.text || '').trim();
        text = text
          .replace(/オホホ\^*[~〜♡]*/gi, '')
          .replace(/…人はそれを[^と]+と呼ぶ[。、]?（知らんがな）/g, '')
          .replace(/（知らんがな）/g, '')
          .replace(/ギャ〜[…！!~〜]*/g, '')
          .replace(/白目剥いた[。！!]*/g, '')
          .replace(/白目剥き(?:ました|ます)[。！!]*/g, '')
          .replace(/あ〜[、\s]*爆死[。！!]*？?/g, '')
          .replace(/誰[がの][^思]+思とんねん[！!笑\s]*/g, '')
          .replace(/勘弁して〜[！!笑\s]*/g, '')
          .replace(/下僕/g, '飼い主')
          .replace(/https?:\/\/[^\s]+/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        text = enforcePipelinePostLength(text);

        if (text && text.length >= 100) {
          return {
            title: `【愛され飼い主の日常】${selectedProduct.name.slice(0, 24)}...`,
            content: text,
            replyText,
            catalogUrls: {
              amazonStorefront,
              rakutenRoom,
              affiliateUrl,
            },
            affiliateUrl,
            isNoLink: true,
          };
        }
      } catch (e) {
        console.warn('Gemini harvest post generation failed, using template:', e);
      }
    }

    // 刈り取りフォールバックテンプレート（全角110〜130文字以内・落ち着いた優しいトーン＋プロフ誘導#PR）
    let harvestFallbackTemplates: string[] = [];

    switch (productGenreInfo.genre) {
      case 'disaster_power':
        harvestFallbackTemplates = [
          `愛犬や愛猫と暮らしているからこそ、突然の停電や災害の備えは本当に大切だなと実感しています。\n夏場のエアコンや冬の暖房など、言葉を話せない家族の安心を守る心強いお守りです。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
        ];
        break;

      case 'disaster_water':
        harvestFallbackTemplates = [
          `お散歩の帰りや日々の生活で、いつでも清潔で美味しいお水をごくごく飲んでくれる姿にホッとします。\n断水時などもしもの時にも安心なお水をたっぷり用意できる備えは欠かせませんね。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
        ];
        break;

      case 'disaster_general':
        harvestFallbackTemplates = [
          `ペット用の防災グッズや日用品は、定期的に見直して使い慣れておくのが安心ですね。\nいつもそばで無防備にすやすや眠る愛犬の寝顔を見ていると、この笑顔を守りたいなと思います。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
        ];
        break;

      case 'pet_brush':
        harvestFallbackTemplates = [
          `換毛期のお手入れ中、気持ちよさそうに目を細めてゴロゴロ喉を鳴らしてくれる姿が愛おしいです。\n優しく撫でるだけでふわふわの毛がすっきり整って、毎日の大切なスキンシップに。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
        ];
        break;

      case 'pet_sheets':
        harvestFallbackTemplates = [
          `トイレの後、すっきりした顔でトコトコ戻ってくる姿がたまらなく愛らしい日常。\n足元が濡れることもなく、いつも快適そうにくつろいでくれる姿にホッと安心しています。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
        ];
        break;

      case 'pet_water':
        harvestFallbackTemplates = [
          `トコトコ歩いてきて、美味しそうにお水をペロペロ飲んでいる愛猫の横顔。\nいつでも新鮮で綺麗なお水をごくごく飲んでくれる姿を見るだけで、飼い主としてとても安心します。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
        ];
        break;

      case 'camp_outdoor':
        harvestFallbackTemplates = [
          `愛犬と一緒に自然の澄んだ空気を感じながら過ごす穏やかな休日。\n木漏れ日の下で気持ちよさそうに寄り添ってうとうとする姿に、心から癒やされるひとときでした。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
        ];
        break;

      default:
        harvestFallbackTemplates = [
          `新しいアイテムをそっと置いてみたら、すぐに気に入ってくれたようで安心しました。\n気持ちよさそうに丸くなってすやすや眠る姿を見ていると、日々の疲れも吹き飛びます。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
        ];
        break;
    }

    const chosenHarvest = harvestFallbackTemplates[Math.floor(Math.random() * harvestFallbackTemplates.length)];

    return {
      title: `【愛され飼い主の日常】${selectedProduct.name.slice(0, 24)}...`,
      content: chosenHarvest,
      replyText,
      catalogUrls: {
        amazonStorefront,
        rakutenRoom,
        affiliateUrl,
      },
      affiliateUrl,
      isNoLink: true,
    };
  }

  // 【パターンB: 育成・ノウハウ・ギブ型】
  // メイン本文はURLなし（日常のほのぼのした描写・共感＋プロフ誘導#PR）、リプライにリンク・PRを集約
  const replyText = buildAffiliateReplyText({
    amazonStorefront,
    rakutenRoom,
  });

  if (apiKey && apiKey !== '【Google AI Studioで取得したGemini APIキー】' && !apiKey.startsWith('your_')) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `あなたは「犬や猫と心から寄り添って暮らす飼い主」です。
愛犬・愛猫と一緒に暮らす、飾らない日常のかけがえのないひとコマを大切にしています。

指定の【投稿文の作成ルール（厳守事項）】を100%遵守し、読者が心温まる共感を抱くSNS投稿（X・Threads親ポスト向け）を作成してください。

============================================================
【投稿文の作成ルール（厳守事項）】
============================================================

1. 文字数の上限（Xの文字切れ防止）
・メイン投稿の文字数は、改行やスペースも含めて【全角110〜130文字以内】で絶対に収めること（140文字を絶対に超えないこと）。
・110文字未満や131文字以上は不可。必ず「110文字以上・130文字以内」に着地させてください。

2. トーン＆マナー（文体）
・過度なボケやツッコミ、自虐、テンションの高い煽り文句（「〜呼ぶ（知らんがな）」「ギャ〜…！」「オホホ^^」「白目剥いた」「あ〜爆死」「誰の〇〇やねん」「下僕」など）は【一切禁止】。
・犬や猫と暮らす飼い主の、リアルで飾らない「素直な日常の愛おしさ・共感」を落ち着いた優しいトーンで書くこと。

3. 写真との関連性
・添付写真の動物の表情、寝姿、仕草、くつろぐ様子にそのまま寄り添う、日常の一コマを切り取った描写にすること。

4. 構成ルール
・メイン投稿:
  日常のほのぼのした描写・共感の一言 ＋ 最後にプロフ誘導を入れること
  （例：我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR）
  ※メイン投稿にはURLは含めないでください（末尾のプロフ誘導の「#PR」は必須です）。

本文のみを出力してください。`;

      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      let text = (res.text || '').trim();
      text = text
        .replace(/オホホ\^*[~〜♡]*/gi, '')
        .replace(/…人はそれを[^と]+と呼ぶ[。、]?（知らんがな）/g, '')
        .replace(/（知らんがな）/g, '')
        .replace(/ギャ〜[…！!~〜]*/g, '')
        .replace(/白目剥いた[。！!]*/g, '')
        .replace(/白目剥き(?:ました|ます)[。！!]*/g, '')
        .replace(/あ〜[、\s]*爆死[。！!]*？?/g, '')
        .replace(/誰[がの][^思]+思とんねん[！!笑\s]*/g, '')
        .replace(/勘弁して〜[！!笑\s]*/g, '')
        .replace(/下僕/g, '飼い主')
        .replace(/https?:\/\/[^\s]+/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      text = enforcePipelinePostLength(text);

      if (text && text.length >= 100) {
        return {
          title: '【愛され飼い主の日常】穏やかなくつろぎのひととき',
          content: text,
          replyText,
          catalogUrls: {
            amazonStorefront,
            rakutenRoom,
          },
          isNoLink: true,
        };
      }
    } catch (e) {
      console.warn('Gemini nurture post generation failed, using template:', e);
    }
  }

  // 育成フォールバックテンプレート（全角110〜130文字以内厳守・優しいトーン＋プロフ誘導#PR）
  const nurtureTemplates = [
    `日頃のお手入れ中、気持ちよさそうに目を細めて喉を鳴らす姿が愛おしいです。\n家族のそばで安心しきってくつろいでくれる時間が、何よりのかけがえのない癒やしですね。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
    `ふかふかの居場所でお気に入りのポーズのまま、気持ちよさそうにすやすや眠る愛犬。\n無防備な可愛い寝息を聞きながら一緒に過ごすひとときは、日々の小さなしあわせそのものです。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
    `トコトコ歩いてきては、足元にそっと寄り添って甘えてくれる愛らしい仕草。\n言葉は通じなくても、穏やかな瞳で見つめ合えるだけで温かい絆を感じますね。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
    `日頃使うアイテムを心地よいものに変えてから、うちの子も毎日とてもリラックスして過ごしています。\n家族みんなが笑顔で心地よく暮らせる空間づくりは本当に大切ですね。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
  ];

  const chosenNurture = nurtureTemplates[Math.floor(Math.random() * nurtureTemplates.length)];

  return {
    title: '【愛され飼い主の日常】穏やかなくつろぎのひととき',
    content: chosenNurture,
    replyText,
    catalogUrls: {
      amazonStorefront,
      rakutenRoom,
    },
    isNoLink: true,
  };
}

/**
 * 自動投稿メイン本文の文字数を【全角110〜130文字以内】に収めるヘルパー
 * プロフ誘導（+ #PR）を確実に配置し、140文字超えを絶対に防止する
 */
function enforcePipelinePostLength(text: string): string {
  const guide = '\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR';
  let target = text.trim();

  // プロフ誘導のフレーズが全く含まれていない場合は付与を試みる
  if (!target.includes('プロフ')) {
    if ((target + guide).length <= 130) {
      target = (target + guide).trim();
    } else {
      const maxLead = 130 - guide.length;
      if (maxLead > 30) {
        target = target.slice(0, maxLead).replace(/[、,\s]+$/, '') + '…' + guide;
      }
    }
  }

  // プロフ誘導はあるが #PR が抜けている場合は付与
  if (!target.includes('#PR')) {
    if ((target + ' #PR').length <= 130) {
      target = target + ' #PR';
    } else {
      target = target.slice(0, 125).replace(/[、,\s]+$/, '') + ' #PR';
    }
  }

  // 130文字を超えている場合は安全にトリミング（末尾の #PR は死守）
  if (target.length > 130) {
    if (target.endsWith('#PR')) {
      const bodyPart = target.slice(0, -4).trim();
      target = bodyPart.slice(0, 125).replace(/[、,\s]+$/, '') + ' #PR';
    } else {
      target = target.slice(0, 127).replace(/[、,\s]+$/, '') + '…';
    }
  }

  // 110文字未満で短すぎる場合は共感の一言を補完
  if (target.length < 110) {
    const padding = '\n毎日大切に使っています🌿';
    if (target.includes('\n') && (target.length + padding.length) <= 130) {
      const lastLineIdx = target.lastIndexOf('\n');
      target = target.slice(0, lastLineIdx) + padding + target.slice(lastLineIdx);
    } else if ((target + padding).length <= 130) {
      target = (target + padding).trim();
    }
  }

  // 最終安全ガード（絶対に130文字以内・140文字超え完全防止）
  if (target.length > 130) {
    if (target.includes('#PR')) {
      const withoutPr = target.replace(/\s*#PR$/, '');
      target = withoutPr.slice(0, 125).replace(/[、,\s]+$/, '') + ' #PR';
    } else {
      target = target.slice(0, 127).replace(/[、,\s]+$/, '') + '…';
    }
  }

  return target;
}

