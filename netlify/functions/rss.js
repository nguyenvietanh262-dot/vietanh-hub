// netlify/functions/rss.js
// ─────────────────────────────────────────────────────────────────────────────
// RSS Proxy cho VietAnh Hub
// Fetch + parse bất kỳ RSS/Atom feed, trả về JSON array bài viết
// Deploy: đặt file này vào /netlify/functions/rss.js trong repo Netlify
// Gọi từ frontend: /.netlify/functions/rss?url=https://hbr.org/feed
// ─────────────────────────────────────────────────────────────────────────────

const https = require('https');
const http = require('http');
const { URL } = require('url');

// ─── Whitelist nguồn được phép fetch ─────────────────────────────────────────
// Thêm domain mới vào đây khi bổ sung nguồn
const ALLOWED_DOMAINS = [
  'hbr.org',
  'simonsinek.com',
  'sloanreview.mit.edu',
  'restaurantbusinessonline.com',
  'techcrunch.com',
  'feeds.feedburner.com',
  'medium.com',
  'rss.nytimes.com',
  'feeds.a.dj.com',       // WSJ
  'feeds.reuters.com',
  'hnrss.org',             // Hacker News RSS
  'feeds.feedblitz.com',
  'substack.com',
  'feeds.hbr.org',
'hnrss.org',
];

// ─── Simple RSS/Atom parser (không dùng thư viện ngoài) ──────────────────────
function parseRSS(xml) {
  const items = [];

  // Thử RSS 2.0 trước
  const itemMatches = [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)];
  if (itemMatches.length > 0) {
    for (const m of itemMatches) {
      items.push(parseRSSItem(m[1]));
    }
    return items;
  }

  // Thử Atom feed
  const entryMatches = [...xml.matchAll(/<entry[^>]*>([\s\S]*?)<\/entry>/gi)];
  for (const m of entryMatches) {
    items.push(parseAtomEntry(m[1]));
  }
  return items;
}

function getText(xml, tag) {
  // Hỗ trợ CDATA
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRe);
  if (cdataMatch) return cdataMatch[1].trim();

  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(re);
  if (match) return match[1].replace(/<[^>]+>/g, '').trim();
  return '';
}

function getAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
  const match = xml.match(re);
  return match ? match[1] : '';
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseRSSItem(xml) {
  const title = getText(xml, 'title');
  const link = getText(xml, 'link') || getAttr(xml, 'link', 'href');
  const pubDate = getText(xml, 'pubDate') || getText(xml, 'dc:date') || getText(xml, 'published');
  const author = getText(xml, 'dc:creator') || getText(xml, 'author') || '';
  const content = getText(xml, 'content:encoded') || getText(xml, 'content') || '';
  const description = getText(xml, 'description') || '';
  const snippet = stripHtml(description || content).slice(0, 300);

  return { title, link, pubDate, isoDate: pubDate, author, content, contentSnippet: snippet };
}

function parseAtomEntry(xml) {
  const title = getText(xml, 'title');
  const link = getAttr(xml, 'link', 'href');
  const published = getText(xml, 'published') || getText(xml, 'updated');
  const author = getText(xml, 'name') || '';
  const content = getText(xml, 'content') || getText(xml, 'summary') || '';
  const snippet = stripHtml(content).slice(0, 300);

  return { title, link, pubDate: published, isoDate: published, author, content, contentSnippet: snippet };
}

// ─── HTTP fetch helper ────────────────────────────────────────────────────────
function fetchUrl(urlStr, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));

    let parsed;
    try { parsed = new URL(urlStr); } catch { return reject(new Error('Invalid URL')); }

    const mod = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'VietAnhHub/1.0 RSS Reader (+https://vietanh.netlify.app)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      timeout: 8000,
    };

    const req = mod.request(options, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        return resolve(fetchUrl(res.headers.location, redirectCount + 1));
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
    req.end();
  });
}

// ─── Handler ──────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=900', // cache 15 phút trên CDN
  };

  // OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }

  const rssUrl = event.queryStringParameters?.url;
  if (!rssUrl) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing ?url param' }) };
  }

  // Kiểm tra whitelist
  let parsed;
  try { parsed = new URL(rssUrl); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid URL' }) };
  }

  const hostname = parsed.hostname.replace(/^www\./, '');
  const allowed = ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  if (!allowed) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: `Domain không được phép: ${hostname}. Thêm vào ALLOWED_DOMAINS trong rss.js.` }),
    };
  }

  try {
    const xml = await fetchUrl(rssUrl);
    const items = parseRSS(xml);
    return { statusCode: 200, headers, body: JSON.stringify(items) };
  } catch (err) {
    console.error('RSS fetch error:', err.message);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: `Không fetch được feed: ${err.message}` }),
    };
  }
};
