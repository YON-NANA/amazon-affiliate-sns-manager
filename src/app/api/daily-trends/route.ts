import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { DailyTrendIdea } from '@/lib/types';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const genre = searchParams.get('genre') || 'all'; // 'all' | 'life' | 'pet'

    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const seasonString = `${month}月${day}日`;

    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (apiKey && apiKey !== '【Google AI Studioで取得したGemini APIキー】' && !apiKey.startsWith('your_')) {
      try {
        const trends = await generateDailyTrendsWithGemini(apiKey, seasonString, genre);
        if (trends && trends.length > 0) {
          return NextResponse.json({
            trends,
            source: 'gemini',
            seasonContext: `${month}月の旬トレンド`,
          });
        }
      } catch (e) {
        console.warn('Gemini daily trends generation failed, fallback:', e);
      }
    }

    // High quality seasonal fallback trends
    const fallbackTrends = getSeasonalFallbackTrends(month, genre);
    return NextResponse.json({
      trends: fallbackTrends,
      source: 'seasonal_template',
      seasonContext: `${month}月の旬トレンド（高品質アルゴリズム提案）`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to generate trends' }, { status: 500 });
  }
}

async function generateDailyTrendsWithGemini(apiKey: string, dateStr: string, genreFilter: string): Promise<DailyTrendIdea[]> {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `あなたは「暮らし・日用品・ペット用品」のAmazonアフィリエイトマーケティングのトッププランナーです。
今日の日付は【${dateStr}】です。

現在の季節・気候・人々の悩み（例: 秋の換毛期、花粉、寒暖差、大掃除、新生活、梅雨の湿気、害虫対策、冬の乾燥、ペットの飲水量低下など）に特化した、
「今Amazonで検索されやすく、SNS（X / Threads）で爆発的に伸びる売れ筋商品企画・検索キーワード」を6件提案してください。

ジャンル指定: ${genreFilter === 'all' ? '暮らし・日用品とペット用品を半々で' : genreFilter === 'pet' ? 'ペット用品のみ' : '暮らし・日用品のみ'}

出力形式は以下のJSON形式のみで出力してください（Markdownコードブロック \`\`\`json も可）。
{
  "trends": [
    {
      "id": "trend_1",
      "seasonContext": "10月の秋の換毛期と乾燥",
      "genre": "pet",
      "category": "pet_cat",
      "suggestedKeyword": "猫 抜け毛 ブラシ ファーミネーター",
      "themeTitle": "【秋の換毛期】部屋の毛玉地獄から解放される神抜け毛ブラシ特集",
      "targetAudience": "毎日のコロコロ粘着シートと掃除機に疲弊している愛猫・愛犬家",
      "angle": "お悩み解決型（服やソファの毛が劇的に減る）",
      "sampleSearchUrl": "https://www.amazon.co.jp/s?k=猫+抜け毛+ブラシ"
    }
  ]
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  const text = response.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.trends && Array.isArray(parsed.trends)) {
      return parsed.trends.map((t: any, idx: number) => ({
        id: t.id || `trend_${idx + 1}`,
        seasonContext: t.seasonContext || `${dateStr}の季節`,
        genre: t.genre || (t.category?.startsWith('pet') ? 'pet' : 'life'),
        category: t.category || 'life_general',
        suggestedKeyword: t.suggestedKeyword || 'Amazon 売れ筋 便利グッズ',
        themeTitle: t.themeTitle || 'おすすめ売れ筋アイテム',
        targetAudience: t.targetAudience || '暮らしを快適にしたい人',
        angle: t.angle || 'お悩み解決',
        sampleSearchUrl: t.sampleSearchUrl || `https://www.amazon.co.jp/s?k=${encodeURIComponent(t.suggestedKeyword || '便利グッズ')}`,
      }));
    }
  }

  throw new Error('Failed to parse Gemini trend response');
}

