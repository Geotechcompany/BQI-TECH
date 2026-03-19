"use client";

import { useEffect } from "react";

export default function ThinkStackScriptLoader() {
  useEffect(() => {
    // Dynamically load ThinkStack AI script
    const loadThinkStackScript = () => {
      return new Promise<void>((resolve, reject) => {
        // Check if script is already loaded
        if (
          document.querySelector(
            'script[src="https://app.thinkstack.ai/bot/thinkstackai-loader.min.js"]'
          )
        ) {
          resolve();
          return;
        }

        const script = document.createElement("script");
        script.src = "https://app.thinkstack.ai/bot/thinkstackai-loader.min.js";
        script.setAttribute("chatbot_id", "67334193bde936bef06b2d4a");
        script.setAttribute("data-type", "default");
        script.async = true;

        script.onload = () => {
          // Attempt to initialize the chatbot
          try {
            // @ts-ignore - ThinkStack is a global injected by the script.
            if (window.ThinkStackAI) {
              // @ts-ignore - ThinkStack is a global injected by the script.
              window.ThinkStackAI.init({
                chatbotId: "67334193bde936bef06b2d4a",
              });
            }
          } catch (initError) {
            console.error("Failed to initialize ThinkStack AI", initError);
          }

          resolve();
        };

        script.onerror = (error) => {
          console.error("Failed to load ThinkStack AI chatbot", error);
          reject(error);
        };

        document.head.appendChild(script);
      });
    };

    loadThinkStackScript().catch((error) => {
      console.warn("Could not load ThinkStack AI chatbot", error);
    });

    return () => {
      // Cleanup if necessary
      const existingScript = document.head.querySelector(
        'script[src="https://app.thinkstack.ai/bot/thinkstackai-loader.min.js"]'
      );
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);

  return null;
}

