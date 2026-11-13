"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export default function SearchableDropdown({
  label,
  options,
  value,
  onChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search options…",
  disabled = false,
  className = "",
  leadingIcon,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const listboxId = useId();

  const selectedOption = options.find(option => option.value === value);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return options;
    return options.filter(option =>
      (option.label + " " + (option.description || "")).toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    searchRef.current?.focus();
    return undefined;
  }, [open]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function selectOption(option) {
    onChange(option.value);
    setOpen(false);
    setQuery("");
    rootRef.current?.querySelector(".searchable-dropdown-trigger")?.focus();
  }

  function closeMenu({ restoreFocus = false } = {}) {
    setOpen(false);
    setQuery("");
    if (restoreFocus) rootRef.current?.querySelector(".searchable-dropdown-trigger")?.focus();
  }

  function handleSearchKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu({ restoreFocus: true });
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(index => filteredOptions.length ? (index + 1) % filteredOptions.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(index => filteredOptions.length ? (index - 1 + filteredOptions.length) % filteredOptions.length : 0);
    } else if (event.key === "Enter" && filteredOptions[activeIndex]) {
      event.preventDefault();
      selectOption(filteredOptions[activeIndex]);
    }
  }

  return (
    <div className={"searchable-dropdown " + className} ref={rootRef}>
      <button
        className="searchable-dropdown-trigger"
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (open) setQuery("");
          setOpen(!open);
        }}
      >
        {leadingIcon}
        <span className={selectedOption ? "dropdown-selected-label" : "dropdown-placeholder"}>
          {selectedOption?.label || placeholder}
        </span>
        <svg className={"dropdown-chevron" + (open ? " open" : "")} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {open && <div className="searchable-dropdown-menu">
        <div className="dropdown-search-wrap">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.5"/><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={event => { setQuery(event.target.value); setActiveIndex(0); }}
            onKeyDown={handleSearchKeyDown}
            placeholder={searchPlaceholder}
            aria-label={"Search " + label}
          />
          <kbd>ESC</kbd>
        </div>
        <div className="dropdown-options" id={listboxId} role="listbox" aria-label={label}>
          {filteredOptions.length ? filteredOptions.map((option, index) => <button
            className={"dropdown-option" + (option.value === value ? " selected" : "") + (index === activeIndex ? " highlighted" : "")}
            type="button"
            role="option"
            aria-selected={option.value === value}
            key={option.value}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => selectOption(option)}
          >
            <span className="dropdown-option-copy"><span>{option.label}</span>{option.description && <small>{option.description}</small>}</span>
            {option.value === value && <svg className="dropdown-check" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </button>) : <p className="dropdown-no-results">No matching options</p>}
        </div>
      </div>}
    </div>
  );
}