function getSeasonalFallbackTrends(month: number, genreFilter: string): DailyTrendIdea[] {
  const allSeasonal: DailyTrendIdea[] = [
    // 暮らし
    {
      id: 'fb-life-1',
      seasonContext: `${month}月の衣替え・部屋の乾燥対策`,
      genre: 'life',
      category: 'interior',
      suggestedKeyword: '山崎実業 tower 加湿器スタンド 浮かせる収納',
      themeTitle: '【秋・冬の乾燥対策】場所を取らずに部屋を潤すコンパクト加湿器＆浮かせるスタンド',
      targetAudience: '省スペースで部屋をスッキリ保ちたい一人暮らし・賃貸住まい',
      angle: '生活感ゼロでおしゃれにうるおう暮らしの知恵',
      sampleSearchUrl: 'https://www.amazon.co.jp/s?k=加湿器+卓上+超音波',
    },
    {
      id: 'fb-life-2',
      seasonContext: '夕飯の温かい煮込み・スープ料理需要',
      genre: 'life',
      category: 'kitchen',
      suggestedKeyword: 'iwaki 耐熱ガラス 保存容器 パック&レンジ',
      themeTitle: '【作り置きシーズン】カレーやシチューの色移りゼロ！iwaki耐熱ガラスが手放せない理由',
      targetAudience: '休日に平日分の料理を作り置きして平日ラクしたい共働き世帯',
      angle: 'プラスチック容器のギトギト油汚れストレスからの完全解放',
      sampleSearchUrl: 'https://www.amazon.co.jp/s?k=iwaki+耐熱ガラス+保存容器',
    },
    {
      id: 'fb-life-3',
      seasonContext: '年末に向けた小掃除・水回り除菌',
      genre: 'life',
      category: 'cleaning',
      suggestedKeyword: 'ウタマロ クリーナー 水垢 コンロ油汚れ',
      themeTitle: '【大掃除前倒し】スプレーして拭くだけ！キッチンと水回りが新築に戻る神洗剤',
      targetAudience: '強い洗剤で手が荒れやすい主婦・短時間で水回りをピカピカにしたい人',
      angle: '素手でも使える中性なのに油汚れが秒で溶ける爽快感',
      sampleSearchUrl: 'https://www.amazon.co.jp/s?k=ウタマロクリーナー',
    },
    // ペット
    {
      id: 'fb-pet-1',
      seasonContext: `${month}月の秋の換毛期（抜け毛ピーク）`,
      genre: 'pet',
      category: 'pet_care',
      suggestedKeyword: 'ファーミネーター 猫 短毛種 抜け毛除去',
      themeTitle: '【換毛期の救世主】ごっそり取れて服に毛がつかない！愛用者続出のアンダーコートブラシ',
      targetAudience: '毎日コロコロ粘着テープを何十枚も消費している猫・犬の飼い主',
      angle: '驚くほど毛玉ボールが取れるBefore/Afterと毛玉吐き防止',
      sampleSearchUrl: 'https://www.amazon.co.jp/s?k=ファーミネーター+猫',
    },
    {
      id: 'fb-pet-2',
      seasonContext: '秋冬のペット飲水量低下・尿路結石予防',
      genre: 'pet',
      category: 'pet_cat',
      suggestedKeyword: 'ピュアクリスタル 自動給水器 猫 軟水化フィルター',
      themeTitle: '【水分補給対策】涼しくなって水を飲まなくなった愛猫へ。流水で飲む量が劇的に増える自動給水器',
      targetAudience: '膀胱炎や尿路結石の通院歴がある猫の飼い主・水分不足が心配な人',
      angle: '健康維持＆軟水化フィルターで結石リスクを予防する安心感',
      sampleSearchUrl: 'https://www.amazon.co.jp/s?k=猫+自動給水器+ピュアクリスタル',
    },
    {
      id: 'fb-pet-3',
      seasonContext: '寒くなって丸まりたい猫のベッド需要',
      genre: 'pet',
      category: 'pet_cat',
      suggestedKeyword: '猫壱 バリバリボウル すり鉢型 爪とぎ',
      themeTitle: '【冬のぬくぬく丸まり】すり鉢カーブに吸い込まれるように爆睡する猫壱バリバリボウル',
      targetAudience: '買った猫ベッドを使ってくれずダンボール箱に入る猫に困っている飼い主',
      angle: '研いでそのまま吸い込まれるように寝落ちする可愛さと高コスパ',
      sampleSearchUrl: 'https://www.amazon.co.jp/s?k=猫壱+バリバリボウル',
    },
  ];

  if (genreFilter === 'life') {
    return allSeasonal.filter(t => t.genre === 'life');
  }
  if (genreFilter === 'pet') {
    return allSeasonal.filter(t => t.genre === 'pet');
  }
  return allSeasonal;
}
