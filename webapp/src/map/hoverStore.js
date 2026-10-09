// Hovered unit, kept outside the app state so mouse moves do not re-render
// every panel — only the components that subscribe.
import { useSyncExternalStore } from "react";

let hovered = null;   // row index in the current table, or null
const subs = new Set();

export const hoverStore = {
  set(i) {
    if (i === hovered) return;
    hovered = i;
    subs.forEach(fn => fn());
  },
};

export const useHovered = () =>
  useSyncExternalStore(fn => { subs.add(fn); return () => subs.delete(fn); }, () => hovered);
