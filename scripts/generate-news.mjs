// 週1回、子ども向けニュース10件を生成して news.json に書き出す（Node 20 / 追加ライブラリなし）
import { writeFileSync } from 'node:fs';

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('ANTHROPIC_API_KEY がありません'); process.exit(1); }

const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // 日本時間
const prompt = `今日は${today}です。直近1週間ほどの日本と世界のニュースから、小学5年生が読んで学べる話題を10件選び、ウェブ検索で事実を確認したうえで書いてください。
条件:
- 題材は科学・技術、環境、経済・くらし、国際、スポーツ・文化など。事件・事故・災害の被害、犯罪、政治的な対立や選挙は選ばない。
- 検索で確認できた事実だけを書き、推測や評価は書かない。
- 各件は2〜3文。1文は30〜60文字。漢字かな交じりで、むずかしい言葉には短い説明を添える。
- 数字は漢数字で書く。使ってよい記号は「」、。のみ。英字や括弧は使わない。
- 出力はJSONのみ。説明文やコードブロックは付けない。
形式: {"items":[{"title":"分野と話題の短い題名","sentences":["…","…"]}]}`;

const messages = [{ role: 'user', content: prompt }];
let data;
for (let i = 0; i < 3; i++) {                       // 検索が長引いた場合は続きを依頼
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-5-5', max_tokens: 6000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      messages,
    }),
  });
  if (!res.ok) { console.error('API error', res.status, await res.text()); process.exit(1); }
  data = await res.json();
  if (data.stop_reason !== 'pause_turn') break;
  messages.push({ role: 'assistant', content: data.content });
}

const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
let parsed;
try { parsed = JSON.parse(text.match(/\{[\s\S]*\}/)[0]); }
catch (e) { console.error('JSONを読み取れませんでした:\n', text.slice(0, 500)); process.exit(1); }

// 検査：怖い話題や不自然な文を落とす
const BAN = /殺|死亡|死者|遺体|暴行|逮捕|容疑|テロ|戦死|虐待|性的|自殺|爆発|銃/;
const date = today.slice(5).replace('-', '/');
const items = (parsed.items || [])
  .map(i => ({ title: String(i.title || '').trim().slice(0, 30), date,
               sentences: (i.sentences || []).map(s => ({ kanji: String(s).trim() })) }))
  .filter(i => i.title && !BAN.test(i.title) && i.sentences.length >= 2 &&
               i.sentences.every(s => s.kanji.length >= 15 && s.kanji.length <= 90 && !/\n/.test(s.kanji) && !BAN.test(s.kanji)));

if (items.length < 4) { console.error('有効な項目が少なすぎます:', items.length); process.exit(1); } // 失敗時は前回分を残す
writeFileSync('news.json', JSON.stringify({ updated: today, items }, null, 1));
console.log(`news.json を書き出しました（${items.length}件）`);
