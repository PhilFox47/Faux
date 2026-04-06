import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import db, { initDb } from "./src/db";
import { generatePost, generateImagePostData, generateComment, generateDM, replyToDM, testConnection, generatePersona, generateImage, generateImagePrompt, generateNegativeImagePrompt, generateGroupChatReply, pickBestCommenter, pickArchetype, evaluateDynamicRelationship, analyzeImage, generateNewArc, concludeArc, generateNewUniverseArc, updateUniverseArc, concludeUniverseArc, logApi } from "./src/ai";

const pendingComments = new Set<string>();
const pendingDMs = new Set<string>();
const pendingGroupChats = new Set<string>();

const timeFormatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timezone: string) {
  if (!timeFormatters.has(timezone)) {
    timeFormatters.set(timezone, new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }));
  }
  return timeFormatters.get(timezone)!;
}

function isUserOnline(user: any, timezone: string) {
  // Determine the correct user ID based on the object structure
  let userId = user.id;
  if (user.ai_user_id) userId = user.ai_user_id; // From unrepliedMentions
  else if (user.receiver_id && user.sender_id) userId = user.receiver_id; // From unrepliedDms

  if (!userId) return true;

  let dbUser = user;
  if (user.current_online_status === undefined || user.status_expires_at === undefined || user.activity_level === undefined) {
    dbUser = db.prepare("SELECT online_times, activity_level, current_online_status, status_expires_at FROM users WHERE id = ?").get(userId) as any;
    if (!dbUser) return true;
  }

  const now = Date.now();
  if (dbUser.status_expires_at && now < dbUser.status_expires_at) {
    return dbUser.current_online_status === 1;
  }

  let inOnlineTimeframe = true;
  if (dbUser.online_times && dbUser.online_times !== '[]') {
    try {
      let onlineTimes = dbUser._parsed_online_times;
      if (!onlineTimes) {
        onlineTimes = typeof dbUser.online_times === 'string' ? JSON.parse(dbUser.online_times) : dbUser.online_times;
        dbUser._parsed_online_times = onlineTimes;
      }
      
      if (onlineTimes && onlineTimes.length > 0) {
        const localTime = getFormatter(timezone).format(new Date(now));
        let [currentHour, currentMinute] = localTime.split(':').map(Number);
        if (currentHour === 24) currentHour = 0;
        const currentTimeInMinutes = currentHour * 60 + currentMinute;

        inOnlineTimeframe = onlineTimes.some((window: string) => {
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
            return currentTimeInMinutes >= startTotal || currentTimeInMinutes < endTotal;
          }
        });
      }
    } catch (e) {}
  }

  const activityLevel = dbUser.activity_level ?? 5;
  let chance = 0;
  let minDuration = 5;
  let maxDuration = 25;

  if (inOnlineTimeframe) {
    chance = 50 + (5 * activityLevel);
    minDuration = 5;
    maxDuration = 25;
  } else {
    chance = 0 + (2 * activityLevel);
    minDuration = 2;
    maxDuration = 25;
  }

  const isOnline = (Math.random() * 100) < chance;
  const durationMinutes = Math.floor(Math.random() * (maxDuration - minDuration + 1)) + minDuration;
  const expiresAt = now + (durationMinutes * 60 * 1000);

  try {
    db.prepare("UPDATE users SET current_online_status = ?, status_expires_at = ? WHERE id = ?")
      .run(isOnline ? 1 : 0, expiresAt, userId);
  } catch(e) {
    console.error("Failed to update user online status", e);
  }

  user.current_online_status = isOnline ? 1 : 0;
  user.status_expires_at = expiresAt;

  return isOnline;
}

function pickWeightedRandomUser(users: any[]) {
  if (!users || users.length === 0) return null;
  const totalWeight = users.reduce((sum, u) => sum + (u.activity_level ?? 5), 0);
  let random = Math.random() * totalWeight;
  for (const user of users) {
    random -= (user.activity_level ?? 5);
    if (random <= 0) return user;
  }
  return users[users.length - 1];
}

async function checkDynamicRelationship(user1Id: number, user2Id: number) {
  if (user1Id === user2Id) return;
  
  const user1 = db.prepare("SELECT account_type, universe_id FROM users WHERE id = ?").get(user1Id) as any;
  const user2 = db.prepare("SELECT account_type, universe_id FROM users WHERE id = ?").get(user2Id) as any;

  if (!user1 || !user2) return;

  const isUser1Company = user1.account_type === 'company';
  const isUser2Company = user2.account_type === 'company';

  // Companies cannot form relationships with characters
  if ((isUser1Company && !isUser2Company) || (!isUser1Company && isUser2Company)) return;

  // If both are companies, they must be from the same universe
  if (isUser1Company && isUser2Company && user1.universe_id !== user2.universe_id) return;

  // Check if relationship already exists
  const existingRel = db.prepare("SELECT * FROM relationships WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)").get(user1Id, user2Id, user2Id, user1Id) as any;

  // Get interaction counts
  const commentsCount = (db.prepare(`
    SELECT COUNT(*) as count FROM comments 
    WHERE (user_id = ? AND post_id IN (SELECT id FROM posts WHERE user_id = ?))
       OR (user_id = ? AND post_id IN (SELECT id FROM posts WHERE user_id = ?))
       OR (user_id = ? AND parent_id IN (SELECT id FROM comments WHERE user_id = ?))
       OR (user_id = ? AND parent_id IN (SELECT id FROM comments WHERE user_id = ?))
  `).get(user1Id, user2Id, user2Id, user1Id, user1Id, user2Id, user2Id, user1Id) as any).count;

  const dmsCount = (db.prepare(`
    SELECT COUNT(*) as count FROM direct_messages 
    WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
  `).get(user1Id, user2Id, user2Id, user1Id) as any).count;

  let expectedChecks = 0;
  if (existingRel) {
    // If relationship exists, check every 20 comments or 100 DMs
    expectedChecks = Math.floor(commentsCount / 20) + Math.floor(dmsCount / 100);
  } else {
    // If no relationship, check every 5 comments or 20 DMs
    expectedChecks = Math.floor(commentsCount / 5) + Math.floor(dmsCount / 20);
  }

  if (expectedChecks <= 0) return;

  const actualChecks = (db.prepare("SELECT COUNT(*) as count FROM relationship_checks WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)").get(user1Id, user2Id, user2Id, user1Id) as any).count;

  if (expectedChecks > actualChecks) {
    // Perform check
    const user1 = db.prepare("SELECT * FROM users WHERE id = ?").get(user1Id) as any;
    const user2 = db.prepare("SELECT * FROM users WHERE id = ?").get(user2Id) as any;
    if (!user1 || !user2) return;

    // Get recent interactions
    const recentComments = db.prepare(`
      SELECT c.content, c.created_at, u1.display_name as commenter, u2.display_name as poster, p.content as post_content
      FROM comments c
      JOIN users u1 ON c.user_id = u1.id
      JOIN posts p ON c.post_id = p.id
      JOIN users u2 ON p.user_id = u2.id
      WHERE (c.user_id = ? AND p.user_id = ?) OR (c.user_id = ? AND p.user_id = ?)
      ORDER BY c.created_at DESC LIMIT 10
    `).all(user1Id, user2Id, user2Id, user1Id) as any[];

    const recentDms = db.prepare(`
      SELECT dm.content, dm.created_at, u.display_name as sender
      FROM direct_messages dm
      JOIN users u ON dm.sender_id = u.id
      WHERE (dm.sender_id = ? AND dm.receiver_id = ?) OR (dm.sender_id = ? AND dm.receiver_id = ?)
      ORDER BY dm.created_at DESC LIMIT 10
    `).all(user1Id, user2Id, user2Id, user1Id) as any[];

    // Calculate difficulty
    const u1Rels = (db.prepare("SELECT COUNT(*) as count FROM relationships WHERE user_id_1 = ? OR user_id_2 = ?").get(user1Id, user1Id) as any).count;
    const u2Rels = (db.prepare("SELECT COUNT(*) as count FROM relationships WHERE user_id_1 = ? OR user_id_2 = ?").get(user2Id, user2Id) as any).count;
    const minRels = Math.min(u1Rels, u2Rels);
    
    let difficulty = "Easy";
    if (minRels >= 10) difficulty = "Hard";
    else if (minRels >= 5) difficulty = "Medium";

    const { result, description } = await evaluateDynamicRelationship(user1, user2, recentComments, recentDms, difficulty, existingRel?.description);

    const u1 = Math.min(user1Id, user2Id);
    const u2 = Math.max(user1Id, user2Id);

    db.prepare("INSERT INTO relationship_checks (user_id_1, user_id_2, interaction_threshold, result, description, is_update) VALUES (?, ?, ?, ?, ?, ?)").run(
      u1, u2, expectedChecks, result ? 1 : 0, description || null, existingRel ? 1 : 0
    );

    if (result && description) {
      if (existingRel) {
        db.prepare("UPDATE relationships SET description = ? WHERE id = ?").run(description, existingRel.id);
        console.log(`Dynamic relationship updated between ${user1.display_name} and ${user2.display_name}: ${description}`);
      } else {
        db.prepare("INSERT INTO relationships (user_id_1, user_id_2, description) VALUES (?, ?, ?)").run(u1, u2, description);
        console.log(`Dynamic relationship formed between ${user1.display_name} and ${user2.display_name}: ${description}`);
      }
    } else {
      console.log(`Dynamic relationship check failed for ${user1.display_name} and ${user2.display_name}`);
    }
  }
}

function filterAvailableUsersForComment(opId: number, availableAiUsers: any[]) {
  if (!availableAiUsers || availableAiUsers.length === 0) return [];

  const settings = db.prepare("SELECT cross_universe_prob FROM settings WHERE id = 1").get() as any;
  const crossUniverseProb = (settings?.cross_universe_prob ?? 50.0) / 100;

  const opUser = db.prepare("SELECT universe_id, account_type FROM users WHERE id = ?").get(opId) as any;
  const opUniverseId = opUser?.universe_id;
  const opAccountType = opUser?.account_type || 'character';

  const filteredAiUsers = availableAiUsers.filter(u => {
    // Company commenting logic
    if (u.account_type === 'company') {
      const companyCommentProb = opAccountType === 'company' ? 0.1 : 0.02;
      if (Math.random() > companyCommentProb) return false;
    }

    if (u.universe_id === opUniverseId) return true;
    return Math.random() < crossUniverseProb;
  });

  if (filteredAiUsers.length === 0) return [];

  // 1. ALL Users who the OP has a relationship with
  const relationships = db.prepare("SELECT user_id_1, user_id_2 FROM relationships WHERE user_id_1 = ? OR user_id_2 = ?").all(opId, opId) as any[];
  const relatedUserIds = new Set(relationships.flatMap(r => [r.user_id_1, r.user_id_2]).filter(id => id !== opId));

  // 2. Users following OP
  const followers = db.prepare("SELECT follower_id FROM follows WHERE followed_id = ?").all(opId) as any[];
  const followerIds = new Set(followers.map(f => f.follower_id));

  const relatedUsers = filteredAiUsers.filter(u => relatedUserIds.has(u.id));

  // Up to 20 Users who are following OP (excluding related users)
  const followerUsers = filteredAiUsers.filter(u => followerIds.has(u.id) && !relatedUserIds.has(u.id));
  const selectedFollowers = followerUsers.sort(() => 0.5 - Math.random()).slice(0, 20);

  // 20 Additional, random Users (excluding related users and selected followers)
  const selectedFollowerIds = new Set(selectedFollowers.map(u => u.id));
  const remainingUsers = filteredAiUsers.filter(u => !relatedUserIds.has(u.id) && !selectedFollowerIds.has(u.id));
  const randomUsers = remainingUsers.sort(() => 0.5 - Math.random()).slice(0, 20);

  return [...relatedUsers, ...selectedFollowers, ...randomUsers];
}

function addLikesToPostOrComment(postId: number, commentId: number | null, count: number) {
  const aiUsers = db.prepare("SELECT id FROM users WHERE is_ai = 1 AND is_active = 1").all() as any[];
  if (aiUsers.length === 0) return;

  const shuffled = aiUsers.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, Math.min(count, aiUsers.length));

  for (const user of selected) {
    try {
      if (commentId) {
        db.prepare("INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)").run(commentId, user.id);
      } else {
        db.prepare("INSERT INTO likes (post_id, user_id) VALUES (?, ?)").run(postId, user.id);
      }
    } catch (e) {
      // Already liked
    }
  }
}

async function triggerPostComments(postId: number, postType: string) {
  const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get() as any;
  if (!settings || !settings.ai_enabled) return;

  const allUsers = db.prepare("SELECT * FROM users").all() as any[];
  const onlineUsers = allUsers.filter(u => isUserOnline(u, settings.timezone || 'UTC'));
  const onlineRatio = allUsers.length > 0 ? onlineUsers.length / allUsers.length : 0;

  const baseCount = (postType === 'question' || postType === 'discussion' || postType === 'seeking_advice') ? 5 : 3;
  const count = Math.max(0, Math.round(baseCount * onlineRatio));
  if (count === 0) return;

  const commentedUserIds = new Set<number>();
  
  for (let i = 0; i < count; i++) {
    // Wait a bit to simulate typing/reading
    await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 10000));
    
    const post = db.prepare(`
      SELECT p.*, u.display_name as author_name, u.bio as author_bio, u.is_ai 
      FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?
    `).get(postId) as any;
    
    if (!post) break;

    let aiUsersQuery = "SELECT * FROM users WHERE is_ai = 1 AND is_active = 1 AND id != ?";
    let aiUsersParams = [post.user_id];
    
    if (post.is_ai === 0) {
      aiUsersQuery = `
        SELECT u.* FROM users u 
        JOIN follows f ON f.followed_id = u.id 
        WHERE u.is_ai = 1 AND u.is_active = 1 AND u.id != ? AND f.follower_id = ?
      `;
      aiUsersParams = [post.user_id, post.user_id];
    }
    const aiUsers = db.prepare(aiUsersQuery).all(...aiUsersParams) as any[];
    const existingRepliers = db.prepare("SELECT user_id FROM comments WHERE post_id = ? AND parent_id IS NULL").all(postId).map((r: any) => r.user_id);
    const availableAiUsers = aiUsers.filter(u => {
      const isOnline = isUserOnline(u, settings.timezone || 'UTC');
      return isOnline && !commentedUserIds.has(u.id) && !existingRepliers.includes(u.id) && !pendingComments.has(`${u.id}:post:${postId}`);
    });
    if (availableAiUsers.length === 0) continue;

    const candidateUsers = filterAvailableUsersForComment(post.user_id, availableAiUsers);
    if (candidateUsers.length === 0) continue;

    const chosenAiId = await pickBestCommenter(post, candidateUsers);
    const randomAi = availableAiUsers.find(u => u.id === chosenAiId) || availableAiUsers[0];
    commentedUserIds.add(randomAi.id);
    pendingComments.add(`${randomAi.id}:post:${postId}`);

    const otherComments = db.prepare("SELECT content, created_at FROM comments WHERE post_id = ? LIMIT 5").all(postId).map((c: any) => `[${c.created_at}] ${c.content}`).join(" | ");
    const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(randomAi.id, post.user_id) as any;
    const relContext = rel ? rel.description : '';

    try {
      const commentContent = await generateComment(randomAi, post.content, post.author_name, otherComments, false, relContext, post.user_id, post.image_prompt, post.created_at);
      if (commentContent) {
        const info = db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)")
          .run(postId, randomAi.id, commentContent);
        checkDynamicRelationship(randomAi.id, post.user_id).catch(console.error);
        console.log(`${randomAi.display_name} auto-commented on post ${postId}`);

        // Add 1-5 likes to the post
        addLikesToPostOrComment(postId, null, Math.floor(Math.random() * 5) + 1);

        const postAuthor = db.prepare("SELECT id, is_ai FROM users WHERE id = ?").get(post.user_id) as any;
        if (postAuthor && postAuthor.is_ai === 0) {
          db.prepare("INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'comment', ?)")
            .run(postAuthor.id, randomAi.id, info.lastInsertRowid);
        }
      }
    } catch (err) {
      console.error(`Failed to auto-comment on post ${postId} by ${randomAi.display_name}:`, err);
    } finally {
      pendingComments.delete(`${randomAi.id}:post:${postId}`);
    }
  }
}

