import { useEffect, useMemo, useRef, useState } from "react";

import { getTagSuggestions, normalizeTag, uniqueTags } from "../lib/metadata";
import { getTagInputKeyIntent } from "../lib/taggingUx";

export default function TagInput({
  selectedTags = [],
  allTags = [],
  placeholder = "Add tag…",
  onChange,
  disabled = false,
  autoFocus = false,
  maxSuggestions = 8,
  showAllSuggestionsOnFocus = false,
  className = "",
  inputClassName = "",
  suggestionsClassName = "",
  chipClassName = "",
  chipRemoveLabel = "Remove tag"
}) {
  const [inputValue, setInputValue] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const normalizedSelectedTags = useMemo(() => uniqueTags(selectedTags), [selectedTags]);
  const suggestions = useMemo(() => {
    const normalizedInput = normalizeTag(inputValue);

    if (normalizedInput) {
      return getTagSuggestions(normalizedInput, allTags, normalizedSelectedTags, maxSuggestions);
    }

    if (!showAllSuggestionsOnFocus || !isFocused) {
      return [];
    }

    const excluded = new Set(normalizedSelectedTags);
    return uniqueTags(allTags)
      .filter((tag) => !excluded.has(tag))
      .sort((left, right) => left.localeCompare(right))
      .slice(0, maxSuggestions);
  }, [allTags, inputValue, isFocused, maxSuggestions, normalizedSelectedTags, showAllSuggestionsOnFocus]);
  const suggestionsOpen =
    !suggestionsDismissed &&
    suggestions.length > 0 &&
    (Boolean(inputValue.trim()) || (showAllSuggestionsOnFocus && isFocused));

  useEffect(() => {
    setHighlightedIndex(0);
  }, [inputValue]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsFocused(false);
        setSuggestionsDismissed(true);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!autoFocus || disabled) {
      return;
    }

    inputRef.current?.focus();
  }, [autoFocus, disabled]);

  function commitTag(value) {
    const normalizedTag = normalizeTag(value);

    if (!normalizedTag) {
      setInputValue("");
      return;
    }

    const nextTags = uniqueTags([...normalizedSelectedTags, normalizedTag]);
    if (nextTags.length !== normalizedSelectedTags.length) {
      onChange?.(nextTags);
    }

    setInputValue("");
    setHighlightedIndex(0);
    setSuggestionsDismissed(false);
  }

  function removeTag(tag) {
    onChange?.(normalizedSelectedTags.filter((selectedTag) => selectedTag !== tag));
  }

  function handleKeyDown(event) {
    if (disabled) {
      return;
    }

    const highlightedSuggestion = suggestionsOpen ? suggestions[highlightedIndex] ?? "" : "";
    const intent = getTagInputKeyIntent({
      key: event.key,
      inputValue,
      suggestionsOpen,
      highlightedSuggestion,
      isFocused,
      selectedTags: normalizedSelectedTags
    });

    if (intent.type === "highlightNext") {
      event.preventDefault();
      setHighlightedIndex((current) => (current + 1) % suggestions.length);
      return;
    }

    if (intent.type === "highlightPrevious") {
      event.preventDefault();
      setHighlightedIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
      return;
    }

    if (intent.type === "closeSuggestions") {
      event.preventDefault();
      setSuggestionsDismissed(true);
      return;
    }

    if (intent.type === "removeLastTag") {
      event.preventDefault();
      removeTag(intent.tag);
      return;
    }

    if (intent.type === "commitSuggestion" || intent.type === "commitInput") {
      event.preventDefault();
      commitTag(intent.value);
    }
  }

  return (
    <div ref={rootRef} className={`tag-input ${className}`.trim()}>
      <div className="tag-input-chips">
        {normalizedSelectedTags.map((tag) => (
          <span key={tag} className={`tag-chip ${chipClassName}`.trim()}>
            <span>{tag}</span>
            <button type="button" className="tag-chip-remove" onClick={() => removeTag(tag)} aria-label={`${chipRemoveLabel}: ${tag}`}>
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value);
            setSuggestionsDismissed(false);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true);
            setSuggestionsDismissed(false);
          }}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`tag-input-field ${inputClassName}`.trim()}
        />
      </div>

      {suggestionsOpen ? (
        <div className={`tag-input-suggestions ${suggestionsClassName}`.trim()}>
          {suggestions.map((tag, index) => (
            <button
              key={tag}
              type="button"
              className={`tag-input-suggestion ${index === highlightedIndex ? "is-highlighted" : ""}`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commitTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
