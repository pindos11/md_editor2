import { useEffect, useState } from "react";

import { api } from "../api";


export function useSearchPalette(setStatusMessage, loadDocument) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (!searchOpen || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      api.searchNotes(searchQuery).then(setSearchResults).catch((error) => setStatusMessage(error.message));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [searchOpen, searchQuery, setStatusMessage]);

  async function openSearchResult(path) {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    await loadDocument(path);
  }

  return {
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    searchResults,
    openSearchResult,
  };
}
