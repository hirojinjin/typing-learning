// 週1回、子ども向けニュース10件を生成して news.json に書き出す（Node 20 / 追加ライブラリなし）
import { writeFileSync } from 'node:fs';

// ---------- 読みの補正（日付・年・人数・よく間違える言葉）----------
// 自動変換が間違えやすい読みを、先にひらがなにしてから変換にかけます。
// 足したい言葉は READING_WORDS に ['漢字','よみ'] を1行ずつ足せば直ります（長い言葉を先に書く）。
const READING_WORDS=[['平地','へいち'],['日本海','にほんかい'],['日本列島','にほんれっとう'],['直接話','ちょくせつはなし'],['七転び八起き','ななころびやおき'],['七転八倒','しちてんばっとう'],['急がば回れ','いそがばまわれ'],['身から出たさび','みからでたさび'],['一期一会','いちごいちえ'],['温故知新','おんこちしん'],['晴耕雨読','せいこううどく'],['自画自賛','じがじさん'],['勇猛果敢','ゆうもうかかん'],['異口同音','いくどうおん'],['四字熟語','よじじゅくご'],['祇園精舎','ぎおんしょうじゃ'],['清少納言','せいしょうなごん'],['梅雨','つゆ'],['扇状地','せんじょうち'],['三角州','さんかくす'],['代かき','しろかき'],['田おこし','たおこし'],['稲刈り','いねかり'],['子葉','しよう'],['高潮','たかしお'],['稚魚','ちぎょ'],['沖合','おきあい'],['羊水','ようすい'],['胎盤','たいばん'],['農協','のうきょう'],['読み仮名','よみがな'],['振り仮名','ふりがな'],['平仮名','ひらがな'],['片仮名','かたかな'],['仮名遣い','かなづかい'],['仮名','かな'],['三日月','みかづき'],['日本人','にほんじん'],['日本語','にほんご'],['日本中','にほんじゅう'],['世界中','せかいじゅう'],['一日中','いちにちじゅう'],['上手','じょうず'],['下手','へた'],['大丈夫','だいじょうぶ'],['果物','くだもの'],['眼鏡','めがね'],['部屋','へや'],['一昨日','おととい'],['明後日','あさって'],['今夜','こんや'],['大勢','おおぜい']];
const DAY_READ={1:'ついたち',2:'ふつか',3:'みっか',4:'よっか',5:'いつか',6:'むいか',7:'なのか',8:'ようか',9:'ここのか',10:'とおか',14:'じゅうよっか',17:'じゅうしちにち',19:'じゅうくにち',20:'はつか',24:'にじゅうよっか',27:'にじゅうしちにち',29:'にじゅうくにち'};
const KN={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
function kanjiNum(t){ const m=t.match(/^(?:([二三])?十([一二三四五六七八九])?|([一二三四五六七八九]))$/); if(!m) return 0; if(m[3]) return KN[m[3]]; return (m[1]?KN[m[1]]:1)*10+(m[2]?KN[m[2]]:0); }
function numKana(v){
 const D=['','いち','に','さん','よん','ご','ろく','なな','はち','きゅう'], T=['','せん','にせん','さんぜん','よんせん','ごせん','ろくせん','ななせん','はっせん','きゅうせん'],
  H=['','ひゃく','にひゃく','さんびゃく','よんひゃく','ごひゃく','ろっぴゃく','ななひゃく','はっぴゃく','きゅうひゃく'], J=['','じゅう','にじゅう','さんじゅう','よんじゅう','ごじゅう','ろくじゅう','ななじゅう','はちじゅう','きゅうじゅう'];
 const o=v%10, one={4:'よ',7:'なな',9:'く'}[o]||D[o];   // 〜よねん・〜くねん
 return T[Math.floor(v/1000)]+H[Math.floor(v/100)%10]+J[Math.floor(v/10)%10]+one;
}
const STAND={'黄緑色':'きみどりいろ','緑色':'みどりいろ','黄緑':'きみどり','青色':'あおいろ','赤色':'あかいろ','黄色':'きいろ','茶色':'ちゃいろ','水色':'みずいろ','灰色':'はいいろ','桃色':'ももいろ','金色':'きんいろ','銀色':'ぎんいろ','紫色':'むらさきいろ','橙色':'だいだいいろ','空色':'そらいろ',
 '正に':'まさに','更に':'さらに','既に':'すでに','最も':'もっとも','全て':'すべて','全く':'まったく','何故':'なぜ','或いは':'あるいは','即ち':'すなわち','但し':'ただし','且つ':'かつ','殊に':'ことに','概ね':'おおむね','専ら':'もっぱら','敢えて':'あえて','却って':'かえって','予め':'あらかじめ','暫く':'しばらく','僅か':'わずか','遂に':'ついに','稀に':'まれに','例えば':'たとえば'};
// 色や副詞は「前に漢字がないとき」だけ置きかえる（「修正に」「変更に」などを壊さないため）
const STAND_RE=new RegExp('(^|[^\\u4e00-\\u9fff])('+Object.keys(STAND).sort((a,b)=>b.length-a.length).join('|')+')','g');
const NUMR=['','いち','に','さん','よん','ご','ろく','なな','はち','きゅう'], NUMP={'二':'に','三':'さん','四':'よん','五':'ご','六':'ろく','七':'なな','八':'はち','九':'きゅう','十':'じゅう'};
const CTR={'個':['こ',{1:'いっこ',6:'ろっこ',8:'はっこ',0:'じゅっこ'}],'本':['ほん',{1:'いっぽん',3:'さんぼん',6:'ろっぽん',8:'はっぽん',0:'じゅっぽん'}],'匹':['ひき',{1:'いっぴき',3:'さんびき',6:'ろっぴき',8:'はっぴき',0:'じゅっぴき'}],
 '枚':['まい',{}],'回':['かい',{1:'いっかい',6:'ろっかい',8:'はっかい',0:'じゅっかい'}],'冊':['さつ',{1:'いっさつ',8:'はっさつ',0:'じゅっさつ'}],'杯':['はい',{1:'いっぱい',3:'さんばい',6:'ろっぱい',8:'はっぱい',0:'じゅっぱい'}],
 '台':['だい',{}],'歳':['さい',{1:'いっさい',8:'はっさい',0:'じゅっさい'}],'時':['じ',{4:'よじ',7:'しちじ',9:'くじ'}]};
function numRun(t){ const m=t.match(/^(?:([二三四五六七八九])?十([一二三四五六七八九])?|([一二三四五六七八九]))$/); if(!m) return 0; if(m[3]) return KN[m[3]]; return (m[1]?KN[m[1]]:1)*10+(m[2]?KN[m[2]]:0); }
function ctrRead(n,c){ const base=CTR[c][0], sp=CTR[c][1], t=Math.floor(n/10), o=n%10, tens=t===0?'':(t>1?NUMR[t]:'')+'じゅう';
 if(o===0) return sp[0]?((t>1?NUMR[t]:'')+sp[0]):tens+base;
 return tens+(sp[o]||NUMR[o]+base); }
const STRICT={'日本':'にほん','今日':'きょう','昨日':'きのう','明日':'あした','今年':'ことし','今朝':'けさ','大人':'おとな'};
// 前後に漢字がないときだけ置きかえる（「日本海」「大人数」などの一部を壊さないため）
const STRICT_RE=new RegExp('(^|[^\\u4e00-\\u9fff])('+Object.keys(STRICT).join('|')+')(?![\\u4e00-\\u9fff])','g');
function fixReadings(t){
 t=t.replace(STRICT_RE,(a,p,w)=>p+STRICT[w]);
 if(!/アメリカ|米国|日米|米軍|米大統領|米政府|訪米|在米|北米|南米|渡米|ワシントン|ニューヨーク|トランプ|ドル|貿易|関税|大統領|政権|議会/.test(t)) t=t.replace(/(^|[^\u4e00-\u9fff])米(?=[はがをにでのもとやづ、。])/g,'$1こめ');   // アメリカの文脈では「べい」のまま   // 単独の「米」は こめ
 t=t.replace(/([ぁ-んァ-ヶー])間(?=(?:に(?!合)|は|の|が|で|、|。))/g,'$1あいだ');   // 「夏の間」は あいだ
 t=t.replace(/(雨|雪|雹|霰|霜|灰)((?:が|は|も|の)[ぁ-んー]{0,6}?)?降(?=[りるっられ])/g,(a,w,p)=>/[をに]/.test((p||'').slice(1))?a:w+(p||'')+'ふ');   // 雪が降る は ふる
 t=t.replace(STAND_RE,(a,p,w)=>p+STAND[w]);
t=t.replace(/(?<![〇一二三四五六七八九十百])(二、三|四、五|五、六|六、七|七、八|八、九)日(?!間)/g,(a,w)=>({'二、三':'に、さんにち','四、五':'し、ごにち','五、六':'ご、ろくにち','六、七':'ろく、しちにち','七、八':'しち、はちにち','八、九':'はち、くにち'})[w]);   // 「二、三日」はにさんにち
 t=t.replace(/([二三四五六七八九十])、(?=(?:[二三四五六七八九]?十[一二三四五六七八九]?|[一二三四五六七八九])(?:個|本|匹|枚|回|冊|杯|台|歳|時|日))/g,(a,c)=>NUMP[c]+'、');   // 「二、三個」の二
 t=t.replace(/([〇一二三四五六七八九十百千万]+)(個|本|匹|枚|回|冊|杯|台|歳|時)(間|目)?/g,(a,num,c,sf)=>{ const n=numRun(num); if(!n) return a; return ctrRead(n,c)+(sf==='間'?'かん':sf==='目'?'め':''); });   // 数＋助数詞
 t=t.replace(/(^|[^\u4e00-\u9fff])土(を|が|は|に|で|の|も|と|や|、|。)/g,'$1つち$2');   // 単独の「土」は つち
 t=t.replace(/([ぁ-んァ-ヶー〇一二三四五六七八九十])行(は|が|を|に|の|で|と|も|や|ごと|目|間|、|。|$)/g,'$1ぎょう$2');   // 「行」は文章の“行（ぎょう）”のとき
 READING_WORDS.forEach(([k,r])=>{ t=t.split(k).join(r); });
 t=t.replace(/([〇一二三四五六七八九]{4})年(度|間)?/g,(a,y,sf)=>numKana(parseInt([...y].map(c=>c==='〇'?0:KN[c]).join(''),10))+'ねん'+(sf==='度'?'ど':sf==='間'?'かん':''));
 t=t.replace(/(月)?((?:[二三])?十[一二三四五六七八九]?|[一二三四五六七八九])日(間|目)?/g,(a,mo,num,sf)=>{ const n=kanjiNum(num); if(!n||(n===1&&!mo)||!DAY_READ[n]) return a; return (mo||'')+DAY_READ[n]+(sf==='間'?'かん':sf==='目'?'め':''); });
 t=t.replace(/(^|[^一二三四五六七八九十百千])([一二])人/g,(a,p,c)=>p+(c==='一'?'ひとり':'ふたり'));
 return t;
}

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('ANTHROPIC_API_KEY がありません'); process.exit(1); }