function buildThreadContext(commentId: number): string {
  let context = [];
  let currentCommentId = commentId;
  while (currentCommentId) {
    const comment = db.prepare(`
      SELECT c.*, u.display_name, p.content as post_content, p.created_at as post_created_at, pu.display_name as post_author
      FROM comments c
      JOIN users u ON c.user_id = u.id
      JOIN posts p ON c.post_id = p.id
      JOIN users pu ON p.user_id = pu.id
      WHERE c.id = ?
    `).get(currentCommentId) as any;
    
    if (!comment) break;
    
    context.unshift(`[${comment.created_at}] ${comment.display_name}: "${comment.content}"`);
    
    if (!comment.parent_id) {
      context.unshift(`[${comment.post_created_at}] Original Post by ${comment.post_author}: "${comment.post_content}"`);
      break;
    }
    currentCommentId = comment.parent_id;
  }
  return context.join('\n');
}

function getCommentDepth(commentId: number): number {
  let depth = 1;
  let currentCommentId = commentId;
  while (currentCommentId) {
    const comment = db.prepare("SELECT parent_id FROM comments WHERE id = ?").get(currentCommentId) as any;
    if (!comment || !comment.parent_id) break;
    currentCommentId = comment.parent_id;
    depth++;
  }
  return depth;
}

async function handleOPReplies() {
  const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get() as any;
  if (!settings || !settings.ai_enabled) return;

  const unansweredComments = db.prepare(`
    SELECT c.*, p.user_id as op_id, p.content as post_content, u.display_name as author_name, u.is_ai as author_is_ai,
           COALESCE(parent_c.user_id, p.user_id) as target_op_id
    FROM comments c
    JOIN posts p ON c.post_id = p.id
    JOIN users u ON c.user_id = u.id
    LEFT JOIN comments parent_c ON c.parent_id = parent_c.id
    JOIN users op ON COALESCE(parent_c.user_id, p.user_id) = op.id
    WHERE op.is_ai = 1 AND op.is_active = 1
    AND c.user_id != op.id
    AND c.op_ignored = 0
    AND p.id IN (SELECT id FROM posts WHERE is_visible = 1 ORDER BY posts.created_at DESC LIMIT 10)
    AND NOT EXISTS (
      SELECT 1 FROM comments reply 
      WHERE reply.parent_id = c.id AND reply.user_id = op.id
    )
    ORDER BY c.created_at DESC LIMIT 20
  `).all() as any[];

  for (const comment of unansweredComments) {
    // Real user comments: 100% reply. AI comments: 65% reply.
    const shouldReply = comment.author_is_ai === 0 ? true : Math.random() < 0.65;
    
    if (shouldReply) {
      if (getCommentDepth(comment.id) >= 5) {
        db.prepare("UPDATE comments SET op_ignored = 1 WHERE id = ?").run(comment.id);
        continue;
      }

      const opUser = db.prepare("SELECT * FROM users WHERE id = ?").get(comment.target_op_id) as any;
      if (!opUser) continue;

      if (!isUserOnline(opUser, settings.timezone || 'UTC')) continue;

      if (pendingComments.has(`${opUser.id}:comment:${comment.id}`)) continue;
      pendingComments.add(`${opUser.id}:comment:${comment.id}`);

      const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(opUser.id, comment.user_id) as any;
      const relContext = rel ? rel.description : '';

      const threadContext = buildThreadContext(comment.id);

      try {
        const replyContent = await generateComment(opUser, comment.content, comment.author_name, threadContext, true, relContext, comment.user_id, undefined, comment.created_at);
        if (replyContent) {
          const info = db.prepare("INSERT INTO comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)")
            .run(comment.post_id, opUser.id, replyContent, comment.id);
          checkDynamicRelationship(opUser.id, comment.user_id).catch(console.error);
          console.log(`OP ${opUser.display_name} replied to comment ${comment.id}`);

          // Add 1-5 likes to the comment being replied to
          addLikesToPostOrComment(comment.post_id, comment.id, Math.floor(Math.random() * 5) + 1);

          if (comment.author_is_ai === 0) {
            db.prepare("INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'reply', ?)")
              .run(comment.user_id, opUser.id, info.lastInsertRowid);
          }
        }
      } finally {
        pendingComments.delete(`${opUser.id}:comment:${comment.id}`);
      }
    } else {
      // Mark as ignored so we don't keep trying
      db.prepare("UPDATE comments SET op_ignored = 1 WHERE id = ?").run(comment.id);
    }
  }
}

async function doAiPost(aiUser: any, forceType: 'text' | 'image' | null = null, forcedArchetypeId?: string) {
  const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get() as any;
  const recentContext = db.prepare(`
    SELECT p.content, p.created_at, u.display_name 
    FROM posts p JOIN users u ON p.user_id = u.id 
    ORDER BY p.created_at DESC LIMIT 5
  `).all() as any[];
  const contextStr = recentContext.map(p => `[${p.created_at}] ${p.display_name}: ${p.content}`).join(" | ");
  
  const rels = db.prepare(`
    SELECT u.display_name, r.description 
    FROM relationships r 
    JOIN users u ON r.user_id_2 = u.id 
    WHERE r.user_id_1 = ?
  `).all(aiUser.id) as any[];
  const relStr = rels.map(r => `${r.display_name}: ${r.description}`).join(", ");

  const isFirstPost = (db.prepare("SELECT COUNT(*) as count FROM posts WHERE user_id = ?").get(aiUser.id) as any).count === 0;
  let archetype = pickArchetype(isFirstPost, forceType === 'image', aiUser.account_type);
  if (forcedArchetypeId) {
    const forced = db.prepare("SELECT * FROM post_archetypes WHERE id = ?").get(forcedArchetypeId) as any;
    if (forced) archetype = forced;
  }
  const relatedUsers = db.prepare(`
    SELECT u.username, u.universe_id, un.name as universe_name
    FROM users u
    LEFT JOIN universes un ON u.universe_id = un.id
    JOIN relationships r ON (r.user_id_1 = u.id AND r.user_id_2 = ?) OR (r.user_id_2 = u.id AND r.user_id_1 = ?)
    WHERE u.id != ?
  `).all(aiUser.id, aiUser.id, aiUser.id) as any[];
  const availableUsernames = relatedUsers.map(u => `@${u.username} (Universe: ${u.universe_name || 'None'})`).join(', ');
  
  // UNIVERSE ARC LOGIC
  let activeUniverseArc = null;
  let pastUniverseArcs: any[] = [];
  const universe = aiUser.universe_id ? db.prepare("SELECT * FROM universes WHERE id = ?").get(aiUser.universe_id) as any : null;
  const arcArchetypes = ['life_update', 'follow_up', 'seeking_advice', 'company_announcement', 'public_apology', 'giveaway_contest', 'brand_banter'];

  if (universe) {
    pastUniverseArcs = db.prepare("SELECT * FROM universe_arcs WHERE universe_id = ? AND status = 'completed' ORDER BY target_end_date DESC LIMIT 3").all(universe.id) as any[];
    activeUniverseArc = db.prepare("SELECT * FROM universe_arcs WHERE universe_id = ? AND status = 'active'").get(universe.id) as any;

    if (!activeUniverseArc && arcArchetypes.includes(archetype.id)) {
      const newUniverseArcData = await generateNewUniverseArc(universe);
      if (newUniverseArcData && newUniverseArcData.title && newUniverseArcData.description && newUniverseArcData.duration_days) {
        const info = db.prepare("INSERT INTO universe_arcs (universe_id, title, description, current_status_text, target_end_date) VALUES (?, ?, ?, ?, datetime('now', '+' || ? || ' days'))").run(universe.id, newUniverseArcData.title, newUniverseArcData.description, newUniverseArcData.current_status_text, newUniverseArcData.duration_days);
        activeUniverseArc = db.prepare("SELECT * FROM universe_arcs WHERE id = ?").get(info.lastInsertRowid);
      }
    } else if (activeUniverseArc) {
      const now = new Date();
      const targetDate = new Date(activeUniverseArc.target_end_date);
      const lastUpdateDate = new Date(activeUniverseArc.last_update_date);

      if (now >= targetDate) {
        const recentUniversePosts = db.prepare(`
          SELECT p.content, u.display_name 
          FROM posts p 
          JOIN users u ON p.user_id = u.id 
          WHERE u.universe_id = ? AND p.created_at >= ? 
          ORDER BY p.created_at DESC LIMIT 20
        `).all(universe.id, activeUniverseArc.start_date).map((p: any) => `${p.display_name}: ${p.content}`).join(" | ");
        
        const conclusion = await concludeUniverseArc(universe, activeUniverseArc, recentUniversePosts);
        db.prepare("UPDATE universe_arcs SET status = 'completed', completion_summary = ? WHERE id = ?").run(conclusion, activeUniverseArc.id);
        activeUniverseArc = null;
      } else if (now.getTime() - lastUpdateDate.getTime() >= 24 * 60 * 60 * 1000) {
        const recentUniversePosts = db.prepare(`
          SELECT p.content, u.display_name 
          FROM posts p 
          JOIN users u ON p.user_id = u.id 
          WHERE u.universe_id = ? AND p.created_at >= ? 
          ORDER BY p.created_at DESC LIMIT 20
        `).all(universe.id, activeUniverseArc.last_update_date).map((p: any) => `${p.display_name}: ${p.content}`).join(" | ");
        
        const newStatusText = await updateUniverseArc(universe, activeUniverseArc, recentUniversePosts);
        db.prepare("UPDATE universe_arcs SET current_status_text = ?, last_update_date = datetime('now') WHERE id = ?").run(newStatusText, activeUniverseArc.id);
        activeUniverseArc.current_status_text = newStatusText;
      }
    }
  }

  // ARC LOGIC
  let activeArc = db.prepare("SELECT * FROM character_arcs WHERE user_id = ? AND status = 'active'").get(aiUser.id) as any;
  const pastArcs = db.prepare("SELECT * FROM character_arcs WHERE user_id = ? AND status = 'completed' ORDER BY target_end_date DESC LIMIT 3").all(aiUser.id) as any[];
  let arcInstruction = '';
  let arcComments = '';

  console.log(`[DEBUG] Entering ARC LOGIC for ${aiUser.display_name}. Archetype: ${archetype.id}`);
  console.log(`[DEBUG] arcArchetypes: ${JSON.stringify(arcArchetypes)}`);
  
  if (arcArchetypes.includes(archetype.id)) {
    console.log(`[DEBUG] Archetype ${archetype.id} matched for arc generation for ${aiUser.display_name}`);
    logApi('DEBUG_ARC_LOGIC', { archetypeId: archetype.id, userId: aiUser.id, activeArc: activeArc ? activeArc.id : null }, { message: `Archetype matched for user ${aiUser.display_name}` }, aiUser.id);
    if (!activeArc) {
      console.log(`[DEBUG] No active arc for ${aiUser.display_name}, generating new one...`);
      const newArcData = await generateNewArc(aiUser);
      console.log(`[DEBUG] New arc data for ${aiUser.display_name}:`, JSON.stringify(newArcData));
      logApi('DEBUG_ARC_LOGIC_NEW_DATA', { characterId: aiUser.id }, { newArcData }, aiUser.id);
      if (newArcData && newArcData.title && newArcData.description && newArcData.duration_days) {
        try {
          const info = db.prepare("INSERT INTO character_arcs (user_id, title, description, target_end_date) VALUES (?, ?, ?, datetime('now', '+' || ? || ' days'))").run(aiUser.id, newArcData.title, newArcData.description, newArcData.duration_days);
          activeArc = db.prepare("SELECT * FROM character_arcs WHERE id = ?").get(info.lastInsertRowid);
          arcInstruction = 'START_ARC';
          console.log(`[DEBUG] Successfully created arc ${activeArc.id} for ${aiUser.display_name}: ${activeArc.title}`);
          logApi('DEBUG_ARC_LOGIC_CREATED', { characterId: aiUser.id, arcId: activeArc.id }, { arcTitle: activeArc.title }, aiUser.id);
        } catch (e) {
          console.error(`[DEBUG] Failed to insert arc for ${aiUser.display_name}:`, e);
        }
      } else {
        console.log(`[DEBUG] Invalid arc data generated for ${aiUser.display_name}`);
        logApi('DEBUG_ARC_LOGIC_INVALID_DATA', { characterId: aiUser.id }, { newArcData }, aiUser.id);
      }
    } else {
      const now = new Date();
      const targetDate = new Date(activeArc.target_end_date);
      if (now >= targetDate) {
        // Fetch recent posts for context
        const recentUserPosts = db.prepare("SELECT content, created_at FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 5").all(aiUser.id).map((p: any) => `[${p.created_at}] ${p.content}`).join(" | ");
        // Fetch recent comments on those posts
        const recentUserComments = db.prepare(`
          SELECT c.content, u.display_name 
          FROM comments c 
          JOIN users u ON c.user_id = u.id 
          WHERE c.post_id IN (SELECT id FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 5) 
          AND c.user_id != ? 
          ORDER BY c.created_at DESC LIMIT 10
        `).all(aiUser.id, aiUser.id).map((c: any) => `${c.display_name}: ${c.content}`).join(" | ");

        const conclusion = await concludeArc(aiUser, activeArc, recentUserPosts, recentUserComments);
        db.prepare("UPDATE character_arcs SET status = 'completed', completion_summary = ? WHERE id = ?").run(conclusion, activeArc.id);
        activeArc.completion_summary = conclusion;
        arcInstruction = 'CONCLUDE_ARC';
      } else {
        arcInstruction = 'PROGRESS_ARC';
        const recentUserComments = db.prepare(`
          SELECT c.content, u.display_name 
          FROM comments c 
          JOIN users u ON c.user_id = u.id 
          WHERE c.post_id IN (SELECT id FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 2) 
          AND c.user_id != ? 
          ORDER BY c.created_at DESC LIMIT 5
        `).all(aiUser.id, aiUser.id).map((c: any) => `${c.display_name}: ${c.content}`).join(" | ");
        arcComments = recentUserComments;
      }
    }
  }

  let postContent = "";
  let positivePrompt = "";
  let negativePrompt = "";
  let characterVisible = false;
  
  if (archetype.id === 'image_post') {
    const imageData = await generateImagePostData(aiUser, contextStr, relStr, availableUsernames);
    if (imageData) {
      postContent = imageData.textPost;
      positivePrompt = imageData.positivePrompt;
      negativePrompt = imageData.negativePrompt;
      characterVisible = imageData.characterVisible;
    }
  } else {
    postContent = (await generatePost(aiUser, contextStr, relStr, archetype, availableUsernames, isFirstPost, activeArc, pastArcs, arcInstruction, arcComments, activeUniverseArc, pastUniverseArcs)) || "";
  }

  if (postContent) {
    const isVisible = archetype.id === 'image_post' ? 0 : 1;
    const info = db.prepare("INSERT INTO posts (user_id, content, post_type, is_visible) VALUES (?, ?, ?, ?)").run(aiUser.id, postContent, archetype.id, isVisible);
    const postId = info.lastInsertRowid as number;
    console.log(`${aiUser.display_name} created a post (${archetype.id})`);

    if (archetype.id === 'image_post') {
      let referenceImageUrls: string[] | undefined = undefined;
      if (characterVisible) {
        const refImages = JSON.parse(aiUser.reference_images || '[]');
        if (refImages.length > 0) {
          referenceImageUrls = refImages;
        } else if (aiUser.avatar_url) {
          referenceImageUrls = [aiUser.avatar_url];
        }
      }
      generateImage(positivePrompt, negativePrompt, referenceImageUrls).then(imageUrl => {
        if (imageUrl) {
          db.prepare("UPDATE posts SET image_url = ?, is_visible = 1, image_prompt = ? WHERE id = ?").run(imageUrl, positivePrompt, postId);
          triggerPostComments(postId, archetype.id);
        } else {
          db.prepare("DELETE FROM posts WHERE id = ?").run(postId);
        }
      }).catch(err => {
        console.error("Failed to generate image:", err);
        db.prepare("DELETE FROM posts WHERE id = ?").run(postId);
      });
    } else {
      triggerPostComments(postId, archetype.id);
    }

    if (isFirstPost) {
      db.prepare("UPDATE users SET is_active = 1 WHERE id = ?").run(aiUser.id);
    }

    if (archetype.id === 'event' || archetype.id === 'meetup') {
      const allUsers = db.prepare("SELECT * FROM users").all() as any[];
      const onlineUsers = allUsers.filter(u => isUserOnline(u, settings.timezone || 'UTC'));
      const onlineRatio = allUsers.length > 0 ? onlineUsers.length / allUsers.length : 0;
      const onlineAiUsers = onlineUsers.filter(u => u.is_ai === 1);
      const activeAiUsers = onlineAiUsers.filter(u => u.is_active === 1);

      // Trigger other characters to react
      const baseCount = archetype.id === 'event' ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 4) + 1;
      const count = Math.max(0, Math.round(baseCount * onlineRatio));
      const crossUniverseProb = (settings.cross_universe_prob ?? 50.0) / 100;
      const otherAis = activeAiUsers.filter(u => {
        if (u.id === aiUser.id) return false;
        if (u.universe_id === aiUser.universe_id) return true;
        return Math.random() < crossUniverseProb;
      });
      if (otherAis.length > 0) {
        const selectedAis = [];
        let availableAis = [...otherAis];
        for (let i = 0; i < count && availableAis.length > 0; i++) {
          const picked = pickWeightedRandomUser(availableAis);
          selectedAis.push(picked);
          availableAis = availableAis.filter(u => u.id !== picked.id);
        }
        
        // These characters will comment on the post shortly
        for (const otherAi of selectedAis) {
          pendingComments.add(`${otherAi.id}:post:${postId}`);
          setTimeout(async () => {
            try {
              const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(otherAi.id, aiUser.id) as any;
              const relContext = rel ? rel.description : '';
              const post = db.prepare("SELECT created_at FROM posts WHERE id = ?").get(postId) as any;
              const commentContent = await generateComment(otherAi, postContent, aiUser.display_name, '', false, relContext, aiUser.id, undefined, post?.created_at);
              if (commentContent) {
                db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)")
                  .run(postId, otherAi.id, commentContent);
                checkDynamicRelationship(otherAi.id, aiUser.id).catch(console.error);
                console.log(`${otherAi.display_name} reacted to ${archetype.id} by ${aiUser.display_name}`);
              }
            } finally {
              pendingComments.delete(`${otherAi.id}:post:${postId}`);
            }
          }, 5000 + Math.random() * 30000);
        }
      }
    }
    return true;
  }
  return false;
}

