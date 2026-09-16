/* Web Push: подпись VAPID и шифрование по RFC 8291 (aes128gcm).
   Библиотеки в воркер не тащим — здесь всё на WebCrypto, около сотни строк.
   Нужно ровно три вещи: JWT для сервера пушей, общий секрет с браузером
   по ECDH и один AES-GCM блок с телом уведомления. */

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64u = s => {
 const t = String(s).replace(/-/g,'+').replace(/_/g,'/');
 const bin = atob(t + '='.repeat((4 - t.length % 4) % 4));
 return Uint8Array.from(bin, c => c.charCodeAt(0));
};
const cat = (...as) => {
 const n = as.reduce((s,a)=>s+a.length,0), out = new Uint8Array(n);
 let i = 0; for(const a of as){ out.set(a, i); i += a.length; }
 return out;
};
const enc = new TextEncoder();

/* Приватный ключ VAPID хранится как d в base64url (как его печатает генератор) */
async function vapidKey(pub, priv){
 const jwk = {kty:'EC', crv:'P-256', x:b64u(unb64u(pub).slice(1,33)), y:b64u(unb64u(pub).slice(33,65)), d:priv, ext:true};
 return crypto.subtle.importKey('jwk', jwk, {name:'ECDSA', namedCurve:'P-256'}, false, ['sign']);
}

/* JWT для сервера пушей: заголовок и тело в base64url, подпись ES256 */
async function vapidJwt(aud, subject, pub, priv){
 const head = b64u(enc.encode(JSON.stringify({typ:'JWT', alg:'ES256'})));
 const body = b64u(enc.encode(JSON.stringify({aud, exp:Math.floor(Date.now()/1e3) + 12*3600, sub:subject})));
 const key = await vapidKey(pub, priv);
 const sig = await crypto.subtle.sign({name:'ECDSA', hash:'SHA-256'}, key, enc.encode(head + '.' + body));
 return head + '.' + body + '.' + b64u(sig);
}

const hkdf = async (salt, ikm, info, len) => {
 const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF', hash:'SHA-256', salt, info}, key, len*8));
};

/* Тело уведомления шифруется общим секретом: наш одноразовый ключ + ключ браузера (p256dh),
   плюс его auth. Всё по RFC 8291; заголовок aes128gcm идёт перед шифротекстом. */
async function encrypt(p256dh, auth, payload){
 const client = unb64u(p256dh), authSecret = unb64u(auth);
 const salt = crypto.getRandomValues(new Uint8Array(16));
 const kp = await crypto.subtle.generateKey({name:'ECDH', namedCurve:'P-256'}, true, ['deriveBits']);
 const ourPub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
 const theirKey = await crypto.subtle.importKey('raw', client, {name:'ECDH', namedCurve:'P-256'}, false, []);
 const shared = new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH', public:theirKey}, kp.privateKey, 256));
 const prk = await hkdf(authSecret, shared, cat(enc.encode('WebPush: info\0'), client, ourPub), 32);
 const cek = await hkdf(salt, prk, enc.encode('Content-Encoding: aes128gcm\0'), 16);
 const nonce = await hkdf(salt, prk, enc.encode('Content-Encoding: nonce\0'), 12);
 const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
 /* 0x02 — признак конца записи, как велит RFC */
 const body = cat(enc.encode(payload), new Uint8Array([2]));
 const ct = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM', iv:nonce}, key, body));
 const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
 return cat(salt, rs, new Uint8Array([ourPub.length]), ourPub, ct);
}

/* Одно уведомление одной подписке. Возвращает код ответа: 404 и 410 значат, что
   подписка умерла и её надо выкинуть. */
export async function sendPush(sub, payload, env){
 const url = new URL(sub.endpoint);
 const jwt = await vapidJwt(url.origin, env.PUSH_SUBJECT || 'mailto:clutch@example.com', env.VAPID_PUBLIC, env.VAPID_PRIVATE);
 const body = await encrypt(sub.keys.p256dh, sub.keys.auth, payload);
 const r = await fetch(sub.endpoint, {
  method:'POST',
  headers:{
   'content-type':'application/octet-stream',
   'content-encoding':'aes128gcm',
   'ttl':'600',
   'urgency':'high',
   authorization:'vapid t=' + jwt + ', k=' + env.VAPID_PUBLIC
  },
  body
 });
 return r.status;
}
