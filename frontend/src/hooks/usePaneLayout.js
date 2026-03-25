import { useEffect, useMemo, useRef, useState } from "react";

const PANE_SIZES_STORAGE_KEY = "md-editor2:pane-sizes";
const GLOBAL_LAYOUT_KEY = "__global__";
const DEFAULT_PANE_SIZES = { left: 320, right: 420 };

function normalizePaneSizes(rawValue) {
  const left = Number(rawValue?.left);
  const right = Number(rawValue?.right);
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return DEFAULT_PANE_SIZES;
  }
  return { left, right };
}

function loadStoredPaneSizeMap() {
  if (typeof window === "undefined") {
    return { [GLOBAL_LAYOUT_KEY]: DEFAULT_PANE_SIZES };
  }
  try {
    const rawValue = window.localStorage.getItem(PANE_SIZES_STORAGE_KEY);
    if (!rawValue) {
      return { [GLOBAL_LAYOUT_KEY]: DEFAULT_PANE_SIZES };
    }
    const parsed = JSON.parse(rawValue);
    if (parsed && !Array.isArray(parsed) && Object.prototype.hasOwnProperty.call(parsed, "left")) {
      return { [GLOBAL_LAYOUT_KEY]: normalizePaneSizes(parsed) };
    }
    if (!parsed || Array.isArray(parsed)) {
      return { [GLOBAL_LAYOUT_KEY]: DEFAULT_PANE_SIZES };
    }
    const entries = Object.entries(parsed).map(([key, value]) => [key, normalizePaneSizes(value)]);
    return Object.fromEntries(entries);
  } catch {
    return { [GLOBAL_LAYOUT_KEY]: DEFAULT_PANE_SIZES };
  }
}

export function usePaneLayout(layoutKey = GLOBAL_LAYOUT_KEY) {
  const [paneSizeMap, setPaneSizeMap] = useState(loadStoredPaneSizeMap);
  const [paneSizes, setPaneSizes] = useState(() => paneSizeMap[layoutKey] || paneSizeMap[GLOBAL_LAYOUT_KEY] || DEFAULT_PANE_SIZES);
  const [dragState, setDragState] = useState(null);
  const workspaceRef = useRef(null);
  const previousLayoutKeyRef = useRef(layoutKey);

  const workspaceStyle = useMemo(
    () => ({
      gridTemplateColumns: `${paneSizes.left}px 10px minmax(320px, 1fr) 10px ${paneSizes.right}px`
    }),
    [paneSizes]
  );

  useEffect(() => {
    if (previousLayoutKeyRef.current === layoutKey) {
      return;
    }
    const inheritedSizes = paneSizeMap[layoutKey] || paneSizes || paneSizeMap[GLOBAL_LAYOUT_KEY] || DEFAULT_PANE_SIZES;
    previousLayoutKeyRef.current = layoutKey;
    setPaneSizes(inheritedSizes);
    setPaneSizeMap((current) => {
      const existing = current[layoutKey];
      if (existing && existing.left === inheritedSizes.left && existing.right === inheritedSizes.right) {
        return current;
      }
      return { ...current, [layoutKey]: inheritedSizes };
    });
  }, [layoutKey, paneSizeMap, paneSizes]);

  useEffect(() => {
    setPaneSizeMap((current) => {
      const existing = current[layoutKey];
      if (existing && existing.left === paneSizes.left && existing.right === paneSizes.right) {
        return current;
      }
      return { ...current, [layoutKey]: paneSizes };
    });
  }, [layoutKey, paneSizes]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(PANE_SIZES_STORAGE_KEY, JSON.stringify(paneSizeMap));
  }, [paneSizeMap]);

  useEffect(() => {
    if (!dragState) {
      return undefined;
    }

    function handlePointerMove(event) {
      const container = workspaceRef.current;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const minPane = 240;
      const minCenter = 320;

      setPaneSizes((current) => {
        if (dragState === "left") {
          const nextLeft = Math.max(minPane, Math.min(event.clientX - rect.left, rect.width - current.right - minCenter - 20));
          return { ...current, left: nextLeft };
        }
        const nextRight = Math.max(minPane, Math.min(rect.right - event.clientX, rect.width - current.left - minCenter - 20));
        return { ...current, right: nextRight };
      });
    }

    function stopResize() {
      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
    };
  }, [dragState]);

  return {
    dragState,
    workspaceRef,
    workspaceStyle,
    startResize: setDragState,
  };
}
