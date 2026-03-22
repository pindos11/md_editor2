import { useEffect, useMemo, useRef, useState } from "react";

const PANE_SIZES_STORAGE_KEY = "md-editor2:pane-sizes";
const DEFAULT_PANE_SIZES = { left: 320, right: 420 };

function loadStoredPaneSizes() {
  if (typeof window === "undefined") {
    return DEFAULT_PANE_SIZES;
  }
  try {
    const rawValue = window.localStorage.getItem(PANE_SIZES_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_PANE_SIZES;
    }
    const parsed = JSON.parse(rawValue);
    const left = Number(parsed.left);
    const right = Number(parsed.right);
    if (!Number.isFinite(left) || !Number.isFinite(right)) {
      return DEFAULT_PANE_SIZES;
    }
    return { left, right };
  } catch {
    return DEFAULT_PANE_SIZES;
  }
}

export function usePaneLayout() {
  const [paneSizes, setPaneSizes] = useState(loadStoredPaneSizes);
  const [dragState, setDragState] = useState(null);
  const workspaceRef = useRef(null);

  const workspaceStyle = useMemo(
    () => ({
      gridTemplateColumns: `${paneSizes.left}px 10px minmax(320px, 1fr) 10px ${paneSizes.right}px`
    }),
    [paneSizes]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(PANE_SIZES_STORAGE_KEY, JSON.stringify(paneSizes));
  }, [paneSizes]);

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
