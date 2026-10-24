import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { GeneratedVariation, ToneId } from '@/lib/types';
import { appendPrDisclosure } from '@/lib/amazon';
import { buildAffiliateReplyText, replaceReplyLinkLine } from '@/lib/reply-builder';
import { convertToRakutenAffiliateUrl } from '@/lib/rakuten';

interface RequestBody {
  asin: string;
  title: string;
  category: string;
  genre: 'life' | 'pet';
  targetAudience?: string;
  affiliateUrl: string;
  platform: 'x' | 'threads' | 'both';
  benefits?: string[];
  customNotes?: string;
  includeNoLinkPost?: boolean; // アカバン防止用のリンクなし共感ポストを生成するか
  targetMode?: 'direct' | 'pattern_b_all'; // pattern_b_all: 4案すべて「本文＝純粋共感エピソード」「リプライ＝商品スペック＆リンク」
  userExemplars?: string[]; // ユーザーが過去に編集・承認したお手本ポスト（Few-Shot学習用）
  rakutenAffiliateId?: string; // ユーザー指定の楽天アフィリエイトID
}

export async function POST(req: Request) {
  try {
    const body: RequestBody = await req.json();
    const {
      asin,
      title,
      category,
      genre,
      targetAudience,
      affiliateUrl,
      platform,
      benefits,
      customNotes,
      includeNoLinkPost,
      targetMode,
      userExemplars,
      rakutenAffiliateId,
    } = body;

    if (!title) {
      return NextResponse.json({ error: '商品名は必須です。' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();

    // 宿・ホテル判定
    const isTravel =
      category === 'pet_travel' ||
      /宿|ホテル|温泉|旅館|ヴィラ|コテージ|宿泊|トラベル|ペンション/i.test(`${title} ${category}`);

    // 宿・旅行の場合は、素のURL（travel.rakuten.co.jp）が渡されても確実に楽天アフィリエイトリンクに自動変換
    const effectiveAffiliateUrl = isTravel && affiliateUrl
      ? convertToRakutenAffiliateUrl(affiliateUrl, rakutenAffiliateId || process.env.RAKUTEN_AFFILIATE_ID)
      : affiliateUrl;

    // 宿・旅行の場合は常に「パターンB（本文＝純粋共感エピソード、リプライ＝宿魅力＋アフィリリンク）」を強制
    const effectiveTargetMode = isTravel ? 'pattern_b_all' : (targetMode || (includeNoLinkPost ? 'pattern_b_all' : 'direct'));
    const effectiveIncludeNoLink = isTravel ? true : !!includeNoLinkPost;

    // If Gemini API Key is available, generate using Gemini
    if (apiKey && apiKey !== '【Google AI Studioで取得したGemini APIキー】' && !apiKey.startsWith('your_')) {
      try {
        const generatedVariations = await generateWithGemini(apiKey, {
          asin,
          title,
          category,
          genre,
          targetAudience: targetAudience || (genre === 'pet' ? '愛犬・愛猫の飼い主' : '暮らしを快適にしたい人'),
          affiliateUrl: effectiveAffiliateUrl,
          platform,
          benefits: benefits || [],
          customNotes: customNotes || '',
          includeNoLinkPost: effectiveIncludeNoLink,
          targetMode: effectiveTargetMode,
          userExemplars: userExemplars || [],
        });

        if (generatedVariations && generatedVariations.length > 0) {
          return NextResponse.json({
            variations: generatedVariations,
            source: 'gemini',
          });
        }
      } catch (geminiError) {
        console.warn('Gemini API execution error, fallback to algorithmic template generator:', geminiError);
      }
    }

    // High-quality fallback generator (ensures zero downtime & works out-of-the-box before API key is set)
    const fallbackVariations = generateFallbackVariations({
      asin,
      title,
      category,
      genre,
      targetAudience: targetAudience || (genre === 'pet' ? 'ペットオーナー' : '日々の暮らしを整えたい人'),
      affiliateUrl: effectiveAffiliateUrl,
      platform,
      benefits: benefits || [],
      customNotes: customNotes || '',
      includeNoLinkPost: effectiveIncludeNoLink,
      targetMode: effectiveTargetMode,
    });

    return NextResponse.json({
      variations: fallbackVariations,
      source: apiKey ? 'template_fallback' : 'template_mode',
      note: apiKey ? 'Gemini API呼び出しでフォールバックしました' : 'GEMINI_API_KEY未設定のため高品質テンプレート生成で動作中',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function generateWithGemini(apiKey: string, params: {
  asin: string;
  title: string;
  category: string;
  genre: 'life' | 'pet';
  targetAudience: string;
  affiliateUrl: string;
  platform: 'x' | 'threads' | 'both';
  benefits: string[];
  customNotes: string;
  includeNoLinkPost?: boolean;
  targetMode?: 'direct' | 'pattern_b_all';
  userExemplars?: string[];
}): Promise<GeneratedVariation[]> {
  const ai = new GoogleGenAI({ apiKey });

  const isTravel =
    params.category === 'pet_travel' ||
    /宿|ホテル|温泉|旅館|ヴィラ|コテージ|宿泊|トラベル|ペンション/i.test(`${params.title} ${params.category}`);

  const isPatternBAll = isTravel || params.targetMode === 'pattern_b_all';

  const prompt = isTravel
    ? `あなたは「40〜60代の女性から強く共感され、愛されるペットの飼い主」です。
愛犬・愛猫と一緒に旅行やお出かけをするのが大好きで、愛犬の楽しそうな笑顔やはしゃぎっぷりに親バカ全開でメロメロになってしまう憎めないキャラクターです。

以下の【ペットと泊まれる宿・ホテル（楽天トラベル）】について、読者が思わず「わかる〜！うちも連れて行きたい！」「これなら安心して泊まれそう！」と共感し、保存やコメントをしたくなるSNS投稿文（4パターン）を日本語で作成し、指定のJSON形式で出力してください。

【宿・宿泊施設情報】
- 宿・ホテル名: ${params.title}
- カテゴリ: ペットと泊まれる宿・ホテル（楽天トラベル）
- ターゲット読者層: ${params.targetAudience}
- 推しポイント/魅力/設備: ${params.benefits.join(', ') || '愛犬歓迎・高評価・充実の設備'}
- 追記メモ: ${params.customNotes || 'なし'}
- 楽天トラベルリンク: ${params.affiliateUrl}
${params.userExemplars && params.userExemplars.length > 0 ? `
============================================================
【★超重要：ユーザーが過去に手動調整・確定したお手本ポスト（Few-Shot学習例）】
============================================================
以下は、ユーザー自身が実際に微調整・手直しして確定させた「理想の文体・構成」のお手本投稿です。
この文体を強く学習・模倣して生成してください：

${params.userExemplars.map((ex, i) => `【ユーザーお手本 ${i + 1}】\n${ex.trim()}`).join('\n\n')}
` : ''}

============================================================
【★最重要ルール1：宿・ペット同伴旅行ならではのリアルな共感・感動ストーリー】
============================================================
従来の「物販（抜け毛ブラシ・シーツのやらかし・段ボール破壊・爪とぎ等）」のエピソードは【絶対に禁止】です！
必ず【ペット同伴旅行・お泊まりならではのリアルな体験・悩み・感動】を描いてください：

【旅行ならではのエピソードテーマ例】：
1. 初めてのお泊まり旅行の不安からの解放:
   「粗相や無駄吠えで周りに迷惑かけないか…」「環境が変わって寝られるか…」と行く前はドキドキ胃が痛かったのに、スタッフさんの神対応やワンちゃん専用設備で不安が一瞬で吹き飛んだ感動。
2. 客室露天風呂・天然温泉＆専用ドッグランで大はしゃぎ:
   部屋付きのプライベートドッグランで大興奮で爆走する姿、客室温泉で一緒にリラックス。他のワンちゃんが苦手な子でも周りを気にせずノーリードで満喫。
3. 部屋食で周りに気を使わず家族でゆっくり満喫:
   ワンちゃん用のごちそうプレートに目を輝かせたり、お部屋食だから他の宿泊客に遠慮せず家族水入らずで美味しいご飯を堪能できた贅沢な時間。
4. アメニティ充実で手ぶら旅行・ベッド同室OKの安心感:
   ペットシーツ・消臭・足拭きタオル・お散歩グッズ完備で大荷物パニックから解放。ふかふかのベッドで一緒に添い寝できて幸せを噛みしめる夜。
5. はしゃぎ疲れて大の字で爆睡する愛犬の姿:
   昼間は大興奮で遊び倒し、夜は宿のベッドで安心しきって無防備にへそ天・大いびきで寝落ち。「連れてきて本当によかった…」と心底思える瞬間。

============================================================
【★最重要ルール2：ギミック全盛りの禁止＆自然な1〜2個の選択制】
============================================================
「オホホ^^」「人はそれを〜と呼ぶ」「ギャ〜」「白目剥いた」「あ〜爆死」「私だけ？」などのフレーズを【1つの投稿に全部同じ順番で詰め込むこと】は絶対に禁止です！
キャラクターの愛らしいトーン（親バカ全開マダム ＋ 心の声で突っ込む下僕）は維持しつつ、ギミックは1〜2個だけ自然に選んで散りばめてください。

【ギミック候補（この中から1〜2個だけ自然に選ぶ）】：
- 自虐セルフツッコミ: 状況に合わせた冷静なツッコミ「…人はそれを親バカと呼ぶ。（知らんがな）」「…人はそれを贅沢と呼ぶ。（最高か）」
- 急なマダム化・エセセレブ: 「オホホ^^〜ですのよ♡」「優雅な湯治をプレゼントしてさしあげましたの」
- 旅先でのプチハプニング: 「大はしゃぎしすぎてドッグランから部屋に戻るのを断固拒否」「ギャ〜……！」
- 愛嬌のある関西弁ツッコミ: 「誰の贅沢旅行やねん！笑」「家よりくつろいどるやないかい！」「あ〜、幸せすぎて爆死。」
- 親バカ・感動オチ: 「連れてきて本当に良かった下僕です」「この笑顔見れただけでお仕事頑張れる」「下僕の完敗です」

【★絶対禁止ワード・暴力表現の完全根絶（アカウント凍結防止）】：
❌ 絶対禁止ワード：「しめるぞ」「ゴルァ」「しばく」「殺す」「殴る」「ぶっ飛ばす」「死ね」等の暴力・脅迫表現は出力厳禁！

============================================================
【★最重要ルール3：全4案すべてパターンB（本文＝純粋共感、リプライ＝宿魅力＆リンク）】
============================================================
宿の紹介は【全4案すべてパターンB（ぶら下げリプライ前提）】で作成してください。
- メイン本文（content）:
  - ★評価（★4.8など）、宿泊費、セール情報などの数値や宣伝文句は【絶対に含めない】こと！
  - URLや「#PR」も【一切含めない】こと！
  - 純粋に「愛犬との旅行あるある・不安解消・感動エピソード ＋ 読者への共感の問いかけ」だけで完結させてください。
  - 文末の問いかけ例：「愛犬との初めてのお泊まり、みんな緊張しなかった？🥹」「みんなはワンちゃんと旅行行ったことある？」「おすすめの宿あったら教えて…！」など。
- リプライ本文（replyContent）:
  - メイン投稿の直後にぶら下げる返信テキスト。
  - 宿名、魅力解説（★評価、客室露天・ドッグラン・食事・アメニティなどの具体的なおすすめ理由）、楽天トラベルリンク（${params.affiliateUrl}）、#PR は【すべてこのリプライ側に集約】してください。

【出力してほしい4つの切り口】
- パターン1: tone="problem_solving" (初めてのお泊まり旅行・不安解消切り口)
- パターン2: tone="honest_review" (客室温泉・専用ドッグランで大はしゃぎ切り口)
- パターン3: tone="empathy_story" (部屋食・愛犬用ごちそうで家族団らん切り口)
- パターン4: tone="no_link_tips" (旅先ではしゃぎ疲れて安心しきって爆睡する愛犬の感動切り口)

【出力形式】
JSONオブジェクトのみを出力してください（Markdownコードブロック \`\`\`json も可）。
{
  "variations": [
    {
      "id": "var_1",
      "tone": "problem_solving",
      "toneName": "🏨 初めての旅行・不安解消型",
      "headline": "短くキャッチーな見出し",
      "content": "投稿本文（商品スペック・URL・PRを一切含まない純粋な旅の共感文）",
      "replyContent": "ぶら下げリプライ本文（宿名・魅力スペック・おすすめ理由・楽天トラベルリンク・#PR）",
      "tags": ["犬連れ旅行", "ペットと泊まれる宿", "愛犬とお出かけ", "犬のいる暮らし"],
      "featuresUsed": ["使用した特徴1"],
      "isNoLink": true
    },
    ...
  ]
}`
    : `あなたは「40〜60代の女性から強く共感され、愛されるペットの飼い主」です。
普段はおっちょこちょいで愛犬・愛猫に甘々な日常を送っていますが、ペットの理不尽なやらかしを食らった瞬間にだけ素の関西弁ツッコミがポロッと漏れる、憎めないキャラクターです。

以下の商品について、読者が思わず吹き出しつつ共感し、保存やコメントをしたくなるSNS投稿文（4パターン）を日本語で作成し、指定のJSON形式で出力してください。

【商品情報】
- 商品名: ${params.title}
- ASIN: ${params.asin}
- ジャンル: ${params.genre === 'pet' ? 'ペット用品・愛犬愛猫グッズ' : '暮らし・日用品・アウトドア・防災'}
- カテゴリ: ${params.category}
- ターゲット読者層: ${params.targetAudience}
- 推しポイント/スペック: ${params.benefits.join(', ') || '高評価レビュー多数'}
- 追記メモ: ${params.customNotes || 'なし'}
- トラッキングリンク: ${params.affiliateUrl}
${params.userExemplars && params.userExemplars.length > 0 ? `
============================================================
【★超重要：ユーザーが過去に手動調整・確定したお手本ポスト（Few-Shot学習例）】
============================================================
以下は、ユーザー自身が実際に微調整・手直しして確定させた「理想の文体・構成」のお手本投稿です。
ユーザー特有の「改行・空白行のリズム」「ツッコミの切れ味」「関西弁や感情の入れ方」「読者への問いかけのトーン」をしっかり分析し、この文体を強く学習・模倣して生成してください：

${params.userExemplars.map((ex, i) => `【ユーザーお手本 ${i + 1}】\n${ex.trim()}`).join('\n\n')}
` : ''}

============================================================
【★最重要ルール1：紹介商品とエピソードの100%整合性】
============================================================
本文冒頭で語る日常の悩み・やらかし・プチトラブルは、必ず【紹介する商品の用途や特徴】と100%一致させてください！
紹介商品と関係のない悩み（例：床の足跡汚れやご飯皿のこぼしエピソードなのに結びで抜け毛ブラシで解決するなど）は【絶対に厳禁】です。

【ジャンル別の正しいエピソード導入例】：
- ブラシ・抜け毛ケア用品 ➔ ブラッシングを嫌がって逃走、部屋中や黒い服が毛まみれ、撫でると大量の抜け毛ボール、換毛期の抜け毛との果てしない格闘
- ペットシーツ・トイレ用品・消臭 ➔ おしっこの端っこはみ出し、足裏が濡れて部屋に足跡スタンプ、シーツをホリホリしてズタボロ破壊、留守中の臭い
- 水飲み器・給水器 ➔ 前足でチョイチョイ押して水皿をひっくり返す、お皿の水で手足ビシャビシャ、留守中の水切れ・ホコリ混入
- フードボウル・給餌器 ➔ 一瞬で丸呑みして吐き戻す、お皿をひっくり返してカリカリ散乱、おねだりの激しい攻防
- 爪とぎ・保護シート ➔ ソファーの角やお気に入りの壁紙をバリバリ、新品家具を瞬殺される絶望
- キャンプ・アウトドア用品 ➔ 設営に手こずって汗だく、強風でペグが抜ける、荷物で車がパンパン、寒さで寝られない等のアウトドアあるある
- 防災・ポータブル電源等 ➔ 突然の停電でスマホ充電切れ＆真っ暗闇、非常袋の賞味期限切れ、断水時のトイレパニック

============================================================
【★最重要ルール2：ギミック全盛りの禁止＆自然な1〜2個の選択制】
============================================================
「オホホ^^」「人はそれを〜と呼ぶ」「ギャ〜」「白目剥いた」「あ〜爆死」「私だけ？」などのフレーズを【1つの投稿に全部同じ順番で詰め込むこと】は絶対に禁止です！
毎回同じ構文が登場すると機械的な印象になります。
キャラクターの愛らしいトーン（甘々マダム ＋ 心の声で突っ込む下僕）は維持しつつ、以下のギミック候補の中から【エピソードの流れに合わせて自然にハマるものを1〜2個だけ選んで散りばめてください】（毎回異なる組み合わせにすること）。

【ギミック候補（この中から1〜2個だけ自然に選ぶ）】：
- 自虐セルフツッコミ: 状況に合わせた冷静なツッコミ「…人はそれを〇〇と呼ぶ。（知らんがな）」
  ※文脈に合わせる（例: 拷問、下僕、無駄遣い、無駄な努力、自己満、過保護、油断、背伸び など）
- 急なマダム化・エセセレブ: 「オホホ^^〜ですのよ♡」「〜してさしあげましたの」
- 悲鳴・パニック: 「ギャ〜……！」「うそでしょ…」「白目剥いた」
- 愛嬌のある関西弁ツッコミ（やらかされた瞬間）: 「誰が掃除する思とんねん！笑」「誰の抜け毛吸い込んどんねん」「勘弁して〜！」「あ〜、爆死。」
- 脱力・下僕化オチ: 「結局可愛いから許しちゃう」「顔見たら全部許した下僕です」「下僕の完敗です」

【★絶対禁止ワード・暴力表現の完全根絶（アカウント凍結防止）】：
XやThreadsの利用規約（暴力的な脅迫・ヘイト）違反によるアカウント凍結を絶対に防ぐため、以下の過激な表現は【出力に一切含めないでください】！
❌ 絶対禁止ワード：「しめるぞ」「ゴルァ」「しばく」「殺す」「殴る」「ぶっ飛ばす」「死ね」等の暴力・脅迫表現

============================================================
【★最重要ルール3：展開パターンの多様化＆問いかけのバリエーション】
============================================================
毎回「工夫 ➔ ギャー ➔ オホホ ➔ ツッコミ ➔ 爆死」という同一ルートを通らず、エピソードごとに展開を変えてください：
- 展開A（やらかし被弾型）：工夫してみた ➔ 予想外のやらかし ➔ 関西弁ツッコミ1発 ➔ 許しちゃう
- 展開B（自虐セルフツッコミ型）：良かれと思って奮発 ➔ 秒殺または完全スルー ➔ 「…人はそれを無駄遣いと呼ぶ。（知らんがな）」 ➔ 脱力
- 展開C（優雅マダム崩壊型）：マダム気取り「〜してさしあげましたの。オホホ^^」 ➔ 突然のハプニング「ギャ〜！」 ➔ 泥臭く掃除する現実
- 展開D（静かな心理戦型）：ペットの理不尽なマイルール ➔ 抗おうとするも完敗 ➔ 「爆死。」

文末の問いかけも毎回「〜した経験ある？私だけ？」の完全固定ではなく、
「〜された経験ある仲間います？😭」「同じやらかし食らった飼い主さん教えて…」「〜って経験ある？私だけじゃないはず…！」「みんなの家はどう？うちだけ？🥹」「これ共感してくれる人いる？笑」
など、親しいフォロワーに話しかけるように自然なバリエーションを持たせてください。

============================================================
【★最重要ルール4：パターンB（ぶら下げリプライ）時の本文とリプライの完全分離】
============================================================
${isPatternBAll ? `今回は【全4案すべてパターンB（ぶら下げリプライ前提）】で作成してください。
- メイン本文（content）:
  - ★評価（★4.71など）、レビュー件数、価格、送料無料などの【商品スペック・数値】は【絶対に含めない】こと！
  - 商品の具体的な宣伝文句やセール情報（「詳細・セール確認」「気になる人はチェック」等）も【一切含めない】こと！
  - URLや「#PR」も【一切含めない】こと！
  - 純粋に「商品特徴に紐づく日常のやらかし・共感エピソード ＋ 読者への共感の問いかけ」だけで完結させてください。
- リプライ本文（replyContent）:
  - メイン投稿の直後にぶら下げる返信テキスト。
  - 商品名、スペック解説（★評価、レビュー件数、具体的なメリット、おすすめ理由）、リンク（${params.affiliateUrl}）、#PR は【すべてこのリプライ側に集約】してください。` : `
- パターン1〜3: 直接訴求型。本文結びで商品を紹介し、末尾に「${params.affiliateUrl} #PR」を含める。
- パターン4: パターンB（ノウハウ・ギブ型）。メイン本文にはスペックやリンク・#PRを一切含めず純粋共感エピソードで締め、リプライ（replyContent）に商品紹介とリンク・#PRを集約する。`}

【出力してほしい4つの切り口】
- パターン1: tone="problem_solving" (地味な使い勝手の悪さ・お悩み解決切り口)
- パターン2: tone="honest_review" (自力奮闘からの大失敗・本音レビュー切り口)
- パターン3: tone="empathy_story" (ペット特有のクセ・やらかし共感切り口)
- パターン4: tone="no_link_tips" (愛おしすぎて許しちゃう下僕エピソード切り口)

【出力形式】
JSONオブジェクトのみを出力してください（Markdownコードブロック \`\`\`json も可）。
{
  "variations": [
    {
      "id": "var_1",
      "tone": "problem_solving",
      "toneName": "地味なプチストレス解決型",
      "headline": "短くキャッチーな見出し",
      "content": "投稿本文（${isPatternBAll ? '商品スペック・URL・PRを一切含まない純粋な共感文' : '起承転結'}）",
      "replyContent": "ぶら下げリプライ本文（商品名・スペック・おすすめ理由・リンク・#PR）",
      "tags": ["ペットのいる暮らし", "買ってよかった"],
      "featuresUsed": ["使用した特徴1"],
      "isNoLink": ${isPatternBAll ? 'true' : 'false'}
    },
    ...
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
    if (parsed.variations && Array.isArray(parsed.variations)) {
      return parsed.variations.map((v: Partial<GeneratedVariation>, idx: number) => {
        const isNoLink = isPatternBAll || v.tone === 'no_link_tips' || v.isNoLink;
        const defaultReply = buildAffiliateReplyText({
          productName: params.title,
          reviewText: params.benefits.join('。') + '。',
          affiliateUrl: params.affiliateUrl,
        });

        // パターンB時はメイン本文からスペック・リンク・PR・宣伝文を綺麗に除外
        let cleanMainContent = (v.content || '').trim();
        if (isNoLink) {
          cleanMainContent = cleanMainContent
            .replace(/https?:\/\/[^\s]+/g, '')
            .replace(/#PR\s*/gi, '')
            .replace(/👇[^\n]*\n?/g, '')
            .replace(/★\s*\d+(\.\d+)?(\s*（[^）]+）)?/g, '')
            .replace(/レビュー\s*[\d,]+件[^\n]*\n?/g, '')
            .replace(/【商品名】[^\n]*\n?/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        }

        // リプライ本文のリンク保証（Geminiが素URLを出力した場合でも確実にアフィリリンクに置換・保証）
        let safeReplyContent = (v.replyContent?.trim() || defaultReply);
        if (params.affiliateUrl) {
          safeReplyContent = replaceReplyLinkLine(
            safeReplyContent,
            isTravel ? 'direct_rakuten' : 'direct_rakuten',
            params.affiliateUrl
          );
        }

        return {
          id: v.id || `var_${idx + 1}`,
          tone: (v.tone as ToneId) || (idx === 0 ? 'problem_solving' : idx === 1 ? 'honest_review' : idx === 2 ? 'empathy_story' : 'no_link_tips'),
          toneName: v.toneName || (isTravel
            ? (idx === 0 ? '🏨 不安解消・神対応型' : idx === 1 ? '♨️ 客室温泉・ドッグラン型' : idx === 2 ? '🍱 部屋食・家族団らん型' : '🐾 旅先爆睡・感動型')
            : (isNoLink ? '🐾 パターンB（リンク無し共感ポスト）' : idx === 0 ? 'お悩み解決型' : idx === 1 ? 'リアル愛用者型' : '共感ストーリー型')),
          headline: v.headline || (isTravel ? 'おすすめの愛犬同伴宿' : 'おすすめポイント'),
          content: isNoLink ? cleanMainContent : appendPrDisclosure(cleanMainContent),
          replyContent: safeReplyContent,
          characterCount: cleanMainContent.length,
          tags: v.tags || (isTravel
            ? ['犬連れ旅行', 'ペットと泊まれる宿', '愛犬とお出かけ', 'ペットのいる暮らし']
            : (params.genre === 'pet' ? ['ペットのいる暮らし', '愛犬愛猫', 'ペットあるある'] : ['暮らしを整える', '時短家事', '便利グッズ'])),
          featuresUsed: v.featuresUsed || params.benefits,
          isNoLink: !!isNoLink,
        };
      });
    }
  }

  throw new Error('Failed to parse Gemini response as JSON');
}

function generateFallbackVariations(params: {
  asin: string;
  title: string;
  category: string;
  genre: 'life' | 'pet';
  targetAudience: string;
  affiliateUrl: string;
  platform: 'x' | 'threads' | 'both';
  benefits: string[];
  customNotes: string;
  includeNoLinkPost?: boolean;
  targetMode?: 'direct' | 'pattern_b_all';
}): GeneratedVariation[] {
  const isTravel =
    params.category === 'pet_travel' ||
    /宿|ホテル|温泉|旅館|ヴィラ|コテージ|宿泊|トラベル|ペンション/i.test(`${params.title} ${params.category}`);
  const isPet = isTravel || params.genre === 'pet';
  const isPatternBAll = isTravel || params.targetMode === 'pattern_b_all';
  const benefit1 = params.benefits[0] || (isTravel ? '愛犬同伴歓迎＆充実のアメニティ完備' : isPet ? '愛犬・愛猫のストレス解消＆お手入れ楽々' : '日々の家事・準備の手間が劇的に激減');
  const benefit2 = params.benefits[1] || (isTravel ? '客室露天風呂・天然温泉や専用ドッグラン付き' : isPet ? '耐久性バツグンで長持ち＆快適' : '丸洗い・高機能で使い勝手抜群');

  const scenario = getScenarioByProduct(params.title, params.category, isPet);
  const shortTitle = params.title.slice(0, 18).trim();

  // 4つのバリエーションを作成
  const configs = [
    {
      tone: 'problem_solving' as ToneId,
      toneName: isTravel ? '🏨 不安解消・神対応型' : '💡 お悩み解決切り口',
      story: scenario.story1,
      badge: isTravel ? '🏨 不安解消' : '💡 お悩み解決',
    },
    {
      tone: 'honest_review' as ToneId,
      toneName: isTravel ? '♨️ 客室温泉・ドッグラン型' : '⭐ 本音レビュー切り口',
      story: scenario.story2,
      badge: isTravel ? '♨️ 露天・ラン' : '⭐ 本音レビュー',
    },
    {
      tone: 'empathy_story' as ToneId,
      toneName: isTravel ? '🍱 部屋食・家族団らん型' : '🐱 クセ・やらかし切り口',
      story: scenario.story3,
      badge: isTravel ? '🍱 部屋食' : '🐱 クセ・やらかし',
    },
    {
      tone: 'no_link_tips' as ToneId,
      toneName: isTravel ? '🐾 旅先爆睡・感動型' : '🐾 下僕エピソード切り口',
      story: scenario.story4,
      badge: isTravel ? '🐾 旅先爆睡' : '🐾 下僕エピソード',
    },
  ];

  return configs.map((cfg, idx) => {
    const isNoLink = isPatternBAll || cfg.tone === 'no_link_tips';
    let mainContent = cfg.story.main;

    if (!isNoLink) {
      // 直接訴求型（パターンA）の場合のみ、結びに商品紹介とリンクを追加
      mainContent += `\n\n${cfg.story.directHook}\n\n👇詳細・セール確認\n${params.affiliateUrl} #PR`;
    }

    const replyContent = buildAffiliateReplyText({
      productName: params.title,
      reviewText: `${benefit1}。${benefit2}。`,
      affiliateUrl: params.affiliateUrl,
    });

    return {
      id: `var_fallback_${idx + 1}`,
      tone: cfg.tone,
      toneName: cfg.toneName,
      headline: `${scenario.topic}（${cfg.story.tag}）`,
      content: isNoLink ? mainContent : appendPrDisclosure(mainContent),
      replyContent: replyContent,
      characterCount: mainContent.length,
      tags: isTravel
        ? ['犬連れ旅行', 'ペットと泊まれる宿', cfg.story.tag, 'ペットのいる暮らし']
        : (isPet ? ['ペットのいる暮らし', cfg.story.tag, '愛犬愛猫'] : ['暮らしを整える', cfg.story.tag, '買ってよかった']),
      featuresUsed: [benefit1, benefit2],
      isNoLink,
    };
  });
}

function getScenarioByProduct(title: string, category: string, isPet: boolean) {
  const text = `${title} ${category}`.toLowerCase();

  if (isPet) {
    if (category === 'pet_travel' || /宿|ホテル|温泉|旅館|ヴィラ|コテージ|宿泊|トラベル|ペンション/i.test(text)) {
      return {
        type: 'travel',
        topic: 'ペットと泊まれる宿・ホテル旅行',
        story1: {
          main: `愛犬との初めてのお泊まり旅行、行く前は本当にドキドキ胃が痛かったんです。\n\n「もし部屋でお漏らししたらどうしよう」「隣の部屋に無駄吠えしたら迷惑かけちゃう…」って心配で荷物も山盛り。\n…人はそれを心配性な下僕と呼ぶ。（知らんがな）\nでも着いた瞬間、スタッフさんが「〇〇ちゃんいらっしゃい！」って笑顔で迎えてくれて、粗相用シートから足拭きまで完備。\n不安が全部スーッと消えて、愛犬も尻尾フリフリで部屋中クンクン大探検。\n初めての愛犬旅行、行く前めちゃくちゃ緊張した経験ある仲間いません？😭`,
          directHook: `愛犬ウェルカムなおもてなしと至れり尽くせりの設備で、初めてでも安心して泊まれた神宿でした✨️`,
          tag: '初めての愛犬旅行',
        },
        story2: {
          main: `「愛犬に極上の湯治をプレゼントしてさしあげますの♡」と意気込んでお泊まりに来たんです。オホホ^^\n\n客室露天風呂と専用のお庭付きのお部屋を奮発！\nお部屋の扉開けた瞬間、愛犬がプライベートドッグランに猛ダッシュ。\n耳をパタパタさせながら満面の笑顔で大爆走して「ギャ〜……！可愛すぎる！」\n他のワンちゃんを気にせずノーリードで思いっきり走れるって本当に贅沢。\n…人はそれを親バカの至福と呼ぶ。（知らんがな）\n普段家では見せない大はしゃぎな笑顔見せてくれた時、連れてきてよかった〜って泣きそうになりませんか？🥹`,
          directHook: `客室温泉＆専用ドッグラン付きで、周りに気兼ねなく愛犬とプライベートな時間を満喫できるお宿でした👏`,
          tag: '客室温泉＆ドッグラン',
        },
        story3: {
          main: `愛犬とのお泊まりで一番感動したのが「お部屋食」。\n\n「お食事処だと落ち着かないかも…」って心配だったから部屋食プランにしたんですよ。\nそしたら愛犬専用の豪華な温野菜＆お肉プレートまで運ばれてきてビックリ！\n愛犬の目がキラキラ輝いて、一口食べるたびに「美味しい！」って私を見上げてくる姿に悶絶。\n誰の贅沢ディナーやねん！ってツッコミつつ、家族水入らずでゆっくりお酒飲んで最高の夜でした。\n愛犬用のごちそう頼んだら家より食いつき良くて笑っちゃった飼い主さん教えて…笑`,
          directHook: `周りの目を気にせず家族でゆっくり美味しいご飯を食べられる、愛犬家思いの神プランでした◎`,
          tag: '部屋食で家族団らん',
        },
        story4: {
          main: `旅行先で昼間思いっきり遊び倒した愛犬。\n\n宿のふかふかベッド（ワンちゃんOK！）に上がった途端、大の字でヘソ天して爆睡。\n「…家よりくつろいどるやないかい！」ってツッコミつつ、寝息スヤスヤ立ててる寝顔を見てたらウルッときちゃいました。\n…あ〜、幸せすぎて爆死。\n慣れない旅行で疲れたはずなのに、安心してぐっすり寝てくれる姿見ると本当に救われますよね。\n旅先で人間以上に爆睡するワンコに癒やされた経験ある？うちだけ？🥹`,
          directHook: `ワンちゃん用アメニティも充実してて、ベッドで一緒に添い寝できる最高の癒やし宿でした✨️`,
          tag: '旅先で爆睡',
        },
      };
    }
    if (/ブラシ|コーム|抜け毛|ファーミネーター|グルーミング|毛取り|アンダーコート/i.test(text)) {
      return {
        type: 'brush',
        topic: '抜け毛・ブラッシング',
        story1: {
          main: `うちの子の換毛期、毎日本当に格闘してるんです。\n\n黒い服着て抱っこした瞬間にセーターがモヘア素材に進化したかと思うレベルで毛まみれ。\n…人はそれを下僕の正装と呼ぶ。（知らんがな）\n慌ててコロコロしたら、本人は横でゴロゴロ喉鳴らして毛づくろいしてドヤ顔。\nでも撫でただけでごっそり毛が舞うから結局部屋中掃除機かけるハメに。\nブラッシング嫌がって部屋中毛だらけにされた経験ある仲間います？😭`,
          directHook: `そんな下僕を救ってくれたのがこのブラシ。ワンプッシュで毛がごっそり取れてブラッシングが至福の時間になりました✨️`,
          tag: '抜け毛対策',
        },
        story2: {
          main: `愛猫のために「今日こそ優雅にブラッシングしてさしあげますの♡」と意気込んだんですよ。オホホ^^\n\n…人はそれを無謀な挑戦と呼ぶ。（知らんがな）\nブラシを構えた0.5秒後に気配を察知されて、ソファーの奥深くにマッハで逃走。\n残されたのは宙に舞い散る大量の毛玉と私のむなしさだけ。\n誰の抜け毛吸い込んどんねん！ってツッコミつつ結局許しちゃう下僕です。\nブラシ持った瞬間に逃げ足最速になる子、うちだけ？🥹`,
          directHook: `でもこのブラシに変えたら嫌がらずゴロゴロ喉鳴らして大人しくなりました👏`,
          tag: '換毛期の戦い',
        },
        story3: {
          main: `撫でるたびにふわふわ舞う愛犬の抜け毛。\n\n「ママがピカピカにしてあげるね」って優しく撫でてたら、いつの間にか握り拳サイズの巨大毛玉が完成。\n…あ〜、爆死。\n毛玉を本人の頭の上に乗せたらキョトンとしてて可愛すぎて怒る気力ゼロ。\n黒いズボン履いてる時に限って全力でスリスリしてくるの、あれ絶対わざとですよね？笑`,
          directHook: `抜け毛の地味な格闘が一瞬で解決した神アイテムでした◎`,
          tag: '抜け毛ボール',
        },
        story4: {
          main: `ブラッシングした後の抜け毛を集めて、ミニチュアの愛猫を作ってみたんです。\n\n「分身ができましたの♡」って見せてさしあげましたの。オホホ^^\nそしたら一撃の猫パンチで粉砕されて部屋中に再飛散して「ギャ〜……！」\n誰が掃除する思とんねん！勘弁して〜！笑\n…でも散らかした後にウルウルお目目で見つめられたら全部無罪放免。\n抜け毛アート粉砕された経験ある飼い主さん教えて…`,
          directHook: `片付けもワンタッチで終わるから抜け毛のストレスが激減しました✨️`,
          tag: '下僕エピソード',
        },
      };
    }

    if (/シーツ|シート|トイレ|消臭|おしっこ|オシッコ|砂|うんち/i.test(text)) {
      return {
        type: 'sheet',
        topic: 'トイレ・シートのやらかし',
        story1: {
          main: `愛犬のおトイレ、いつも完璧に褒めて育ててるんです。\n\nなのに今日、上半身だけシーツに乗せて、肝心のお尻が完全にはみ出してお漏らし。\n…人はそれを惜しい失敗と呼ぶ。（知らんがな）\n本人は「ちゃんとトイレ行けたよ！」って超ドヤ顔で尻尾フリフリ。\n誰が床拭く思とんねん！って叫びつつ、褒めて片付ける下僕の日常です。\nシーツの端っこからミリ単位ではみ出された経験ある仲間います？😭`,
          directHook: `吸水スピードが段違いのシーツに変えてから足濡れも床拭きもゼロになりました✨️`,
          tag: 'トイレあるある',
        },
        story2: {
          main: `愛犬のために「いつでも清潔なお城をキープですの♡」ってシーツをピシッと敷き替えたんですよ。オホホ^^\n\n敷いた3秒後に前足で超高速ホリホリ発動されて、ズタボロに引き裂かれて「ギャ〜……！」\n部屋中に白いポリマーが舞い散って一面の銀世界。\n誰の金で買った思とんねん！勘弁して〜！笑\n…あ〜、爆死。\n新品のシーツを秒殺でズタボロにされた経験ある？うちだけ？🥹`,
          directHook: `引っ掻いても破れにくくて厚手のシーツにしたら一発解決でした👏`,
          tag: 'シーツ秒殺',
        },
        story3: {
          main: `おしっこした後の愛犬の足裏。\n\nシーツでおしっこ踏んだ濡れた足のまま、テンションMAXで部屋中を猛ダッシュ。\nフローリング一面にスタンプラリー開催されて「白目剥いた」。\n…人はそれをアートと呼ぶ。（知らんがな）\n拭き掃除した直後に限ってスタンプ押してくるの、共感してくれる人いる？笑`,
          directHook: `一瞬でサラサラに吸収してくれるから足濡れスタンプから完全解放されました◎`,
          tag: '足濡れスタンプ',
        },
        story4: {
          main: `猫砂を全部取り替えてピカピカに洗った猫トイレ。\n\n「綺麗なトイレで気持ちよく使ってね♡」ってセットした瞬間、待ち構えていたかのように即座に乱入して全力うんち。\nしかも砂を豪快にザッザッと撒き散らして部屋中が砂浜状態。\n誰が砂掃き掃除する思とんねん！\nでもスッキリした顔で伸びしてる姿が天使すぎて許しちゃう下僕です。\nトイレ掃除直後に砂浜作られた経験ある飼い主さん教えて…`,
          directHook: `消臭力も飛び散り対策もバツグンで掃除回数が劇的に減りました✨️`,
          tag: '下僕エピソード',
        },
      };
    }

    if (/水|ウォーター|給水|水飲み|ボウル/i.test(text)) {
      return {
        type: 'water',
        topic: '水飲み皿のやらかし',
        story1: {
          main: `愛猫の水入れ、毎日ピカピカに洗ってあげてるんです。\n\n「いつでも新鮮なお水飲んでね♡」ってお水注いだ3分後。\n前足で器用にチョイチョイ押して水面の揺れを楽しんだ挙句、床一面に大洪水起こして「ギャ〜……！」\n濡れた床で私の靴下がビッシャビシャ。\n誰が拭く思とんねん！勘弁して〜！笑\n…でも濡れたピンクのお鼻でスリスリされたら怒る気力ゼロ。\nせっかく入れたお水ひっくり返された経験ある仲間います？😭`,
          directHook: `ひっくり返らない安定給水器にしてから床の洪水事件が完全ゼロになりました✨️`,
          tag: '水飲みあるある',
        },
        story2: {
          main: `愛犬の水飲み場、なぜか飲むのが下手すぎて顎からポタポタ大洪水。\n\n飲んだ後にトコトコ歩いてくるから、廊下に一直線の水滴ロードが完成。\n…人はそれを誘導ラインと呼ぶ。（知らんがな）\n拭いても拭いても水たまりができる我が家です。\nお水飲むの下手っぴな子、うちだけ？🥹`,
          directHook: `飛び散り防止プレート付きの給水器にしたら床がサラサラのままキープできて感動👏`,
          tag: '水浸しロード',
        },
        story3: {
          main: `奮発しておしゃれな陶器の水入れを買ってあげたんです。\n\n「優雅に潤してさしあげますの♡」って置いたのに。オホホ^^\n器には見向きもせず、お風呂場の蛇口から落ちる水滴を必死にペロペロ。\n…人はそれを無駄遣いと呼ぶ。（知らんがな）\n高い食器ほどスルーされるの、あるあるですよね？笑`,
          directHook: `流れるお水が大好きな子には循環式給水器が大当たりでした◎`,
          tag: '高級水入れスルー',
        },
        story4: {
          main: `水皿に手を入れてジャブジャブ洗うのが日課の我が家の猫。\n\n「手洗い場じゃないんですけど！」ってツッコミつつ、びしょ濡れの手で私の顔にタッチされて「冷たっ！」。\n…あ〜、爆死。\nでも冷たい肉球が気持ちよくてそのまま受け入れちゃう下僕です。\nお水で手洗いしちゃう変なクセある子、みんなの家はどう？🥹`,
          directHook: `手入れも楽ちんで常に清潔なお水が飲めるアイテムで本当に助かりました✨️`,
          tag: '下僕エピソード',
        },
      };
    }

    // デフォルト（ペット全般・おもちゃ・ベッドなど）
    return {
      type: 'general_pet',
      topic: '愛犬愛猫のやらかしと下僕の日常',
      story1: {
        main: `愛犬のために奮発してグッズ買ったんですよ。\n\n「これで快適に過ごしてね♡」って愛を込めてセッティングしてさしあげましたの。オホホ^^\n…人はそれを過保護と呼ぶ。（知らんがな）\nそしたら見向きもせず、梱包の段ボールにダイブして破壊して「ギャ〜……！」\n誰が片付ける思とんねん！勘弁して〜！笑\n…でも段ボールの中で満足そうに丸まってる姿が天使すぎて許しちゃう。\n段ボールしか愛さない我が子に泣いた経験ある仲間います？😭`,
        directHook: `でも『${title.slice(0, 18)}』は珍しく初日から夢中で使ってくれました✨️`,
        tag: 'ペットあるある',
      },
      story2: {
        main: `うちの猫、なぜか私の枕の真ん中で寝るんです。\n\nあまりに可愛いから、私はベッドの端っこで丸まって寝てさしあげましたの。オホホ^^♡\n…人はそれを拷問と呼ぶ。（知らんがな）\n朝起きたら首がバキバキに逝ってて白目剥きました。\n隣見たら私の枕の上で毛づくろいしてドヤ顔。\n誰の枕で安眠しとんねん！ってツッコミつつ、寝顔見たら全部許しちゃう下僕です。\nベッド占領されて身体バキバキになった経験ある？私だけ？🥹`,
        directHook: `快適な寝床を整えてあげたら自分のベッドでスヤスヤ寝てくれるようになりました👏`,
        tag: '枕占領事件',
      },
      story3: {
        main: `愛猫のご飯皿、毎日ピカピカに洗ってあげてるんです。\n\n「召し上がれ♡」って注いだのに、匂いだけフンッて嗅いで砂かける仕草。\n…人はそれを全否定と呼ぶ。（知らんがな）\nさっきまでお腹すいたって大騒ぎしてたの誰やねん！\nグルメすぎる我が子に振り回されてる飼い主さん、共感してくれる人いる？笑`,
        directHook: `食べやすさ重視のアイテムに変えたら残さず完食してくれるようになりました◎`,
        tag: 'グルメな我が子',
      },
      story4: {
        main: `休日に家中ピカピカにお掃除したんですよ。\n\n「これで優雅に過ごせますの♡」ってお茶淹れた瞬間、全力の運動会が開幕。\n敷いたばかりのマットがめくれ上がり、クッションが吹き飛び、部屋中が大荒れ。\n…あ〜、爆死。\nでも走り疲れて膝の上に乗ってきたら怒る気ゼロ。\n掃除直後に大暴走された経験ある飼い主さん教えて…`,
        directHook: `日々の地味なストレスから救ってくれたお気に入りアイテムです✨️`,
        tag: '下僕エピソード',
      },
    };
  }

  // 暮らし・キャンプ・防災
  if (/テント|タープ|ペグ|チェア|寝袋|シュラフ|焚き火|ランタン|マット|キャンプ/i.test(text)) {
    return {
      type: 'camp',
      topic: 'キャンプ・アウトドアあるある',
      story1: {
        main: `「優雅な大自然を満喫しますの♡」と意気込んでキャンプに来たんです。オホホ^^\n\n説明書片手にテント設営格闘すること2時間、汗だくで髪ボサボサ。\n…人はそれを修行と呼ぶ。（知らんがな）\nやっと立てた瞬間に突風でペグが抜けて「ギャ〜……！」\n誰が泊まる思とんねん！って叫びつつ、なんとか設営終えて飲むビールが最高でした。\nテント設営で夫婦喧嘩になりかけた経験ある仲間います？😭`,
        directHook: `ワンタッチで設営できるアイテム導入したらキャンプのハードルが劇的に下がりました✨️`,
        tag: 'キャンプあるある',
      },
      story2: {
        main: `おしゃれキャンパー目指してギア揃えたんですよ。\n\n車に積み込もうとしたらテトリス状態でトランク閉まらなくて白目剥きました。\n…人はそれを買いすぎと呼ぶ。（知らんがな）\n現地着く前に積み込みでHPゼロ。\n荷物多すぎて車パンパンになった経験あるキャンパーさん教えて…`,
        directHook: `コンパクト＆軽量ギアに変えてから準備も片付けも感動レベルで楽になりました👏`,
        tag: '積載パニック',
      },
      story3: {
        main: `大自然の静寂の中で迎える朝コーヒー。\n\n「これぞ丁寧な休日ですの♡」って優雅に淹れた直後、虫がコップにダイブして「ギャ〜……！」。\n…あ〜、爆死。\nでも大自然の中で食べる朝ごはんはやっぱり格別ですね。\nアウトドアの洗礼食らった経験ある？私だけ？🥹`,
        directHook: `防虫・快適グッズのおかげで快適さが段違いになりました◎`,
        tag: '優雅の崩壊',
      },
      story4: {
        main: `寒暖差の激しい夜キャンプ。\n\n「昼間あんなに暖かかったから平気よね」と油断してたら夜中に極寒でガタガタ震えて一睡もできず。\n…人はそれを甘い見通しと呼ぶ。（知らんがな）\n朝の焚き火の温もりが身体に染み渡りました。\nキャンプの寒さ舐めてて痛い目見たことある仲間います？笑`,
        directHook: `保温性バツグンのギアで朝までぐっすり快眠できるようになりました✨️`,
        tag: '極寒サバイバル',
      },
    };
  }

  // 防災・一般暮らし
  return {
    type: 'life_disaster',
    topic: '暮らし・防災あるある',
    story1: {
      main: `突然の雷雨で一瞬停電になったんです。\n\nスマホの充電が残り12%で「ギャ〜……！」とパニック。\n…人はそれを現代人の弱点と呼ぶ。（知らんがな）\n懐中電灯どこだっけ？と暗闇を手探りで歩いて足の小指を角に強打。\n日頃の備えの大切さを痛感した夜でした。\n停電した瞬間スマホの残量見て絶望した経験ある仲間います？😭`,
      directHook: `大容量ポータブル電源を常備してから停電の不安が完全ゼロになりました✨️`,
      tag: '停電パニック',
    },
    story2: {
      main: `キッチンの油汚れ、毎晩プチストレスだったんですよ。\n\n「いつでも清潔なお城をキープですの♡」って磨き上げた直後、家族が油ギトギトの鍋を流しに放置。\n誰が洗う思とんねん！勘弁して〜！笑\n…あ〜、爆死。\nでも家族が美味しそうにご飯食べた証拠だから許しちゃう夜です。\n片付け直後に台所荒らされた経験ある？うちだけ？🥹`,
      directHook: `手入れが劇的に楽になる神グッズ導入したら毎晩のイライラが解消しました👏`,
      tag: '台所あるある',
    },
    story3: {
      main: `「丁寧な暮らし」に憧れて便利家電買ったんですよ。\n\n…人はそれを自己満と呼ぶ。（知らんがな）\n最初の3日は使い倒したけど、パーツの分解洗浄が面倒くさすぎて棚の奥へフェードアウト。\nお手入れが面倒で使わなくなったグッズ、みんなの家にも眠ってません？笑`,
      directHook: `丸洗いできて構造シンプルなこれならズボラな私でも毎日快適に使えてます◎`,
      tag: '丁寧な暮らし挫折',
    },
    story4: {
      main: `防災リュックを久しぶりに点検したんです。\n\n非常食の賞味期限を見たら2年前に切れてて「うそでしょ…」。\n…人はそれを完全な油断と呼ぶ。（知らんがな）\n乾電池も液漏れしてて白目剥きました。\n備えた気になって放置してる防災袋、みなさんも今すぐ確認してみて…！`,
      directHook: `長期保存・日常使いもできるローリングストックに切り替えて大正解でした✨️`,
      tag: '防災点検',
    },
  };
}
