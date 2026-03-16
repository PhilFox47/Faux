import React, { useState, useRef, useEffect } from 'react';

interface TagTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  users: any[];
  value: string;
  onValueChange: (value: string) => void;
}

export function TagTextarea({ users, value, onValueChange, className, ...props }: TagTextareaProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagIndex, setTagIndex] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onValueChange(val);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPosition);
    
    // Match @ followed by at least one word character at the end of the string before cursor
    const match = textBeforeCursor.match(/@([\w]+)$/);

    if (match) {
      setSearchQuery(match[1]);
      setTagIndex(match.index || 0);
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  };

  const insertTag = (username: string) => {
    if (typeof value !== 'string') return;
    
    // Find the end of the current word after the cursor
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const textAfterCursor = value.slice(cursorPosition);
    const matchAfter = textAfterCursor.match(/^(\w*)/);
    const wordEndOffset = matchAfter ? matchAfter[1].length : 0;
    
    const before = value.slice(0, tagIndex);
    let after = value.slice(cursorPosition + wordEndOffset);
    if (!after.startsWith(' ') && after.length > 0) {
      after = ' ' + after;
    } else if (after.length === 0) {
      after = ' ';
    }
    const newValue = `${before}@${username}${after}`;
    onValueChange(newValue);
    setShowDropdown(false);
    
    // Focus back to textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = tagIndex + username.length + 2; // +2 for @ and space
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const filteredUsers = users
    .filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()) || u.display_name.toLowerCase().includes(searchQuery.toLowerCase()))
    .slice(0, 5);

  return (
    <div className="relative w-full" ref={containerRef}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        className={className}
        {...props}
      />
      {showDropdown && filteredUsers.length > 0 && (
        <div className="absolute z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl mt-1 w-64 max-h-60 overflow-y-auto" style={{ top: '100%', left: 0 }}>
          {filteredUsers.map(user => (
            <div 
              key={user.id} 
              className="p-2 hover:bg-gray-700 cursor-pointer flex items-center gap-2"
              onClick={() => insertTag(user.username)}
            >
              <div className="w-8 h-8 rounded-full bg-orange-900 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {user.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <div className="font-bold text-sm text-white truncate">{user.display_name}</div>
                <div className="text-xs text-gray-400 truncate">@{user.username}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
