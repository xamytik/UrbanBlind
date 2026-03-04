// js/modules/main-logic.js

import { getWeatherFromOpenMeteo } from './weather.js';
import { getTrafficFromTomTom } from './traffic.js';
import { getNoiseFromMeersens } from './noise.js';
import { getCrowdFromOSM } from './crowd.js';
import { getLightFromOSM, getTimeOfDayByLocation } from './light.js';

/**
 * Основная функция расчёта факторов риска
 * @param {number[]} coords - [широта, долгота]
 * @returns {Promise<Object>} - объект с факторами риска
 */
export async function calculateRiskFactors(coords) {
    const [lat, lon] = coords;
    const now = new Date();
    const day = now.getDay();
    const timeInfo = await getTimeOfDayByLocation(lat, lon);

    // --- ВРЕМЯ СУТОК ---
    let timeRisk;
    if (timeInfo.timeOfDay === 'Ночь') timeRisk = 75;
    else if (timeInfo.timeOfDay === 'Вечер') timeRisk = 60;
    else if (timeInfo.timeOfDay === 'Утро') timeRisk = 30;
    else timeRisk = 40;

    // --- ДЕНЬ НЕДЕЛИ ---
    const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const dayName = dayNames[day];
    let dayRisk, dayDesc;

    if (day === 0 || day === 6) {
        dayRisk = 35;
        dayDesc = 'Выходной день';
    } else if (day === 5) {
        dayRisk = 70;
        dayDesc = 'Пятница';
    } else {
        dayRisk = 55;
        dayDesc = 'Будний день';
    }

    // --- ПАРАЛЛЕЛЬНЫЕ ЗАПРОСЫ К API ---
    const [noiseData, crowdData, lightData, weatherData, trafficData] = await Promise.allSettled([
        getNoiseFromMeersens(lat, lon),
        getCrowdFromOSM(lat, lon),
        getLightFromOSM(lat, lon),
        getWeatherFromOpenMeteo(lat, lon),
        getTrafficFromTomTom(lat, lon)
    ]);

    // --- ОБРАБОТКА РЕЗУЛЬТАТОВ ---
    const noise = noiseData.status === 'fulfilled' ? noiseData.value : {
        level: 45,
        risk: 30,
        desc: 'Данные недоступны',
        source: 'fallback'
    };

    const crowd = crowdData.status === 'fulfilled' ? crowdData.value : {
        level: 25,
        risk: 20,
        desc: 'Данные недоступны',
        source: 'fallback'
    };

    const light = lightData.status === 'fulfilled' ? lightData.value : {
        level: 25,
        risk: 70,
        desc: 'Данные недоступны',
        source: 'fallback'
    };

    const weather = weatherData.status === 'fulfilled' ? weatherData.value : {
        temp: 0,
        condition: 'Недоступно',
        wind: '—',
        humidity: 0
    };

    const traffic = trafficData.status === 'fulfilled' ? trafficData.value : {
        level: 5,
        status: 'Недоступно',
        speed_avg: '--',
        source: 'fallback'
    };

    // --- РАСЧЁТ ОБЩЕГО ИНДЕКСА БЕЗОПАСНОСТИ ---
    const trafficRisk = traffic.level * 10;
    const avgRisk = (noise.risk + crowd.risk + light.risk + timeRisk + dayRisk + trafficRisk) / 6;
    const safetyIndex = Math.round(100 - avgRisk);

    return {
        noise, crowd, light,
        time: {
            value: timeInfo.timeOfDay,
            risk: timeRisk,
            desc: timeInfo.description
        },
        day: {
            value: dayName,
            risk: dayRisk,
            desc: dayDesc
        },
        traffic, weather, safetyIndex,
        timestamp: new Date().toLocaleString('ru-RU')
    };
}

/**
 * Функция для получения прогноза безопасности в будущем времени
 * @param {number[]} coords
 * @param {Date} futureTime
 * @returns {Promise<Object>}
 */
export async function predictSafetyAtTime(coords, futureTime) {
    const [lat, lon] = coords;
    const timeInfo = await getTimeOfDayByLocation(lat, lon);

    // Простой прогноз на основе исторических данных и типа дня
    const hour = futureTime.getHours();
    const dayOfWeek = futureTime.getDay();

    let predictedRisk = 0;

    // Время суток
    if (hour >= 22 || hour < 6) predictedRisk += 70;
    else if (hour >= 18) predictedRisk += 55;
    else if (hour >= 6) predictedRisk += 40;

    // День недели
    if (dayOfWeek === 5) predictedRisk += 15; // Пятница
    else if (dayOfWeek === 0 || dayOfWeek === 6) predictedRisk -= 10; // Выходные

    // Усреднение с текущими факторами
    const currentRisks = await calculateRiskFactors(coords);
    const currentAvgRisk = (currentRisks.noise.risk + currentRisks.crowd.risk + currentRisks.light.risk) / 3;

    const finalPredictedRisk = (predictedRisk * 0.3) + (currentAvgRisk * 0.7);
    const predictedSafetyIndex = Math.round(100 - finalPredictedRisk);

    return {
        predictedSafetyIndex,
        factors: {
            timeOfDayRisk: predictedRisk,
            dayOfWeekFactor: dayOfWeek === 5 ? 15 : dayOfWeek === 0 || dayOfWeek === 6 ? -10 : 0
        },
        confidence: 0.75 // 75% уверенности
    };
}

/**
 * Функция для анализа тренда безопасности (улучшается/ухудшается)
 * @param {Object[]} historicalData - массив исторических данных [{timestamp, safetyIndex}]
 * @returns {string} - тренд: 'up', 'down', 'stable'
 */
export function analyzeSafetyTrend(historicalData) {
    if (historicalData.length < 2) return 'unknown';

    const recentData = historicalData.slice(-5); // Последние 5 точек
    const first = recentData[0].safetyIndex;
    const last = recentData[recentData.length - 1].safetyIndex;

    const change = last - first;
    const absChange = Math.abs(change);

    if (absChange < 5) return 'stable';
    if (change > 0) return 'improving';
    return 'declining';
}