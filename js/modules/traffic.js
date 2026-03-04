// js/modules/traffic.js
import { CONFIG } from './config.js';
import { getCachedData, setCachedData } from './utils.js';

export async function getTrafficFromTomTom(lat, lon) {
    const cacheKey = `tomtom:${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const url = `${CONFIG.tomTomBaseUrl}?point=${lat},${lon}&key=${CONFIG.tomTomApiKey}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (!data.flowSegmentData) throw new Error('Invalid response');

        const { currentSpeed, freeFlowSpeed, roadClosure } = data.flowSegmentData;
        let trafficLevel = 0;

        if (roadClosure) {
            trafficLevel = 10;
        } else if (freeFlowSpeed > 0) {
            const speedRatio = currentSpeed / freeFlowSpeed;
            trafficLevel = Math.min(10, Math.round((1 - speedRatio) * 10));
        }

        let status, speedAvg;
        if (roadClosure) {
            status = 'Дорога закрыта';
            speedAvg = '0 км/ч';
        } else if (trafficLevel > 7) {
            status = 'Высокая загруженность';
            speedAvg = `${Math.min(20, currentSpeed)} км/ч`;
        } else if (trafficLevel > 4) {
            status = 'Умеренная загруженность';
            speedAvg = `${Math.min(30, currentSpeed)} км/ч`;
        } else {
            status = 'Низкая загруженность';
            speedAvg = `${Math.min(50, currentSpeed)} км/ч`;
        }

        const trafficData = {
            level: trafficLevel,
            status: status,
            speed_avg: speedAvg,
            source: 'tomtom'
        };

        setCachedData(cacheKey, trafficData);
        return trafficData;

    } catch (error) {
        console.error("Ошибка пробок:", error);
        // Fallback
        return {
            level: 5,
            status: 'Данные недоступны',
            speed_avg: '--',
            source: 'fallback'
        };
    }
}