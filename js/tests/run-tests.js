import { runRiskCalculationTests } from './test-risk-calculation.js';

// Запуск всех тестов
export async function runAllTests() {
    console.log('🔬 Запуск всех тестов UrbanBlind...');

    const results = {
        riskCalculation: await runRiskCalculationTests(),
    };

    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.keys(results).length;

    console.log(`\n📊 Результаты тестирования:`);
    console.log(`✅ Пройдено: ${passed}`);
    console.log(`❌ Провалено: ${total - passed}`);
    console.log(`📈 Успешность: ${Math.round((passed / total) * 100)}%`);

    return results;
}

// Автоматический запуск при загрузке модуля (для разработки)
if (window.location.search.includes('run-tests=true')) {
    runAllTests();
}