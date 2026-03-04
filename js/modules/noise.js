// js/modules/noise.js
import { CONFIG } from './config.js';
import { getCachedData, setCachedData } from './utils.js';

export async function getNoiseFromMeersens(lat, lon) {
    const cacheKey = `meersens:${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const url = `${CONFIG.meersensBaseUrl}?lat=${lat}&lng=${lon}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, {
            headers: {
                'apikey': CONFIG.meersensApiKey,
                'Accept': 'application/json'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        let noiseLevel = data?.noise?.Lden || data?.noise?.Lday || data?.noise?.average || null;

        if (noiseLevel !== null && noiseLevel !== undefined) {
            const risk = Math.min(100, Math.max(0, ((noiseLevel - 30) / 55) * 100));
            const result = {
                level: Math.round(noiseLevel),
                risk: Math.round(risk),
                desc: getNoiseDescription(noiseLevel),
                source: 'meersens'
            };

            setCachedData(cacheKey, result);
            return result;
        } else {
            throw new Error('No noise data');
        }

    } catch (error) {
        console.error("Ошибка шума:", error);
        // Fallback через OSM
        const query = `[out:json][timeout:25];(node["amenity"="cafe"](around:200,${lat},${lon});node["amenity"="bar"](around:200,${lat},${lon});node["highway"](around:150,${lat},${lon}););out count;`;

        try {
            const response = await fetch(CONFIG.overpassUrl, {
                method: 'POST',
                body: `data=${encodeURIComponent(query)}`,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const data = await response.json();
            const count = data.elements?.length || 0;

            let noiseLevel, risk, desc;
            if (count > 30) { noiseLevel = 70; risk = 75; desc = 'Очень шумно'; }
            else if (count > 15) { noiseLevel = 60; risk = 55; desc = 'Шумно'; }
            else if (count > 5) { noiseLevel = 50; risk = 35; desc = 'Умеренный шум'; }
            else { noiseLevel = 40; risk = 20; desc = 'Тихо'; }

            const result = { level: noiseLevel, risk: risk, desc: 'Fallback', source: 'fallback' };
            setCachedData(cacheKey, result);
            return result;

        } catch (e) {
            return { level: 50, risk: 40, desc: 'Fallback', source: 'fallback' };
        }
    }
}

function getNoiseDescription(db) {
    if (db < 45) return 'Тихо: спокойная зона';
    if (db < 55) return 'Умеренный шум: жилая зона';
    if (db < 65) return 'Заметный шум: оживлённая улица';
    if (db < 75) return 'Шумно: транспортная магистраль';
    return 'Очень шумно: зона высокого риска';
}