import https from 'node:https';

export function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('request timed out')));
  });
}

export async function httpGetJson(url, headers = {}) {
  const { status, body } = await httpGet(url, headers);
  if (status !== 200) throw new Error(`HTTP ${status} for ${url}`);
  return JSON.parse(body);
}
