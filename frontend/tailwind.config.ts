import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pearl: {
          gray: "#F8F9FA", // Жемчужно-серый фон
        },
        risk: {
          emerald: "#10B981", // Безопасно
          amber: "#F59E0B",   // Внимание
          terracotta: "#E23636", // Опасно (Терракотовый/Коралловый)
        },
        route: {
          indigo: "#4F46E5", // Глубокий синий для линии маршрута
        },
      },
      backdropBlur: {
        glass: "24px", // Для матового стекла панелей
      },
      backgroundColor: {
        "glass-white": "rgba(255, 255, 255, 0.6)", // Белое полупрозрачное стекло
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(31, 38, 135, 0.07)", // Мягкие тени для glassmorphism
      },
      fontFamily: {
        // Подключение типографической триады
        sans: ["var(--font-geist-sans)", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
        serif: ["var(--font-playfair-display)", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
