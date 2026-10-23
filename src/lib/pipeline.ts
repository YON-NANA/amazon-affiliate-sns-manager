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
 * 【役割・キャラクター設定】
 * - 40〜60代の女性から強く共感され、愛されるペットの飼い主
 * - 普段はおっちょこちょいで愛犬・愛猫に甘々な日常を送るが、ペットの理不尽なやらかしを食らった瞬間にだけ素の関西弁ツッコミがポロッと漏れる
 * 【トーン＆マナー】
 * 1. 普段: 上品で柔らかく親しみやすい標準語（「〜ですよね？」「〜なんですよ。」）
 * 2. 自虐・クールなセルフツッコミ: 状況に合わせて言葉を変える「…人はそれを拷問（または下僕/無駄遣い）と呼ぶ。（知らんがな）」
 * 3. ギミック（愛嬌のあるツッコミ）: 失敗パニック「ギャ〜……！」 / 急なマダム化「オホホ^^〜ですのよ♡」 / 関西弁ツッコミ「誰が掃除する思とんねん！笑」「あ〜、爆死。」
 *    ※暴言・威圧的な言葉（「しめるぞ」「ゴルァ」「しばく」等）は利用規約リスク防止のため完全禁止！
 * 4. 問いかけ: 文末は親しい友人に話しかけるように「〜した経験ある仲間います？😭」「みんなの家はどう？うちだけ？🥹」
 * 【超重要運用方針：メイン本文のリンク完全撤廃】
 * - メイン本文（親ポスト）にはURLや#PRを一切含めず、純粋な共感ストーリーで完結させる（isNoLink: true）。
 * - アフィリエイトURLおよびカタログURLは100%ぶら下げリプライ側に配置する。
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
    // メイン本文は共感ストーリー＋解決フックで引き込み、アフィリエイトリンクは100%ぶら下げリプライへ配置
    const affiliateUrl = buildAffiliateLink(selectedProduct.asin, trackingId, { productName: selectedProduct.name });

    // 商品ジャンルと文脈を厳密に判定
    const productGenreInfo = detectProductGenre(
      selectedProduct.name,
      selectedProduct.benefits,
      selectedProduct.category
    );

    // リプライ用テキスト（導入＋真面目レビュー＋締めワード＋アフィリエイトリンク ※PR）
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

以下の商品を使って、読者が思わずクスッと笑って激しく共感し、コメントしたくなるSNS投稿（X・Threads親ポスト向け）を作成してください。

【紹介商品】
- 商品名: ${selectedProduct.name}
- 特徴・メリット: ${selectedProduct.benefits.join(' / ')}
- ターゲット: ${selectedProduct.targetAudience}

============================================================
【★最重要ルール1：商品ジャンルの文脈厳守】
============================================================
${productGenreInfo.contextGuidance}
※商品の用途と全く合わないエピソード（例: ポータブル電源をおもちゃにする、シーツなのに抜け毛の話をする等）は【文脈崩壊の事故になるため絶対に厳禁】です！

============================================================
【★最重要ルール2：絶対禁止ワード・暴力表現の完全根絶（アカウント凍結防止）】
============================================================
XやThreadsの利用規約（暴力的な脅迫・ヘイト）違反によるアカウント凍結を絶対に防ぐため、以下の過激な表現は【出力に一切含めないでください】！
❌ 絶対禁止ワード：
- 「しめるぞ」「ゴルァ」「しばく」「殺す」「殴る」「ぶっ飛ばす」「死ね」等の暴力・脅迫表現
⭕ 代わりに使用する愛嬌・ユーモアのあるツッコミ表現（1〜2個だけ自然に選択）：
- 「誰の抜け毛吸い込んどんねん」「誰が掃除する思とんねん！笑」「勘弁して〜！」「白目剥いた」「ギャ〜……！」「うそでしょ…」「あ〜、爆死。」「結局可愛くて許しちゃう下僕です」

