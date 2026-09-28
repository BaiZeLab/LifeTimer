"use client";

import React, { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { RecipeIngredient } from "@/types/api";
import { formatIngredientsForCopy } from "@/lib/seasonings";

export function CopyIngredientsButton({
  dishName,
  ingredients,
}: {
  dishName: string;
  ingredients: RecipeIngredient[];
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  if (ingredients.length === 0) return null;

  const copy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const text = formatIngredientsForCopy(dishName, ingredients);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
  };

  return (
    <button
      type="button"
      className="lt-copy-btn"
      onClick={copy}
      aria-label={copied ? "已复制用料" : "复制用料"}
    >
      {copied ? <Check size={16} strokeWidth={2.2} /> : <Copy size={16} strokeWidth={1.8} />}
    </button>
  );
}
