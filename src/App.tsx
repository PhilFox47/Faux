import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Home, MessageSquare, Bell, User, Search, Settings, Heart, MessageCircle, Send, Loader2, Sparkles, UserPlus, UserCheck, Trash2, Globe, X, ArrowLeft, MoreHorizontal, AlertTriangle, Zap, Users, Plus, Lock, Star, Edit2, Upload, Image, Briefcase, BookOpen, Camera, Calendar } from 'lucide-react';
import { TagTextarea } from './components/TagTextarea';
import { SearchableDropdown } from './components/SearchableDropdown';
import { WELCOME_TEXTS } from './welcomeTexts';

import { FauxPast } from './components/FauxPast';

export default function App() {
  const [loggedInUser, setLoggedInUser] = useState<any>(null);
  const [welcomeText] = useState(() => WELCOME_TEXTS[Math.floor(Math.random() * WELCOME_TEXTS.length)]);
  const [realUsers, setRealUsers] = useState<any[]>([]);
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
    return window.fetch(resource, { ...config, headers });
  }, [loggedInUser]);

  useEffect(() => {
    if (!loggedInUser) {
      apiFetch('/api/real-users')
        .then(res => res.json())
        .then(data => setRealUsers(data))
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
  const [posts, setPosts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [groupChats, setGroupChats] = useState<any[]>([]);
  const [dmFavorites, setDmFavorites] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [displayedMessages, setDisplayedMessages] = useState<any[]>([]);
  const [lastProcessedMsgId, setLastProcessedMsgId] = useState<number | null>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [serverTypingUsers, setServerTypingUsers] = useState<string[]>([]);
  const processingQueue = useRef<boolean>(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState('');
  const [newPostType, setNewPostType] = useState('life_update');
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [newChatMsg, setNewChatMsg] = useState('');
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
  const [charAccountType, setCharAccountType] = useState<'character' | 'company'>('character');
  const [charCompanyName, setCharCompanyName] = useState('');
  const [charBrandIdentity, setCharBrandIdentity] = useState('');
  const [charProductsServices, setCharProductsServices] = useState('');
  const [charTargetAudience, setCharTargetAudience] = useState('');
  const [charRunByCharacterId, setCharRunByCharacterId] = useState<number | null>(null);
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
  const [probPost, setProbPost] = useState(100);
  const [probComment, setProbComment] = useState(1000);
  const [probMessage, setProbMessage] = useState(5);
  const [probFavoriteDm, setProbFavoriteDm] = useState(50);
  const [crossUniverseProb, setCrossUniverseProb] = useState(50);
  const [archetypes, setArchetypes] = useState<any[]>([]);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, message?: string, error?: string} | null>(null);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void} | null>(null);

  // Profile Viewing
  const [viewingProfile, setViewingProfile] = useState<any>(null);
  const [viewingProfilePosts, setViewingProfilePosts] = useState<any[]>([]);
  const [viewingProfileArcs, setViewingProfileArcs] = useState<any[]>([]);
  const [profileActiveTab, setProfileActiveTab] = useState<'posts' | 'arcs'>('posts');
  const [viewingUniverse, setViewingUniverse] = useState<any>(null);
  const [viewingUniverseCharacters, setViewingUniverseCharacters] = useState<any[]>([]);
  const [viewingUniverseArcs, setViewingUniverseArcs] = useState<any[]>([]);
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
  const [editingDmId, setEditingDmId] = useState<number | null>(null);
  const [editingDmContent, setEditingDmContent] = useState('');
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);

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
  const [profileAccountType, setProfileAccountType] = useState<'character' | 'company'>('character');
  const [profileCompanyName, setProfileCompanyName] = useState('');
  const [profileBrandIdentity, setProfileBrandIdentity] = useState('');
  const [profileProductsServices, setProfileProductsServices] = useState('');
  const [profileTargetAudience, setProfileTargetAudience] = useState('');
  const [profileRunByCharacterId, setProfileRunByCharacterId] = useState<number | null>(null);
  const [profileRelationships, setProfileRelationships] = useState<any[]>([]);
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

  const fetchApiLogs = (query?: string | React.MouseEvent | React.KeyboardEvent, errorOnly?: boolean) => {
    const q = typeof query === 'string' ? query : apiLogSearch;
    const isErrorOnly = typeof errorOnly === 'boolean' ? errorOnly : apiLogShowErrorsOnly;
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
  };

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

  const isUserOnline = useCallback((user: any) => {
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
    
    const now = new Date();
    const userTime = timeFormatter.format(now);
    
    let [currentHour, currentMinute] = userTime.split(':').map(Number);
    if (currentHour === 24) currentHour = 0;
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

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
    try {
      const res = await apiFetch(`/api/users/${editingProfile.id}/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id_2: newRelUserId, description: newRelDesc })
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || 'Failed to add relationship');
        return;
      }
      setNewRelUserId('');
      setNewRelDesc('');
      const relsRes = await apiFetch(`/api/users/${editingProfile.id}/relationships`);
      setProfileRelationships(await relsRes.json());
      showToast('Relationship added!');
    } catch (e) {
      console.error(e);
      showToast('An error occurred');
    } finally {
      setIsAddingRelationship(false);
    }
  };

  const handleDeleteRelationship = async (otherId: number) => {
    try {
      await apiFetch(`/api/users/${editingProfile.id}/relationships/${otherId}`, {
        method: 'DELETE'
      });
      const res = await apiFetch(`/api/users/${editingProfile.id}/relationships`);
      setProfileRelationships(await res.json());
      showToast('Relationship deleted!');
    } catch (e) {
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
          run_by_character_id: profileRunByCharacterId
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
        fetchPosts();
        fetchConversations();
        setConfirmModal(null);
      }
    });
  };

  const fetchUsers = () => {
    apiFetch('/api/users').then(r => r.json()).then(setUsers);
  };

  const fetchUniverses = () => {
    apiFetch('/api/universes').then(r => r.json()).then(setUniverses);
  };

  const fetchConversations = () => {
    apiFetch('/api/dms').then(r => r.json()).then(setConversations);
  };

  const fetchGroupChats = () => {
    apiFetch('/api/group-chats').then(r => r.json()).then(setGroupChats);
  };

  const fetchDmFavorites = () => {
    apiFetch('/api/favorites').then(r => r.json()).then(setDmFavorites);
  };

  const fetchNotifications = () => {
    apiFetch('/api/notifications').then(r => r.json()).then(setNotifications);
  };

  const fetchChatMessages = (id: number, isGroup: boolean = false, beforeId?: number) => {
    const limit = 40;
    const url = isGroup 
      ? `/api/group-chats/${id}/messages?limit=${limit}${beforeId ? `&before_id=${beforeId}` : ''}`
      : `/api/dms/${id}?limit=${limit}${beforeId ? `&before_id=${beforeId}` : ''}`;
    
    if (beforeId) {
      setIsLoadingMoreMessages(true);
      skipNextScroll.current = true;
    }
    
    apiFetch(url).then(r => r.json()).then(data => {
      if (beforeId) {
        setChatMessages(prev => [...data, ...prev]);
        setIsLoadingMoreMessages(false);
      } else {
        setChatMessages(data);
      }
      setHasMoreMessages(data.length === limit);
    });
  };

  const fetchSettings = () => {
    apiFetch('/api/settings').then(r => r.json()).then(data => {
      if (data) {
        setAiEnabled(data.ai_enabled === 1);
        if (data.model_name) setModelName(data.model_name);
        if (data.image_model_name) setImageModelName(data.image_model_name);
        if (data.vision_model_name) setVisionModelName(data.vision_model_name);
        if (data.timezone) setTimezone(data.timezone);
        if (data.api_key !== undefined) setApiKey(data.api_key);
        if (data.allow_nsfw !== undefined) setAllowNsfw(data.allow_nsfw === 1);
        if (data.prob_post !== undefined) setProbPost(data.prob_post);
        if (data.prob_comment !== undefined) setProbComment(data.prob_comment);
        if (data.prob_message !== undefined) setProbMessage(data.prob_message);
        if (data.prob_favorite_dm !== undefined) setProbFavoriteDm(data.prob_favorite_dm);
        if (data.cross_universe_prob !== undefined) setCrossUniverseProb(data.cross_universe_prob);
      }
    });
  };

  const fetchArchetypes = () => {
    apiFetch('/api/archetypes').then(r => r.json()).then(data => {
      if (data && Array.isArray(data)) {
        setArchetypes(data);
      }
    });
  };

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

  const handleUpdateSettings = async (newSettings: any) => {
    if (newSettings.timezone) setTimezone(newSettings.timezone);
    if (newSettings.prob_post !== undefined) setProbPost(newSettings.prob_post);
    if (newSettings.prob_comment !== undefined) setProbComment(newSettings.prob_comment);
    if (newSettings.prob_message !== undefined) setProbMessage(newSettings.prob_message);
    if (newSettings.prob_favorite_dm !== undefined) setProbFavoriteDm(newSettings.prob_favorite_dm);
    if (newSettings.cross_universe_prob !== undefined) setCrossUniverseProb(newSettings.cross_universe_prob);
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
    const user = users.find(u => u.id === userId);
    if (!user) return;
    setViewingProfile(user);
    setVisibleProfilePosts(30);
    setProfileActiveTab('posts');
    const res = await apiFetch(`/api/users/${userId}/posts`);
    const posts = await res.json();
    setViewingProfilePosts(posts);
    
    const arcsRes = await apiFetch(`/api/users/${userId}/arcs`);
    const arcs = await arcsRes.json();
    setViewingProfileArcs(arcs);
  };

  const handleViewUniverse = async (universeId: number) => {
    if (universeId === -1) {
      setViewingUniverse({ id: -1, name: 'None', description: 'Characters without an assigned universe.' });
      setEditUniverseDescription('');
      setEditUniverseImageUrl('');
      setIsEditingUniverse(false);
      const chars = users.filter(u => !u.universe_id);
      setViewingUniverseCharacters(chars);
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
    const res = await apiFetch(`/api/universes/${universeId}/characters`);
    const chars = await res.json();
    setViewingUniverseCharacters(chars);

    const arcsRes = await apiFetch(`/api/universes/${universeId}/arcs`);
    const arcs = await arcsRes.json();
    setViewingUniverseArcs(arcs);
    
    setActiveTab('universe_details');
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

  useEffect(() => {
    if (!loggedInUser) return;
    fetchPosts();
    fetchUsers();
    fetchUniverses();
    fetchConversations();
    fetchGroupChats();
    fetchDmFavorites();
    fetchNotifications();
    fetchSettings();
    fetchArchetypes();
    fetchApiLogs();
    const interval = setInterval(() => {
      fetchPosts();
      fetchConversations();
      fetchGroupChats();
      fetchNotifications();
      if (activeChat) fetchChatMessages(activeChat.id, isGroupChat);
    }, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [activeChat, isGroupChat, loggedInUser]);

  const expandMessages = useCallback((messages: any[]) => {
    const expanded: any[] = [];
    for (const msg of messages) {
      const sender = users.find(u => u.id === msg.sender_id);
      if (sender?.is_ai && (msg.content.includes('\n\n') || msg.image_url)) {
        const parts = msg.content.split('\n\n').filter(p => p.trim());
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
  }, [users]);

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

    // If we loaded older messages (length increased but last message is the same)
    // We only sync if we are not currently processing a new message sequence
    if (chatMessages.length > displayedMessages.length && lastMsg.id === lastProcessedMsgId && !processingQueue.current) {
      setDisplayedMessages(expandMessages(chatMessages));
      return;
    }

    // If there are new messages
    if (lastMsg.id !== lastProcessedMsgId && !processingQueue.current) {
      const newMessages = chatMessages.filter(m => m.id > lastProcessedMsgId);
      
      const process = async () => {
        processingQueue.current = true;
        for (const msg of newMessages) {
          const sender = users.find(u => u.id === msg.sender_id);
          if (sender?.is_ai && (msg.content.includes('\n\n') || msg.image_url)) {
            const parts = msg.content.split('\n\n').filter(p => p.trim());
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
    const interval = setInterval(fetchTypingStatus, 3000);
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

  const handleCreatePost = async () => {
    if ((!newPostContent.trim() && !newPostImage) || isCreatingPost) return;
    setIsCreatingPost(true);
    const type = newPostType;
    try {
      await apiFetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newPostContent, post_type: type, image_url: newPostImage })
      });
      setNewPostContent('');
      setNewPostImage('');
      setNewPostType('life_update');
      if (type === 'image_post' && !newPostImage) {
        showToast("Image is generating in the background. It will appear shortly.");
      } else if (newPostImage) {
        showToast("Post with image created.");
      }
      fetchPosts();
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
          run_by_character_id: charRunByCharacterId
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
    await apiFetch(`/api/posts/${postId}/like`, { method: 'POST' });
    fetchPosts();
  };

  const handleFollow = async (userId: number) => {
    await apiFetch(`/api/users/${userId}/follow`, { method: 'POST' });
    fetchUsers();
  };

  const handleFollowAllInUniverse = async (chars: any[]) => {
    const charsToFollow = chars.filter(c => !c.is_followed);
    if (charsToFollow.length === 0) return;
    await Promise.all(charsToFollow.map(c => apiFetch(`/api/users/${c.id}/follow`, { method: 'POST' })));
    fetchUsers();
  };

  const handleUnfollowAllInUniverse = async (chars: any[]) => {
    const charsToUnfollow = chars.filter(c => c.is_followed);
    if (charsToUnfollow.length === 0) return;
    await Promise.all(charsToUnfollow.map(c => apiFetch(`/api/users/${c.id}/follow`, { method: 'POST' })));
    fetchUsers();
  };

  const [dmSettings, setDmSettings] = useState<any>({ allow_image_gen: 0 });
  const [dmImage, setDmImage] = useState<string | null>(null);
  const dmImageInputRef = useRef<HTMLInputElement>(null);

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

  const handleDmImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDmImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMsg = async (e: React.FormEvent | React.KeyboardEvent | any) => {
    e.preventDefault();
    if ((!newChatMsg.trim() && !dmImage) || !activeChat || isSendingMsg) return;
    
    setIsSendingMsg(true);
    // Optimistic update
    const msg = newChatMsg.trim();
    const image_url = dmImage;
    setNewChatMsg('');
    setDmImage(null);
    const realUser = loggedInUser;
    setChatMessages(prev => [...prev, { sender_id: realUser?.id || 1, content: msg, image_url: image_url, created_at: new Date().toISOString() }]);

    const endpoint = isGroupChat ? `/api/group-chats/${activeChat.id}/messages` : `/api/dms/${activeChat.id}`;
    
    try {
      await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: msg, image_url })
      });
      fetchChatMessages(activeChat.id, isGroupChat);
      if (isGroupChat) fetchGroupChats();
      else fetchConversations();
      fetchUsers();
    } finally {
      setIsSendingMsg(false);
    }
  };

  const handleEditDm = async (msgId: number) => {
    if (!editingDmContent.trim() || !activeChat) return;
    
    const endpoint = isGroupChat ? `/api/group-chats/messages/${msgId}` : `/api/dms/messages/${msgId}`;
    await apiFetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editingDmContent.trim() })
    });
    
    setEditingDmId(null);
    setEditingDmContent('');
    fetchChatMessages(activeChat.id, isGroupChat);
  };

  const handleDeleteDm = async (msgId: number) => {
    if (!activeChat) return;
    
    const endpoint = isGroupChat ? `/api/group-chats/messages/${msgId}` : `/api/dms/messages/${msgId}`;
    await apiFetch(endpoint, {
      method: 'DELETE'
    });
    
    fetchChatMessages(activeChat.id, isGroupChat);
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

  const [characterSearch, setCharacterSearch] = useState('');
  const [visibleCharacters, setVisibleCharacters] = useState(20);
  const [visiblePosts, setVisiblePosts] = useState(30);
  const [fauxPicsPosts, setFauxPicsPosts] = useState<any[]>([]);
  const [visibleFauxPics, setVisibleFauxPics] = useState(20);
  const visiblePostsRef = useRef(visiblePosts);
  const visibleFauxPicsRef = useRef(visibleFauxPics);

  const fetchPosts = useCallback(() => {
    apiFetch(`/api/posts?limit=${visiblePostsRef.current + 1}`).then(r => r.json()).then(setPosts);
  }, [apiFetch]);

  const fetchFauxPics = useCallback(() => {
    apiFetch(`/api/posts?type=image_post&limit=${visibleFauxPicsRef.current + 1}`).then(r => r.json()).then(setFauxPicsPosts);
  }, [apiFetch]);

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
    if (loggedInUser) {
      fetchFauxPics();
    }
  }, [loggedInUser, fetchFauxPics]);

  const [visibleProfilePosts, setVisibleProfilePosts] = useState(30);

  if (!loggedInUser) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center font-sans">
        {toastMessage && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-orange-500 text-white px-6 py-3 rounded-full shadow-xl font-bold animate-pulse">
            {toastMessage}
          </div>
        )}
        <div className="mb-12">
          <img src="https://i.imgur.com/tI0YtLX.png" alt="Faux Logo" className="h-16 object-contain" referrerPolicy="no-referrer" />
        </div>
        <h1 className="text-4xl font-bold mb-10 text-center">{welcomeText}</h1>
        <div className="flex flex-wrap justify-center gap-8 max-w-4xl px-4">
          {realUsers.map(user => (
            <div 
              key={user.id} 
              className="flex flex-col items-center gap-4 cursor-pointer group"
              onClick={() => setSelectedLoginUser(user)}
            >
              <div className={`w-32 h-32 rounded-xl overflow-hidden border-4 transition-all duration-200 ${selectedLoginUser?.id === user.id ? 'border-white scale-110' : 'border-transparent group-hover:border-gray-400 group-hover:scale-105'}`}>
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
    );
  }

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

      <div className="w-full max-w-7xl flex min-h-screen">
        
        {/* Left Sidebar */}
        <div className="w-20 xl:w-64 border-r border-gray-800 p-4 flex flex-col h-full sticky top-0">
          <div>
            <div className="flex items-center justify-center xl:justify-start mb-8 p-2">
              <img 
                src="https://i.imgur.com/8FO0ENo.png" 
                alt="Faux Logo" 
                className="w-10 h-10 object-contain xl:hidden" 
                referrerPolicy="no-referrer"
              />
              <img 
                src="https://i.imgur.com/tI0YtLX.png" 
                alt="Faux Logo" 
                className="hidden xl:block h-10 object-contain" 
                referrerPolicy="no-referrer"
              />
            </div>
            <nav className="space-y-2">
              <NavItem icon={<Home />} label="Home" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
              <NavItem icon={<Camera />} label="FauxPics" active={activeTab === 'fauxpics'} onClick={() => setActiveTab('fauxpics')} />
              <NavItem icon={<Search />} label="Add Character" active={activeTab === 'explore'} onClick={() => setActiveTab('explore')} />
              <NavItem 
                icon={
                  <div className="relative">
                    <Bell />
                    {unreadNotifs > 0 && (
                      <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
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
                      <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                        {unreadMessages}
                      </span>
                    )}
                  </div>
                } 
                label="Messages" 
                active={activeTab === 'messages'} 
                onClick={() => setActiveTab('messages')} 
              />
              <NavItem icon={<Globe />} label="Universes" active={activeTab === 'universes'} onClick={() => { setActiveTab('universes'); fetchUniverses(); }} />
              <NavItem icon={<BookOpen />} label="Arcs" active={activeTab === 'arcs'} onClick={() => { setActiveTab('arcs'); fetchArcs(true); }} />
              <NavItem icon={<UserCheck />} label="Following" active={activeTab === 'following'} onClick={() => setActiveTab('following')} />
              {loggedInUser?.role === 'admin' && (
                <NavItem icon={<Users />} label="Relationships" active={activeTab === 'relationships'} onClick={() => { setActiveTab('relationships'); fetchRelationshipChecks(true); }} />
              )}
              <NavItem icon={<Calendar />} label="FauxPast" active={activeTab === 'fauxpast'} onClick={() => setActiveTab('fauxpast')} />
              <NavItem icon={<Settings />} label="Settings" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); fetchApiLogs(); }} />
            </nav>
            <button 
              onClick={() => setActiveTab('home')}
              className="w-full mt-6 bg-orange-500 hover:bg-orange-600 text-white rounded-full py-3 font-bold transition duration-200 xl:block hidden"
            >
              Post
            </button>

            <div className="flex flex-col gap-2 mt-8">
              <div className="hidden xl:flex items-center gap-2 p-3 text-sm text-gray-400">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                <span>{users.filter(u => u.is_ai === 1 && isUserOnline(u)).length} AI Online</span>
              </div>
              <div 
                onClick={() => handleEditProfile(loggedInUser)}
                className="flex items-center gap-3 p-3 hover:bg-gray-900 rounded-full cursor-pointer transition duration-200"
              >
                <div className="w-10 h-10 bg-blue-900 rounded-full flex-shrink-0 flex items-center justify-center font-bold overflow-hidden">
                  {loggedInUser?.avatar_url ? (
                    <img src={loggedInUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    loggedInUser?.display_name?.[0] || 'Y'
                  )}
                </div>
                <div className="hidden xl:block">
                  <p className="font-bold text-sm">{loggedInUser?.display_name || 'You'}</p>
                  <p className="text-gray-500 text-sm">@{loggedInUser?.username || 'real_user'}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setLoggedInUser(null);
                  localStorage.removeItem(SESSION_KEY);
                }}
                className="text-xs text-gray-500 hover:text-white transition text-center py-2"
              >
                Log out
              </button>
            </div>
          </div>
        </div>

        {/* Main Feed */}
        <div className="flex-1 border-r border-gray-800 overflow-y-auto relative">
          <div className="sticky top-0 bg-black/80 backdrop-blur-md border-b border-gray-800 p-4 z-10">
            <h1 className="text-xl font-bold capitalize">{activeTab === 'explore' ? 'Add Character' : activeTab}</h1>
          </div>
          
          {activeTab === 'home' && (
            <>
              {/* Compose Post */}
              <div className="border-b border-gray-800 p-4 flex gap-4">
                <div className="w-10 h-10 bg-blue-900 rounded-full flex-shrink-0 flex items-center justify-center font-bold overflow-hidden">
                  {loggedInUser?.avatar_url ? (
                    <img src={loggedInUser?.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    loggedInUser?.display_name?.[0] || 'Y'
                  )}
                </div>
                <div className="flex-1">
                  <TagTextarea 
                    users={users}
                    value={newPostContent}
                    onValueChange={setNewPostContent}
                    className="w-full bg-transparent text-xl outline-none resize-none placeholder-gray-500" 
                    placeholder="What's happening?"
                    rows={3}
                  />
                  {newPostImage && (
                    <div className="relative mt-2 inline-block">
                      <img src={newPostImage} alt="Post preview" className="max-h-48 rounded-xl object-cover" />
                      <button 
                        onClick={() => setNewPostImage('')}
                        className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white rounded-full p-1"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-2 border-t border-gray-800 pt-3">
                    <div className="text-orange-500 flex gap-4 items-center">
                      <label className="cursor-pointer hover:bg-gray-800 p-2 rounded-full transition">
                        <Image size={20} />
                        <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, setNewPostImage)} />
                      </label>
                      <select 
                        value={newPostType} 
                        onChange={(e) => setNewPostType(e.target.value)}
                        className="bg-gray-800 text-white rounded px-2 py-1 text-sm outline-none border border-gray-700 focus:border-orange-500"
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
                    </div>
                    <button 
                      onClick={handleCreatePost}
                      disabled={!newPostContent.trim() && !newPostImage}
                      className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 text-white rounded-full px-6 py-2 font-bold transition duration-200 shadow-lg"
                    >
                      Post
                    </button>
                  </div>
                </div>
              </div>

              {/* Feed */}
              <div>
                {posts.slice(0, visiblePosts).map(post => (
                  <PostItem 
                    apiFetch={apiFetch}
                    loggedInUser={loggedInUser}
                    key={post.id} 
                    post={post} 
                    onLike={() => handleLike(post.id)} 
                    onViewProfile={handleViewProfile}
                    onShowLikers={handleShowLikers}
                    formatTimestamp={formatTimestamp}
                    onRefresh={fetchPosts}
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
                  <div className="p-6 flex justify-center border-b border-gray-800">
                    <button 
                      onClick={() => setVisiblePosts(prev => prev + 30)}
                      className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-full transition"
                    >
                      Load More
                    </button>
                  </div>
                )}
                {posts.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    <p>The feed is currently empty.</p>
                    <p className="text-sm mt-2">Add AI characters to see them post!</p>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'fauxpics' && (
            <div className="p-4">
              <div className="grid grid-cols-1 gap-8 max-w-2xl mx-auto">
                {fauxPicsPosts.length === 0 ? (
                  <div className="text-center py-20 text-gray-500">
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
                  <div className="flex justify-center mt-8">
                    <button 
                      onClick={() => setVisibleFauxPics(prev => prev + 20)}
                      className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-8 rounded-full transition"
                    >
                      Load More Images
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'explore' && (
            <div className="flex h-[calc(100vh-60px)]">
              <div className="flex-1 p-6 overflow-y-auto">
                <h2 className="text-2xl font-bold mb-6">Add Account</h2>
                <form onSubmit={handleAddCharacter} className="space-y-4 max-w-3xl mx-auto">
                  <div className="flex gap-4 mb-6">
                    <button
                      type="button"
                      onClick={() => setCharAccountType('character')}
                      className={`flex-1 py-3 rounded-lg font-bold transition-colors ${charAccountType === 'character' ? 'bg-orange-500 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}
                    >
                      Character
                    </button>
                    <button
                      type="button"
                      onClick={() => setCharAccountType('company')}
                      className={`flex-1 py-3 rounded-lg font-bold transition-colors ${charAccountType === 'company' ? 'bg-orange-500 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}
                    >
                      Company Account
                    </button>
                  </div>

                  {charAccountType === 'character' ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Character Name</label>
                        <input required value={charName} onChange={e => setCharName(e.target.value)} type="text" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" placeholder="e.g. Geralt of Rivia" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Additional Info (Franchise, Context, etc.)</label>
                        <textarea value={charPersona} onChange={e => setCharPersona(e.target.value)} rows={2} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" placeholder="e.g. From The Witcher 3, currently looking for Ciri..."></textarea>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Company / Brand Name</label>
                        <input required value={charCompanyName} onChange={e => { setCharCompanyName(e.target.value); setCharName(e.target.value); }} type="text" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" placeholder="e.g. Vought International" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Brand Identity</label>
                        <textarea value={charBrandIdentity} onChange={e => setCharBrandIdentity(e.target.value)} rows={2} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" placeholder="e.g. Corporate, patriotic, slightly sinister..."></textarea>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Products / Services</label>
                        <textarea value={charProductsServices} onChange={e => setCharProductsServices(e.target.value)} rows={2} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" placeholder="e.g. Compound V, Superheroes, Energy Drinks..."></textarea>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Target Audience</label>
                        <input value={charTargetAudience} onChange={e => setCharTargetAudience(e.target.value)} type="text" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" placeholder="e.g. General public, superhero fans" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Run By Character (Optional)</label>
                        <select 
                          value={charRunByCharacterId || ''} 
                          onChange={e => setCharRunByCharacterId(e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500"
                        >
                          <option value="">Nameless Employee</option>
                          {users.filter(u => u.is_ai).map(u => (
                            <option key={u.id} value={u.id}>{u.display_name} (@{u.username})</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
                      <input required value={charUsername} onChange={e => setCharUsername(e.target.value)} type="text" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" placeholder="e.g. white_wolf" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Universe</label>
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
                        <div className="mt-2 flex items-center gap-2 text-sm text-orange-400 bg-orange-500/10 p-2 rounded-lg border border-orange-500/20">
                          <Plus size={14} />
                          Creating new universe: <span className="font-bold">{charNewUniverseName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Profile Picture (URL or Upload)</label>
                    <div className="flex gap-2">
                      <input value={charAvatar} onChange={e => setCharAvatar(e.target.value)} type="text" className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" placeholder="Image URL..." />
                      <label className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-lg cursor-pointer flex items-center gap-2">
                        <UserPlus size={18} />
                        Upload
                        <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, setCharAvatar)} />
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Reference Images (Overrides Profile Pic for Image Gen)</label>
                    <div className="flex flex-col gap-2">
                      {charReferenceImages.map((img, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          {img && <img src={img} alt="Ref" className="w-10 h-10 object-cover rounded" />}
                          <input value={img} onChange={e => {
                            const newImgs = [...charReferenceImages];
                            newImgs[idx] = e.target.value;
                            setCharReferenceImages(newImgs);
                          }} type="text" className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-2 text-white outline-none focus:border-orange-500" placeholder="Image URL..." />
                          <button type="button" onClick={() => setCharReferenceImages(charReferenceImages.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-400 p-2"><X size={16} /></button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setCharReferenceImages([...charReferenceImages, ''])} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                          <Plus size={16} /> Add URL
                        </button>
                        <label className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2 text-sm">
                          <Upload size={16} /> Upload Image
                          <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, (base64) => setCharReferenceImages([...charReferenceImages, base64]))} />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Public Bio</label>
                    <textarea value={charBio} onChange={e => setCharBio(e.target.value)} rows={2} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" placeholder="Short public bio..."></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">General Description (Private)</label>
                    <textarea value={charDescription} onChange={e => setCharDescription(e.target.value)} rows={3} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" placeholder="Detailed personality and background..."></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Writing Style (Private)</label>
                    <textarea value={charWritingStyle} onChange={e => setCharWritingStyle(e.target.value)} rows={3} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" placeholder="Tone of voice, catchphrases, interaction style..."></textarea>
                  </div>
                  {charAccountType === 'character' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Physical Appearance (Private)</label>
                        <textarea value={charPhysicalAppearance} onChange={e => setCharPhysicalAppearance(e.target.value)} rows={2} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" placeholder="Hair color, body type, facial features..."></textarea>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Clothing Style (Private)</label>
                        <textarea value={charClothingStyle} onChange={e => setCharClothingStyle(e.target.value)} rows={2} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" placeholder="Usual outfits, fashion sense, accessories..."></textarea>
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Artstyle (Private)</label>
                    <textarea value={charArtstyle} onChange={e => setCharArtstyle(e.target.value)} rows={2} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" placeholder="e.g. Anime, Realistic, Pixel Art, Oil Painting..."></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Online Time (Optional - Default: Always Online)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-900/50 p-4 rounded-xl border border-gray-800">
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
                            className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-gray-900"
                          />
                          <span className="text-sm text-gray-300 group-hover:text-white transition">{window.label}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2 italic">If no window is selected, the character is online 24/7.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Activity Level (1-10)</label>
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
                    <p className="text-xs text-gray-500 mt-1">Dictates how often this character creates posts, comments, and DMs.</p>
                  </div>
                  <button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold py-3 rounded-full hover:from-orange-600 hover:to-yellow-600 transition shadow-lg">
                    Add Character
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              {notifications.map(notif => (
                <div 
                  key={notif.id} 
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-4 border-b border-gray-800 flex gap-4 hover:bg-gray-900/50 transition cursor-pointer ${notif.is_read ? 'opacity-70' : ''}`}
                >
                  <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden bg-gray-700">
                    {notif.actor_avatar ? <img src={notif.actor_avatar} alt="" className="w-full h-full object-cover" /> : <User size={20} />}
                  </div>
                  <div>
                    <p>
                      <span className="font-bold">{notif.actor_name}</span>
                      {notif.type === 'like_post' && ' liked your post.'}
                      {notif.type === 'like_comment' && ' liked your comment.'}
                      {notif.type === 'comment' && ' commented on your post.'}
                      {notif.type === 'reply' && ' replied to your comment.'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{formatTimestamp(notif.created_at)}</p>
                  </div>
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <p>No notifications yet.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="flex h-[calc(100vh-60px)]">
              {/* Conversation List */}
              {!activeChat && (
                <div className="w-full flex flex-col">
                  <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                    <h2 className="font-bold text-lg">Messages</h2>
                    <button onClick={() => setShowCreateGroupModal(true)} className="p-2 hover:bg-gray-800 rounded-full" title="New Group Chat">
                      <Plus size={20} />
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {groupChats.map(group => (
                      <div 
                        key={`group-${group.id}`} 
                        onClick={() => { setActiveChat({ id: group.id, name: group.name, isGroup: true }); setIsGroupChat(true); fetchChatMessages(group.id, true); }}
                        className={`p-4 border-b border-gray-800 cursor-pointer hover:bg-gray-900 transition ${activeChat?.id === group.id && isGroupChat ? 'bg-gray-900' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 flex-shrink-0 cursor-pointer">
                            <div className="w-full h-full bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
                              <Users size={24} />
                            </div>
                            {group.members?.some((m: any) => m.is_ai === 1 && isUserOnline(m)) && (
                              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-gray-800 bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" title="AI Member Online"></div>
                            )}
                          </div>
                          <div className="overflow-hidden flex-1">
                            <div className="flex justify-between items-center">
                              <p className="font-bold truncate">{group.name}</p>
                              {group.unread_count > 0 && (
                                <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                                  {group.unread_count}
                                </span>
                              )}
                            </div>
                            <p className={`text-sm truncate ${group.unread_count > 0 ? 'text-white font-bold' : 'text-gray-500'}`}>
                              {group.last_message || 'No messages yet'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {conversations.map(conv => (
                      <div 
                        key={`dm-${conv.other_user_id}`} 
                        onClick={() => { setActiveChat({ id: conv.other_user_id, name: conv.display_name, avatar_url: conv.avatar_url, isGroup: false }); setIsGroupChat(false); fetchChatMessages(conv.other_user_id, false); }}
                        className={`p-4 border-b border-gray-800 cursor-pointer hover:bg-gray-900 transition ${activeChat?.id === conv.other_user_id && !isGroupChat ? 'bg-gray-900' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 flex-shrink-0 cursor-pointer">
                            <div className="w-full h-full bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
                              {conv.avatar_url ? <img src={conv.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={24} />}
                            </div>
                            {conv.is_ai === 1 && (
                              <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-gray-800 ${isUserOnline(conv) ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-500'}`} title={isUserOnline(conv) ? 'Online' : 'Offline'}></div>
                            )}
                          </div>
                          <div className="overflow-hidden flex-1">
                            <div className="flex justify-between items-center">
                              <p className="font-bold truncate">{conv.display_name}</p>
                              {conv.unread_count > 0 && (
                                <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                                  {conv.unread_count}
                                </span>
                              )}
                            </div>
                            <p className={`text-sm truncate ${conv.unread_count > 0 ? 'text-white font-bold' : 'text-gray-500'}`}>
                              {conv.last_message}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {conversations.length === 0 && groupChats.length === 0 && (
                      <div className="p-4 text-center text-gray-500 text-sm">No messages yet.</div>
                    )}
                  </div>
                </div>
              )}

              {/* Chat Area */}
              {activeChat && (
                <div className="w-full flex flex-col">
                  <div className="p-4 border-b border-gray-800 font-bold flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setActiveChat(null)} className="p-2 hover:bg-gray-800 rounded-full">
                        <ArrowLeft size={20} />
                      </button>
                      <div className="relative w-8 h-8 flex-shrink-0">
                        <div className="w-full h-full bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
                          {activeChat.avatar_url ? <img src={activeChat.avatar_url} alt="" className="w-full h-full object-cover" /> : (isGroupChat ? <Users size={16} /> : <User size={16} />)}
                        </div>
                        {(() => {
                          if (isGroupChat) {
                            const group = groupChats.find(g => g.id === activeChat.id);
                            if (group?.members?.some((m: any) => m.is_ai === 1 && isUserOnline(m))) {
                              return <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-900 bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" title="AI Member Online"></div>;
                            }
                          } else {
                            const user = users.find(u => u.id === activeChat.id);
                            if (user?.is_ai === 1) {
                              return <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${isUserOnline(user) ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-gray-500'}`} title={isUserOnline(user) ? 'Online' : 'Offline'}></div>;
                            }
                          }
                          return null;
                        })()}
                      </div>
                      {activeChat.name}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setShowGallery(true)}
                        className="p-2 text-gray-500 hover:text-orange-500 hover:bg-orange-500/10 rounded-full transition"
                        title="View Gallery"
                      >
                        <Image size={20} />
                      </button>
                      <button
                        onClick={handleToggleImageGen}
                        className={`p-2 rounded-full transition ${dmSettings.allow_image_gen === 1 ? 'text-orange-500 bg-orange-500/10' : 'text-gray-500 hover:text-orange-500 hover:bg-orange-500/10'}`}
                        title={dmSettings.allow_image_gen === 1 ? "Disable Image Generation" : "Enable Image Generation"}
                      >
                        <Zap size={20} fill={dmSettings.allow_image_gen === 1 ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={() => handleToggleFavorite(activeChat.id, isGroupChat)}
                        className={`p-2 rounded-full transition ${dmFavorites.some(f => f.target_id === activeChat.id && f.is_group === (isGroupChat ? 1 : 0)) ? 'text-yellow-500 bg-yellow-500/10' : 'text-gray-500 hover:text-yellow-500 hover:bg-yellow-500/10'}`}
                        title={dmFavorites.some(f => f.target_id === activeChat.id && f.is_group === (isGroupChat ? 1 : 0)) ? "Unfavorite" : "Favorite"}
                      >
                        <Star size={20} fill={dmFavorites.some(f => f.target_id === activeChat.id && f.is_group === (isGroupChat ? 1 : 0)) ? "currentColor" : "none"} />
                      </button>
                      {!isGroupChat && (
                        <button 
                          onClick={handleResetChat}
                          className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-full transition"
                          title="Reset Conversation"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div ref={chatScrollRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto p-4 space-y-4">
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
                      return (
                        <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-1 w-full`}>
                          {!isMe && isGroupChat && sender && (
                            <span className="text-xs text-gray-400 ml-9">{sender.display_name}</span>
                          )}
                          <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} gap-2 items-end`}>
                            {!isMe && (
                              <div className="relative">
                                <img src={sender?.avatar_url || activeChat.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-1" />
                                {sender?.is_ai === 1 && (
                                  <div className={`absolute bottom-1 -right-0.5 w-2 h-2 rounded-full border border-gray-900 ${isUserOnline(sender) ? 'bg-green-500' : 'bg-gray-500'}`} title={isUserOnline(sender) ? 'Online' : 'Offline'}></div>
                                )}
                              </div>
                            )}
                            <div className={`group flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                              <div className={`rounded-2xl p-3 whitespace-pre-wrap break-words ${isMe ? 'bg-orange-500 text-white rounded-br-none' : 'bg-gray-800 text-white rounded-bl-none'}`}>
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
                                      className={`w-full border rounded p-2 text-white outline-none resize-none ${isMe ? 'bg-orange-600 border-orange-400 focus:border-white' : 'bg-gray-700 border-gray-600 focus:border-orange-500'}`}
                                      rows={3}
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button onClick={() => setEditingDmId(null)} className="text-xs text-white/70 hover:text-white">Cancel</button>
                                      <button onClick={() => handleEditDm(msg.id)} className={`text-xs px-2 py-1 rounded ${isMe ? 'bg-white text-orange-600 hover:bg-gray-100' : 'bg-orange-600 text-white hover:bg-orange-500'}`}>Save</button>
                                    </div>
                                  </div>
                                ) : (
                                  (msg.content || '').trim()
                                )}
                              </div>
                              <div className={`flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <button onClick={() => { setEditingDmId(msg.id); setEditingDmContent(msg.content); }} className="text-xs text-gray-500 hover:text-white"><Edit2 size={12} /></button>
                                <button onClick={() => handleDeleteDm(msg.id)} className="text-xs text-gray-500 hover:text-red-500"><Trash2 size={12} /></button>
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-500 px-2">
                            {formatTimestamp(msg.created_at)}
                          </span>
                        </div>
                      );
                    })}
                    {(typingUser || serverTypingUsers.length > 0) && (
                      <div className="flex flex-col gap-2 mb-4">
                        {serverTypingUsers.filter(u => u !== typingUser).map(u => (
                          <div key={u} className="flex items-center gap-2 text-gray-400 text-xs italic ml-9">
                            <Loader2 size={12} className="animate-spin" />
                            {u} is typing...
                          </div>
                        ))}
                        {typingUser && (
                          <div className="flex items-center gap-2 text-gray-400 text-xs italic ml-9">
                            <Loader2 size={12} className="animate-spin" />
                            {typingUser} is typing...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="p-4 border-t border-gray-800">
                    {dmImage && (
                      <div className="mb-2 relative inline-block">
                        <img src={dmImage} alt="Preview" className="h-20 w-20 object-cover rounded-lg border border-gray-700" />
                        <button 
                          onClick={() => setDmImage(null)}
                          className="absolute -top-2 -right-2 bg-gray-900 text-white rounded-full p-1 border border-gray-700 hover:bg-gray-800"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                    <form onSubmit={handleSendMsg} className="flex gap-2 items-end">
                      <input 
                        type="file" 
                        ref={dmImageInputRef} 
                        onChange={handleDmImageUpload} 
                        accept="image/*" 
                        className="hidden" 
                      />
                      <button 
                        type="button"
                        onClick={() => dmImageInputRef.current?.click()}
                        className="p-3 text-gray-500 hover:text-orange-500 hover:bg-orange-500/10 rounded-full transition mb-1"
                        title="Upload Image"
                      >
                        <Image size={24} />
                      </button>
                      <TagTextarea 
                        users={users}
                        value={newChatMsg}
                        onValueChange={setNewChatMsg}
                        placeholder="Start a new message" 
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 outline-none focus:border-orange-500 resize-none min-h-[100px] max-h-[300px]"
                        rows={3}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMsg(e);
                          }
                        }}
                      />
                      <button type="submit" className="bg-orange-500 text-white p-3 rounded-full hover:bg-orange-600 flex-shrink-0 mb-1">
                        <Send size={24} />
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'universes' && (
            <div className="p-6 max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">Universes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div onClick={() => handleViewUniverse(-1)} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 cursor-pointer hover:bg-gray-800 transition flex flex-col h-full">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-16 h-16 bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                      <Globe size={32} className="m-auto mt-4 text-gray-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">None</h3>
                      <p className="text-sm text-gray-400">{users.filter(u => !u.universe_id).length} characters</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 line-clamp-2 mb-4 flex-1">Characters without an assigned universe.</p>
                  <div className="flex -space-x-2 overflow-hidden mt-auto pt-2">
                    {users.filter(char => !char.universe_id).slice(0, 7).map(char => (
                      <div key={char.id} className={`relative inline-block ${!char.is_active ? 'opacity-50 grayscale' : ''}`}>
                        <img 
                          src={char.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${char.username}`} 
                          alt={char.display_name} 
                          className="w-8 h-8 rounded-full border-2 border-gray-900 object-cover bg-gray-800" 
                          referrerPolicy="no-referrer" 
                        />
                        {char.is_active && isUserOnline(char) && (
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-gray-900 rounded-full"></div>
                        )}
                      </div>
                    ))}
                    {users.filter(char => !char.universe_id).length > 7 && (
                      <div className="w-8 h-8 rounded-full border-2 border-gray-900 bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-400 z-10 relative">
                        +{users.filter(char => !char.universe_id).length - 7}
                      </div>
                    )}
                  </div>
                </div>
                {universes.map(u => (
                  <div key={u.id} onClick={() => handleViewUniverse(u.id)} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 cursor-pointer hover:bg-gray-800 transition flex flex-col h-full">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="w-16 h-16 bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                        {u.image_url ? (
                          <img src={u.image_url} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Globe size={32} className="m-auto mt-4 text-gray-500" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{u.name}</h3>
                        <p className="text-sm text-gray-400">{u.character_count || 0} characters</p>
                      </div>
                    </div>
                    {u.description && (
                      <p className="text-sm text-gray-300 line-clamp-2 mb-4 flex-1">{u.description}</p>
                    )}
                    {!u.description && <div className="flex-1"></div>}
                    <div className="flex -space-x-2 overflow-hidden mt-auto pt-2">
                      {users.filter(char => char.universe_id === u.id).slice(0, 7).map(char => (
                        <div key={char.id} className={`relative inline-block ${!char.is_active ? 'opacity-50 grayscale' : ''}`}>
                          <img 
                            src={char.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${char.username}`} 
                            alt={char.display_name} 
                            className="w-8 h-8 rounded-full border-2 border-gray-900 object-cover bg-gray-800" 
                            referrerPolicy="no-referrer" 
                          />
                          {char.is_active && isUserOnline(char) && (
                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-gray-900 rounded-full"></div>
                          )}
                        </div>
                      ))}
                      {users.filter(char => char.universe_id === u.id).length > 7 && (
                        <div className="w-8 h-8 rounded-full border-2 border-gray-900 bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-400 z-10 relative">
                          +{users.filter(char => char.universe_id === u.id).length - 7}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {universes.length === 0 && (
                  <div className="col-span-full p-8 text-center text-gray-500">
                    <p>No universes created yet. You can create one when adding or editing a character.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'universe_details' && viewingUniverse && (
            <div className="p-6 max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <button onClick={() => setActiveTab('universes')} className="flex items-center gap-2 text-gray-400 hover:text-white">
                  <ArrowLeft size={20} /> Back to Universes
                </button>
                {!isEditingUniverse && viewingUniverse.id !== -1 && (
                  <button 
                    onClick={() => setIsEditingUniverse(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                  >
                    <Settings size={18} /> Edit Universe
                  </button>
                )}
              </div>
              
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
                {isEditingUniverse ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Universe Image URL</label>
                      <input
                        type="text"
                        value={editUniverseImageUrl}
                        onChange={(e) => setEditUniverseImageUrl(e.target.value)}
                        placeholder="https://example.com/image.jpg"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Lore / Description</label>
                      <textarea
                        value={editUniverseDescription}
                        onChange={(e) => setEditUniverseDescription(e.target.value)}
                        placeholder="Describe the lore and context of this universe..."
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 h-32 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={handleUpdateUniverse}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-bold transition"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => setIsEditingUniverse(false)}
                        className="flex-1 bg-gray-800 hover:bg-gray-700 py-3 rounded-xl font-bold transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="w-32 h-32 bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                      {viewingUniverse.image_url ? (
                        <img src={viewingUniverse.image_url} alt={viewingUniverse.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Globe size={64} className="m-auto mt-8 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold mb-2">{viewingUniverse.name}</h2>
                      <p className="text-gray-400 mb-4">{viewingUniverseCharacters.length} characters</p>
                      {viewingUniverse.description ? (
                        <p className="text-gray-300 whitespace-pre-wrap">{viewingUniverse.description}</p>
                      ) : (
                        <p className="text-gray-500 italic">No lore information added yet.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-6">
                  <button 
                    onClick={() => setUniverseActiveTab('characters')}
                    className={`pb-2 font-bold transition-colors ${universeActiveTab === 'characters' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Characters
                  </button>
                  <button 
                    onClick={() => setUniverseActiveTab('arcs')}
                    className={`pb-2 font-bold transition-colors ${universeActiveTab === 'arcs' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Universe Arcs
                  </button>
                </div>
                {universeActiveTab === 'characters' && viewingUniverseCharacters.length > 0 && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleFollowAllInUniverse(viewingUniverseCharacters)}
                      className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold transition"
                    >
                      Follow All
                    </button>
                    <button 
                      onClick={() => handleUnfollowAllInUniverse(viewingUniverseCharacters)}
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg font-bold transition"
                    >
                      Unfollow All
                    </button>
                  </div>
                )}
              </div>

              {universeActiveTab === 'characters' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {viewingUniverseCharacters.map(char => (
                    <div key={char.id} onClick={() => handleViewProfile(char.id)} className={`bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-800 transition ${!char.is_active ? 'opacity-50 grayscale' : ''}`}>
                      <div className="relative">
                        <img src={char.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${char.username}`} alt={char.display_name} className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                        {char.is_active && isUserOnline(char) && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-900 rounded-full" title="Online"></div>
                        )}
                      </div>
                      <div className="overflow-hidden flex-1">
                        <p className="font-bold truncate flex items-center gap-2">
                          {char.display_name}
                          {!char.is_active && <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-gray-400">Inactive</span>}
                        </p>
                        <p className="text-xs text-gray-500 truncate">@{char.username}</p>
                      </div>
                    </div>
                  ))}
                  {viewingUniverseCharacters.length === 0 && (
                    <p className="text-gray-500 col-span-full">No characters found in this universe.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {loggedInUser?.role === 'admin' && (
                    <div className="flex gap-2 mb-4">
                      <button 
                        onClick={() => handleAddArc('universe', viewingUniverse.id)}
                        className="flex items-center gap-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold transition"
                      >
                        <Plus size={14} /> Add Manual Arc
                      </button>
                      <button 
                        onClick={() => handleGenerateArc('universe', viewingUniverse.id)}
                        disabled={isGeneratingArc}
                        className="flex items-center gap-2 text-xs bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-lg font-bold transition disabled:opacity-50"
                      >
                        <Sparkles size={14} /> {isGeneratingArc ? 'Generating...' : 'Generate AI Arc'}
                      </button>
                    </div>
                  )}
                  {viewingUniverseArcs.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No universe arcs yet.</p>
                  ) : (
                    viewingUniverseArcs.map(arc => (
                      <div key={arc.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="font-bold text-xl text-white">{arc.title}</h3>
                          <div className="flex items-center gap-3">
                            {loggedInUser?.role === 'admin' && (
                              <div className="flex gap-2 mr-2">
                                <button 
                                  onClick={() => handleEditArc(arc)}
                                  className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-blue-400 transition"
                                  title="Edit Arc"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteArc(arc)}
                                  className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-red-400 transition"
                                  title="Delete Arc"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}
                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${arc.status === 'active' ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-gray-800 text-gray-400'}`}>
                              {arc.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Overall Premise</p>
                          <p className="text-gray-300 text-sm whitespace-pre-wrap">{arc.description}</p>
                        </div>

                        <div className="mb-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                          <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Current Status / Latest Developments</p>
                          <p className="text-gray-200 text-sm whitespace-pre-wrap">{arc.current_status_text}</p>
                        </div>

                        {arc.status === 'completed' && arc.completion_summary && (
                          <div className="mb-4 p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                            <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-1">Conclusion</p>
                            <p className="text-orange-200 text-sm whitespace-pre-wrap">{arc.completion_summary}</p>
                          </div>
                        )}
                        
                        <div className="flex gap-6 text-xs text-gray-500 border-t border-gray-800 pt-4 mt-4">
                          <span>Started: {new Date(arc.start_date).toLocaleDateString()}</span>
                          <span>Target End: {new Date(arc.target_end_date).toLocaleDateString()}</span>
                          <span>Last Updated: {new Date(arc.last_update_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'following' && (
            <div className="p-6 max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <UserCheck className="text-orange-500" />
                Following
              </h2>
              <p className="text-gray-400 mb-6">
                Manage the characters you are currently following.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {users.filter(u => u.is_followed).map(char => (
                  <div key={char.id} className={`bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-3 hover:bg-gray-800 transition ${!char.is_active ? 'opacity-50 grayscale' : ''}`}>
                    <div className="flex items-center gap-3 cursor-pointer overflow-hidden flex-1" onClick={() => handleViewProfile(char.id)}>
                      <div className="relative flex-shrink-0">
                        <img src={char.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${char.username}`} alt={char.display_name} className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                        {char.is_active && isUserOnline(char) && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-900 rounded-full" title="Online"></div>
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-bold truncate flex items-center gap-2">
                          {char.display_name}
                          {!char.is_active && <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-gray-400">Inactive</span>}
                        </p>
                        <p className="text-xs text-gray-500 truncate">@{char.username}</p>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleFollow(char.id); }}
                      className="p-2 bg-gray-800 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-full transition flex-shrink-0"
                      title="Unfollow"
                    >
                      <UserCheck size={18} />
                    </button>
                  </div>
                ))}
                {users.filter(u => u.is_followed).length === 0 && (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    <UserCheck size={48} className="mx-auto mb-4 opacity-20" />
                    <p>You are not following any characters yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'arcs' && (
            <div className="p-6 max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <BookOpen className="text-orange-500" />
                Ongoing Arcs
              </h2>
              <p className="text-gray-400 mb-6">
                This tab shows all active and recently completed arcs for characters and universes.
              </p>
              
              <div className="space-y-4">
                {arcs.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No arcs have been generated yet.</p>
                  </div>
                ) : (
                  arcs.map((arc: any) => (
                    <div key={`${arc.arc_type}-${arc.id}`} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4 relative group">
                      {loggedInUser?.role === 'admin' && (
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                          <button 
                            onClick={() => handleEditArc(arc)}
                            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-blue-400 transition"
                            title="Edit Arc"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteArc(arc)}
                            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-red-400 transition"
                            title="Delete Arc"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {arc.entity_image ? (
                            <img src={arc.entity_image} alt={arc.entity_name} className="w-10 h-10 rounded-full object-cover bg-gray-800" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-500">
                              {arc.arc_type === 'universe' ? <Globe size={20} /> : <User size={20} />}
                            </div>
                          )}
                          <div>
                            <h3 className="font-bold text-lg leading-tight">{arc.title}</h3>
                            <p className="text-xs text-gray-500">
                              {arc.entity_name} {arc.entity_handle ? `(@${arc.entity_handle})` : ''} • {new Date(arc.last_update_date || arc.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${arc.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {arc.status === 'completed' ? 'Completed' : 'Active'}
                        </div>
                      </div>
                      
                      <div className="bg-black/30 rounded-xl p-4 text-sm space-y-3">
                        <div>
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Description</span>
                          <p className="text-gray-300 mt-1">{arc.description}</p>
                        </div>
                        
                        {arc.arc_type === 'universe' && arc.current_status_text && (
                          <div>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Current Status</span>
                            <p className="text-gray-300 mt-1 italic">"{arc.current_status_text}"</p>
                          </div>
                        )}

                        {arc.status === 'completed' && arc.completion_summary && (
                          <div className="pt-2 border-t border-gray-800/50">
                            <span className="text-xs font-bold text-green-500 uppercase tracking-wider">Conclusion</span>
                            <p className="text-gray-300 mt-1">{arc.completion_summary}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                
                {hasMoreArcs && arcs.length > 0 && (
                  <button 
                    onClick={() => fetchArcs(false)}
                    className="w-full py-4 text-center text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-800 rounded-xl transition font-bold mt-4"
                  >
                    Load More Arcs
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'relationships' && loggedInUser?.role === 'admin' && (
            <div className="p-6 max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Users className="text-orange-500" />
                Dynamic Relationships
              </h2>
              <p className="text-gray-400 mb-6">
                This tab shows all the times the AI evaluated whether two characters formed a meaningful relationship based on their interactions.
              </p>
              
              <div className="space-y-4">
                {relationshipChecks.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Users size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No relationship checks have occurred yet.</p>
                    <p className="text-sm mt-2">Characters need to interact more (comments or DMs) to trigger a check.</p>
                  </div>
                ) : (
                  relationshipChecks.map((check: any) => (
                    <div key={check.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex -space-x-4">
                            <img src={check.user1_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${check.user1_name}`} alt={check.user1_name} className="w-12 h-12 rounded-full border-2 border-gray-900 object-cover bg-gray-800" referrerPolicy="no-referrer" />
                            <img src={check.user2_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${check.user2_name}`} alt={check.user2_name} className="w-12 h-12 rounded-full border-2 border-gray-900 object-cover bg-gray-800" referrerPolicy="no-referrer" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg">{check.user1_name} & {check.user2_name}</h3>
                            <p className="text-xs text-gray-500">{new Date(check.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${check.result ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {check.result ? (check.is_update ? 'Relationship Updated' : 'Relationship Formed') : (check.is_update ? 'No Update Needed' : 'No Relationship')}
                        </div>
                      </div>
                      
                      <div className="bg-black/30 rounded-xl p-4 text-sm">
                        <div className="flex items-center gap-2 mb-2 text-gray-400">
                          <span className="font-mono text-xs bg-gray-800 px-2 py-0.5 rounded">Threshold: {check.interaction_threshold}</span>
                          {check.is_update ? <span className="font-mono text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Update Check</span> : <span className="font-mono text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">New Check</span>}
                        </div>
                        {check.description ? (
                          <p className="text-gray-300 italic">"{check.description}"</p>
                        ) : (
                          <p className="text-gray-500 italic">The AI determined their interactions were not significant enough to {check.is_update ? 'update their existing relationship' : 'form a hard-coded relationship'}.</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
                
                {hasMoreRelationshipChecks && relationshipChecks.length > 0 && (
                  <button 
                    onClick={() => fetchRelationshipChecks(false)}
                    className="w-full py-4 text-center text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-800 rounded-xl transition font-bold mt-4"
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
              <h2 className="text-2xl font-bold mb-6">Settings</h2>
              <div className="space-y-8">
                <section className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Lock size={20} className="text-orange-500" />
                    Security
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Update Login PIN</label>
                      <div className="flex gap-2">
                        <input 
                          type="password" 
                          maxLength={4}
                          placeholder="New 4-digit PIN"
                          className="flex-1 bg-gray-950 border border-gray-700 rounded-lg p-2 text-white outline-none focus:border-orange-500" 
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
                      <p className="text-xs text-gray-500 mt-2">Leave empty to remove PIN. Only 4-digit numeric PINs are supported.</p>
                    </div>
                  </div>
                </section>

                <section className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Globe size={20} className="text-orange-500" />
                    Localization
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Timezone</label>
                      <select 
                        value={timezone} 
                        onChange={e => handleUpdateSettings({ timezone: e.target.value })}
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500"
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
                  <section className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Users size={20} className="text-orange-500" />
                      User Management
                    </h3>
                    <p className="text-sm text-gray-400 mb-4">Add new real users to the platform. They will have their own profile, timeline, and messages.</p>
                    
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
                    }} className="space-y-4 border border-gray-800 p-4 rounded-xl">
                      <h4 className="font-bold text-sm">Add New User</h4>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Username (Required)</label>
                        <input name="username" required type="text" className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-white outline-none focus:border-orange-500 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Display Name</label>
                        <input name="display_name" type="text" className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-white outline-none focus:border-orange-500 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">PIN (Optional, 4 digits recommended)</label>
                        <input name="pin" type="password" className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-white outline-none focus:border-orange-500 text-sm" />
                      </div>
                      <button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition text-sm flex items-center gap-2">
                        <UserPlus size={16} /> Add User
                      </button>
                    </form>

                    <div className="mt-6">
                      <h4 className="font-bold text-sm mb-2">Existing Real Users</h4>
                      <div className="space-y-2">
                        {realUsers.map(u => (
                          <div key={u.id} className="flex items-center justify-between bg-gray-950 p-3 rounded-lg border border-gray-800">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-800 overflow-hidden">
                                {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <User size={16} className="m-2 text-gray-500" />}
                              </div>
                              <div>
                                <div className="font-bold text-sm">{u.display_name} {u.role === 'admin' && <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded ml-1">ADMIN</span>}</div>
                                <div className="text-xs text-gray-500">@{u.username}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {u.has_pin && <span className="text-xs text-green-500 flex items-center gap-1"><UserCheck size={12} /> PIN Set</span>}
                              <button 
                                onClick={() => handleEditProfile(u)}
                                className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition"
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
                  <section className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Settings size={20} className="text-orange-500" />
                      AI Generation
                    </h3>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="font-medium">Enable AI Background Worker</p>
                        <p className="text-sm text-gray-500 mt-1">When enabled, AI characters will automatically post, comment, and send DMs.</p>
                      </div>
                      <button 
                        onClick={toggleAiEnabled}
                        className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out ${aiEnabled ? 'bg-orange-500' : 'bg-gray-700'}`}
                      >
                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${aiEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="font-medium">Allow NSFW Content</p>
                        <p className="text-sm text-gray-500 mt-1">When enabled, AI characters may generate explicit language and mature themes.</p>
                      </div>
                      <button 
                        onClick={toggleNsfw}
                        className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out ${allowNsfw ? 'bg-orange-500' : 'bg-gray-700'}`}
                      >
                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${allowNsfw ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-400 mb-1">NanoGPT API Key</label>
                      <div className="flex gap-2">
                        <input 
                          type="password" 
                          value={apiKey}
                          onChange={e => setApiKey(e.target.value)}
                          placeholder="sk-nano-..."
                          className="flex-1 bg-gray-950 border border-gray-700 rounded-lg p-2 text-white outline-none focus:border-orange-500" 
                        />
                        <button onClick={saveApiKey} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition">
                          Save
                        </button>
                      </div>
                    </div>

                    <div className="mb-6">
                      <h4 className="text-md font-bold mb-2">AI Activity Probabilities (per Day)</h4>
                      <p className="text-sm text-gray-400 mb-4">Adjust how often AI characters perform actions on average per day.</p>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">Posts ({probPost}/day)</label>
                          <input 
                            type="range" min="0" max="500" value={probPost} 
                            onChange={e => handleUpdateSettings({ prob_post: parseInt(e.target.value) })}
                            className="w-full accent-orange-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">Comments ({probComment}/day)</label>
                          <input 
                            type="range" min="0" max="2000" value={probComment} 
                            onChange={e => handleUpdateSettings({ prob_comment: parseInt(e.target.value) })}
                            className="w-full accent-orange-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">Direct Messages ({probMessage}/day)</label>
                          <input 
                            type="range" min="0" max="50" value={probMessage} 
                            onChange={e => handleUpdateSettings({ prob_message: parseInt(e.target.value) })}
                            className="w-full accent-orange-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">Favorite DM Chance ({probFavoriteDm}%)</label>
                          <p className="text-xs text-gray-500 mb-2">Probability that a DM will be sent to a favorited conversation vs a random character.</p>
                          <input 
                            type="range" min="0" max="100" value={probFavoriteDm} 
                            onChange={e => handleUpdateSettings({ prob_favorite_dm: parseInt(e.target.value) })}
                            className="w-full accent-orange-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">Cross-Universe Interaction ({crossUniverseProb}%)</label>
                          <p className="text-xs text-gray-500 mb-2">Probability that a character will interact with someone from a different universe.</p>
                          <input 
                            type="range" min="0" max="100" value={crossUniverseProb} 
                            onChange={e => handleUpdateSettings({ cross_universe_prob: parseInt(e.target.value) })}
                            className="w-full accent-orange-500" 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <h4 className="text-md font-bold mb-2">Post Archetype Probabilities</h4>
                      <p className="text-sm text-gray-400 mb-4">Adjust the relative likelihood of each post type when an AI decides to post.</p>
                      <div className="space-y-4">
                        {archetypes.map((arch, index) => (
                          <div key={arch.id}>
                            <label className="block text-sm font-medium text-gray-400 mb-1">{arch.name} ({arch.probability})</label>
                            <input 
                              type="range" min="0" max="100" value={arch.probability} 
                              onChange={e => {
                                const newArchetypes = [...archetypes];
                                newArchetypes[index].probability = parseInt(e.target.value);
                                handleUpdateArchetypes(newArchetypes);
                              }}
                              className="w-full accent-orange-500" 
                            />
                            <p className="text-xs text-gray-500 mt-1">{arch.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-400 mb-1">LLM Model (NanoGPT)</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={modelName}
                          onChange={e => setModelName(e.target.value)}
                          className="flex-1 bg-gray-950 border border-gray-700 rounded-lg p-2 text-white outline-none focus:border-orange-500" 
                        />
                        <button onClick={saveModelName} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition">
                          Save
                        </button>
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-400 mb-1">Image Model (NanoGPT)</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={imageModelName}
                          onChange={e => setImageModelName(e.target.value)}
                          className="flex-1 bg-gray-950 border border-gray-700 rounded-lg p-2 text-white outline-none focus:border-orange-500" 
                        />
                        <button onClick={saveImageModelName} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition">
                          Save
                        </button>
                      </div>
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-400 mb-1">Vision Model (for user image uploads)</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={visionModelName}
                          onChange={e => setVisionModelName(e.target.value)}
                          className="flex-1 bg-gray-950 border border-gray-700 rounded-lg p-2 text-white outline-none focus:border-orange-500" 
                        />
                        <button onClick={saveVisionModelName} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition">
                          Save
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <button 
                        onClick={handleTestApi}
                        disabled={isTestingApi}
                        className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center gap-2"
                      >
                        {isTestingApi && <Loader2 size={16} className="animate-spin" />}
                        Test Connection
                      </button>
                      <button onClick={fetchApiLogs} className="text-sm text-gray-500 hover:text-orange-500 transition">Refresh Logs</button>
                    </div>

                    {testResult && (
                      <div className={`mt-4 p-4 rounded-lg ${testResult.success ? 'bg-green-900/30 text-green-400 border border-green-900' : 'bg-red-900/30 text-red-400 border border-red-900'}`}>
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
                  <section className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-500">
                      <Trash2 size={20} />
                      Danger Zone
                    </h3>
                    <p className="text-sm text-gray-400 mb-4">Resetting the database will delete data. This action cannot be undone.</p>
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
                  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 text-center">
                      <h3 className="text-xl font-bold mb-4 text-red-500 flex items-center justify-center gap-2">
                        <AlertTriangle size={24} /> Reset Database
                      </h3>
                      <p className="text-gray-400 mb-6">
                        {showResetConfirm === 'all' 
                          ? "Are you sure you want to delete all data? This will reset the simulation and cannot be undone."
                          : "Are you sure you want to delete all posts, comments, and messages? Characters will be kept. This cannot be undone."}
                      </p>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setShowResetConfirm(null)}
                          className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl transition"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={showResetConfirm === 'all' ? handleResetDb : handleResetContent}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition"
                        >
                          Yes, Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {loggedInUser?.role === 'admin' && (
                  <section className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-orange-400">
                      <Zap size={20} />
                      AI Controls
                    </h3>
                    <p className="text-sm text-gray-400 mb-4">Force a random AI character to generate a new post immediately.</p>
                    <div className="flex gap-4">
                      <button 
                        onClick={async () => {
                          const aiUsers = users.filter(u => u.is_ai);
                          if (aiUsers.length === 0) return showToast("No AI characters available");
                          const randomUser = aiUsers[Math.floor(Math.random() * aiUsers.length)];
                          await handleForcePost('text', randomUser.id);
                        }}
                        disabled={isForcingPost}
                        className="bg-gray-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-700 transition disabled:opacity-50"
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
                        className="bg-gray-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-700 transition disabled:opacity-50"
                      >
                        Force Random Image Post
                      </button>
                    </div>
                  </section>
                )}

                {loggedInUser?.role === 'admin' && (
                  <section className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold flex items-center gap-2 text-blue-400">
                        <MessageSquare size={20} />
                        API Logs
                      </h3>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">View recent API calls to NanoGPT for troubleshooting.</p>
                    <button 
                      onClick={() => {
                        fetchApiLogs();
                        setShowApiLogsModal(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition-colors w-full"
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
              <h2 className="text-2xl font-bold mb-6">Edit Profile: {editingProfile.display_name}</h2>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Display Name</label>
                  <input required value={profileName} onChange={e => setProfileName(e.target.value)} type="text" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
                  <input required value={profileUsername} onChange={e => setProfileUsername(e.target.value)} type="text" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" />
                </div>
                {editingProfile.is_ai === 0 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Login PIN (Optional)</label>
                      <input value={profilePin} onChange={e => setProfilePin(e.target.value)} type="password" maxLength={4} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" placeholder="4-digit PIN" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">DM Frequency from AI Characters</label>
                      <select value={profileDmFrequency} onChange={e => setProfileDmFrequency(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500">
                        <option value="never">Never (0%)</option>
                        <option value="low">Low (20%)</option>
                        <option value="medium">Medium (100%)</option>
                        <option value="high">High (300%)</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Controls how often AI characters you follow will initiate DMs with you.</p>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Profile Picture (URL or Upload)</label>
                  <div className="flex gap-2">
                    <input value={profileAvatar} onChange={e => setProfileAvatar(e.target.value)} type="text" className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" placeholder="https://..." />
                    <label className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-lg cursor-pointer flex items-center gap-2">
                      <UserPlus size={18} />
                      Upload
                      <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, setProfileAvatar)} />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Reference Images (Overrides Profile Pic for Image Gen)</label>
                  <div className="flex flex-col gap-2">
                    {profileReferenceImages.map((img, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        {img && <img src={img} alt="Ref" className="w-10 h-10 object-cover rounded" />}
                        <input value={img} onChange={e => {
                          const newImgs = [...profileReferenceImages];
                          newImgs[idx] = e.target.value;
                          setProfileReferenceImages(newImgs);
                        }} type="text" className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-2 text-white outline-none focus:border-orange-500" placeholder="Image URL..." />
                        <button type="button" onClick={() => setProfileReferenceImages(profileReferenceImages.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-400 p-2"><X size={16} /></button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setProfileReferenceImages([...profileReferenceImages, ''])} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                        <Plus size={16} /> Add URL
                      </button>
                      <label className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2 text-sm">
                        <Upload size={16} /> Upload Image
                        <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, (base64) => setProfileReferenceImages([...profileReferenceImages, base64]))} />
                      </label>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Public Bio</label>
                  <textarea value={profileBio} onChange={e => setProfileBio(e.target.value)} rows={3} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500"></textarea>
                </div>
                
                {editingProfile.is_ai === 1 && (
                  <div className="mt-8 pt-6 border-t border-gray-800">
                    <h3 className="text-lg font-bold mb-4 text-orange-500">AI Account Settings (Private)</h3>
                    <div className="space-y-4">
                      <div className="flex gap-4 mb-6">
                        <button
                          type="button"
                          onClick={() => setProfileAccountType('character')}
                          className={`flex-1 py-2 rounded-lg font-bold transition-colors ${profileAccountType === 'character' ? 'bg-orange-500 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}
                        >
                          Character
                        </button>
                        <button
                          type="button"
                          onClick={() => setProfileAccountType('company')}
                          className={`flex-1 py-2 rounded-lg font-bold transition-colors ${profileAccountType === 'company' ? 'bg-orange-500 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}
                        >
                          Company Account
                        </button>
                      </div>

                      {profileAccountType === 'company' && (
                        <div className="space-y-4 bg-gray-900/50 p-4 rounded-xl border border-gray-800 mb-6">
                          <h4 className="font-bold text-orange-400 mb-2 flex items-center gap-2"><Briefcase size={16} /> Company Details</h4>
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Company / Brand Name</label>
                            <input value={profileCompanyName} onChange={e => setProfileCompanyName(e.target.value)} type="text" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Brand Identity</label>
                            <textarea value={profileBrandIdentity} onChange={e => setProfileBrandIdentity(e.target.value)} rows={2} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500"></textarea>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Products / Services</label>
                            <textarea value={profileProductsServices} onChange={e => setProfileProductsServices(e.target.value)} rows={2} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500"></textarea>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Target Audience</label>
                            <input value={profileTargetAudience} onChange={e => setProfileTargetAudience(e.target.value)} type="text" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Run By Character (Optional)</label>
                            <select 
                              value={profileRunByCharacterId || ''} 
                              onChange={e => setProfileRunByCharacterId(e.target.value ? parseInt(e.target.value) : null)}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500"
                            >
                              <option value="">Nameless Employee</option>
                              {users.filter(u => u.is_ai && u.id !== editingProfile.id).map(u => (
                                <option key={u.id} value={u.id}>{u.display_name} (@{u.username})</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">General Description</label>
                        <textarea value={profileDescription} onChange={e => setProfileDescription(e.target.value)} rows={4} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500"></textarea>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Writing Style</label>
                        <textarea value={profileWritingStyle} onChange={e => setProfileWritingStyle(e.target.value)} rows={3} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500"></textarea>
                      </div>
                      {profileAccountType === 'character' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Physical Appearance</label>
                            <textarea value={profilePhysicalAppearance} onChange={e => setProfilePhysicalAppearance(e.target.value)} rows={2} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500"></textarea>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Clothing Style</label>
                            <textarea value={profileClothingStyle} onChange={e => setProfileClothingStyle(e.target.value)} rows={2} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500"></textarea>
                          </div>
                        </>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Artstyle</label>
                        <textarea value={profileArtstyle} onChange={e => setProfileArtstyle(e.target.value)} rows={2} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500"></textarea>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Universe</label>
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
                        <label className="block text-sm font-medium text-gray-400 mb-2">Online Time (Optional - Default: Always Online)</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-900/50 p-4 rounded-xl border border-gray-800">
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
                                className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-gray-900"
                              />
                              <span className="text-sm text-gray-300 group-hover:text-white transition">{window.label}</span>
                            </label>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2 italic">If no window is selected, the character is online 24/7.</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Activity Level (1-10)</label>
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
                        <p className="text-xs text-gray-500 mt-1">Dictates how often this character creates posts, comments, and DMs.</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="pt-6 border-t border-gray-800">
                  <h3 className="text-lg font-bold mb-4">Relationships</h3>
                  <div className="space-y-3 mb-4">
                    {profileRelationships.map(rel => (
                      <div key={rel.id} className="bg-gray-900 p-3 rounded-lg border border-gray-800 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <img src={rel.other_avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                          <div>
                            <p className="font-bold text-sm">{rel.other_name}</p>
                            <p className="text-xs text-gray-400">{rel.description}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => handleDeleteRelationship(rel.user_id_2)} className="text-red-500 hover:text-red-400">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {profileRelationships.length === 0 && (
                      <p className="text-sm text-gray-500">No relationships added yet.</p>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2 mb-2">
                    <label className="block text-xs font-medium text-gray-400">Search Character</label>
                    <input 
                      type="text" 
                      value={relSearch} 
                      onChange={e => setRelSearch(e.target.value)}
                      placeholder="Search by name or username..."
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white outline-none focus:border-orange-500"
                    />
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Character</label>
                      <select 
                        value={newRelUserId} 
                        onChange={e => setNewRelUserId(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white outline-none focus:border-orange-500"
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
                      <label className="block text-xs font-medium text-gray-400 mb-1">Description (e.g. "is best friends with")</label>
                      <input 
                        type="text" 
                        value={newRelDesc} 
                        onChange={e => setNewRelDesc(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white outline-none focus:border-orange-500"
                      />
                    </div>
                    <button 
                      type="button" 
                      onClick={handleAddRelationship}
                      disabled={!newRelUserId || !newRelDesc}
                      className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg transition"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  {editingProfile.is_ai === 1 && (
                    <button type="button" onClick={handleDeleteCharacter} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-full hover:bg-red-700 transition">
                      Delete Character
                    </button>
                  )}
                  <button type="button" onClick={() => { setActiveTab('home'); setEditingProfile(null); }} className="flex-1 bg-gray-800 text-white font-bold py-3 rounded-full hover:bg-gray-700 transition">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold py-3 rounded-full hover:from-orange-600 hover:to-yellow-600 transition shadow-lg">
                    Save Profile
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>

        {/* Right Sidebar */}
        <div className="w-80 p-4 hidden lg:flex sticky top-0 h-screen flex-col border-l border-gray-800">
          <div className="bg-gray-900 rounded-2xl p-4 flex-1 flex flex-col overflow-hidden min-h-0">
            <h2 className="font-bold text-xl mb-4">Characters</h2>
            <div className="mb-4">
              <input 
                type="text" 
                placeholder="Search characters..." 
                value={characterSearch}
                onChange={e => {
                  setCharacterSearch(e.target.value);
                  setVisibleCharacters(20);
                }}
                className="w-full bg-gray-800 text-white px-4 py-2 rounded-full outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="space-y-4 overflow-y-auto flex-1 pr-2 min-h-0">
              {users
                .filter(u => u.is_ai && (u.display_name.toLowerCase().includes(characterSearch.toLowerCase()) || u.username.toLowerCase().includes(characterSearch.toLowerCase())))
                .slice(0, characterSearch ? undefined : visibleCharacters)
                .map(u => (
                <div key={u.id} className={`flex items-center gap-3 group ${!u.is_active ? 'opacity-50 grayscale' : ''}`}>
                  <div 
                    onClick={() => handleViewProfile(u.id)}
                    className="relative w-10 h-10 flex-shrink-0 cursor-pointer"
                  >
                    <div className="w-full h-full bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
                      {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={20} />}
                    </div>
                    {u.is_ai === 1 && (
                      <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 ${isUserOnline(u) ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-500'}`} title={isUserOnline(u) ? 'Online' : 'Offline'}></div>
                    )}
                  </div>
                  <div 
                    onClick={() => handleViewProfile(u.id)}
                    className="flex-1 overflow-hidden cursor-pointer"
                  >
                    <p className="font-bold truncate text-sm group-hover:underline">{u.display_name}</p>
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
                        onClick={() => { setActiveTab('messages'); setActiveChat({ id: u.id, name: u.display_name, avatar_url: u.avatar_url }); fetchChatMessages(u.id); }}
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
              ))}
              {users.filter(u => u.is_ai && (u.display_name.toLowerCase().includes(characterSearch.toLowerCase()) || u.username.toLowerCase().includes(characterSearch.toLowerCase()))).length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">No characters found.</p>
              )}
              {!characterSearch && users.filter(u => u.is_ai).length > visibleCharacters && (
                <div className="flex justify-center py-4">
                  <button 
                    onClick={() => setVisibleCharacters(prev => prev + 20)}
                    className="bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold py-2 px-4 rounded-full transition"
                  >
                    Load More
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Viewing Post Modal */}
        {viewingPostData && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
              <button onClick={() => setViewingPostData(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition z-10">
                <X size={24} />
              </button>
              <div className="p-6 pt-12">
                <PostItem 
                  apiFetch={apiFetch}
                  loggedInUser={loggedInUser}
                  post={viewingPostData} 
                  onLike={() => handleLike(viewingPostData.id)} 
                  onViewProfile={(id) => { setViewingPostData(null); handleViewProfile(id); }}
                  onShowLikers={handleShowLikers}
                  formatTimestamp={formatTimestamp}
                  onRefresh={() => handleViewPost(viewingPostData.id)}
                  onViewApiLogs={handleViewApiLogs}
                  users={users}
                />
              </div>
            </div>
          </div>
        )}

        {/* Viewing Profile Modal */}
        {viewingProfile && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
              <button onClick={() => setViewingProfile(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition">
                <X size={24} />
              </button>
              
              <div className="h-32 bg-gradient-to-r from-orange-500 to-yellow-500"></div>
              <div className="px-6 pb-6">
                <div className="relative -mt-12 mb-4">
                  <div className="relative w-24 h-24 rounded-full border-4 border-gray-900 bg-gray-800 overflow-hidden">
                    {viewingProfile.avatar_url ? <img src={viewingProfile.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={48} className="m-auto mt-4" />}
                  </div>
                  {viewingProfile.is_ai === 1 && (
                    <div className={`absolute bottom-1 left-1 w-6 h-6 rounded-full border-4 border-gray-900 ${isUserOnline(viewingProfile) ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.8)]' : 'bg-gray-500'}`} title={isUserOnline(viewingProfile) ? 'Online' : 'Offline'}></div>
                  )}
                </div>
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold">{viewingProfile.display_name}</h2>
                      {viewingProfile.is_ai === 1 && (
                        <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full ${isUserOnline(viewingProfile) ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-gray-500/20 text-gray-500 border border-gray-500/30'}`}>
                          {isUserOnline(viewingProfile) ? 'Online' : 'Offline'}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500">@{viewingProfile.username}</p>
                    {viewingProfile.universe_id && universes.find(u => u.id === viewingProfile.universe_id) && (
                      <div 
                        onClick={() => handleViewUniverse(viewingProfile.universe_id)}
                        className="flex items-center gap-2 mt-2 text-sm text-orange-400 hover:text-orange-300 cursor-pointer w-fit bg-orange-500/10 px-3 py-1 rounded-full"
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
                          className="font-bold px-4 py-2 rounded-full transition bg-gray-800 text-white hover:bg-gray-700 flex items-center gap-2"
                        >
                          <Settings size={16} /> Edit
                        </button>
                      )}
                      <button 
                        onClick={() => handleFollow(viewingProfile.id)}
                        className={`font-bold px-6 py-2 rounded-full transition ${viewingProfile.is_followed ? 'bg-gray-800 text-white' : 'bg-white text-black'}`}
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
                            fetchChatMessages(existingChat.id, false);
                          } else {
                            setActiveChat({ id: viewingProfile.id, other_user: viewingProfile } as any);
                            setIsGroupChat(false);
                            setChatMessages([]);
                          }
                        }}
                        className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-6 py-2 rounded-full transition"
                      >
                        Message
                      </button>
                    </div>
                  )}
                </div>
                
                <p className="mb-4 whitespace-pre-wrap">{viewingProfile.bio}</p>
                
                {viewingProfile.account_type === 'company' && (
                  <div className="mb-4 space-y-2 text-sm bg-gray-950 p-4 rounded-xl border border-gray-800">
                    <div className="flex items-center gap-2 text-orange-400 font-bold mb-2">
                      <Briefcase size={16} /> Company Account
                    </div>
                    {viewingProfile.brand_identity && (
                      <p><span className="text-gray-500">Brand Identity:</span> {viewingProfile.brand_identity}</p>
                    )}
                    {viewingProfile.products_services && (
                      <p><span className="text-gray-500">Products/Services:</span> {viewingProfile.products_services}</p>
                    )}
                    {viewingProfile.target_audience && (
                      <p><span className="text-gray-500">Target Audience:</span> {viewingProfile.target_audience}</p>
                    )}
                    {viewingProfile.run_by_character_id && users.find(u => u.id === viewingProfile.run_by_character_id) && (
                      <p className="mt-2 pt-2 border-t border-gray-800">
                        <span className="text-gray-500">Run by:</span>{' '}
                        <span 
                          className="text-orange-400 hover:underline cursor-pointer"
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
                
                <div className="flex gap-4 text-sm text-gray-500 mb-6">
                  <span 
                    className="cursor-pointer hover:underline"
                    onClick={async () => {
                      const res = await apiFetch(`/api/users/${viewingProfile.id}/following`);
                      const data = await res.json();
                      setFollowersModal({ users: data, title: 'Following' });
                    }}
                  >
                    <strong className="text-white">{viewingProfile.following_count || 0}</strong> Following
                  </span>
                  <span 
                    className="cursor-pointer hover:underline"
                    onClick={async () => {
                      const res = await apiFetch(`/api/users/${viewingProfile.id}/followers`);
                      const data = await res.json();
                      setFollowersModal({ users: data, title: 'Followers' });
                    }}
                  >
                    <strong className="text-white">{viewingProfile.follower_count || 0}</strong> Followers
                  </span>
                </div>

                {viewingProfile.is_ai === 1 && (
                  <div className="mb-6 p-4 bg-gray-800/50 rounded-xl border border-gray-800">
                    <h4 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
                      <Sparkles size={14} /> AI Controls
                    </h4>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleForcePost('text')}
                        disabled={isForcingPost}
                        className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-bold py-2 rounded-lg transition flex items-center justify-center gap-2"
                      >
                        {isForcingPost ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                        Force Text Post
                      </button>
                      <button 
                        onClick={() => handleForcePost('image')}
                        disabled={isForcingPost}
                        className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-bold py-2 rounded-lg transition flex items-center justify-center gap-2"
                      >
                        {isForcingPost ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                        Force Image Post
                      </button>
                    </div>
                  </div>
                )}

                <div className="border-b border-gray-800 mb-4 flex gap-6">
                  <button 
                    onClick={() => setProfileActiveTab('posts')}
                    className={`pb-2 font-bold transition-colors ${profileActiveTab === 'posts' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Posts
                  </button>
                  {viewingProfile.is_ai === 1 && (
                    <button 
                      onClick={() => setProfileActiveTab('arcs')}
                      className={`pb-2 font-bold transition-colors ${profileActiveTab === 'arcs' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      Character Arcs
                    </button>
                  )}
                </div>

                <div className="mt-6">
                  {profileActiveTab === 'posts' ? (
                    <div className="space-y-4">
                      {viewingProfilePosts.slice(0, visibleProfilePosts).map(post => (
                        <PostItem 
                          apiFetch={apiFetch}
                          loggedInUser={loggedInUser}
                          key={post.id} 
                          post={{...post, display_name: viewingProfile.display_name, username: viewingProfile.username, avatar_url: viewingProfile.avatar_url}} 
                          onLike={() => handleLike(post.id)} 
                          onViewProfile={handleViewProfile}
                          onShowLikers={handleShowLikers}
                          formatTimestamp={formatTimestamp}
                          onRefresh={() => handleViewProfile(viewingProfile.id)}
                          onViewApiLogs={handleViewApiLogs}
                          users={users}
                        />
                      ))}
                      {viewingProfilePosts.length > visibleProfilePosts && (
                        <div className="flex justify-center py-4">
                          <button 
                            onClick={() => setVisibleProfilePosts(prev => prev + 30)}
                            className="bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold py-2 px-4 rounded-full transition"
                          >
                            Load More
                          </button>
                        </div>
                      )}
                      {viewingProfilePosts.length === 0 && <p className="text-center text-gray-500 py-4">No posts yet.</p>}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {loggedInUser?.role === 'admin' && (
                        <div className="flex gap-2 mb-4">
                          <button 
                            onClick={() => handleAddArc('character', viewingProfile.id)}
                            className="flex items-center gap-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold transition"
                          >
                            <Plus size={14} /> Add Manual Arc
                          </button>
                          <button 
                            onClick={() => handleGenerateArc('character', viewingProfile.id)}
                            disabled={isGeneratingArc}
                            className="flex items-center gap-2 text-xs bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-lg font-bold transition disabled:opacity-50"
                          >
                            <Sparkles size={14} /> {isGeneratingArc ? 'Generating...' : 'Generate AI Arc'}
                          </button>
                        </div>
                      )}
                      {viewingProfileArcs.length === 0 ? (
                        <p className="text-center text-gray-500 py-4">No arcs yet.</p>
                      ) : (
                        viewingProfileArcs.map(arc => (
                          <div key={arc.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="font-bold text-lg text-white">{arc.title}</h3>
                              <div className="flex items-center gap-2">
                                {loggedInUser?.role === 'admin' && (
                                  <div className="flex gap-1 mr-2">
                                    <button 
                                      onClick={() => handleEditArc(arc)}
                                      className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded text-blue-400 transition"
                                      title="Edit Arc"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteArc(arc)}
                                      className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded text-red-400 transition"
                                      title="Delete Arc"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                )}
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${arc.status === 'active' ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-gray-800 text-gray-400'}`}>
                                  {arc.status.toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <p className="text-gray-400 text-sm mb-4 whitespace-pre-wrap">{arc.description}</p>
                            {arc.status === 'completed' && arc.completion_summary && (
                              <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                <p className="text-xs font-bold text-orange-500 mb-1">Conclusion</p>
                                <p className="text-sm text-gray-300">{arc.completion_summary}</p>
                              </div>
                            )}
                            <div className="mt-4 flex gap-4 text-xs text-gray-500">
                              <span>Started: {new Date(arc.start_date).toLocaleDateString()}</span>
                              <span>Target End: {new Date(arc.target_end_date).toLocaleDateString()}</span>
                            </div>
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[70vh]">
              <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                <h3 className="font-bold">Liked by</h3>
                <button onClick={() => setLikersModal(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {likersModal.users.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-3 hover:bg-gray-800 rounded-xl cursor-pointer" onClick={() => { handleViewProfile(u.id); setLikersModal(null); }}>
                    <div className="w-10 h-10 bg-gray-700 rounded-full overflow-hidden">
                      {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={20} className="m-auto mt-2" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{u.display_name}</p>
                      <p className="text-gray-500 text-xs">@{u.username}</p>
                    </div>
                  </div>
                ))}
                {likersModal.users.length === 0 && <p className="text-center text-gray-500 py-8">No likes yet.</p>}
              </div>
            </div>
          </div>
        )}

        {/* Followers/Following Modal */}
        {followersModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[70vh]">
              <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                <h3 className="font-bold">{followersModal.title}</h3>
                <button onClick={() => setFollowersModal(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {followersModal.users.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-3 hover:bg-gray-800 rounded-xl cursor-pointer" onClick={() => { handleViewProfile(u.id); setFollowersModal(null); }}>
                    <div className="w-10 h-10 bg-gray-700 rounded-full overflow-hidden">
                      {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={20} className="m-auto mt-2" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{u.display_name}</p>
                      <p className="text-gray-500 text-xs">@{u.username}</p>
                    </div>
                  </div>
                ))}
                {followersModal.users.length === 0 && <p className="text-center text-gray-500 py-8">No users found.</p>}
              </div>
            </div>
          </div>
        )}

        {/* API Logs Modal */}
      {showApiLogsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2 text-blue-400">
                <MessageSquare size={24} />
                API Logs
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => fetchApiLogs(apiLogSearch)}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded-lg transition-colors"
                >
                  Refresh Logs
                </button>
                <button onClick={() => setShowApiLogsModal(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
              </div>
            </div>
            
            <div className="mb-4 flex gap-2">
              <input 
                type="text" 
                value={apiLogSearch} 
                onChange={(e) => setApiLogSearch(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && fetchApiLogs(apiLogSearch)}
                placeholder="Search logs by content..." 
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <button 
                onClick={() => fetchApiLogs(apiLogSearch)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Search
              </button>
              <button
                onClick={() => {
                  const newErrorOnly = !apiLogShowErrorsOnly;
                  setApiLogShowErrorsOnly(newErrorOnly);
                  fetchApiLogs(apiLogSearch, newErrorOnly);
                }}
                className={`${apiLogShowErrorsOnly ? 'bg-red-600 hover:bg-red-500' : 'bg-gray-700 hover:bg-gray-600'} text-white px-4 py-2 rounded-lg text-sm transition-colors`}
              >
                Errors Only
              </button>
              {apiLogSearch && (
                <button 
                  onClick={() => { setApiLogSearch(''); fetchApiLogs(''); }}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-2">
              {apiLogs.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No API logs found.</div>
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
                    <div key={log.id} className={`bg-gray-800 rounded-xl text-xs font-mono border ${isError ? 'border-red-500/50' : 'border-green-500/50'} overflow-hidden transition-colors`}>
                      <div 
                        className={`p-3 flex justify-between items-center cursor-pointer ${isError ? 'bg-red-900/20 hover:bg-red-900/30' : 'bg-green-900/20 hover:bg-green-900/30'}`}
                        onClick={() => toggleLogExpansion(log.id)}
                      >
                        <div className="flex items-center gap-3">
                          {log.user_profile_picture ? (
                            <img src={log.user_profile_picture} alt={log.user_display_name} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-400">
                              <User size={16} />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-white text-sm flex items-center gap-2">
                              {log.endpoint}
                              {isError && <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider">Error</span>}
                            </div>
                            <div className="text-gray-400 text-[10px]">{log.user_display_name || 'System'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] opacity-60 text-gray-400">{formatTimestamp(log.created_at)}</span>
                          <span className="text-gray-500">{isExpanded ? '▼' : '▶'}</span>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-4 border-t border-gray-700">
                          <div className="mb-3 space-y-1">
                            <div className="text-gray-500 uppercase text-[9px] tracking-wider font-bold">Request Details</div>
                            <div className="bg-black/30 p-2 rounded border border-white/5 overflow-x-auto whitespace-pre-wrap">
                              {Object.entries(requestObj).map(([key, val]) => (
                                <div key={key} className="mb-1 last:mb-0">
                                  <span className="text-orange-400">{key}:</span> <span className="text-gray-300">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-gray-500 uppercase text-[9px] tracking-wider font-bold">Response</div>
                            {(() => {
                              try {
                                const resObj = JSON.parse(log.response_payload);
                                return (
                                  <div className="space-y-2">
                                    {resObj.reasoning && (
                                      <div className="bg-blue-900/10 border border-blue-500/20 p-2 rounded">
                                        <div className="text-[10px] text-blue-400 font-bold mb-1 uppercase tracking-tighter">Thinking / Reasoning</div>
                                        <div className="text-gray-400 italic">{resObj.reasoning}</div>
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
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Create Group Chat</h3>
                <button onClick={() => setShowCreateGroupModal(false)} className="text-gray-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Group Name</label>
                  <input 
                    type="text" 
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-orange-500"
                    placeholder="Enter group name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Select Members</label>
                  <input
                    type="text"
                    value={groupSearchQuery}
                    onChange={e => setGroupSearchQuery(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 mb-2 outline-none focus:border-orange-500 text-sm"
                    placeholder="Search characters..."
                  />
                  <div className="max-h-60 overflow-y-auto space-y-2 border border-gray-800 rounded-xl p-2">
                    {users.filter(u => u.id !== loggedInUser?.id && u.display_name.toLowerCase().includes(groupSearchQuery.toLowerCase())).map(user => (
                      <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg cursor-pointer">
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
                          className="w-5 h-5 rounded border-gray-700 text-orange-500 focus:ring-orange-500 bg-gray-900"
                        />
                        <div className="relative w-8 h-8 bg-gray-700 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden">
                          {user.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={16} />}
                          {user.is_ai === 1 ? (
                            <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-gray-900 ${isUserOnline(user) ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]' : 'bg-gray-500'}`} title={isUserOnline(user) ? 'Online' : 'Offline'}></div>
                          ) : (
                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-gray-900 bg-blue-500" title="Real User"></div>
                          )}
                        </div>
                        <span className="font-medium">{user.display_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button 
                  onClick={handleCreateGroupChat}
                  disabled={!newGroupName.trim() || selectedGroupMembers.length === 0}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-xl transition"
                >
                  Create Group
                </button>
              </div>
            </div>
          </div>
        )}

        {expandedImageUrl && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setExpandedImageUrl(null)}
          >
            <img 
              src={expandedImageUrl} 
              alt="Expanded image" 
              className="max-w-full max-h-full object-contain rounded-lg" 
              referrerPolicy="no-referrer" 
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition"
              onClick={() => setExpandedImageUrl(null)}
            >
              <X size={24} />
            </button>
          </div>
        )}

        {showGallery && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
              <div className="flex justify-between items-center p-4 border-b border-gray-800">
                <h3 className="font-bold text-xl flex items-center gap-2"><Image size={24} /> Gallery</h3>
                <button onClick={() => setShowGallery(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {chatMessages.filter(msg => msg.image_url).map((msg, idx) => (
                    <div key={idx} className="aspect-square rounded-lg overflow-hidden border border-gray-800 cursor-pointer hover:border-orange-500 transition" onClick={() => setExpandedImageUrl(msg.image_url)}>
                      <img src={msg.image_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  ))}
                  {chatMessages.filter(msg => msg.image_url).length === 0 && (
                    <div className="col-span-full text-center text-gray-500 py-8">No images in this chat yet.</div>
                  )}
                </div>
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
      className={`flex items-center gap-4 p-3 rounded-full cursor-pointer transition duration-200 w-fit xl:w-full ${active ? 'font-bold' : 'hover:bg-gray-900'}`}
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
            className="text-orange-500 hover:underline cursor-pointer font-bold"
          >
            {part}
          </span>
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}

function FauxPicItem({ post, onLike, onViewProfile, onShowLikers, formatTimestamp, onRefresh, users, loggedInUser, apiFetch }: { post: any, onLike: () => void, onViewProfile: (id: number) => void, onShowLikers: (type: 'post' | 'comment', id: number) => void, formatTimestamp: (ts: string) => string, onRefresh: () => void, users?: any[], loggedInUser?: any, apiFetch: any }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  const fetchComments = useCallback(() => {
    apiFetch(`/api/posts/${post.id}/comments`).then((r: any) => r.json()).then(setComments);
  }, [post.id, apiFetch]);

  useEffect(() => {
    if (showComments) {
      fetchComments();
      const interval = setInterval(fetchComments, 10000);
      return () => clearInterval(interval);
    }
  }, [showComments, fetchComments]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSendingComment) return;
    setIsSendingComment(true);
    try {
      await apiFetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment })
      });
      setNewComment('');
      fetchComments();
      onRefresh();
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleCommentLike = async (commentId: number) => {
    await apiFetch(`/api/comments/${commentId}/like`, { method: 'POST' });
    fetchComments();
  };

  const handleAddReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || isSendingReply || !replyingTo) return;
    setIsSendingReply(true);
    try {
      await apiFetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyContent, parent_id: replyingTo.id })
      });
      setReplyContent('');
      setReplyingTo(null);
      fetchComments();
    } finally {
      setIsSendingReply(false);
    }
  };

  const rootComments = comments.filter(c => !c.parent_id);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => onViewProfile(post.user_id)}>
        <img src={post.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
        <span className="font-bold text-sm hover:underline">{post.display_name}</span>
      </div>
      <div className="bg-black flex items-center justify-center min-h-[300px]">
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
            <button onClick={onLike} className="hover:scale-110 transition">
              <Heart className={post.is_liked ? "fill-red-500 text-red-500" : "text-white"} size={24} />
            </button>
            {post.like_count > 0 && (
              <button onClick={() => onShowLikers('post', post.id)} className="text-sm font-bold hover:underline">{post.like_count}</button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowComments(!showComments)} className="hover:scale-110 transition">
              <MessageCircle size={24} className={showComments ? "text-orange-500" : "text-white"} />
            </button>
            {post.comment_count > 0 && (
              <span className="text-sm font-bold">{post.comment_count}</span>
            )}
          </div>
          <Send size={24} />
        </div>
        <p className="text-sm">
          <span className="font-bold mr-2 cursor-pointer hover:underline" onClick={() => onViewProfile(post.user_id)}>{post.display_name}</span>
          {renderContentWithTags(post.content.replace(/\(.*?\)/g, '').trim(), users, onViewProfile)}
        </p>
        <p className="text-xs text-gray-500 mt-2 uppercase tracking-tighter">
          {formatTimestamp(post.created_at)}
        </p>

        {showComments && (
          <div className="mt-4 pt-4 border-t border-gray-800 space-y-4">
            <div className="max-h-[400px] overflow-y-auto space-y-4 pr-2">
              {rootComments.length === 0 ? (
                <p className="text-gray-500 text-xs italic">No comments yet</p>
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
                className="flex-1 bg-transparent border-b border-gray-800 py-1 text-sm outline-none focus:border-orange-500"
              />
              <button type="submit" disabled={!newComment.trim()} className="text-orange-500 font-bold text-sm disabled:opacity-50">Post</button>
            </form>
          </div>
        )}
      </div>

      {replyingTo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6">
            <h3 className="font-bold mb-4">Replying to @{replyingTo.name}</h3>
            <form onSubmit={handleAddReply}>
              <TagTextarea 
                users={users || []}
                autoFocus
                value={replyContent}
                onValueChange={setReplyContent}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-orange-500 mb-4"
                rows={4}
                placeholder="Write your reply..."
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setReplyingTo(null)} className="px-4 py-2 text-gray-400 hover:text-white transition">Cancel</button>
                <button type="submit" disabled={!replyContent.trim() || isSendingReply} className="px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold transition disabled:opacity-50">Reply</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PostItem({ post, onLike, onViewProfile, onShowLikers, formatTimestamp, onRefresh, highlightedPostId, highlightedCommentId, onHighlightClear, users, loggedInUser, apiFetch, onViewApiLogs }: { key?: any, post: any, onLike: () => void, onViewProfile: (id: number) => void, onShowLikers: (type: 'post' | 'comment', id: number) => void, formatTimestamp: (ts: string) => string, onRefresh: () => void, highlightedPostId?: number | null, highlightedCommentId?: number | null, onHighlightClear?: () => void, users?: any[], loggedInUser?: any, apiFetch: any, onViewApiLogs?: (content: string) => void }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
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
    apiFetch(`/api/posts/${post.id}/comments`).then(r => r.json()).then(data => {
      setComments(data);
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
    });
  };

  useEffect(() => {
    if (showComments) {
      fetchComments();
      const interval = setInterval(() => {
        fetchComments();
      }, 10000); // Poll every 10s
      return () => clearInterval(interval);
    }
  }, [showComments, post.comment_count]);

  const handleDelete = async () => {
    await apiFetch(`/api/posts/${post.id}`, { method: 'DELETE' });
    onRefresh();
  };

  const handleEdit = async () => {
    await apiFetch(`/api/posts/${post.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent })
    });
    setIsEditing(false);
    onRefresh();
  };

  const handleAddComment = async (e: React.FormEvent, parentId: number | null = null) => {
    e.preventDefault();
    const content = parentId ? replyingTo.content : newComment;
    if (!content.trim() || isSendingComment) return;
    
    setIsSendingComment(true);
    try {
      await apiFetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, parent_id: parentId })
      });
      
      if (parentId) {
        setReplyingTo(null);
      } else {
        setNewComment('');
      }
      fetchComments();
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleCommentLike = async (commentId: number) => {
    await apiFetch(`/api/comments/${commentId}/like`, { method: 'POST' });
    fetchComments();
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
      className={`border-b border-gray-800 p-4 hover:bg-gray-900/50 transition ${highlightedPostId === post.id && !highlightedCommentId ? 'bg-orange-900/20 ring-2 ring-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : ''}`}
    >
      <div className="flex gap-4">
        <div 
          onClick={() => onViewProfile(post.user_id)}
          className="w-10 h-10 bg-gray-700 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer"
        >
          {post.avatar_url ? <img src={post.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={20} />}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => onViewProfile(post.user_id)}>
              <span className="font-bold hover:underline">{post.display_name}</span>
              <span className="text-gray-500 text-sm">@{post.username}</span>
              <span className="text-gray-500 text-sm">· {formatTimestamp(post.created_at)}</span>
            </div>
            <button onClick={() => setShowMenu(!showMenu)} className="text-gray-500 hover:text-orange-500"><MoreHorizontal size={18} /></button>
            {showMenu && (
              <div className="absolute right-0 top-6 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-10 w-36 overflow-hidden">
                <button onClick={() => { setIsEditing(true); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition">Edit</button>
                <button onClick={() => { handleDelete(); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-800 transition">Delete</button>
                {loggedInUser?.role === 'admin' && onViewApiLogs && (
                  <button onClick={() => { onViewApiLogs(post.content); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-blue-400 hover:bg-gray-800 transition border-t border-gray-800">View API Logs</button>
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
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white outline-none focus:border-orange-500"
                rows={3}
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-sm text-gray-400 hover:text-white">Cancel</button>
                <button onClick={handleEdit} className="px-3 py-1 text-sm bg-orange-600 hover:bg-orange-500 text-white rounded-full">Save</button>
              </div>
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-wrap">{renderContentWithTags(post.content, users, onViewProfile)}</p>
          )}
          {post.image_url && (
            <>
              <div 
                className="mt-3 rounded-2xl overflow-hidden border border-gray-800 max-h-[500px] cursor-pointer"
                onClick={() => setIsImageExpanded(true)}
              >
                <img src={post.image_url} alt="Post image" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              {isImageExpanded && (
                <div 
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
                  onClick={() => setIsImageExpanded(false)}
                >
                  <img 
                    src={post.image_url} 
                    alt="Expanded post image" 
                    className="max-w-full max-h-full object-contain rounded-lg" 
                    referrerPolicy="no-referrer" 
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button 
                    className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition"
                    onClick={() => setIsImageExpanded(false)}
                  >
                    <X size={24} />
                  </button>
                </div>
              )}
            </>
          )}
          <div className="flex gap-12 mt-3 text-gray-500">
            <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 hover:text-orange-500 transition">
              <MessageCircle size={18} />
              <span className="text-sm">{post.comment_count}</span>
            </button>
            <div className="flex items-center gap-1">
              <button onClick={onLike} className={`flex items-center gap-2 hover:text-pink-500 transition ${post.is_liked ? 'text-pink-500' : ''}`}>
                <Heart size={18} fill={post.is_liked ? "currentColor" : "none"} />
                <span className="text-sm">{post.like_count}</span>
              </button>
              {post.like_count > 0 && (
                <button onClick={() => onShowLikers('post', post.id)} className="text-[10px] hover:underline">view</button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {showComments && (
        <div className="mt-4 pl-10 space-y-4 border-l-2 border-gray-800 ml-5">
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
              highlightedCommentId={highlightedCommentId}
              commentRef={(id, el) => { commentRefs.current[id] = el; }}
              users={users}
              onViewApiLogs={onViewApiLogs}
            />
          ))}
          
          <form onSubmit={(e) => handleAddComment(e)} className="flex gap-2 mt-4 items-end">
            <div className="w-8 h-8 bg-blue-900 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xs mb-1 overflow-hidden">
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
                className="w-full bg-transparent border-b border-gray-700 pb-1 outline-none focus:border-orange-500 text-sm resize-none"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment(e);
                  }
                }}
              />
            </div>
            <button type="submit" disabled={!newComment.trim()} className="text-orange-500 font-bold text-sm disabled:opacity-50 mb-1">Reply</button>
          </form>
        </div>
      )}

      {replyingTo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6">
            <h3 className="font-bold mb-4">Replying to @{replyingTo.name}</h3>
            <TagTextarea 
              users={users}
              autoFocus
              value={replyingTo.content}
              onValueChange={val => setReplyingTo({...replyingTo, content: val})}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-orange-500 mb-4"
              placeholder="Write your reply..."
              rows={4}
            />
            <div className="flex gap-3">
              <button onClick={() => setReplyingTo(null)} className="flex-1 bg-gray-800 text-white font-bold py-2 rounded-full">Cancel</button>
              <button onClick={(e) => handleAddComment(e as any, replyingTo.id)} className="flex-1 bg-orange-500 text-white font-bold py-2 rounded-full">Reply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentItem({ comment, onLike, onReply, onViewProfile, onShowLikers, formatTimestamp, onRefresh, highlightedCommentId, commentRef, users, loggedInUser, apiFetch, onViewApiLogs }: { key?: any, comment: any, onLike: (id: number) => void, onReply: (c: any) => void, onViewProfile: (id: number) => void, onShowLikers: (type: 'post' | 'comment', id: number) => void, formatTimestamp: (ts: string) => string, onRefresh: () => void, highlightedCommentId?: number | null, commentRef?: (id: number, el: HTMLDivElement | null) => void, users?: any[], loggedInUser?: any, apiFetch: any, onViewApiLogs?: (content: string) => void }) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  useEffect(() => {
    setEditContent(comment.content);
  }, [comment.content]);

  const handleDelete = async () => {
    await apiFetch(`/api/comments/${comment.id}`, { method: 'DELETE' });
    onRefresh();
  };

  const handleEdit = async () => {
    await apiFetch(`/api/comments/${comment.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent })
    });
    setIsEditing(false);
    onRefresh();
  };

  return (
    <div className="space-y-3" ref={(el) => commentRef && commentRef(comment.id, el)}>
      <div className={`flex gap-3 group p-2 -m-2 rounded-xl transition ${highlightedCommentId === comment.id ? 'bg-orange-900/20 ring-2 ring-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : ''}`}>
        <div 
          onClick={() => onViewProfile(comment.user_id)}
          className="w-8 h-8 bg-gray-700 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer"
        >
          {comment.avatar_url ? <img src={comment.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={16} />}
        </div>
        <div className="flex-1">
          <div className="bg-gray-900 p-3 rounded-2xl rounded-tl-none border border-gray-800 group-hover:border-gray-700 transition">
            <div className="flex items-center justify-between mb-1 relative">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => onViewProfile(comment.user_id)}>
                <span className="font-bold text-sm hover:underline">{comment.display_name}</span>
                <span className="text-gray-500 text-xs">@{comment.username}</span>
                <span className="text-gray-500 text-xs">· {formatTimestamp(comment.created_at)}</span>
              </div>
              <button onClick={() => setShowMenu(!showMenu)} className="text-gray-500 hover:text-orange-500"><MoreHorizontal size={14} /></button>
              {showMenu && (
                <div className="absolute right-0 top-5 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-10 w-36 overflow-hidden">
                  <button onClick={() => { setIsEditing(true); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition">Edit</button>
                  <button onClick={() => { handleDelete(); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-800 transition">Delete</button>
                  {loggedInUser?.role === 'admin' && onViewApiLogs && (
                    <button onClick={() => { onViewApiLogs(comment.content); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-blue-400 hover:bg-gray-800 transition border-t border-gray-800">View API Logs</button>
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
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white outline-none focus:border-orange-500 text-sm"
                  rows={2}
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-xs text-gray-400 hover:text-white">Cancel</button>
                  <button onClick={handleEdit} className="px-3 py-1 text-xs bg-orange-600 hover:bg-orange-500 text-white rounded-full">Save</button>
                </div>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{renderContentWithTags(comment.content, users, onViewProfile)}</p>
            )}
          </div>
          <div className="flex gap-6 mt-1 ml-2 text-gray-500">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => onLike(comment.id)} 
                className={`flex items-center gap-1 text-xs hover:text-pink-500 transition ${comment.is_liked ? 'text-pink-500' : ''}`}
              >
                <Heart size={12} fill={comment.is_liked ? "currentColor" : "none"} />
                <span>{comment.like_count || 0}</span>
              </button>
              {comment.like_count > 0 && (
                <button onClick={() => onShowLikers('comment', comment.id)} className="text-[9px] hover:underline">view</button>
              )}
            </div>
            <button onClick={() => onReply(comment)} className="text-xs hover:text-orange-500 transition font-bold">Reply</button>
          </div>
        </div>
      </div>
      
      {comment.replies && comment.replies.length > 0 && (
        <div className="pl-6 space-y-3 border-l border-gray-800 ml-4">
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
}