const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // 日本時間
const prompt = `今日は${today}です。直近1週間ほどの日本と世界のニュースから、小学5年生が読んで学べる話題を10件選び、ウェブ検索で事実を確認したうえで書いてください。
条件:
- 題材は科学・技術、環境、経済・くらし、国際、スポーツ・文化など。事件・事故・災害の被害、犯罪、政治的な対立や選挙は選ばない。
- 検索で確認できた事実だけを書き、推測や評価は書かない。
- 各件は2〜3文。1文は30〜60文字。漢字かな交じりで、むずかしい言葉には短い説明を添える。
- 数字は漢数字で書く。使ってよい記号は「」、。のみ。英字や括弧は使わない。
- 引用の印（<cite>など）やHTMLタグ、出典の記号は、文章の中に一切入れない。
- 出力はJSONのみ。説明文やコードブロックは付けない。
形式: {"items":[{"title":"分野と話題の短い題名","sentences":["…","…"]}]}`;

const messages = [{ role: 'user', content: prompt }];
async function call(extra = {}) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-5-5', max_tokens: 8000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      messages, ...extra,
    }),
  });
  if (!res.ok) { console.error('API error', res.status, await res.text()); process.exit(1); }
  return res.json();
}
const textOf = d => d.content.filter(b => b.type === 'text').map(b => b.text).join('');
const report = d => console.log('stop_reason:', d.stop_reason, '| blocks:', d.content.map(b => b.type).join(','), '| usage:', JSON.stringify(d.usage));

