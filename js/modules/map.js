// js/modules/map.js
import { CONFIG } from './config.js';
import { throttle } from './utils.js';

let map, placemark;
let currentCoords = [...CONFIG.defaultCoords];
let lastRequestTime = 0;
let lastRequestCoords = null;
let isDragging = false;
let pendingRequest = null;
let mapInitialized = false;

export function initMap(requestWeatherDataCallback) {
    ymaps.ready(() => {
        try {
            map = new ymaps.Map('map', {
                center: CONFIG.defaultCoords,
                zoom: 13,
                controls: ['zoomControl', 'fullscreenControl', 'geolocationControl']
            });

            // Слой пробок Яндекса
            try {
                new ymaps.layer.TrafficLayer({ trafficProvider: 'yandex#actual' }).setMap(map);
            } catch(e) { console.warn("Пробки Яндекса недоступны:", e); }

            createPlacemark(CONFIG.defaultCoords, requestWeatherDataCallback);
            mapInitialized = true;

            map.events.add('click', function(e) {
                const coords = e.get('coords');
                movePlacemark(coords, true, requestWeatherDataCallback);
            });

            // Регистрация Service Worker
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/service-worker.js');
            }

        } catch (error) {
            showMapError(error);
        }
    });
}

export function showMapError(error) {
    document.getElementById('map-error').classList.add('visible');
}

export function createPlacemark(coords, requestWeatherDataCallback) {
    if (placemark) map.geoObjects.remove(placemark);

    placemark = new ymaps.Placemark(coords, {
        hintContent: '🎯 Перетащите для анализа рисков',
        balloonContentHeader: 'Выбранная точка',
        balloonContentBody: 'Факторы риска обновляются автоматически'
    }, {
        preset: 'islands#redStretchyIcon',
        draggable: true,
        iconColor: '#e74c3c'
    });

    placemark.events.add('dragstart', () => { isDragging = true; });
    placemark.events.add('drag', (e) => {
        const coords = placemark.geometry.getCoordinates();
        updateCoordsDisplay(coords);
        currentCoords = coords;
        throttledRequest(coords, requestWeatherDataCallback);
    });
    placemark.events.add('dragend', () => {
        isDragging = false;
        const coords = placemark.geometry.getCoordinates();
        requestWeatherDataCallback(coords, true);
    });

    map.geoObjects.add(placemark);
}

export function movePlacemark(coords, forceUpdate = false, requestWeatherDataCallback) {
    if (placemark) {
        placemark.geometry.setCoordinates(coords);
    } else {
        createPlacemark(coords, requestWeatherDataCallback);
        return;
    }

    map.panTo(coords, { duration: 250, flying: true });
    updateCoordsDisplay(coords);
    currentCoords = coords;

    if (forceUpdate) {
        requestWeatherDataCallback(coords, true);
    } else {
        throttledRequest(coords, requestWeatherDataCallback);
    }
}

export function updateCoordsDisplay(coords) {
    document.getElementById('coords-display').textContent =
        `Координаты: ${formatCoord(coords[0])}, ${formatCoord(coords[1])}`;
}

function formatCoord(val) { return val.toFixed(4); }

const throttledRequest = throttle(
    (coords, requestWeatherDataCallback) => requestWeatherDataCallback(coords, false),
    CONFIG.throttleMs
);