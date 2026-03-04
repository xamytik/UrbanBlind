// js/modules/utils.js
import { CONFIG } from './config.js';

let apiCache = new Map();
let requestQueue = [];

export function throttle(func, limitMs) {
    return function(...args) {
        const now = Date.now();
        const coords = args[0];
        if (this.lastRequestCoords) {
            const dist = Math.hypot(coords[0] - this.lastRequestCoords[0], coords[1] - this.lastRequestCoords[1]);
            if (dist < CONFIG.minDragDistance && now - this.lastRequestTime < limitMs * 2) {
                return;
            }
        }
        if (now - this.lastRequestTime >= limitMs) {
            this.lastRequestTime = now;
            this.lastRequestCoords = [...coords];
            return func.apply(this, args);
        } else {
            if (this.pendingRequest) clearTimeout(this.pendingRequest);
            this.pendingRequest = setTimeout(() => {
                this.lastRequestTime = Date.now();
                this.lastRequestCoords = [...coords];
                func.apply(this, args);
                this.pendingRequest = null;
            }, limitMs - (now - this.lastRequestTime));
        }
    };
}

export function formatCoord(val) {
    return val.toFixed(4);
}

export function getCachedData(key) {
    const cached = apiCache.get(key);
    if (cached && Date.now() - cached.time < CONFIG.cacheDuration) {
        return cached.data;
    }
    return null;
}

export function setCachedData(key, data) {
    apiCache.set(key, { data, time: Date.now() });
}

export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Очередь запросов для оптимизации
export async function queueRequest(requestFn) {
    return new Promise((resolve, reject) => {
        requestQueue.push({ fn: requestFn, resolve, reject });
        processQueue();
    });
}

async function processQueue() {
    if (requestQueue.length === 0 || requestQueue.length > 10) return; // Ограничение
    const nextRequest = requestQueue.shift();
    try {
        const result = await nextRequest.fn();
        nextRequest.resolve(result);
    } catch (error) {
        nextRequest.reject(error);
    }
}