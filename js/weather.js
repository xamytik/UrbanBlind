// js/modules/weather.js
import { CONFIG } from './config.js';
import { getCachedData, setCachedData } from './utils.js';

export async function getWeatherFromOpenMeteo(lat, lon) {
    const cacheKey = `weather:${lat.toFixed(2)},${lon.toFixed(2)}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const url = `${CONFIG.openMeteoUrl}?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relative_humidity_2m&timezone=auto`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (!data.current_weather) throw new Error('Нет данных о погоде');

        let humidity = 0;
        if (data.hourly?.time?.length) {
            const now = new Date();
            const currentHour = now.getHours();
            const index = data.hourly.time.findIndex(t => new Date(t).getHours() === currentHour);
            humidity = index !== -1 ? data.hourly.relative_humidity_2m[index] : data.hourly.relative_humidity_2m[0] || 0;
        }

        const weather = {
            temp: data.current_weather.temperature ?? 0,
            wind: `${data.current_weather.windspeed ?? 0} м/с`,
            humidity: humidity,
            condition: getWeatherCondition(data.current_weather.weathercode)
        };

        setCachedData(cacheKey, weather);
        return weather;

    } catch (error) {
        console.error("Ошибка погоды:", error);
        return { temp: 0, wind: '—', humidity: 0, condition: 'Недоступно' };
    }
}

function getWeatherCondition(code) {
    const conditions = {
        0: '☀️ Ясно', 1: '🌤️ Преимущественно ясно', 2: '⛅ Переменная облачность',
        3: '☁️ Пасмурно', 45: '🌫️ Туман', 48: '❄️ Иней',
        51: '💧 Морось', 53: '💧 Морось', 55: '💧 Морось',
        61: '🌧️ Дождь', 63: '🌧️ Дождь', 65: '🌧️ Сильный дождь',
        71: '❄️ Снег', 73: '❄️ Снег', 75: '❄️ Сильный снег',
        80: '🌦️ Ливень', 81: '🌦️ Ливень', 82: '🌦️ Сильный ливень',
        95: '⛈️ Гроза', 96: '⛈️ Гроза с градом'
    };
    return conditions[code] || '❓ Неизвестно';
}