import { calculateRiskFactors } from '../main.js';

// Unit-тесты для расчета рисков
export async function runRiskCalculationTests() {
    console.log('🧪 Тестирование расчета факторов риска...');

    try {
        // Тест 1: Проверка возврата объекта с правильными полями
        const mockCoords = [55.7961, 49.1064];
        const result = await calculateRiskFactors(mockCoords);

        console.assert(typeof result === 'object', 'Результат должен быть объектом');
        console.assert('noise' in result, 'Должно содержать поле noise');
        console.assert('crowd' in result, 'Должно содержать поле crowd');
        console.assert('light' in result, 'Должно содержать поле light');
        console.assert('safetyIndex' in result, 'Должно содержать поле safetyIndex');

        console.log('✅ Тест 1 пройден: Структура объекта корректна');

        // Тест 2: Проверка диапазона индекса безопасности
        const { safetyIndex } = result;
        console.assert(safetyIndex >= 0 && safetyIndex <= 100, 'Индекс безопасности должен быть от 0 до 100');
        console.log('✅ Тест 2 пройден: Диапазон индекса безопасности корректен');

        // Тест 3: Проверка значений факторов риска
        const { noise, crowd, light } = result;
        console.assert(noise.risk >= 0 && noise.risk <= 100, 'Риск шума должен быть от 0 до 100');
        console.assert(crowd.risk >= 0 && crowd.risk <= 100, 'Риск плотности должен быть от 0 до 100');
        console.assert(light.risk >= 0 && light.risk <= 100, 'Риск освещенности должен быть от 0 до 100');
        console.log('✅ Тест 3 пройден: Диапазоны факторов риска корректны');

        console.log('🎉 Все тесты расчета рисков пройдены!');
        return true;

    } catch (error) {
        console.error('❌ Ошибка в тестах:', error);
        return false;
    }
}