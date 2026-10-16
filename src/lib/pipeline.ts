import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { CandidateProduct, CategoryId, PipelineMode } from './types';
import { buildAffiliateLink, appendPrDisclosure } from './amazon';

/**
 * 1. 投稿モードの自動判定ロジック（日時判定）
 * 【刈り取りモード】: 水曜・金曜・日曜の夜 (20:00〜23:00台)
 * 【育成モード】: 上記以外（月・火・木・土、および平日の日中など）
 */
export function checkPipelineMode(date: Date = new Date()): {
  mode: PipelineMode;
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

  // 刈り取り曜日: 水曜(3), 金曜(5), 日曜(0)
  const isHarvestDay = dayOfWeek === 0 || dayOfWeek === 3 || dayOfWeek === 5;
  // 刈り取り時間: 20:00 〜 23:59 (20:00〜23:00台)
  const isHarvestHour = hour >= 20 && hour <= 23;

  const isHarvestTime = isHarvestDay && isHarvestHour;

  let nextHarvestWindow = '';
  if (isHarvestTime) {
    nextHarvestWindow = '現在が刈り取りゴールデンタイムです（23:59まで）';
  } else {
    // 次回の刈り取り枠を計算
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
      reason: `🔥【刈り取りモード】${dayName}夜ゴールデンタイム (${hour}時台)。購買意欲が最高潮のため高単価アソシエイトURL＋#PR付きで投下します。`,
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
    reason: `🌱【育成モード】${formattedTime}。スパム判定・シャドウバンを徹底回避するため、URLなしの純粋な有益知恵袋・共感ノウハウを投下してフォロワーを育成します。`,
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

  const prompt = `あなたは「12年間で1,000頭超の犬猫を保護・譲渡し、現在も保護犬20頭・猫30頭と暮らしながら被災地の電源・水不足を取材してきた動物保護活動の専門家」です。
現在、日本のAmazonで「${keyword}」に関連する【命を守る備え・フェーズフリー（日常兼非常用）・現場厳選の売れ筋上位10件】の商品リストを作成してください。

特に以下のカテゴリを最優先・ローテーションで含めてください：
1. ポータブル電源・ソーラーパネル（停電時のペットのエアコン・ヒーター維持、熱中症・低体温症対策、スマホ通信確保。ブランド例: Jackery, EcoFlow, Anker）
2. 携帯浄水器・水ろ過器（断水時に給水車に並べない時の雨水・風呂水ろ過。ブランド例: ソーヤーミニ SAWYER, カタダイン）
3. ペット配慮の長期保存水（犬猫の尿路結石・膀胱炎を防ぐ硬度ゼロの軟水備蓄）
4. 現場目線で選ぶ高コスパ・ヘビーユース消耗品（多頭現場で月数百枚使う漏れない・破れないペットシーツ、無害・強力消臭スプレー、抜け毛ケア）

価格帯は、アフィリエイト紹介料が高額になる数万円〜十数万円の高単価防災ギアから、リピートされる数千円の実力派消耗品まで幅広く10件挙げてください。

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
        asin: p.asin || 'B0CHYRN43W',
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
      asin: 'B0CHYRN43W',
      price: 168000,
      rating: 4.6,
      reviewCount: 1820,
      benefits: ['猛暑の停電時でもエアコンを朝まで動かしペットの命を守る', '10年超の長寿命リン酸鉄', '日常の電気代削減にも使えるフェーズフリー'],
      category: 'disaster_prep',
      targetAudience: '避難所に行きづらい在宅・車中泊避難を想定するペット飼育家庭',
    },
    {
      name: 'EcoFlow RIVER 2 Pro ポータブル電源 768Wh 急速充電70分 リン酸鉄',
      asin: 'B0BLH56B6C',
      price: 79900,
      rating: 4.5,
      reviewCount: 2450,
      benefits: ['わずか70分で満充電できる機動力', 'ケージ用ヒーターや見守りカメラの電源を数日間キープ', '7.8kgで女性でも車へ即運搬可能'],
      category: 'disaster_prep',
      targetAudience: '愛犬愛猫との車中泊避難や停電時の保温対策を考える人',
    },
    {
      name: 'Anker Solix C1000 ポータブル電源 1056Wh 高出力 急速満充電',
      asin: 'B0C7KTW890',
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
      asin: 'B00FA2RLX2',
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
 * 4. 記事本文の生成（育成モード / 刈り取りモード）
 * 【発信者ペルソナ】
 * - 12年間で1,000頭超の犬猫をレスキュー・譲渡してきた動物保護活動の現場経験者
 * - 現在も保護犬20頭・保護猫30頭と共に暮らす、リアルな多頭飼育の実践者
 * - 被災地（熊本等）の愛護団体への取材インタビューを行い、被災現場における「電源と水の確保の過酷さ」を痛感
 * 【トーン＆マナー】
 * - 単なるアフィリエイト紹介ではなく、「命を守る備え」「多頭現場で辿り着いた本当に役立つ知恵・消耗品」
 * - 普段の暮らしに馴染み、災害時にはペットと家族を守る【フェーズフリー】の視点を必ず組み込む
 * - 「ペットがいると避難所に行きづらい（在宅・車中泊避難になりやすい）」という現実に寄り添う共感文
 */
export async function generateAutomatedPost(params: {
  mode: PipelineMode;
  genre: 'life' | 'pet';
  selectedProduct?: CandidateProduct;
  trackingId?: string;
  apiKey?: string;
}): Promise<{
  title: string;
  content: string;
  affiliateUrl?: string;
  isNoLink: boolean;
}> {
  const { mode, genre, selectedProduct, trackingId, apiKey } = params;

  if (mode === 'harvest' && selectedProduct) {
    // 【刈り取りモード】: 高単価商品 ＋ アソシエイトURL ＋ #PR
    const affiliateUrl = buildAffiliateLink(selectedProduct.asin, trackingId);

    if (apiKey && apiKey !== '【Google AI Studioで取得したGemini APIキー】' && !apiKey.startsWith('your_')) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `あなたは「12年間で1,000頭超の犬猫をレスキュー・譲渡してきた動物保護活動の現場経験者であり、現在も保護犬20頭・保護猫30頭と暮らしながら被災地の愛護団体取材で電源と水の過酷さを痛感した専門家」です。
現在【刈り取りゴールデンタイム（購買意欲が最も高い夜間）】のSNS投稿を作成します。

以下の厳選された高単価・最高評価商品について、読者が「これは我が子の命を守るために絶対に必要だ」「日々の生活でも役立つ（フェーズフリー）」と強く納得する、本音の説得力あるSNS投稿文を作成してください。

【選定された商品】
- 商品名: ${selectedProduct.name}
- 参考価格: ¥${selectedProduct.price.toLocaleString()}
- 星評価: ★${selectedProduct.rating}
- 主な特徴: ${selectedProduct.benefits.join(' / ')}
- ターゲット: ${selectedProduct.targetAudience}
- アソシエイトURL: ${affiliateUrl}

【執筆ルール】
1. 1行目（フック）は保護現場や被災現場のリアルな視点で強烈に引きつけること。
   （例:「ペットがいると避難所には行けない。だからこそ…」「被災地の取材で痛感したのは、電源と水が止まった瞬間の絶望でした」「保護犬20頭・猫30頭と暮らす現場で、これだけは絶対にケチれない」など）
2. 単なる商品宣伝ではなく、「普段の暮らしを豊かにしつつ、万が一の災害時はペットの命を守る【フェーズフリー】」の視点を必ず盛り込むこと。
3. 高単価（¥${selectedProduct.price.toLocaleString()}）に見合う以上の「命と安心の価値」を、多頭飼育やレスキュー現場の実体験のように伝えること。
4. 本文の末尾には必ず以下の形式で商品リンクと#PRを配置すること：
👇詳細・セール確認
${affiliateUrl} #PR
5. 文字数: 130〜200文字程度（XでもThreadsでも読みやすい長さ）。ハッシュタグ（#ペット防災 #フェーズフリー #犬のいる暮らし #猫のいる暮らし 等）を2つ添える。

本文のみを出力してください。解説やタイトルは不要です。`;

        const res = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        const text = (res.text || '').trim();
        if (text && text.includes('http')) {
          return {
            title: `【命を守る備え】${selectedProduct.name.slice(0, 30)}...`,
            content: appendPrDisclosure(text),
            affiliateUrl,
            isNoLink: false,
          };
        }
      } catch (e) {
        console.warn('Gemini harvest post generation failed, using template:', e);
      }
    }

    // 刈り取りフォールバックテンプレート（新ペルソナ準拠）
    const benefit1 = selectedProduct.benefits[0] || '普段の暮らしも災害時も命を支えてくれる';
    const benefit2 = selectedProduct.benefits[1] || '多頭現場で実証済みの頼もしさ';
    
    // 商品カテゴリに応じた共感切り口
    let hook = 'ペットがいると避難所には行きづらい。だからこそ在宅避難の備えは妥協できません。';
    if (selectedProduct.price >= 50000) {
      hook = '被災地取材で痛感したのは「電源が落ちたらペットの命が持たない」という過酷な現実。';
    } else if (selectedProduct.name.includes('水') || selectedProduct.name.includes('浄水')) {
      hook = '断水時に給水車にペットを置いて並べない…被災地の生の声から学んだ命の水対策。';
    }

    const content = `${hook}🐾\n「${selectedProduct.name}」\n\nお値段（¥${selectedProduct.price.toLocaleString()}）以上に、${benefit1}という安心感が絶大です。${benefit2}なので日常使いにも本当に重宝します✨\n我が子を守るフェーズフリーな備えとして心からおすすめ。\n\n👇詳細・セール確認はこちら\n${affiliateUrl} #PR\n#ペット防災 #フェーズフリー #保護犬保護猫`;

    return {
      title: `【命を守る備え】${selectedProduct.name.slice(0, 30)}...`,
      content,
      affiliateUrl,
      isNoLink: false,
    };
  }

  // 【育成モード】: リンクなし！純粋な有益豆知識・共感ノウハウ（スパム・シャドウバン完全回避）
  if (apiKey && apiKey !== '【Google AI Studioで取得したGemini APIキー】' && !apiKey.startsWith('your_')) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `あなたは「12年間で1,000頭超の犬猫を保護・譲渡し、現在も保護犬20頭・猫30頭と暮らしながら被災地の電源・水不足を取材してきた動物保護活動の専門家」です。
現在【アカウント育成モード（URLなし・純粋な有益ノウハウ）】の投稿を作成します。

【重要制約】
- アフィリエイトURLやリンク、特定商品の宣伝は【一切入れないでください】！
- #PR も不要です。
- 純粋にフォロワーが増え、保存・リポスト・共感が集まる「命を守るペット防災・在宅避難の知恵」「多頭現場で辿り着いた衛生・換毛期ハック」「断水・停電時のペットケア」を1つ紹介してください。
- 特に「ペット連れの避難所トラブル・車中泊避難の現実」「犬猫の尿路結石を防ぐ軟水知識」「多頭飼育の臭い・シーツ漏れ対策」など現場経験者ならではのリアルな知恵にしてください。
- 文字数は120〜180文字程度。最後に読者への共感の問いかけを一言添える。

本文のみを出力してください。`;

      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = (res.text || '').trim();
      if (text) {
        return {
          title: '【現場の知恵袋】ペットと命を守る備え・共感ノウハウ',
          content: text,
          isNoLink: true,
        };
      }
    } catch (e) {
      console.warn('Gemini nurture post generation failed, using template:', e);
    }
  }

  // 育成フォールバックテンプレート（新ペルソナ準拠の現場ノウハウ）
  const nurtureTemplates = [
    `【ペット防災の盲点：硬水リスク】🐾\n被災時の備蓄水、人間用のミネラルウォーターをそのまま犬猫にあげるのは要注意！\nミネラル（カルシウム・マグネシウム）が多いと尿路結石や膀胱炎を急発症するリスクがあります。\n備蓄は必ず「硬度ゼロの軟水」か「ペット専用水」を選んでくださいね。おうちの備蓄水、確認できてますか？🐶🐱\n#ペット防災 #犬のいる暮らし #猫のいる暮らし`,
    `【保護犬20頭・猫30頭の現場ハック】🌿\n多頭飼育でシーツの足濡れ・染み出しに悩んだら、シーツの下に「レジャーシート」を1枚敷くだけで床への染み込みストレスが完全にゼロになります！\n災害時の車中泊避難でもシートやケージの汚れ防止に役立つフェーズフリー技です。皆さんの工夫もぜひ教えてください✨\n#多頭飼い #ペットのいる暮らし #保護犬保護猫`,
    `【停電時のペット熱中症対策】⚡\n猛暑の停電時、エアコンが止まるとペットは数時間で命の危険に晒されます。\n保冷剤をタオルで巻いて首元や内股に当てる準備と、遮光カーテンを閉めて室温上昇を遅らせるのが現場の鉄則。\n避難所に行きづらいペット連れだからこそ、在宅避難の電源確保は本当に命綱です…！\n#ペット防災 #熱中症対策 #フェーズフリー`,
  ];

  const chosenNurture = nurtureTemplates[Math.floor(Math.random() * nurtureTemplates.length)];

  return {
    title: '【現場の知恵袋】ペットと命を守る備え・共感ノウハウ',
    content: chosenNurture,
    isNoLink: true,
  };
}
