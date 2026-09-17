"use client";

import { useEffect } from "react";

export function InteractionFixes() {
  useEffect(() => {
    const applyInputHints = () => {
      document.querySelectorAll<HTMLTextAreaElement>(".notes-input").forEach((textarea) => {
        textarea.setAttribute("autocomplete", "off");
        textarea.setAttribute("autocorrect", "off");
        textarea.setAttribute("autocapitalize", "sentences");
        textarea.setAttribute("name", "study-notes-content");
        textarea.setAttribute("data-form-type", "other");
      });
    };

    applyInputHints();
    const observer = new MutationObserver(applyInputHints);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <style>{`
      .notes-input {
        flex: 0 0 150px !important;
        height: 150px !important;
        min-height: 150px !important;
        max-height: 150px !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        resize: none !important;
        -webkit-overflow-scrolling: touch;
      }

      .tabs-scroll {
        overflow-x: auto !important;
        overflow-y: hidden !important;
        max-height: 47px;
        overscroll-behavior-y: none;
        touch-action: pan-x;
        -webkit-overflow-scrolling: touch;
      }

      .tabs-scroll [data-slot="tabs-list"] {
        overflow-y: hidden !important;
        flex-wrap: nowrap !important;
      }
    `}</style>
  );
}
