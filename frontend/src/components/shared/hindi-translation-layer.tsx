"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { translate, translationPair, type Language } from "@/lib/i18n";

const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const ATTRIBUTES = ["aria-label", "placeholder", "title"];

function applyTranslation(root: Node, language: Language) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  const textNodes: Text[] = root.nodeType === Node.TEXT_NODE
    ? [root as Text]
    : [];
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }
  for (const text of textNodes) {
    const current = text.nodeValue ?? "";
    const cached = originalText.get(text);
    const cachedSource = cached === undefined ? "" : translationPair(cached).en;
    const currentSource = translationPair(current).en;
    const rawSource = cached === undefined || (current.trim() && currentSource !== cachedSource && current !== cached)
      ? current
      : cached;
    if (rawSource !== cached) originalText.set(text, rawSource);
    const source = translationPair(rawSource).en;
    const leading = source.match(/^\s*/)?.[0] ?? "";
    const trailing = source.match(/\s*$/)?.[0] ?? "";
    const core = source.slice(leading.length, source.length - trailing.length || undefined);
    text.nodeValue = `${leading}${translate(core, language)}${trailing}`;
  }

  const elements: Element[] = root instanceof Element
    ? [root, ...Array.from(root.querySelectorAll("*"))]
    : root instanceof Document || root instanceof DocumentFragment
      ? Array.from(root.querySelectorAll("*"))
      : [];
  for (const element of elements) {
    for (const attribute of ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (value === null) continue;
      let originals = originalAttributes.get(element);
      if (!originals) { originals = new Map(); originalAttributes.set(element, originals); }
      if (!originals.has(attribute)) originals.set(attribute, value);
      const cached = originals.get(attribute);
      const cachedSource = cached === undefined ? "" : translationPair(cached).en;
      const currentSource = translationPair(value).en;
      const rawSource = cached === undefined || (value.trim() && currentSource !== cachedSource && value !== cached)
        ? value
        : cached;
      if (rawSource !== cached) originals.set(attribute, rawSource);
      const source = translationPair(rawSource).en;
      element.setAttribute(attribute, translate(source, language));
    }
  }
}

export function HindiTranslationLayer() {
  const language = useApp((state) => state.language);
  const setLanguage = useApp((state) => state.setLanguage);

  useEffect(() => {
    const saved = localStorage.getItem("sentinel:language");
    if (saved === "en" || saved === "hi") setLanguage(saved);
  }, [setLanguage]);

  useEffect(() => {
    document.documentElement.lang = language === "hi" ? "hi" : "en";
  }, [language]);

  useEffect(() => {
    applyTranslation(document.body, language);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const added of Array.from(mutation.addedNodes)) applyTranslation(added, language);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [language]);

  return null;
}
