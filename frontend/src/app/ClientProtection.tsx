"use client";

import { useEffect } from "react";

export default function ClientProtection() {
  useEffect(() => {
    // Блокировка правого клика
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Блокировка хоткеев DevTools
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 (123)
      // Ctrl+Shift+I (73) / Cmd+Option+I 
      // Ctrl+Shift+J (74) / Cmd+Option+J
      // Ctrl+U (85) / Cmd+Option+U
      if (
        e.keyCode === 123 ||
        (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) ||
        (e.ctrlKey && e.keyCode === 85) ||
        (e.metaKey && e.altKey && (e.keyCode === 73 || e.keyCode === 74)) ||
        (e.metaKey && e.optionKey && (e.keyCode === 73 || e.keyCode === 74)) ||
        (e.metaKey && e.keyCode === 85)
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null; // Компонент не рендерит UI
}
