// js/modules/ui.js
import { getRiskClass, getSafetyColor, getSafetyLabel } from './ui-helpers.js';

export function updateRiskItem(type, level, risk, desc, valueOverride = null) {
    const bar = document.getElementById(`${type}-bar`);
    const value = document.getElementById(`${type}-value`);
    const description = document.getElementById(`${type}-desc`);

    if (!bar || !value) return;

    const riskClass = getRiskClass(risk);
    bar.className = `risk-fill ${riskClass}`;
    bar.setAttribute('aria-valuenow', risk);
    setTimeout(() => { bar.style.width = `${risk}%`; }, 100);

    if (valueOverride !== null) {
        value.textContent = valueOverride;
    } else if (level !== null) {
        value.textContent = `${level}%`;
    } else {
        value.textContent = `${risk}%`;
    }

    if (description) description.textContent = desc;
}

export function renderData(data, coords) {
    const w = data?.risks?.weather || {};
    const risks = data?.risks;
    const safetyIndex = risks?.safetyIndex || 0;

    const safetyEl = document.getElementById('safety-index-value');
    const safetyLabel = document.getElementById('safety-index-label');
    const safetyCard = document.getElementById('safety-index-card');

    safetyEl.textContent = safetyIndex;
    safetyEl.style.color = 'white';
    safetyEl.setAttribute('aria-valuetext', `Индекс безопасности: ${safetyIndex}`);

    const safetyColor = getSafetyColor(safetyIndex);
    let darkColor = safetyIndex >= 70 ? '#1e8449' : safetyIndex >= 40 ? '#d35400' : '#c0392b';

    safetyLabel.textContent = getSafetyLabel(safetyIndex);
    safetyCard.style.background = `linear-gradient(135deg, ${safetyColor} 0%, ${darkColor} 100%)`;
    safetyCard.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.15)';

    updateRiskItem('noise', risks?.noise?.level, risks?.noise?.risk, risks?.noise?.desc);
    updateRiskItem('crowd', risks?.crowd?.level, risks?.crowd?.risk, risks?.crowd?.desc);
    updateRiskItem('light', risks?.light?.level, risks?.light?.risk, risks?.light?.desc);
    updateRiskItem('time', null, risks?.time?.risk, risks?.time?.desc, risks?.time?.value);
    updateRiskItem('day', null, risks?.day?.risk, risks?.day?.desc, risks?.day?.value);

    // Погода
    document.getElementById('w-temp').textContent = w.temp != null ? `${w.temp}°C` : '—';
    document.getElementById('w-cond').textContent = w.condition || '—';
    document.getElementById('w-wind').textContent = w.wind || '—';
    document.getElementById('w-hum').textContent = w.humidity != null ? `${w.humidity}%` : '—';

    // Пробки
    const t = risks?.traffic || { level: 5, status: 'Недоступно' };
    document.getElementById('t-level').textContent = t.level !== undefined ? `${t.level}/10` : '—';
    document.getElementById('t-status').textContent = t.status || '—';
}

export function showLoader(show) {
    const loader = document.getElementById('loader');
    const content = document.getElementById('content');
    loader.classList.toggle('active', show);
    loader.setAttribute('aria-busy', show);
    content.style.opacity = show ? '0.7' : '1';
    content.style.pointerEvents = show ? 'none' : 'auto';
}

export function updateStatus(state, text = '') {
    const dot = document.getElementById('server-dot');
    const txt = document.getElementById('server-text');

    dot.className = 'status-dot ' + (state === 'ok' ? 'status-good' :
                                    state === 'error' ? 'status-error' : 'status-warning');
    txt.textContent = text || (state === 'ok' ? 'Онлайн' :
                               state === 'error' ? 'Ошибка' : 'Подключение...');
}