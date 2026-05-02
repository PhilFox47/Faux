import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Home, MessageSquare, Bell, User, Search, Settings, Heart, MessageCircle, Send, Loader2, Sparkles, UserPlus, UserCheck, Trash2, Globe, X, ArrowLeft, MoreHorizontal, AlertTriangle, Zap, Users, Plus, Lock, Star, Edit2, Upload, BadgeCheck, Image, Briefcase, BookOpen, Camera, Calendar, ChevronDown, ChevronUp, Brain, Menu, Newspaper, Hand } from 'lucide-react';
import { TagTextarea } from './components/TagTextarea';
import { SearchableDropdown } from './components/SearchableDropdown';
import { WELCOME_TEXTS } from './welcomeTexts';

import { FauxPast } from './components/FauxPast';

const getAvatarShape = (accountType?: string) => {
  return accountType === 'company' || accountType === 'news' || accountType === 'faux_news' ? 'rounded-xl' : 'rounded-full';
};

export const VerifiedBadge = ({ user, size = 14 }: { user: any, size?: number }) => {
  if (!user) return null;
  
  if (user.account_type === 'company') {
    return <span title="Verified Company" className="inline-flex"><BadgeCheck size={size} className="text-yellow-500 fill-yellow-900 flex-shrink-0" /></span>;
  }
  if (user.account_type === 'news') {
    return <span title="Verified News" className="inline-flex"><BadgeCheck size={size} className="text-red-500 fill-red-900 flex-shrink-0" /></span>;
  }
  if (user.account_type === 'character' && user.is_verified) {
    return <span title="Verified Public Figure" className="inline-flex"><BadgeCheck size={size} className="text-blue-500 fill-blue-900 flex-shrink-0" /></span>;
  }
  return null;
};