let data, allText = '';
for (let i = 0; i < 6; i++) {                       // 検索が長引いた場合は続きを依頼
  data = await call(); report(data); allText += textOf(data);
  if (data.stop_reason !== 'pause_turn') break;
  messages.push({ role: 'assistant', content: data.content });
}
let found = allText.match(/\{[\s\S]*\}/);
if (!found) {                                       // 文章が空だった場合：検索なしでJSONだけ書かせる
  console.log('文章が空だったため、JSONの出力を追加で依頼します');
  if (data.content.length) messages.push({ role: 'assistant', content: data.content });
  messages.push({ role: 'user', content: '検索で分かった事実だけをもとに、指定の形式のJSONだけを今すぐ出力してください。' });
  data = await call({ tool_choice: { type: 'none' } }); report(data);
  allText = textOf(data); found = allText.match(/\{[\s\S]*\}/);
}
let parsed;
try { parsed = JSON.parse(found[0]); }
catch (e) { console.error('JSONを読み取れませんでした:\n', allText.slice(0, 800)); process.exit(1); }

// 検査：怖い話題や不自然な文を落とす
const BAN = /殺|死亡|死者|遺体|暴行|逮捕|容疑|テロ|戦死|虐待|性的|自殺|爆発|銃/;
const date = today.slice(5).replace('-', '/');
const items = (parsed.items || [])
  .map(i => ({ title: String(i.title || '').replace(/<[^>]*>/g, '').trim().slice(0, 30), date,
               sentences: (i.sentences || []).map(s => ({ kanji: String(s).replace(/<[^>]*>/g, '').trim() })) }))
  .filter(i => i.title && !BAN.test(i.title) && i.sentences.length >= 2 &&
               i.sentences.every(s => s.kanji.length >= 15 && s.kanji.length <= 90 && !/\n/.test(s.kanji) && !/[<>]/.test(s.kanji) && !BAN.test(s.kanji)));

// 読み仮名をここで付ける（ブラウザで辞書を読むと重くて固まるため）
let final = items;
try {
  const pick = m => { const x = m.default ?? m; return x.default ?? x; };
  const Kuroshiro = pick(await import('kuroshiro'));
  const Analyzer = pick(await import('kuroshiro-analyzer-kuromoji'));
  const k = new Kuroshiro(); await k.init(new Analyzer());
  for (const it of items) for (const s of it.sentences) s.kana = await k.convert(fixReadings(s.kanji), { to: 'hiragana' });
  final = items.filter(it => it.sentences.every(s => !/[\u4e00-\u9fff]/.test(s.kana))); // 読めなかった漢字が残る項目は除く
  console.log('読み仮名を付けました');
} catch (e) { console.warn('読み仮名の付与に失敗（アプリ側で変換します）:', e.message); }

if (final.length < 4) { console.error('有効な項目が少なすぎます:', final.length); process.exit(1); } // 失敗時は前回分を残す
writeFileSync('news.json', JSON.stringify({ updated: today, items: final }, null, 1));
console.log(`news.json を書き出しました（${final.length}件）`);