============================================================
【★最重要ルール3：メイン本文へのURL・PR表記の完全記載禁止】
============================================================
- メイン本文（親ポスト）には、URL（http/https）、アフィリエイトリンク、および「#PR」「PR」を【絶対に一切入れないでください】！
- リンクとPR表記はすべて自動ぶら下げリプライ欄に入ります。親ポストにリンクを入れるとSNSアルゴリズムで表示が激減するペナルティを受けるため厳禁です。
- 本文の結びは、商品の自然な感想（例: 「『${selectedProduct.name.slice(0, 15)}』のおかげで日々の悩みが解決した」等）＋ 読者への共感の問いかけで締めくくってください。

============================================================
【投稿構成（起承転結）】
============================================================
- 【起】: 商品特徴・用途に直結する日常の困りごとやペットのハプニング。1行目は短く指を止めさせ、2行目は必ず空白行にすること！
- 【承】: 自力で何とかしようと工夫・奮闘する様子（愛を込めてやってあげる描写）。
- 【転】: 予想外のハプニングや失敗。愛嬌のあるツッコミ（「白目剥いた」「誰が掃除する思とんねん！笑」等）を1〜2個だけ自然に挟む。
- 【結】: この神アイテムで救われた話 ＋ 親しいフォロワーへの自然な問いかけ（「〜された経験ある仲間います？😭」「みんなの家はどう？うちだけ？🥹」など）。

