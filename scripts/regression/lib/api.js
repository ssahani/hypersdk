'use strict';

const https = require('https');
const http = require('http');

function createApi(cfg) {
  let cookie = '';
  const insecure = cfg.baseUrl.startsWith('https:');

  function api(method, path, body) {
    return new Promise((resolve, reject) => {
      const data = body !== undefined && body !== null ? JSON.stringify(body) : null;
      const headers = { Accept: 'application/json' };
      if (cookie) headers.Cookie = cookie;
      if (data) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(data);
      }
      const lib = insecure ? https : http;
      const opts = {
        host: cfg.host,
        port: cfg.port,
        path,
        method,
        headers,
      };
      if (insecure) opts.rejectUnauthorized = false;
      const r = lib.request(opts, (res) => {
        const set = res.headers['set-cookie'];
        if (set) cookie = set.map((c) => c.split(';')[0]).join('; ');
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            body: d,
            ct: res.headers['content-type'] || '',
          }),
        );
      });
      r.on('error', reject);
      if (data) r.write(data);
      r.end();
    });
  }

  async function login() {
    const r = await api('POST', '/api/v1/auth/login', {
      username: cfg.username,
      password: cfg.password,
    });
    if (r.status < 200 || r.status >= 300) {
      throw new Error(`login failed ${r.status}: ${String(r.body || '').slice(0, 160)}`);
    }
    if (!cookie) {
      throw new Error('login succeeded but no session cookie was set');
    }
    return r;
  }

  return { api, login, getCookie: () => cookie };
}

module.exports = { createApi };
