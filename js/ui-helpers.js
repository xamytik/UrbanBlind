// js/modules/ui-helpers.js
export function getRiskClass(risk) {
    if (risk < 40) return 'risk-low';
    if (risk < 70) return 'risk-medium';
    return 'risk-high';
}

export function getSafetyColor(index) {
    if (index >= 70) return '#27ae60';
    if (index >= 40) return '#f39c12';
    return '#e74c3c';
}

export function getSafetyLabel(index) {
    if (index >= 80) return '🟢 Очень безопасно';
    if (index >= 60) return '🟡 Безопасно';
    if (index >= 40) return '🟠 Умеренный риск';
    if (index >= 20) return '🔴 Повышенный риск';
    return '⚫ Высокий риск';
}