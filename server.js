#!/usr/bin/env node
const http = require('http');
const https = require('https');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const url = require('url');

const PORT = 4321;
const SKILL_SCRIPT = path.join(os.homedir(), '.claude/skills/follow-builders/scripts/prepare-digest.js');
const CACHE_BUILDERS = path.join(__dirname, '.cache-builders.json');
const CACHE_AIHOT = path.join(__dirname, '.cache-aihot.json');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CACHE_BUILDERPULSE = path.join(__dirname, '.cache-builderpulse.json');

function isFresh(file, maxAgeMs = 3600000) {
  try {
    const s = fs.statSync(file);
    return (Date.now() - s.mtimeMs) < maxAgeMs;
  } catch { return false; }
}

function httpsGet(reqUrl, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = { headers: { 'User-Agent': UA, ...headers } };
    https.get(reqUrl, opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('JSON parse failed: ' + data.slice(0, 200))); }
      });
    }).on('error', reject);
  });
}

function fetchBuilders(cb) {
  if (isFresh(CACHE_BUILDERS)) return cb(null, JSON.parse(fs.readFileSync(CACHE_BUILDERS, 'utf8')));
  execFile('node', [SKILL_SCRIPT], { timeout: 30000, cwd: path.dirname(SKILL_SCRIPT) }, (err, stdout) => {
    if (err) return cb(err);
    try {
      const data = JSON.parse(stdout);
      data._cachedAt = new Date().toISOString();
      fs.writeFileSync(CACHE_BUILDERS, JSON.stringify(data));
      cb(null, data);
    } catch (e) { cb(e); }
  });
}

async function fetchAihot() {
  if (isFresh(CACHE_AIHOT)) return JSON.parse(fs.readFileSync(CACHE_AIHOT, 'utf8'));
  const data = await httpsGet(
    `https://aihot.virxact.com/api/public/items?mode=all&take=100`
  );
  const result = { items: data.items || [], _cachedAt: new Date().toISOString() };
  fs.writeFileSync(CACHE_AIHOT, JSON.stringify(result));
  return result;
}

function httpsGetText(reqUrl) {
  return new Promise((resolve, reject) => {
    https.get(reqUrl, { headers: { 'User-Agent': UA } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, text: data }));
    }).on('error', reject);
  });
}

async function fetchBuilderPulse() {
  if (isFresh(CACHE_BUILDERPULSE, 3600000)) return JSON.parse(fs.readFileSync(CACHE_BUILDERPULSE, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const year = today.slice(0, 4);
  let { status, text } = await httpsGetText(
    `https://raw.githubusercontent.com/BuilderPulse/BuilderPulse/main/zh/${year}/${today}.md`
  );
  if (status === 404 || !text.trim()) {
    // 拉最新一期
    const listData = await httpsGet(
      `https://api.github.com/repos/BuilderPulse/BuilderPulse/contents/zh/${year}`
    );
    const files = Array.isArray(listData) ? listData : [];
    const latest = files.filter(f => f.name.endsWith('.md')).sort((a,b) => a.name < b.name ? 1 : -1)[0];
    if (latest) {
      const r = await httpsGetText(latest.download_url);
      text = r.text;
    }
  }
  const result = { markdown: text, _cachedAt: new Date().toISOString() };
  fs.writeFileSync(CACHE_BUILDERPULSE, JSON.stringify(result));
  return result;
}

async function fetchOembed(tweetUrl) {
  const oemUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&theme=dark&dnt=true&hide_thread=true&omit_script=true`;
  return httpsGet(oemUrl);
}

const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  if (parsed.pathname === '/api/builders') {
    fetchBuilders((err, data) => {
      if (err) { res.writeHead(500); return res.end(JSON.stringify({ error: err.message })); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    });

  } else if (parsed.pathname === '/api/builders/refresh') {
    try { fs.unlinkSync(CACHE_BUILDERS); } catch {}
    fetchBuilders((err, data) => {
      if (err) { res.writeHead(500); return res.end(JSON.stringify({ error: err.message })); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    });

  } else if (parsed.pathname === '/api/aihot') {
    try {
      const data = await fetchAihot();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }

  } else if (parsed.pathname === '/api/aihot/refresh') {
    try { fs.unlinkSync(CACHE_AIHOT); } catch {}
    try {
      const data = await fetchAihot();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }

  } else if (parsed.pathname === '/api/builderpulse') {
    try {
      const data = await fetchBuilderPulse();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }

  } else if (parsed.pathname === '/api/builderpulse/refresh') {
    try { fs.unlinkSync(CACHE_BUILDERPULSE); } catch {}
    try {
      const data = await fetchBuilderPulse();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }

  } else if (parsed.pathname === '/api/oembed') {
    const tweetUrl = parsed.query.url;
    if (!tweetUrl) { res.writeHead(400); return res.end('{}'); }
    try {
      const data = await fetchOembed(tweetUrl);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(200); res.end(JSON.stringify({ error: e.message }));
    }

  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 AI 资讯站已启动: http://localhost:${PORT}\n`);
});
