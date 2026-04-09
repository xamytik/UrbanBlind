/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // Отключаем жесткое кэширование при разработке
});

const nextConfig = {
  reactStrictMode: false, // Отключаем Strict Mode для фикса бага ResizeObserver в DeckGL / luma.gl
  compiler: {
    removeConsole: process.env.NODE_ENV === "production", // Очистка консоли в продакшене (Защита данных)
  },
};

module.exports = withPWA(nextConfig);
