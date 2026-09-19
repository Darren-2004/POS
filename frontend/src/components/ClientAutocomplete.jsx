import React, { useState, useEffect, useRef } from 'react';
import { User, Phone, Search } from 'lucide-react';
import { API_BASE } from '../utils/constants';

export default function ClientAutocomplete({
  value = '',
  onChange = () => {},
  onSelectClient = () => {},
  placeholder = 'Nom du client',
  className = '',
  disabled = false,
  iconLeft = null
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef(null);

  // Fetch client suggestions when value changes
  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length < 1) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    let isMounted = true;
    const fetchClients = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/clients?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) throw new Error('Failed to fetch clients');
        const data = await res.json();
        
        if (isMounted) {
          setSuggestions(data || []);
          // Open if we have results and the user hasn't typed an exact single match already without focus
          if (data && data.length > 0) {
            setIsOpen(true);
          } else {
            setIsOpen(false);
          }
        }
      } catch (err) {
        console.error('Error fetching client suggestions:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const timer = setTimeout(fetchClients, 150);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (client) => {
    onChange(client.name);
    onSelectClient(client);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative flex items-center">
        {iconLeft && (
          <div className="absolute left-3 pointer-events-none text-foreground/40">
            {iconLeft}
          </div>
        )}
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (value.trim().length >= 1 && suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={className}
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 text-[10px] text-gold animate-pulse">
            ...
          </div>
        )}
      </div>

      {/* Suggestions Dropdown Overlay */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-xl border border-gold/40 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-lg z-50 divide-y divide-white/5">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gold/70">
            Clients suggérés ({suggestions.length})
          </div>
          {suggestions.map((client, idx) => {
            const isHighlighted = idx === selectedIndex;
            return (
              <div
                key={client.id || idx}
                onClick={() => handleSelect(client)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center justify-between px-3 py-2 cursor-pointer rounded-lg text-xs transition-colors ${
                  isHighlighted
                    ? 'bg-gold/20 text-white font-bold'
                    : 'text-foreground/90 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <User className="h-3.5 w-3.5 text-gold shrink-0" />
                  <span className="truncate font-medium">{client.name}</span>
                </div>
                {client.phone && (
                  <div className="flex items-center gap-1 text-[11px] text-foreground/60 shrink-0 ml-2 font-mono">
                    <Phone className="h-3 w-3 text-emerald-400 shrink-0" />
                    <span>{client.phone}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
