import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { Smile } from 'lucide-react';

interface TagTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  users: any[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function TagTextarea({ users, value, onValueChange, className, id, ...props }: TagTextareaProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState<'top' | 'bottom'>('top');
  const [searchQuery, setSearchQuery] = useState('');
  const [tagIndex, setTagIndex] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Extract flex-1 from className to apply to container
  const isFlex1 = className?.includes('flex-1');
  const textareaClassName = className?.replace('flex-1', '').trim();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
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

  const onEmojiClick = (emojiObject: any) => {
    const cursorPosition = textareaRef.current?.selectionStart || value.length;
    const before = value.slice(0, cursorPosition);
    const after = value.slice(cursorPosition);
    const newValue = before + emojiObject.emoji + after;
    onValueChange(newValue);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = cursorPosition + emojiObject.emoji.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const filteredUsers = (users || [])
    .filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()) || u.display_name.toLowerCase().includes(searchQuery.toLowerCase()))
    .slice(0, 5);

  return (
    <div className={`relative ${isFlex1 ? 'flex-1' : 'w-full'}`} ref={containerRef}>
      <div className="relative w-full h-full flex flex-col">
        <textarea
          id={id}
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          className={`w-full !pr-10 md:!pr-12 ${textareaClassName}`}
          {...props}
        />
        <div className="absolute right-2 bottom-2 hidden md:block" ref={emojiPickerRef}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (!showEmojiPicker && emojiPickerRef.current) {
                const rect = emojiPickerRef.current.getBoundingClientRect();
                // Emoji picker is roughly 450px tall. If there isn't enough space above, open downwards.
                if (rect.top < 450) {
                  setPickerPosition('bottom');
                } else {
                  setPickerPosition('top');
                }
              }
              setShowEmojiPicker(!showEmojiPicker);
            }}
            className="text-gray-500 hover:text-orange-500 transition-colors p-2 rounded-full hover:bg-gray-800/50"
          >
            <Smile size={20} />
          </button>
          
          {showEmojiPicker && (
            <div className={`absolute right-0 z-50 ${pickerPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
              <EmojiPicker 
                theme={Theme.DARK} 
                onEmojiClick={onEmojiClick}
                lazyLoadEmojis={true}
              />
            </div>
          )}
        </div>
      </div>
      {showDropdown && filteredUsers.length > 0 && (
        <div className="absolute z-50 bg-zinc-900 border border-zinc-800/80 rounded-xl shadow-xl mt-1 w-64 max-h-60 overflow-y-auto custom-scrollbar" style={{ top: '100%', left: 0 }}>
          {filteredUsers.map(user => (
            <div 
              key={user.id} 
              className="p-3 hover:bg-zinc-800/50 cursor-pointer flex items-center gap-3 transition-colors"
              onClick={() => insertTag(user.username)}
            >
              <div className="w-8 h-8 rounded-full bg-indigo-900 flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden ring-1 ring-zinc-800">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.display_name}`} alt="" className="w-full h-full object-cover bg-zinc-800" referrerPolicy="no-referrer" />
                )}
              </div>
              <div className="overflow-hidden">
                <div className="font-bold text-sm text-zinc-100 truncate">{user.display_name}</div>
                <div className="text-xs text-zinc-500 truncate">@{user.username}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
