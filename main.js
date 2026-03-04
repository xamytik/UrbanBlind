// js/main.js - Основной файл UrbanBlind
import { calculateRiskFactors } from './modules/main-logic.js';
import { getWeatherFromOpenMeteo } from './modules/weather.js';
import { getTrafficFromTomTom } from './modules/traffic.js';
import { getNoiseFromMeersens } from './modules/noise.js';
import { getCrowdFromOSM } from './modules/crowd.js';
import { getLightFromOSM, getTimeOfDayByLocation } from './modules/light.js';
import { renderData, showLoader, updateStatus } from './modules/ui.js';
import { initMap } from './modules/map.js';

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let map, placemark;
let currentCoords = [55.7961, 49.1064];
let lastRequestTime = 0;
let lastRequestCoords = null;
let isDragging = false;
let pendingRequest = null;
let mapInitialized = false;
let apiCache = new Map();
let demoMode = false;

// --- КОНФИГУРАЦИЯ ---
const CONFIG = {
    throttleMs: 600,
    minDragDistance: 0.001,
    defaultCoords: [55.7961, 49.1064],
    debugMode: false,
    overpassUrl: 'https://overpass-api.de/api/interpreter',
    openMeteoUrl: 'https://api.open-meteo.com/v1/forecast',
    sunriseUrl: 'https://api.sunrise-sunset.org/json',
    overpassTimeout: 25,
    cacheDuration: 300000,
    // API ключи
    meersensApiKey: '0N2Odysx0NER8r240yxEY5DvbdC900HU',
    meersensBaseUrl: 'https://api.meersens.com/environment/public/noise/v1',
    tomTomApiKey: 'yq5C1dZiEviylLPM4Z2ZSh9wzuACsoQZ',
    tomTomBaseUrl: 'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json'
};

// --- УТИЛИТЫ ---
function throttle(func, limitMs) {
    return function(...args) {
        const now = Date.now();
        const coords = args[0];
        if (lastRequestCoords) {
            const dist = Math.hypot(coords[0] - lastRequestCoords[0], coords[1] - lastRequestCoords[1]);
            if (dist < CONFIG.minDragDistance && now - lastRequestTime < limitMs * 2) {
                return;
            }
        }
        if (now - lastRequestTime >= limitMs) {
            lastRequestTime = now;
            lastRequestCoords = [...coords];
            func.apply(this, args);
        } else {
            if (pendingRequest) clearTimeout(pendingRequest);
            pendingRequest = setTimeout(() => {
                lastRequestTime = Date.now();
                lastRequestCoords = [...coords];
                func.apply(this, args);
                pendingRequest = null;
            }, limitMs - (now - lastRequestTime));
        }
    };
}

function formatCoord(val) { return val.toFixed(4); }

function getCachedData(key) {
    const cached = apiCache.get(key);
    if (cached && Date.now() - cached.time < CONFIG.cacheDuration) {
        return cached.data;
    }
    return null;
}

function setCachedData(key, data) {
    apiCache.set(key, { data, time: Date.now() });
}

// --- ОСНОВНОЙ ЗАПРОС ДАННЫХ ---
async function requestWeatherData(coords, force = false) {
    if (!force && lastRequestCoords &&
        Math.abs(coords[0] - lastRequestCoords[0]) < 0.0001 &&
        Math.abs(coords[1] - lastRequestCoords[1]) < 0.0001) {
        return;
    }

    showLoader(true);

    try {
        const risks = await calculateRiskFactors(coords);
        renderData({ risks }, coords);
        updateStatus('ok', 'Данные обновлены');

    } catch (err) {
        console.error("Ошибка запроса:", err);
        updateStatus('warning', 'Ошибка обновления');

    } finally {
        showLoader(false);
    }
}

// --- ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener('DOMContentLoaded', () => {
    initMap(requestWeatherData);

    // Кнопка обновления
    document.getElementById('btn-force-refresh').addEventListener('click', () => {
        apiCache.clear();
        demoMode = false;
        document.getElementById('demo-badge').style.display = 'none';
        requestWeatherData(currentCoords, true);
    });

    // Проверка подключения
    window.addEventListener('online', () => updateStatus('ok', 'Подключение восстановлено'));
    window.addEventListener('offline', () => updateStatus('error', 'Нет подключения'));
});

// --- ЭКСПОРТ ДЛЯ ТЕСТОВ ---
export { requestWeatherData, calculateRiskFactors };