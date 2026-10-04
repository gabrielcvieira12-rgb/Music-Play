// Service worker — deixa o app instalável e funcionando offline.
//
// IMPORTANTE: quando mudar qualquer arquivo do site (CSS, JS, HTML...),
// aumente o número em VERSAO. Sem isso o navegador continua servindo
// os arquivos antigos que ficaram guardados no cache.
const VERSAO = 'v4'
const cacheName = `music-player-${VERSAO}`

const arquivosDoApp = [
    './dist',
    './index.html',
    './dist/index.js',
    './style.css',
    './dist/manifest.webmanifest',
    './js/app.js',
    './js/bubbles.js',
    './js/firebase-config.js',
    './js/icons.js',
    './images/icon-192.png',
    './images/icon-512.png',
]

// Instala: guarda os arquivos do app no cache
self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(arquivosDoApp)))
    self.skipWaiting()
})

// Ativa: apaga caches de versões antigas
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then((nomes) => Promise.all(
                nomes.filter((n) => n !== cacheName).map((n) => caches.delete(n))
            ))
            .then(() => self.clients.claim())
    )
})

self.addEventListener('fetch', (e) => {
    const req = e.request

    // Só requisições GET podem ser guardadas (login do Firebase usa POST)
    if (req.method !== 'GET') return

    e.respondWith(networkFirst(req))
})

// Todos os arquivos (do site, Firebase, CDN): rede primeiro (sempre a versão mais nova),
// cache só se estiver offline. Procura apenas no cache DESTA versão,
// para nunca devolver arquivos de uma versão antiga.
async function networkFirst(req) {
    const cache = await caches.open(cacheName)
    try {
        const resposta = await fetch(req)
        if (resposta.status === 200) cache.put(req, resposta.clone())
        return resposta
    } catch {
        return cache.match(req)
    }
}