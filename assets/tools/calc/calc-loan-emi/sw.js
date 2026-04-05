/*
====================================================================
[SERVICE WORKER] - SMART EMI CALCULATOR ULTRA PRO MAX
Ensures offline availability and fast loading.
====================================================================
*/

const CACHE_NAME = 'emi-calc-v1-webp'; // Version updated
const ASSETS_TO_CACHE = [
    './calc-loan-emi.html',
    './assets/tools/calc/calc-loan-emi/style.css',
    './assets/tools/calc/calc-loan-emi/script.js',
    './assets/tools/calc/calc-loan-emi/chart.min.js',
    './assets/tools/calc/calc-loan-emi/jspdf.umd.min.js',
    './assets/css/global.css',
    './manifest.json',
    // Updated to .webp files
    './assets/tools/calc/calc-loan-emi/icon-192.webp',
    './assets/tools/calc/calc-loan-emi/icon-512.webp'
];

// Install Event - Caching Assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
});

// Fetch Event - Serve from cache when offline
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
