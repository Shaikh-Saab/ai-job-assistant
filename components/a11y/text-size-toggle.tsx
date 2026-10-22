"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const KEY = "nexus-text-size";

/** Inline script for <head>: applies the saved size before first paint, so text never jumps. */
export const textSizeScript = `try{if(localStorage.getItem("${KEY}")==="large")document.documentElement.dataset.text="large"}catch(e){}`;

/** "Larger text" switch. Everything is sized in rem, so the whole app scales with it. */
export function TextSizeToggle({ className }: { className?: string }) {
  const [large, setLarge] = useState(false);
  useEffect(() => setLarge(document.documentElement.dataset.text === "large"), []);

  const toggle = () => {
    const next = !large;
    setLarge(next);
    if (next) document.documentElement.dataset.text = "large";
    else delete document.documentElement.dataset.text;
    try {
      localStorage.setItem(KEY, next ? "large" : "normal");
    } catch {
      // private mode: still works for this visit
    }
  };

  return (
    <Button variant="outline" onClick={toggle} aria-pressed={large} className={className}>
      <span aria-hidden="true" className="font-display text-base leading-none">
        A<span className="text-lg">A</span>
      </span>
      {large ? "Normal text" : "Larger text"}
    </Button>
  );
}
