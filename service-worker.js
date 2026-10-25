
const CACHE_NAME = "meu-dinheiro-v10";

const ARQUIVOS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js?v=10",
  "./manifest.json"
];

// INSTALAR

self.addEventListener("install", evento => {
  evento.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ARQUIVOS);
    })
  );

  self.skipWaiting();
});

// ATIVAR E REMOVER CACHES ANTIGOS

self.addEventListener("activate", evento => {
  evento.waitUntil(
    caches.keys().then(chaves => {
      return Promise.all(
        chaves
          .filter(chave => chave !== CACHE_NAME)
          .map(chave => caches.delete(chave))
      );
    })
  );

  self.clients.claim();
});

// CARREGAR CÓDIGO ATUALIZADO PRIMEIRO

self.addEventListener("fetch", evento => {
  const requisicao = evento.request;

  if (requisicao.method !== "GET") return;

  const url = new URL(requisicao.url);

  if (url.origin !== self.location.origin) return;

  evento.respondWith(
    fetch(requisicao)
      .then(resposta => {
        if (resposta.ok) {
          const copia = resposta.clone();

          evento.waitUntil(
            caches.open(CACHE_NAME).then(cache => {
              return cache.put(requisicao, copia);
            })
          );
        }

        return resposta;
      })
      .catch(async () => {
        const cache = await caches.match(requisicao);

        return cache || Response.error();
      })
  );
});
