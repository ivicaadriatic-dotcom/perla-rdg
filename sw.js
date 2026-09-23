/* PERLA NOTTE RDG — service worker
   Aplikacija radi i bez interneta; podaci ostaju u localStorage preglednika. */
var VERZIJA = 'pn-rdg-v140';

var JEZGRA = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

/* Knjiznice s CDN-a: spremaju se pri prvoj instalaciji da aplikacija radi i offline.
   Ako koja ne uspije, instalacija se svejedno dovrsava. */
var KNJIZNICE = [
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.1/tesseract.min.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERZIJA).then(function (c) {
      return c.addAll(JEZGRA).then(function () {
        return Promise.all(KNJIZNICE.map(function (u) {
          return c.add(new Request(u, { mode: 'cors' })).catch(function () {});
        }));
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (k) {
      return Promise.all(k.map(function (n) {
        if (n !== VERZIJA) return caches.delete(n);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (e) {
  if (e.data === 'preuzmi-odmah') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // VAZNO: sve sto nije ova aplikacija ili unaprijed popisana knjiznica
  // ide ravno na mrezu, bez spremnika. Bez ovoga bi se spremio i odgovor
  // Supabasea, pa bi aplikacija zauvijek citala staro stanje iz memorije
  // i sinkronizacija izmedu racunala i mobitela ne bi radila.
  var jeNase = (url.origin === self.location.origin);
  var jeKnjiznica = KNJIZNICE.indexOf(url.href.split('?')[0]) >= 0;
  if (!jeNase && !jeKnjiznica) return;

  // HTML: prvo mreza (da se azuriranje odmah vidi), pa spremnik ako nema veze
  var jeHtml = req.mode === 'navigate' || /\.html?$/.test(url.pathname);
  if (jeHtml) {
    e.respondWith(
      fetch(req).then(function (r) {
        var kopija = r.clone();
        caches.open(VERZIJA).then(function (c) { c.put(req, kopija); });
        return r;
      }).catch(function () {
        return caches.match(req).then(function (r) { return r || caches.match('./index.html'); });
      })
    );
    return;
  }

  // Sve ostalo (ikone, CDN knjiznice): prvo spremnik, pa mreza
  e.respondWith(
    caches.match(req, { ignoreVary: true }).then(function (r) {
      if (r) return r;
      return fetch(req).then(function (net) {
        if (net && net.status === 200 && (net.type === 'basic' || net.type === 'cors')) {
          var kopija = net.clone();
          caches.open(VERZIJA).then(function (c) { c.put(req, kopija); });
        }
        return net;
      }).catch(function () { return r; });
    })
  );
});