const CharacterSidebarItem = React.memo(({ 
  u, 
  handleViewProfile, 
  isUserOnline, 
  handleFollow, 
  activeChat, 
  isGroupChat, 
  setActiveTab, 
  setActiveChat, 
  fetchChatMessages, 
  handleEditProfile 
}: any) => {
  return (
    <div className={`flex items-center gap-3 group ${!u.is_active ? 'opacity-50 grayscale' : ''}`}>
      <div 
        onClick={() => handleViewProfile(u.id)}
        className="relative w-10 h-10 flex-shrink-0 cursor-pointer"
      >
        <div className={`w-full h-full bg-gray-700 ${getAvatarShape(u.account_type)} flex items-center justify-center overflow-hidden`}>
          {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={20} />}
        </div>
        {u.is_ai === 1 && (
          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 ${isUserOnline(u) ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-500'}`} title={isUserOnline(u) ? 'Online' : 'Offline'}></div>
        )}
      </div>
      <div 
        onClick={() => handleViewProfile(u.id)}
        className="flex-1 overflow-hidden cursor-pointer flex flex-col"
      >
        <div className="flex items-center gap-1 min-w-0">
          <p className="font-bold truncate text-sm group-hover:underline">{u.display_name}</p>
          <VerifiedBadge user={u} />
        </div>
        <p className="text-gray-500 text-xs truncate">@{u.username}</p>
      </div>
      <div className="flex flex-col gap-1 flex-shrink-0">
        <button 
          onClick={() => handleFollow(u.id)}
          className={`text-xs font-bold px-3 py-1 rounded-full transition ${u.is_followed ? 'bg-gray-800 text-white hover:bg-red-900/50 hover:text-red-500' : 'bg-white text-black hover:bg-gray-200'}`}
        >
          {u.is_followed ? 'Following' : 'Follow'}
        </button>
        <div className="flex gap-1">
          <button 
            onClick={() => { const isAlreadyOpen = activeChat?.id === u.id && !isGroupChat; setActiveTab('messages'); setActiveChat({ id: u.id, name: u.display_name, avatar_url: u.avatar_url, account_type: u.account_type }); fetchChatMessages(u.id, false, undefined, isAlreadyOpen); }}
            className="flex-1 bg-transparent text-gray-400 hover:text-white text-xs font-bold px-2 py-1 rounded-full transition"
          >
            Chat
          </button>
          <button 
            onClick={() => handleEditProfile(u)}
            className="flex-1 bg-transparent text-gray-400 hover:text-white text-xs font-bold px-2 py-1 rounded-full transition"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
});

const CharacterSidebar = React.memo(({ 
  apiFetch, 
  handleViewProfile, 
  isUserOnline, 
  handleFollow, 
  activeChat, 
  isGroupChat, 
  setActiveTab, 
  setActiveChat, 
  fetchChatMessages, 
  handleEditProfile,
  exploreUsers,
  exploreOffset,
  hasMoreExplore,
  isFetchingExplore,
  fetchExploreUsers,
  characterSearch,
  setCharacterSearch
}: any) => {
  const [localSearch, setLocalSearch] = useState(characterSearch);

  useEffect(() => {
    setLocalSearch(characterSearch);
  }, [characterSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== characterSearch) {
        setCharacterSearch(localSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, characterSearch, setCharacterSearch]);

  return (
    <div className="w-80 p-4 hidden lg:flex sticky top-0 h-screen flex-col border-l border-gray-800">
      <div className="bg-gray-900 rounded-2xl p-4 flex-1 flex flex-col overflow-hidden min-h-0">
        <h2 className="font-bold text-xl mb-4">Characters</h2>
        <div className="mb-4">
          <input 
            type="text" 
            placeholder="Search characters..." 
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            className="w-full bg-gray-800 text-white px-4 py-2 rounded-full outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div className="space-y-4 overflow-y-auto flex-1 pr-2 min-h-0">
          {exploreUsers.map((u: any) => (
            <CharacterSidebarItem 
              key={u.id} 
              u={u} 
              handleViewProfile={handleViewProfile}
              isUserOnline={isUserOnline}
              handleFollow={handleFollow}
              activeChat={activeChat}
              isGroupChat={isGroupChat}
              setActiveTab={setActiveTab}
              setActiveChat={setActiveChat}
              fetchChatMessages={fetchChatMessages}
              handleEditProfile={handleEditProfile}
            />
          ))}
          {exploreUsers.length === 0 && !isFetchingExplore && (
            <p className="text-gray-500 text-sm text-center py-4">No characters found.</p>
          )}
          {hasMoreExplore && (
            <div className="flex justify-center py-4">
              <button 
                onClick={() => fetchExploreUsers(exploreOffset + 20, true, characterSearch)}
                disabled={isFetchingExplore}
                className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-xs font-bold py-2 px-4 rounded-full transition"
              >
                {isFetchingExplore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const estimateLines = (text: string) => {
  const lines = text.split('\n');
  let total = 0;
  for (const line of lines) {
    // Assume ~55 chars per line for wrapping (standard mobile width)
    total += Math.max(1, Math.ceil(line.length / 55));
  }
  return total;
};

const splitMessageContent = (content: string) => {
  if (!content.includes('\n\n')) return [content];
  const paragraphs = content.split('\n\n').filter(p => p.trim());
  const bubbles: string[] = [];
  let currentBuffer: string[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    currentBuffer.push(paragraphs[i]);
    const currentText = currentBuffer.join('\n\n');
    const currentLines = estimateLines(currentText);

    if (currentLines >= 3) {
      const remainingParagraphs = paragraphs.slice(i + 1);
      if (remainingParagraphs.length > 0) {
        const remainingText = remainingParagraphs.join('\n\n');
        const remainingLines = estimateLines(remainingText);
        
        if (remainingLines >= 3) {
          bubbles.push(currentText);
          currentBuffer = [];
        }
      }
    }
  }

  if (currentBuffer.length > 0) {
    bubbles.push(currentBuffer.join('\n\n'));
  }

  return bubbles;
};

const ChatInputForm = React.memo(function ChatInputForm({ users, onSend, isSendingMsg }: { users: any[], onSend: (msg: string, image: string | null) => void, isSendingMsg: boolean }) {
  const [msg, setMsg] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!msg.trim() && !image) || isSendingMsg) return;
    onSend(msg.trim(), image);
    setMsg('');
    setImage(null);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <input 
        type="file" 
        ref={imageInputRef} 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setImage(reader.result as string);
            reader.readAsDataURL(file);
          }
        }} 
        accept="image/*" 
        className="hidden" 
      />
      {image && (
        <div className="relative mb-2">
          <img src={image} alt="Upload preview" className="h-20 rounded-lg object-cover" />
          <button 
            type="button"
            onClick={() => setImage(null)}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
          >
            <X size={12} />
          </button>
        </div>
      )}
      <button 
        type="button"
        onClick={() => imageInputRef.current?.click()}
        className="p-3 text-gray-500 hover:text-orange-500 hover:bg-orange-500/10 rounded-full transition mb-1"
        title="Upload Image"
      >
        <Image size={24} />
      </button>
      <TagTextarea 
        users={users}
        value={msg}
        onValueChange={setMsg}
        placeholder="Start a new message" 
        className="flex-1 bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 outline-none focus:border-orange-500 resize-none min-h-[100px] max-h-[300px]"
        rows={3}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />
      <button type="submit" disabled={isSendingMsg || (!msg.trim() && !image)} className="bg-orange-500 text-white p-3 rounded-full hover:bg-orange-600 flex-shrink-0 mb-1 disabled:opacity-50">
        <Send size={24} />
      </button>
    </form>
  );
});

export default function App() {
  const [loggedInUser, setLoggedInUser] = useState<any>(null);
  const [welcomeText] = useState(() => WELCOME_TEXTS[Math.floor(Math.random() * WELCOME_TEXTS.length)]);
  const [realUsers, setRealUsers] = useState<any[]>([]);
  const [loginBackgroundAvatars, setLoginBackgroundAvatars] = useState<string[]>([]);
  const [loginPin, setLoginPin] = useState('');
  const [selectedLoginUser, setSelectedLoginUser] = useState<any>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);

  const SESSION_KEY = 'faux_session';
  const SESSION_DURATION = 14 * 24 * 60 * 60 * 1000; // 14 days

  const apiFetch = useCallback(async (resource: RequestInfo | URL, config?: RequestInit) => {
    const headers = new Headers(config?.headers);
    if (loggedInUser) {
      headers.set('x-user-id', loggedInUser.id.toString());
    }
    try {
      const response = await window.fetch(resource, { ...config, headers });
      if (!response.ok) {
        console.warn(`API request failed: ${resource} ${response.status} ${response.statusText}`);
      }
      return response;
    } catch (error) {
      console.error(`Network error fetching ${resource}:`, error);
      throw error;
    }
  }, [loggedInUser]);

  useEffect(() => {
    if (!loggedInUser) {
      apiFetch('/api/real-users')
        .then(res => res.json())
        .then(data => setRealUsers(data))
        .catch(err => console.error(err));
        
      apiFetch('/api/random-profiles?limit=80') // Fetch many to select a random background
        .then(res => res.json())
        .then(data => {
            setLoginBackgroundAvatars(data.map((u:any) => u.avatar_url));
        })
        .catch(err => console.error(err));
    }
  }, [loggedInUser, apiFetch]);

  useEffect(() => {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (sessionStr && !loggedInUser) {
      try {
        const session = JSON.parse(sessionStr);
        const now = Date.now();
        if (now - session.timestamp < SESSION_DURATION) {
          // Valid session, try to auto-login
          window.fetch('/api/me', {
            headers: { 'x-user-id': session.userId.toString() }
          })
            .then(res => res.json())
            .then(user => {
              if (user && !user.error) {
                setLoggedInUser(user);
              } else {
                localStorage.removeItem(SESSION_KEY);
              }
            })
            .catch(() => localStorage.removeItem(SESSION_KEY));
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      } catch (e) {
        localStorage.removeItem(SESSION_KEY);
      }
    }
  }, [loggedInUser]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoginUser || isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      const res = await apiFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedLoginUser.id, pin: loginPin })
      });
      const data = await res.json();
      if (data.success) {
        setLoggedInUser(data.user);
        if (stayLoggedIn) {
          localStorage.setItem(SESSION_KEY, JSON.stringify({
            userId: data.user.id,
            timestamp: Date.now()
          }));
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
        setLoginPin('');
        setSelectedLoginUser(null);
      } else {
        showToast(data.error || "Login failed");
      }
    } catch (e) {
      showToast("Error logging in");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const [activeTab, setActiveTab] = useState('home');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [currentTick, setCurrentTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setCurrentTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const [exploreUsers, setExploreUsers] = useState<any[]>([]);
  const [exploreOffset, setExploreOffset] = useState(0);
  const [hasMoreExplore, setHasMoreExplore] = useState(true);
  const [isFetchingExplore, setIsFetchingExplore] = useState(false);
  const isFetchingExploreRef = useRef(false);
  const [characterSearch, setCharacterSearch] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [groupChats, setGroupChats] = useState<any[]>([]);
  const [dmFavorites, setDmFavorites] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [displayedMessages, setDisplayedMessages] = useState<any[]>([]);
  const [isFetchingChatMessages, setIsFetchingChatMessages] = useState(false);
  const [lastProcessedMsgId, setLastProcessedMsgId] = useState<number | null>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [serverTypingUsers, setServerTypingUsers] = useState<string[]>([]);
  const processingQueue = useRef<boolean>(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState('');
  const [newPostType, setNewPostType] = useState('life_update');
  const [newPostUniverse, setNewPostUniverse] = useState<string>('');
  const [timelineUniverseFilter, setTimelineUniverseFilter] = useState<string>('');
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [isGroupChat, setIsGroupChat] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<number[]>([]);
  const [isCreatingGroupChat, setIsCreatingGroupChat] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');

  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const skipNextScroll = useRef(false);
  const wasAtBottom = useRef(true);
  const prevChatIdRef = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      wasAtBottom.current = true;
    }
  }, []);

  const handleChatScroll = useCallback(() => {
    if (chatScrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
      // Use a threshold of 50px to determine if we are "at the bottom"
      wasAtBottom.current = scrollHeight - scrollTop - clientHeight < 50;
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'messages' && activeChat) {
      const currentChatId = `${isGroupChat ? 'group' : 'dm'}-${activeChat.id}`;

      if (skipNextScroll.current) {
        skipNextScroll.current = false;
        prevChatIdRef.current = currentChatId;
        return;
      }

      // If we switched chat, always scroll to bottom
      if (prevChatIdRef.current !== currentChatId) {
        scrollToBottom();
        prevChatIdRef.current = currentChatId;
        return;
      }

      // If we were at the bottom before the update, scroll to the new bottom
      if (wasAtBottom.current) {
        scrollToBottom();
      }
    }
  }, [displayedMessages, serverTypingUsers, typingUser, activeTab, activeChat, isGroupChat, scrollToBottom]);

  // Add Character Form
  const [charName, setCharName] = useState('');
  const [charUsername, setCharUsername] = useState('');
  const [charAvatar, setCharAvatar] = useState('');
  const [charReferenceImages, setCharReferenceImages] = useState<string[]>([]);
  const [charPersona, setCharPersona] = useState('');
  const [charBio, setCharBio] = useState('');
  const [charDescription, setCharDescription] = useState('');
  const [charWritingStyle, setCharWritingStyle] = useState('');
  const [charPhysicalAppearance, setCharPhysicalAppearance] = useState('');
  const [charClothingStyle, setCharClothingStyle] = useState('');
  const [charArtstyle, setCharArtstyle] = useState('');
  const [charUniverseId, setCharUniverseId] = useState<number | null>(null);
  const [charOnlineTimes, setCharOnlineTimes] = useState<string[]>([]);
  const [charActivityLevel, setCharActivityLevel] = useState<number>(5);
  const [charNewUniverseName, setCharNewUniverseName] = useState('');
  const [charAccountType, setCharAccountType] = useState<'character' | 'company' | 'news'>('character');
  const [charCompanyName, setCharCompanyName] = useState('');
  const [charBrandIdentity, setCharBrandIdentity] = useState('');
  const [charProductsServices, setCharProductsServices] = useState('');
  const [charTargetAudience, setCharTargetAudience] = useState('');
  const [charRunByCharacterId, setCharRunByCharacterId] = useState<number | null>(null);
  const [charIsVerified, setCharIsVerified] = useState(false);
  const [isAddingCharacter, setIsAddingCharacter] = useState(false);
  const [universes, setUniverses] = useState<any[]>([]);
  const [isGeneratingPersona, setIsGeneratingPersona] = useState(false);
  const [personaChatResponse, setPersonaChatResponse] = useState('');

  // Settings
  const [aiEnabled, setAiEnabled] = useState(true);
  const [modelName, setModelName] = useState('zai-org/glm-5');
  const [imageModelName, setImageModelName] = useState('z-image-turbo');
  const [visionModelName, setVisionModelName] = useState('zai-org/glm-5-vision');
  const [apiKey, setApiKey] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [allowNsfw, setAllowNsfw] = useState(false);
  const [enablePerformanceLogging, setEnablePerformanceLogging] = useState(false);
  const [probPost, setProbPost] = useState(100);
  const [probComment, setProbComment] = useState(1000);
  const [probMessage, setProbMessage] = useState(5);
  const [probFavoriteDm, setProbFavoriteDm] = useState(50);
  const [crossUniverseProb, setCrossUniverseProb] = useState(50);
  const [showInternalThoughts, setShowInternalThoughts] = useState(false);
  const [imageResolutions, setImageResolutions] = useState<string[]>(['4096x4096', '2304x4096', '4096x2304']);
  const [archetypes, setArchetypes] = useState<any[]>([]);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, message?: string, error?: string} | null>(null);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void} | null>(null);

  // Profile Viewing
  const [viewingProfile, setViewingProfile] = useState<any>(null);
  const [viewingProfilePosts, setViewingProfilePosts] = useState<any[]>([]);
  const [viewingProfileArcs, setViewingProfileArcs] = useState<any[]>([]);
  const [isFetchingProfileData, setIsFetchingProfileData] = useState(false);
  const [profileActiveTab, setProfileActiveTab] = useState<'posts' | 'arcs' | 'images'>('posts');
  const [viewingUniverse, setViewingUniverse] = useState<any>(null);
  const [viewingUniverseCharacters, setViewingUniverseCharacters] = useState<any[]>([]);
  const [viewingUniverseArcs, setViewingUniverseArcs] = useState<any[]>([]);
  const [isFetchingUniverseData, setIsFetchingUniverseData] = useState(false);
  const [universeActiveTab, setUniverseActiveTab] = useState<'characters' | 'arcs'>('characters');
  const [viewingPostData, setViewingPostData] = useState<any>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<number | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<number | null>(null);

  const handleViewPost = async (postId: number) => {
    try {
      const res = await apiFetch(`/api/posts/${postId}`);
      if (res.ok) {
        const post = await res.json();
        setViewingPostData(post);
        setActiveTab('post');
      } else {
        showToast("Post not found");
      }
    } catch (e) {
      showToast("Error loading post");
    }
  };

  const handleNotificationClick = async (notif: any) => {
    // Mark as read immediately
    if (!notif.is_read) {
      apiFetch(`/api/notifications/${notif.id}/read`, { method: 'POST' });
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n));
    }

    if (notif.type === 'follow') {
      handleViewProfile(notif.reference_id);
      setActiveTab('profile');
    } else if (notif.type === 'like_comment' || notif.type === 'comment' || notif.type === 'reply') {
      // For comment-related notifications, reference_id is the comment ID
      try {
        const res = await apiFetch(`/api/comments/${notif.reference_id}`);
        if (res.ok) {
          const comment = await res.json();
          setHighlightedPostId(comment.post_id);
          setHighlightedCommentId(comment.id);
          setActiveTab('home');
        } else {
          showToast("Comment not found");
        }
      } catch (e) {
        showToast("Error loading comment");
      }
    } else if (notif.type === 'like_post') {
      // like_post
      setHighlightedPostId(notif.reference_id);
      setHighlightedCommentId(null);
      setActiveTab('home');
    }
  };

  // Likers Modal
  const [likersModal, setLikersModal] = useState<{type: 'post' | 'comment', id: number, users: any[]} | null>(null);
  const [followersModal, setFollowersModal] = useState<{users: any[], title: string} | null>(null);

  // Threaded Comments
  const [replyingTo, setReplyingTo] = useState<{postId: number, commentId: number, authorName: string} | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  // DM Editing
  const [editingDmId, setEditingDmId] = useState<number | string | null>(null);
  const [editingDmContent, setEditingDmContent] = useState('');
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<any[]>([]);
  const [isFetchingGallery, setIsFetchingGallery] = useState(false);

  // Profile Editing
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [editingArc, setEditingArc] = useState<any>(null);
  const [isAddingArc, setIsAddingArc] = useState<any>(null); // { type: 'universe' | 'character', id: number }
  const [arcDurationDays, setArcDurationDays] = useState(7);
  const [isGeneratingArc, setIsGeneratingArc] = useState(false);
  const [arcTitle, setArcTitle] = useState('');
  const [arcDescription, setArcDescription] = useState('');
  const [arcStatus, setArcStatus] = useState('active');
  const [arcCompletionSummary, setArcCompletionSummary] = useState('');
  const [arcCurrentStatusText, setArcCurrentStatusText] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profilePin, setProfilePin] = useState('');
  const [profileDmFrequency, setProfileDmFrequency] = useState('medium');
  const [profileBio, setProfileBio] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [profileReferenceImages, setProfileReferenceImages] = useState<string[]>([]);
  const [profileDescription, setProfileDescription] = useState('');
  const [profileWritingStyle, setProfileWritingStyle] = useState('');
  const [profilePhysicalAppearance, setProfilePhysicalAppearance] = useState('');
  const [profileClothingStyle, setProfileClothingStyle] = useState('');
  const [profileArtstyle, setProfileArtstyle] = useState('');
  const [profileUniverseId, setProfileUniverseId] = useState<number | null>(null);
  const [profileOnlineTimes, setProfileOnlineTimes] = useState<string[]>([]);
  const [profileActivityLevel, setProfileActivityLevel] = useState<number>(5);
  const [profileNewUniverseName, setProfileNewUniverseName] = useState('');
  const [profileAccountType, setProfileAccountType] = useState<'character' | 'company' | 'news'>('character');
  const [profileCompanyName, setProfileCompanyName] = useState('');
  const [profileBrandIdentity, setProfileBrandIdentity] = useState('');
  const [profileProductsServices, setProfileProductsServices] = useState('');
  const [profileTargetAudience, setProfileTargetAudience] = useState('');
  const [profileRunByCharacterId, setProfileRunByCharacterId] = useState<number | null>(null);
  const [profileRelationships, setProfileRelationships] = useState<any[]>([]);
  const [profileIsVerified, setProfileIsVerified] = useState(false);
  const [newRelUserId, setNewRelUserId] = useState('');
  const [newRelDesc, setNewRelDesc] = useState('');
  const [isAddingRelationship, setIsAddingRelationship] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [relSearch, setRelSearch] = useState('');

  // Universe Editing
  const [isEditingUniverse, setIsEditingUniverse] = useState(false);
  const [editUniverseDescription, setEditUniverseDescription] = useState('');
  const [editUniverseImageUrl, setEditUniverseImageUrl] = useState('');
  const [isUpdatingUniverse, setIsUpdatingUniverse] = useState(false);

  // API Logs
  const [apiLogs, setApiLogs] = useState<any[]>([]);
  const [apiLogSearch, setApiLogSearch] = useState('');
  const [apiLogShowErrorsOnly, setApiLogShowErrorsOnly] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});
  
  const [relationshipChecks, setRelationshipChecks] = useState<any[]>([]);
  const [relationshipChecksOffset, setRelationshipChecksOffset] = useState(0);
  const [hasMoreRelationshipChecks, setHasMoreRelationshipChecks] = useState(true);

  const [arcs, setArcs] = useState<any[]>([]);
  const [arcsOffset, setArcsOffset] = useState(0);
  const [hasMoreArcs, setHasMoreArcs] = useState(true);
  const [expandedArcHistories, setExpandedArcHistories] = useState<Record<string, boolean>>({});

  const toggleArcHistory = (arcId: string) => {
    setExpandedArcHistories(prev => ({ ...prev, [arcId]: !prev[arcId] }));
  };

  const fetchArcs = (reset = false) => {
    const offset = reset ? 0 : arcsOffset;
    apiFetch(`/api/arcs?limit=20&offset=${offset}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          if (reset) {
            setArcs(data);
          } else {
            setArcs(prev => [...prev, ...data]);
          }
          setArcsOffset(offset + 20);
          setHasMoreArcs(data.length === 20);
        } else {
          if (reset) setArcs([]);
          setHasMoreArcs(false);
        }
      })
      .catch(err => {
        console.error("Failed to fetch arcs:", err);
        if (reset) setArcs([]);
        setHasMoreArcs(false);
      });
  };

  const fetchRelationshipChecks = (reset = false) => {
    const offset = reset ? 0 : relationshipChecksOffset;
    apiFetch(`/api/relationship-checks?limit=20&offset=${offset}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          if (reset) {
            setRelationshipChecks(data);
          } else {
            setRelationshipChecks(prev => [...prev, ...data]);
          }
          setRelationshipChecksOffset(offset + 20);
          setHasMoreRelationshipChecks(data.length === 20);
        } else {
          if (reset) setRelationshipChecks([]);
          setHasMoreRelationshipChecks(false);
        }
      })
      .catch(err => {
        console.error("Failed to fetch relationship checks:", err);
        if (reset) setRelationshipChecks([]);
      });
  };

  const fetchApiLogs = useCallback((query?: string | React.MouseEvent | React.KeyboardEvent, errorOnly?: boolean) => {
    const q = typeof query === 'string' ? query : '';
    const isErrorOnly = typeof errorOnly === 'boolean' ? errorOnly : false;
    let url = `/api/logs?`;
    if (q) url += `q=${encodeURIComponent(q)}&`;
    if (isErrorOnly) url += `error=true&`;
    
    apiFetch(url)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setApiLogs(data);
        } else {
          setApiLogs([]);
        }
      })
      .catch(err => {
        console.error("Failed to fetch API logs:", err);
        setApiLogs([]);
      });
  }, [apiFetch]);

  const toggleLogExpansion = (id: number) => {
    setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const [showApiLogsModal, setShowApiLogsModal] = useState(false);

  const handleViewApiLogs = (content: string) => {
    setApiLogSearch(content);
    fetchApiLogs(content);
    setShowApiLogsModal(true);
  };

  const timeFormatter = useMemo(() => new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }), [timezone]);

  const isUserOnline = useCallback((user: any, precalculatedTime?: number) => {
    if (!user || user.is_ai === 0) return true;
    
    // Use backend-calculated status if available and not expired
    if (user.status_expires_at && user.current_online_status !== undefined) {
      const now = Date.now();
      if (now < user.status_expires_at) {
        return user.current_online_status === 1;
      }
    }

    // Fallback to basic timeframe check if backend status is missing or expired
    let onlineTimes = user._parsed_online_times;
    if (!onlineTimes) {
      try {
        onlineTimes = typeof user.online_times === 'string' ? JSON.parse(user.online_times) : (user.online_times || []);
      } catch (e) {
        onlineTimes = [];
      }
      user._parsed_online_times = onlineTimes;
    }
    
    if (onlineTimes.length === 0) return true;
    
    let currentTimeInMinutes = precalculatedTime;
    if (currentTimeInMinutes === undefined) {
      const now = new Date();
      const userTime = timeFormatter.format(now);
      let [currentHour, currentMinute] = userTime.split(':').map(Number);
      if (currentHour === 24) currentHour = 0;
      currentTimeInMinutes = currentHour * 60 + currentMinute;
    }

    return onlineTimes.some((window: string) => {
      const parts = window.split('-');
      if (parts.length !== 2) return false;
      const [start, end] = parts;
      const [startH, startM] = start.trim().split(':').map(Number);
      const [endH, endM] = end.trim().split(':').map(Number);
      
      const startTotal = startH * 60 + startM;
      const endTotal = endH * 60 + endM;
      
      if (startTotal < endTotal) {
        return currentTimeInMinutes >= startTotal && currentTimeInMinutes < endTotal;
      } else {
        // Overlaps midnight (e.g., 23:00 - 04:00)
        return currentTimeInMinutes >= startTotal || currentTimeInMinutes < endTotal;
      }
    });
  }, [timeFormatter]);

  const universeCounts = useMemo(() => {
    const counts: Record<number | string, number> = {};
    users.forEach(u => {
      const key = u.universe_id || 'none';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [users]);

  const universeCharactersMap = useMemo(() => {
    const map: Record<number | string, any[]> = {};
    users.forEach(u => {
      const key = u.universe_id || 'none';
      if (!map[key]) map[key] = [];
      map[key].push(u);
    });
    return map;
  }, [users]);

  const currentTimeInMinutes = useMemo(() => {
    const now = new Date();
    const userTime = timeFormatter.format(now);
    let [currentHour, currentMinute] = userTime.split(':').map(Number);
    if (currentHour === 24) currentHour = 0;
    return currentHour * 60 + currentMinute;
  }, [timeFormatter, currentTick]);

  const onlineAiCount = useMemo(() => {
    return users.filter(u => u.is_ai === 1 && isUserOnline(u, currentTimeInMinutes)).length;
  }, [users, isUserOnline, currentTimeInMinutes]);

  const followedUsers = useMemo(() => {
    return users.filter(u => u.is_followed);
  }, [users]);

  const ONLINE_TIME_WINDOWS = [
    { label: '04:00 - 07:00', value: '04:00-07:00' },
    { label: '07:00 - 12:00', value: '07:00-12:00' },
    { label: '12:00 - 17:00', value: '12:00-17:00' },
    { label: '17:00 - 20:00', value: '17:00-20:00' },
    { label: '20:00 - 23:00', value: '20:00-23:00' },
    { label: '23:00 - 04:00', value: '23:00-04:00' },
  ];

  const handleEditProfile = async (user: any) => {
    if (!user) return;
    setActiveTab('profile');
    setEditingProfile(user);
    setProfileName(user.display_name || '');
    setProfileUsername(user.username || '');
    setProfilePin(user.pin || '');
    setProfileDmFrequency(user.dm_frequency || 'medium');
    setProfileBio(user.bio || '');
    setProfileAvatar(user.avatar_url || '');
    try {
      setProfileReferenceImages(user.reference_images ? JSON.parse(user.reference_images) : []);
    } catch (e) {
      setProfileReferenceImages([]);
    }
    setProfileDescription(user.description || '');
    setProfileWritingStyle(user.writing_style || '');
    setProfilePhysicalAppearance(user.physical_appearance || '');
    setProfileClothingStyle(user.clothing_style || '');
    setProfileArtstyle(user.artstyle || '');
    setProfileUniverseId(user.universe_id || null);
    setProfileActivityLevel(user.activity_level ?? 5);
    setProfileAccountType(user.account_type || 'character');
    setProfileCompanyName(user.company_name || '');
    setProfileBrandIdentity(user.brand_identity || '');
    setProfileProductsServices(user.products_services || '');
    setProfileTargetAudience(user.target_audience || '');
    setProfileRunByCharacterId(user.run_by_character_id || null);
    setProfileIsVerified(user.is_verified === 1 || user.is_verified === true);
    
    let onlineTimes = [];
    try {
      onlineTimes = typeof user.online_times === 'string' ? JSON.parse(user.online_times) : (user.online_times || []);
    } catch (e) {
      onlineTimes = [];
    }
    setProfileOnlineTimes(onlineTimes);
    
    // Fetch relationships
    try {
      const res = await apiFetch(`/api/users/${user.id}/relationships`);
      const data = await res.json();
      setProfileRelationships(data);
    } catch (e) {
      setProfileRelationships([]);
    }
    
    setActiveTab('profile');
  };

  const handleAddRelationship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRelUserId || !newRelDesc || isAddingRelationship) return;
    setIsAddingRelationship(true);
    
    // Optimistic update
    const otherUser = users.find(u => u.id === parseInt(newRelUserId));
    const tempId = Date.now();
    const newRelObj = {
      id: tempId,
      user_id_1: editingProfile.id,
      user_id_2: parseInt(newRelUserId),
      description: newRelDesc,
      other_name: otherUser?.display_name || 'Unknown',
      other_avatar: otherUser?.avatar_url,
      other_account_type: otherUser?.account_type
    };
    setProfileRelationships(prev => [...prev, newRelObj]);
    
    try {
      const res = await apiFetch(`/api/users/${editingProfile.id}/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id_2: newRelUserId, description: newRelDesc })
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || 'Failed to add relationship');
        setProfileRelationships(prev => prev.filter(r => r.id !== tempId));
        return;
      }
      setNewRelUserId('');
      setNewRelDesc('');
      const relsRes = await apiFetch(`/api/users/${editingProfile.id}/relationships`);
      setProfileRelationships(await relsRes.json());
      showToast('Relationship added!');
    } catch (e) {
      setProfileRelationships(prev => prev.filter(r => r.id !== tempId));
      console.error(e);
      showToast('An error occurred');
    } finally {
      setIsAddingRelationship(false);
    }
  };

  const handleDeleteRelationship = async (otherId: number) => {
    // Optimistic update
    const previousRelationships = [...profileRelationships];
    setProfileRelationships(prev => prev.filter(r => r.user_id_2 !== otherId));
    
    try {
      await apiFetch(`/api/users/${editingProfile.id}/relationships/${otherId}`, {
        method: 'DELETE'
      });
      showToast('Relationship deleted!');
    } catch (e) {
      setProfileRelationships(previousRelationships);
      console.error(e);
    }
  };

  const handleAddArc = (type: 'universe' | 'character', id: number) => {
    setIsAddingArc({ type, id });
    setArcTitle('');
    setArcDescription('');
    setArcStatus('active');
    setArcCompletionSummary('');
    setArcCurrentStatusText('');
    setArcDurationDays(type === 'character' ? 21 : 42);
  };

  const refreshViewingArcs = async () => {
    fetchArcs(true);
    if (viewingProfile) {
      const arcsRes = await apiFetch(`/api/users/${viewingProfile.id}/arcs`);
      if (arcsRes.ok) {
        const arcs = await arcsRes.json();
        setViewingProfileArcs(arcs);
      }
    }
    if (viewingUniverse && viewingUniverse.id !== -1) {
      const arcsRes = await apiFetch(`/api/universes/${viewingUniverse.id}/arcs`);
      if (arcsRes.ok) {
        const arcs = await arcsRes.json();
        setViewingUniverseArcs(arcs);
      }
    }
  };

  const handleCreateArc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddingArc) return;
    
    const endpoint = isAddingArc.type === 'universe' 
      ? `/api/universes/${isAddingArc.id}/arcs` 
      : `/api/users/${isAddingArc.id}/arcs`;
    
    try {
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: arcTitle,
          description: arcDescription,
          current_status_text: arcCurrentStatusText,
          duration_days: arcDurationDays
        })
      });
      if (res.ok) {
        showToast('Arc created!');
        setIsAddingArc(null);
        refreshViewingArcs();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to create arc');
      }
    } catch (e) {
      console.error(e);
      showToast('An error occurred');
    }
  };

  const handleGenerateArc = async (type: 'universe' | 'character', id: number) => {
    setIsGeneratingArc(true);
    const endpoint = type === 'universe' 
      ? `/api/universes/${id}/arcs/generate` 
      : `/api/users/${id}/arcs/generate`;
    
    try {
      const res = await apiFetch(endpoint, { method: 'POST' });
      if (res.ok) {
        showToast('Arc generated by AI!');
        refreshViewingArcs();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to generate arc');
      }
    } catch (e) {
      console.error(e);
      showToast('An error occurred');
    } finally {
      setIsGeneratingArc(false);
    }
  };

  const handleEditArc = (arc: any) => {
    setEditingArc(arc);
    setArcTitle(arc.title || '');
    setArcDescription(arc.description || '');
    setArcStatus(arc.status || 'active');
    setArcCompletionSummary(arc.completion_summary || '');
    setArcCurrentStatusText(arc.current_status_text || '');
  };

  const handleSaveArc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArc) return;
    
    const endpoint = editingArc.arc_type === 'universe' 
      ? `/api/universes/arcs/${editingArc.id}` 
      : `/api/users/arcs/${editingArc.id}`;
    
    try {
      const res = await apiFetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: arcTitle,
          description: arcDescription,
          status: arcStatus,
          completion_summary: arcCompletionSummary,
          current_status_text: arcCurrentStatusText
        })
      });
      if (res.ok) {
        showToast('Arc updated!');
        setEditingArc(null);
        refreshViewingArcs();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update arc');
      }
    } catch (e) {
      console.error(e);
      showToast('An error occurred');
    }
  };

  const handleDeleteArc = async (arc: any) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Arc',
      message: `Are you sure you want to delete the arc "${arc.title}"? This action cannot be undone.`,
      onConfirm: async () => {
        const endpoint = arc.arc_type === 'universe' 
          ? `/api/universes/arcs/${arc.id}` 
          : `/api/users/arcs/${arc.id}`;
        
        try {
          const res = await apiFetch(endpoint, { method: 'DELETE' });
          if (res.ok) {
            showToast('Arc deleted!');
            refreshViewingArcs();
          } else {
            const err = await res.json();
            showToast(err.error || 'Failed to delete arc');
          }
        } catch (e) {
          console.error(e);
          showToast('An error occurred');
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile || isSavingProfile) return;
    setIsSavingProfile(true);
    
    try {
      let finalUniverseId = profileUniverseId;
      if (profileUniverseId === -1 && profileNewUniverseName.trim()) {
        const res = await apiFetch('/api/universes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: profileNewUniverseName.trim() })
        });
        if (res.ok) {
          const newUniverse = await res.json();
          finalUniverseId = newUniverse.id;
          fetchUniverses();
        } else {
          const err = await res.json();
          showToast(err.error || "Failed to create universe");
          return;
        }
      }

      const res = await apiFetch(`/api/users/${editingProfile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: profileName,
          username: profileUsername,
          bio: profileBio,
          avatar_url: profileAvatar,
          description: profileDescription,
          writing_style: profileWritingStyle,
          physical_appearance: profilePhysicalAppearance,
          clothing_style: profileClothingStyle,
          artstyle: profileArtstyle,
          universe_id: finalUniverseId,
          online_times: JSON.stringify(profileOnlineTimes),
          activity_level: profileActivityLevel,
          pin: profilePin,
          dm_frequency: profileDmFrequency,
          reference_images: profileReferenceImages,
          account_type: profileAccountType,
          company_name: profileCompanyName,
          brand_identity: profileBrandIdentity,
          products_services: profileProductsServices,
          target_audience: profileTargetAudience,
          run_by_character_id: profileRunByCharacterId,
          is_verified: profileIsVerified
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || "Failed to save profile");
        return;
      }
      
      if (loggedInUser && loggedInUser.id === editingProfile.id) {
        setLoggedInUser({
          ...loggedInUser,
          display_name: profileName,
          username: profileUsername,
          avatar_url: profileAvatar
        });
      }

      setEditingProfile(null);
      setProfileNewUniverseName('');
      fetchUsers();
      fetchExploreUsers(0, false, characterSearch);
      setActiveTab('home');
      showToast('Profile updated!');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDeleteCharacter = () => {
    if (!editingProfile || editingProfile.is_ai === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: "Delete Character",
      message: `Are you sure you want to delete ${editingProfile.display_name}? This action cannot be undone.`,
      onConfirm: async () => {
        await apiFetch(`/api/users/${editingProfile.id}`, {
          method: 'DELETE'
        });
        setEditingProfile(null);
        setActiveTab('home');
        fetchUsers();
        fetchExploreUsers(0, false, characterSearch);
        fetchPosts();
        fetchConversations();
        setConfirmModal(null);
      }
    });
  };

  const fetchUsers = useCallback(() => {
    // Fetch all users (lightweight) for global state (mentions, counts, etc.)
    apiFetch('/api/users?limit=1000').then(r => r.json()).then(setUsers);
  }, [apiFetch]);

  const fetchExploreUsers = useCallback((offset = 0, append = false, search = '') => {
    if (isFetchingExploreRef.current) return;
    isFetchingExploreRef.current = true;
    setIsFetchingExplore(true);
    const limit = 20;
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    apiFetch(`/api/users?limit=${limit}&offset=${offset}&is_ai=true${searchParam}`).then(r => r.json()).then(data => {
      if (append) {
        setExploreUsers(prev => {
          const existingIds = new Set(prev.map(u => u.id));
          const newUsers = data.filter((u: any) => !existingIds.has(u.id));
          return [...prev, ...newUsers];
        });
      } else {
        setExploreUsers(data);
      }
      setHasMoreExplore(data.length === limit);
      setExploreOffset(offset);
      isFetchingExploreRef.current = false;
      setIsFetchingExplore(false);
    }).catch(err => {
      console.error(err);
      isFetchingExploreRef.current = false;
      setIsFetchingExplore(false);
    });
  }, [apiFetch]);

  const fetchUniverses = useCallback(() => {
    apiFetch('/api/universes').then(r => r.json()).then(setUniverses);
  }, [apiFetch]);

  const fetchConversations = useCallback(() => {
    apiFetch('/api/dms').then(r => r.json()).then(setConversations);
  }, [apiFetch]);

  const fetchGroupChats = useCallback(() => {
    apiFetch('/api/group-chats').then(r => r.json()).then(setGroupChats);
  }, [apiFetch]);

  const fetchDmFavorites = useCallback(() => {
    apiFetch('/api/favorites').then(r => r.json()).then(setDmFavorites);
  }, [apiFetch]);

  const fetchNotifications = useCallback(() => {
    apiFetch('/api/notifications').then(r => r.json()).then(setNotifications);
  }, [apiFetch]);

  const fetchChatMessages = useCallback((id: number, isGroup: boolean = false, beforeId?: number, silent: boolean = false) => {
    const limit = 40;
    const url = isGroup 
      ? `/api/group-chats/${id}/messages?limit=${limit}${beforeId ? `&before_id=${beforeId}` : ''}`
      : `/api/dms/${id}?limit=${limit}${beforeId ? `&before_id=${beforeId}` : ''}`;
    
    if (beforeId) {
      setIsLoadingMoreMessages(true);
      skipNextScroll.current = true;
    } else if (!silent) {
      setIsFetchingChatMessages(true);
      setChatMessages([]);
      setDisplayedMessages([]);
      setLastProcessedMsgId(null);
    }
    
    apiFetch(url).then(r => r.json()).then(data => {
      if (beforeId) {
        setChatMessages(prev => [...data, ...prev]);
        setIsLoadingMoreMessages(false);
      } else {
        setChatMessages(prev => {
          if (silent && prev.length > 0) {
            const hasContentChanged = data.some((m: any, i: number) => m.content !== prev[i]?.content || m.image_url !== prev[i]?.image_url || m.image_request_status !== prev[i]?.image_request_status || m.is_image_request !== prev[i]?.is_image_request);
            if (!hasContentChanged && data.length === prev.length) return prev;
          }
          return data;
        });
        if (!silent) setIsFetchingChatMessages(false);
        // Refresh unread counts
        if (isGroup) fetchGroupChats();
        else fetchConversations();
      }
      setHasMoreMessages(data.length === limit);
    }).catch(err => {
      console.error(err);
      if (!beforeId && !silent) setIsFetchingChatMessages(false);
      else if (beforeId) setIsLoadingMoreMessages(false);
    });
  }, [apiFetch, fetchConversations, fetchGroupChats]);

  const fetchSettings = useCallback(() => {
    apiFetch('/api/settings').then(r => r.json()).then(data => {
      if (data) {
        setAiEnabled(data.ai_enabled === 1);
        if (data.model_name) setModelName(data.model_name);
        if (data.image_model_name) setImageModelName(data.image_model_name);
        if (data.vision_model_name) setVisionModelName(data.vision_model_name);
        if (data.timezone) setTimezone(data.timezone);
        if (data.api_key !== undefined) setApiKey(data.api_key);
        if (data.allow_nsfw !== undefined) setAllowNsfw(data.allow_nsfw === 1);
        if (data.enable_performance_logging !== undefined) setEnablePerformanceLogging(data.enable_performance_logging === 1);
        if (data.prob_post !== undefined) setProbPost(data.prob_post);
        if (data.prob_comment !== undefined) setProbComment(data.prob_comment);
        if (data.prob_message !== undefined) setProbMessage(data.prob_message);
        if (data.prob_favorite_dm !== undefined) setProbFavoriteDm(data.prob_favorite_dm);
        if (data.cross_universe_prob !== undefined) setCrossUniverseProb(data.cross_universe_prob);
        if (data.show_internal_thoughts !== undefined) setShowInternalThoughts(data.show_internal_thoughts === 1);
        if (data.image_resolutions) {
          try {
            setImageResolutions(JSON.parse(data.image_resolutions));
          } catch (e) {}
        }
      }
    });
  }, [apiFetch]);

  const fetchArchetypes = useCallback(() => {
    apiFetch('/api/archetypes').then(r => r.json()).then(data => {
      if (data && Array.isArray(data)) {
        setArchetypes(data);
      }
    });
  }, [apiFetch]);

  const handleUpdateArchetypes = async (updatedArchetypes: any[]) => {
    setArchetypes(updatedArchetypes);
    await apiFetch('/api/archetypes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archetypes: updatedArchetypes })
    });
  };

  const toggleNsfw = async () => {
    const newVal = !allowNsfw;
    setAllowNsfw(newVal);
    await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allow_nsfw: newVal ? 1 : 0 })
    });
  };

  const togglePerformanceLogging = async () => {
    const newVal = !enablePerformanceLogging;
    setEnablePerformanceLogging(newVal);
    await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enable_performance_logging: newVal ? 1 : 0 })
    });
  };

  const handleUpdateSettings = async (newSettings: any) => {
    if (newSettings.timezone) setTimezone(newSettings.timezone);
    if (newSettings.prob_post !== undefined) setProbPost(newSettings.prob_post);
    if (newSettings.prob_comment !== undefined) setProbComment(newSettings.prob_comment);
    if (newSettings.prob_message !== undefined) setProbMessage(newSettings.prob_message);
    if (newSettings.prob_favorite_dm !== undefined) setProbFavoriteDm(newSettings.prob_favorite_dm);
    if (newSettings.cross_universe_prob !== undefined) setCrossUniverseProb(newSettings.cross_universe_prob);
    if (newSettings.show_internal_thoughts !== undefined) setShowInternalThoughts(newSettings.show_internal_thoughts === 1);
    await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings)
    });
  };

  const [showResetConfirm, setShowResetConfirm] = useState<'all' | 'content' | null>(null);

  const handleResetDb = async () => {
    await apiFetch('/api/reset-db', { method: 'POST' });
    fetchPosts();
    fetchUsers();
    fetchConversations();
    fetchNotifications();
    setShowResetConfirm(null);
    showToast("Database reset successfully!");
  };

  const handleResetContent = async () => {
    await apiFetch('/api/reset-content', { method: 'POST' });
    fetchPosts();
    fetchConversations();
    fetchNotifications();
    setShowResetConfirm(null);
    showToast("Content reset successfully!");
  };

  const handleViewProfile = async (userId: number) => {
    // Find in existing lists for immediate feedback
    const existingUser = users.find(u => u.id === userId) || exploreUsers.find(u => u.id === userId);
    if (existingUser) {
      setViewingProfile(existingUser);
    } else {
      setViewingProfile(null);
    }
    
    setProfileActiveTab('posts');
    setVisibleProfilePosts(30);
    setViewingProfilePosts([]);
    setViewingProfileArcs([]);
    setIsFetchingProfileData(true);

    // Fetch full user data (with counts)
    apiFetch(`/api/users/${userId}`).then(r => r.json()).then(data => {
      if (data && !data.error) {
        setViewingProfile(data);
        // Update the user in the lists too if it's there
        setUsers(prev => prev.map(u => u.id === data.id ? { ...u, ...data } : u));
        setExploreUsers(prev => prev.map(u => u.id === data.id ? { ...u, ...data } : u));
      }
    });

    try {
      const [postsRes, arcsRes] = await Promise.all([
        apiFetch(`/api/users/${userId}/posts`),
        apiFetch(`/api/users/${userId}/arcs`)
      ]);
      
      const [posts, arcs] = await Promise.all([
        postsRes.json(),
        arcsRes.json()
      ]);
      
      setViewingProfilePosts(posts);
      setViewingProfileArcs(arcs);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingProfileData(false);
    }
  };

  const handleViewUniverse = async (universeId: number) => {
    if (universeId === -1) {
      setViewingUniverse({ id: -1, name: 'None', description: 'Characters without an assigned universe.' });
      setEditUniverseDescription('');
      setEditUniverseImageUrl('');
      setIsEditingUniverse(false);
      const chars = users.filter(u => !u.universe_id);
      setViewingUniverseCharacters(chars);
      setViewingUniverseArcs([]);
      setActiveTab('universe_details');
      return;
    }
    const universe = universes.find(u => u.id === universeId);
    if (!universe) return;
    setViewingUniverse(universe);
    setUniverseActiveTab('characters');
    setEditUniverseDescription(universe.description || '');
    setEditUniverseImageUrl(universe.image_url || '');
    setIsEditingUniverse(false);
    setViewingUniverseCharacters([]);
    setViewingUniverseArcs([]);
    setIsFetchingUniverseData(true);

    try {
      const [charsRes, arcsRes] = await Promise.all([
        apiFetch(`/api/universes/${universeId}/characters`),
        apiFetch(`/api/universes/${universeId}/arcs`)
      ]);
      
      const [chars, arcs] = await Promise.all([
        charsRes.json(),
        arcsRes.json()
      ]);
      
      setViewingUniverseCharacters(chars);
      setViewingUniverseArcs(arcs);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingUniverseData(false);
    }
    
    setActiveTab('universe_details');
  };

  const handleToggleUniversePause = async () => {
    if (!viewingUniverse) return;
    const newPausedState = viewingUniverse.is_paused ? 0 : 1;
    
    // Optimistic update
    const updatedUniverse = { ...viewingUniverse, is_paused: newPausedState };
    setViewingUniverse(updatedUniverse);
    setUniverses(prev => prev.map(u => u.id === viewingUniverse.id ? updatedUniverse : u));
    
    try {
      await apiFetch(`/api/universes/${viewingUniverse.id}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_paused: newPausedState })
      });
      showToast(newPausedState ? "Universe Paused" : "Universe Resumed");
      fetchUniverses();
    } catch (e) {
      // Revert on failure
      setViewingUniverse(viewingUniverse);
      setUniverses(prev => prev.map(u => u.id === viewingUniverse.id ? viewingUniverse : u));
      showToast("Failed to update universe status");
    }
  };

  const handleUpdateUniverse = async () => {
    if (!viewingUniverse || isUpdatingUniverse) return;
    setIsUpdatingUniverse(true);
    try {
      const res = await apiFetch(`/api/universes/${viewingUniverse.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editUniverseDescription,
          image_url: editUniverseImageUrl
        })
      });
      if (res.ok) {
        const updatedUniverse = {
          ...viewingUniverse,
          description: editUniverseDescription,
          image_url: editUniverseImageUrl
        };
        setViewingUniverse(updatedUniverse);
        setUniverses(prev => prev.map(u => u.id === viewingUniverse.id ? updatedUniverse : u));
        setIsEditingUniverse(false);
        showToast("Universe updated successfully");
      } else {
        showToast("Failed to update universe");
      }
    } catch (e) {
      showToast("Error updating universe");
    } finally {
      setIsUpdatingUniverse(false);
    }
  };

  const [isForcingPost, setIsForcingPost] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleForcePost = async (type: 'text' | 'image', userId?: number) => {
    const targetId = userId || viewingProfile?.id;
    if (!targetId || isForcingPost) return;
    setIsForcingPost(true);
    try {
      const res = await apiFetch(`/api/users/${targetId}/force-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      if (res.ok) {
        if (viewingProfile && viewingProfile.id === targetId) {
          handleViewProfile(targetId);
        }
        fetchPosts();
        fetchUsers();
        if (type === 'image') {
          showToast("Image post is generating in the background. It will appear shortly.");
        } else {
          showToast("Post forced successfully!");
        }
      } else {
        const err = await res.json();
        showToast("Failed to force post: " + err.error);
      }
    } catch (e: any) {
      showToast("Error: " + e.message);
    } finally {
      setIsForcingPost(false);
    }
  };

  const handleShowLikers = async (type: 'post' | 'comment', id: number) => {
    const res = await apiFetch(`/api/${type}s/${id}/likers`);
    const data = await res.json();
    setLikersModal({ type, id, users: data });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      callback(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleReply = async (postId: number, parentId: number) => {
    if (!replyContent.trim() || isSendingReply) return;
    setIsSendingReply(true);
    try {
      await apiFetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyContent, parent_id: parentId })
      });
      setReplyContent('');
      setReplyingTo(null);
      fetchPosts();
      fetchNotifications();
    } finally {
      setIsSendingReply(false);
    }
  };

  const userMap = useMemo(() => {
    const map = new Map<number, any>();
    users.forEach(u => map.set(u.id, u));
    return map;
  }, [users]);

  const expandMessages = useCallback((messages: any[]) => {
    const expanded: any[] = [];
    for (const msg of messages) {
      const sender = userMap.get(msg.sender_id);
      if (sender?.is_ai && (msg.content.includes('\n\n') || msg.image_url)) {
        const parts = splitMessageContent(msg.content);
        for (let i = 0; i < parts.length; i++) {
          expanded.push({ ...msg, content: parts[i], id: `${msg.id}_part_${i}`, image_url: null });
        }
        if (msg.image_url) {
          expanded.push({ ...msg, content: "", id: `${msg.id}_image`, image_url: msg.image_url });
        }
      } else {
        expanded.push(msg);
      }
    }
    return expanded;
  }, [userMap]);

  useEffect(() => {
    if (!activeChat) {
      setDisplayedMessages([]);
      setLastProcessedMsgId(null);
      setTypingUser(null);
      return;
    }

    if (chatMessages.length === 0) {
      setDisplayedMessages([]);
      setLastProcessedMsgId(null);
      return;
    }

    const lastMsg = chatMessages[chatMessages.length - 1];
    const isLastMsgProcessed = chatMessages.some(m => m.id === lastProcessedMsgId);

    // If we switched chat or the last processed message is gone, sync immediately
    if (lastProcessedMsgId === null || !isLastMsgProcessed) {
      setDisplayedMessages(expandMessages(chatMessages));
      setLastProcessedMsgId(lastMsg.id);
      return;
    }

    // If messages were deleted or edited (length changed or content changed)
    // We only sync if we are not currently processing a new message sequence
    if (lastMsg.id === lastProcessedMsgId && !processingQueue.current) {
      const expanded = expandMessages(chatMessages);
      if (expanded.length !== displayedMessages.length) {
        setDisplayedMessages(expanded);
        return;
      }
      const hasContentChanged = expanded.some((m, i) => m.content !== displayedMessages[i]?.content || m.image_url !== displayedMessages[i]?.image_url || m.image_request_status !== displayedMessages[i]?.image_request_status || m.is_image_request !== displayedMessages[i]?.is_image_request);
      if (hasContentChanged) {
        setDisplayedMessages(expanded);
        return;
      }
    }

    // If there are new messages
    if (lastMsg.id !== lastProcessedMsgId && !processingQueue.current) {
      const newMessages = chatMessages.filter(m => m.id > lastProcessedMsgId);
      
      const process = async () => {
        processingQueue.current = true;
        for (const msg of newMessages) {
          const sender = users.find(u => u.id === msg.sender_id);
          if (sender?.is_ai && (msg.content.includes('\n\n') || msg.image_url)) {
            const parts = splitMessageContent(msg.content);
            setTypingUser(sender.display_name);
            for (let i = 0; i < parts.length; i++) {
              const partMsg = { ...msg, content: parts[i], id: `${msg.id}_part_${i}`, image_url: null };
              setDisplayedMessages(prev => {
                if (prev.some(m => m.id === partMsg.id)) return prev;
                return [...prev, partMsg];
              });
              if (i < parts.length - 1 || msg.image_url) {
                await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1500));
              }
            }
            if (msg.image_url) {
              const imagePart = { ...msg, content: "", id: `${msg.id}_image`, image_url: msg.image_url };
              setDisplayedMessages(prev => {
                if (prev.some(m => m.id === imagePart.id)) return prev;
                return [...prev, imagePart];
              });
            }
            setTypingUser(null);
          } else {
            setDisplayedMessages(prev => {
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
        }
        setLastProcessedMsgId(lastMsg.id);
        processingQueue.current = false;
      };
      
      process();
    }
  }, [chatMessages, activeChat, users, lastProcessedMsgId, displayedMessages.length, expandMessages]);

  useEffect(() => {
    if (!activeChat || !loggedInUser) {
      setServerTypingUsers([]);
      return;
    }

    const fetchTypingStatus = async () => {
      try {
        const res = await apiFetch(`/api/typing-status/${activeChat.id}?isGroup=${isGroupChat}`);
        const data = await res.json();
        if (data && data.typing) {
          setServerTypingUsers(data.typing);
        }
      } catch (e) {
        console.error("Error fetching typing status:", e);
      }
    };

    fetchTypingStatus();
    const interval = setInterval(fetchTypingStatus, 10000); // 10s instead of 3s
    return () => clearInterval(interval);
  }, [activeChat, isGroupChat, loggedInUser, apiFetch]);

  const handleCreateGroupChat = async () => {
    if (!newGroupName.trim() || selectedGroupMembers.length === 0 || isCreatingGroupChat) return;
    setIsCreatingGroupChat(true);
    try {
      const res = await apiFetch('/api/group-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName, member_ids: selectedGroupMembers })
      });
      if (res.ok) {
        const data = await res.json();
        setShowCreateGroupModal(false);
        setNewGroupName('');
        setSelectedGroupMembers([]);
        fetchGroupChats();
        setActiveChat({ id: data.id, name: newGroupName, isGroup: true });
        setIsGroupChat(true);
        fetchChatMessages(data.id, true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreatingGroupChat(false);
    }
  };

  const handleToggleFavorite = async (targetId: number, isGroup: boolean) => {
    const isFav = dmFavorites.some(f => f.target_id === targetId && f.is_group === (isGroup ? 1 : 0));
    try {
      if (isFav) {
        await apiFetch(`/api/favorites/${targetId}?is_group=${isGroup}`, { method: 'DELETE' });
      } else {
        await apiFetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_id: targetId, is_group: isGroup })
        });
      }
      fetchDmFavorites();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePoke = async () => {
    if (!activeChat || isGroupChat) return;
    
    try {
      const res = await apiFetch(`/api/users/${activeChat.id}/poke`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast("Character poked! They are now online for 30 minutes.");
        // We'll update the whole user list so the online dot changes
        fetchUsers();
      }
    } catch (e) {
      console.error("Error poking character:", e);
    }
  };

  const handleOpenGallery = async () => {
    if (!activeChat) return;
    setShowGallery(true);
    setIsFetchingGallery(true);
    try {
      const endpoint = isGroupChat ? `/api/group-chats/${activeChat.id}/images` : `/api/dms/${activeChat.id}/images`;
      const res = await apiFetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setGalleryImages(data);
      }
    } catch(e) {
      console.error("Error fetching gallery images", e);
    } finally {
      setIsFetchingGallery(false);
    }
  };

  const handleCreatePost = async () => {
    if ((!newPostContent.trim() && !newPostImage) || isCreatingPost) return;
    setIsCreatingPost(true);
    const type = newPostType;
    const content = newPostContent;
    const image = newPostImage;
    
    // Optimistic update
    const tempId = Date.now();
    const newPostObj = {
      id: tempId,
      user_id: loggedInUser?.id || 1,
      content: content,
      post_type: type,
      image_url: image,
      created_at: new Date().toISOString(),
      username: loggedInUser?.username || 'user',
      display_name: loggedInUser?.display_name || 'User',
      avatar_url: loggedInUser?.avatar_url,
      account_type: loggedInUser?.account_type || 'character',
      like_count: 0,
      comment_count: 0,
      is_liked: 0
    };
    
    setPosts(prev => [newPostObj, ...prev]);
    setNewPostContent('');
    setNewPostImage('');
    setNewPostType('life_update');
    
    try {
      await apiFetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content, post_type: type, image_url: image, universe_id: newPostUniverse ? parseInt(newPostUniverse) : null })
      });
      if (type === 'image_post' && !image) {
        showToast("Image is generating in the background. It will appear shortly.");
      } else if (image) {
        showToast("Post with image created.");
      }
      fetchPosts();
      if (type === 'image_post') fetchFauxPics();
    } catch (e) {
      // Revert on failure
      fetchPosts();
      fetchFauxPics();
    } finally {
      setIsCreatingPost(false);
    }
  };

  const handleAddCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAddingCharacter) return;
    setIsAddingCharacter(true);
    
    try {
      let finalUniverseId = charUniverseId;
      if (charUniverseId === -1 && charNewUniverseName.trim()) {
        const res = await apiFetch('/api/universes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: charNewUniverseName.trim() })
        });
        if (res.ok) {
          const newUniverse = await res.json();
          finalUniverseId = newUniverse.id;
          fetchUniverses();
        } else {
          const err = await res.json();
          showToast(err.error || "Failed to create universe");
          return;
        }
      }

      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: charUsername,
          display_name: charName,
          bio: charBio,
          avatar_url: charAvatar,
          ai_persona: charPersona,
          description: charDescription,
          writing_style: charWritingStyle,
          physical_appearance: charPhysicalAppearance,
          clothing_style: charClothingStyle,
          artstyle: charArtstyle,
          universe_id: finalUniverseId,
          online_times: JSON.stringify(charOnlineTimes),
          activity_level: charActivityLevel,
          reference_images: charReferenceImages,
          account_type: charAccountType,
          company_name: charCompanyName,
          brand_identity: charBrandIdentity,
          products_services: charProductsServices,
          target_audience: charTargetAudience,
          run_by_character_id: charRunByCharacterId,
          is_verified: charIsVerified
        })
      });

      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || "Failed to add character");
        return;
      }

      setCharName('');
      setCharUsername('');
      setCharBio('');
      setCharAvatar('');
      setCharReferenceImages([]);
      setCharPersona('');
      setCharDescription('');
      setCharWritingStyle('');
      setCharPhysicalAppearance('');
      setCharClothingStyle('');
      setCharArtstyle('');
      setCharUniverseId(null);
      setCharOnlineTimes([]);
      setCharActivityLevel(5);
      setCharNewUniverseName('');
      setCharAccountType('character');
      setCharCompanyName('');
      setCharBrandIdentity('');
      setCharProductsServices('');
      setCharTargetAudience('');
      setCharRunByCharacterId(null);
      setPersonaChatResponse('');
      fetchUsers();
      fetchExploreUsers(0, false, characterSearch);
      showToast('Character added!');
    } finally {
      setIsAddingCharacter(false);
    }
  };

  const handleGeneratePersona = async () => {
    if (!charName) {
      alert("Please enter a Name first.");
      return;
    }
    setIsGeneratingPersona(true);
    setPersonaChatResponse('');
    try {
      const res = await apiFetch('/api/generate-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: charName, extraInfo: charPersona })
      });
      const data = await res.json();
      if (res.ok && data) {
        setPersonaChatResponse(data);
      } else {
        alert("Failed to generate persona: " + (data?.error || "Unknown error"));
      }
    } catch (e) {
      alert("Error generating persona.");
    }
    setIsGeneratingPersona(false);
  };

  const handleLike = async (postId: number) => {
    // Optimistic update
    const updatePost = (p: any) => {
      if (p.id === postId) {
        const isLiked = p.is_liked;
        return {
          ...p,
          is_liked: isLiked ? 0 : 1,
          like_count: isLiked ? p.like_count - 1 : p.like_count + 1
        };
      }
      return p;
    };

    setPosts(prev => prev.map(updatePost));
    setViewingProfilePosts(prev => prev.map(updatePost));
    setFauxPicsPosts(prev => prev.map(updatePost));
    if (viewingPostData?.id === postId) {
      setViewingPostData(updatePost(viewingPostData));
    }
    
    try {
      await apiFetch(`/api/posts/${postId}/like`, { method: 'POST' });
    } catch (e) {
      // Revert on failure
      fetchPosts();
      if (viewingProfile) handleViewProfile(viewingProfile.id);
      if (viewingPostData) handleViewPost(viewingPostData.id);
      fetchFauxPics();
    }
  };

  const handleFollow = async (userId: number) => {
    // Optimistic update
    const updateFn = (prev: any[]) => prev.map(u => {
      if (u.id === userId) {
        return { ...u, is_followed: u.is_followed ? 0 : 1 };
      }
      return u;
    });
    setUsers(updateFn);
    setExploreUsers(updateFn);
    
    try {
      await apiFetch(`/api/users/${userId}/follow`, { method: 'POST' });
    } catch (e) {
      // Revert on failure
      fetchUsers();
      fetchExploreUsers(0, false, characterSearch);
    }
  };

  const handleFollowAllInUniverse = async (chars: any[]) => {
    const charsToFollow = chars.filter(c => !c.is_followed);
    if (charsToFollow.length === 0) return;
    
    // Optimistic update
    const idsToFollow = new Set(charsToFollow.map(c => c.id));
    const updateFn = (prev: any[]) => prev.map(u => idsToFollow.has(u.id) ? { ...u, is_followed: 1 } : u);
    setUsers(updateFn);
    setExploreUsers(updateFn);
    
    try {
      await Promise.all(charsToFollow.map(c => apiFetch(`/api/users/${c.id}/follow`, { method: 'POST' })));
    } catch (e) {
      fetchUsers();
      fetchExploreUsers(0, false, characterSearch);
    }
  };

  const handleUnfollowAllInUniverse = async (chars: any[]) => {
    const charsToUnfollow = chars.filter(c => c.is_followed);
    if (charsToUnfollow.length === 0) return;
    
    // Optimistic update
    const idsToUnfollow = new Set(charsToUnfollow.map(c => c.id));
    const updateFn = (prev: any[]) => prev.map(u => idsToUnfollow.has(u.id) ? { ...u, is_followed: 0 } : u);
    setUsers(updateFn);
    setExploreUsers(updateFn);
    
    try {
      await Promise.all(charsToUnfollow.map(c => apiFetch(`/api/users/${c.id}/follow`, { method: 'POST' })));
    } catch (e) {
      fetchUsers();
      fetchExploreUsers(0, false, characterSearch);
    }
  };

  const [dmSettings, setDmSettings] = useState<any>({ allow_image_gen: 0 });

  useEffect(() => {
    if (activeChat) {
      apiFetch(`/api/dms/settings/${activeChat.id}?isGroup=${isGroupChat}`)
        .then(res => res.json())
        .then(data => setDmSettings(data))
        .catch(err => console.error(err));
    }
  }, [activeChat, isGroupChat, apiFetch]);

  const handleToggleImageGen = async () => {
    if (!activeChat) return;
    const newVal = dmSettings.allow_image_gen === 1 ? 0 : 1;
    try {
      const res = await apiFetch(`/api/dms/settings/${activeChat.id}?isGroup=${isGroupChat}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allow_image_gen: newVal })
      });
      if (res.ok) {
        setDmSettings({ ...dmSettings, allow_image_gen: newVal });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendMsg = async (msg: string, image_url: string | null) => {
    if ((!msg.trim() && !image_url) || !activeChat || isSendingMsg) return;
    
    setIsSendingMsg(true);
    // Optimistic update
    const realUser = loggedInUser;
    const tempId = Date.now();
    setChatMessages(prev => [...prev, { id: tempId, sender_id: realUser?.id || 1, content: msg, image_url: image_url, created_at: new Date().toISOString() }]);

    const endpoint = isGroupChat ? `/api/group-chats/${activeChat.id}/messages` : `/api/dms/${activeChat.id}`;
    
    try {
      await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: msg, image_url })
      });
      fetchChatMessages(activeChat.id, isGroupChat, undefined, true);
      if (isGroupChat) fetchGroupChats();
      else fetchConversations();
      fetchUsers();
    } catch (e) {
      setChatMessages(prev => prev.filter(m => m.id !== tempId));
      fetchChatMessages(activeChat.id, isGroupChat, undefined, true);
    } finally {
      setIsSendingMsg(false);
    }
  };

  const handleEditDm = async (msgId: number | string) => {
    if (!editingDmContent.trim() || !activeChat) return;
    
    const originalId = typeof msgId === 'string' ? parseInt(msgId.split('_')[0]) : msgId;
    
    // Optimistic update
    const previousMessages = [...chatMessages];
    setChatMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: editingDmContent.trim() } : m));
    
    const endpoint = isGroupChat ? `/api/group-chats/messages/${originalId}` : `/api/dms/messages/${originalId}`;
    try {
      await apiFetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingDmContent.trim() })
      });
      setEditingDmId(null);
      setEditingDmContent('');
      fetchChatMessages(activeChat.id, isGroupChat, undefined, true);
    } catch (e) {
      setChatMessages(previousMessages);
      fetchChatMessages(activeChat.id, isGroupChat, undefined, true);
    }
  };

  const handleDeleteDm = async (msgId: number | string) => {
    if (!activeChat) return;
    
    const originalId = typeof msgId === 'string' ? parseInt(msgId.split('_')[0]) : msgId;
    
    // Optimistic update
    const previousMessages = [...chatMessages];
    setChatMessages(prev => prev.filter(m => m.id !== msgId));
    
    const endpoint = isGroupChat ? `/api/group-chats/messages/${originalId}` : `/api/dms/messages/${originalId}`;
    try {
      await apiFetch(endpoint, {
        method: 'DELETE'
      });
      fetchChatMessages(activeChat.id, isGroupChat, undefined, true);
    } catch (e) {
      setChatMessages(previousMessages);
      fetchChatMessages(activeChat.id, isGroupChat, undefined, true);
    }
  };

  const toggleAiEnabled = async () => {
    const newVal = !aiEnabled;
    setAiEnabled(newVal);
    await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_enabled: newVal })
    });
  };

  const saveModelName = async () => {
    await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_name: modelName })
    });
    showToast("Model saved!");
  };

  const saveImageModelName = async () => {
    await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_model_name: imageModelName })
    });
    showToast("Image Model saved!");
  };

  const saveVisionModelName = async () => {
    await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vision_model_name: visionModelName })
    });
    showToast("Vision Model saved!");
  };

  const saveApiKey = async () => {
    await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey })
    });
    showToast("API Key saved!");
  };

  const saveImageResolutions = async (resolutions: string[]) => {
    setImageResolutions(resolutions);
    await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_resolutions: resolutions })
    });
    showToast("Image Resolutions saved!");
  };

  const handleTestApi = async () => {
    setIsTestingApi(true);
    setTestResult(null);
    try {
      const res = await apiFetch('/api/test-ai', { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
    } catch (e: any) {
      setTestResult({ success: false, error: e.message });
    }
    setIsTestingApi(false);
  };

  const handleResetChat = async () => {
    if (!activeChat || isGroupChat) return;
    setConfirmModal({
      isOpen: true,
      title: "Reset Conversation",
      message: "Are you sure you want to delete all messages in this conversation? This cannot be undone.",
      onConfirm: async () => {
        await apiFetch(`/api/dms/${activeChat.id}`, { method: 'DELETE' });
        setChatMessages([]);
        fetchConversations();
        setConfirmModal(null);
      }
    });
  };

  const markNotificationsRead = async () => {
    await apiFetch('/api/notifications/read', { method: 'POST' });
    fetchNotifications();
  };

  const unreadNotifs = notifications.filter(n => !n.is_read).length;
  const unreadMessages = conversations.reduce((acc, curr) => acc + (curr.unread_count || 0), 0) + groupChats.reduce((acc, curr) => acc + (curr.unread_count || 0), 0);

  const timestampFormatter = useMemo(() => new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }), [timezone]);

  const formatTimestamp = useCallback((ts: string) => {
    try {
      const utcTs = ts.replace(' ', 'T') + (ts.endsWith('Z') ? '' : 'Z');
      return timestampFormatter.format(new Date(utcTs));
    } catch (e) {
      return new Date(ts).toLocaleString();
    }
  }, [timestampFormatter]);

  useEffect(() => {
    fetchExploreUsers(0, false, characterSearch);
  }, [characterSearch, fetchExploreUsers]);
  const [visiblePosts, setVisiblePosts] = useState(30);
  const [fauxPicsPosts, setFauxPicsPosts] = useState<any[]>([]);
  const [newsPosts, setNewsPosts] = useState<any[]>([]);
  const [isFetchingPosts, setIsFetchingPosts] = useState(false);
  const [isFetchingFauxPics, setIsFetchingFauxPics] = useState(false);
  const [isFetchingNews, setIsFetchingNews] = useState(false);
  const [visibleFauxPics, setVisibleFauxPics] = useState(20);
  const [visibleNews, setVisibleNews] = useState(20);
  const visiblePostsRef = useRef(visiblePosts);
  const visibleFauxPicsRef = useRef(visibleFauxPics);
  const visibleNewsRef = useRef(visibleNews);

  const timelineUniverseFilterRef = useRef(timelineUniverseFilter);

  const fetchPosts = useCallback(() => {
    setIsFetchingPosts(true);
    const universeParam = timelineUniverseFilterRef.current ? `&universe_id=${timelineUniverseFilterRef.current}` : '';
    apiFetch(`/api/posts?limit=${visiblePostsRef.current + 1}${universeParam}`)
      .then(r => r.json())
      .then(data => { setPosts(data); setIsFetchingPosts(false); })
      .catch(() => setIsFetchingPosts(false));
  }, [apiFetch]);

  const fetchFauxPics = useCallback(() => {
    setIsFetchingFauxPics(true);
    const universeParam = timelineUniverseFilterRef.current ? `&universe_id=${timelineUniverseFilterRef.current}` : '';
    apiFetch(`/api/posts?type=image_post&limit=${visibleFauxPicsRef.current + 1}${universeParam}`)
      .then(r => r.json())
      .then(data => { setFauxPicsPosts(data); setIsFetchingFauxPics(false); })
      .catch(() => setIsFetchingFauxPics(false));
  }, [apiFetch]);

  const fetchNews = useCallback(() => {
    setIsFetchingNews(true);
    const universeParam = timelineUniverseFilterRef.current ? `&universe_id=${timelineUniverseFilterRef.current}` : '';
    apiFetch(`/api/posts?account_type=news&limit=${visibleNewsRef.current + 1}${universeParam}`)
      .then(r => r.json())
      .then(data => { setNewsPosts(data); setIsFetchingNews(false); })
      .catch(() => setIsFetchingNews(false));
  }, [apiFetch]);

  useEffect(() => {
    timelineUniverseFilterRef.current = timelineUniverseFilter;
    fetchPosts();
    fetchFauxPics();
    fetchNews();
  }, [timelineUniverseFilter, fetchPosts, fetchFauxPics, fetchNews]);

  useEffect(() => {
    if (visiblePostsRef.current !== visiblePosts) {
      visiblePostsRef.current = visiblePosts;
      fetchPosts();
    }
  }, [visiblePosts, fetchPosts]);

  useEffect(() => {
    if (visibleFauxPicsRef.current !== visibleFauxPics) {
      visibleFauxPicsRef.current = visibleFauxPics;
      fetchFauxPics();
    }
  }, [visibleFauxPics, fetchFauxPics]);

  useEffect(() => {
    if (visibleNewsRef.current !== visibleNews) {
      visibleNewsRef.current = visibleNews;
      fetchNews();
    }
  }, [visibleNews, fetchNews]);

  useEffect(() => {
    if (loggedInUser) {
      fetchFauxPics();
      fetchNews();
    }
  }, [loggedInUser, fetchFauxPics, fetchNews]);

  const [visibleProfilePosts, setVisibleProfilePosts] = useState(30);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!loggedInUser) {
      initialLoadDone.current = false;
      return;
    }
    
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchPosts();
      fetchUsers();
      fetchExploreUsers();
      fetchUniverses();
      fetchConversations();
      fetchGroupChats();
      fetchDmFavorites();
      fetchNotifications();
      fetchSettings();
      fetchArchetypes();
      fetchApiLogs();
    }
  }, [loggedInUser, fetchPosts, fetchUsers, fetchUniverses, fetchConversations, fetchGroupChats, fetchDmFavorites, fetchNotifications, fetchSettings, fetchArchetypes, fetchApiLogs]);

  useEffect(() => {
    if (!loggedInUser) return;
    
    const fastInterval = setInterval(() => {
      // Tab-specific updates
      if (activeTab === 'home' || activeTab === 'fauxpics' || activeTab === 'news') {
        fetchPosts();
        if (activeTab === 'fauxpics') fetchFauxPics();
        if (activeTab === 'news') fetchNews();
      }
      
      // Chat-specific updates
      if (activeChat) {
        fetchChatMessages(activeChat.id, isGroupChat, undefined, true);
      }
    }, 10000); // Poll every 10s for active content

    const slowInterval = setInterval(() => {
      // Global updates (less frequent)
      fetchConversations();
      fetchGroupChats();
      fetchNotifications();
    }, 30000); // Poll every 30s for background content

    return () => {
      clearInterval(fastInterval);
      clearInterval(slowInterval);
    };
  }, [activeChat, isGroupChat, loggedInUser, activeTab, fetchPosts, fetchFauxPics, fetchNews, fetchConversations, fetchGroupChats, fetchNotifications, fetchChatMessages]);

  if (!loggedInUser) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center font-sans relative overflow-hidden">
        {loginBackgroundAvatars.length > 0 && (
          <div className="absolute inset-[-50%] z-0 select-none flex justify-center items-center pointer-events-none opacity-20">
            <div className="w-[150vw] h-[150vh] flex flex-wrap gap-2 transform -rotate-12 justify-center items-center content-center relative">
               {Array.from({ length: 150 }).map((_, i) => {
                 const avatarUrl = loginBackgroundAvatars[i % loginBackgroundAvatars.length];
                 return (
                   <div key={i} className="aspect-square w-24 sm:w-32 md:w-36 flex-shrink-0 rounded-md overflow-hidden bg-slate-900 border border-white/5 opacity-80">
                      <img 
                        src={avatarUrl} 
                        alt="" 
                        className="w-full h-full object-cover filter grayscale hover:grayscale-0 transition-all duration-1000" 
                        referrerPolicy="no-referrer"
                      />
                   </div>
                 );
               })}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
            <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/80 to-black"></div>
          </div>
        )}

        <div className="z-10 relative flex flex-col items-center w-full max-w-4xl px-4">
          {toastMessage && (
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-orange-500 text-white px-6 py-3 rounded-full shadow-xl font-bold animate-pulse">
              {toastMessage}
            </div>
          )}
          <div className="mb-12">
            <img src="https://i.imgur.com/tI0YtLX.png" alt="Faux Logo" className="h-24 object-contain" referrerPolicy="no-referrer" />
          </div>
          <h1 className="text-4xl font-bold mb-10 text-center">{welcomeText}</h1>
          <div className="flex flex-wrap justify-center gap-8 w-full">
            {realUsers.map(user => (
            <div 
              key={user.id} 
              className="flex flex-col items-center gap-4 cursor-pointer group"
              onClick={() => setSelectedLoginUser(user)}
            >
              <div className={`w-32 h-32 ${getAvatarShape(user.account_type)} overflow-hidden border-4 transition-all duration-200 ${selectedLoginUser?.id === user.id ? 'border-white scale-110' : 'border-transparent group-hover:border-gray-400 group-hover:scale-105'}`}>
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <User size={64} className="text-gray-500" />
                  </div>
                )}
              </div>
              <span className={`text-xl font-medium transition-colors ${selectedLoginUser?.id === user.id ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>
                {user.display_name}
              </span>
            </div>
          ))}
        </div>

        {selectedLoginUser && (
          <div className="mt-16 w-full max-w-md px-4 animate-in fade-in slide-in-from-bottom-4">
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              {selectedLoginUser.has_pin && (
                <div className="flex flex-col gap-2">
                  <label className="text-center text-gray-400 font-medium">Enter PIN for {selectedLoginUser.display_name}</label>
                  <input 
                    type="password" 
                    value={loginPin}
                    onChange={e => setLoginPin(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-center text-2xl tracking-widest text-white focus:outline-none focus:border-orange-500"
                    placeholder="••••"
                    autoFocus
                  />
                </div>
              )}
              <div className="flex items-center gap-2 px-1">
                <input 
                  type="checkbox" 
                  id="stayLoggedIn"
                  checked={stayLoggedIn}
                  onChange={e => setStayLoggedIn(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-orange-500 focus:ring-orange-500"
                />
                <label htmlFor="stayLoggedIn" className="text-sm text-gray-400 cursor-pointer select-none">
                  Stay logged in for 14 days
                </label>
              </div>
              <button 
                type="submit"
                className="w-full bg-white text-black font-bold text-lg py-3 rounded-xl hover:bg-gray-200 transition"
              >
                Continue
              </button>
              <button 
                type="button"
                onClick={() => { setSelectedLoginUser(null); setLoginPin(''); }}
                className="w-full bg-transparent text-gray-400 font-medium py-2 rounded-xl hover:text-white transition"
              >
                Cancel
              </button>
            </form>
          </div>
        )}
        </div>
      </div>
    );
  }

  const renderArcHistory = (arc: any) => {
    let history = [];
    try {
      history = JSON.parse(arc.history || '[]');
    } catch (e) {}
    
    if (history.length === 0) return null;
    
    const arcKey = `${arc.arc_type || (arc.universe_id ? 'universe' : 'character')}-${arc.id}`;
    const isExpanded = expandedArcHistories[arcKey];
    
    return (
      <div className="mt-4 border-t border-gray-800 pt-4">
        <button 
          onClick={() => toggleArcHistory(arcKey)}
          className="flex items-center text-sm font-medium text-gray-400 hover:text-white transition-colors"
        >
          {isExpanded ? <ChevronUp size={16} className="mr-1" /> : <ChevronDown size={16} className="mr-1" />}
          Arc History ({history.length} updates)
        </button>
        
        {isExpanded && (
          <div className="mt-3 space-y-3 pl-2 border-l-2 border-gray-800">
            {history.map((h: any, idx: number) => (
              <div key={idx} className="text-sm">
                <span className="text-gray-500 text-xs block mb-1">{new Date(h.date).toLocaleString()}</span>
                <p className="text-gray-300 whitespace-pre-wrap">{h.status}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white flex justify-center font-sans">
      {toastMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-orange-500 text-white px-6 py-3 rounded-full shadow-xl font-bold animate-pulse">
          {toastMessage}
        </div>
      )}

      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-6 relative">
            <h3 className="text-xl font-bold mb-2">{confirmModal.title}</h3>
            <p className="text-gray-400 mb-6">{confirmModal.message}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-lg font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition"
              >
                Cancel
              </button>
              <button 
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 rounded-lg font-bold bg-red-500 hover:bg-red-600 text-white transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {(editingArc || isAddingArc) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl p-6 relative my-8">
            <button 
              onClick={() => { setEditingArc(null); setIsAddingArc(null); }}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition"
            >
              <X size={24} />
            </button>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              {editingArc ? <Edit2 className="text-orange-500" /> : <Plus className="text-emerald-500" />}
              {editingArc ? 'Edit' : 'Create'} {(editingArc?.arc_type || isAddingArc?.type) === 'universe' ? 'Universe' : 'Character'} Arc
            </h2>
            <form onSubmit={editingArc ? handleSaveArc : handleCreateArc} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1 uppercase tracking-wider">Title</label>
                <input 
                  type="text" 
                  value={arcTitle}
                  onChange={e => setArcTitle(e.target.value)}
                  className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
                  placeholder="Arc Title"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1 uppercase tracking-wider">Description</label>
                <textarea 
                  value={arcDescription}
                  onChange={e => setArcDescription(e.target.value)}
                  className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition min-h-[100px]"
                  placeholder="What is this arc about?"
                  required
                />
              </div>
              {((editingArc && editingArc.arc_type === 'universe') || (isAddingArc && isAddingArc.type === 'universe')) && (
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-1 uppercase tracking-wider">Current Status Text</label>
                  <input 
                    type="text" 
                    value={arcCurrentStatusText}
                    onChange={e => setArcCurrentStatusText(e.target.value)}
                    className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
                    placeholder="Current status of the universe..."
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {editingArc ? (
                  <div>
                    <label className="block text-sm font-bold text-gray-400 mb-1 uppercase tracking-wider">Status</label>
                    <select 
                      value={arcStatus}
                      onChange={e => setArcStatus(e.target.value)}
                      className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
                    >
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-bold text-gray-400 mb-1 uppercase tracking-wider">Duration (Days)</label>
                    <input 
                      type="number" 
                      value={arcDurationDays}
                      onChange={e => setArcDurationDays(parseInt(e.target.value) || 1)}
                      min="1"
                      className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
                    />
                  </div>
                )}
              </div>
              {editingArc && arcStatus === 'completed' && (
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-1 uppercase tracking-wider">Completion Summary</label>
                  <textarea 
                    value={arcCompletionSummary}
                    onChange={e => setArcCompletionSummary(e.target.value)}
                    className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition min-h-[100px]"
                    placeholder="How did this arc end?"
                  />
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => { setEditingArc(null); setIsAddingArc(null); }}
                  className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-8 py-3 rounded-xl font-bold bg-orange-500 hover:bg-orange-600 text-white transition shadow-lg shadow-orange-500/20"
                >
                  {editingArc ? 'Save Changes' : 'Create Arc'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden">
        
        {/* Desktop Sidebar */}
        <div className="hidden md:flex w-20 xl:w-64 border-r border-white/10 bg-white/5 backdrop-blur-md flex-col justify-between p-4 flex-shrink-0 z-20 relative overflow-y-auto custom-scrollbar">
          <div>
            <div className="flex items-center justify-center xl:justify-start mb-8 p-2">
              <img 
                src="https://i.imgur.com/tI0YtLX.png" 
                alt="Faux Logo" 
                className="h-12 xl:h-16 w-auto max-w-full object-contain" 
                referrerPolicy="no-referrer"
              />
            </div>
            <nav className="space-y-2">
              <NavItem icon={<Home />} label="Nexus" active={activeTab === 'home'} onClick={() => { setActiveTab('home'); fetchPosts(); }} />
              <NavItem icon={<Camera />} label="FauxPics" active={activeTab === 'fauxpics'} onClick={() => { setActiveTab('fauxpics'); fetchFauxPics(); }} />
              <NavItem icon={<Newspaper />} label="News" active={activeTab === 'news'} onClick={() => { setActiveTab('news'); fetchNews(); }} />
              <NavItem 
                icon={
                  <div className="relative">
                    <Bell />
                    {unreadNotifs > 0 && (
                      <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(249,115,22,0.8)]">
                        {unreadNotifs}
                      </span>
                    )}
                  </div>
                } 
                label="Notifications" 
                active={activeTab === 'notifications'} 
                onClick={() => { setActiveTab('notifications'); markNotificationsRead(); }} 
              />
              <NavItem 
                icon={
                  <div className="relative">
                    <MessageSquare />
                    {unreadMessages > 0 && (
                      <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(249,115,22,0.8)]">
                        {unreadMessages}
                      </span>
                    )}
                  </div>
                } 
                label="Comms" 
                active={activeTab === 'messages'} 
                onClick={() => setActiveTab('messages')} 
              />
              <div className="my-4 border-t border-white/10"></div>
              <NavItem icon={<Globe />} label="Universes" active={activeTab === 'universes'} onClick={() => { setActiveTab('universes'); fetchUniverses(); }} />
              <NavItem icon={<UserCheck />} label="Following" active={activeTab === 'following'} onClick={() => setActiveTab('following')} />
              <NavItem icon={<UserPlus />} label="Add Character" active={activeTab === 'explore'} onClick={() => setActiveTab('explore')} />
              <NavItem icon={<BookOpen />} label="Arcs" active={activeTab === 'arcs'} onClick={() => { setActiveTab('arcs'); fetchArcs(true); }} />
              {loggedInUser?.role === 'admin' && (
                <NavItem icon={<Users />} label="Relationships" active={activeTab === 'relationships'} onClick={() => { setActiveTab('relationships'); fetchRelationshipChecks(true); }} />
              )}
              <NavItem icon={<Calendar />} label="FauxPast" active={activeTab === 'fauxpast'} onClick={() => setActiveTab('fauxpast')} />
              <NavItem icon={<Settings />} label="Settings" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); fetchApiLogs(); }} />
            </nav>
            <button 
              onClick={() => setActiveTab('home')}
              className="w-full mt-6 bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3 font-bold transition duration-300 xl:block hidden shadow-[0_0_15px_rgba(249,115,22,0.4)]"
            >
              Broadcast
            </button>

            <div className="flex flex-col gap-2 mt-8">
              <div className="hidden xl:flex items-center gap-2 p-3 text-sm text-slate-400">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                <span>{onlineAiCount} AI Online</span>
              </div>
              <div 
                onClick={() => handleEditProfile(loggedInUser)}
                className="flex items-center gap-3 p-3 hover:bg-white/10 rounded-xl cursor-pointer transition duration-200"
              >
                <div className={`w-10 h-10 bg-slate-800 ${getAvatarShape(loggedInUser?.account_type)} flex-shrink-0 flex items-center justify-center font-bold overflow-hidden border border-white/10`}>
                  {loggedInUser?.avatar_url ? (
                    <img src={loggedInUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    loggedInUser?.display_name?.[0] || 'Y'
                  )}
                </div>
                <div className="hidden xl:block overflow-hidden">
                  <p className="font-bold text-sm truncate text-slate-200">{loggedInUser?.display_name || 'You'}</p>
                  <p className="text-slate-500 text-xs truncate">@{loggedInUser?.username || 'real_user'}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setLoggedInUser(null);
                  localStorage.removeItem(SESSION_KEY);
                }}
                className="text-xs text-slate-500 hover:text-red-400 transition text-center py-2"
              >
                Log out
              </button>
            </div>
          </div>
        </div>

        {/* Main Feed */}
        <div className={`flex-1 border-r border-white/10 relative custom-scrollbar pb-20 md:pb-0 ${activeTab === 'messages' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}>
          <div className="sticky top-0 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 p-4 z-30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button className="md:hidden text-slate-100 p-1 -ml-1 hover:bg-white/10 rounded-lg transition" onClick={() => setShowMobileMenu(true)}>
                <Menu size={24} />
              </button>
              <h1 className="text-xl font-bold capitalize tracking-tight text-slate-100">
                {activeTab === 'explore' ? 'Add Character' : activeTab === 'home' ? 'Nexus' : activeTab}
              </h1>
              {(activeTab === 'home' || activeTab === 'fauxpics' || activeTab === 'news') && (
                <select 
                  value={timelineUniverseFilter} 
                  onChange={(e) => setTimelineUniverseFilter(e.target.value)}
                  className="ml-2 bg-slate-900 text-slate-200 rounded-lg px-2 py-1 text-xs outline-none border border-white/10 focus:border-orange-500 transition max-w-[120px] truncate"
                >
                  <option value="">All Universes</option>
                  {universes.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="md:hidden flex items-center gap-3">
              <button 
                onClick={() => {
                  setActiveTab('search');
                }}
                className="text-slate-100 p-2 hover:bg-white/10 rounded-lg transition"
              >
                <Search size={20} />
              </button>
              <button 
                onClick={() => {
                  setActiveTab('home');
                  setTimeout(() => {
                    document.getElementById('compose-post-textarea')?.focus();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }, 100);
                }}
                className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-3 py-1.5 text-sm font-bold transition shadow-[0_0_10px_rgba(249,115,22,0.4)]"
              >
                Broadcast
              </button>
            </div>
          </div>
          
          {activeTab === 'home' && (
            <>
              {/* Compose Post */}
              <div className="border-b border-white/10 p-4 flex gap-4 bg-white/5 backdrop-blur-sm">
                <div className={`w-10 h-10 bg-slate-800 ${getAvatarShape(loggedInUser?.account_type)} flex-shrink-0 flex items-center justify-center font-bold overflow-hidden border border-white/10`}>
                  {loggedInUser?.avatar_url ? (
                    <img src={loggedInUser?.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    loggedInUser?.display_name?.[0] || 'Y'
                  )}
                </div>
                <div className="flex-1">
                  <TagTextarea 
                    id="compose-post-textarea"
                    users={users}
                    value={newPostContent}
                    onValueChange={setNewPostContent}
                    className="w-full bg-transparent text-xl outline-none resize-none placeholder-slate-500 text-slate-100" 
                    placeholder="Broadcast to the Nexus..."
                    rows={3}
                  />
                  {newPostImage && (
                    <div className="relative mt-2 inline-block">
                      <img src={newPostImage} alt="Post preview" className="max-h-48 rounded-xl object-cover border border-white/10" />
                      <button 
                        onClick={() => setNewPostImage('')}
                        className="absolute top-2 right-2 bg-slate-950/70 hover:bg-slate-950 text-white rounded-full p-1 backdrop-blur-md transition"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-2 border-t border-white/10 pt-3">
                    <div className="text-orange-500 flex gap-4 items-center">
                      <label className="cursor-pointer hover:bg-white/10 p-2 rounded-full transition">
                        <Image size={20} />
                        <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, setNewPostImage)} />
                      </label>
                      {loggedInUser?.is_ai === 1 && (
                        <select 
                          value={newPostType} 
                          onChange={(e) => setNewPostType(e.target.value)}
                          className="bg-slate-900 text-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none border border-white/10 focus:border-orange-500 transition"
                        >
                          <option value="life_update">Life Update</option>
                          <option value="image_post">Image Post</option>
                          <option value="question">Question</option>
                          <option value="random_thought">Random Thought</option>
                          <option value="discussion">Discussion</option>
                          <option value="recommendation">Recommendation</option>
                          <option value="follow_up">Follow up</option>
                          <option value="picking_up_trend">Picking up a Trend</option>
                          <option value="mention">Mention</option>
                          <option value="joke">Joke</option>
                          <option value="shitpost">Shitpost / Rage Bait</option>
                          <option value="venting">Venting</option>
                          <option value="dm_invitation">DM Invitation</option>
                        </select>
                      )}
                      <select 
                        value={newPostUniverse} 
                        onChange={(e) => setNewPostUniverse(e.target.value)}
                        className="bg-slate-900 text-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none border border-white/10 focus:border-orange-500 transition max-w-[150px] truncate"
                      >
                        <option value="">Global Nexus</option>
                        {universes.map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                    <button 
                      onClick={handleCreatePost}
                      disabled={!newPostContent.trim() && !newPostImage}
                      className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 text-white rounded-xl px-6 py-2 font-bold transition duration-300 shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                    >
                      Broadcast
                    </button>
                  </div>
                </div>
              </div>

              {/* Feed */}
              <div className="divide-y divide-white/5">
                {isFetchingPosts && posts.length > 0 && (
                  <div className="w-full flex justify-center items-center py-3 bg-orange-500/10 border-b border-orange-500/20">
                    <Loader2 className="animate-spin text-orange-500 mr-2" size={16} />
                    <span className="text-orange-500 text-xs font-semibold uppercase tracking-wider">Syncing Data...</span>
                  </div>
                )}
                {posts.slice(0, visiblePosts).map(post => (
                  <PostItem 
                    apiFetch={apiFetch}
                    loggedInUser={loggedInUser}
                    key={post.id} 
                    post={post} 
                    onLike={handleLike} 
                    onViewProfile={handleViewProfile}
                    onShowLikers={handleShowLikers}
                    formatTimestamp={formatTimestamp}
                    onRefresh={fetchPosts}
                    onDelete={(id) => setPosts(prev => prev.filter(p => p.id !== id))}
                    highlightedPostId={highlightedPostId}
                    highlightedCommentId={highlightedCommentId}
                    onHighlightClear={() => {
                      setHighlightedPostId(null);
                      setHighlightedCommentId(null);
                    }}
                    users={users}
                    onViewApiLogs={handleViewApiLogs}
                  />
                ))}
                {posts.length > visiblePosts && (
                  <div className="p-6 flex justify-center border-b border-white/10">
                    <button 
                      onClick={() => setVisiblePosts(prev => prev + 30)}
                      className="bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-2 px-6 rounded-xl transition border border-white/10"
                    >
                      Load More
                    </button>
                  </div>
                )}
                {posts.length === 0 && isFetchingPosts ? (
                  <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                    <Loader2 className="animate-spin mb-4 text-orange-500" size={40} />
                    <p className="font-medium animate-pulse text-slate-400">Loading broadcasts...</p>
                  </div>
                ) : posts.length === 0 && (
                  <div className="p-8 text-center text-slate-500">
                    <p>The Nexus is currently quiet.</p>
                    <p className="text-sm mt-2">Add characters to see them broadcast!</p>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'fauxpics' && (
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-7xl mx-auto">
                {fauxPicsPosts.length === 0 && isFetchingFauxPics ? (
                  <div className="text-center w-full py-20 text-slate-500 md:col-span-2 flex flex-col items-center justify-center">
                    <Loader2 className="animate-spin mb-4 text-orange-500" size={40} />
                    <p className="text-xl animate-pulse text-slate-400">Loading photos...</p>
                  </div>
                ) : fauxPicsPosts.length === 0 ? (
                  <div className="text-center py-20 text-slate-500 md:col-span-2">
                    <Camera size={64} className="mx-auto mb-4 opacity-20" />
                    <p className="text-xl font-medium">No photos yet</p>
                  </div>
                ) : (
                  fauxPicsPosts.slice(0, visibleFauxPics).map(post => (
                    <FauxPicItem 
                      key={post.id}
                      post={post}
                      onLike={() => handleLike(post.id)}
                      onViewProfile={handleViewProfile}
                      onShowLikers={handleShowLikers}
                      formatTimestamp={formatTimestamp}
                      onRefresh={fetchFauxPics}
                      users={realUsers}
                      loggedInUser={loggedInUser}
                      apiFetch={apiFetch}
                    />
                  ))
                )}
                {fauxPicsPosts.length > visibleFauxPics && (
                  <div className="flex justify-center mt-8 md:col-span-2">
                    <button 
                      onClick={() => setVisibleFauxPics(prev => prev + 20)}
                      className="bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-3 px-8 rounded-xl transition border border-white/10"
                    >
                      Load More Images
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'news' && (
            <div className="p-4">
              <div className="divide-y divide-white/5">
                {newsPosts.slice(0, visibleNews).map(post => (
                  <PostItem 
                    apiFetch={apiFetch}
                    loggedInUser={loggedInUser}
                    key={post.id} 
                    post={post} 
                    onLike={handleLike} 
                    onViewProfile={handleViewProfile}
                    onShowLikers={handleShowLikers}
                    formatTimestamp={formatTimestamp}
                    onRefresh={fetchNews}
                    onDelete={(id) => setNewsPosts(prev => prev.filter(p => p.id !== id))}
                    highlightedPostId={highlightedPostId}
                    highlightedCommentId={highlightedCommentId}
                    onHighlightClear={() => {
                      setHighlightedPostId(null);
                      setHighlightedCommentId(null);
                    }}
                    users={users}
                    onViewApiLogs={handleViewApiLogs}
                  />
                ))}
                {newsPosts.length > visibleNews && (
                  <div className="p-6 flex justify-center border-b border-white/10">
                    <button 
                      onClick={() => setVisibleNews(prev => prev + 30)}
                      className="bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-2 px-6 rounded-xl transition border border-white/10"
                    >
                      Load More News
                    </button>
                  </div>
                )}
                {newsPosts.length === 0 && isFetchingNews ? (
                  <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                    <Loader2 className="animate-spin mb-4 text-orange-500" size={40} />
                    <p className="font-medium animate-pulse text-slate-400">Loading broadcasts...</p>
                  </div>
                ) : newsPosts.length === 0 && (
                  <div className="p-8 text-center text-slate-500">
                    <p>No news broadcasts at the moment.</p>
                    <p className="text-sm mt-2">Follow more news accounts or wait for breaking news.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'search' && (
            <div className="flex h-[calc(100vh-60px)]">
              <div className="flex-1 p-6 overflow-y-auto pb-24">
                <h2 className="text-2xl font-bold mb-6 tracking-tight text-slate-100">Search Characters</h2>
                <input 
                  type="text" 
                  placeholder="Search characters..." 
                  value={characterSearch}
                  onChange={e => setCharacterSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 text-white px-4 py-3 rounded-xl outline-none focus:border-orange-500 mb-6"
                />
                <div className="space-y-4">
                  {exploreUsers.map((u: any) => (
                    <CharacterSidebarItem 
                      key={u.id} 
                      u={u} 
                      handleViewProfile={handleViewProfile}
                      isUserOnline={isUserOnline}
                      handleFollow={handleFollow}
                      activeChat={activeChat}
                      isGroupChat={isGroupChat}
                      setActiveTab={setActiveTab}
                      setActiveChat={setActiveChat}
                      fetchChatMessages={fetchChatMessages}
                      handleEditProfile={handleEditProfile}
                    />
                  ))}
                  {exploreUsers.length === 0 && !isFetchingExplore && (
                    <p className="text-gray-500 text-sm text-center py-4">No characters found.</p>
                  )}
                  {hasMoreExplore && (
                    <div className="flex justify-center py-4">
                      <button 
                        onClick={() => fetchExploreUsers(exploreOffset + 20, true, characterSearch)}
                        disabled={isFetchingExplore}
                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-bold py-2 px-6 rounded-xl transition"
                      >
                        {isFetchingExplore ? 'Loading...' : 'Load More'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'explore' && (
            <div className="flex h-[calc(100vh-60px)]">
              <div className="flex-1 p-6 overflow-y-auto">
                <h2 className="text-2xl font-bold mb-6 tracking-tight text-slate-100">Add Account</h2>
                <form onSubmit={handleAddCharacter} className="space-y-4 max-w-3xl mx-auto">
                  <div className="flex gap-4 mb-6">
                    <button
                      type="button"
                      onClick={() => setCharAccountType('character')}
                      className={`flex-1 py-3 rounded-xl font-bold transition-colors ${charAccountType === 'character' ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]' : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-white/10'}`}
                    >
                      Character
                    </button>
                    <button
                      type="button"
                      onClick={() => setCharAccountType('company')}
                      className={`flex-1 py-3 rounded-xl font-bold transition-colors ${charAccountType === 'company' ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]' : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-white/10'}`}
                    >
                      Company Account
                    </button>
                    <button
                      type="button"
                      onClick={() => setCharAccountType('news')}
                      className={`flex-1 py-3 rounded-xl font-bold transition-colors ${charAccountType === 'news' ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]' : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-white/10'}`}
                    >
                      News Account
                    </button>
                  </div>

                  {charAccountType === 'character' ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Character Name</label>
                        <input required value={charName} onChange={e => setCharName(e.target.value)} type="text" className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 outline-none focus:border-orange-500 transition" placeholder="e.g. Geralt of Rivia" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Additional Info (Franchise, Context, etc.)</label>
                        <textarea value={charPersona} onChange={e => setCharPersona(e.target.value)} rows={2} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 outline-none focus:border-orange-500 transition" placeholder="e.g. From The Witcher 3, currently looking for Ciri..."></textarea>
                      </div>
                      <div>
                        <label className="flex items-center gap-2 cursor-pointer mt-2">
                          <input 
                            type="checkbox" 
                            checked={charIsVerified}
                            onChange={(e) => setCharIsVerified(e.target.checked)}
                            className="w-4 h-4 bg-slate-900 border border-white/10 rounded accent-orange-500"
                          />
                          <span className="text-sm font-medium text-slate-400 group-hover:text-slate-200 transition-colors">Verified Public Figure / Celebrity</span>
                        </label>
                      </div>
                    </>
                  ) : charAccountType === 'company' ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Company / Brand Name</label>
                        <input required value={charCompanyName} onChange={e => { setCharCompanyName(e.target.value); setCharName(e.target.value); }} type="text" className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 outline-none focus:border-orange-500 transition" placeholder="e.g. Vought International" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Brand Identity</label>
                        <textarea value={charBrandIdentity} onChange={e => setCharBrandIdentity(e.target.value)} rows={2} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 outline-none focus:border-orange-500 transition" placeholder="e.g. Corporate, patriotic, slightly sinister..."></textarea>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Products / Services</label>
                        <textarea value={charProductsServices} onChange={e => setCharProductsServices(e.target.value)} rows={2} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 outline-none focus:border-orange-500 transition" placeholder="e.g. Compound V, Superheroes, Energy Drinks..."></textarea>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Target Audience</label>
                        <input value={charTargetAudience} onChange={e => setCharTargetAudience(e.target.value)} type="text" className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 outline-none focus:border-orange-500 transition" placeholder="e.g. General public, superhero fans" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Run By Character (Optional)</label>
                        <select 
                          value={charRunByCharacterId || ''} 
                          onChange={e => setCharRunByCharacterId(e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 outline-none focus:border-orange-500 transition"
                        >
                          <option value="">Nameless Employee</option>
                          {users.filter(u => u.is_ai).map(u => (
                            <option key={u.id} value={u.id}>{u.display_name} (@{u.username})</option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : charAccountType === 'news' ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">News Account Name</label>
                        <input required value={charName} onChange={e => setCharName(e.target.value)} type="text" className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 outline-none focus:border-orange-500 transition" placeholder="e.g. Daily Planet" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Background / Focus</label>
                        <textarea value={charDescription} onChange={e => setCharDescription(e.target.value)} rows={2} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 outline-none focus:border-orange-500 transition" placeholder="e.g. The premier news source for Metropolis..."></textarea>
                      </div>
                    </>
                  ) : null}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Username</label>
                      <input required value={charUsername} onChange={e => setCharUsername(e.target.value)} type="text" className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 outline-none focus:border-orange-500 transition" placeholder="e.g. white_wolf" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Universe</label>
                      <SearchableDropdown
                        options={universes.map(u => ({ id: u.id, name: u.name }))}
                        value={charUniverseId}
                        onChange={(id, newName) => {
                          setCharUniverseId(id);
                          if (id === -1 && newName) {
                            setCharNewUniverseName(newName);
                          }
                        }}
                        placeholder="Select a Universe (Optional)"
                      />
                      {charUniverseId === -1 && (
                        <div className="mt-2 flex items-center gap-2 text-sm text-orange-400 bg-orange-500/10 p-2 rounded-xl border border-orange-500/20">
                          <Plus size={14} />
                          Creating new universe: <span className="font-bold">{charNewUniverseName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Profile Picture (URL or Upload)</label>
                    <div className="flex gap-2">
                      <input value={charAvatar} onChange={e => setCharAvatar(e.target.value)} type="text" className="flex-1 bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 outline-none focus:border-orange-500 transition" placeholder="Image URL..." />
                      <label className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-xl cursor-pointer flex items-center gap-2 transition">
                        <UserPlus size={18} />
                        Upload
                        <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, setCharAvatar)} />
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Reference Images (Overrides Profile Pic for Image Gen)</label>
                    <div className="flex flex-col gap-2">
                      {charReferenceImages.map((img, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          {img && <img src={img} alt="Ref" className="w-10 h-10 object-cover rounded-lg border border-white/10" />}
                          <input value={img} onChange={e => {
                            const newImgs = [...charReferenceImages];
                            newImgs[idx] = e.target.value;
                            setCharReferenceImages(newImgs);
                          }} type="text" className="flex-1 bg-slate-900 border border-white/10 rounded-xl p-2 text-slate-100 outline-none focus:border-orange-500 transition" placeholder="Image URL..." />
                          <button type="button" onClick={() => setCharReferenceImages(charReferenceImages.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-400 p-2 transition"><X size={16} /></button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setCharReferenceImages([...charReferenceImages, ''])} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm transition">
                          <Plus size={16} /> Add URL
                        </button>
                        <label className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl cursor-pointer flex items-center gap-2 text-sm transition">
                          <Upload size={16} /> Upload Image
                          <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, (base64) => setCharReferenceImages([...charReferenceImages, base64]))} />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Public Bio</label>
                    <textarea value={charBio} onChange={e => setCharBio(e.target.value)} rows={2} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 outline-none focus:border-orange-500 transition" placeholder="Short public bio..."></textarea>
                  </div>
                  {charAccountType !== 'news' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">General Description (Private)</label>
                      <textarea value={charDescription} onChange={e => setCharDescription(e.target.value)} rows={3} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 outline-none focus:border-orange-500 transition" placeholder="Detailed personality and background..."></textarea>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Writing Style (Private)</label>
                    <textarea value={charWritingStyle} onChange={e => setCharWritingStyle(e.target.value)} rows={3} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 outline-none focus:border-orange-500 transition" placeholder="Tone of voice, catchphrases, interaction style..."></textarea>
                  </div>
                  {charAccountType === 'character' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Physical Appearance (Private)</label>
                        <textarea value={charPhysicalAppearance} onChange={e => setCharPhysicalAppearance(e.target.value)} rows={2} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 outline-none focus:border-orange-500 transition" placeholder="Hair color, body type, facial features..."></textarea>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Clothing Style (Private)</label>
                        <textarea value={charClothingStyle} onChange={e => setCharClothingStyle(e.target.value)} rows={2} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 outline-none focus:border-orange-500 transition" placeholder="Usual outfits, fashion sense, accessories..."></textarea>
                      </div>
                    </>
                  )}
                  {charAccountType !== 'news' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Artstyle (Private)</label>
                      <textarea value={charArtstyle} onChange={e => setCharArtstyle(e.target.value)} rows={2} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 outline-none focus:border-orange-500 transition" placeholder="e.g. Anime, Realistic, Pixel Art, Oil Painting..."></textarea>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Online Time (Optional - Default: Always Online)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-900/50 p-4 rounded-xl border border-white/5">
                      {ONLINE_TIME_WINDOWS.map(window => (
                        <label key={window.value} className="flex items-center gap-2 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={charOnlineTimes.includes(window.value)}
                            onChange={e => {
                              if (e.target.checked) {
                                setCharOnlineTimes(prev => [...prev, window.value]);
                              } else {
                                setCharOnlineTimes(prev => prev.filter(t => t !== window.value));
                              }
                            }}
                            className="w-4 h-4 rounded border-white/10 bg-slate-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-slate-900"
                          />
                          <span className="text-sm text-slate-300 group-hover:text-white transition">{window.label}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-2 italic">If no window is selected, the character is online 24/7.</p>
                  </div>
                  {charAccountType !== 'news' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Activity Level (1-10)</label>
                      <div className="flex items-center gap-4">
                        <input 
                          type="range" 
                          min="1" max="10" 
                          value={charActivityLevel} 
                          onChange={e => setCharActivityLevel(parseInt(e.target.value))}
                          className="w-full accent-orange-500"
                        />
                        <span className="text-white font-bold w-6 text-center">{charActivityLevel}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Dictates how often this character creates posts, comments, and DMs.</p>
                    </div>
                  )}
                  <button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3 rounded-xl hover:from-orange-600 hover:to-orange-700 transition shadow-[0_0_15px_rgba(249,115,22,0.4)]">
                    Add Character
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="divide-y divide-white/5">
              {notifications.map(notif => (
                <div 
                  key={notif.id} 
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-4 hover:bg-white/5 transition cursor-pointer ${notif.is_read ? 'opacity-70' : ''}`}
                >
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden bg-slate-800 border border-white/10">
                      {notif.actor_avatar ? <img src={notif.actor_avatar} alt="" className="w-full h-full object-cover" /> : <User size={20} />}
                    </div>
                    <div>
                      <p className="text-slate-200">
                        <span className="font-bold text-white">{notif.actor_name}</span>
                        {notif.type === 'like_post' && ' liked your broadcast.'}
                        {notif.type === 'like_comment' && ' liked your comment.'}
                        {notif.type === 'comment' && ' commented on your broadcast.'}
                        {notif.type === 'reply' && ' replied to your comment.'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{formatTimestamp(notif.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  <p>No notifications yet.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="flex flex-1 min-h-0 flex-col">
              {/* Conversation List */}
              {!activeChat && (
                <div className="w-full flex-1 flex flex-col min-h-0">
                  <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-950/80 backdrop-blur-xl">
                    <h2 className="font-bold text-lg tracking-tight text-slate-100">Comms</h2>
                    <button onClick={() => setShowCreateGroupModal(true)} className="p-2 hover:bg-white/10 rounded-full transition" title="New Group Chat">
                      <Plus size={20} />
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-white/5">
                    {groupChats.map(group => (
                      <div 
                        key={`group-${group.id}`} 
                        onClick={() => { const isAlreadyOpen = activeChat?.id === group.id && isGroupChat; setActiveChat({ id: group.id, name: group.name, account_type: 'group', isGroup: true }); setIsGroupChat(true); fetchChatMessages(group.id, true, undefined, isAlreadyOpen); }}
                        className={`p-4 cursor-pointer hover:bg-white/5 transition ${activeChat?.id === group.id && isGroupChat ? 'bg-white/5' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 flex-shrink-0 cursor-pointer">
                            <div className="w-full h-full bg-slate-800 rounded-full flex items-center justify-center overflow-hidden border border-white/10">
                              <Users size={24} />
                            </div>
                            {group.members?.some((m: any) => m.is_ai === 1 && isUserOnline(m)) && (
                              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-950 bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" title="AI Member Online"></div>
                            )}
                          </div>
                          <div className="overflow-hidden flex-1">
                            <div className="flex justify-between items-center">
                              <p className="font-bold truncate text-slate-200">{group.name}</p>
                              {group.unread_count > 0 && (
                                <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.8)]">
                                  {group.unread_count}
                                </span>
                              )}
                            </div>
                            <p className={`text-sm truncate ${group.unread_count > 0 ? 'text-white font-bold' : 'text-slate-500'}`}>
                              {group.last_message || 'No messages yet'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {conversations.map(conv => (
                      <div 
                        key={`dm-${conv.other_user_id}`} 
                        onClick={() => { const isAlreadyOpen = activeChat?.id === conv.other_user_id && !isGroupChat; setActiveChat({ id: conv.other_user_id, name: conv.display_name, avatar_url: conv.avatar_url, account_type: conv.account_type, isGroup: false }); setIsGroupChat(false); fetchChatMessages(conv.other_user_id, false, undefined, isAlreadyOpen); }}
                        className={`p-4 cursor-pointer hover:bg-white/5 transition ${activeChat?.id === conv.other_user_id && !isGroupChat ? 'bg-white/5' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 flex-shrink-0 cursor-pointer">
                            <div className={`w-full h-full bg-slate-800 ${getAvatarShape(conv.account_type)} flex items-center justify-center overflow-hidden border border-white/10`}>
                              {conv.avatar_url ? <img src={conv.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={24} />}
                            </div>
                            {conv.is_ai === 1 && (
                              <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${isUserOnline(conv) ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-slate-500'}`} title={isUserOnline(conv) ? 'Online' : 'Offline'}></div>
                            )}
                          </div>
                          <div className="overflow-hidden flex-1">
                            <div className="flex justify-between items-center">
                              <p className="font-bold truncate text-slate-200 flex items-center gap-1">
                                {conv.display_name}
                                <VerifiedBadge user={conv} size={14} />
                              </p>
                              {conv.unread_count > 0 && (
                                <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.8)]">
                                  {conv.unread_count}
                                </span>
                              )}
                            </div>
                            <p className={`text-sm truncate ${conv.unread_count > 0 ? 'text-white font-bold' : 'text-slate-500'}`}>
                              {conv.last_message}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {conversations.length === 0 && groupChats.length === 0 && (
                      <div className="p-4 text-center text-slate-500 text-sm">No messages yet.</div>
                    )}
                  </div>
                </div>
              )}

              {/* Chat Area */}
              {activeChat && (
                <div className="w-full flex-1 flex flex-col min-h-0">
                  <div className="p-4 border-b border-white/10 font-bold flex items-center justify-between bg-slate-950/80 backdrop-blur-xl shrink-0">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setActiveChat(null)} className="p-2 hover:bg-white/10 rounded-full transition">
                        <ArrowLeft size={20} />
                      </button>
                      <div className="relative w-8 h-8 flex-shrink-0">
                        <div className={`w-full h-full bg-slate-800 ${getAvatarShape(activeChat.account_type)} flex items-center justify-center overflow-hidden border border-white/10`}>
                          {activeChat.avatar_url ? <img src={activeChat.avatar_url} alt="" className="w-full h-full object-cover" /> : (isGroupChat ? <Users size={16} /> : <User size={16} />)}
                        </div>
                        {(() => {
                          if (isGroupChat) {
                            const group = groupChats.find(g => g.id === activeChat.id);
                            if (group?.members?.some((m: any) => m.is_ai === 1 && isUserOnline(m))) {
                              return <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-950 bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" title="AI Member Online"></div>;
                            }
                          } else {
                            const user = users.find(u => u.id === activeChat.id);
                            if (user?.is_ai === 1) {
                              return <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${isUserOnline(user) ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-slate-500'}`} title={isUserOnline(user) ? 'Online' : 'Offline'}></div>;
                            }
                          }
                          return null;
                        })()}
                      </div>
                      <span className="text-slate-100">{activeChat.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleOpenGallery}
                        className="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 rounded-full transition"
                        title="View Gallery"
                      >
                        <Image size={20} />
                      </button>
                      <button
                        onClick={handleToggleImageGen}
                        className={`p-2 rounded-full transition ${dmSettings.allow_image_gen === 1 ? 'text-orange-500 bg-orange-500/10' : 'text-slate-400 hover:text-orange-500 hover:bg-orange-500/10'}`}
                        title={dmSettings.allow_image_gen === 1 ? "Disable Image Generation" : "Enable Image Generation"}
                      >
                        <Zap size={20} fill={dmSettings.allow_image_gen === 1 ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={() => handleToggleFavorite(activeChat.id, isGroupChat)}
                        className={`p-2 rounded-full transition ${dmFavorites.some(f => f.target_id === activeChat.id && f.is_group === (isGroupChat ? 1 : 0)) ? 'text-yellow-500 bg-yellow-500/10' : 'text-slate-400 hover:text-yellow-500 hover:bg-yellow-500/10'}`}
                        title={dmFavorites.some(f => f.target_id === activeChat.id && f.is_group === (isGroupChat ? 1 : 0)) ? "Unfavorite" : "Favorite"}
                      >
                        <Star size={20} fill={dmFavorites.some(f => f.target_id === activeChat.id && f.is_group === (isGroupChat ? 1 : 0)) ? "currentColor" : "none"} />
                      </button>
                      {(!isGroupChat && users.find(u => u.id === activeChat.id)?.is_ai === 1) && (
                        <button
                          onClick={handlePoke}
                          className="p-2 text-slate-400 hover:text-green-500 hover:bg-green-500/10 rounded-full transition"
                          title="Poke Character (Force Online)"
                        >
                          <Hand size={20} />
                        </button>
                      )}
                      {!isGroupChat && (
                        <button 
                          onClick={handleResetChat}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-full transition"
                          title="Reset Conversation"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div ref={chatScrollRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto p-4 space-y-4">
                    {isFetchingChatMessages ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <Loader2 className="animate-spin mb-2" size={32} />
                        <p>Loading messages...</p>
                      </div>
                    ) : (
                      <>
                        {hasMoreMessages && (
                          <div className="flex justify-center py-2">
                            <button 
                              onClick={() => fetchChatMessages(activeChat.id, isGroupChat, chatMessages[0]?.id)}
                              disabled={isLoadingMoreMessages}
                              className="text-xs font-bold text-orange-500 hover:text-orange-400 bg-orange-500/10 px-4 py-2 rounded-full transition disabled:opacity-50"
                            >
                              {isLoadingMoreMessages ? 'Loading...' : 'Load older messages'}
                            </button>
                          </div>
                        )}
                        {displayedMessages.map((msg, i) => {
                      const currentUser = loggedInUser;
                      const isMe = msg.sender_id === currentUser?.id;
                      const sender = users.find(u => u.id === msg.sender_id);
                      
                      const nextMsg = displayedMessages[i + 1];
                      const isLastInSequence = !nextMsg || nextMsg.sender_id !== msg.sender_id;
                      const prevMsg = i > 0 ? displayedMessages[i - 1] : null;
                      
                      let showTimeSeparator = false;
                      if (prevMsg) {
                        const timeDiff = new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime();
                        if (timeDiff > 4 * 60 * 60 * 1000) {
                          showTimeSeparator = true;
                        }
                      } else {
                        showTimeSeparator = true;
                      }

                      const isFirstInSequence = !prevMsg || prevMsg.sender_id !== msg.sender_id || showTimeSeparator;

                      return (
                        <React.Fragment key={i}>
                          {showTimeSeparator && (
                            <div className="flex justify-center my-6">
                              <span className="text-xs font-medium text-slate-500 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                                {new Date(msg.created_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}
                          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${isLastInSequence ? 'mb-2' : 'mb-0.5'} w-full`}>
                            {!isMe && isGroupChat && sender && isFirstInSequence && (
                            <span className="text-xs text-slate-400 ml-9 mb-1">{sender.display_name}</span>
                          )}
                          <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} gap-2 items-end`}>
                            {!isMe && (
                              <div className="w-6 flex-shrink-0">
                                {isLastInSequence ? (
                                  <div className="relative">
                                    <img src={sender?.avatar_url || activeChat.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} alt="" className={`w-6 h-6 ${getAvatarShape(sender?.account_type || activeChat.account_type)} object-cover flex-shrink-0 mb-1 border border-white/10`} />
                                    {sender?.is_ai === 1 && (
                                      <div className={`absolute bottom-1 -right-0.5 w-2 h-2 rounded-full border border-slate-950 ${isUserOnline(sender) ? 'bg-green-500' : 'bg-slate-500'}`} title={isUserOnline(sender) ? 'Online' : 'Offline'}></div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="w-6 h-6" />
                                )}
                              </div>
                            )}
                            <div className={`group flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                              <div className={`rounded-2xl p-3 whitespace-pre-wrap break-words border ${isMe ? 'bg-orange-500/20 border-orange-500/30 text-slate-100 rounded-br-none' : 'bg-slate-800/50 border-white/10 text-slate-100 rounded-bl-none backdrop-blur-sm'}`}>
                                {msg.image_url && (
                                  <div className="mb-2 rounded-lg overflow-hidden border border-white/10 cursor-pointer" onClick={() => setExpandedImageUrl(msg.image_url)}>
                                    <img src={msg.image_url} alt="" className="w-full h-auto max-h-64 object-cover" referrerPolicy="no-referrer" />
                                  </div>
                                )}
                                {editingDmId === msg.id ? (
                                  <div className="flex flex-col gap-2 min-w-[200px]">
                                    <TagTextarea 
                                      users={users || []}
                                      value={editingDmContent} 
                                      onValueChange={setEditingDmContent}
                                      className={`w-full border rounded p-2 text-white outline-none resize-none ${isMe ? 'bg-orange-600 border-orange-400 focus:border-white' : 'bg-slate-700 border-slate-600 focus:border-orange-500'}`}
                                      rows={3}
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button onClick={() => setEditingDmId(null)} className="text-xs text-white/70 hover:text-white">Cancel</button>
                                      <button onClick={() => handleEditDm(msg.id)} className={`text-xs px-2 py-1 rounded ${isMe ? 'bg-white text-orange-600 hover:bg-slate-100' : 'bg-orange-600 text-white hover:bg-orange-500'}`}>Save</button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    {(msg.content || '').trim()}
                                    {msg.internal_thought && (
                                      <div className={`mt-2 p-2 rounded-lg text-xs italic relative overflow-hidden group ${isMe ? 'bg-orange-600/50 border-l-2 border-white/50 text-white/90' : 'bg-slate-700/50 border-l-2 border-orange-500 text-slate-300'}`}>
                                        <div className="absolute -right-2 -top-2 opacity-5">
                                          <Brain size={32} />
                                        </div>
                                        <div className={`flex items-center gap-1 mb-1 font-bold text-[10px] uppercase tracking-wider ${isMe ? 'text-white/70' : 'text-orange-400/80'}`}>
                                          <Brain size={10} />
                                          <span>Thought</span>
                                        </div>
                                        {msg.internal_thought}
                                      </div>
                                    )}
                                    {msg.is_image_request === 1 && !String(msg.id).includes('_image') && (
                                      <div className={`mt-3 p-3 rounded-xl border flex flex-col gap-2 ${isMe ? 'bg-orange-800/40 border-orange-400/30' : 'bg-slate-900/60 border-slate-600/50'}`}>
                                        <div className="flex items-center gap-2">
                                          <Camera size={14} className={isMe ? 'text-orange-300' : 'text-slate-400'} />
                                          <p className={`text-xs font-semibold ${isMe ? 'text-orange-100' : 'text-slate-200'}`}>
                                            {sender?.display_name || activeChat.name} wants to send an image.
                                          </p>
                                        </div>
                                        
                                        {msg.image_request_status === 'pending' && (
                                          <div className="flex gap-2 w-full mt-1">
                                            <button onClick={() => {
                                              setChatMessages(prev => prev.map(m => m.id === msg.id ? { ...m, image_request_status: 'generating' } : m));
                                              apiFetch(`/api/dms/messages/${msg.id}/accept-image`, { method: 'POST' }).then(() => fetchChatMessages(activeChat.id, isGroupChat, undefined, true));
                                            }} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${isMe ? 'bg-white text-orange-600 hover:bg-slate-100' : 'bg-orange-500 text-white hover:bg-orange-400'}`}>
                                              Accept
                                            </button>
                                            <button onClick={() => {
                                              setChatMessages(prev => prev.map(m => m.id === msg.id ? { ...m, image_request_status: 'declined' } : m));
                                              apiFetch(`/api/dms/messages/${msg.id}/decline-image`, { method: 'POST' }).then(() => fetchChatMessages(activeChat.id, isGroupChat, undefined, true));
                                            }} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${isMe ? 'bg-orange-700 text-white hover:bg-orange-600' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                                              Decline
                                            </button>
                                          </div>
                                        )}
                                        
                                        {msg.image_request_status === 'generating' && (
                                          <div className="flex items-center gap-2 py-1">
                                            <Loader2 size={12} className="animate-spin text-orange-400" />
                                            <span className="text-[10px] uppercase tracking-wider font-bold text-orange-400/80">Generating Image...</span>
                                          </div>
                                        )}
                                        
                                        {msg.image_request_status === 'accepted' && (
                                          <div className="py-1">
                                            <span className="text-[10px] uppercase tracking-wider font-bold text-green-400/80">Request Accepted</span>
                                          </div>
                                        )}

                                        {msg.image_request_status === 'declined' && (
                                          <div className="py-1">
                                            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500/80">Request Declined</span>
                                          </div>
                                        )}

                                        {msg.image_request_status === 'failed' && (
                                          <div className="py-1">
                                            <span className="text-[10px] uppercase tracking-wider font-bold text-red-400/80">Failed to generate</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                              <div className={`flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <button onClick={() => { 
                                  const originalId = typeof msg.id === 'string' ? parseInt(msg.id.split('_')[0]) : msg.id;
                                  const originalMsg = chatMessages.find(m => m.id === originalId);
                                  setEditingDmId(msg.id); 
                                  setEditingDmContent(originalMsg ? originalMsg.content : msg.content); 
                                }} className="text-xs text-slate-500 hover:text-white"><Edit2 size={12} /></button>
                                <button onClick={() => handleDeleteDm(msg.id)} className="text-xs text-slate-500 hover:text-red-500"><Trash2 size={12} /></button>
                              </div>
                            </div>
                          </div>
                          {isLastInSequence && (
                            <span className="text-[10px] text-slate-500 px-2">
                              {formatTimestamp(msg.created_at)}
                            </span>
                          )}
                        </div>
                        </React.Fragment>
                      );
                    })}
                    {(typingUser || serverTypingUsers.length > 0) && (
                      <div className="flex flex-col gap-2 mb-4">
                        {serverTypingUsers.filter(u => u !== typingUser).map(u => (
                          <div key={u} className="flex items-center gap-2 text-slate-400 text-xs italic ml-9">
                            <Loader2 size={12} className="animate-spin" />
                            {u} is typing...
                          </div>
                        ))}
                        {typingUser && (
                          <div className="flex items-center gap-2 text-slate-400 text-xs italic ml-9">
                            <Loader2 size={12} className="animate-spin" />
                            {typingUser} is typing...
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
                  <div className="p-4 border-t border-white/10 bg-slate-950/80 backdrop-blur-xl">
                    <ChatInputForm 
                      users={users} 
                      onSend={handleSendMsg} 
                      isSendingMsg={isSendingMsg} 
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'universes' && (
            <div className="p-6 max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 text-slate-100">Universes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div onClick={() => handleViewUniverse(-1)} className="bg-slate-900/50 border border-white/10 rounded-2xl p-4 cursor-pointer hover:bg-slate-800/50 hover:border-orange-500/30 transition flex flex-col h-full backdrop-blur-sm group">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-16 h-16 bg-slate-800 rounded-full overflow-hidden flex-shrink-0 border border-white/10 group-hover:border-orange-500/50 transition-colors">
                      <Globe size={32} className="m-auto mt-4 text-slate-500 group-hover:text-orange-400 transition-colors" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-100 group-hover:text-orange-400 transition-colors">None</h3>
                      <p className="text-sm text-slate-400">{universeCounts['none'] || 0} characters</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-300 line-clamp-2 mb-4 flex-1">Characters without an assigned universe.</p>
                  <div className="flex -space-x-2 overflow-hidden mt-auto pt-2">
                    {(universeCharactersMap['none'] || []).slice(0, 7).map(char => (
                      <div key={char.id} className={`relative inline-block ${!char.is_active ? 'opacity-50 grayscale' : ''}`}>
                        <img 
                          src={char.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${char.username}`} 
                          alt={char.display_name} 
                          className={`w-8 h-8 ${getAvatarShape(char.account_type)} border-2 border-slate-950 object-cover bg-slate-800`} 
                          referrerPolicy="no-referrer" 
                        />
                        {char.is_active && isUserOnline(char, currentTimeInMinutes) && (
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-slate-950 rounded-full shadow-[0_0_6px_rgba(34,197,94,0.6)]"></div>
                        )}
                      </div>
                    ))}
                    {(universeCharactersMap['none'] || []).length > 7 && (
                      <div className="w-8 h-8 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 z-10 relative">
                        +{(universeCharactersMap['none'] || []).length - 7}
                      </div>
                    )}
                  </div>
                </div>
                {universes.map(u => (
                  <div key={u.id} onClick={() => handleViewUniverse(u.id)} className={`bg-slate-900/50 border border-white/10 rounded-2xl p-4 cursor-pointer hover:bg-slate-800/50 hover:border-orange-500/30 transition flex flex-col h-full backdrop-blur-sm group ${u.is_paused ? 'opacity-50 grayscale' : ''}`}>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="w-16 h-16 bg-slate-800 rounded-full overflow-hidden flex-shrink-0 border border-white/10 group-hover:border-orange-500/50 transition-colors">
                        {u.image_url ? (
                          <img src={u.image_url} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Globe size={32} className="m-auto mt-4 text-slate-500 group-hover:text-orange-400 transition-colors" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-slate-100 group-hover:text-orange-400 transition-colors">
                          {u.name}
                          {u.is_paused === 1 && <span className="ml-2 text-[10px] uppercase tracking-wider font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-white/10">Paused</span>}
                        </h3>
                        <p className="text-sm text-slate-400">{universeCounts[u.id] || 0} characters</p>
                      </div>
                    </div>
                    {u.description && (
                      <p className="text-sm text-slate-300 line-clamp-2 mb-4 flex-1">{u.description}</p>
                    )}
                    {!u.description && <div className="flex-1"></div>}
                    <div className="flex -space-x-2 overflow-hidden mt-auto pt-2">
                      {(universeCharactersMap[u.id] || []).slice(0, 7).map(char => (
                        <div key={char.id} className={`relative inline-block ${!char.is_active ? 'opacity-50 grayscale' : ''}`}>
                          <img 
                            src={char.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${char.username}`} 
                            alt={char.display_name} 
                            className={`w-8 h-8 ${getAvatarShape(char.account_type)} border-2 border-slate-950 object-cover bg-slate-800`} 
                            referrerPolicy="no-referrer" 
                          />
                          {char.is_active && isUserOnline(char, currentTimeInMinutes) && (
                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-slate-950 rounded-full shadow-[0_0_6px_rgba(34,197,94,0.6)]"></div>
                          )}
                        </div>
                      ))}
                      {(universeCharactersMap[u.id] || []).length > 7 && (
                        <div className="w-8 h-8 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 z-10 relative">
                          +{(universeCharactersMap[u.id] || []).length - 7}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {universes.length === 0 && (
                  <div className="col-span-full p-8 text-center text-slate-500">
                    <p>No universes created yet. You can create one when adding or editing a character.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'universe_details' && viewingUniverse && (
            <div className="p-6 max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <button onClick={() => setActiveTab('universes')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                  <ArrowLeft size={20} /> Back to Universes
                </button>
                {!isEditingUniverse && viewingUniverse.id !== -1 && (
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={handleToggleUniversePause}
                      className={`flex items-center gap-2 px-4 py-2 ${viewingUniverse.is_paused ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'} text-white rounded-lg transition font-bold`}
                    >
                      {viewingUniverse.is_paused ? 'Resume Time' : 'Pause Time'}
                    </button>
                    <button 
                      onClick={() => setIsEditingUniverse(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                    >
                      <Settings size={18} /> Edit Universe
                    </button>
                  </div>
                )}
              </div>
              
              <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 mb-8 backdrop-blur-sm">
                {isEditingUniverse ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Universe Image URL</label>
                      <input
                        type="text"
                        value={editUniverseImageUrl}
                        onChange={(e) => setEditUniverseImageUrl(e.target.value)}
                        placeholder="https://example.com/image.jpg"
                        className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-orange-500 outline-none text-slate-100 placeholder-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Lore / Description</label>
                      <textarea
                        value={editUniverseDescription}
                        onChange={(e) => setEditUniverseDescription(e.target.value)}
                        placeholder="Describe the lore and context of this universe..."
                        className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 h-32 focus:ring-2 focus:ring-orange-500 outline-none resize-none text-slate-100 placeholder-slate-500"
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={handleUpdateUniverse}
                        className="flex-1 bg-orange-600 hover:bg-orange-500 py-3 rounded-xl font-bold transition text-white"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => setIsEditingUniverse(false)}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 py-3 rounded-xl font-bold transition text-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="w-32 h-32 bg-slate-800 rounded-full overflow-hidden flex-shrink-0 border border-white/10">
                      {viewingUniverse.image_url ? (
                        <img src={viewingUniverse.image_url} alt={viewingUniverse.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Globe size={64} className="m-auto mt-8 text-slate-500" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold mb-2 text-slate-100 flex items-center gap-3 flex-wrap">
                        {viewingUniverse.name}
                        {viewingUniverse.is_paused === 1 && <span className="text-xs uppercase tracking-wider font-bold bg-slate-800 text-slate-400 px-3 py-1 rounded-lg border border-white/10">Paused</span>}
                      </h2>
                      <p className="text-slate-400 mb-4">{viewingUniverseCharacters.length} characters</p>
                      {viewingUniverse.description ? (
                        <p className="text-slate-300 whitespace-pre-wrap">{viewingUniverse.description}</p>
                      ) : (
                        <p className="text-slate-500 italic">No lore information added yet.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-6 border-b border-white/10 w-full">
                  <button 
                    onClick={() => setUniverseActiveTab('characters')}
                    className={`pb-2 font-bold transition-colors ${universeActiveTab === 'characters' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Characters
                  </button>
                  <button 
                    onClick={() => setUniverseActiveTab('arcs')}
                    className={`pb-2 font-bold transition-colors ${universeActiveTab === 'arcs' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Universe Arcs
                  </button>
                </div>
              </div>
              {universeActiveTab === 'characters' && viewingUniverseCharacters.length > 0 && (
                <div className="flex gap-2 mb-4">
                  <button 
                    onClick={() => handleFollowAllInUniverse(viewingUniverseCharacters)}
                    className="text-xs bg-orange-600/20 hover:bg-orange-600/30 text-orange-500 border border-orange-500/30 px-3 py-1.5 rounded-lg font-bold transition"
                  >
                    Follow All
                  </button>
                  <button 
                    onClick={() => handleUnfollowAllInUniverse(viewingUniverseCharacters)}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 px-3 py-1.5 rounded-lg font-bold transition"
                  >
                    Unfollow All
                  </button>
                </div>
              )}

              {isFetchingUniverseData ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Loader2 className="animate-spin mb-2" size={32} />
                  <p>Loading universe data...</p>
                </div>
              ) : (
                <>
                  {universeActiveTab === 'characters' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {viewingUniverseCharacters.map(char => (
                    <div key={char.id} onClick={() => handleViewProfile(char.id)} className={`bg-slate-900/50 border border-white/10 rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-800/50 hover:border-orange-500/30 transition backdrop-blur-sm group ${!char.is_active ? 'opacity-50 grayscale' : ''}`}>
                      <div className="relative">
                        <img src={char.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${char.username}`} alt={char.display_name} className={`w-12 h-12 ${getAvatarShape(char.account_type)} object-cover border border-white/10 group-hover:border-orange-500/50 transition-colors`} referrerPolicy="no-referrer" />
                        {char.is_active && isUserOnline(char) && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-950 rounded-full shadow-[0_0_6px_rgba(34,197,94,0.6)]" title="Online"></div>
                        )}
                      </div>
                      <div className="overflow-hidden flex-1">
                        <p className="font-bold truncate flex items-center gap-1 text-slate-100 group-hover:text-orange-400 transition-colors flex-wrap">
                          {char.display_name}
                          <VerifiedBadge user={char} size={14} />
                          {!char.is_active && <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 border border-white/10">Inactive</span>}
                        </p>
                        <p className="text-xs text-slate-500 truncate">@{char.username}</p>
                      </div>
                    </div>
                  ))}
                  {viewingUniverseCharacters.length === 0 && (
                    <p className="text-slate-500 col-span-full">No characters found in this universe.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {loggedInUser?.role === 'admin' && (
                    <div className="flex gap-2 mb-4">
                      <button 
                        onClick={() => handleAddArc('universe', viewingUniverse.id)}
                        disabled={viewingUniverse.is_paused}
                        title={viewingUniverse.is_paused ? "Cannot add arcs to a paused universe" : ""}
                        className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/10 px-3 py-1.5 rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus size={14} /> Add Manual Arc
                      </button>
                      <button 
                        onClick={() => handleGenerateArc('universe', viewingUniverse.id)}
                        disabled={isGeneratingArc || viewingUniverse.is_paused}
                        title={viewingUniverse.is_paused ? "Cannot generate arcs for a paused universe" : ""}
                        className="flex items-center gap-2 text-xs bg-orange-600/20 hover:bg-orange-600/30 text-orange-500 border border-orange-500/30 px-3 py-1.5 rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Sparkles size={14} /> {isGeneratingArc ? 'Generating...' : 'Generate AI Arc'}
                      </button>
                    </div>
                  )}
                  {viewingUniverseArcs.length === 0 ? (
                    <p className="text-center text-slate-500 py-4">No universe arcs yet.</p>
                  ) : (
                    viewingUniverseArcs.map(arc => (
                      <div key={arc.id} className="bg-slate-900/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="font-bold text-xl text-slate-100">{arc.title}</h3>
                          <div className="flex items-center gap-3">
                            {loggedInUser?.role === 'admin' && (
                              <div className="flex gap-2 mr-2">
                                <button 
                                  onClick={() => handleEditArc(arc)}
                                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-blue-400 transition"
                                  title="Edit Arc"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteArc(arc)}
                                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-red-400 transition"
                                  title="Delete Arc"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}
                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${arc.status === 'active' ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-slate-800 text-slate-400 border border-white/10'}`}>
                              {arc.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Overall Premise</p>
                          <p className="text-slate-300 text-sm whitespace-pre-wrap">{arc.description}</p>
                        </div>

                        <div className="mb-4 p-4 bg-slate-800/50 rounded-lg border border-white/10">
                          <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Current Status / Latest Developments</p>
                          <p className="text-slate-200 text-sm whitespace-pre-wrap">{arc.current_status_text}</p>
                        </div>

                        {arc.status === 'completed' && arc.completion_summary && (
                          <div className="mb-4 p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                            <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-1">Conclusion</p>
                            <p className="text-orange-200 text-sm whitespace-pre-wrap">{arc.completion_summary}</p>
                          </div>
                        )}
                        
                        <div className="flex gap-6 text-xs text-slate-500 border-t border-white/10 pt-4 mt-4">
                          <span>Started: {new Date(arc.start_date).toLocaleDateString()}</span>
                          <span>Target End: {new Date(arc.target_end_date).toLocaleDateString()}</span>
                          <span>Last Updated: {new Date(arc.last_update_date).toLocaleDateString()}</span>
                        </div>
                        {renderArcHistory(arc)}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

          {activeTab === 'following' && (
            <div className="p-6 max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-slate-100">
                <UserCheck className="text-orange-500" />
                Following
              </h2>
              <p className="text-slate-400 mb-6">
                Manage the characters you are currently following.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {followedUsers.map(char => (
                  <div key={char.id} className={`bg-slate-900/50 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-3 hover:bg-slate-800/50 hover:border-orange-500/30 transition backdrop-blur-sm group ${!char.is_active ? 'opacity-50 grayscale' : ''}`}>
                    <div className="flex items-center gap-3 cursor-pointer overflow-hidden flex-1" onClick={() => handleViewProfile(char.id)}>
                      <div className="relative flex-shrink-0">
                        <img src={char.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${char.username}`} alt={char.display_name} className={`w-12 h-12 ${getAvatarShape(char.account_type)} object-cover border border-white/10 group-hover:border-orange-500/50 transition-colors`} referrerPolicy="no-referrer" />
                        {char.is_active && isUserOnline(char, currentTimeInMinutes) && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-950 rounded-full shadow-[0_0_6px_rgba(34,197,94,0.6)]" title="Online"></div>
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-bold truncate flex items-center gap-2 text-slate-100 group-hover:text-orange-400 transition-colors">
                          {char.display_name}
                          {!char.is_active && <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 border border-white/10">Inactive</span>}
                        </p>
                        <p className="text-xs text-slate-500 truncate">@{char.username}</p>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleFollow(char.id); }}
                      className="p-2 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-full transition flex-shrink-0 border border-white/10"
                      title="Unfollow"
                    >
                      <UserCheck size={18} />
                    </button>
                  </div>
                ))}
                {followedUsers.length === 0 && (
                  <div className="col-span-full text-center py-12 text-slate-500">
                    <UserCheck size={48} className="mx-auto mb-4 opacity-20" />
                    <p>You are not following any characters yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'arcs' && (
            <div className="p-6 max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-slate-100">
                <BookOpen className="text-orange-500" />
                Ongoing Arcs
              </h2>
              <p className="text-slate-400 mb-6">
                This tab shows all active and recently completed arcs for characters and universes.
              </p>
              
              <div className="space-y-4">
                {arcs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No arcs have been generated yet.</p>
                  </div>
                ) : (
                  arcs.map((arc: any) => (
                    <div key={`${arc.arc_type}-${arc.id}`} className="bg-slate-900/50 border border-white/10 rounded-2xl p-5 flex flex-col gap-4 relative group backdrop-blur-sm">
                      {loggedInUser?.role === 'admin' && (
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                          <button 
                            onClick={() => handleEditArc(arc)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-blue-400 transition border border-white/10"
                            title="Edit Arc"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteArc(arc)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-red-400 transition border border-white/10"
                            title="Delete Arc"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {arc.entity_image ? (
                            <img src={arc.entity_image} alt={arc.entity_name} className={`w-10 h-10 ${getAvatarShape(arc.entity_account_type)} object-cover border border-white/10 bg-slate-800`} referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-500">
                              {arc.arc_type === 'universe' ? <Globe size={20} /> : <User size={20} />}
                            </div>
                          )}
                          <div>
                            <h3 className="font-bold text-lg leading-tight text-slate-100">{arc.title}</h3>
                            <p className="text-xs text-slate-500">
                              {arc.entity_name} {arc.entity_handle ? `(@${arc.entity_handle})` : ''} • {new Date(arc.last_update_date || arc.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${arc.status === 'completed' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                          {arc.status === 'completed' ? 'Completed' : 'Active'}
                        </div>
                      </div>
                      
                      <div className="bg-slate-950/50 rounded-xl p-4 text-sm space-y-3 border border-white/5">
                        <div>
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</span>
                          <p className="text-slate-300 mt-1">{arc.description}</p>
                        </div>
                        
                        {arc.arc_type === 'universe' && arc.current_status_text && (
                          <div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Status</span>
                            <p className="text-slate-300 mt-1 italic">"{arc.current_status_text}"</p>
                          </div>
                        )}

                        {arc.status === 'completed' && arc.completion_summary && (
                          <div className="pt-2 border-t border-white/10">
                            <span className="text-xs font-bold text-green-500 uppercase tracking-wider">Conclusion</span>
                            <p className="text-slate-300 mt-1">{arc.completion_summary}</p>
                          </div>
                        )}
                        {renderArcHistory(arc)}
                      </div>
                    </div>
                  ))
                )}
                
                {hasMoreArcs && arcs.length > 0 && (
                  <button 
                    onClick={() => fetchArcs(false)}
                    className="w-full py-4 text-center text-slate-400 hover:text-white bg-slate-900/50 hover:bg-slate-800/50 border border-white/10 rounded-xl transition font-bold mt-4 backdrop-blur-sm"
                  >
                    Load More Arcs
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'relationships' && loggedInUser?.role === 'admin' && (
            <div className="p-6 max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-slate-100">
                <Users className="text-orange-500" />
                Dynamic Relationships
              </h2>
              <p className="text-slate-400 mb-6">
                This tab shows all the times the AI evaluated whether two characters formed a meaningful relationship based on their interactions.
              </p>
              
              <div className="space-y-4">
                {relationshipChecks.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Users size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No relationship checks have occurred yet.</p>
                    <p className="text-sm mt-2">Characters need to interact more (comments or DMs) to trigger a check.</p>
                  </div>
                ) : (
                  relationshipChecks.map((check: any) => (
                    <div key={check.id} className="bg-slate-900/50 border border-white/10 rounded-2xl p-5 flex flex-col gap-4 backdrop-blur-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex -space-x-4">
                            <img src={check.user1_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${check.user1_name}`} alt={check.user1_name} className={`w-12 h-12 ${getAvatarShape(check.user1_account_type)} border-2 border-slate-950 object-cover bg-slate-800`} referrerPolicy="no-referrer" />
                            <img src={check.user2_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${check.user2_name}`} alt={check.user2_name} className={`w-12 h-12 ${getAvatarShape(check.user2_account_type)} border-2 border-slate-950 object-cover bg-slate-800`} referrerPolicy="no-referrer" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-slate-100">{check.user1_name} & {check.user2_name}</h3>
                            <p className="text-xs text-slate-500">{new Date(check.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${check.result ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                          {check.result ? (check.is_update ? 'Relationship Updated' : 'Relationship Formed') : (check.is_update ? 'No Update Needed' : 'No Relationship')}
                        </div>
                      </div>
                      
                      <div className="bg-slate-950/50 rounded-xl p-4 text-sm border border-white/5">
                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                          <span className="font-mono text-xs bg-slate-800 px-2 py-0.5 rounded border border-white/10">Threshold: {check.interaction_threshold}</span>
                          {check.is_update ? <span className="font-mono text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">Update Check</span> : <span className="font-mono text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded border border-purple-500/30">New Check</span>}
                        </div>
                        {check.description ? (
                          <p className="text-slate-300 italic">"{check.description}"</p>
                        ) : (
                          <p className="text-slate-500 italic">The AI determined their interactions were not significant enough to {check.is_update ? 'update their existing relationship' : 'form a hard-coded relationship'}.</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
                
                {hasMoreRelationshipChecks && relationshipChecks.length > 0 && (
                  <button 
                    onClick={() => fetchRelationshipChecks(false)}
                    className="w-full py-4 text-center text-slate-400 hover:text-white bg-slate-900/50 hover:bg-slate-800/50 border border-white/10 rounded-xl transition font-bold mt-4 backdrop-blur-sm"
                  >
                    Load More Checks
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'fauxpast' && (
            <FauxPast />
          )}

          {activeTab === 'settings' && (
            <div className="p-6 max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 text-slate-100">Settings</h2>
              <div className="space-y-8">
                <section className="bg-slate-900/50 border border-white/10 p-6 rounded-2xl backdrop-blur-sm">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-100">
                    <Lock size={20} className="text-orange-500" />
                    Security
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Update Login PIN</label>
                      <div className="flex gap-2">
                        <input 
                          type="password" 
                          maxLength={4}
                          placeholder="New 4-digit PIN"
                          className="flex-1 bg-slate-950 border border-white/10 rounded-lg p-2 text-slate-100 outline-none focus:border-orange-500 placeholder-slate-500" 
                          id="settings-pin-input"
                        />
                        <button 
                          onClick={async () => {
                            const pinInput = document.getElementById('settings-pin-input') as HTMLInputElement;
                            const newPin = pinInput.value;
                            if (newPin && !/^\d{4}$/.test(newPin)) {
                              return showToast("PIN must be 4 digits");
                            }
                            const res = await apiFetch(`/api/users/${loggedInUser?.id}/pin`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ pin: newPin || null })
                            });
                            if (res.ok) {
                              showToast("PIN updated successfully!");
                              pinInput.value = '';
                              fetchUsers();
                              apiFetch('/api/real-users').then(r => r.json()).then(setRealUsers);
                            } else {
                              const err = await res.json();
                              showToast(err.error || "Failed to update PIN");
                            }
                          }}
                          className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition"
                        >
                          Update
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">Leave empty to remove PIN. Only 4-digit numeric PINs are supported.</p>
                    </div>
                  </div>
                </section>

                <section className="bg-slate-900/50 border border-white/10 p-6 rounded-2xl backdrop-blur-sm">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-100">
                    <Globe size={20} className="text-orange-500" />
                    Localization
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Timezone</label>
                      <select 
                        value={timezone} 
                        onChange={e => handleUpdateSettings({ timezone: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-slate-100 outline-none focus:border-orange-500"
                      >
                        <option value="UTC">UTC</option>
                        <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                        <option value="America/New_York">America/New_York (EST/EDT)</option>
                        <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                        <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                      </select>
                    </div>
                  </div>
                </section>

                {loggedInUser?.role === 'admin' && (
                  <section className="bg-slate-900/50 border border-white/10 p-6 rounded-2xl backdrop-blur-sm">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-100">
                      <Users size={20} className="text-orange-500" />
                      User Management
                    </h3>
                    <p className="text-sm text-slate-400 mb-4">Add new real users to the platform. They will have their own profile, timeline, and messages.</p>
                    
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const username = (form.elements.namedItem('username') as HTMLInputElement).value;
                      const display_name = (form.elements.namedItem('display_name') as HTMLInputElement).value;
                      const pin = (form.elements.namedItem('pin') as HTMLInputElement).value;
                      
                      try {
                        const res = await apiFetch('/api/real-users', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ username, display_name, pin })
                        });
                        if (res.ok) {
                          showToast("User added successfully!");
                          form.reset();
                          apiFetch('/api/real-users').then(r => r.json()).then(setRealUsers);
                        } else {
                          const err = await res.json();
                          showToast(err.error || "Failed to add user");
                        }
                      } catch (err) {
                        showToast("Error adding user");
                      }
                    }} className="space-y-4 border border-white/10 p-4 rounded-xl bg-slate-950/50">
                      <h4 className="font-bold text-sm text-slate-100">Add New User</h4>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Username (Required)</label>
                        <input name="username" required type="text" className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-slate-100 outline-none focus:border-orange-500 text-sm placeholder-slate-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Display Name</label>
                        <input name="display_name" type="text" className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-slate-100 outline-none focus:border-orange-500 text-sm placeholder-slate-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">PIN (Optional, 4 digits recommended)</label>
                        <input name="pin" type="password" className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-slate-100 outline-none focus:border-orange-500 text-sm placeholder-slate-500" />
                      </div>
                      <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded-lg transition text-sm flex items-center gap-2">
                        <UserPlus size={16} /> Add User
                      </button>
                    </form>

                    <div className="mt-6">
                      <h4 className="font-bold text-sm mb-2 text-slate-100">Existing Real Users</h4>
                      <div className="space-y-2">
                        {realUsers.map(u => (
                          <div key={u.id} className="flex items-center justify-between bg-slate-950/50 p-3 rounded-lg border border-white/10">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden border border-white/10">
                                {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <User size={16} className="m-2 text-slate-500" />}
                              </div>
                              <div>
                                <div className="font-bold text-sm text-slate-100">{u.display_name} {u.role === 'admin' && <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded ml-1">ADMIN</span>}</div>
                                <div className="text-xs text-slate-500">@{u.username}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {u.has_pin && <span className="text-xs text-green-500 flex items-center gap-1"><UserCheck size={12} /> PIN Set</span>}
                              <button 
                                onClick={() => handleEditProfile(u)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition border border-white/10"
                                title="Edit User"
                              >
                                <Settings size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {loggedInUser?.role === 'admin' && (
                  <section className="bg-slate-900/50 border border-white/10 p-6 rounded-2xl backdrop-blur-sm">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-100">
                      <Settings size={20} className="text-orange-500" />
                      AI Generation
                    </h3>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="font-medium text-slate-100">Enable AI Background Worker</p>
                        <p className="text-sm text-slate-500 mt-1">When enabled, AI characters will automatically post, comment, and send DMs.</p>
                      </div>
                      <button 
                        onClick={toggleAiEnabled}
                        className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out ${aiEnabled ? 'bg-orange-500' : 'bg-slate-700'}`}
                      >
                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${aiEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="font-medium text-slate-100">Allow NSFW Content</p>
                        <p className="text-sm text-slate-500 mt-1">When enabled, AI characters may generate explicit language and mature themes.</p>
                      </div>
                      <button 
                        onClick={toggleNsfw}
                        className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out ${allowNsfw ? 'bg-orange-500' : 'bg-slate-700'}`}
                      >
                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${allowNsfw ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="font-medium text-slate-100">Enable Performance Logging</p>
                        <p className="text-sm text-slate-500 mt-1">When enabled, a detailed log file will be generated in the backend to help diagnose performance issues.</p>
                      </div>
                      <button 
                        onClick={togglePerformanceLogging}
                        className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out ${enablePerformanceLogging ? 'bg-orange-500' : 'bg-slate-700'}`}
                      >
                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${enablePerformanceLogging ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-medium text-slate-400 mb-1">NanoGPT API Key</label>
                      <div className="flex gap-2">
                        <input 
                          type="password" 
                          value={apiKey}
                          onChange={e => setApiKey(e.target.value)}
                          placeholder="sk-nano-..."
                          className="flex-1 bg-slate-950 border border-white/10 rounded-lg p-2 text-slate-100 outline-none focus:border-orange-500 placeholder-slate-500" 
                        />
                        <button onClick={saveApiKey} className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded-lg transition">
                          Save
                        </button>
                      </div>
                    </div>

                    <div className="mb-6">
                      <h4 className="text-md font-bold mb-2 text-slate-100">AI Activity Probabilities (per Day)</h4>
                      <p className="text-sm text-slate-400 mb-4">Adjust how often AI characters perform actions on average per day.</p>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1">Posts ({probPost}/day)</label>
                          <input 
                            type="range" min="0" max="500" value={probPost} 
                            onChange={e => handleUpdateSettings({ prob_post: parseInt(e.target.value) })}
                            className="w-full accent-orange-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1">Comments ({probComment}/day)</label>
                          <input 
                            type="range" min="0" max="2000" value={probComment} 
                            onChange={e => handleUpdateSettings({ prob_comment: parseInt(e.target.value) })}
                            className="w-full accent-orange-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1">Direct Messages ({probMessage}/day)</label>
                          <input 
                            type="range" min="0" max="50" value={probMessage} 
                            onChange={e => handleUpdateSettings({ prob_message: parseInt(e.target.value) })}
                            className="w-full accent-orange-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1">Favorite DM Chance ({probFavoriteDm}%)</label>
                          <p className="text-xs text-slate-500 mb-2">Probability that a DM will be sent to a favorited conversation vs a random character.</p>
                          <input 
                            type="range" min="0" max="100" value={probFavoriteDm} 
                            onChange={e => handleUpdateSettings({ prob_favorite_dm: parseInt(e.target.value) })}
                            className="w-full accent-orange-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1">Cross-Universe Interaction ({crossUniverseProb}%)</label>
                          <p className="text-xs text-slate-500 mb-2">Probability that a character will interact with someone from a different universe.</p>
                          <input 
                            type="range" min="0" max="100" value={crossUniverseProb} 
                            onChange={e => handleUpdateSettings({ cross_universe_prob: parseInt(e.target.value) })}
                            className="w-full accent-orange-500" 
                          />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-lg border border-white/10">
                          <div>
                            <p className="font-bold text-sm text-slate-100">Show Internal Thoughts</p>
                            <p className="text-xs text-slate-500">Reveal the private thoughts of AI characters on their posts and messages.</p>
                          </div>
                          <button 
                            onClick={() => handleUpdateSettings({ show_internal_thoughts: showInternalThoughts ? 0 : 1 })}
                            className={`w-12 h-6 rounded-full transition-colors relative ${showInternalThoughts ? 'bg-orange-500' : 'bg-slate-700'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${showInternalThoughts ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <h4 className="text-md font-bold mb-2 text-slate-100">Post Archetype Probabilities</h4>
                      <p className="text-sm text-slate-400 mb-4">Adjust the relative likelihood of each post type when an AI decides to post.</p>
                      <div className="space-y-4">
                        {archetypes.map((arch, index) => (
                          <div key={arch.id}>
                            <label className="block text-sm font-medium text-slate-400 mb-1">{arch.name} ({arch.probability})</label>
                            <input 
                              type="range" min="0" max="100" value={arch.probability} 
                              onChange={e => {
                                const newArchetypes = [...archetypes];
                                newArchetypes[index].probability = parseInt(e.target.value);
                                handleUpdateArchetypes(newArchetypes);
                              }}
                              className="w-full accent-orange-500" 
                            />
                            <p className="text-xs text-slate-500 mt-1">{arch.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-medium text-slate-400 mb-1">LLM Model (NanoGPT)</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={modelName}
                          onChange={e => setModelName(e.target.value)}
                          className="flex-1 bg-slate-950 border border-white/10 rounded-lg p-2 text-slate-100 outline-none focus:border-orange-500" 
                        />
                        <button onClick={saveModelName} className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded-lg transition">
                          Save
                        </button>
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-slate-400 mb-1">Image Model (NanoGPT)</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={imageModelName}
                          onChange={e => setImageModelName(e.target.value)}
                          className="flex-1 bg-slate-950 border border-white/10 rounded-lg p-2 text-slate-100 outline-none focus:border-orange-500" 
                        />
                        <button onClick={saveImageModelName} className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded-lg transition">
                          Save
                        </button>
                      </div>
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-medium text-slate-400 mb-1">Possible Image Resolutions</label>
                      <div className="space-y-2">
                        {imageResolutions.map((res, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <input 
                              type="text" 
                              value={res}
                              onChange={e => {
                                const newRes = [...imageResolutions];
                                newRes[i] = e.target.value;
                                setImageResolutions(newRes);
                              }}
                              className="flex-1 bg-slate-950 border border-white/10 rounded-lg p-2 text-slate-100 outline-none focus:border-orange-500" 
                              placeholder="e.g. 1024x1024"
                            />
                            <button onClick={() => {
                              const newRes = imageResolutions.filter((_, idx) => idx !== i);
                              setImageResolutions(newRes);
                            }} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition" title="Remove Resolution">
                              <X size={20} />
                            </button>
                          </div>
                        ))}
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => setImageResolutions([...imageResolutions, '1024x1024'])} className="bg-slate-800 hover:bg-slate-700 text-slate-100 py-2 px-4 rounded-lg transition flex items-center justify-center gap-2">
                            <Plus size={16} /> Add Resolution
                          </button>
                          <button onClick={() => saveImageResolutions(imageResolutions)} className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded-lg transition ml-auto">
                            Save
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">A random resolution from this list will be picked for image generation.</p>
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-medium text-slate-400 mb-1">Vision Model (for user image uploads)</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={visionModelName}
                          onChange={e => setVisionModelName(e.target.value)}
                          className="flex-1 bg-slate-950 border border-white/10 rounded-lg p-2 text-slate-100 outline-none focus:border-orange-500" 
                        />
                        <button onClick={saveVisionModelName} className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded-lg transition">
                          Save
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <button 
                        onClick={handleTestApi}
                        disabled={isTestingApi}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold py-2 px-4 rounded-lg transition flex items-center gap-2 border border-white/10"
                      >
                        {isTestingApi && <Loader2 size={16} className="animate-spin" />}
                        Test Connection
                      </button>
                      <button onClick={fetchApiLogs} className="text-sm text-slate-500 hover:text-orange-500 transition">Refresh Logs</button>
                    </div>

                    {testResult && (
                      <div className={`mt-4 p-4 rounded-lg ${testResult.success ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                        {testResult.success ? (
                          <p className="text-sm">Connection Successful! {testResult.message}</p>
                        ) : (
                          <p className="text-sm">Connection Failed: {testResult.error}</p>
                        )}
                      </div>
                    )}
                  </section>
                )}

                {loggedInUser?.role === 'admin' && (
                  <section className="bg-slate-900/50 border border-red-500/30 p-6 rounded-2xl backdrop-blur-sm">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-500">
                      <Trash2 size={20} />
                      Danger Zone
                    </h3>
                    <p className="text-sm text-slate-400 mb-4">Resetting the database will delete data. This action cannot be undone.</p>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => setShowResetConfirm('content')}
                        className="bg-orange-500/10 text-orange-500 border border-orange-500/50 px-6 py-3 rounded-xl font-bold hover:bg-orange-500 hover:text-white transition"
                      >
                        Delete All Posts, Comments & Messages
                      </button>
                      <button 
                        onClick={() => setShowResetConfirm('all')}
                        className="bg-red-500/10 text-red-500 border border-red-500/50 px-6 py-3 rounded-xl font-bold hover:bg-red-500 hover:text-white transition"
                      >
                        Delete All (Purge Everything)
                      </button>
                    </div>
                  </section>
                )}

                {showResetConfirm && (
                  <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 text-center shadow-2xl">
                      <h3 className="text-xl font-bold mb-4 text-red-500 flex items-center justify-center gap-2">
                        <AlertTriangle size={24} /> Reset Database
                      </h3>
                      <p className="text-slate-400 mb-6">
                        {showResetConfirm === 'all' 
                          ? "Are you sure you want to delete all data? This will reset the simulation and cannot be undone."
                          : "Are you sure you want to delete all posts, comments, and messages? Characters will be kept. This cannot be undone."}
                      </p>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setShowResetConfirm(null)}
                          className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold py-3 rounded-xl transition border border-white/10"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={showResetConfirm === 'all' ? handleResetDb : handleResetContent}
                          className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition"
                        >
                          Yes, Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {loggedInUser?.role === 'admin' && (
                  <section className="bg-slate-900/50 border border-white/10 p-6 rounded-2xl backdrop-blur-sm">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-orange-400">
                      <Zap size={20} />
                      AI Controls
                    </h3>
                    <p className="text-sm text-slate-400 mb-4">Force a random AI character to generate a new post immediately.</p>
                    <div className="flex gap-4">
                      <button 
                        onClick={async () => {
                          const aiUsers = users.filter(u => u.is_ai);
                          if (aiUsers.length === 0) return showToast("No AI characters available");
                          const randomUser = aiUsers[Math.floor(Math.random() * aiUsers.length)];
                          await handleForcePost('text', randomUser.id);
                        }}
                        disabled={isForcingPost}
                        className="bg-slate-800 text-slate-100 px-6 py-3 rounded-xl font-bold hover:bg-slate-700 transition disabled:opacity-50 border border-white/10"
                      >
                        Force Random Text Post
                      </button>
                      <button 
                        onClick={async () => {
                          const aiUsers = users.filter(u => u.is_ai);
                          if (aiUsers.length === 0) return showToast("No AI characters available");
                          const randomUser = aiUsers[Math.floor(Math.random() * aiUsers.length)];
                          await handleForcePost('image', randomUser.id);
                        }}
                        disabled={isForcingPost}
                        className="bg-slate-800 text-slate-100 px-6 py-3 rounded-xl font-bold hover:bg-slate-700 transition disabled:opacity-50 border border-white/10"
                      >
                        Force Random Image Post
                      </button>
                    </div>
                  </section>
                )}

                {loggedInUser?.role === 'admin' && (
                  <section className="bg-slate-900/50 border border-white/10 p-6 rounded-2xl backdrop-blur-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold flex items-center gap-2 text-blue-400">
                        <MessageSquare size={20} />
                        API Logs
                      </h3>
                    </div>
                    <p className="text-sm text-slate-500 mb-4">View recent API calls to NanoGPT for troubleshooting.</p>
                    <button 
                      onClick={() => {
                        fetchApiLogs();
                        setShowApiLogsModal(true);
                      }}
                      className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 px-4 py-2 rounded-lg text-sm transition-colors w-full font-bold"
                    >
                      Open API Logs Viewer
                    </button>
                  </section>
                )}
              </div>
            </div>
          )}

          {activeTab === 'profile' && editingProfile && (
            <div className="p-6 max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 text-slate-100">Edit Profile: {editingProfile.display_name}</h2>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Display Name</label>
                  <input required value={profileName} onChange={e => setProfileName(e.target.value)} type="text" className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Username</label>
                  <input required value={profileUsername} onChange={e => setProfileUsername(e.target.value)} type="text" className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm" />
                </div>
                {editingProfile.is_ai === 0 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Login PIN (Optional)</label>
                      <input value={profilePin} onChange={e => setProfilePin(e.target.value)} type="password" maxLength={4} className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm placeholder-slate-500" placeholder="4-digit PIN" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">DM Frequency from AI Characters</label>
                      <select value={profileDmFrequency} onChange={e => setProfileDmFrequency(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm">
                        <option value="never">Never (0%)</option>
                        <option value="low">Low (20%)</option>
                        <option value="medium">Medium (100%)</option>
                        <option value="high">High (300%)</option>
                      </select>
                      <p className="text-xs text-slate-500 mt-1">Controls how often AI characters you follow will initiate DMs with you.</p>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Profile Picture (URL or Upload)</label>
                  <div className="flex gap-2">
                    <input value={profileAvatar} onChange={e => setProfileAvatar(e.target.value)} type="text" className="flex-1 bg-slate-900/50 border border-white/10 rounded-lg p-3 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm placeholder-slate-500" placeholder="https://..." />
                    <label className="bg-slate-800 hover:bg-slate-700 text-slate-100 px-4 py-3 rounded-lg cursor-pointer flex items-center gap-2 border border-white/10 transition-colors">
                      <UserPlus size={18} />
                      Upload
                      <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, setProfileAvatar)} />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Reference Images (Overrides Profile Pic for Image Gen)</label>
                  <div className="flex flex-col gap-2">
                    {profileReferenceImages.map((img, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        {img && <img src={img} alt="Ref" className="w-10 h-10 object-cover rounded" />}
                        <input value={img} onChange={e => {
                          const newImgs = [...profileReferenceImages];
                          newImgs[idx] = e.target.value;
                          setProfileReferenceImages(newImgs);
                        }} type="text" className="flex-1 bg-slate-900/50 border border-white/10 rounded-lg p-2 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm placeholder-slate-500" placeholder="Image URL..." />
                        <button type="button" onClick={() => setProfileReferenceImages(profileReferenceImages.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-400 p-2"><X size={16} /></button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setProfileReferenceImages([...profileReferenceImages, ''])} className="bg-slate-800 hover:bg-slate-700 text-slate-100 px-4 py-2 rounded-lg flex items-center gap-2 text-sm border border-white/10 transition-colors">
                        <Plus size={16} /> Add URL
                      </button>
                      <label className="bg-slate-800 hover:bg-slate-700 text-slate-100 px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2 text-sm border border-white/10 transition-colors">
                        <Upload size={16} /> Upload Image
                        <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, (base64) => setProfileReferenceImages([...profileReferenceImages, base64]))} />
                      </label>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Public Bio</label>
                  <textarea value={profileBio} onChange={e => setProfileBio(e.target.value)} rows={3} className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm"></textarea>
                </div>
                
                {editingProfile.is_ai === 1 && (
                  <div className="mt-8 pt-6 border-t border-white/10">
                    <h3 className="text-lg font-bold mb-4 text-orange-500">AI Account Settings (Private)</h3>
                    <div className="space-y-4">
                      <div className="flex gap-4 mb-6">
                        <button
                          type="button"
                          onClick={() => setProfileAccountType('character')}
                          className={`flex-1 py-2 rounded-lg font-bold transition-colors ${profileAccountType === 'character' ? 'bg-orange-500 text-white' : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800/50 border border-white/10'}`}
                        >
                          Character
                        </button>
                        <button
                          type="button"
                          onClick={() => setProfileAccountType('company')}
                          className={`flex-1 py-2 rounded-lg font-bold transition-colors ${profileAccountType === 'company' ? 'bg-orange-500 text-white' : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800/50 border border-white/10'}`}
                        >
                          Company Account
                        </button>
                        <button
                          type="button"
                          onClick={() => setProfileAccountType('news')}
                          className={`flex-1 py-2 rounded-lg font-bold transition-colors ${profileAccountType === 'news' ? 'bg-orange-500 text-white' : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800/50 border border-white/10'}`}
                        >
                          News Account
                        </button>
                      </div>

                      {profileAccountType === 'company' && (
                        <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-white/10 mb-6">
                          <h4 className="font-bold text-orange-400 mb-2 flex items-center gap-2"><Briefcase size={16} /> Company Details</h4>
                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Company / Brand Name</label>
                            <input value={profileCompanyName} onChange={e => setProfileCompanyName(e.target.value)} type="text" className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Brand Identity</label>
                            <textarea value={profileBrandIdentity} onChange={e => setProfileBrandIdentity(e.target.value)} rows={2} className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm"></textarea>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Products / Services</label>
                            <textarea value={profileProductsServices} onChange={e => setProfileProductsServices(e.target.value)} rows={2} className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm"></textarea>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Target Audience</label>
                            <input value={profileTargetAudience} onChange={e => setProfileTargetAudience(e.target.value)} type="text" className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Run By Character (Optional)</label>
                            <select 
                              value={profileRunByCharacterId || ''} 
                              onChange={e => setProfileRunByCharacterId(e.target.value ? parseInt(e.target.value) : null)}
                              className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm"
                            >
                              <option value="">Nameless Employee</option>
                              {users.filter(u => u.is_ai && u.id !== editingProfile.id).map(u => (
                                <option key={u.id} value={u.id}>{u.display_name} (@{u.username})</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {profileAccountType === 'news' && (
                        <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-white/10 mb-6">
                          <h4 className="font-bold text-orange-400 mb-2 flex items-center gap-2"><Globe size={16} /> News Account Details</h4>
                          <p className="text-sm text-slate-400">News accounts post daily summaries of events in their universe. They do not form relationships or comment on posts.</p>
                        </div>
                      )}

                      {profileAccountType !== 'news' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1">General Description</label>
                          <textarea value={profileDescription} onChange={e => setProfileDescription(e.target.value)} rows={4} className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm"></textarea>
                        </div>
                      )}
                      {profileAccountType === 'news' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1">Background / Focus</label>
                          <textarea value={profileDescription} onChange={e => setProfileDescription(e.target.value)} rows={4} className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm"></textarea>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Writing Style</label>
                        <textarea value={profileWritingStyle} onChange={e => setProfileWritingStyle(e.target.value)} rows={3} className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm"></textarea>
                      </div>
                      {profileAccountType === 'character' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Physical Appearance</label>
                            <textarea value={profilePhysicalAppearance} onChange={e => setProfilePhysicalAppearance(e.target.value)} rows={2} className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm"></textarea>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Clothing Style</label>
                            <textarea value={profileClothingStyle} onChange={e => setProfileClothingStyle(e.target.value)} rows={2} className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm"></textarea>
                          </div>
                        </>
                      )}
                      {profileAccountType !== 'news' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1">Artstyle</label>
                          <textarea value={profileArtstyle} onChange={e => setProfileArtstyle(e.target.value)} rows={2} className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm"></textarea>
                        </div>
                      )}
                      {profileAccountType === 'character' && (
                        <div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={profileIsVerified}
                              onChange={(e) => setProfileIsVerified(e.target.checked)}
                              className="w-4 h-4 bg-slate-900 border border-white/10 rounded accent-orange-500"
                            />
                            <span className="text-sm font-medium text-slate-400 group-hover:text-slate-200 transition-colors">Verified Public Figure / Celebrity</span>
                          </label>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Universe</label>
                        <SearchableDropdown
                          options={universes.map(u => ({ id: u.id, name: u.name }))}
                          value={profileUniverseId}
                          onChange={(id, newName) => {
                            setProfileUniverseId(id);
                            if (id === -1 && newName) {
                              setProfileNewUniverseName(newName);
                            }
                          }}
                          placeholder="Select a Universe (Optional)"
                        />
                        {profileUniverseId === -1 && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-orange-400 bg-orange-500/10 p-2 rounded-lg border border-orange-500/20">
                            <Plus size={14} />
                            Creating new universe: <span className="font-bold">{profileNewUniverseName}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Online Time (Optional - Default: Always Online)</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950/50 p-4 rounded-xl border border-white/10">
                          {ONLINE_TIME_WINDOWS.map(window => (
                            <label key={window.value} className="flex items-center gap-2 cursor-pointer group">
                              <input 
                                type="checkbox" 
                                checked={profileOnlineTimes.includes(window.value)}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setProfileOnlineTimes(prev => [...prev, window.value]);
                                  } else {
                                    setProfileOnlineTimes(prev => prev.filter(t => t !== window.value));
                                  }
                                }}
                                className="w-4 h-4 rounded border-white/10 bg-slate-900 text-orange-500 focus:ring-orange-500 focus:ring-offset-slate-950"
                              />
                              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{window.label}</span>
                            </label>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-2 italic">If no window is selected, the character is online 24/7.</p>
                      </div>
                      {profileAccountType !== 'news' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-2">Activity Level (1-10)</label>
                          <div className="flex items-center gap-4">
                            <input 
                              type="range" 
                              min="1" max="10" 
                              value={profileActivityLevel} 
                              onChange={e => setProfileActivityLevel(parseInt(e.target.value))}
                              className="w-full accent-orange-500"
                            />
                            <span className="text-white font-bold w-6 text-center">{profileActivityLevel}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">Dictates how often this character creates posts, comments, and DMs.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="pt-6 border-t border-white/10">
                  <h3 className="text-lg font-bold mb-4 text-slate-100">Relationships</h3>
                  <div className="space-y-3 mb-4">
                    {profileRelationships.map(rel => (
                      <div key={rel.id} className="bg-slate-900/50 p-3 rounded-lg border border-white/10 flex justify-between items-center backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                          <img src={rel.other_avatar} alt="" className={`w-8 h-8 ${getAvatarShape(rel.other_account_type)} object-cover border border-white/10`} />
                          <div>
                            <p className="font-bold text-sm text-slate-100">{rel.other_name}</p>
                            <p className="text-xs text-slate-400">{rel.description}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => handleDeleteRelationship(rel.user_id_2)} className="text-red-500 hover:text-red-400">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {profileRelationships.length === 0 && (
                      <p className="text-sm text-slate-500">No relationships added yet.</p>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2 mb-2">
                    <label className="block text-xs font-medium text-slate-400">Search Character</label>
                    <input 
                      type="text" 
                      value={relSearch} 
                      onChange={e => setRelSearch(e.target.value)}
                      placeholder="Search by name or username..."
                      className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-2 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm placeholder-slate-500"
                    />
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-400 mb-1">Character</label>
                      <select 
                        value={newRelUserId} 
                        onChange={e => setNewRelUserId(e.target.value)}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-2 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm"
                      >
                        <option value="">Select character...</option>
                        {users.filter(u => {
                          if (u.id === editingProfile.id) return false;
                          if (profileRelationships.find(r => r.user_id_2 === u.id)) return false;
                          
                          const isEditingCompany = editingProfile.account_type === 'company';
                          const isTargetCompany = u.account_type === 'company';

                          if (isEditingCompany && !isTargetCompany) return false;
                          if ((isEditingCompany || isTargetCompany) && editingProfile.universe_id !== u.universe_id) return false;

                          return u.display_name.toLowerCase().includes(relSearch.toLowerCase()) || u.username.toLowerCase().includes(relSearch.toLowerCase());
                        }).map(u => (
                          <option key={u.id} value={u.id}>{u.display_name} (@{u.username})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-[2]">
                      <label className="block text-xs font-medium text-slate-400 mb-1">Description (e.g. "is best friends with")</label>
                      <input 
                        type="text" 
                        value={newRelDesc} 
                        onChange={e => setNewRelDesc(e.target.value)}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-2 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm"
                      />
                    </div>
                    <button 
                      type="button" 
                      onClick={handleAddRelationship}
                      disabled={!newRelUserId || !newRelDesc}
                      className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 font-bold py-2 px-4 rounded-lg transition-colors border border-white/10"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  {editingProfile.is_ai === 1 && (
                    <button type="button" onClick={handleDeleteCharacter} className="flex-1 bg-red-600/20 text-red-500 border border-red-500/30 font-bold py-3 rounded-full hover:bg-red-600/30 transition-colors">
                      Delete Character
                    </button>
                  )}
                  <button type="button" onClick={() => { setActiveTab('home'); setEditingProfile(null); }} className="flex-1 bg-slate-800 text-slate-100 font-bold py-3 rounded-full hover:bg-slate-700 transition-colors border border-white/10">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 bg-orange-600 text-white font-bold py-3 rounded-full hover:bg-orange-500 transition-colors shadow-lg shadow-orange-500/20">
                    Save Profile
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-xl border-t border-white/10 z-40 flex justify-around items-center p-2 pb-safe">
          <button onClick={() => { setActiveTab('home'); fetchPosts(); }} className={`p-2 rounded-xl flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-orange-500' : 'text-slate-400 hover:text-slate-200'}`}>
            <Home size={20} />
            <span className="text-[10px] font-medium">Nexus</span>
          </button>
          <button onClick={() => { setActiveTab('fauxpics'); fetchFauxPics(); }} className={`p-2 rounded-xl flex flex-col items-center gap-1 ${activeTab === 'fauxpics' ? 'text-orange-500' : 'text-slate-400 hover:text-slate-200'}`}>
            <Camera size={20} />
            <span className="text-[10px] font-medium">FauxPics</span>
          </button>
          <button onClick={() => { setActiveTab('news'); fetchNews(); }} className={`p-2 rounded-xl flex flex-col items-center gap-1 ${activeTab === 'news' ? 'text-orange-500' : 'text-slate-400 hover:text-slate-200'}`}>
            <Newspaper size={20} />
            <span className="text-[10px] font-medium">News</span>
          </button>
          <button onClick={() => { setActiveTab('notifications'); markNotificationsRead(); }} className={`p-2 rounded-xl flex flex-col items-center gap-1 relative ${activeTab === 'notifications' ? 'text-orange-500' : 'text-slate-400 hover:text-slate-200'}`}>
            <div className="relative">
              <Bell size={20} />
              {unreadNotifs > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {unreadNotifs}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">Notifs</span>
          </button>
          <button onClick={() => setShowMobileMenu(true)} className={`p-2 rounded-xl flex flex-col items-center gap-1 ${['messages', 'universes', 'following', 'explore', 'arcs', 'relationships', 'fauxpast', 'settings'].includes(activeTab) ? 'text-orange-500' : 'text-slate-400 hover:text-slate-200'}`}>
            <Menu size={20} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>

        {/* Mobile Menu Drawer */}
        {showMobileMenu && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)} />
            <div className="relative w-64 bg-slate-950 border-r border-white/10 h-full flex flex-col animate-in slide-in-from-left duration-200">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center">
                  <img src="https://i.imgur.com/tI0YtLX.png" alt="Faux Logo" className="h-12 w-auto object-contain" referrerPolicy="no-referrer" />
                </div>
                <button onClick={() => setShowMobileMenu(false)} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
                <NavItem 
                  icon={
                    <div className="relative">
                      <MessageSquare />
                      {unreadMessages > 0 && (
                        <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                          {unreadMessages}
                        </span>
                      )}
                    </div>
                  } 
                  label="Comms" 
                  active={activeTab === 'messages'} 
                  onClick={() => { setActiveTab('messages'); setShowMobileMenu(false); }} 
                />
                <NavItem icon={<Search />} label="Search" active={activeTab === 'search'} onClick={() => { setActiveTab('search'); setShowMobileMenu(false); }} />
                <NavItem icon={<Globe />} label="Universes" active={activeTab === 'universes'} onClick={() => { setActiveTab('universes'); fetchUniverses(); setShowMobileMenu(false); }} />
                <NavItem icon={<UserCheck />} label="Following" active={activeTab === 'following'} onClick={() => { setActiveTab('following'); setShowMobileMenu(false); }} />
                <NavItem icon={<UserPlus />} label="Add Character" active={activeTab === 'explore'} onClick={() => { setActiveTab('explore'); setShowMobileMenu(false); }} />
                <NavItem icon={<BookOpen />} label="Arcs" active={activeTab === 'arcs'} onClick={() => { setActiveTab('arcs'); fetchArcs(true); setShowMobileMenu(false); }} />
                {loggedInUser?.role === 'admin' && (
                  <NavItem icon={<Users />} label="Relationships" active={activeTab === 'relationships'} onClick={() => { setActiveTab('relationships'); fetchRelationshipChecks(true); setShowMobileMenu(false); }} />
                )}
                <NavItem icon={<Calendar />} label="FauxPast" active={activeTab === 'fauxpast'} onClick={() => { setActiveTab('fauxpast'); setShowMobileMenu(false); }} />
                <NavItem icon={<Settings />} label="Settings" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); fetchApiLogs(); setShowMobileMenu(false); }} />
              </div>
              <div className="p-4 border-t border-white/10">
                <div 
                  onClick={() => { handleEditProfile(loggedInUser); setShowMobileMenu(false); }}
                  className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-xl cursor-pointer transition duration-200 mb-4"
                >
                  <div className={`w-10 h-10 bg-slate-800 ${getAvatarShape(loggedInUser?.account_type)} flex-shrink-0 flex items-center justify-center font-bold overflow-hidden border border-white/10`}>
                    {loggedInUser?.avatar_url ? (
                      <img src={loggedInUser.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      loggedInUser?.display_name?.[0] || 'Y'
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-bold text-sm truncate text-slate-200">{loggedInUser?.display_name || 'You'}</p>
                    <p className="text-slate-500 text-xs truncate">@{loggedInUser?.username || 'real_user'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setLoggedInUser(null);
                    localStorage.removeItem(SESSION_KEY);
                    setShowMobileMenu(false);
                  }}
                  className="w-full py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition font-medium border border-red-500/20"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right Sidebar */}
        <CharacterSidebar 
          apiFetch={apiFetch}
          handleViewProfile={handleViewProfile}
          isUserOnline={isUserOnline}
          handleFollow={handleFollow}
          activeChat={activeChat}
          isGroupChat={isGroupChat}
          setActiveTab={setActiveTab}
          setActiveChat={setActiveChat}
          fetchChatMessages={fetchChatMessages}
          handleEditProfile={handleEditProfile}
          exploreUsers={exploreUsers}
          exploreOffset={exploreOffset}
          hasMoreExplore={hasMoreExplore}
          isFetchingExplore={isFetchingExplore}
          fetchExploreUsers={fetchExploreUsers}
          characterSearch={characterSearch}
          setCharacterSearch={setCharacterSearch}
        />

        {/* Viewing Post Modal */}
        {viewingPostData && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative shadow-2xl">
              <button onClick={() => setViewingPostData(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10 bg-slate-800/50 p-2 rounded-full backdrop-blur-sm border border-white/10">
                <X size={24} />
              </button>
              <div className="p-6 pt-12">
                <PostItem 
                  apiFetch={apiFetch}
                  loggedInUser={loggedInUser}
                  post={viewingPostData} 
                  onLike={handleLike} 
                  onViewProfile={(id) => { setViewingPostData(null); handleViewProfile(id); }}
                  onShowLikers={handleShowLikers}
                  formatTimestamp={formatTimestamp}
                  onRefresh={() => handleViewPost(viewingPostData.id)}
                  onDelete={() => { setViewingPostData(null); fetchPosts(); }}
                  onViewApiLogs={handleViewApiLogs}
                  users={users}
                />
              </div>
            </div>
          </div>
        )}

        {/* Viewing Profile Modal */}
        {viewingProfile && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative shadow-2xl">
              <button onClick={() => setViewingProfile(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10 bg-slate-800/50 p-2 rounded-full backdrop-blur-sm border border-white/10">
                <X size={24} />
              </button>
              
              <div className="h-32 bg-gradient-to-r from-orange-500 to-yellow-500 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
              </div>
              <div className="px-6 pb-6">
                <div className="relative -mt-12 mb-4">
                  <div className={`relative w-24 h-24 ${getAvatarShape(viewingProfile.account_type)} border-4 border-slate-900 bg-slate-800 overflow-hidden shadow-xl`}>
                    {viewingProfile.avatar_url ? <img src={viewingProfile.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={48} className="m-auto mt-4 text-slate-500" />}
                  </div>
                  {viewingProfile.is_ai === 1 && (
                    <div className={`absolute bottom-1 left-1 w-6 h-6 rounded-full border-4 border-slate-900 ${isUserOnline(viewingProfile) ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.8)]' : 'bg-slate-500'}`} title={isUserOnline(viewingProfile) ? 'Online' : 'Offline'}></div>
                  )}
                </div>
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-1">
                        {viewingProfile.display_name}
                        <VerifiedBadge user={viewingProfile} size={20} />
                      </h2>
                      {viewingProfile.is_ai === 1 && (
                        <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full ${isUserOnline(viewingProfile) ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'}`}>
                          {isUserOnline(viewingProfile) ? 'Online' : 'Offline'}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500">@{viewingProfile.username}</p>
                    {viewingProfile.universe_id && universes.find(u => u.id === viewingProfile.universe_id) && (
                      <div 
                        onClick={() => handleViewUniverse(viewingProfile.universe_id)}
                        className="flex items-center gap-2 mt-2 text-sm text-orange-400 hover:text-orange-300 cursor-pointer w-fit bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20 transition-colors"
                      >
                        <Globe size={14} />
                        {universes.find(u => u.id === viewingProfile.universe_id)?.name}
                      </div>
                    )}
                  </div>
                  {viewingProfile.id !== loggedInUser?.id && (
                    <div className="flex gap-2">
                      {(viewingProfile.is_ai === 1 || loggedInUser?.role === 'admin') && (
                        <button 
                          onClick={() => {
                            setViewingProfile(null);
                            handleEditProfile(viewingProfile);
                          }}
                          className="font-bold px-4 py-2 rounded-full transition-colors bg-slate-800 text-slate-100 hover:bg-slate-700 flex items-center gap-2 border border-white/10"
                        >
                          <Settings size={16} /> Edit
                        </button>
                      )}
                      <button 
                        onClick={() => handleFollow(viewingProfile.id)}
                        className={`font-bold px-6 py-2 rounded-full transition-colors border ${viewingProfile.is_followed ? 'bg-slate-800 text-slate-100 border-white/10 hover:bg-slate-700' : 'bg-slate-100 text-slate-900 border-transparent hover:bg-slate-200'}`}
                      >
                        {viewingProfile.is_followed ? 'Following' : 'Follow'}
                      </button>
                      <button 
                        onClick={() => {
                          setActiveTab('messages');
                          const existingChat = conversations.find(c => c.other_user.id === viewingProfile.id);
                          if (existingChat) {
                            setActiveChat(existingChat);
                            setIsGroupChat(false);
                            const isAlreadyOpen = activeChat?.id === existingChat.id && !isGroupChat;
                            fetchChatMessages(existingChat.id, false, undefined, isAlreadyOpen);
                          } else {
                            setActiveChat({ id: viewingProfile.id, other_user: viewingProfile } as any);
                            setIsGroupChat(false);
                            setChatMessages([]);
                          }
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold px-6 py-2 rounded-full transition-colors border border-white/10"
                      >
                        Message
                      </button>
                    </div>
                  )}
                </div>
                
                <p className="mb-4 whitespace-pre-wrap text-slate-300">{viewingProfile.bio}</p>
                
                {viewingProfile.account_type === 'company' && (
                  <div className="mb-4 space-y-2 text-sm bg-slate-950/50 p-4 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2 text-orange-400 font-bold mb-2">
                      <Briefcase size={16} /> Company Account
                    </div>
                    {viewingProfile.brand_identity && (
                      <p><span className="text-slate-500">Brand Identity:</span> <span className="text-slate-300">{viewingProfile.brand_identity}</span></p>
                    )}
                    {viewingProfile.products_services && (
                      <p><span className="text-slate-500">Products/Services:</span> <span className="text-slate-300">{viewingProfile.products_services}</span></p>
                    )}
                    {viewingProfile.target_audience && (
                      <p><span className="text-slate-500">Target Audience:</span> <span className="text-slate-300">{viewingProfile.target_audience}</span></p>
                    )}
                    {viewingProfile.run_by_character_id && users.find(u => u.id === viewingProfile.run_by_character_id) && (
                      <p className="mt-2 pt-2 border-t border-white/10">
                        <span className="text-slate-500">Run by:</span>{' '}
                        <span 
                          className="text-orange-400 hover:text-orange-300 hover:underline cursor-pointer transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewProfile(viewingProfile.run_by_character_id);
                          }}
                        >
                          {users.find(u => u.id === viewingProfile.run_by_character_id)?.display_name}
                        </span>
                      </p>
                    )}
                  </div>
                )}
                
                {(viewingProfile.account_type === 'news' || viewingProfile.account_type === 'faux_news') && (
                  <div className="mb-4 space-y-2 text-sm bg-slate-950/50 p-4 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2 text-orange-400 font-bold mb-2">
                      <Globe size={16} /> {viewingProfile.account_type === 'faux_news' ? 'Platform News Account' : 'Universe News Account'}
                    </div>
                    <p className="text-slate-400">
                      {viewingProfile.account_type === 'faux_news' 
                        ? 'This account provides platform-wide news recaps thrice daily.' 
                        : 'This account provides daily news updates for its universe.'}
                    </p>
                  </div>
                )}
                
                <div className="flex gap-4 text-sm text-slate-500 mb-6">
                  <span 
                    className="cursor-pointer hover:text-slate-300 transition-colors"
                    onClick={async () => {
                      const res = await apiFetch(`/api/users/${viewingProfile.id}/following`);
                      const data = await res.json();
                      setFollowersModal({ users: data, title: 'Following' });
                    }}
                  >
                    <strong className="text-slate-100">{viewingProfile.following_count || 0}</strong> Following
                  </span>
                  <span 
                    className="cursor-pointer hover:text-slate-300 transition-colors"
                    onClick={async () => {
                      const res = await apiFetch(`/api/users/${viewingProfile.id}/followers`);
                      const data = await res.json();
                      setFollowersModal({ users: data, title: 'Followers' });
                    }}
                  >
                    <strong className="text-slate-100">{viewingProfile.follower_count || 0}</strong> Followers
                  </span>
                </div>

                {viewingProfile.is_ai === 1 && (
                  <div className="mb-6 p-4 bg-slate-900/50 rounded-xl border border-white/10 backdrop-blur-sm">
                    <h4 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
                      <Sparkles size={14} /> AI Controls
                    </h4>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleForcePost('text')}
                        disabled={isForcingPost}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 text-sm font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2 border border-white/10"
                      >
                        {isForcingPost ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                        {(viewingProfile.account_type === 'news' || viewingProfile.account_type === 'faux_news') ? 'Force Recap' : 'Force Text Post'}
                      </button>
                      {viewingProfile.account_type !== 'news' && viewingProfile.account_type !== 'faux_news' && (
                        <button 
                          onClick={() => handleForcePost('image')}
                          disabled={isForcingPost}
                          className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 text-sm font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2 border border-white/10"
                        >
                          {isForcingPost ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                          Force Image Post
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="border-b border-white/10 mb-4 flex gap-6">
                  <button 
                    onClick={() => setProfileActiveTab('posts')}
                    className={`pb-2 font-bold transition-colors ${profileActiveTab === 'posts' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Posts
                  </button>
                  <button 
                    onClick={() => setProfileActiveTab('images')}
                    className={`pb-2 font-bold transition-colors ${profileActiveTab === 'images' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Images
                  </button>
                  {viewingProfile.is_ai === 1 && viewingProfile.account_type !== 'news' && (
                    <button 
                      onClick={() => setProfileActiveTab('arcs')}
                      className={`pb-2 font-bold transition-colors ${profileActiveTab === 'arcs' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Character Arcs
                    </button>
                  )}
                </div>

                <div className="mt-6">
                  {profileActiveTab === 'posts' ? (
                    <div className="space-y-4">
                      {isFetchingProfileData ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                          <Loader2 className="animate-spin mb-2" size={32} />
                          <p>Loading posts...</p>
                        </div>
                      ) : (
                        <>
                          {viewingProfilePosts.slice(0, visibleProfilePosts).map(post => (
                            <PostItem 
                              apiFetch={apiFetch}
                              loggedInUser={loggedInUser}
                              key={post.id} 
                              post={{...post, display_name: viewingProfile.display_name, username: viewingProfile.username, avatar_url: viewingProfile.avatar_url}} 
                              onLike={handleLike} 
                              onViewProfile={handleViewProfile}
                              onShowLikers={handleShowLikers}
                              formatTimestamp={formatTimestamp}
                              onRefresh={() => handleViewProfile(viewingProfile.id)}
                              onDelete={(id) => {
                                setViewingProfilePosts(prev => prev.filter(p => p.id !== id));
                                fetchPosts();
                              }}
                              onViewApiLogs={handleViewApiLogs}
                              users={users}
                            />
                          ))}
                          {viewingProfilePosts.length > visibleProfilePosts && (
                            <div className="flex justify-center py-4">
                              <button 
                                onClick={() => setVisibleProfilePosts(prev => prev + 30)}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold py-2 px-4 rounded-full transition-colors border border-white/10"
                              >
                                Load More
                              </button>
                            </div>
                          )}
                          {viewingProfilePosts.length === 0 && <p className="text-center text-slate-500 py-4">No posts yet.</p>}
                        </>
                      )}
                    </div>
                  ) : profileActiveTab === 'images' ? (
                    <div className="space-y-4">
                      {isFetchingProfileData ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                          <Loader2 className="animate-spin mb-2" size={32} />
                          <p>Loading images...</p>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {viewingProfilePosts.filter(p => p.post_type === 'image_post' && p.image_url).map(post => (
                              <div key={post.id} className="aspect-square bg-slate-900 rounded-lg overflow-hidden border border-white/10 cursor-pointer group relative" onClick={() => handleViewPost(post.id)}>
                                <img src={post.image_url} alt="Post image" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <div className="flex gap-4 text-white font-bold">
                                    <span className="flex items-center gap-1"><Heart size={16} className={post.is_liked ? "fill-orange-500 text-orange-500" : ""} /> {post.like_count || 0}</span>
                                    <span className="flex items-center gap-1"><MessageCircle size={16} /> {post.comment_count || 0}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          {viewingProfilePosts.filter(p => p.post_type === 'image_post' && p.image_url).length === 0 && (
                            <div className="text-center py-12 text-slate-500">
                              <Camera size={48} className="mx-auto mb-4 opacity-20" />
                              <p>No images posted yet.</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {loggedInUser?.role === 'admin' && (() => {
                        const isPaused = universes.find(u => u.id === viewingProfile?.universe_id)?.is_paused;
                        return (
                          <div className="flex gap-2 mb-4">
                            <button 
                              onClick={() => handleAddArc('character', viewingProfile.id)}
                              disabled={isPaused}
                              title={isPaused ? "Cannot add arcs to a character in a paused universe" : ""}
                              className="flex items-center gap-2 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Plus size={14} /> Add Manual Arc
                            </button>
                            <button 
                              onClick={() => handleGenerateArc('character', viewingProfile.id)}
                              disabled={isGeneratingArc || isPaused}
                              title={isPaused ? "Cannot generate arcs for a character in a paused universe" : ""}
                              className="flex items-center gap-2 text-xs bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-500/30 px-3 py-1.5 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Sparkles size={14} /> {isGeneratingArc ? 'Generating...' : 'Generate AI Arc'}
                            </button>
                          </div>
                        );
                      })()}
                      {viewingProfileArcs.length === 0 ? (
                        <p className="text-center text-slate-500 py-4">No arcs yet.</p>
                      ) : (
                        viewingProfileArcs.map(arc => (
                          <div key={arc.id} className="bg-slate-900/50 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="font-bold text-lg text-slate-100">{arc.title}</h3>
                              <div className="flex items-center gap-2">
                                {loggedInUser?.role === 'admin' && (
                                  <div className="flex gap-1 mr-2">
                                    <button 
                                      onClick={() => handleEditArc(arc)}
                                      className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-blue-400 transition-colors border border-white/10"
                                      title="Edit Arc"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteArc(arc)}
                                      className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-red-400 transition-colors border border-white/10"
                                      title="Delete Arc"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                )}
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${arc.status === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-slate-800 text-slate-400 border border-white/10'}`}>
                                  {arc.status.toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <p className="text-slate-400 text-sm mb-4 whitespace-pre-wrap">{arc.description}</p>
                            {arc.status === 'completed' && arc.completion_summary && (
                              <div className="mt-4 p-3 bg-slate-950/50 rounded-lg border border-white/10">
                                <p className="text-xs font-bold text-orange-500 mb-1">Conclusion</p>
                                <p className="text-sm text-slate-300">{arc.completion_summary}</p>
                              </div>
                            )}
                            <div className="mt-4 flex gap-4 text-xs text-slate-500">
                              <span>Started: {new Date(arc.start_date).toLocaleDateString()}</span>
                              <span>Target End: {new Date(arc.target_end_date).toLocaleDateString()}</span>
                            </div>
                            {renderArcHistory(arc)}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Likers Modal */}
        {likersModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[70vh] shadow-2xl">
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-900/80 backdrop-blur-md">
                <h3 className="font-bold text-slate-100">Liked by</h3>
                <button onClick={() => setLikersModal(null)} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {likersModal.users.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-3 hover:bg-slate-800/50 rounded-xl cursor-pointer transition-colors" onClick={() => { handleViewProfile(u.id); setLikersModal(null); }}>
                    <div className={`w-10 h-10 bg-slate-800 ${getAvatarShape(u.account_type)} overflow-hidden border border-white/10`}>
                      {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={20} className="m-auto mt-2 text-slate-500" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-100">{u.display_name}</p>
                      <p className="text-slate-500 text-xs">@{u.username}</p>
                    </div>
                  </div>
                ))}
                {likersModal.users.length === 0 && <p className="text-center text-slate-500 py-8">No likes yet.</p>}
              </div>
            </div>
          </div>
        )}

        {/* Followers/Following Modal */}
        {followersModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[70vh] shadow-2xl">
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-900/80 backdrop-blur-md">
                <h3 className="font-bold text-slate-100">{followersModal.title}</h3>
                <button onClick={() => setFollowersModal(null)} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {followersModal.users.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-3 hover:bg-slate-800/50 rounded-xl cursor-pointer transition-colors" onClick={() => { handleViewProfile(u.id); setFollowersModal(null); }}>
                    <div className={`w-10 h-10 bg-slate-800 ${getAvatarShape(u.account_type)} overflow-hidden border border-white/10`}>
                      {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={20} className="m-auto mt-2 text-slate-500" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-100">{u.display_name}</p>
                      <p className="text-slate-500 text-xs">@{u.username}</p>
                    </div>
                  </div>
                ))}
                {followersModal.users.length === 0 && <p className="text-center text-slate-500 py-8">No users found.</p>}
              </div>
            </div>
          </div>
        )}

        {/* API Logs Modal */}
      {showApiLogsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2 text-blue-400">
                <MessageSquare size={24} />
                API Logs
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => fetchApiLogs(apiLogSearch)}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded-lg transition-colors border border-white/10"
                >
                  Refresh Logs
                </button>
                <button onClick={() => setShowApiLogsModal(false)} className="text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
              </div>
            </div>
            
            <div className="mb-4 flex gap-2">
              <input 
                type="text" 
                value={apiLogSearch} 
                onChange={(e) => setApiLogSearch(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && fetchApiLogs(apiLogSearch)}
                placeholder="Search logs by content..." 
                className="flex-1 bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 backdrop-blur-sm placeholder-slate-500"
              />
              <button 
                onClick={() => fetchApiLogs(apiLogSearch)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition-colors shadow-lg shadow-blue-500/20"
              >
                Search
              </button>
              <button
                onClick={() => {
                  const newErrorOnly = !apiLogShowErrorsOnly;
                  setApiLogShowErrorsOnly(newErrorOnly);
                  fetchApiLogs(apiLogSearch, newErrorOnly);
                }}
                className={`${apiLogShowErrorsOnly ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/20' : 'bg-slate-800 hover:bg-slate-700 border border-white/10'} text-white px-4 py-2 rounded-lg text-sm transition-colors`}
              >
                Errors Only
              </button>
              {apiLogSearch && (
                <button 
                  onClick={() => { setApiLogSearch(''); fetchApiLogs(''); }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-100 px-4 py-2 rounded-lg text-sm transition-colors border border-white/10"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-2">
              {apiLogs.length === 0 ? (
                <div className="text-center text-slate-500 py-8">No API logs found.</div>
              ) : (
                apiLogs.map((log: any) => {
                  let requestObj: any = {};
                  let isError = false;
                  try {
                    requestObj = JSON.parse(log.request_payload);
                    if (requestObj.error) isError = true;
                  } catch (e) {}
                  
                  if (log.response_payload && (log.response_payload.includes('Error:') || log.response_payload.includes('"error"'))) {
                    isError = true;
                  }
                  
                  const isExpanded = !!expandedLogs[log.id];
                  
                  return (
                    <div key={log.id} className={`bg-slate-900/50 rounded-xl text-xs font-mono border ${isError ? 'border-red-500/30' : 'border-green-500/30'} overflow-hidden transition-colors backdrop-blur-sm`}>
                      <div 
                        className={`p-3 flex justify-between items-center cursor-pointer transition-colors ${isError ? 'bg-red-500/10 hover:bg-red-500/20' : 'bg-green-500/10 hover:bg-green-500/20'}`}
                        onClick={() => toggleLogExpansion(log.id)}
                      >
                        <div className="flex items-center gap-3">
                          {log.user_profile_picture ? (
                            <img src={log.user_profile_picture} alt={log.user_display_name} className={`w-8 h-8 ${getAvatarShape(log.user_account_type)} object-cover border border-white/10`} />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 border border-white/10">
                              <User size={16} />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-100 text-sm flex items-center gap-2">
                              {log.endpoint}
                              {isError && <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider">Error</span>}
                            </div>
                            <div className="text-slate-400 text-[10px]">{log.user_display_name || 'System'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] opacity-60 text-slate-400">{formatTimestamp(log.created_at)}</span>
                          <span className="text-slate-500">{isExpanded ? '▼' : '▶'}</span>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-4 border-t border-white/10 bg-slate-950/50">
                          <div className="mb-3 space-y-1">
                            <div className="text-slate-500 uppercase text-[9px] tracking-wider font-bold">Request Details</div>
                            <div className="bg-black/30 p-2 rounded border border-white/5 overflow-x-auto whitespace-pre-wrap">
                              {Object.entries(requestObj).map(([key, val]) => (
                                <div key={key} className="mb-1 last:mb-0">
                                  <span className="text-orange-400">{key}:</span> <span className="text-slate-300">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-slate-500 uppercase text-[9px] tracking-wider font-bold">Response</div>
                            {(() => {
                              try {
                                const resObj = JSON.parse(log.response_payload);
                                return (
                                  <div className="space-y-2">
                                    {resObj.reasoning && (
                                      <div className="bg-blue-900/10 border border-blue-500/20 p-2 rounded">
                                        <div className="text-[10px] text-blue-400 font-bold mb-1 uppercase tracking-tighter">Thinking / Reasoning</div>
                                        <div className="text-slate-400 italic">{resObj.reasoning}</div>
                                      </div>
                                    )}
                                    <div className={`p-2 rounded border ${!resObj.content ? 'bg-red-900/20 border-red-500/30 text-red-200' : 'bg-green-900/20 border-green-500/30 text-green-200'} whitespace-pre-wrap overflow-x-auto`}>
                                      <div className="text-[10px] opacity-50 font-bold mb-1 uppercase tracking-tighter">Final Output</div>
                                      {resObj.content || "Empty Response"}
                                    </div>
                                  </div>
                                );
                              } catch (e) {
                                return (
                                  <div className="bg-red-900/20 border border-red-500/30 text-red-200 p-2 rounded whitespace-pre-wrap overflow-x-auto">
                                    {log.response_payload}
                                  </div>
                                );
                              }
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateGroupModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-100">Create Group Chat</h3>
                <button onClick={() => setShowCreateGroupModal(false)} className="text-slate-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Group Name</label>
                  <input 
                    type="text" 
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-orange-500 backdrop-blur-sm placeholder-slate-500 text-slate-100"
                    placeholder="Enter group name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Select Members</label>
                  <input
                    type="text"
                    value={groupSearchQuery}
                    onChange={e => setGroupSearchQuery(e.target.value)}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2 mb-2 outline-none focus:border-orange-500 text-sm backdrop-blur-sm placeholder-slate-500 text-slate-100"
                    placeholder="Search characters..."
                  />
                  <div className="max-h-60 overflow-y-auto space-y-2 border border-white/10 rounded-xl p-2 bg-slate-950/50">
                    {users.filter(u => u.id !== loggedInUser?.id && u.display_name.toLowerCase().includes(groupSearchQuery.toLowerCase())).map(user => (
                      <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-slate-800/50 rounded-lg cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedGroupMembers.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedGroupMembers(prev => [...prev, user.id]);
                            } else {
                              setSelectedGroupMembers(prev => prev.filter(id => id !== user.id));
                            }
                          }}
                          className="w-5 h-5 rounded border-white/10 text-orange-500 focus:ring-orange-500 bg-slate-900"
                        />
                        <div className={`relative w-8 h-8 bg-slate-800 ${getAvatarShape(user.account_type)} flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/10`}>
                          {user.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={16} className="text-slate-500" />}
                          {user.is_ai === 1 ? (
                            <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-slate-900 ${isUserOnline(user) ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]' : 'bg-slate-500'}`} title={isUserOnline(user) ? 'Online' : 'Offline'}></div>
                          ) : (
                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-slate-900 bg-blue-500" title="Real User"></div>
                          )}
                        </div>
                        <span className="font-medium text-slate-100">{user.display_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button 
                  onClick={handleCreateGroupChat}
                  disabled={!newGroupName.trim() || selectedGroupMembers.length === 0}
                  className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border disabled:border-white/10 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-orange-500/20 disabled:shadow-none"
                >
                  Create Group
                </button>
              </div>
            </div>
          </div>
        )}

        {expandedImageUrl && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4"
            onClick={() => setExpandedImageUrl(null)}
          >
            <img 
              src={expandedImageUrl} 
              alt="Expanded image" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
              referrerPolicy="no-referrer" 
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              className="absolute top-4 right-4 text-white bg-slate-900/50 hover:bg-slate-800/80 rounded-full p-2 transition-colors border border-white/10 backdrop-blur-sm"
              onClick={() => setExpandedImageUrl(null)}
            >
              <X size={24} />
            </button>
          </div>
        )}

        {showGallery && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
              <div className="flex justify-between items-center p-4 border-b border-white/10 bg-slate-900/80 backdrop-blur-md">
                <h3 className="font-bold text-xl flex items-center gap-2 text-slate-100"><Image size={24} /> Gallery</h3>
                <button onClick={() => setShowGallery(false)} className="text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                {isFetchingGallery ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <Loader2 className="animate-spin mb-2" size={32} />
                    <p>Loading gallery...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {galleryImages.map((msg, idx) => (
                      <div key={idx} className="aspect-square rounded-lg overflow-hidden border border-white/10 cursor-pointer hover:border-orange-500 transition-colors shadow-lg" onClick={() => setExpandedImageUrl(msg.image_url)}>
                        <img src={msg.image_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    ))}
                    {galleryImages.length === 0 && (
                      <div className="col-span-full text-center text-slate-500 py-8">No images in this chat yet.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-4 p-3 rounded-full cursor-pointer transition-colors duration-200 w-fit xl:w-full ${active ? 'font-bold text-orange-500 bg-orange-500/10' : 'hover:bg-slate-900/50 text-slate-300 hover:text-slate-100'}`}
    >
      <div className="text-2xl">{icon}</div>
      <span className="text-xl hidden xl:block">{label}</span>
    </div>
  );
}

function renderContentWithTags(content: string, users: any[] | undefined, onViewProfile: (id: number) => void) {
  if (!content) return null;
  
  // Split by @username pattern (including word characters)
  const parts = content.split(/(@\w+)/g);
  
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const username = part.substring(1);
      const user = users?.find(u => u.username.toLowerCase() === username.toLowerCase());
      
      if (user) {
        return (
          <span 
            key={i} 
            onClick={(e) => { e.stopPropagation(); onViewProfile(user.id); }} 
            className="text-orange-500 hover:underline cursor-pointer font-bold transition-colors"
          >
            {part}
          </span>
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}

const FauxPicItem = React.memo(function FauxPicItem({ post, onLike, onViewProfile, onShowLikers, formatTimestamp, onRefresh, users, loggedInUser, apiFetch }: { post: any, onLike: () => void, onViewProfile: (id: number) => void, onShowLikers: (type: 'post' | 'comment', id: number) => void, formatTimestamp: (ts: string) => string, onRefresh: () => void, users?: any[], loggedInUser?: any, apiFetch: any }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [isFetchingComments, setIsFetchingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  const fetchComments = useCallback(async () => {
    setIsFetchingComments(true);
    try {
      const r = await apiFetch(`/api/posts/${post.id}/comments`);
      const data = await r.json();
      setComments(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingComments(false);
    }
  }, [post.id, apiFetch]);

  useEffect(() => {
    if (showComments) {
      fetchComments();
      const interval = setInterval(fetchComments, 30000); // 30s instead of 10s
      return () => clearInterval(interval);
    }
  }, [showComments, fetchComments]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSendingComment) return;
    setIsSendingComment(true);
    
    // Optimistic update
    const tempId = Date.now();
    const newCommentObj = {
      id: tempId,
      post_id: post.id,
      user_id: loggedInUser?.id || 1,
      content: newComment,
      created_at: new Date().toISOString(),
      username: loggedInUser?.username || 'user',
      display_name: loggedInUser?.display_name || 'User',
      avatar_url: loggedInUser?.avatar_url,
      account_type: loggedInUser?.account_type || 'character',
      like_count: 0,
      is_liked: 0
    };
    
    setComments(prev => [...prev, newCommentObj]);
    setNewComment('');
    
    try {
      await apiFetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newCommentObj.content })
      });
      fetchComments();
      onRefresh();
    } catch (e) {
      // Revert on failure
      fetchComments();
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleCommentLike = async (commentId: number) => {
    // Optimistic update
    setComments(prev => prev.map(c => {
      if (c.id === commentId) {
        const isLiked = c.is_liked;
        return {
          ...c,
          is_liked: isLiked ? 0 : 1,
          like_count: isLiked ? c.like_count - 1 : c.like_count + 1
        };
      }
      return c;
    }));
    
    try {
      await apiFetch(`/api/comments/${commentId}/like`, { method: 'POST' });
    } catch (e) {
      // Revert on failure
      fetchComments();
    }
  };

  const handleAddReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || isSendingReply || !replyingTo) return;
    setIsSendingReply(true);
    
    // Optimistic update
    const tempId = Date.now();
    const newReplyObj = {
      id: tempId,
      post_id: post.id,
      user_id: loggedInUser?.id || 1,
      parent_id: replyingTo.id,
      content: replyContent,
      created_at: new Date().toISOString(),
      username: loggedInUser?.username || 'user',
      display_name: loggedInUser?.display_name || 'User',
      avatar_url: loggedInUser?.avatar_url,
      account_type: loggedInUser?.account_type || 'character',
      like_count: 0,
      is_liked: 0
    };
    
    setComments(prev => [...prev, newReplyObj]);
    setReplyContent('');
    setReplyingTo(null);
    
    try {
      await apiFetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newReplyObj.content, parent_id: newReplyObj.parent_id })
      });
      fetchComments();
    } catch (e) {
      // Revert on failure
      fetchComments();
    } finally {
      setIsSendingReply(false);
    }
  };

  const rootComments = comments.filter(c => !c.parent_id);

  return (
    <div className="bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
      <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => onViewProfile(post.user_id)}>
        <img src={post.avatar_url} alt="" className={`w-8 h-8 ${getAvatarShape(post.account_type)} object-cover border border-white/10`} />
        <span className="font-bold text-sm hover:underline text-slate-100 flex items-center gap-1">
          {post.display_name}
          <VerifiedBadge user={post} size={14} />
        </span>
      </div>
      <div className="bg-slate-950 flex items-center justify-center min-h-[300px] border-y border-white/5">
        <img 
          src={post.image_url || post.content.match(/\((.*?)\)/)?.[1] || `https://picsum.photos/seed/${post.id}/800/800`} 
          alt="FauxPic" 
          className="w-full h-auto max-h-[80vh] object-contain" 
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="p-4">
        <div className="flex gap-4 mb-3 items-center">
          <div className="flex items-center gap-2">
            <button onClick={onLike} className="hover:scale-110 transition-transform">
              <Heart className={post.is_liked ? "fill-red-500 text-red-500" : "text-slate-300 hover:text-white"} size={24} />
            </button>
            {post.like_count > 0 && (
              <button onClick={() => onShowLikers('post', post.id)} className="text-sm font-bold hover:underline text-slate-300">{post.like_count}</button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowComments(!showComments)} className="hover:scale-110 transition-transform">
              <MessageCircle size={24} className={showComments ? "text-orange-500" : "text-slate-300 hover:text-white"} />
            </button>
            {post.comment_count > 0 && (
              <span className="text-sm font-bold text-slate-300">{post.comment_count}</span>
            )}
          </div>
          <Send size={24} className="text-slate-300 hover:text-white cursor-pointer hover:scale-110 transition-transform" />
        </div>
        <p className="text-sm text-slate-300">
          <span className="font-bold mr-2 cursor-pointer hover:underline text-slate-100" onClick={() => onViewProfile(post.user_id)}>{post.display_name}</span>
          {renderContentWithTags(post.content.replace(/\(.*?\)/g, '').trim(), users, onViewProfile)}
        </p>
        <p className="text-xs text-slate-500 mt-2 uppercase tracking-tighter">
          {formatTimestamp(post.created_at)}
        </p>

        {showComments && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
            <div className="max-h-[400px] overflow-y-auto space-y-4 pr-2">
              {rootComments.length > 0 && isFetchingComments && (
                <div className="flex justify-center py-2">
                  <Loader2 className="animate-spin text-orange-500/50" size={16} />
                </div>
              )}
              {rootComments.length === 0 ? (
                isFetchingComments ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="animate-spin text-orange-500" size={24} />
                  </div>
                ) : (
                  <p className="text-slate-500 text-xs italic">No comments yet</p>
                )
              ) : (
                rootComments.map(comment => (
                  <CommentItem 
                    key={comment.id}
                    comment={comment}
                    apiFetch={apiFetch}
                    loggedInUser={loggedInUser}
                    onLike={handleCommentLike}
                    onReply={(c) => setReplyingTo({ id: c.id, name: c.display_name })}
                    onViewProfile={onViewProfile}
                    onShowLikers={onShowLikers}
                    formatTimestamp={formatTimestamp}
                    onRefresh={fetchComments}
                    onDelete={(id) => setComments(prev => prev.filter(c => c.id !== id && c.parent_id !== id))}
                    users={users}
                  />
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} className="flex gap-2 mt-4">
              <input 
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-transparent border-b border-white/10 py-1 text-sm outline-none focus:border-orange-500 text-slate-100 placeholder-slate-500"
              />
              <button type="submit" disabled={!newComment.trim()} className="text-orange-500 font-bold text-sm disabled:opacity-50 hover:text-orange-400 transition-colors">Post</button>
            </form>
          </div>
        )}
      </div>

      {replyingTo && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="font-bold mb-4 text-slate-100">Replying to @{replyingTo.name}</h3>
            <form onSubmit={handleAddReply}>
              <TagTextarea 
                users={users || []}
                autoFocus
                value={replyContent}
                onValueChange={setReplyContent}
                className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-slate-100 outline-none focus:border-orange-500 mb-4 backdrop-blur-sm placeholder-slate-500"
                rows={4}
                placeholder="Write your reply..."
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setReplyingTo(null)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={!replyContent.trim() || isSendingReply} className="px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold transition-colors disabled:opacity-50 shadow-lg shadow-orange-500/20 disabled:shadow-none">Reply</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});

const PostItem = React.memo(function PostItem({ post, onLike, onViewProfile, onShowLikers, formatTimestamp, onRefresh, onDelete, highlightedPostId, highlightedCommentId, onHighlightClear, users, loggedInUser, apiFetch, onViewApiLogs }: { key?: any, post: any, onLike: (id: number) => void, onViewProfile: (id: number) => void, onShowLikers: (type: 'post' | 'comment', id: number) => void, formatTimestamp: (ts: string) => string, onRefresh: () => void, onDelete?: (id: number) => void, highlightedPostId?: number | null, highlightedCommentId?: number | null, onHighlightClear?: () => void, users?: any[], loggedInUser?: any, apiFetch: any, onViewApiLogs?: (content: string) => void }) {
  const [showComments, setShowComments] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [isFetchingComments, setIsFetchingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const postRef = React.useRef<HTMLDivElement>(null);
  const commentRefs = React.useRef<{ [key: number]: HTMLDivElement | null }>({});

  useEffect(() => {
    setEditContent(post.content);
  }, [post.content]);

  useEffect(() => {
    if (highlightedPostId === post.id) {
      if (highlightedCommentId) {
        if (!showComments) {
          setShowComments(true);
        } else {
          // If comments are already shown, just scroll to it
          setTimeout(() => {
            const commentEl = commentRefs.current[highlightedCommentId];
            if (commentEl) {
              commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
              postRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            if (onHighlightClear) setTimeout(onHighlightClear, 2000);
          }, 100);
        }
      } else {
        setTimeout(() => {
          postRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (onHighlightClear) setTimeout(onHighlightClear, 2000);
        }, 100);
      }
    }
  }, [highlightedPostId, highlightedCommentId, post.id, showComments]);

  const fetchComments = () => {
    setIsFetchingComments(true);
    apiFetch(`/api/posts/${post.id}/comments`)
      .then(r => r.json())
      .then(data => {
        setComments(data);
        setIsFetchingComments(false);
        if (highlightedPostId === post.id && highlightedCommentId) {
          setTimeout(() => {
            const commentEl = commentRefs.current[highlightedCommentId];
            if (commentEl) {
              commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
              postRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            if (onHighlightClear) setTimeout(onHighlightClear, 2000);
          }, 300);
        }
      })
      .catch(() => setIsFetchingComments(false));
  };

  useEffect(() => {
    if (showComments) {
      fetchComments();
      const interval = setInterval(() => {
        fetchComments();
      }, 30000); // 30s instead of 10s
      return () => clearInterval(interval);
    }
  }, [showComments, post.comment_count]);

  const handleDelete = async () => {
    // Optimistic update
    if (onDelete) {
      onDelete(post.id);
    } else {
      onRefresh();
    }
    try {
      await apiFetch(`/api/posts/${post.id}`, { method: 'DELETE' });
    } catch (e) {
      // Revert on failure
      onRefresh();
    }
  };

  const handleEdit = async () => {
    // Optimistic update
    const previousContent = post.content;
    post.content = editContent;
    setIsEditing(false);

    try {
      await apiFetch(`/api/posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent })
      });
      onRefresh();
    } catch (e) {
      // Revert on failure
      post.content = previousContent;
      onRefresh();
    }
  };

  const handleAddComment = async (e: React.FormEvent, parentId: number | null = null) => {
    e.preventDefault();
    const content = parentId ? replyingTo.content : newComment;
    if (!content.trim() || isSendingComment) return;
    
    setIsSendingComment(true);
    
    // Optimistic update
    const tempId = Date.now();
    const newCommentObj = {
      id: tempId,
      post_id: post.id,
      user_id: loggedInUser?.id || 1,
      parent_id: parentId,
      content: content,
      created_at: new Date().toISOString(),
      username: loggedInUser?.username || 'user',
      display_name: loggedInUser?.display_name || 'User',
      avatar_url: loggedInUser?.avatar_url,
      account_type: loggedInUser?.account_type || 'character',
      like_count: 0,
      is_liked: 0
    };
    
    setComments(prev => [...prev, newCommentObj]);
    
    if (parentId) {
      setReplyingTo(null);
    } else {
      setNewComment('');
    }
    
    try {
      await apiFetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, parent_id: parentId })
      });
      fetchComments();
    } catch (e) {
      // Revert on failure
      setComments(prev => prev.filter(c => c.id !== tempId));
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleCommentLike = async (commentId: number) => {
    // Optimistic update
    setComments(prev => prev.map(c => {
      if (c.id === commentId) {
        const isLiked = c.is_liked;
        return {
          ...c,
          is_liked: isLiked ? 0 : 1,
          like_count: isLiked ? c.like_count - 1 : c.like_count + 1
        };
      }
      return c;
    }));
    
    try {
      await apiFetch(`/api/comments/${commentId}/like`, { method: 'POST' });
    } catch (e) {
      // Revert on failure
      fetchComments();
    }
  };

  // Organize comments into threads
  const commentMap = new Map();
  comments.forEach(c => commentMap.set(c.id, { ...c, replies: [] }));
  const rootComments: any[] = [];
  comments.forEach(c => {
    if (c.parent_id && commentMap.has(c.parent_id)) {
      commentMap.get(c.parent_id).replies.push(commentMap.get(c.id));
    } else {
      rootComments.push(commentMap.get(c.id));
    }
  });

  return (
    <div 
      ref={postRef}
      className={`border-b border-white/10 p-4 hover:bg-slate-900/50 transition-colors ${highlightedPostId === post.id && !highlightedCommentId ? 'bg-orange-900/20 ring-2 ring-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : ''}`}
    >
      <div className="flex gap-4">
        <div 
          onClick={() => onViewProfile(post.user_id)}
          className={`w-10 h-10 bg-slate-800 ${getAvatarShape(post.account_type)} flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer border border-white/10`}
        >
          {post.avatar_url ? <img src={post.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={20} className="text-slate-500" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-2 flex-wrap cursor-pointer" onClick={() => onViewProfile(post.user_id)}>
              <span className="font-bold hover:underline text-slate-100 flex items-center gap-1">
                {post.display_name}
                <VerifiedBadge user={post} />
              </span>
              <span className="text-slate-500 text-sm">@{post.username}</span>
              <span className="text-slate-500 text-sm">· {formatTimestamp(post.created_at)}</span>
            </div>
            <button onClick={() => setShowMenu(!showMenu)} className="text-slate-500 hover:text-orange-500 transition-colors"><MoreHorizontal size={18} /></button>
            {showMenu && (
              <div className="absolute right-0 top-6 bg-slate-900 border border-white/10 rounded-lg shadow-2xl z-10 w-36 overflow-hidden backdrop-blur-md">
                <button onClick={() => { setIsEditing(true); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-800 transition-colors text-slate-300 hover:text-slate-100">Edit</button>
                <button onClick={() => { handleDelete(); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">Delete</button>
                {loggedInUser?.role === 'admin' && onViewApiLogs && (
                  <button onClick={() => { onViewApiLogs(post.content); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/10 transition-colors border-t border-white/10">View API Logs</button>
                )}
              </div>
            )}
          </div>
          {isEditing ? (
            <div className="mt-2">
              <TagTextarea 
                users={users || []}
                value={editContent} 
                onValueChange={setEditContent} 
                className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-2 text-slate-100 outline-none focus:border-orange-500 backdrop-blur-sm"
                rows={3}
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
                <button onClick={handleEdit} className="px-3 py-1 text-sm bg-orange-600 hover:bg-orange-500 text-white rounded-full transition-colors shadow-lg shadow-orange-500/20">Save</button>
              </div>
            </div>
          ) : (
            <div className="mt-1">
              <p className="whitespace-pre-wrap text-slate-300">
                {renderContentWithTags(
                  post.content.length > 1500 && !isExpanded 
                    ? post.content.substring(0, 1000) 
                    : post.content, 
                  users, 
                  onViewProfile
                )}
                {post.content.length > 1500 && !isExpanded && (
                  <button 
                    onClick={() => setIsExpanded(true)}
                    className="text-orange-500 hover:underline ml-1 font-bold text-sm transition-colors"
                  >
                    ... Read more
                  </button>
                )}
              </p>
            </div>
          )}

          {post.internal_thought && (
            <div className="mt-3 p-3 bg-slate-900/80 border-l-4 border-orange-500 rounded-r-lg text-sm italic text-slate-300 relative overflow-hidden group backdrop-blur-sm">
              <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Brain size={64} />
              </div>
              <div className="flex items-center gap-2 mb-1 text-orange-400 font-bold text-xs uppercase tracking-wider">
                <Brain size={14} />
                <span>Internal Monologue</span>
              </div>
              {post.internal_thought}
            </div>
          )}
          {post.image_url && (
            <>
              <div 
                className="mt-3 rounded-2xl overflow-hidden border border-white/10 bg-slate-950/50 flex items-center justify-center cursor-pointer shadow-lg hover:border-orange-500/50 transition-colors"
                onClick={() => setIsImageExpanded(true)}
              >
                <img src={post.image_url} alt="Post image" className="max-w-full max-h-[600px] object-contain" referrerPolicy="no-referrer" />
              </div>
              {isImageExpanded && (
                <div 
                  className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4"
                  onClick={() => setIsImageExpanded(false)}
                >
                  <img 
                    src={post.image_url} 
                    alt="Expanded post image" 
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
                    referrerPolicy="no-referrer" 
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button 
                    className="absolute top-4 right-4 text-white bg-slate-900/50 hover:bg-slate-800/80 rounded-full p-2 transition-colors border border-white/10 backdrop-blur-sm"
                    onClick={() => setIsImageExpanded(false)}
                  >
                    <X size={24} />
                  </button>
                </div>
              )}
            </>
          )}
          <div className="flex gap-12 mt-3 text-slate-500">
            <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 hover:text-orange-500 transition-colors">
              <MessageCircle size={18} />
              <span className="text-sm">{post.comment_count}</span>
            </button>
            <div className="flex items-center gap-1">
              <button onClick={() => onLike(post.id)} className={`flex items-center gap-2 hover:text-pink-500 transition-colors ${post.is_liked ? 'text-pink-500' : ''}`}>
                <Heart size={18} fill={post.is_liked ? "currentColor" : "none"} />
                <span className="text-sm">{post.like_count}</span>
              </button>
              {post.like_count > 0 && (
                <button onClick={() => onShowLikers('post', post.id)} className="text-[10px] hover:underline hover:text-slate-300 transition-colors">view</button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {showComments && (
        <div className="mt-4 pl-10 space-y-4 border-l-2 border-white/10 ml-5">
          {rootComments.length === 0 && isFetchingComments && (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-orange-500" size={24} />
            </div>
          )}
          {rootComments.map(comment => (
            <CommentItem 
              apiFetch={apiFetch}
              loggedInUser={loggedInUser}
              key={comment.id} 
              comment={comment} 
              onLike={handleCommentLike} 
              onReply={(c) => setReplyingTo({ id: c.id, name: c.display_name, content: '' })}
              onViewProfile={onViewProfile}
              onShowLikers={onShowLikers}
              formatTimestamp={formatTimestamp}
              onRefresh={fetchComments}
              onDelete={(id) => setComments(prev => prev.filter(c => c.id !== id && c.parent_id !== id))}
              highlightedCommentId={highlightedCommentId}
              commentRef={(id, el) => { commentRefs.current[id] = el; }}
              users={users}
              onViewApiLogs={onViewApiLogs}
            />
          ))}
          
          <form onSubmit={(e) => handleAddComment(e)} className="flex gap-2 mt-4 items-end">
            <div className="w-8 h-8 bg-slate-800 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xs mb-1 overflow-hidden border border-white/10">
              {loggedInUser?.avatar_url ? (
                <img src={loggedInUser?.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                loggedInUser?.display_name?.[0] || 'Y'
              )}
            </div>
            <div className="flex-1">
              <TagTextarea 
                users={users}
                value={newComment}
                onValueChange={setNewComment}
                placeholder="Post your reply" 
                className="w-full bg-transparent border-b border-white/10 pb-1 outline-none focus:border-orange-500 text-sm resize-none text-slate-100 placeholder-slate-500"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment(e);
                  }
                }}
              />
            </div>
            <button type="submit" disabled={!newComment.trim()} className="text-orange-500 font-bold text-sm disabled:opacity-50 mb-1 hover:text-orange-400 transition-colors">Reply</button>
          </form>
        </div>
      )}

      {replyingTo && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="font-bold mb-4 text-slate-100">Replying to @{replyingTo.name}</h3>
            <TagTextarea 
              users={users}
              autoFocus
              value={replyingTo.content}
              onValueChange={val => setReplyingTo({...replyingTo, content: val})}
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl p-3 text-slate-100 outline-none focus:border-orange-500 mb-4 backdrop-blur-sm placeholder-slate-500"
              placeholder="Write your reply..."
              rows={4}
            />
            <div className="flex gap-3">
              <button onClick={() => setReplyingTo(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold py-2 rounded-full transition-colors border border-white/10">Cancel</button>
              <button onClick={(e) => handleAddComment(e as any, replyingTo.id)} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 rounded-full transition-colors shadow-lg shadow-orange-500/20">Reply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

const CommentItem = React.memo(function CommentItem({ comment, onLike, onReply, onViewProfile, onShowLikers, formatTimestamp, onRefresh, onDelete, highlightedCommentId, commentRef, users, loggedInUser, apiFetch, onViewApiLogs }: { key?: any, comment: any, onLike: (id: number) => void, onReply: (c: any) => void, onViewProfile: (id: number) => void, onShowLikers: (type: 'post' | 'comment', id: number) => void, formatTimestamp: (ts: string) => string, onRefresh: () => void, onDelete?: (id: number) => void, highlightedCommentId?: number | null, commentRef?: (id: number, el: HTMLDivElement | null) => void, users?: any[], loggedInUser?: any, apiFetch: any, onViewApiLogs?: (content: string) => void }) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  useEffect(() => {
    setEditContent(comment.content);
  }, [comment.content]);

  const handleDelete = async () => {
    // Optimistic update
    if (onDelete) {
      onDelete(comment.id);
    } else {
      onRefresh();
    }
    try {
      await apiFetch(`/api/comments/${comment.id}`, { method: 'DELETE' });
    } catch (e) {
      // Revert on failure
      onRefresh();
    }
  };

  const handleEdit = async () => {
    // Optimistic update
    const previousContent = comment.content;
    comment.content = editContent;
    setIsEditing(false);

    try {
      await apiFetch(`/api/comments/${comment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent })
      });
      onRefresh();
    } catch (e) {
      // Revert on failure
      comment.content = previousContent;
      onRefresh();
    }
  };

  return (
    <div className="space-y-3" ref={(el) => commentRef && commentRef(comment.id, el)}>
      <div className={`flex gap-3 group p-2 -m-2 rounded-xl transition-colors ${highlightedCommentId === comment.id ? 'bg-orange-900/20 ring-2 ring-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'hover:bg-slate-900/30'}`}>
        <div 
          onClick={() => onViewProfile(comment.user_id)}
          className={`w-8 h-8 bg-slate-800 ${getAvatarShape(comment.account_type)} flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer border border-white/10`}
        >
          {comment.avatar_url ? <img src={comment.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={16} className="text-slate-500" />}
        </div>
        <div className="flex-1">
          <div className="bg-slate-900/50 p-3 rounded-2xl rounded-tl-none border border-white/10 group-hover:border-white/20 transition-colors backdrop-blur-sm">
            <div className="flex items-center justify-between mb-1 relative">
              <div className="flex items-center gap-2 cursor-pointer flex-wrap" onClick={() => onViewProfile(comment.user_id)}>
                <span className="font-bold text-sm hover:underline text-slate-100 flex items-center gap-1">
                  {comment.display_name}
                  <VerifiedBadge user={comment} size={12} />
                </span>
                <span className="text-slate-500 text-xs">@{comment.username}</span>
                <span className="text-slate-500 text-xs">· {formatTimestamp(comment.created_at)}</span>
              </div>
              <button onClick={() => setShowMenu(!showMenu)} className="text-slate-500 hover:text-orange-500 transition-colors"><MoreHorizontal size={14} /></button>
              {showMenu && (
                <div className="absolute right-0 top-5 bg-slate-900 border border-white/10 rounded-lg shadow-2xl z-10 w-36 overflow-hidden backdrop-blur-md">
                  <button onClick={() => { setIsEditing(true); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-800 transition-colors text-slate-300 hover:text-slate-100">Edit</button>
                  <button onClick={() => { handleDelete(); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">Delete</button>
                  {loggedInUser?.role === 'admin' && onViewApiLogs && (
                    <button onClick={() => { onViewApiLogs(comment.content); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/10 transition-colors border-t border-white/10">View API Logs</button>
                  )}
                </div>
              )}
            </div>
            {isEditing ? (
              <div className="mt-2">
                <TagTextarea 
                  users={users || []}
                  value={editContent} 
                  onValueChange={setEditContent} 
                  className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-2 text-slate-100 outline-none focus:border-orange-500 text-sm backdrop-blur-sm"
                  rows={2}
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
                  <button onClick={handleEdit} className="px-3 py-1 text-xs bg-orange-600 hover:bg-orange-500 text-white rounded-full transition-colors shadow-lg shadow-orange-500/20">Save</button>
                </div>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap text-slate-300">{renderContentWithTags(comment.content, users, onViewProfile)}</p>
            )}
            {comment.internal_thought && (
              <div className="mt-2 p-2 bg-slate-800/50 border-l-2 border-orange-500 rounded-r-lg text-xs italic text-slate-400 relative overflow-hidden group backdrop-blur-sm">
                <div className="absolute -right-2 -top-2 opacity-5">
                  <Brain size={32} />
                </div>
                <div className="flex items-center gap-1 mb-1 text-orange-400/80 font-bold text-[10px] uppercase tracking-wider">
                  <Brain size={10} />
                  <span>Thought</span>
                </div>
                {comment.internal_thought}
              </div>
            )}
          </div>
          <div className="flex gap-6 mt-1 ml-2 text-slate-500">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => onLike(comment.id)} 
                className={`flex items-center gap-1 text-xs hover:text-pink-500 transition-colors ${comment.is_liked ? 'text-pink-500' : ''}`}
              >
                <Heart size={12} fill={comment.is_liked ? "currentColor" : "none"} />
                <span>{comment.like_count || 0}</span>
              </button>
              {comment.like_count > 0 && (
                <button onClick={() => onShowLikers('comment', comment.id)} className="text-[9px] hover:underline hover:text-slate-300 transition-colors">view</button>
              )}
            </div>
            <button onClick={() => onReply(comment)} className="text-xs hover:text-orange-500 transition-colors font-bold">Reply</button>
          </div>
        </div>
      </div>
      
      {comment.replies && comment.replies.length > 0 && (
        <div className="pl-6 space-y-3 border-l-2 border-white/10 ml-4 mt-2">
          {comment.replies.map((reply: any) => (
            <CommentItem 
              apiFetch={apiFetch}
              loggedInUser={loggedInUser}
              key={reply.id} 
              comment={reply} 
              onLike={onLike}
              onReply={onReply}
              onViewProfile={onViewProfile}
              onShowLikers={onShowLikers}
              formatTimestamp={formatTimestamp}
              onRefresh={onRefresh}
              onDelete={onDelete}
              highlightedCommentId={highlightedCommentId}
              commentRef={commentRef}
              users={users}
              onViewApiLogs={onViewApiLogs}
            />
          ))}
        </div>
      )}
    </div>
  );
});
