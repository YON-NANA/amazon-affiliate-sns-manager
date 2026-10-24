import { NextRequest, NextResponse } from 'next/server';
import { ResearchProduct, CategoryId } from '@/lib/types';

// 楽天API未設定時・フォールバック用のリアルなシミュレーション商品カタログ
const MOCK_RESEARCH_PRODUCTS: Record<string, ResearchProduct[]> = {
  pet: [
    {
      itemId: 'pet-sheet-001',
      title: '【超薄型 レギュラー 800枚 / ワイド 400枚】ペットシーツ 使い捨て 高吸収ポリマー 大容量 まとめ買い',
      price: 4380,
      reviewAverage: 4.62,
      reviewCount: 14250,
      itemUrl: 'https://item.rakuten.co.jp/sample-pet/sheet-800/',
      affiliateUrl: 'https://hb.afl.rakuten.co.jp/ichiba/sample-pet-sheet',
      imageUrl: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=500&auto=format&fit=crop&q=80',
      shopName: 'ペット館 楽天市場店',
      caption: '1枚あたりわずか5.4円！毎日こまめに取り替える多頭飼い・小型犬オーナーから圧倒的支持。ポリマーが瞬間吸収して足濡れを防止。',
      category: 'rescue_supplies',
      genre: 'pet',
      pointRate: 5,
      postageFlag: 1,
    },
    {
      itemId: 'pet-carbon-002',
      title: '【活性炭消臭・厚型】炭入り強力消臭ペットシーツ レギュラー400枚/ワイド200枚 逆戻り防止 高分子吸水材',
      price: 4980,
      reviewAverage: 4.58,
      reviewCount: 8930,
      itemUrl: 'https://item.rakuten.co.jp/sample-pet/carbon-sheet/',
      affiliateUrl: 'https://hb.afl.rakuten.co.jp/ichiba/sample-carbon-sheet',
      imageUrl: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=500&auto=format&fit=crop&q=80',
      shopName: 'わんこ＆にゃんこ生活',
      caption: '活性炭の力でアンモニア臭を徹底吸着！お留守番時間が長いご家庭や、玄関・リビングのニオイが気になるお部屋に最適。',
      category: 'pet_dog',
      genre: 'pet',
      pointRate: 3,
      postageFlag: 1,
    },
    {
      itemId: 'pet-waterproof-003',
      title: '【洗える防水シーツ 2枚組】シングル〜セミダブル対応 防水アンダー 丸洗いOK 抗菌防臭 速乾 介護 粗相対策',
      price: 2980,
      reviewAverage: 4.65,
      reviewCount: 6720,
      itemUrl: 'https://item.rakuten.co.jp/sample-bed/waterproof-mat/',
      affiliateUrl: 'https://hb.afl.rakuten.co.jp/ichiba/sample-waterproof-mat',
      imageUrl: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=500&auto=format&fit=crop&q=80',
      shopName: '安眠ライフ楽天市場店',
      caption: '裏面ポリウレタンラミネート加工で水分を1滴も通さない！洗濯機で丸洗いでき、愛犬・愛猫の予期せぬ粗相や嘔吐から布団・ソファを死守。',
      category: 'pet_care',
      genre: 'pet',
      pointRate: 2,
      postageFlag: 1,
    },
    {
      itemId: 'pet-fountain-004',
      title: '【静音設計 2.5L】循環式ペット自動給水器 軟水化フィルター3個付属 LED水位残量窓 ステンレス天板',
      price: 3680,
      reviewAverage: 4.52,
      reviewCount: 4890,
      itemUrl: 'https://item.rakuten.co.jp/sample-fountain/water-25l/',
      affiliateUrl: 'https://hb.afl.rakuten.co.jp/ichiba/sample-fountain',
      imageUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=500&auto=format&fit=crop&q=80',
      shopName: 'PetTech公式ストア',
      caption: '湧き出るお水に愛猫・愛犬も興味津々。イオン交換樹脂フィルターがマグネシウム・カルシウムを除去し尿路結石リスクを軽減。',
      category: 'pet_cat',
      genre: 'pet',
      pointRate: 4,
      postageFlag: 1,
    },
    {
      itemId: 'pet-brush-005',
      title: '【ワンプッシュ抜け毛ごっそり】ペット用グルーミングブラシ 丸洗い可能 先端丸型ピン スリッカーブラシ 犬猫兼用',
      price: 1980,
      reviewAverage: 4.71,
      reviewCount: 9340,
      itemUrl: 'https://item.rakuten.co.jp/sample-brush/one-push/',
      affiliateUrl: 'https://hb.afl.rakuten.co.jp/ichiba/sample-brush',
      imageUrl: 'https://images.unsplash.com/photo-1535930891776-0c2dfb7fda1a?w=500&auto=format&fit=crop&q=80',
      shopName: 'ハッピーペット通販',
      caption: '背面のボタンをポチッと押すだけで絡みついた毛がパカッと取れる！皮膚を傷つけない先端樹脂ボール加工でブラッシング嫌いの子にも。',
      category: 'pet_care',
      genre: 'pet',
      pointRate: 1,
      postageFlag: 1,
    },
    {
      itemId: 'pet-bos-006',
      title: '【驚異の防臭袋 BOS】ペット用 SSサイズ 200枚入 うんち袋 臭わない袋 ゴミ袋 衛生 防臭 防菌 クリロン化成',
      price: 1540,
      reviewAverage: 4.89,
      reviewCount: 16800,
      itemUrl: 'https://item.rakuten.co.jp/sample-bos/bos-ss-200/',
      affiliateUrl: 'https://hb.afl.rakuten.co.jp/ichiba/sample-bos-200',
      imageUrl: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=500&auto=format&fit=crop&q=80',
      shopName: 'BOS公式認定ショップ',
      caption: '医療現場の便処理から生まれた驚異の防臭素材。結んでゴミ箱に入れても全く臭わない！夏の散歩や室内ゴミ箱の悪臭トラブルをゼロに。',
      category: 'rescue_supplies',
      genre: 'pet',
      pointRate: 1,
      postageFlag: 0,
    },
  ],
  camp: [
    {
      itemId: 'camp-tent-001',
      title: '【3分設営 ワンタッチテント】3〜4人用 耐水圧3000mm UVカット率99% 前室キャノピー付き 蚊帳メッシュ',
      price: 9800,
      reviewAverage: 4.56,
      reviewCount: 3820,
      itemUrl: 'https://item.rakuten.co.jp/sample-camp/one-touch-tent/',
      affiliateUrl: 'https://hb.afl.rakuten.co.jp/ichiba/sample-one-touch-tent',
      imageUrl: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=500&auto=format&fit=crop&q=80',
      shopName: 'OUTDOOR GEAR LAB',
      caption: '傘をパッと開くように紐を引くだけで組み立て完了！ペグ打ちで疲弊せず、到着後すぐにBBQや乾杯が始められるファミリー・ソロ両用テント。',
      category: 'camp_gear',
      genre: 'camp',
      pointRate: 5,
      postageFlag: 1,
    },
    {
      itemId: 'camp-firepit-002',
      title: '【超軽量 A4サイズ収納】折りたたみ焚き火台 チタン/ステンレス製 スピット3本付属 ソロキャンプ バーベキューグリル',
      price: 3980,
      reviewAverage: 4.68,
      reviewCount: 5120,
      itemUrl: 'https://item.rakuten.co.jp/sample-camp/compact-firepit/',
      affiliateUrl: 'https://hb.afl.rakuten.co.jp/ichiba/sample-firepit',
      imageUrl: 'https://images.unsplash.com/photo-1525811902-f2342640856e?w=500&auto=format&fit=crop&q=80',
      shopName: 'CAMPING FIELD',
      caption: '本体重量わずか700g台！バイクのツーリングバッグや軽自動車の隙間にスッと入る。空気の流れを計算した逆三角錐構造で燃焼効率抜群。',
      category: 'camp_gear',
      genre: 'camp',
      pointRate: 3,
      postageFlag: 1,
    },
    {
      itemId: 'camp-mat-003',
      title: '【極厚 8cm 自動膨張】インフレーターマット ワイドサイズ 車中泊マット 高反発ウレタン 連結可能 防寒 断熱',
      price: 5480,
      reviewAverage: 4.61,
      reviewCount: 6490,
      itemUrl: 'https://item.rakuten.co.jp/sample-camp/inflator-mat-8cm/',
      affiliateUrl: 'https://hb.afl.rakuten.co.jp/ichiba/sample-inflator-mat',
      imageUrl: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=500&auto=format&fit=crop&q=80',
      shopName: '車中泊＆アウトドア本舗',
      caption: 'バルブを開くだけでふっくら自動吸引。砂利のゴツゴツや冬の地面からの底冷えを完全にブロックし、ベッド同等の快眠を約束。',
      category: 'camp_gear',
      genre: 'camp',
      pointRate: 4,
      postageFlag: 1,
    },
    {
      itemId: 'camp-lantern-004',
      title: '【1000ルーメン 充電式】LEDランタン 10000mAh モバイルバッテリー機能 4色切替 無段階調光 防滴 IPX4',
      price: 3880,
      reviewAverage: 4.64,
      reviewCount: 4210,
      itemUrl: 'https://item.rakuten.co.jp/sample-camp/led-lantern-1000lm/',
      affiliateUrl: 'https://hb.afl.rakuten.co.jp/ichiba/sample-led-lantern',
      imageUrl: 'https://images.unsplash.com/photo-1508873696983-2df5293cb395?w=500&auto=format&fit=crop&q=80',
      shopName: 'ライトギア楽天市場店',
      caption: 'メインランタンとしてサイト全体を明るく照らす驚異の大光量。スマホの緊急充電も可能で防災兼用ライトとしても超人気。',
      category: 'camp_gear',
      genre: 'camp',
      pointRate: 2,
      postageFlag: 1,
    },
  ],
  disaster: [
    {
      itemId: 'disaster-power-001',
      title: '【リン酸鉄 1000Wh】大容量ポータブル電源 AC定格1200W(サージ2400W) 急速70分フル充電 長寿命3500回 防災 車中泊',
      price: 79800,
      reviewAverage: 4.74,
      reviewCount: 2940,
      itemUrl: 'https://item.rakuten.co.jp/sample-disaster/power-station-1000/',
      affiliateUrl: 'https://hb.afl.rakuten.co.jp/ichiba/sample-power-station',
      imageUrl: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=500&auto=format&fit=crop&q=80',
      shopName: 'ポータブル電源公式ストア',
      caption: '停電時でも家庭用エアコンや電気毛布、冷蔵庫を動かせる命綱。リン酸鉄リチウムイオン採用で10年以上の高耐久＆高安全性を誇る。',
      category: 'disaster_prep',
      genre: 'disaster',
      pointRate: 10,
      postageFlag: 1,
    },
    {
      itemId: 'disaster-carrier-002',
      title: '【拡張型 避難ハウス兼用】ペットキャリーリュック メッシュ窓 折りたたみ 小型犬 猫用 耐荷重10kg 防災同行避難',
      price: 5280,
      reviewAverage: 4.67,
      reviewCount: 3810,
      itemUrl: 'https://item.rakuten.co.jp/sample-disaster/expand-carrier/',
      affiliateUrl: 'https://hb.afl.rakuten.co.jp/ichiba/sample-expand-carrier',
      imageUrl: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=500&auto=format&fit=crop&q=80',
      shopName: '防災ペット用品直販',
      caption: '避難時は両手が自由になるリュック型。避難所や車内では背面を広げてケージハウスに変形。窮屈なストレスから愛犬・愛猫を守る。',
      category: 'disaster_prep',
      genre: 'disaster',
      pointRate: 3,
      postageFlag: 1,
    },
    {
      itemId: 'disaster-toilet-003',
      title: '【15年保存 100回分】非常用簡易トイレセット 凝固剤＋消臭防臭袋 抗菌 消臭 汚物袋 断水 災害 停電 凝固スピード抜群',
      price: 5980,
      reviewAverage: 4.78,
      reviewCount: 11400,
      itemUrl: 'https://item.rakuten.co.jp/sample-disaster/emergency-toilet-100/',
      affiliateUrl: 'https://hb.afl.rakuten.co.jp/ichiba/sample-toilet-100',
      imageUrl: 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=500&auto=format&fit=crop&q=80',
      shopName: '防災プロショップ',
      caption: '大地震で一番困るのが下水の逆流とトイレ問題。便器に被せて粉をかけるだけで数秒で固化し、15年間備蓄できる家庭用インフラ。',
      category: 'disaster_prep',
      genre: 'disaster',
      pointRate: 5,
      postageFlag: 1,
    },
    {
      itemId: 'disaster-water-004',
      title: '【硬度0 ペット専用 5年保存水】500ml×24本 超軟水 純水 尿路結石予防 非常用保存水 ミネラルフリー',
      price: 4980,
      reviewAverage: 4.63,
      reviewCount: 2310,
      itemUrl: 'https://item.rakuten.co.jp/sample-disaster/pet-pure-water-5y/',
      affiliateUrl: 'https://hb.afl.rakuten.co.jp/ichiba/sample-pet-water',
      imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80',
      shopName: 'ペット防災支援センター',
      caption: '犬猫にとって人間用ミネラルウォーターのカルシウム・マグネシウムは毒。結石リスクをゼロにする純水仕立ての長期備蓄水。',
      category: 'water_purifier',
      genre: 'disaster',
      pointRate: 3,
      postageFlag: 1,
    },
  ],
  travel: [
    {
      itemId: 'travel-hotel-nasu-001',
      title: '那須温泉 ホテルフォレストヒルズ那須 with DOGS【全室離れのコテージ＆天然温泉】',
      price: 24000,
      reviewAverage: 4.82,
      reviewCount: 3420,
      itemUrl: 'https://travel.rakuten.co.jp/HOTEL/12345/12345.html',
      affiliateUrl: 'https://hb.afl.rakuten.co.jp/hgc/g0190dd1.travel-sample-nasu',
      imageUrl: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=500&auto=format&fit=crop&q=80',
      shopName: '楽天トラベル',
      caption: '森に囲まれた全室離れコテージ。客室天然温泉＆専用ウッドチップドッグラン付き。愛犬同伴フレンチや部屋食も選べて愛犬家リピート率No.1。',
      category: 'pet_travel',
      genre: 'travel',
      pointRate: 5,
      postageFlag: 1,
    },
    {
      itemId: 'travel-hotel-izu-002',
      title: '伊豆高原 ドッグリゾート ONE LOVE【全室海一望の客室露天風呂＆芝生ドッグラン】',
      price: 28500,
      reviewAverage: 4.89,
      reviewCount: 2890,
      itemUrl: 'https://travel.rakuten.co.jp/HOTEL/23456/23456.html',
      affiliateUrl: 'https://hb.afl.rakuten.co.jp/hgc/g0190dd1.travel-sample-izu',
      imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&auto=format&fit=crop&q=80',
      shopName: '楽天トラベル',
      caption: '全室オーシャンビュー＆客室露天風呂完備。広大な天然芝ドッグランとワンちゃん専用温水プール・足湯付き。金目鯛の豪華部屋食ディナーが好評。',
      category: 'pet_travel',
      genre: 'travel',
      pointRate: 4,
      postageFlag: 1,
    },
    {
      itemId: 'travel-hotel-karuizawa-003',
      title: 'レジーナリゾート軽井沢御影用水【プライベートドッグラン付き客室＆御影用水散策路】',
      price: 32000,
      reviewAverage: 4.78,
      reviewCount: 4150,
      itemUrl: 'https://travel.rakuten.co.jp/HOTEL/34567/34567.html',
      affiliateUrl: 'https://hb.afl.rakuten.co.jp/hgc/g0190dd1.travel-sample-karuizawa',
      imageUrl: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=500&auto=format&fit=crop&q=80',
      shopName: '楽天トラベル',
      caption: '御影用水の穏やかな水辺に佇む上質リゾート。1階は広々プライベートドッグラン直結。愛犬用アメニティが完璧に揃い、初めての愛犬旅行も安心。',
      category: 'pet_travel',
      genre: 'travel',
      pointRate: 3,
      postageFlag: 1,
    },
    {
      itemId: 'travel-hotel-hakone-004',
      title: 'レジーナリゾート箱根仙石原【全室源泉かけ流し客室露天風呂＆専用プライベートラン】',
      price: 38000,
      reviewAverage: 4.85,
      reviewCount: 3120,
      itemUrl: 'https://travel.rakuten.co.jp/HOTEL/45678/45678.html',
      affiliateUrl: 'https://hb.afl.rakuten.co.jp/hgc/g0190dd1.travel-sample-hakone',
      imageUrl: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=500&auto=format&fit=crop&q=80',
      shopName: '楽天トラベル',
      caption: '箱根仙石原の静寂に包まれた極上温泉宿。全室に白濁の源泉かけ流し露天風呂を完備。朝夕お部屋食で家族みんなで気兼ねなく旬の懐石料理を満喫。',
      category: 'pet_travel',
      genre: 'travel',
      pointRate: 5,
      postageFlag: 1,
    },
  ],
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      keyword = 'ペットシーツ 薄型',
      genre = 'pet',
      sort = '+reviewCount',
      hits = 12,
      applicationId: clientAppId,
      affiliateId: clientAffiliateId,
    } = body;

    const appId = clientAppId || process.env.RAKUTEN_APPLICATION_ID;
    const affId = clientAffiliateId || process.env.RAKUTEN_AFFILIATE_ID;

    // 楽天APIキーが存在する場合は公式APIをリクエスト
    if (appId) {
      try {
        const rakutenUrl = new URL('https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601');
        rakutenUrl.searchParams.set('applicationId', appId);
        if (affId) rakutenUrl.searchParams.set('affiliateId', affId);
        rakutenUrl.searchParams.set('keyword', keyword);
        rakutenUrl.searchParams.set('sort', sort);
        rakutenUrl.searchParams.set('hits', String(Math.min(hits, 30)));
        rakutenUrl.searchParams.set('format', 'json');
        rakutenUrl.searchParams.set('formatVersion', '2');
        rakutenUrl.searchParams.set('imageFlag', '1');

        const apiRes = await fetch(rakutenUrl.toString(), {
          headers: {
            'User-Agent': 'AffiliateSnsManager/1.0',
          },
          next: { revalidate: 300 }, // 5分キャッシュ
        });

        if (apiRes.ok) {
          const apiData = await apiRes.json();
          if (apiData.Items && Array.isArray(apiData.Items) && apiData.Items.length > 0) {
            const mappedProducts: ResearchProduct[] = apiData.Items.map((item: any, idx: number) => {
              const rawItem = item.Item || item;
              const imgUrl = rawItem.mediumImageUrls?.[0]?.imageUrl || rawItem.smallImageUrls?.[0]?.imageUrl || '';
              // 高解像度画像に置換（128x128 -> 500x500）
              const cleanImgUrl = imgUrl.replace(/\?_ex=\d+x\d+/, '?_ex=500x500') || 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=500&auto=format&fit=crop&q=80';

              const defaultCategory: CategoryId = genre === 'camp'
                ? 'camp_gear'
                : genre === 'disaster'
                  ? 'disaster_prep'
                  : 'rescue_supplies';

              return {
                itemId: rawItem.itemCode || `rakuten_${idx}`,
                title: rawItem.itemName || '楽天市場 人気商品',
                price: Number(rawItem.itemPrice) || 0,
                reviewAverage: Number(rawItem.reviewAverage) || 4.5,
                reviewCount: Number(rawItem.reviewCount) || 100,
                itemUrl: rawItem.itemUrl || '',
                affiliateUrl: rawItem.affiliateUrl || rawItem.itemUrl || '',
                imageUrl: cleanImgUrl,
                shopName: rawItem.shopName || '楽天市場ショップ',
                caption: rawItem.itemCaption ? rawItem.itemCaption.substring(0, 160) + '...' : '',
                category: defaultCategory,
                genre: genre as any,
                pointRate: rawItem.pointRate || 1,
                postageFlag: rawItem.postageFlag || 0,
              };
            });

            return NextResponse.json({
              success: true,
              isSimulated: false,
              source: 'rakuten_official_api',
              totalCount: apiData.count || mappedProducts.length,
              keyword,
              products: mappedProducts,
            });
          }
        } else {
          const errText = await apiRes.text();
          console.warn('Rakuten API returned non-200, falling back to simulated data:', errText);
        }
      } catch (apiError) {
        console.warn('Rakuten API fetch error, falling back to simulation:', apiError);
      }
    }

    // 楽天APIキー未設定またはエラー時のシミュレーション返却
    const genreKey = (genre in MOCK_RESEARCH_PRODUCTS) ? genre : 'pet';
    let baseList = MOCK_RESEARCH_PRODUCTS[genreKey] || MOCK_RESEARCH_PRODUCTS.pet;

    // キーワード簡易フィルタ（完全一致がない場合は全体を返す）
    const lowerKeyword = keyword.toLowerCase();
    const filtered = baseList.filter(p => 
      p.title.toLowerCase().includes(lowerKeyword) || 
      p.caption?.toLowerCase().includes(lowerKeyword) ||
      p.shopName.toLowerCase().includes(lowerKeyword)
    );
    const resultList = filtered.length > 0 ? filtered : baseList;

    return NextResponse.json({
      success: true,
      isSimulated: true,
      source: 'mock_simulation',
      notice: '【開発・テスト用シミュレーションデータ】楽天APIキーが未設定のため、売れ筋シミュレーション商品（★4.5以上・レビュー多数）を表示しています。設定モーダルでAPIキーを入力すると実データに切り替わります。',
      totalCount: resultList.length,
      keyword,
      products: resultList,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'リサーチ処理に失敗しました' },
      { status: 500 }
    );
  }
}