async function startServer() {
  try {
    const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Initialize Database
  initDb();

  const getRealUser = (req: any) => {
    const userId = req.headers['x-user-id'];
    if (userId) {
      return db.prepare("SELECT * FROM users WHERE id = ? AND is_ai = 0").get(userId) as any;
    }
    return db.prepare("SELECT * FROM users WHERE is_ai = 0 ORDER BY id ASC LIMIT 1").get() as any;
  };

  // API Routes
  app.get("/api/logs", (req, res) => {
    const q = req.query.q as string;
    const errorOnly = req.query.error === 'true';
    
    let queryStr = `
      SELECT l.*, u.display_name as user_display_name, u.avatar_url as user_profile_picture 
      FROM api_logs l 
      LEFT JOIN users u ON l.user_id = u.id 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (q) {
      queryStr += ` AND (l.response_payload LIKE ? OR l.request_payload LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }

    if (errorOnly) {
      queryStr += ` AND (l.response_payload LIKE '%"error"%' OR l.response_payload LIKE '%Error:%' OR l.request_payload LIKE '%"error"%')`;
    }

    queryStr += ` ORDER BY l.created_at DESC LIMIT 50`;

    const logs = db.prepare(queryStr).all(...params);
    res.json(logs);
  });

  app.get("/api/relationship-checks", (req, res) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const checks = db.prepare(`
      SELECT rc.*, u1.display_name as user1_name, u1.avatar_url as user1_avatar, u2.display_name as user2_name, u2.avatar_url as user2_avatar
      FROM relationship_checks rc
      JOIN users u1 ON rc.user_id_1 = u1.id
      JOIN users u2 ON rc.user_id_2 = u2.id
      ORDER BY rc.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    res.json(checks);
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/real-users", (req, res) => {
    const users = db.prepare("SELECT id, username, display_name, avatar_url, role, pin IS NOT NULL AND pin != '' as has_pin FROM users WHERE is_ai = 0 ORDER BY id ASC").all();
    res.json(users);
  });

  app.post("/api/login", (req, res) => {
    const { userId, pin } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE id = ? AND is_ai = 0").get(userId) as any;
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.pin && user.pin !== pin) {
      return res.status(401).json({ error: "Invalid PIN" });
    }

    res.json({ success: true, user: { id: user.id, username: user.username, display_name: user.display_name, avatar_url: user.avatar_url, role: user.role } });
  });

  app.post("/api/real-users", (req, res) => {
    const { username, display_name, pin } = req.body;
    const adminUser = getRealUser(req);
    
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: "Only admins can create real users" });
    }

    try {
      const stmt = db.prepare("INSERT INTO users (username, display_name, pin, is_ai, role) VALUES (?, ?, ?, 0, 'user')");
      const info = stmt.run(username, display_name || username, pin || null);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Settings
  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get();
    res.json(settings);
  });

  app.get("/api/archetypes", (req, res) => {
    const archetypes = db.prepare("SELECT * FROM post_archetypes").all();
    res.json(archetypes);
  });

  app.post("/api/archetypes", (req, res) => {
    const { archetypes } = req.body;
    if (!Array.isArray(archetypes)) {
      return res.status(400).json({ error: "Invalid archetypes format" });
    }
    
    const updateArchetype = db.prepare("UPDATE post_archetypes SET probability = ? WHERE id = ?");
    db.transaction(() => {
      for (const arch of archetypes) {
        updateArchetype.run(arch.probability, arch.id);
      }
    })();
    
    res.json({ success: true });
  });

  app.post("/api/settings", (req, res) => {
    const { ai_enabled, model_name, image_model_name, vision_model_name, timezone, api_key, prob_post, prob_image_post, prob_comment, prob_message, prob_favorite_dm, cross_universe_prob } = req.body;
    if (ai_enabled !== undefined) {
      db.prepare("UPDATE settings SET ai_enabled = ? WHERE id = 1").run(ai_enabled ? 1 : 0);
    }
    if (model_name !== undefined) {
      db.prepare("UPDATE settings SET model_name = ? WHERE id = 1").run(model_name);
    }
    if (image_model_name !== undefined) {
      db.prepare("UPDATE settings SET image_model_name = ? WHERE id = 1").run(image_model_name);
    }
    if (vision_model_name !== undefined) {
      db.prepare("UPDATE settings SET vision_model_name = ? WHERE id = 1").run(vision_model_name);
    }
    if (timezone !== undefined) {
      db.prepare("UPDATE settings SET timezone = ? WHERE id = 1").run(timezone);
    }
    if (api_key !== undefined) {
      db.prepare("UPDATE settings SET api_key = ? WHERE id = 1").run(api_key);
    }
    if (prob_post !== undefined) {
      db.prepare("UPDATE settings SET prob_post = ? WHERE id = 1").run(prob_post);
    }
    if (prob_image_post !== undefined) {
      db.prepare("UPDATE settings SET prob_image_post = ? WHERE id = 1").run(prob_image_post);
    }
    if (prob_comment !== undefined) {
      db.prepare("UPDATE settings SET prob_comment = ? WHERE id = 1").run(prob_comment);
    }
    if (prob_message !== undefined) {
      db.prepare("UPDATE settings SET prob_message = ? WHERE id = 1").run(prob_message);
    }
    if (prob_favorite_dm !== undefined) {
      db.prepare("UPDATE settings SET prob_favorite_dm = ? WHERE id = 1").run(prob_favorite_dm);
    }
    if (cross_universe_prob !== undefined) {
      db.prepare("UPDATE settings SET cross_universe_prob = ? WHERE id = 1").run(cross_universe_prob);
    }
    res.json({ success: true });
  });

  app.post("/api/reset-db", (req, res) => {
    try {
      db.prepare("DELETE FROM comment_likes").run();
      db.prepare("DELETE FROM likes").run();
      db.prepare("DELETE FROM comments").run();
      db.prepare("DELETE FROM direct_messages").run();
      db.prepare("DELETE FROM group_chat_messages").run();
      db.prepare("DELETE FROM group_chat_members").run();
      db.prepare("DELETE FROM group_chats").run();
      db.prepare("DELETE FROM notifications").run();
      db.prepare("DELETE FROM posts").run();
      db.prepare("DELETE FROM follows").run();
      db.prepare("DELETE FROM relationships").run();
      db.prepare("DELETE FROM users WHERE is_ai = 1").run();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/reset-content", (req, res) => {
    try {
      db.prepare("DELETE FROM comment_likes").run();
      db.prepare("DELETE FROM likes").run();
      db.prepare("DELETE FROM comments").run();
      db.prepare("DELETE FROM direct_messages").run();
      db.prepare("DELETE FROM group_chat_messages").run();
      db.prepare("DELETE FROM group_chat_members").run();
      db.prepare("DELETE FROM group_chats").run();
      db.prepare("DELETE FROM notifications").run();
      db.prepare("DELETE FROM posts").run();
      db.prepare("UPDATE users SET is_active = 0 WHERE is_ai = 1").run();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/test-ai", async (req, res) => {
    try {
      const result = await testConnection();
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/generate-persona", async (req, res) => {
    try {
      const { name, extraInfo } = req.body;
      logApi(
        "ROUTE_GENERATE_PERSONA",
        { name, extraInfo },
        "Request Received"
      );
      const universes = db.prepare("SELECT name FROM universes").all().map((u: any) => u.name);
      
      const persona = await generatePersona(name, extraInfo, universes);
      res.json(persona);
    } catch (e: any) {
      console.error("Error in generate-persona:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Users
  app.get("/api/users/:id/posts", (req, res) => {
    const user = getRealUser(req);
    const userId = user ? user.id : 0;
    const posts = db.prepare(`
      SELECT p.*, u.username, u.display_name, u.avatar_url,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = ? AND p.is_visible = 1
      ORDER BY p.created_at DESC
    `).all(userId, req.params.id);
    res.json(posts);
  });

  app.get("/api/users/:id/followers", (req, res) => {
    const followers = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar_url
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.followed_id = ?
    `).all(req.params.id);
    res.json(followers);
  });

  app.get("/api/users/:id/following", (req, res) => {
    const following = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar_url
      FROM follows f
      JOIN users u ON f.followed_id = u.id
      WHERE f.follower_id = ?
    `).all(req.params.id);
    res.json(following);
  });

  app.get("/api/users", (req, res) => {
    const user = getRealUser(req);
    const users = db.prepare(`
      SELECT u.*, 
      (u.pin IS NOT NULL AND u.pin != '') as has_pin,
      (f1.follower_id IS NOT NULL) as is_followed,
      COALESCE(f2.following_count, 0) as following_count,
      COALESCE(f3.follower_count, 0) as follower_count
      FROM users u 
      LEFT JOIN follows f1 ON f1.follower_id = ? AND f1.followed_id = u.id
      LEFT JOIN (SELECT follower_id, COUNT(*) as following_count FROM follows GROUP BY follower_id) f2 ON f2.follower_id = u.id
      LEFT JOIN (SELECT followed_id, COUNT(*) as follower_count FROM follows GROUP BY followed_id) f3 ON f3.followed_id = u.id
      ORDER BY u.created_at DESC
    `).all(user?.id || 0);
    
    res.json(users);
  });

  app.get("/api/users/:id/arcs", (req, res) => {
    try {
      const arcs = db.prepare("SELECT * FROM character_arcs WHERE user_id = ? ORDER BY created_at DESC").all(req.params.id);
      res.json(arcs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/users/:id/relationships", (req, res) => {
    const loggedInUser = getRealUser(req);
    
    const relationships = db.prepare(`
      SELECT r.*, u.display_name as other_name, u.username as other_username, u.avatar_url as other_avatar, u.role as other_role, u1.role as user1_role
      FROM relationships r
      JOIN users u ON r.user_id_2 = u.id
      JOIN users u1 ON r.user_id_1 = u1.id
      WHERE r.user_id_1 = ?
    `).all(req.params.id);
    
    const filteredRelationships = relationships.filter((rel: any) => {
      if (loggedInUser && loggedInUser.role === 'admin') return true;
      if (rel.other_role === 'admin' || rel.user1_role === 'admin') return false;
      return true;
    });
    
    res.json(filteredRelationships);
  });

  app.post("/api/users/:id/relationships", (req, res) => {
    const { user_id_2, description } = req.body;
    const user_id_1 = req.params.id;
    try {
      const user1 = db.prepare("SELECT account_type, universe_id FROM users WHERE id = ?").get(user_id_1) as any;
      const user2 = db.prepare("SELECT account_type, universe_id FROM users WHERE id = ?").get(user_id_2) as any;

      if (!user1 || !user2) {
        return res.status(404).json({ error: "User not found" });
      }

      const isUser1Company = user1.account_type === 'company';
      const isUser2Company = user2.account_type === 'company';

      // Companies cannot form relationships with characters
      if (isUser1Company && !isUser2Company) {
        return res.status(400).json({ error: "Companies cannot form relationships with characters." });
      }

      // If either is a company, they must be from the same universe
      if ((isUser1Company || isUser2Company) && user1.universe_id !== user2.universe_id) {
        return res.status(400).json({ error: "Relationships involving companies must be within the same universe." });
      }

      // Insert relationship for user 1 -> user 2
      db.prepare("INSERT OR REPLACE INTO relationships (user_id_1, user_id_2, description) VALUES (?, ?, ?)").run(user_id_1, user_id_2, description);
      db.prepare("INSERT OR IGNORE INTO follows (follower_id, followed_id) VALUES (?, ?)").run(user_id_1, user_id_2);

      // If it's Character -> Company, it's one-sided. Otherwise, it's two-sided.
      if (!(!isUser1Company && isUser2Company)) {
        db.prepare("INSERT OR REPLACE INTO relationships (user_id_1, user_id_2, description) VALUES (?, ?, ?)").run(user_id_2, user_id_1, description);
        db.prepare("INSERT OR IGNORE INTO follows (follower_id, followed_id) VALUES (?, ?)").run(user_id_2, user_id_1);
      }
      
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/users/:id/relationships/:otherId", (req, res) => {
    const user_id_1 = req.params.id;
    const user_id_2 = req.params.otherId;
    try {
      db.prepare("DELETE FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").run(user_id_1, user_id_2);
      db.prepare("DELETE FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").run(user_id_2, user_id_1);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/users/:id", (req, res) => {
    const userId = req.params.id;
    try {
      // Don't delete the real user
      const user = db.prepare("SELECT is_ai FROM users WHERE id = ?").get(userId) as any;
      if (!user || user.is_ai === 0) {
        return res.status(400).json({ error: "Cannot delete real user" });
      }

      // Delete all related data
      db.prepare("DELETE FROM comment_likes WHERE user_id = ?").run(userId);
      db.prepare("DELETE FROM likes WHERE user_id = ?").run(userId);
      db.prepare("DELETE FROM notifications WHERE user_id = ? OR actor_id = ?").run(userId, userId);
      db.prepare("DELETE FROM follows WHERE follower_id = ? OR followed_id = ?").run(userId, userId);
      db.prepare("DELETE FROM relationships WHERE user_id_1 = ? OR user_id_2 = ?").run(userId, userId);
      
      // Delete comments and their likes/notifications
      const comments = db.prepare("SELECT id FROM comments WHERE user_id = ?").all(userId) as any[];
      for (const c of comments) {
        db.prepare("DELETE FROM comment_likes WHERE comment_id = ?").run(c.id);
        db.prepare("DELETE FROM notifications WHERE type = 'like_comment' AND reference_id = ?").run(c.id);
        db.prepare("DELETE FROM comments WHERE parent_id = ?").run(c.id);
        db.prepare("DELETE FROM comments WHERE id = ?").run(c.id);
      }

      // Delete posts and their comments/likes/notifications
      const posts = db.prepare("SELECT id FROM posts WHERE user_id = ?").all(userId) as any[];
      for (const p of posts) {
        db.prepare("DELETE FROM comment_likes WHERE comment_id IN (SELECT id FROM comments WHERE post_id = ?)").run(p.id);
        db.prepare("DELETE FROM notifications WHERE type = 'like_comment' AND reference_id IN (SELECT id FROM comments WHERE post_id = ?)").run(p.id);
        db.prepare("DELETE FROM comments WHERE post_id = ?").run(p.id);
        db.prepare("DELETE FROM likes WHERE post_id = ?").run(p.id);
        db.prepare("DELETE FROM notifications WHERE type IN ('like_post', 'comment', 'reply') AND reference_id = ?").run(p.id);
        db.prepare("DELETE FROM posts WHERE id = ?").run(p.id);
      }

      // Delete DMs
      db.prepare("DELETE FROM direct_messages WHERE sender_id = ? OR receiver_id = ?").run(userId, userId);

      // Finally delete user
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Universes
  app.get("/api/universes", (req, res) => {
    const universes = db.prepare(`
      SELECT u.*, (SELECT COUNT(*) FROM users WHERE universe_id = u.id) as character_count
      FROM universes u
      ORDER BY u.name ASC
    `).all();
    res.json(universes);
  });

  app.post("/api/universes", (req, res) => {
    const { name, description, image_url } = req.body;
    try {
      const info = db.prepare("INSERT INTO universes (name, description, image_url) VALUES (?, ?, ?)").run(name, description || '', image_url || '');
      res.json({ id: info.lastInsertRowid, name, description, image_url });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/universes/:id", (req, res) => {
    const { description, image_url } = req.body;
    try {
      db.prepare("UPDATE universes SET description = ?, image_url = ? WHERE id = ?").run(description || '', image_url || '', req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/universes/:id/arcs", (req, res) => {
    const user = getRealUser(req);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });
    
    const { title, description, current_status_text, duration_days } = req.body;
    try {
      const info = db.prepare(`
        INSERT INTO universe_arcs (universe_id, title, description, current_status_text, target_end_date)
        VALUES (?, ?, ?, ?, datetime('now', '+' || ? || ' days'))
      `).run(req.params.id, title, description, current_status_text, duration_days || 7);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/universes/:id/arcs/generate", async (req, res) => {
    const user = getRealUser(req);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });
    
    const universe = db.prepare("SELECT * FROM universes WHERE id = ?").get(req.params.id) as any;
    if (!universe) return res.status(404).json({ error: "Universe not found" });
    
    try {
      const newUniverseArcData = await generateNewUniverseArc(universe);
      if (newUniverseArcData && newUniverseArcData.title && newUniverseArcData.description && newUniverseArcData.duration_days) {
        const info = db.prepare("INSERT INTO universe_arcs (universe_id, title, description, current_status_text, target_end_date) VALUES (?, ?, ?, ?, datetime('now', '+' || ? || ' days'))").run(universe.id, newUniverseArcData.title, newUniverseArcData.description, newUniverseArcData.current_status_text, newUniverseArcData.duration_days);
        res.json({ success: true, id: info.lastInsertRowid });
      } else {
        res.status(500).json({ error: "Failed to generate arc data" });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/users/:id/arcs", (req, res) => {
    const user = getRealUser(req);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });
    
    const { title, description, duration_days } = req.body;
    try {
      const info = db.prepare(`
        INSERT INTO character_arcs (user_id, title, description, target_end_date)
        VALUES (?, ?, ?, datetime('now', '+' || ? || ' days'))
      `).run(req.params.id, title, description, duration_days || 7);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/users/:id/arcs/generate", async (req, res) => {
    const user = getRealUser(req);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });
    
    const aiUser = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id) as any;
    if (!aiUser) return res.status(404).json({ error: "User not found" });
    
    try {
      const newArcData = await generateNewArc(aiUser);
      if (newArcData && newArcData.title && newArcData.description && newArcData.duration_days) {
        const info = db.prepare("INSERT INTO character_arcs (user_id, title, description, target_end_date) VALUES (?, ?, ?, datetime('now', '+' || ? || ' days'))").run(aiUser.id, newArcData.title, newArcData.description, newArcData.duration_days);
        res.json({ success: true, id: info.lastInsertRowid });
      } else {
        res.status(500).json({ error: "Failed to generate arc data" });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/universes/:id/characters", (req, res) => {
    const characters = db.prepare("SELECT id, username, display_name, avatar_url, bio, is_ai, is_active, online_times, current_online_status, status_expires_at FROM users WHERE universe_id = ?").all(req.params.id);
    res.json(characters);
  });

  app.get("/api/universes/:id/arcs", (req, res) => {
    const arcs = db.prepare("SELECT * FROM universe_arcs WHERE universe_id = ? ORDER BY created_at DESC").all(req.params.id);
    res.json(arcs);
  });

  app.put("/api/universes/arcs/:arcId", (req, res) => {
    const user = getRealUser(req);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });
    
    const { title, description, current_status_text, status, completion_summary } = req.body;
    try {
      db.prepare(`
        UPDATE universe_arcs 
        SET title = ?, description = ?, current_status_text = ?, status = ?, completion_summary = ?
        WHERE id = ?
      `).run(title, description, current_status_text, status, completion_summary || null, req.params.arcId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/universes/arcs/:arcId", (req, res) => {
    const user = getRealUser(req);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });
    
    try {
      db.prepare("DELETE FROM universe_arcs WHERE id = ?").run(req.params.arcId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/users/arcs/:arcId", (req, res) => {
    const user = getRealUser(req);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });
    
    const { title, description, status, completion_summary } = req.body;
    try {
      db.prepare(`
        UPDATE character_arcs 
        SET title = ?, description = ?, status = ?, completion_summary = ?
        WHERE id = ?
      `).run(title, description, status, completion_summary || null, req.params.arcId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/users/arcs/:arcId", (req, res) => {
    const user = getRealUser(req);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });
    
    try {
      db.prepare("DELETE FROM character_arcs WHERE id = ?").run(req.params.arcId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/arcs", (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const characterArcs = db.prepare(`
        SELECT 
          ca.*, 
          'character' as arc_type,
          u.display_name as entity_name,
          u.avatar_url as entity_image,
          u.username as entity_handle
        FROM character_arcs ca
        JOIN users u ON ca.user_id = u.id
      `).all() as any[];

      const universeArcs = db.prepare(`
        SELECT 
          ua.*, 
          'universe' as arc_type,
          un.name as entity_name,
          un.image_url as entity_image,
          NULL as entity_handle
        FROM universe_arcs ua
        JOIN universes un ON ua.universe_id = un.id
      `).all() as any[];

      const allArcs = [...characterArcs, ...universeArcs].sort((a, b) => {
        const dateA = new Date((a.last_update_date || a.created_at) + 'Z').getTime();
        const dateB = new Date((b.last_update_date || b.created_at) + 'Z').getTime();
        return dateB - dateA;
      });

      res.json(allArcs.slice(offset, offset + limit));
    } catch (e) {
      console.error("Failed to fetch arcs:", e);
      res.status(500).json({ error: "Failed to fetch arcs" });
    }
  });

  app.put("/api/users/:id", (req, res) => {
    const { display_name, username, bio, avatar_url, description, writing_style, physical_appearance, clothing_style, artstyle, universe_id, online_times, activity_level, pin, dm_frequency, reference_images, account_type, company_name, brand_identity, products_services, target_audience, run_by_character_id } = req.body;
    try {
      db.prepare(`
        UPDATE users 
        SET display_name = ?, username = ?, bio = ?, avatar_url = ?, description = ?, writing_style = ?, physical_appearance = ?, clothing_style = ?, artstyle = ?, universe_id = ?, online_times = ?, activity_level = ?, pin = ?, dm_frequency = COALESCE(?, dm_frequency), reference_images = ?, account_type = COALESCE(?, account_type), company_name = ?, brand_identity = ?, products_services = ?, target_audience = ?, run_by_character_id = ?
        WHERE id = ?
      `).run(display_name, username, bio, avatar_url, description, writing_style, physical_appearance, clothing_style, artstyle, universe_id || null, online_times || '[]', activity_level ?? 5, pin || null, dm_frequency, reference_images ? JSON.stringify(reference_images) : '[]', account_type, company_name, brand_identity, products_services, target_audience, run_by_character_id || null, req.params.id);

      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/users/:id/pin", (req, res) => {
    const { pin } = req.body;
    const userId = req.params.id;
    const loggedInUser = getRealUser(req);

    if (!loggedInUser || (loggedInUser.id !== parseInt(userId) && loggedInUser.role !== 'admin')) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      db.prepare("UPDATE users SET pin = ? WHERE id = ?").run(pin || null, userId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/users", (req, res) => {
    const { username, display_name, bio, avatar_url, ai_persona, description, writing_style, physical_appearance, clothing_style, artstyle, universe_id, online_times, activity_level, reference_images, account_type, company_name, brand_identity, products_services, target_audience, run_by_character_id } = req.body;
    logApi(
      "ROUTE_ADD_USER",
      { username, display_name, universe_id, account_type },
      "Request Received"
    );
    try {
      const existingUser = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already taken. Please choose another one." });
      }

      const stmt = db.prepare(`
        INSERT INTO users (username, display_name, bio, avatar_url, is_ai, ai_persona, description, writing_style, physical_appearance, clothing_style, artstyle, universe_id, online_times, activity_level, reference_images, account_type, company_name, brand_identity, products_services, target_audience, run_by_character_id)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(username, display_name, bio, avatar_url, ai_persona, description, writing_style, physical_appearance, clothing_style, artstyle, universe_id || null, online_times || '[]', activity_level ?? 5, reference_images ? JSON.stringify(reference_images) : '[]', account_type || 'character', company_name || null, brand_identity || null, products_services || null, target_audience || null, run_by_character_id || null);
      const userId = info.lastInsertRowid;
      
      // AI character follows real user by default, but real user does NOT follow AI character by default
      const user = getRealUser(req);
      if (user) {
        db.prepare("INSERT OR IGNORE INTO follows (follower_id, followed_id) VALUES (?, ?)").run(userId, user.id);
      }

      res.json({ id: userId });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/users/:id/follow", (req, res) => {
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });

    try {
      db.prepare("INSERT INTO follows (follower_id, followed_id) VALUES (?, ?)").run(user.id, req.params.id);
      res.json({ success: true, followed: true });
    } catch (e) {
      db.prepare("DELETE FROM follows WHERE follower_id = ? AND followed_id = ?").run(user.id, req.params.id);
      res.json({ success: true, followed: false });
    }
  });

  // Notifications
  app.get("/api/notifications", (req, res) => {
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });

    const notifications = db.prepare(`
      SELECT n.*, u.display_name as actor_name, u.avatar_url as actor_avatar
      FROM notifications n
      JOIN users u ON n.actor_id = u.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `).all(user.id);
    res.json(notifications);
  });

  app.post("/api/notifications/read", (req, res) => {
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });

    db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(user.id);
    res.json({ success: true });
  });

  app.post("/api/users/:id/force-post", async (req, res) => {
    try {
      const { type, archetypeId } = req.body; // 'text' or 'image', optional archetypeId
      const aiUser = db.prepare("SELECT * FROM users WHERE id = ? AND is_ai = 1").get(req.params.id) as any;
      if (!aiUser) return res.status(404).json({ error: "AI User not found" });

      const success = await doAiPost(aiUser, type, archetypeId);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: "Failed to generate post" });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Posts
  app.get("/api/posts", (req, res) => {
    const user = getRealUser(req);
    const userId = user ? user.id : 0;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const posts = db.prepare(`
      SELECT p.*, u.username, u.display_name, u.avatar_url,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE (p.user_id = ? OR p.user_id IN (SELECT followed_id FROM follows WHERE follower_id = ?))
      AND p.is_visible = 1
      ORDER BY p.created_at DESC
      LIMIT ?
    `).all(userId, userId, userId, limit);
    res.json(posts);
  });

  app.post("/api/posts", async (req, res) => {
    const { content, post_type, image_url } = req.body;
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });

    const isVisible = (post_type === 'image_post' && !image_url) ? 0 : 1;
    const stmt = db.prepare("INSERT INTO posts (user_id, content, post_type, is_visible, image_url) VALUES (?, ?, ?, ?, ?)");
    const info = stmt.run(user.id, content, post_type || 'life_update', isVisible, image_url || null);
    const postId = info.lastInsertRowid;
    
    res.json({ id: postId });

    if (image_url) {
      try {
        const description = await analyzeImage(image_url);
        db.prepare("UPDATE posts SET image_prompt = ? WHERE id = ?").run(description, postId);
      } catch (e) {
        console.error(e);
      }
    }

    if (post_type === 'image_post' && !image_url) {
      try {
        const { prompt: positivePrompt, characterVisible } = await generateImagePrompt(user, content);
        const negativePrompt = await generateNegativeImagePrompt(positivePrompt);
        
        let referenceImageUrls: string[] | undefined = undefined;
        if (characterVisible) {
          const refImages = JSON.parse(user.reference_images || '[]');
          if (refImages.length > 0) {
            referenceImageUrls = refImages;
          } else if (user.avatar_url) {
            referenceImageUrls = [user.avatar_url];
          }
        }
        
        const generatedImageUrl = await generateImage(positivePrompt, negativePrompt, referenceImageUrls);
        if (generatedImageUrl) {
          db.prepare("UPDATE posts SET image_url = ?, image_prompt = ?, is_visible = 1 WHERE id = ?").run(generatedImageUrl, positivePrompt, postId);
          triggerPostComments(postId, post_type || 'life_update');
        } else {
          db.prepare("DELETE FROM posts WHERE id = ?").run(postId);
        }
      } catch (e) {
        console.error("Failed to generate image for user post:", e);
        db.prepare("DELETE FROM posts WHERE id = ?").run(postId);
      }
    } else if (isVisible) {
      triggerPostComments(postId, post_type || 'life_update');
    }
  });

  // Comments
  app.get("/api/posts/:id/comments", (req, res) => {
    const user = getRealUser(req);
    const userId = user ? user.id : 0;

    const comments = db.prepare(`
      SELECT c.*, u.username, u.display_name, u.avatar_url,
      (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as like_count,
      (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id AND user_id = ?) as is_liked
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `).all(userId, req.params.id);
    res.json(comments);
  });

  app.post("/api/posts/:id/comments", (req, res) => {
    const { content, parent_id } = req.body;
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });

    const stmt = db.prepare("INSERT INTO comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)");
    const info = stmt.run(req.params.id, user.id, content, parent_id || null);
    res.json({ id: info.lastInsertRowid });

    let targetUserId = null;
    if (parent_id) {
      const parentComment = db.prepare("SELECT user_id FROM comments WHERE id = ?").get(parent_id) as any;
      if (parentComment) targetUserId = parentComment.user_id;
    } else {
      const post = db.prepare("SELECT user_id FROM posts WHERE id = ?").get(req.params.id) as any;
      if (post) targetUserId = post.user_id;
    }
    if (targetUserId) {
      checkDynamicRelationship(user.id, targetUserId).catch(console.error);
    }
  });

  app.get("/api/posts/:id/likers", (req, res) => {
    const likers = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar_url
      FROM likes l
      JOIN users u ON l.user_id = u.id
      WHERE l.post_id = ?
    `).all(req.params.id);
    res.json(likers);
  });

  app.get("/api/comments/:id/likers", (req, res) => {
    const likers = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar_url
      FROM comment_likes cl
      JOIN users u ON cl.user_id = u.id
      WHERE cl.comment_id = ?
    `).all(req.params.id);
    res.json(likers);
  });

  // Delete and Edit Posts
  app.get("/api/posts/:id", (req, res) => {
    const user = getRealUser(req);
    const post = db.prepare(`
      SELECT p.*, u.username, u.display_name, u.avatar_url, u.account_type,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments,
      EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ? AND p.is_visible = 1
    `).get(user?.id || 0, req.params.id);
    if (post) {
      res.json(post);
    } else {
      res.status(404).json({ error: "Post not found" });
    }
  });

  app.delete("/api/posts/:id", (req, res) => {
    try {
      const postId = req.params.id;
      db.prepare("DELETE FROM comment_likes WHERE comment_id IN (SELECT id FROM comments WHERE post_id = ?)").run(postId);
      db.prepare("DELETE FROM notifications WHERE type = 'like_comment' AND reference_id IN (SELECT id FROM comments WHERE post_id = ?)").run(postId);
      db.prepare("DELETE FROM comments WHERE post_id = ?").run(postId);
      db.prepare("DELETE FROM likes WHERE post_id = ?").run(postId);
      db.prepare("DELETE FROM notifications WHERE type IN ('like_post', 'comment', 'reply') AND reference_id = ?").run(postId);
      db.prepare("DELETE FROM posts WHERE id = ?").run(postId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/posts/:id", (req, res) => {
    try {
      const { content } = req.body;
      db.prepare("UPDATE posts SET content = ? WHERE id = ?").run(content, req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Delete and Edit Comments
  app.get("/api/comments/:id", (req, res) => {
    const comment = db.prepare(`
      SELECT c.*, u.username, u.display_name, u.avatar_url
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(req.params.id);
    if (comment) {
      res.json(comment);
    } else {
      res.status(404).json({ error: "Comment not found" });
    }
  });

  app.delete("/api/comments/:id", (req, res) => {
    try {
      const commentId = req.params.id;
      db.prepare("DELETE FROM comment_likes WHERE comment_id IN (SELECT id FROM comments WHERE parent_id = ?)").run(commentId);
      db.prepare("DELETE FROM notifications WHERE type = 'like_comment' AND reference_id IN (SELECT id FROM comments WHERE parent_id = ?)").run(commentId);
      db.prepare("DELETE FROM comment_likes WHERE comment_id = ?").run(commentId);
      db.prepare("DELETE FROM notifications WHERE type = 'like_comment' AND reference_id = ?").run(commentId);
      db.prepare("DELETE FROM comments WHERE parent_id = ?").run(commentId);
      db.prepare("DELETE FROM comments WHERE id = ?").run(commentId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/comments/:id", (req, res) => {
    try {
      const { content } = req.body;
      db.prepare("UPDATE comments SET content = ? WHERE id = ?").run(content, req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Likes
  app.post("/api/posts/:id/like", (req, res) => {
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });

    try {
      db.prepare("INSERT INTO likes (post_id, user_id) VALUES (?, ?)").run(req.params.id, user.id);
      res.json({ success: true });
    } catch (e) {
      // Already liked, so unlike
      db.prepare("DELETE FROM likes WHERE post_id = ? AND user_id = ?").run(req.params.id, user.id);
      res.json({ success: true, unliked: true });
    }
  });

  app.post("/api/comments/:id/like", (req, res) => {
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });

    try {
      db.prepare("INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)").run(req.params.id, user.id);
      res.json({ success: true });
    } catch (e) {
      db.prepare("DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?").run(req.params.id, user.id);
      res.json({ success: true, unliked: true });
    }
  });

  // Group Chats
  app.get("/api/group-chats", (req, res) => {
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });

    const groups = db.prepare(`
      SELECT gc.*, 
      (SELECT content FROM group_chat_messages WHERE group_chat_id = gc.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM group_chat_messages WHERE group_chat_id = gc.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
      (SELECT COUNT(*) FROM group_chat_messages WHERE group_chat_id = gc.id AND created_at > gcm.last_read_at) as unread_count
      FROM group_chats gc
      JOIN group_chat_members gcm ON gc.id = gcm.group_chat_id
      WHERE gcm.user_id = ?
      ORDER BY last_message_time DESC NULLS LAST, gc.created_at DESC
    `).all(user.id);

    for (const group of groups as any[]) {
      group.members = db.prepare(`
        SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_ai, u.online_times, u.current_online_status, u.status_expires_at
        FROM users u
        JOIN group_chat_members gcm ON u.id = gcm.user_id
        WHERE gcm.group_chat_id = ?
      `).all(group.id);
    }

    res.json(groups);
  });

  app.post("/api/group-chats", (req, res) => {
    const { name, member_ids } = req.body;
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });

    try {
      const stmt = db.prepare("INSERT INTO group_chats (name) VALUES (?)");
      const info = stmt.run(name);
      const groupId = info.lastInsertRowid;

      const insertMember = db.prepare("INSERT INTO group_chat_members (group_chat_id, user_id) VALUES (?, ?)");
      insertMember.run(groupId, user.id);
      for (const memberId of member_ids) {
        insertMember.run(groupId, memberId);
      }

      res.json({ id: groupId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/group-chats/:id/messages", (req, res) => {
    const user = getRealUser(req);
    if (user) {
      db.prepare("UPDATE group_chat_members SET last_read_at = CURRENT_TIMESTAMP WHERE group_chat_id = ? AND user_id = ?").run(req.params.id, user.id);
    }

    const limit = parseInt(req.query.limit as string) || 40;
    const beforeId = req.query.before_id ? parseInt(req.query.before_id as string) : null;

    let query = `
      SELECT m.*, u.display_name, u.username, u.avatar_url
      FROM group_chat_messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.group_chat_id = ?
    `;
    const params: any[] = [req.params.id];

    if (beforeId) {
      query += " AND m.id < ?";
      params.push(beforeId);
    }

    query += ` ORDER BY m.id DESC LIMIT ?`;
    params.push(limit);

    const messages = db.prepare(`SELECT * FROM (${query}) ORDER BY id ASC`).all(...params);
    res.json(messages);
  });

  app.put("/api/group-chats/messages/:id", (req, res) => {
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });
    const { content } = req.body;
    
    const msg = db.prepare("SELECT * FROM group_chat_messages WHERE id = ?").get(req.params.id) as any;
    if (!msg) return res.status(404).json({ error: "Message not found" });
    
    const isMember = db.prepare("SELECT 1 FROM group_chat_members WHERE group_chat_id = ? AND user_id = ?").get(msg.group_chat_id, user.id);
    if (!isMember && user.role !== 'admin') {
      return res.status(403).json({ error: "Unauthorized" });
    }
    
    db.prepare("UPDATE group_chat_messages SET content = ? WHERE id = ?").run(content, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/group-chats/messages/:id", (req, res) => {
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });
    
    const msg = db.prepare("SELECT * FROM group_chat_messages WHERE id = ?").get(req.params.id) as any;
    if (!msg) return res.status(404).json({ error: "Message not found" });
    
    const isMember = db.prepare("SELECT 1 FROM group_chat_members WHERE group_chat_id = ? AND user_id = ?").get(msg.group_chat_id, user.id);
    if (!isMember && user.role !== 'admin') {
      return res.status(403).json({ error: "Unauthorized" });
    }
    
    db.prepare("DELETE FROM group_chat_messages WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/group-chats/:id/messages", async (req, res) => {
    const { content } = req.body;
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });

    const groupId = req.params.id;
    try {
      db.prepare("INSERT INTO group_chat_messages (group_chat_id, sender_id, content) VALUES (?, ?, ?)")
        .run(groupId, user.id, content);
      
      res.json({ success: true });

      // AI Reply logic
      const group = db.prepare("SELECT * FROM group_chats WHERE id = ?").get(groupId) as any;
      if (!group) return;

      const members = db.prepare(`
        SELECT u.* FROM users u
        JOIN group_chat_members gcm ON u.id = gcm.user_id
        WHERE gcm.group_chat_id = ? AND u.is_ai = 1 AND u.is_active = 1
      `).all(groupId) as any[];

      const history = db.prepare(`
        SELECT m.sender_id, m.content, u.display_name, m.created_at
        FROM group_chat_messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.group_chat_id = ?
        ORDER BY m.created_at DESC LIMIT 15
      `).all(groupId).reverse();

      const formattedHistory = history.map((msg: any) => ({
        role: msg.sender_id === user.id ? 'user' : 'assistant',
        content: `[${msg.created_at}] [${msg.display_name}]: ${msg.content}`
      }));

      // Let each AI decide if they want to reply (e.g. based on activity level or if mentioned)
      const settings = db.prepare("SELECT timezone FROM settings WHERE id = 1").get() as any;
      const timezone = settings?.timezone || 'UTC';

      for (const aiUser of members) {
        if (!isUserOnline(aiUser, timezone)) continue;

        const isMentioned = content.toLowerCase().includes(aiUser.display_name.toLowerCase()) || content.toLowerCase().includes(aiUser.username.toLowerCase());
        const activityLevel = aiUser.activity_level ?? 5;
        // Base probability between 5% and 50% depending on activity level
        const baseProb = (activityLevel / 10) * 0.5;
        const shouldReply = isMentioned || Math.random() < baseProb;
        
        if (shouldReply) {
          const gcKey = `${groupId}:${aiUser.id}`;
          if (pendingGroupChats.has(gcKey)) continue;
          pendingGroupChats.add(gcKey);

          try {
            const otherMembers = db.prepare(`
              SELECT u.* FROM users u
              JOIN group_chat_members gcm ON u.id = gcm.user_id
              WHERE gcm.group_chat_id = ? AND u.id != ?
            `).all(groupId, aiUser.id) as any[];

            const reply = await generateGroupChatReply(aiUser, group.name, formattedHistory, otherMembers);
            if (reply) {
              db.prepare("INSERT INTO group_chat_messages (group_chat_id, sender_id, content) VALUES (?, ?, ?)")
                .run(groupId, aiUser.id, reply);
              
              // Add this reply to history for the next AI
              formattedHistory.push({
                role: 'assistant',
                content: `[${new Date().toISOString()}] [${aiUser.display_name}]: ${reply}`
              });
            }
          } finally {
            pendingGroupChats.delete(gcKey);
          }
        }
      }

    } catch (e: any) {
      console.error("Error in /api/group-chats/:id/messages:", e);
    }
  });

  // Favorites
  app.get("/api/favorites", (req, res) => {
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });

    const favorites = db.prepare("SELECT * FROM dm_favorites WHERE user_id = ?").all(user.id);
    res.json(favorites);
  });

  app.post("/api/favorites", (req, res) => {
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });

    const { target_id, is_group } = req.body;
    db.prepare("INSERT OR IGNORE INTO dm_favorites (user_id, target_id, is_group) VALUES (?, ?, ?)")
      .run(user.id, target_id, is_group ? 1 : 0);
    res.json({ success: true });
  });

  app.delete("/api/favorites/:targetId", (req, res) => {
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });

    const isGroup = req.query.is_group === 'true' ? 1 : 0;
    db.prepare("DELETE FROM dm_favorites WHERE user_id = ? AND target_id = ? AND is_group = ?")
      .run(user.id, req.params.targetId, isGroup);
    res.json({ success: true });
  });

  // DMs
  app.get("/api/dms", (req, res) => {
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });

    // Get latest message per conversation
    const conversations = db.prepare(`
      WITH LatestMessages AS (
        SELECT 
          CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as other_user_id,
          MAX(id) as max_id
        FROM direct_messages
        WHERE sender_id = ? OR receiver_id = ?
        GROUP BY CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END
      )
      SELECT 
        u.id as other_user_id, u.username, u.display_name, u.avatar_url, u.is_ai, u.online_times, u.current_online_status, u.status_expires_at,
        dm.content as last_message, dm.created_at, dm.is_read,
        dm.sender_id,
        (SELECT COUNT(*) FROM direct_messages WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0) as unread_count
      FROM LatestMessages lm
      JOIN direct_messages dm ON dm.id = lm.max_id
      JOIN users u ON u.id = lm.other_user_id
      ORDER BY dm.created_at DESC
    `).all(user.id, user.id, user.id, user.id, user.id);
    res.json(conversations);
  });

  app.get("/api/dms/:userId", (req, res) => {
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });

    const limit = parseInt(req.query.limit as string) || 40;
    const beforeId = req.query.before_id ? parseInt(req.query.before_id as string) : null;

    let query = `
      SELECT * FROM direct_messages
      WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
    `;
    const params: any[] = [user.id, req.params.userId, req.params.userId, user.id];

    if (beforeId) {
      query += " AND id < ?";
      params.push(beforeId);
    }

    query += ` ORDER BY id DESC LIMIT ?`;
    params.push(limit);

    const messages = db.prepare(`SELECT * FROM (${query}) ORDER BY id ASC`).all(...params);
    
    // Mark as read
    db.prepare("UPDATE direct_messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0")
      .run(req.params.userId, user.id);

    res.json(messages);
  });

  app.get("/api/dms/settings/:targetId", (req, res) => {
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });
    const isGroup = req.query.isGroup === 'true';
    const settings = db.prepare("SELECT * FROM dm_settings WHERE user_id = ? AND target_id = ? AND is_group = ?").get(user.id, req.params.targetId, isGroup ? 1 : 0) as any;
    res.json(settings || { allow_image_gen: 0 });
  });

  app.post("/api/dms/settings/:targetId", (req, res) => {
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });
    const { allow_image_gen } = req.body;
    const isGroup = req.query.isGroup === 'true';
    db.prepare(`
      INSERT INTO dm_settings (user_id, target_id, is_group, allow_image_gen)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, target_id, is_group) DO UPDATE SET allow_image_gen = excluded.allow_image_gen
    `).run(user.id, req.params.targetId, isGroup ? 1 : 0, allow_image_gen ? 1 : 0);
    res.json({ success: true });
  });

  app.delete("/api/dms/:userId", (req, res) => {
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });

    db.prepare("DELETE FROM direct_messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)")
      .run(user.id, req.params.userId, req.params.userId, user.id);
    
    res.json({ success: true });
  });

  app.put("/api/dms/messages/:id", (req, res) => {
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });
    const { content } = req.body;
    
    const msg = db.prepare("SELECT * FROM direct_messages WHERE id = ?").get(req.params.id) as any;
    if (!msg) return res.status(404).json({ error: "Message not found" });
    
    if (msg.sender_id !== user.id && msg.receiver_id !== user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    
    db.prepare("UPDATE direct_messages SET content = ? WHERE id = ?").run(content, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/dms/messages/:id", (req, res) => {
    const user = getRealUser(req);
    if (!user) return res.status(401).json({ error: "User not found" });
    
    const msg = db.prepare("SELECT * FROM direct_messages WHERE id = ?").get(req.params.id) as any;
    if (!msg) return res.status(404).json({ error: "Message not found" });
    
    if (msg.sender_id !== user.id && msg.receiver_id !== user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    
    db.prepare("DELETE FROM direct_messages WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/dms/:userId", async (req, res) => {
    try {
      const { content, image_url } = req.body;
      const user = getRealUser(req);
      if (!user) return res.status(401).json({ error: "User not found" });

      const receiverId = req.params.userId;
      
      let finalContent = content?.trim() || "";
      if (image_url) {
        const description = await analyzeImage(image_url);
        finalContent = `${finalContent}\n\n[User sent an image. Description: ${description}]`.trim();
      }

      db.prepare("INSERT INTO direct_messages (sender_id, receiver_id, content, image_url) VALUES (?, ?, ?, ?)")
        .run(user.id, receiverId, finalContent, image_url || null);
      
      res.json({ success: true });

      checkDynamicRelationship(user.id, parseInt(receiverId)).catch(console.error);

      // AI Reply logic
      const receiver = db.prepare("SELECT * FROM users WHERE id = ? AND is_ai = 1 AND is_active = 1").get(receiverId) as any;
      const settings = db.prepare("SELECT timezone FROM settings WHERE id = 1").get() as any;
      if (receiver && isUserOnline(receiver, settings?.timezone || 'UTC')) {
        const dmKey = `${receiverId}:${user.id}`;
        if (pendingDMs.has(dmKey)) return;
        pendingDMs.add(dmKey);
        
        try {
          // Get dm settings for allow_image_gen
          const dmSettings = db.prepare("SELECT allow_image_gen FROM dm_settings WHERE user_id = ? AND target_id = ? AND is_group = 0").get(user.id, receiverId) as any;
          const allowImageGen = dmSettings?.allow_image_gen === 1;

          // Get recent history
          const history = db.prepare(`
            SELECT sender_id, content, created_at FROM direct_messages
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
            ORDER BY created_at DESC LIMIT 10
          `).all(user.id, receiverId, receiverId, user.id).reverse();

          const formattedHistory = history.map((msg: any) => ({
            role: msg.sender_id === receiverId ? 'assistant' : 'user',
            content: msg.content,
            created_at: msg.created_at
          }));

          const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(receiverId, user.id) as any;
          const relContext = rel ? rel.description : '';

          const replyData = await replyToDM(receiver, user.display_name, formattedHistory, relContext, user.id, false, allowImageGen);
          if (replyData) {
            const { content: replyContent, imagePrompt } = replyData;
            
            const info = db.prepare("INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)")
              .run(receiverId, user.id, replyContent.trim());
            const msgId = info.lastInsertRowid;

            if (imagePrompt && allowImageGen) {
              // Generate image
              const imageUrl = await generateImage(imagePrompt, undefined, receiver.avatar_url ? [receiver.avatar_url] : undefined);
              if (imageUrl) {
                db.prepare("UPDATE direct_messages SET image_url = ?, image_prompt = ? WHERE id = ?").run(imageUrl, imagePrompt, msgId);
              }
            }
            checkDynamicRelationship(receiver.id, user.id).catch(console.error);
          }
        } finally {
          pendingDMs.delete(dmKey);
        }
      }
    } catch (e: any) {
      console.error("Error in /api/dms/:userId:", e);
      if (!res.headersSent) {
        res.status(500).json({ error: e.message });
      }
    }
  });

  // Background Worker for AI Activity
  setInterval(async () => {
    try {
      await handleOPReplies();
      
      const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get() as any;
      if (!settings || !settings.ai_enabled) return;

      const allUsers = db.prepare("SELECT * FROM users").all() as any[];
      const onlineUsers = allUsers.filter(u => isUserOnline(u, settings.timezone || 'UTC'));
      const onlineRatio = allUsers.length > 0 ? onlineUsers.length / allUsers.length : 0;

      const allAiUsers = allUsers.filter(u => u.is_ai === 1);
      const onlineAiUsers = onlineUsers.filter(u => u.is_ai === 1);
      const activeAiUsers = onlineAiUsers.filter(u => u.is_active === 1);
      if (allAiUsers.length === 0) return;

      const probPost = ((settings.prob_post ?? 100) / 1440) * onlineRatio;
      const probComment = ((settings.prob_comment ?? 1000) / 1440) * onlineRatio;
      const probMessage = ((settings.prob_message ?? 5) / 1440) * onlineRatio;

      // Local actions (Likes & Follows) - Doesn't use API tokens
      if (Math.random() < 0.3 && activeAiUsers.length > 0) {
        const randomAi = pickWeightedRandomUser(activeAiUsers);
        // 30% chance to do some local actions
        const recentPosts = db.prepare("SELECT id, user_id FROM posts WHERE is_visible = 1 ORDER BY created_at DESC LIMIT 10").all() as any[];
        if (recentPosts.length > 0) {
          const postToLike = recentPosts[Math.floor(Math.random() * recentPosts.length)];
          try {
            db.prepare("INSERT INTO likes (post_id, user_id) VALUES (?, ?)").run(postToLike.id, randomAi.id);
          } catch (e) {} // Already liked
        }

        const recentComments = db.prepare("SELECT id, user_id FROM comments ORDER BY created_at DESC LIMIT 10").all() as any[];
        if (recentComments.length > 0) {
          const commentToLike = recentComments[Math.floor(Math.random() * recentComments.length)];
          try {
            db.prepare("INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)").run(commentToLike.id, randomAi.id);
          } catch (e) {} // Already liked
        }

        // Randomly follow someone
        const otherAiUsers = activeAiUsers.filter(u => u.id !== randomAi.id);
        if (otherAiUsers.length > 0) {
          const totalAiUsersCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE is_ai = 1").get() as any;
          const followingCountA = db.prepare("SELECT COUNT(*) as c FROM follows WHERE follower_id = ? AND followed_id IN (SELECT id FROM users WHERE is_ai = 1)").get(randomAi.id) as any;
          
          const followingRatio = followingCountA.c / Math.max(1, totalAiUsersCount.c);
          
          let shouldFollow = false;
          if (followingRatio < 0.01) {
              shouldFollow = true;
          } else if (followingRatio < 0.40) {
              if (followingRatio < 0.10) {
                  shouldFollow = Math.random() < 0.8;
              } else if (followingRatio < 0.30) {
                  shouldFollow = Math.random() < 0.3;
              } else {
                  shouldFollow = Math.random() < 0.05;
              }
          }

          if (shouldFollow) {
            let userToFollow = pickWeightedRandomUser(otherAiUsers);
            
            // Try to find someone from the same universe
            if (randomAi.universe_id) {
              const sameUniverseUsers = db.prepare(`
                SELECT id as user_id
                FROM users 
                WHERE universe_id = ? AND id != ? AND is_ai = 1
                LIMIT 5
              `).all(randomAi.universe_id, randomAi.id) as any[];
              
              if (sameUniverseUsers.length > 0) {
                const crossUniverseProb = (settings.cross_universe_prob ?? 50.0) / 100;
                if (Math.random() > crossUniverseProb) {
                  const pickedSimilar = sameUniverseUsers[Math.floor(Math.random() * sameUniverseUsers.length)];
                  const foundUser = otherAiUsers.find(u => u.id === pickedSimilar.user_id);
                  if (foundUser) userToFollow = foundUser;
                }
              }
            }

            if (userToFollow) {
              // Follower scaling for userToFollow
              const followerCountB = db.prepare("SELECT COUNT(*) as c FROM follows WHERE followed_id = ? AND follower_id IN (SELECT id FROM users WHERE is_ai = 1)").get(userToFollow.id) as any;
              const followedRatio = followerCountB.c / Math.max(1, totalAiUsersCount.c);
              
              // The more followers, the harder to gain new ones.
              const followSuccessProb = Math.max(0.01, 1 - followedRatio);

              if (Math.random() < followSuccessProb) {
                try {
                  db.prepare("INSERT INTO follows (follower_id, followed_id) VALUES (?, ?)").run(randomAi.id, userToFollow.id);
                } catch (e) {} // Already following
              }
            }
          }
        }
      }


      const realUsers = db.prepare("SELECT * FROM users WHERE is_ai = 0").all() as any[];
      if (realUsers.length > 0 && activeAiUsers.length > 0) {
        const realUser = realUsers[Math.floor(Math.random() * realUsers.length)];
        
        let userProbMessage = probMessage;
        if (realUser.dm_frequency === 'never') userProbMessage = 0;
        else if (realUser.dm_frequency === 'low') userProbMessage *= 0.2;
        else if (realUser.dm_frequency === 'high') userProbMessage *= 3.0;

        if (Math.random() < userProbMessage) {
          const followedAis = db.prepare(`
            SELECT u.* FROM users u
            JOIN follows f ON f.followed_id = u.id
            WHERE f.follower_id = ? AND u.is_ai = 1 AND u.is_active = 1
          `).all(realUser.id) as any[];
          
          const onlineFollowedAis = followedAis.filter(u => isUserOnline(u, settings.timezone || 'UTC'));

          if (onlineFollowedAis.length > 0) {
            const probFavoriteDm = (settings.prob_favorite_dm ?? 50.0) / 100;
            
            if (Math.random() < probFavoriteDm) {
              const favorites = db.prepare("SELECT target_id, is_group FROM dm_favorites WHERE user_id = ?").all(realUser.id) as any[];
              if (favorites.length > 0) {
                const randomFav = favorites[Math.floor(Math.random() * favorites.length)];
                if (randomFav.is_group) {
                  const aiMembers = db.prepare(`
                    SELECT u.* FROM users u
                    JOIN group_chat_members gcm ON gcm.user_id = u.id
                    JOIN follows f ON f.followed_id = u.id
                    WHERE gcm.group_chat_id = ? AND u.is_ai = 1 AND u.is_active = 1 AND f.follower_id = ?
                  `).all(randomFav.target_id, realUser.id) as any[];
                  
                  if (aiMembers.length > 0) {
                    const randomAi = pickWeightedRandomUser(aiMembers);
                    const groupChat = db.prepare("SELECT name FROM group_chats WHERE id = ?").get(randomFav.target_id) as any;
                    const recentMessages = db.prepare(`
                      SELECT sender_id, content, created_at FROM group_chat_messages
                      WHERE group_chat_id = ?
                      ORDER BY created_at DESC LIMIT 15
                    `).all(randomFav.target_id).reverse();
                    
                    const formattedHistory = recentMessages.map((msg: any) => {
                      const sender = db.prepare("SELECT display_name FROM users WHERE id = ?").get(msg.sender_id) as any;
                      return {
                        role: msg.sender_id === randomAi.id ? 'assistant' : 'user',
                        name: sender ? sender.display_name : 'Unknown',
                        content: msg.content,
                        created_at: msg.created_at
                      };
                    });
                    
                    const gcKey = `${randomFav.target_id}:${randomAi.id}`;
                    if (!pendingGroupChats.has(gcKey)) {
                      pendingGroupChats.add(gcKey);

                      try {
                        const otherMembers = db.prepare(`
                          SELECT u.display_name, u.description FROM users u
                          JOIN group_chat_members gcm ON gcm.user_id = u.id
                          WHERE gcm.group_chat_id = ? AND u.id != ?
                        `).all(randomFav.target_id, randomAi.id) as any[];
                        
                        const replyContent = await generateGroupChatReply(randomAi, groupChat.name, formattedHistory, otherMembers);
                        if (replyContent) {
                          db.prepare("INSERT INTO group_chat_messages (group_chat_id, sender_id, content) VALUES (?, ?, ?)")
                            .run(randomFav.target_id, randomAi.id, replyContent.trim());
                          console.log(`${randomAi.display_name} sent a message to group chat ${groupChat.name}`);
                        }
                      } finally {
                        pendingGroupChats.delete(gcKey);
                      }
                    }
                  }
                } else {
                  const randomAi = db.prepare(`
                    SELECT u.* FROM users u 
                    JOIN follows f ON f.followed_id = u.id
                    WHERE u.id = ? AND u.is_ai = 1 AND u.is_active = 1 AND f.follower_id = ?
                  `).get(randomFav.target_id, realUser.id) as any;
                  if (randomAi) {
                    const dmKey = `${randomAi.id}:${realUser.id}`;
                    if (!pendingDMs.has(dmKey)) {
                      pendingDMs.add(dmKey);

                      try {
                        const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(randomAi.id, realUser.id) as any;
                        const relContext = rel ? rel.description : '';
                        
                        const messageHistory = db.prepare(`
                          SELECT sender_id, content, created_at 
                          FROM direct_messages 
                          WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                          ORDER BY created_at ASC
                        `).all(randomAi.id, realUser.id, realUser.id, randomAi.id).map((m: any) => ({
                          role: m.sender_id === randomAi.id ? 'assistant' : 'user',
                          content: m.content,
                          created_at: m.created_at
                        }));

                        const dmContent = await generateDM(randomAi, realUser.display_name, relContext, realUser.id, '', messageHistory);
                        if (dmContent) {
                          db.prepare("INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)")
                            .run(randomAi.id, realUser.id, dmContent.trim());
                          checkDynamicRelationship(randomAi.id, realUser.id).catch(console.error);
                          console.log(`${randomAi.display_name} sent a DM to ${realUser.display_name}`);
                        }
                      } finally {
                        pendingDMs.delete(dmKey);
                      }
                    }
                  }
                }
              } else {
                // Fallback if no favorites
                const randomAi = pickWeightedRandomUser(onlineFollowedAis);
                const dmKey = `${randomAi.id}:${realUser.id}`;
                if (!pendingDMs.has(dmKey)) {
                  pendingDMs.add(dmKey);

                  try {
                    const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(randomAi.id, realUser.id) as any;
                    const relContext = rel ? rel.description : '';
                    
                    const messageHistory = db.prepare(`
                      SELECT sender_id, content, created_at 
                      FROM direct_messages 
                      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                      ORDER BY created_at ASC
                    `).all(randomAi.id, realUser.id, realUser.id, randomAi.id).map((m: any) => ({
                      role: m.sender_id === randomAi.id ? 'assistant' : 'user',
                      content: m.content,
                      created_at: m.created_at
                    }));

                    const dmContent = await generateDM(randomAi, realUser.display_name, relContext, realUser.id, '', messageHistory);
                    if (dmContent) {
                      db.prepare("INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)")
                        .run(randomAi.id, realUser.id, dmContent.trim());
                      checkDynamicRelationship(randomAi.id, realUser.id).catch(console.error);
                      console.log(`${randomAi.display_name} sent a DM to ${realUser.display_name}`);
                    }
                  } finally {
                    pendingDMs.delete(dmKey);
                  }
                }
              }
            } else {
              // Random AI
              const randomAi = pickWeightedRandomUser(onlineFollowedAis);
              const dmKey = `${randomAi.id}:${realUser.id}`;
              if (!pendingDMs.has(dmKey)) {
                pendingDMs.add(dmKey);

                try {
                  const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(randomAi.id, realUser.id) as any;
                  const relContext = rel ? rel.description : '';
                  
                  const messageHistory = db.prepare(`
                    SELECT sender_id, content, created_at 
                    FROM direct_messages 
                    WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                    ORDER BY created_at ASC
                  `).all(randomAi.id, realUser.id, realUser.id, randomAi.id).map((m: any) => ({
                    role: m.sender_id === randomAi.id ? 'assistant' : 'user',
                    content: m.content,
                    created_at: m.created_at
                  }));

                  const dmContent = await generateDM(randomAi, realUser.display_name, relContext, realUser.id, '', messageHistory);
                  if (dmContent) {
                    db.prepare("INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)")
                      .run(randomAi.id, realUser.id, dmContent.trim());
                    checkDynamicRelationship(randomAi.id, realUser.id).catch(console.error);
                    console.log(`${randomAi.display_name} sent a DM to ${realUser.display_name}`);
                  }
                } finally {
                  pendingDMs.delete(dmKey);
                }
              }
            }
          }
        }
      } 

      // Handle unreplied DMs from real user
      const allRealUsers = db.prepare("SELECT id, display_name FROM users WHERE is_ai = 0").all() as any[];
      for (const realUser of allRealUsers) {
        if (activeAiUsers.length > 0) {
          const unrepliedDms = db.prepare(`
          SELECT dm.*, u.online_times
          FROM direct_messages dm
          JOIN users u ON dm.receiver_id = u.id
          WHERE dm.receiver_id IN (SELECT id FROM users WHERE is_ai = 1 AND is_active = 1)
          AND dm.sender_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM direct_messages reply 
            WHERE reply.sender_id = dm.receiver_id AND reply.receiver_id = dm.sender_id AND reply.id > dm.id
          )
        `).all(realUser.id) as any[];

        const onlineUnrepliedDms = unrepliedDms.filter(dm => isUserOnline(dm, settings.timezone || 'UTC'));
        
        for (const dm of onlineUnrepliedDms) {
          if (Math.random() < 0.5) { // 50% chance to reply per worker tick to not spam
            const aiUser = activeAiUsers.find(u => u.id === dm.receiver_id);
            if (aiUser) {
              const dmKey = `${aiUser.id}:${realUser.id}`;
              if (pendingDMs.has(dmKey)) continue;
              pendingDMs.add(dmKey);

              try {
                const history = db.prepare(`
                  SELECT sender_id, content, created_at FROM direct_messages
                  WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                  ORDER BY created_at DESC LIMIT 10
                `).all(realUser.id, aiUser.id, aiUser.id, realUser.id).reverse();

                const formattedHistory = history.map((msg: any) => ({
                  role: msg.sender_id === aiUser.id ? 'assistant' : 'user',
                  content: msg.content,
                  created_at: msg.created_at
                }));

                const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(aiUser.id, realUser.id) as any;
                const relContext = rel ? rel.description : '';

                const reply = await replyToDM(aiUser, realUser.display_name, formattedHistory, relContext, realUser.id, true);
                if (reply) {
                  db.prepare("INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)")
                    .run(aiUser.id, realUser.id, reply);
                  checkDynamicRelationship(aiUser.id, realUser.id).catch(console.error);
                  console.log(`${aiUser.display_name} replied to pending DM from ${realUser.display_name}`);
                }
              } finally {
                pendingDMs.delete(dmKey);
              }
            }
          }
        }
      }
    }
      
      if (onlineAiUsers.length > 0) {
        const randomAi = pickWeightedRandomUser(onlineAiUsers);
        const followersCount = (db.prepare("SELECT COUNT(*) as count FROM follows f JOIN users u ON f.follower_id = u.id WHERE f.followed_id = ? AND u.is_ai = 0").get(randomAi.id) as any).count;
        
        let multiplier = 0.5;
        if (followersCount === 1) multiplier = 1.0;
        else if (followersCount === 2) multiplier = 1.5;
        else if (followersCount === 3) multiplier = 1.7;
        else if (followersCount > 3) multiplier = 1.7 + Math.log10(followersCount - 2) * 0.5;

        if (Math.random() < probPost * multiplier) {
          await doAiPost(randomAi, null);
        }
      }

      // Independent chance for inactive users to post their intro to ensure scalability
      let introPostsThisMinute = 0;
      const inactiveAiUsers = onlineAiUsers.filter(u => u.is_active === 0);
      for (const inactiveUser of inactiveAiUsers) {
        if (introPostsThisMinute >= 3) break; // Limit to 3 intro posts per minute to avoid rate limits
        
        const createdAt = new Date(inactiveUser.created_at + 'Z').getTime();
        const daysSinceCreation = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
        
        let introProb = 0;
        if (daysSinceCreation > 7) {
          introProb = 0.05; // 5% chance per minute while online
        } else if (daysSinceCreation > 3) {
          introProb = ((daysSinceCreation - 3) / 4) * 0.02; // Scales 0 to 2% chance per minute
        }
        
        const followersCount = (db.prepare("SELECT COUNT(*) as count FROM follows f JOIN users u ON f.follower_id = u.id WHERE f.followed_id = ? AND u.is_ai = 0").get(inactiveUser.id) as any).count;
        let multiplier = 0.5;
        if (followersCount === 1) multiplier = 1.0;
        else if (followersCount === 2) multiplier = 1.5;
        else if (followersCount === 3) multiplier = 1.7;
        else if (followersCount > 3) multiplier = 1.7 + Math.log10(followersCount - 2) * 0.5;

        if (introProb > 0 && Math.random() < introProb * multiplier) {
          await doAiPost(inactiveUser, null);
          introPostsThisMinute++;
        }
      }

      // Independent chance for active users who haven't posted in a while to ensure they don't go inactive
      let catchupPostsThisMinute = 0;
      for (const activeUser of activeAiUsers) {
        if (catchupPostsThisMinute >= 3) break; // Limit to avoid rate limits
        
        const lastPost = db.prepare("SELECT created_at FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(activeUser.id) as any;
        const referenceTime = lastPost ? new Date(lastPost.created_at + 'Z').getTime() : new Date(activeUser.created_at + 'Z').getTime();
        const daysSinceLastPost = (Date.now() - referenceTime) / (1000 * 60 * 60 * 24);
        
        if (daysSinceLastPost > 7) {
          let catchupProb = 0;
          if (daysSinceLastPost > 14) {
            catchupProb = 0.05; // 5% chance per minute while online
          } else {
            catchupProb = ((daysSinceLastPost - 7) / 7) * 0.02; // Scales 0 to 2% chance per minute
          }
          
          const followersCount = (db.prepare("SELECT COUNT(*) as count FROM follows f JOIN users u ON f.follower_id = u.id WHERE f.followed_id = ? AND u.is_ai = 0").get(activeUser.id) as any).count;
          let multiplier = 0.5;
          if (followersCount === 1) multiplier = 1.0;
          else if (followersCount === 2) multiplier = 1.5;
          else if (followersCount === 3) multiplier = 1.7;
          else if (followersCount > 3) multiplier = 1.7 + Math.log10(followersCount - 2) * 0.5;

          if (catchupProb > 0 && Math.random() < catchupProb * multiplier) {
            await doAiPost(activeUser, null);
            catchupPostsThisMinute++;
          }
        }
      }

      // Handle Group Chat Replies (AI talking to AI or continuing conversation)
      if (Math.random() < 0.3 && activeAiUsers.length > 0) {
        // Find a recent group chat
        const recentGroups = db.prepare(`
          SELECT gc.id, gc.name, MAX(gcm.created_at) as last_msg_time
          FROM group_chats gc
          JOIN group_chat_messages gcm ON gc.id = gcm.group_chat_id
          GROUP BY gc.id
          ORDER BY last_msg_time DESC LIMIT 5
        `).all() as any[];

        if (recentGroups.length > 0) {
          const group = recentGroups[Math.floor(Math.random() * recentGroups.length)];
          
          // Get members
          const members = db.prepare(`
            SELECT u.* FROM users u
            JOIN group_chat_members gcm ON u.id = gcm.user_id
            WHERE gcm.group_chat_id = ? AND u.is_ai = 1 AND u.is_active = 1
          `).all(group.id) as any[];

          const onlineMembers = members.filter(m => isUserOnline(m, settings.timezone || 'UTC'));
          
          if (onlineMembers.length > 0) {
            // Pick an AI to reply based on activity level
            const totalActivity = onlineMembers.reduce((sum, m) => sum + (m.activity_level ?? 5), 0);
            let random = Math.random() * totalActivity;
            let selectedAi = onlineMembers[0];
            for (const m of onlineMembers) {
              random -= (m.activity_level ?? 5);
              if (random <= 0) {
                selectedAi = m;
                break;
              }
            }

            // Check if the last message was already from this AI
            const lastMsg = db.prepare("SELECT sender_id FROM group_chat_messages WHERE group_chat_id = ? ORDER BY created_at DESC LIMIT 1").get(group.id) as any;
            
            if (lastMsg && lastMsg.sender_id !== selectedAi.id) {
              const gcKey = `${group.id}:${selectedAi.id}`;
              if (!pendingGroupChats.has(gcKey)) {
                pendingGroupChats.add(gcKey);

                try {
                const history = db.prepare(`
                  SELECT m.sender_id, m.content, u.display_name, m.created_at, u.is_ai
                  FROM group_chat_messages m
                  JOIN users u ON m.sender_id = u.id
                  WHERE m.group_chat_id = ?
                  ORDER BY m.created_at DESC LIMIT 15
                `).all(group.id).reverse();

                const formattedHistory = history.map((msg: any) => ({
                  role: msg.is_ai === 0 ? 'user' : 'assistant',
                  content: `[${msg.created_at}] [${msg.display_name}]: ${msg.content}`
                }));

                const otherMembers = db.prepare(`
                  SELECT u.* FROM users u
                  JOIN group_chat_members gcm ON u.id = gcm.user_id
                  WHERE gcm.group_chat_id = ? AND u.id != ?
                `).all(group.id, selectedAi.id) as any[];

                const reply = await generateGroupChatReply(selectedAi, group.name, formattedHistory, otherMembers);
                if (reply) {
                  db.prepare("INSERT INTO group_chat_messages (group_chat_id, sender_id, content) VALUES (?, ?, ?)")
                    .run(group.id, selectedAi.id, reply);
                  console.log(`${selectedAi.display_name} replied in group chat ${group.name}`);
                }
              } finally {
                pendingGroupChats.delete(gcKey);
              }
            }
          }
        }
      }
    }
      
      // Handle mentions
      const unrepliedMentions = db.prepare(`
        SELECT p.id as post_id, NULL as comment_id, p.content, u.id as ai_user_id, p.user_id as author_id, u.online_times
        FROM posts p
        JOIN users u ON p.content LIKE '%@' || u.username || '%'
        WHERE u.is_ai = 1 AND u.is_active = 1 AND p.mention_ignored = 0
        AND NOT EXISTS (
          SELECT 1 FROM comments c WHERE c.post_id = p.id AND c.user_id = u.id AND c.parent_id IS NULL
        )
        UNION ALL
        SELECT c.post_id, c.id as comment_id, c.content, u.id as ai_user_id, c.user_id as author_id, u.online_times
        FROM comments c
        JOIN users u ON c.content LIKE '%@' || u.username || '%'
        WHERE u.is_ai = 1 AND u.is_active = 1 AND c.mention_ignored = 0
        AND NOT EXISTS (
          SELECT 1 FROM comments c2 WHERE c2.parent_id = c.id AND c2.user_id = u.id
        )
      `).all() as any[];

      const onlineMentions = [];
      for (const m of unrepliedMentions) {
        if (isUserOnline(m, settings.timezone || 'UTC')) {
          onlineMentions.push(m);
        }
      }

      let handledMention = false;
      if (onlineMentions.length > 0 && Math.random() < 0.8 && activeAiUsers.length > 0) { // 80% chance to prioritize a mention if one exists
        const mention = onlineMentions[Math.floor(Math.random() * onlineMentions.length)];
        const randomAi = activeAiUsers.find(u => u.id === mention.ai_user_id);
        if (randomAi && mention.author_id !== randomAi.id) {
          handledMention = true;
          
          if (mention.comment_id) {
            // Reply to comment
            const commentData = db.prepare(`
              SELECT c.*, u.display_name as author_name, p.content as post_content
              FROM comments c
              JOIN users u ON c.user_id = u.id
              JOIN posts p ON c.post_id = p.id
              WHERE c.id = ?
            `).get(mention.comment_id) as any;
            
            if (commentData) {
              if (getCommentDepth(commentData.id) >= 5) {
                db.prepare("UPDATE comments SET mention_ignored = 1 WHERE id = ?").run(commentData.id);
                handledMention = false;
              } else if (pendingComments.has(`${randomAi.id}:comment:${commentData.id}`)) {
                handledMention = false;
              } else {
                pendingComments.add(`${randomAi.id}:comment:${commentData.id}`);
                try {
                  const threadContext = buildThreadContext(mention.comment_id);
                  
                  const rels = db.prepare(`
                    SELECT u.display_name, r.description 
                    FROM relationships r 
                    JOIN users u ON r.user_id_2 = u.id 
                    WHERE r.user_id_1 = ? AND r.user_id_2 = ?
                  `).all(randomAi.id, commentData.user_id) as any[];
                  const relStr = rels.length > 0 ? rels[0].description : '';

                  const commentContent = await generateComment(randomAi, commentData.content, commentData.author_name, threadContext, true, relStr, commentData.user_id, undefined, commentData.created_at);
                  if (commentContent) {
                    const info = db.prepare("INSERT INTO comments (post_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)").run(commentData.post_id, randomAi.id, commentData.id, commentContent);
                    checkDynamicRelationship(randomAi.id, commentData.user_id).catch(console.error);
                    console.log(`${randomAi.display_name} replied to mention in comment ${commentData.id}`);

                    // Add 1-5 likes to the comment being replied to
                    addLikesToPostOrComment(commentData.post_id, commentData.id, Math.floor(Math.random() * 5) + 1);

                    const commentAuthor = db.prepare("SELECT id, is_ai FROM users WHERE id = ?").get(commentData.user_id) as any;
                    if (commentAuthor && commentAuthor.is_ai === 0) {
                      db.prepare("INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'reply', ?)")
                        .run(commentAuthor.id, randomAi.id, info.lastInsertRowid);
                    }
                  }
                } finally {
                  pendingComments.delete(`${randomAi.id}:comment:${commentData.id}`);
                }
              }
            }
          } else {
            // Reply to post
            const postData = db.prepare(`
              SELECT p.*, u.display_name as author_name, u.bio as author_bio
              FROM posts p 
              JOIN users u ON p.user_id = u.id 
              WHERE p.id = ?
            `).get(mention.post_id) as any;

            if (postData) {
              if (pendingComments.has(`${randomAi.id}:post:${postData.id}`)) {
                handledMention = false;
              } else {
                pendingComments.add(`${randomAi.id}:post:${postData.id}`);
                try {
                  const otherComments = db.prepare("SELECT c.content, u.display_name FROM comments c JOIN users u ON c.user_id = u.id WHERE c.post_id = ? AND c.parent_id IS NULL").all(mention.post_id) as any[];
                  const commentsStr = otherComments.map(c => `${c.display_name}: ${c.content}`).join(" | ");
                  
                  const rels = db.prepare(`
                    SELECT u.display_name, r.description 
                    FROM relationships r 
                    JOIN users u ON r.user_id_2 = u.id 
                    WHERE r.user_id_1 = ? AND r.user_id_2 = ?
                  `).all(randomAi.id, postData.user_id) as any[];
                  const relStr = rels.length > 0 ? rels[0].description : '';

                  const commentContent = await generateComment(randomAi, postData.content, postData.author_name, commentsStr, false, relStr, postData.user_id, postData.image_prompt, postData.created_at);
                  if (commentContent) {
                    const info = db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)").run(postData.id, randomAi.id, commentContent);
                    checkDynamicRelationship(randomAi.id, postData.user_id).catch(console.error);
                    console.log(`${randomAi.display_name} replied to mention in post ${postData.id}`);

                    // Add 1-5 likes to the post being replied to
                    addLikesToPostOrComment(postData.id, null, Math.floor(Math.random() * 5) + 1);

                    const postAuthor = db.prepare("SELECT id, is_ai FROM users WHERE id = ?").get(postData.user_id) as any;
                    if (postAuthor && postAuthor.is_ai === 0) {
                      db.prepare("INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'comment', ?)")
                        .run(postAuthor.id, randomAi.id, info.lastInsertRowid);
                    }
                  }
                } finally {
                  pendingComments.delete(`${randomAi.id}:post:${postData.id}`);
                }
              }
            }
          }
        }
      }

      if (!handledMention && Math.random() < probComment && activeAiUsers.length > 0) {
        // Pick a recent post or comment to reply to
        const recentPosts = db.prepare(`
          SELECT p.*, u.display_name as author_name, u.bio as author_bio,
          (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
          FROM posts p 
          JOIN users u ON p.user_id = u.id 
          ORDER BY p.created_at DESC LIMIT 10
        `).all() as any[];
        
        const recentPostIds = recentPosts.map(p => p.id);
        const placeholders = recentPostIds.map(() => '?').join(',');
        
        let recentComments: any[] = [];
        if (recentPostIds.length > 0) {
          recentComments = db.prepare(`
            SELECT c.*, u.display_name as author_name, p.content as post_content,
            (SELECT COUNT(*) FROM comments WHERE parent_id = c.id) as reply_count
            FROM comments c
            JOIN users u ON c.user_id = u.id
            JOIN posts p ON c.post_id = p.id
            WHERE c.post_id IN (${placeholders})
            ORDER BY c.created_at DESC LIMIT 30
          `).all(...recentPostIds) as any[];
        }

        let weightedItems: any[] = [];
        
        recentPosts.forEach((post, index) => {
          let weight = Math.max(1, 10 - Math.floor(index / 2));
          if (post.post_type === 'question') weight *= 3;
          if (post.post_type === 'discussion') weight *= 5;
          if (post.post_type === 'shitpost') weight *= 2;
          if (post.post_type === 'mention') weight *= 2;
          if (post.post_type === 'dm_invitation') weight *= 2;
          
          // Boost posts from real users by 3-4x
          const isRealUser = db.prepare("SELECT is_ai FROM users WHERE id = ?").get(post.user_id) as any;
          if (isRealUser && isRealUser.is_ai === 0) {
            weight *= (Math.random() < 0.5 ? 3 : 4);
          }

          for (let i = 0; i < weight; i++) {
            weightedItems.push({ type: 'post', data: post });
          }
        });

        recentComments.forEach((comment, index) => {
          // Check thread depth
          let depth = 1;
          let currentComment = comment;
          while (currentComment.parent_id) {
            depth++;
            currentComment = db.prepare("SELECT parent_id FROM comments WHERE id = ?").get(currentComment.parent_id) as any;
            if (!currentComment) break;
          }
          if (depth >= 5) return; // Limit thread to 5 levels

          const weight = Math.max(1, 5 - Math.floor(index / 6));
          for (let i = 0; i < weight; i++) {
            weightedItems.push({ type: 'comment', data: comment });
          }
        });

        let choice: any = null;
        let availableAis: any[] = [];
        let attempts = 0;

        while (weightedItems.length > 0 && attempts < 10) {
          attempts++;
          const choiceIndex = Math.floor(Math.random() * weightedItems.length);
          choice = weightedItems[choiceIndex];
          
          if (choice.type === 'post' && choice.data.post_type === 'dm_invitation') {
            const author = db.prepare("SELECT * FROM users WHERE id = ?").get(choice.data.user_id) as any;
            if (author.is_ai === 1) {
              // Skip DM invitations from AI users
              weightedItems.splice(choiceIndex, 1);
              continue;
            }

            const followedAis = db.prepare("SELECT followed_id FROM follows WHERE follower_id = ?").all(author.id).map((f: any) => f.followed_id);
            const otherAiUsers = activeAiUsers.filter(u => u.id !== choice.data.user_id && followedAis.includes(u.id));
            
            if (otherAiUsers.length > 0) {
              const randomAi = pickWeightedRandomUser(otherAiUsers);
              if (pendingDMs.has(`${randomAi.id}:${author.id}`)) continue;
              pendingDMs.add(`${randomAi.id}:${author.id}`);
              try {
                const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(randomAi.id, author.id) as any;
                const relContext = rel ? rel.description : '';
                const dmContext = `You saw their post: "${choice.data.content}" and decided to DM them about it.`;
                
                // Fetch message history
                const messageHistory = db.prepare(`
                  SELECT sender_id, content, created_at 
                  FROM direct_messages 
                  WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                  ORDER BY created_at ASC
                `).all(randomAi.id, author.id, author.id, randomAi.id).map((m: any) => ({
                  role: m.sender_id === randomAi.id ? 'assistant' : 'user',
                  content: m.content,
                  created_at: m.created_at
                }));

                const dmContent = await generateDM(randomAi, author.display_name, relContext, author.id, dmContext, messageHistory);
                if (dmContent) {
                  db.prepare("INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)")
                    .run(randomAi.id, author.id, dmContent);
                  console.log(`${randomAi.display_name} sent a DM to ${author.display_name} in response to a dm_invitation post`);
                }
              } finally {
                pendingDMs.delete(`${randomAi.id}:${author.id}`);
              }
            }
            break;
          }

          const targetUserId = choice.data.user_id;
          const targetUser = db.prepare("SELECT is_ai FROM users WHERE id = ?").get(targetUserId) as any;
          
          let existingRepliers: number[] = [];
          if (choice.type === 'post') {
            existingRepliers = db.prepare("SELECT user_id FROM comments WHERE post_id = ? AND parent_id IS NULL").all(choice.data.id).map((r: any) => r.user_id);
          } else {
            existingRepliers = db.prepare("SELECT user_id FROM comments WHERE parent_id = ?").all(choice.data.id).map((r: any) => r.user_id);
          }

          if (targetUser && targetUser.is_ai === 0) {
            // Target is a real user, only followed AIs can comment
            const followedAis = db.prepare("SELECT followed_id FROM follows WHERE follower_id = ?").all(targetUserId).map((f: any) => f.followed_id);
            availableAis = activeAiUsers.filter(u => u.id !== targetUserId && !existingRepliers.includes(u.id) && followedAis.includes(u.id));
          } else {
            availableAis = activeAiUsers.filter(u => u.id !== targetUserId && !existingRepliers.includes(u.id));
          }

          if (availableAis.length > 0) {
            break; // Found a valid choice with available AIs
          } else {
            // Remove this choice from weightedItems and try again
            weightedItems = weightedItems.filter(item => item.data.id !== choice.data.id || item.type !== choice.type);
            choice = null;
          }
        }

        if (choice && availableAis.length > 0) {
          // Now pick the best commenter
          const candidateUsers = filterAvailableUsersForComment(choice.data.user_id, availableAis);
          if (candidateUsers.length > 0) {
            const chosenAiId = await pickBestCommenter(choice.data, candidateUsers);
            const randomAi = availableAis.find(u => u.id === chosenAiId) || availableAis[0];

            if (choice.type === 'post') {
              const randomPost = choice.data;
              if (!pendingComments.has(`${randomAi.id}:post:${randomPost.id}`)) {
                pendingComments.add(`${randomAi.id}:post:${randomPost.id}`);
                try {
                  // Get other comments for context
                  const otherComments = db.prepare("SELECT content, created_at FROM comments WHERE post_id = ? LIMIT 5").all(randomPost.id).map((c: any) => `[${c.created_at}] ${c.content}`).join(" | ");
                  
                  // Get relationship context
                  const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(randomAi.id, randomPost.user_id) as any;
                  const relContext = rel ? rel.description : '';

                  const commentContent = await generateComment(randomAi, randomPost.content, randomPost.author_name, otherComments, false, relContext, randomPost.user_id, randomPost.image_prompt, randomPost.created_at);
                  if (commentContent) {
                    const info = db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)")
                      .run(randomPost.id, randomAi.id, commentContent);
                    checkDynamicRelationship(randomAi.id, randomPost.user_id).catch(console.error);
                    console.log(`${randomAi.display_name} commented on post ${randomPost.id}`);

                    // Add 1-5 likes to the post
                    addLikesToPostOrComment(randomPost.id, null, Math.floor(Math.random() * 5) + 1);

                    // Notify real user if they own the post
                    const postAuthor = db.prepare("SELECT id, is_ai FROM users WHERE id = ?").get(randomPost.user_id) as any;
                    if (postAuthor && postAuthor.is_ai === 0) {
                      db.prepare("INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'comment', ?)")
                        .run(postAuthor.id, randomAi.id, info.lastInsertRowid);
                    }
                  }
                } finally {
                  pendingComments.delete(`${randomAi.id}:post:${randomPost.id}`);
                }
              }
            } else {
              const randomComment = choice.data;
              if (getCommentDepth(randomComment.id) < 5) {
                // Check if this AI has already replied to this comment
                const existingReply = db.prepare("SELECT 1 FROM comments WHERE parent_id = ? AND user_id = ?").get(randomComment.id, randomAi.id);
                if (!existingReply && !pendingComments.has(`${randomAi.id}:comment:${randomComment.id}`)) {
                  pendingComments.add(`${randomAi.id}:comment:${randomComment.id}`);
                  try {
                    // Get relationship context
                    const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(randomAi.id, randomComment.user_id) as any;
                    const relContext = rel ? rel.description : '';

                    const threadContext = buildThreadContext(randomComment.id);

                    const replyContent = await generateComment(randomAi, randomComment.content, randomComment.author_name, threadContext, true, relContext, randomComment.user_id, undefined, randomComment.created_at);
                    if (replyContent) {
                      const info = db.prepare("INSERT INTO comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)")
                        .run(randomComment.post_id, randomAi.id, replyContent, randomComment.id);
                      checkDynamicRelationship(randomAi.id, randomComment.user_id).catch(console.error);
                      console.log(`${randomAi.display_name} replied to comment ${randomComment.id}`);

                      // Add 1-5 likes to the comment
                      addLikesToPostOrComment(randomComment.post_id, randomComment.id, Math.floor(Math.random() * 5) + 1);

                      // Notify real user if they own the comment
                      const commentAuthor = db.prepare("SELECT id, is_ai FROM users WHERE id = ?").get(randomComment.user_id) as any;
                      if (commentAuthor && commentAuthor.is_ai === 0) {
                        db.prepare("INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'reply', ?)")
                          .run(commentAuthor.id, randomAi.id, info.lastInsertRowid);
                      }
                    }
                  } finally {
                    pendingComments.delete(`${randomAi.id}:comment:${randomComment.id}`);
                  }
                }
              }
            }
          }
        }
      }
      
      // Clean up old API logs
      db.prepare("DELETE FROM api_logs WHERE created_at < datetime('now', '-1 day')").run();
    } catch (error) {
      console.error("Error in AI worker:", error);
    }
  }, 60000); // Every 60 seconds

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  }).on('error', (err) => {
    console.error("CRITICAL: Server listen error:", err);
  });
  } catch (error) {
    console.error("CRITICAL: Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
