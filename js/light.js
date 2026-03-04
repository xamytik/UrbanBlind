// js/modules/light.js
import { CONFIG } from './config.js';
import { getCachedData, setCachedData } from './utils.js';

export async function getLightFromOSM(lat, lon) {
    const cacheKey = `light:${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    const timeInfo = await getTimeOfDayByLocation(lat, lon);

    if (timeInfo.isDaytime) {
        return {
            level: 95,
            risk: 10,
            desc: 'Естественное освещение (день)',
            source: 'time'
        };
    }

    const query = `[out:json][timeout:25];(node["highway"="street_lamp"](around:200,${lat},${lon});node["man_made"="street_lamp"](around:200,${lat},${lon}););out count;`;

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
        if (count > 15) { level = 75; risk = 25; desc = 'Хорошее освещение'; }
        else if (count > 5) { level = 50; risk = 45; desc = 'Среднее освещение'; }
        else { level = 25; risk = 70; desc = 'Слабое освещение'; }

        const result = { level, risk, desc, source: 'osm' };
        setCachedData(cacheKey, result);
        return result;

    } catch (error) {
        console.error("Ошибка освещенности:", error);
        // Fallback
        const count = Math.floor(Math.random() * 20) + 5;
        let level, risk, desc;
        if (count > 15) { level = 70; risk = 30; desc = 'Fallback'; }
        else if (count > 8) { level = 45; risk = 50; desc = 'Fallback'; }
        else { level = 25; risk = 70; desc = 'Fallback'; }

        return { level, risk, desc: 'Fallback', source: 'fallback' };
    }
}

// Вспомогательная функция для времени суток
export async function getTimeOfDayByLocation(lat, lon) {
    const now = new Date();
    const sunData = await getSunriseSunset(lat, lon);
    const hour = now.getHours();

    if (!sunData) {
        return {
            timeOfDay: hour >= 6 && hour < 12 ? 'Утро' :
                       hour >= 12 && hour < 18 ? 'День' :
                       hour >= 18 && hour < 23 ? 'Вечер' : 'Ночь',
            isDaytime: hour >= 6 && hour < 22,
            description: 'Локальное время'
        };
    }

    const isDaytime = now >= sunData.sunrise && now < sunData.sunset;
    let timeOfDay, description;

    if (now < sunData.sunrise) {
        timeOfDay = 'Ночь';
        description = 'Темно, ограниченная видимость';
    } else if (now < new Date(sunData.sunrise.getTime() + 2 * 60 * 60 * 1000)) {
        timeOfDay = 'Утро';
        description = 'Активное движение';
    } else if (now < sunData.sunset) {
        timeOfDay = 'День';
        description = 'Высокая активность';
    } else if (now < sunData.civil_twilight_end) {
        timeOfDay = 'Вечер';
        description = 'Активность снижается';
    } else {
        timeOfDay = 'Ночь';
        description = 'Темно, ограниченная видимость';
    }

    return { timeOfDay, isDaytime, description };
}

async function getSunriseSunset(lat, lon) {
    const cacheKey = `sunrise:${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&date=today&formatted=0`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, { signal: controller.signal });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (!data.results?.sunrise) throw new Error('Invalid response');

        const result = {
            sunrise: new Date(data.results.sunrise),
            sunset: new Date(data.results.sunset)
        };

        setCachedData(cacheKey, result);
        return result;

    } catch (error) {
        console.error("Ошибка восхода/заката:", error);
        return null;
    }
}