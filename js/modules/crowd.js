// js/modules/crowd.js
import { CONFIG } from './config.js';
import { getCachedData, setCachedData } from './utils.js';

export async function getCrowdFromOSM(lat, lon) {
    const cacheKey = `crowd:${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    const query = `[out:json][timeout:25];(node["amenity"="cafe"](around:200,${lat},${lon});node["amenity"="restaurant"](around:200,${lat},${lon});node["shop"](around:200,${lat},${lon});node["highway"="bus_stop"](around:200,${lat},${lon}););out count;`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(CONFIG.overpassUrl, {
            method: 'POST',
            body: `data=${encodeURIComponent(query)}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const count = data.elements?.length || 0;

        let level, risk, desc;
        if (count > 50) { level = 85; risk = 65; desc = 'Высокая плотность'; }
        else if (count > 25) { level = 60; risk = 45; desc = 'Средняя плотность'; }
        else if (count > 10) { level = 35; risk = 25; desc = 'Низкая плотность'; }
        else { level = 15; risk = 15; desc = 'Очень низкая плотность'; }

        const result = { level, risk, desc, source: 'osm' };
        setCachedData(cacheKey, result);
        return result;

    } catch (error) {
        console.error("Ошибка плотности:", error);
        // Fallback
        const count = Math.floor(Math.random() * 40) + 10;
        let level, risk, desc;
        if (count > 30) { level = 70; risk = 55; desc = 'Fallback'; }
        else if (count > 15) { level = 45; risk = 35; desc = 'Fallback'; }
        else { level = 25; risk = 20; desc = 'Fallback'; }

        return { level, risk, desc: 'Fallback', source: 'fallback' };
    }
}