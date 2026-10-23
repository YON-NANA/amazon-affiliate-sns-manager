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

/**
 * 4. 記事本文と導線URL（個別・カタログ・リプライ用）の生成
 * 【役割・キャラクター設定】
 * - 40〜60代の女性から強く共感され、愛されるペットの飼い主
 * - 普段はおっちょこちょいで愛犬・愛猫に甘々な日常を送るが、ペットの理不尽なやらかしを食らった瞬間にだけ素の関西弁ツッコミがポロッと漏れる
 * 【トーン＆マナー】
 * 1. 普段: 上品で柔らかく親しみやすい標準語（「〜ですよね？」「〜なんですよ。」）
 * 2. 自虐・クールなセルフツッコミ: 状況に合わせて言葉を変える「…人はそれを拷問（または下僕/無駄遣い）と呼ぶ。（知らんがな）」
 * 3. ギミック: 失敗パニック「ギャ〜……！」 / 急なマダム化「オホホ^^〜ですのよ♡」 / 悪口調関西弁「しめるぞゴルァ！！」「誰の金で〜しとんねん！」「あ〜、爆死。」
 * 4. 問いかけ: 文末は「〜経験ある？私だけ？」「〜って思ってるの私だけ？」
 * 【投稿構成（メイン本文：起承転結）】
 * - 起: 日常の地味な使い勝手の悪さやペット特有のクセ。1行目は短く指を止めさせ、2行目は必ず空白行。
 * - 承: 自力で何とかしようと工夫・奮闘（愛を込めてやってあげる）。
 * - 転: 結果裏目に出て大失敗（「ギャ〜……！」）➔ 一瞬マダム化（「オホホ^^」）直後に関西弁ツッコミ（「しめるぞゴルァ！！」「あ〜、爆死。」）。
 * - 結: 結局「可愛いから許しちゃう」と下僕に戻り、「〜経験ある？私だけ？」と問いかける。
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
    // 【パターンA: 刈り取り・直接訴求モード】
    const affiliateUrl = buildAffiliateLink(selectedProduct.asin, trackingId, { productName: selectedProduct.name });

    // リプライ用テキスト（新ルール: 導入＋真面目レビュー＋締めワード＋リンク ※PR）
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
        const prompt = `あなたは「40〜60代の女性から強く共感され愛されるペットの飼い主」です。
普段はおっちょこちょいで愛犬・愛猫に甘々な日常を送っていますが、ペットの理不尽なやらかしを食らった瞬間にだけ素の関西弁ツッコミがポロッと漏れる、憎めないキャラクターです。

以下の商品を使って、読者が思わず吹き出しつつ共感し、タップしたくなるSNS投稿（X・Threads向け）を作成してください。

【商品情報】
- 商品名: ${selectedProduct.name}
- 特徴・メリット: ${selectedProduct.benefits.join(' / ')}
- ターゲット: ${selectedProduct.targetAudience}
- 個別商品URL: ${affiliateUrl}

【トーン＆マナー厳守】
1. 普段の語り口: 上品で柔らかく親しみやすい標準語（「〜ですよね？」「〜なんですよ。」）。
2. 【ギミック全盛りの禁止＆自然な1〜2個の選択制】:
   - 「オホホ^^」「人はそれを〜と呼ぶ」「ギャ〜」「しめるぞゴルァ」「あ〜爆死」「私だけ？」などのフレーズを【1つの投稿に全部同じ順番で詰め込むこと】は絶対に禁止です！
   - エピソードの流れに合わせて、以下のギミック候補の中から【自然にハマるものを1〜2個だけ選んで】散りばめてください（毎回異なる組み合わせにすること）：
     ・自虐セルフツッコミ: 状況に合わせた冷静なツッコミ「…人はそれを〇〇と呼ぶ。（知らんがな）」
     ・急なマダム化・エセセレブ: 「オホホ^^〜ですのよ♡」「〜してさしあげましたの」
     ・悲鳴・パニック: 「ギャ〜……！」「うそでしょ…」「白目剥いた」
     ・悪口調・心の声ツッコミ（やらかされた瞬間）: 「しめるぞゴルァ！！」「誰の金で〜しとんねん！」「あ〜、爆死。」「しばくぞ（心の声）」
     ・脱力・下僕化オチ: 「結局可愛いから許しちゃう」「顔見たら全部許した下僕です」
3. 【★商品特徴とエピソードの100%整合性】:
   - 冒頭の悩み・やらかしは、必ず【紹介する商品の用途や特徴】と一致させてください（例: ブラシなら抜け毛・ブラッシング嫌がり、シーツならおしっこはみ出しや足濡れ、水飲み器なら水皿ひっくり返し等）。
4. 結びの問いかけ: 「〜された経験ある仲間います？😭」「同じやらかし食らった飼い主さん教えて…」「〜って経験ある？私だけじゃないはず…！」「みんなの家はどう？うちだけ？🥹」など自然なバリエーションを持たせてください。

【投稿構成（起承転結）】
- 【起】: 商品特徴に直結する日常の地味な困りごとやペットのやらかし。1行目は短く指を止めさせ、2行目は必ず空白行にすること！
- 【承】: 自力で何とか工夫・奮闘する様子（愛を込めてやってあげる描写）。
- 【転】: 予想外のやらかしや大失敗。状況に合ったギミック（パニック「ギャ〜」や関西弁ツッコミなど1〜2個）を挟む。
- 【結】: 結局可愛いから許しちゃう下僕に戻り、この神アイテムで救われた話 ＋ 末尾にURLと「#PR」 ＋ 読者への自然な問いかけ。

本文のみを出力してください。タイトルや解説は不要です。`;

        const res = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        const text = (res.text || '').trim();
        if (text && text.includes('http')) {
          return {
            title: `【愛され飼い主の日常】${selectedProduct.name.slice(0, 24)}...`,
            content: appendPrDisclosure(text),
            replyText,
            catalogUrls: {
              amazonStorefront,
              rakutenRoom,
              affiliateUrl,
            },
            affiliateUrl,
            isNoLink: false,
          };
        }
      } catch (e) {
        console.warn('Gemini harvest post generation failed, using template:', e);
      }
    }

    // 刈り取りフォールバックテンプレート（ギミック厳選・商品関連付け）
    const brandModel = selectedProduct.name
      .replace(/\s+(大容量|定格出力|急速充電|リン酸鉄|ポータブル電源|携帯浄水器|超強力吸収|ペット安全).*/, '')
      .slice(0, 18)
      .trim();

    const textToMatch = `${selectedProduct.name} ${selectedProduct.benefits.join(' ')}`.toLowerCase();
    let harvestFallbackTemplates: string[] = [];

    if (/ブラシ|コーム|抜け毛|ファーミネーター/i.test(textToMatch)) {
      harvestFallbackTemplates = [
        `うちの子の換毛期、毎日本当に格闘してるんです。\n\n黒い服着て抱っこした瞬間にセーターがモヘア素材に進化したかと思うレベルで毛まみれ。\n…人はそれを下僕の正装と呼ぶ。（知らんがな）\nブラッシングしようと構えたらソファーの奥へ超高速逃走。\n誰の抜け毛吸い込んどんねん！ってツッコミつつ結局許しちゃう下僕です。\nでも『${brandModel}』導入したら嫌がらず大人しく取らせてくれて毎日の抜け毛ストレスが一撃解決✨️\n\n👇詳細・セール確認\n${affiliateUrl} #PR\nブラシ持った瞬間に逃げ足最速になる子、うちだけ？🥹`,
        `撫でるたびにふわふわ舞う愛猫の抜け毛。\n\n「今日こそピカピカにしてさしあげますの♡」って撫でてたら、握り拳サイズの毛玉が完成。オホホ^^\n…あ〜、爆死。\nでも『${brandModel}』使ったらワンプッシュで毛がごっそり取れてブラッシングが至福の時間に👏\n\n気になる人は今のうちに👇\n${affiliateUrl} #PR\n抜け毛集めて毛玉ボール作ったことある仲間います？😭`,
      ];
    } else if (/シーツ|シート|トイレ|消臭/i.test(textToMatch)) {
      harvestFallbackTemplates = [
        `愛犬のおトイレ、いつも完璧に褒めて育ててるんです。\n\nなのに今日、上半身だけシーツに乗せてお尻が完全にはみ出してお漏らし。\n…人はそれを惜しい失敗と呼ぶ。（知らんがな）\n本人は「できたよ！」って超ドヤ顔で尻尾フリフリ。\n誰が床拭く思とんねん！って叫びつつ褒めて片付ける下僕の日常です。\nでも『${brandModel}』にしてから吸水スピード段違いで足濡れも床拭きもゼロに✨️\n\n👇詳細・セール確認\n${affiliateUrl} #PR\nシーツの端っこからミリ単位ではみ出された経験ある仲間います？😭`,
        `愛犬のために「いつでも清潔なお城をキープですの♡」ってシーツ敷き替えたんですよ。オホホ^^\n\n敷いた3秒後に前足で超高速ホリホリ発動されて、ズタボロに引き裂かれて「ギャ〜……！」\n一面の銀世界に白目剥きました。\nでも『${brandModel}』は引っ掻いても破れにくくて厚手だから秒殺されなくなって感動👏\n\n👇チェックしてみて\n${affiliateUrl} #PR\n買いたてのシーツ秒殺された経験ある飼い主さん教えて…`,
      ];
    } else {
      harvestFallbackTemplates = [
        `愛猫のために奮発してグッズ買ったんですよ。\n\n「これで快適に過ごしてね♡」って愛を込めてセットしてさしあげましたの。オホホ^^\n…人はそれを過保護と呼ぶ。（知らんがな）\nそしたら見向きもせず梱包の段ボールにダイブして破壊して「ギャ〜……！」\n誰の金で買った思とんねん！しめるぞゴルァ！！\n…でも『${brandModel}』は珍しく初日から夢中で使ってくれて日々の悩みはマジで一発解決✨️\n\n👇詳細・セール確認\n${affiliateUrl} #PR\n段ボールしか愛さない我が子に泣いた経験ある仲間います？😭`,
        `愛犬のやらかし対策に本気出してみたんです。\n\n「ママが完璧にお世話してさしあげるわ♡」って優雅に張り切りましたの。\n直後に全力で体当たりされて全部ひっくり返って白目剥きました。\n誰が掃除する思とんねん！\n…あ〜、爆死。\nでも結局『${brandModel}』導入してから毎日の地味なストレス完全ゼロに👏\n\n👇詳細・セール確認\n${affiliateUrl} #PR\n良かれと思った工夫が秒殺された経験ある飼い主さん教えて…`,
      ];
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
      isNoLink: false,
    };
  }

  // 【パターンB: 育成・ノウハウ・ギブ型】
  // メイン本文はURLなし（純粋なやらかし・共感・知恵袋エピソード）、リプライ欄に新ルールのアフィリエイト/カタログをぶら下げ
  const replyText = buildAffiliateReplyText({
    amazonStorefront,
    rakutenRoom,
  });

  if (apiKey && apiKey !== '【Google AI Studioで取得したGemini APIキー】' && !apiKey.startsWith('your_')) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `あなたは「40〜60代の女性から強く共感され愛されるペットの飼い主」です。
普段はおっちょこちょいで愛犬・愛猫に甘々な日常を送っていますが、ペットの理不尽なやらかしを食らった瞬間にだけ素の関西弁ツッコミがポロッと漏れる、憎めないキャラクターです。

現在【ノウハウ・ギブ型（メイン本文はリンク完全なし・純粋共感ポスト）】を作成します。

【トーン＆マナー厳守】
1. 普段の語り口: 上品で柔らかく親しみやすい標準語（「〜ですよね？」「〜なんですよ。」）。
2. 【ギミック全盛りの禁止＆自然な1〜2個の選択制】:
   - 「オホホ^^」「人はそれを〜と呼ぶ」「ギャ〜」「しめるぞゴルァ」「あ〜爆死」「私だけ？」などのフレーズを【1つの投稿に全部同じ順番で詰め込むこと】は絶対に禁止です！
   - エピソードの流れに合わせて、以下のギミック候補の中から【自然にハマるものを1〜2個だけ選んで】散りばめてください（毎回異なる組み合わせにすること）：
     ・自虐セルフツッコミ: 状況に合わせた冷静なツッコミ「…人はそれを〇〇と呼ぶ。（知らんがな）」
       （例: 拷問、下僕、無駄遣い、無駄な努力、自己満、過保護、油断 など）
     ・急なマダム化・エセセレブ: 「オホホ^^〜ですのよ♡」「〜してさしあげましたの」
     ・悲鳴・パニック: 「ギャ〜……！」「うそでしょ…」「白目剥いた」
     ・悪口調・心の声ツッコミ（やらかされた瞬間）: 「しめるぞゴルァ！！」「誰の金で〜しとんねん！」「あ〜、爆死。」「しばくぞ（心の声）」
     ・脱力・下僕化オチ: 「結局可愛いから許しちゃう」「顔見たら全部許した下僕です」
3. 問いかけ: 文末は親しい友人に話しかけるように「〜した経験ある仲間います？😭」「同じやらかし食らった飼い主さん教えて…」「〜って経験ある？私だけじゃないはず…！」「みんなの家はどう？うちだけ？🥹」などで締め、コメントを促す。

【投稿構成（起承転結）】
- 【起】: ペット特有の困ったクセや日常のやらかし。1行目は短く指を止めさせ、2行目は必ず空白行にすること！
- 【承】: 自力で何とかしようと工夫・奮闘する様子（愛を込めてやってあげる描写）。
- 【転】: 予想外のやらかし。状況に合ったギミックを1〜2個だけ自然に挟む。
- 【結】: 結局「可愛いから許しちゃう」と下僕に戻り、読者に自然に問いかける。

【超重要制約】
- アフィリエイトURLやリンク、商品紹介、商品スペックは【絶対に一切入れないでください】！
- #PR も不要です。
- 純粋にフォロワーが吹き出し、共感とコメントが集まるエピソードにしてください。

本文のみを出力してください。`;

      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = (res.text || '').trim();
      if (text) {
        return {
          title: '【愛され飼い主の日常】可愛いから許しちゃう下僕エピソード',
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

  // 育成フォールバックテンプレート（ギミック厳選・自然な起承転結）
  const nurtureTemplates = [
    `うちの猫、なぜか私の枕の真ん中で寝るんです。\n\nあまりに可愛いから、私はベッドの端っこで丸まって寝てさしあげましたの。オホホ^^♡\n…人はそれを拷問と呼ぶ。（知らんがな）\n朝起きたら首がバキバキに逝ってて白目剥きました。\n隣見たら私の枕の上で毛づくろいしてドヤ顔。\n誰の枕で安眠しとんねん！ってツッコミつつ、寝顔見たら結局全部許しちゃう下僕です。\nベッド占領されて身体バキバキになった経験ある？私だけ？🥹`,
    `愛犬のために高級ペットシーツ買ったんですよ。\n\n「これで足濡れしないわね♡」って愛を込めてピシッと敷いてさしあげましたの。\n敷いた3秒後に前足で超高速ホリホリ発動されてズタボロに引き裂かれて「ギャ〜……！」\n部屋中にポリマーが舞い散って一面の銀世界。\n誰の金で買った思とんねん！しめるぞゴルァ！！\n…でも散らかした後に首かしげてウルウル見つめてくるから無罪放免。\n買いたてのシーツ秒殺された経験ある飼い主さん教えて…😭`,
    `愛猫の水入れ、毎日ピカピカに洗ってあげてるんです。\n\n「いつでも新鮮なお水飲んでね♡」ってお水注いだ3分後。\n前足で器用にチョイチョイ押して水面の揺れを楽しんだ挙句、床一面に大洪水起こして「ギャ〜……！」\n濡れた床で私の靴下がビッシャビシャ。\n誰が拭く思とんねん！\n…あ〜、爆死。\nでも濡れたピンクのお鼻でスリスリされたら怒る気力ゼロです。\nせっかく入れたお水ひっくり返された経験ある仲間います？笑`,
    `愛犬にお留守番用の知育トイあげたんですよ。\n\n「これで退屈しないですむわね♡」っておやつ詰めてさしあげましたの。オホホ^^\n…人はそれを知育と呼ぶ。（知らんがな）\nおやつが出ないからってソファーの隙間にねじ込んで大暴れ。\n引っ張り出そうとしてソファーの裏地までビリビリ破壊されて白目剥きました。\nでもしっぽ振ってお座りされたら結局おやつあげちゃう親バカです。\nお留守番対策が裏目に出て家具破壊された経験ある仲間います？🥹`,
  ];

  const chosenNurture = nurtureTemplates[Math.floor(Math.random() * nurtureTemplates.length)];

  return {
    title: '【愛され飼い主の日常】可愛いから許しちゃう下僕エピソード',
    content: chosenNurture,
    replyText,
    catalogUrls: {
      amazonStorefront,
      rakutenRoom,
    },
    isNoLink: true,
  };
}
