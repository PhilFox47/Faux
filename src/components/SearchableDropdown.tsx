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
        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white flex justify-between items-center cursor-pointer hover:border-gray-600"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedOption ? "text-white" : "text-gray-400"}>
          {value === -1 ? "New Universe..." : (selectedOption ? selectedOption.name : placeholder)}
        </span>
        <ChevronDown size={18} className="text-gray-400" />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-700 flex items-center gap-2">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              className="w-full bg-transparent text-white outline-none text-sm"
              placeholder="Search or create new..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
          
          <div className="max-h-60 overflow-y-auto">
            <div 
              className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-gray-300 text-sm"
              onClick={() => handleSelect(null)}
            >
              None
            </div>
            
            {filteredOptions.map(option => (
              <div 
                key={option.id}
                className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-white text-sm"
                onClick={() => handleSelect(option.id)}
              >
                {option.name}
              </div>
            ))}
            
            {searchTerm.trim() && !options.some(o => o.name.toLowerCase() === searchTerm.trim().toLowerCase()) && (
              <div 
                className="px-3 py-2 hover:bg-orange-500/20 text-orange-400 cursor-pointer text-sm flex items-center gap-2 border-t border-gray-700"
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
