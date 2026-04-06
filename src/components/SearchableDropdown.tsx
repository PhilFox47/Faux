import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Plus } from 'lucide-react';

interface Option {
  id: number;
  name: string;
}

interface SearchableDropdownProps {
  options: Option[];
  value: number | null;
  onChange: (value: number | null, newName?: string) => void;
  placeholder?: string;
}

export function SearchableDropdown({ options, value, onChange, placeholder = "Select an option..." }: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o => 
    o.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (id: number | null) => {
    onChange(id);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleCreateNew = () => {
    if (searchTerm.trim()) {
      onChange(-1, searchTerm.trim());
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div 
        className="w-full bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-3.5 text-zinc-100 flex justify-between items-center cursor-pointer hover:border-indigo-500/50 transition-all"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedOption ? "text-zinc-100" : "text-zinc-500"}>
          {value === -1 ? "New Universe..." : (selectedOption ? selectedOption.name : placeholder)}
        </span>
        <ChevronDown size={18} className="text-zinc-500" />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-800/80 rounded-xl shadow-xl overflow-hidden">
          <div className="p-3 border-b border-zinc-800/50 flex items-center gap-2">
            <Search size={16} className="text-zinc-500" />
            <input
              type="text"
              className="w-full bg-transparent text-zinc-100 outline-none text-sm"
              placeholder="Search or create new..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
          
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            <div 
              className="px-4 py-2.5 hover:bg-zinc-800/50 cursor-pointer text-zinc-400 text-sm transition-colors"
              onClick={() => handleSelect(null)}
            >
              None
            </div>
            
            {filteredOptions.map(option => (
              <div 
                key={option.id}
                className="px-4 py-2.5 hover:bg-zinc-800/50 cursor-pointer text-zinc-100 text-sm transition-colors"
                onClick={() => handleSelect(option.id)}
              >
                {option.name}
              </div>
            ))}
            
            {searchTerm.trim() && !options.some(o => o.name.toLowerCase() === searchTerm.trim().toLowerCase()) && (
              <div 
                className="px-4 py-2.5 hover:bg-indigo-500/10 text-indigo-400 cursor-pointer text-sm flex items-center gap-2 border-t border-zinc-800/50 transition-colors"
                onClick={handleCreateNew}
              >
                <Plus size={14} />
                Create "{searchTerm.trim()}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
