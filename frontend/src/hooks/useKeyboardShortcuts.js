import { useEffect } from "react";


export function useKeyboardShortcuts({ saveTimer, saveNow, setSearchOpen, setSlashState, setWikiState }) {
  useEffect(() => {
    function handleGlobalShortcuts(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (saveTimer.current) {
          window.clearTimeout(saveTimer.current);
        }
        saveNow().catch(() => {});
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setSlashState({ open: false, query: "", commands: [] });
        setWikiState({ open: false, query: "", items: [] });
      }
    }

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, [saveNow, saveTimer, setSearchOpen, setSlashState, setWikiState]);
}
