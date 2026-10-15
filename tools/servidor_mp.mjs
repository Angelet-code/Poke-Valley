// Servidor del multijugador cooperativo del modo aventura (docs/GDD-combate.md): reenvía lo que manda cada jugador a
// los demás de su sala. No sabe nada del juego. Lo único suyo: el saludo ({t:'hola', uid, semilla}), con el que apunta
// el orden de llegada y la semilla de la sala (la del primero: así todos ven los mismos mapas) y se lo cuenta a todos
// ({t:'sala', jugadores, semilla}); y avisar ({t:'adios', uid}) cuando alguien se va.
// WebSocket hecho a mano (RFC 6455, solo texto) para no depender de paquetes.
//   node tools/servidor_mp.mjs [puerto]        (por defecto 5190; escucha en toda la red)
//   el juego: http://<host>:5174/?mp=ws://<host>:5190[/sala]
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';

const PUERTO = Number(process.argv[2] ?? 5190);
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const salas = new Map();   // sala → Set de conexiones (en orden de llegada)
const semillas = new Map(); // sala → semilla de sus mapas

// Un marco de texto (el servidor no enmascara).
function marco(txt) {
  const datos = Buffer.from(txt), n = datos.length;
  const cab = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x81, 127, 0, 0, 0, 0]), Buffer.from([n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255])]);
  return Buffer.concat([cab, datos]);
}

function aSala(c, txt) { for (const o of salas.get(c.sala) ?? []) if (o !== c && !o.sock.destroyed) o.sock.write(marco(txt)); }

function contarSala(nombre) {
  const cs = [...(salas.get(nombre) ?? [])].filter(o => o.uid);
  const txt = marco(JSON.stringify({ t: 'sala', jugadores: cs.map(o => o.uid), semilla: semillas.get(nombre) ?? null }));
  for (const o of cs) if (!o.sock.destroyed) o.sock.write(txt);
}

function cerrar(c) {
  if (c.cerrado) return;
  c.cerrado = true;
  const s = salas.get(c.sala);
  s?.delete(c);
  if (s && !s.size) { salas.delete(c.sala); semillas.delete(c.sala); }
  if (c.uid) { aSala(c, JSON.stringify({ t: 'adios', uid: c.uid })); contarSala(c.sala); }
  c.sock.destroy();
  console.log(`[${c.sala}] sale ${c.uid ?? '?'} (quedan ${s?.size ?? 0})`);
}

function mensaje(c, txt) {
  try {
    const m = JSON.parse(txt);
    if (m.t === 'hola' && typeof m.uid === 'string') {
      if (!c.uid) { c.uid = m.uid; console.log(`[${c.sala}] entra ${c.uid}`); }
      if (!semillas.has(c.sala) && Number.isFinite(m.semilla)) semillas.set(c.sala, m.semilla);
      contarSala(c.sala);
      return;
    }
  } catch { return; }   // lo que no es JSON no se reenvía
  aSala(c, txt);
}

// Lee los marcos que hayan llegado enteros (los del cliente vienen enmascarados).
function leer(c) {
  for (;;) {
    const b = c.buf;
    if (b.length < 2) return;
    const op = b[0] & 15, mask = b[1] & 128;
    let n = b[1] & 127, i = 2;
    if (n === 126) { if (b.length < 4) return; n = b.readUInt16BE(2); i = 4; }
    else if (n === 127) { if (b.length < 10) return; n = Number(b.readBigUInt64BE(2)); i = 10; }
    if (!mask || n > 1 << 20) { cerrar(c); return; }
    if (b.length < i + 4 + n) return;
    const k = b.subarray(i, i + 4), datos = Buffer.from(b.subarray(i + 4, i + 4 + n));
    for (let j = 0; j < n; j++) datos[j] ^= k[j & 3];
    c.buf = b.subarray(i + 4 + n);
    if (op === 8) { cerrar(c); return; }
    if (op === 9) { c.sock.write(Buffer.concat([Buffer.from([0x8a, datos.length]), datos])); continue; }   // ping → pong
    if (op === 1) {
      // Mensaje en varios marcos (FIN = 0): no hace falta para el juego; se descarta.
      if (b[0] & 128) mensaje(c, datos.toString('utf8'));
    }
  }
}

const servidor = createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(`Pokémon Valley: ${[...salas].map(([s, cs]) => `${s} (${cs.size})`).join(', ') || 'sin salas'}\n`); });
servidor.on('upgrade', (req, sock) => {
  const clave = req.headers['sec-websocket-key'];
  if (!clave) { sock.destroy(); return; }
  const acepta = createHash('sha1').update(clave + GUID).digest('base64');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acepta}\r\n\r\n`);
  sock.setNoDelay(true);
  // La ruta es la sala (sin el /mp/ del proxy de vite.online.config.ts).
  const sala = decodeURIComponent((req.url ?? '/').split('?')[0].replace(/^\/+|\/+$/g, '').replace(/^mp(\/|$)/, '')) || 'valle';
  const c = { sock, sala, uid: null, buf: Buffer.alloc(0), cerrado: false };
  if (!salas.has(sala)) salas.set(sala, new Set());
  salas.get(sala).add(c);
  sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); leer(c); });
  sock.on('close', () => cerrar(c));
  sock.on('error', () => cerrar(c));
});
servidor.listen(PUERTO, '0.0.0.0', () => console.log(`Multijugador en ws://0.0.0.0:${PUERTO} (sala = ruta de la URL; por defecto "valle")`));