本文のみを出力してください。タイトルや解説は不要です。`;

        const res = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        let text = (res.text || '').trim();
        // 万が一URLやPRが混入していた場合のサニタイズ（安全除去）
        text = text
          .replace(/https?:\/\/[^\s]+/g, '')
          .replace(/#PR|#pr|PR/g, '')
          .replace(/しめるぞ|ゴルァ|しばくぞ/g, '勘弁して〜！')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        if (text && text.length > 30) {
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
            isNoLink: true, // メイン本文はリンク完全なし！
          };
        }
      } catch (e) {
        console.warn('Gemini harvest post generation failed, using template:', e);
      }
    }

    // 刈り取りフォールバックテンプレート（商品ジャンル別・暴言ゼロ・本文URLゼロ）
    const brandModel = selectedProduct.name
      .replace(/\s+(大容量|定格出力|急速充電|リン酸鉄|ポータブル電源|携帯浄水器|超強力吸収|ペット安全).*/, '')
      .slice(0, 18)
      .trim();

    let harvestFallbackTemplates: string[] = [];

    switch (productGenreInfo.genre) {
      case 'disaster_power':
        harvestFallbackTemplates = [
          `真夏のゲリラ豪雨で突然停電したことあるんです。\n\nエアコン止まって部屋がサウナ化して我が子がハァハァし出して「ギャ〜……！」\n…人はそれを下僕のパニックと呼ぶ。（知らんがな）\nでも『${brandModel}』を常備してたおかげで扇風機と冷感マットを即稼働できて事なきを得ました✨️\nペットがいる家庭のポータブル電源、マジで命綱だと痛感…！\nペットの停電対策、みんなどうしてる？うちだけ？🥹`,
          `冬の寒波で夜中に突然の停電。\n\nペット用ホットカーペットが切れて我が子がガタガタ震えて白目剥きました。\n…あ〜、爆死。\nでも『${brandModel}』があったおかげで朝まで暖房を維持できて本当に救われました👏\n言葉が話せない我が子の命を守る備え、本当に大事ですね。\n突然の停電でヒヤッとした経験ある飼い主さん教えて…😭`,
        ];
        break;

      case 'disaster_water':
        harvestFallbackTemplates = [
          `近所の水道管工事で半日断水になった時の話。\n\n人間用のお水は確保してたのに、愛犬の水飲み皿をうっかり倒されて床ビシャビシャ＆水切れ発生で「ギャ〜……！」\n誰が拭く思とんねん！って叫びつつパニック。\nでも『${brandModel}』のおかげで安全なお水をすぐ用意できて本当に助かりました✨️\nお腹を壊しやすい我が子の飲み水確保、ペット防災の最重要課題ですね。\n断水や水トラブルで焦った経験ある仲間います？😭`,
        ];
        break;

      case 'disaster_general':
        harvestFallbackTemplates = [
          `ペット防災リュックを久しぶりに点検したんです。\n\n非常食の賞味期限を見たら半年前に切れてて「うそでしょ…」。\n…人はそれを完全な油断と呼ぶ。（知らんがな）\nでも『${brandModel}』を見直して常備し直したら心の安心感が段違いになりました✨️\n我が子の命を守れるのは飼い主だけですからね…！\nペットの防災袋、最近点検した人います？私だけ放置してた？🥹`,
        ];
        break;

      case 'pet_brush':
        harvestFallbackTemplates = [
          `うちの子の換毛期、毎日本当に格闘してるんです。\n\n黒い服着て抱っこした瞬間にセーターがモヘア素材に進化したかと思うレベルで毛まみれ。\n…人はそれを下僕の正装と呼ぶ。（知らんがな）\nブラッシングしようと構えたらソファーの奥へ超高速逃走。\n誰の抜け毛吸い込んどんねん！ってツッコミつつ結局許しちゃう下僕です。\nでも『${brandModel}』導入したら嫌がらず大人しく取らせてくれて毎日の抜け毛ストレスが一撃解決✨️\nブラシ持った瞬間に逃げ足最速になる子、うちだけ？🥹`,
          `撫でるたびにふわふわ舞う愛猫の抜け毛。\n\n「今日こそピカピカにしてさしあげますの♡」って撫でてたら、握り拳サイズの毛玉が完成。オホホ^^\n…あ〜、爆死。\nでも『${brandModel}』使ったらワンプッシュで毛がごっそり取れてブラッシングが至福の時間になりました👏\n抜け毛集めて毛玉ボール作ったことある仲間います？😭`,
        ];
        break;

      case 'pet_sheets':
        harvestFallbackTemplates = [
          `愛犬のおトイレ、いつも完璧に褒めて育ててるんです。\n\nなのに今日、上半身だけシーツに乗せてお尻が完全にはみ出してお漏らし。\n…人はそれを惜しい失敗と呼ぶ。（知らんがな）\n本人は「できたよ！」って超ドヤ顔で尻尾フリフリ。\n誰が床拭く思とんねん！って叫びつつ褒めて片付ける下僕の日常です。\nでも『${brandModel}』にしてから吸水スピード段違いで足濡れも床拭きもゼロに✨️\nシーツの端っこからミリ単位ではみ出された経験ある仲間います？😭`,
          `愛犬のために「いつでも清潔なお城をキープですの♡」ってシーツ敷き替えたんですよ。オホホ^^\n\n敷いた3秒後に前足で超高速ホリホリ発動されて、ズタボロに引き裂かれて「ギャ〜……！」\n一面の銀世界に白目剥きました。\nでも『${brandModel}』は引っ掻いても破れにくくて厚手だから秒殺されなくなって感動👏\n買いたてのシーツ秒殺された経験ある飼い主さん教えて…`,
        ];
        break;

      case 'pet_water':
        harvestFallbackTemplates = [
          `愛猫の水入れ、毎日ピカピカに洗ってあげてるんです。\n\n「いつでも新鮮なお水飲んでね♡」ってお水注いだ3分後。\n前足で器用にチョイチョイ押して水面の揺れを楽しんだ挙句、床一面に大洪水起こして「ギャ〜……！」\n濡れた床で私の靴下がビッシャビシャ。\n誰が拭く思とんねん！勘弁して〜！笑\nでも『${brandModel}』にしてからひっくり返されなくなって床の洪水事件から完全解放されました✨️\nせっかく入れたお水ひっくり返された経験ある仲間います？😭`,
        ];
        break;

      case 'camp_outdoor':
        harvestFallbackTemplates = [
          `ペットと一緒に大自然の中で迎える朝。\n\n「これぞ丁寧な休日ですの♡」って優雅に淹れたコーヒーの横で、愛犬が泥水にダイブして「ギャ〜……！」。\n…あ〜、爆死。\nでも『${brandModel}』のおかげでアウトドアの快適さと安心感が段違いになりました✨️\nアウトドアでペットに洗礼食らった経験ある仲間います？笑`,
        ];
        break;

      default:
        harvestFallbackTemplates = [
          `愛猫のために奮発してグッズ買ったんですよ。\n\n「これで快適に過ごしてね♡」って愛を込めてセットしてさしあげましたの。オホホ^^\n…人はそれを過保護と呼ぶ。（知らんがな）\nそしたら見向きもせず梱包の段ボールにダイブして破壊して「ギャ〜……！」\n誰が片付ける思とんねん！勘弁して〜！笑\nでも『${brandModel}』は珍しく初日から気に入って使ってくれて日々の悩みはマジで一発解決✨️\n段ボールしか愛さない我が子に泣いた経験ある仲間います？😭`,
          `愛犬のやらかし対策に本気出してみたんです。\n\n「ママが完璧にお世話してさしあげるわ♡」って優雅に張り切りましたの。\n直後に全力で体当たりされて全部ひっくり返って白目剥きました。\n誰が掃除する思とんねん！\n…あ〜、爆死。\nでも結局『${brandModel}』導入してから毎日の地味なストレス完全ゼロに👏\n良かれと思った工夫が秒殺された経験ある飼い主さん教えて…`,
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
      isNoLink: true, // メイン本文はリンク完全なし！
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
2. 【★絶対禁止ワード・暴力表現の完全根絶（アカウント凍結防止）】:
   - 「しめるぞ」「ゴルァ」「しばく」「殺す」「殴る」などの暴力・脅迫表現は【絶対に出力禁止】です！
3. 【ギミック候補（1〜2個だけ自然に選択）】:
   - 自虐セルフツッコミ: 状況に合わせた冷静なツッコミ「…人はそれを〇〇と呼ぶ。（知らんがな）」
     （例: 拷問、下僕、無駄遣い、無駄な努力、自己満、過保護、油断 など）
   - 急なマダム化・エセセレブ: 「オホホ^^〜ですのよ♡」「〜してさしあげましたの」
   - 悲鳴・パニック: 「ギャ〜……！」、「うそでしょ…」、「白目剥いた」
   - 愛嬌のある関西弁ツッコミ: 「誰が掃除する思とんねん！笑」「誰の抜け毛吸い込んどんねん」「あ〜、爆死。」「勘弁して〜！」
   - 脱力・下僕化オチ: 「結局可愛いから許しちゃう」「顔見たら全部許した下僕です」
4. 問いかけ: 文末は親しい友人に話しかけるように「〜した経験ある仲間います？😭」「同じやらかし食らった飼い主さん教えて…」「〜って経験ある？私だけじゃないはず…！」「みんなの家はどう？うちだけ？🥹」などで締め、コメントを促す。

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

      let text = (res.text || '').trim();
      text = text
        .replace(/https?:\/\/[^\s]+/g, '')
        .replace(/#PR|#pr|PR/g, '')
        .replace(/しめるぞ|ゴルァ|しばくぞ/g, '勘弁して〜！')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

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

  // 育成フォールバックテンプレート（ギミック厳選・自然な起承転結・暴言ゼロ）
  const nurtureTemplates = [
    `うちの猫、なぜか私の枕の真ん中で寝るんです。\n\nあまりに可愛いから、私はベッドの端っこで丸まって寝てさしあげましたの。オホホ^^♡\n…人はそれを拷問と呼ぶ。（知らんがな）\n朝起きたら首がバキバキに逝ってて白目剥きました。\n隣見たら私の枕の上で毛づくろいしてドヤ顔。\n誰の枕で安眠しとんねん！ってツッコミつつ、寝顔見たら結局全部許しちゃう下僕です。\nベッド占領されて身体バキバキになった経験ある？私だけ？🥹`,
    `愛犬のために高級ペットシーツ買ったんですよ。\n\n「これで足濡れしないわね♡」って愛を込めてピシッと敷いてさしあげましたの。\n敷いた3秒後に前足で超高速ホリホリ発動されてズタボロに引き裂かれて「ギャ〜……！」\n部屋中にポリマーが舞い散って一面の銀世界。\n誰の金で買った思とんねん！勘弁して〜！笑\n…でも散らかした後に首かしげてウルウル見つめてくるから無罪放免。\n買いたてのシーツ秒殺された経験ある飼い主さん教えて…😭`,
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
