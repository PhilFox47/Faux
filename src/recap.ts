import db from './db';
import { getOpenAI, getModel } from './ai';

export async function generateMonthlyRecap(monthYear: string) {
  // monthYear is in 'YYYY-MM' format
  
  // 1. Gather Statistics
  const totalPosts = (db.prepare("SELECT COUNT(*) as count FROM posts WHERE strftime('%Y-%m', created_at) = ?").get(monthYear) as any).count;
  const totalComments = (db.prepare("SELECT COUNT(*) as count FROM comments WHERE strftime('%Y-%m', created_at) = ?").get(monthYear) as any).count;
  const totalJoinedCharacters = (db.prepare("SELECT COUNT(*) as count FROM users WHERE is_ai = 1 AND strftime('%Y-%m', created_at) = ?").get(monthYear) as any).count;
  const totalRelationships = (db.prepare("SELECT COUNT(*) as count FROM relationships WHERE strftime('%Y-%m', created_at) = ?").get(monthYear) as any).count;

  // If no activity, skip
  if (totalPosts === 0 && totalComments === 0 && totalJoinedCharacters === 0 && totalRelationships === 0) {
    return null;
  }

  // Daily Stats
  const dailyPosts = db.prepare("SELECT strftime('%Y-%m-%d', created_at) as date, COUNT(*) as count FROM posts WHERE strftime('%Y-%m', created_at) = ? GROUP BY date").all(monthYear) as any[];
  const dailyComments = db.prepare("SELECT strftime('%Y-%m-%d', created_at) as date, COUNT(*) as count FROM comments WHERE strftime('%Y-%m', created_at) = ? GROUP BY date").all(monthYear) as any[];
  const dailyJoined = db.prepare("SELECT strftime('%Y-%m-%d', created_at) as date, COUNT(*) as count FROM users WHERE is_ai = 1 AND strftime('%Y-%m', created_at) = ? GROUP BY date").all(monthYear) as any[];
  const dailyRelationships = db.prepare("SELECT strftime('%Y-%m-%d', created_at) as date, COUNT(*) as count FROM relationships WHERE strftime('%Y-%m', created_at) = ? GROUP BY date").all(monthYear) as any[];

  // 2. Leaderboards
  const topPosters = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_url, COUNT(p.id) as count 
    FROM posts p JOIN users u ON p.user_id = u.id 
    WHERE strftime('%Y-%m', p.created_at) = ? 
    GROUP BY u.id ORDER BY count DESC LIMIT 5
  `).all(monthYear) as any[];

  const topCommenters = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_url, COUNT(c.id) as count 
    FROM comments c JOIN users u ON c.user_id = u.id 
    WHERE strftime('%Y-%m', c.created_at) = ? 
    GROUP BY u.id ORDER BY count DESC LIMIT 5
  `).all(monthYear) as any[];

  const topCommentReceivers = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_url, COUNT(c.id) as count 
    FROM comments c 
    JOIN posts p ON c.post_id = p.id 
    JOIN users u ON p.user_id = u.id 
    WHERE strftime('%Y-%m', c.created_at) = ? 
    GROUP BY u.id ORDER BY count DESC LIMIT 5
  `).all(monthYear) as any[];

  const topFollowersEarned = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_url, COUNT(f.follower_id) as count 
    FROM follows f JOIN users u ON f.followed_id = u.id 
    WHERE strftime('%Y-%m', f.created_at) = ? 
    GROUP BY u.id ORDER BY count DESC LIMIT 5
  `).all(monthYear) as any[];

  const topRelationshipsFormed = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_url, COUNT(r.id) as count 
    FROM relationships r 
    JOIN users u ON r.user_id_1 = u.id 
    WHERE strftime('%Y-%m', r.created_at) = ? 
    GROUP BY u.id ORDER BY count DESC LIMIT 5
  `).all(monthYear) as any[];

  const topRealUserInteractions = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_url, COUNT(c.id) as count 
    FROM comments c 
    JOIN posts p ON c.post_id = p.id 
    JOIN users u ON p.user_id = u.id 
    JOIN users commenter ON c.user_id = commenter.id
    WHERE commenter.is_ai = 0 AND strftime('%Y-%m', c.created_at) = ? 
    GROUP BY u.id ORDER BY count DESC LIMIT 5
  `).all(monthYear) as any[];

  // 3. Arcs
  const characterArcs = db.prepare("SELECT title, completion_summary FROM character_arcs WHERE status = 'completed' AND strftime('%Y-%m', target_end_date) = ? LIMIT 5").all(monthYear) as any[];
  const universeArcs = db.prepare("SELECT title, completion_summary FROM universe_arcs WHERE status = 'completed' AND strftime('%Y-%m', last_update_date) = ? LIMIT 5").all(monthYear) as any[];
  
  const arcs = [...characterArcs, ...universeArcs].slice(0, 10);

  // 4. Images
  const images = db.prepare("SELECT image_url FROM posts WHERE image_url IS NOT NULL AND strftime('%Y-%m', created_at) = ? LIMIT 50").all(monthYear).map((r: any) => r.image_url) as string[];

  // 5. Introduced Universes and Characters
  const introducedUniverses = db.prepare("SELECT id, name, description, image_url FROM universes WHERE strftime('%Y-%m', created_at) = ?").all(monthYear) as any[];
  const introducedCharacters = db.prepare("SELECT id, username, display_name, avatar_url, bio FROM users WHERE is_ai = 1 AND strftime('%Y-%m', created_at) = ?").all(monthYear) as any[];

  // 6. Generate Title
  const prompt = `You are generating a witty, slightly funny title for a monthly recap of a social media platform called Faux.
The month is ${monthYear}.
Some stats: ${totalPosts} posts, ${totalComments} comments, ${totalRelationships} new relationships.
Give me a short, catchy title (max 6 words). Do not wrap in quotes.`;

  let title = `FauxPast ${monthYear}`;
  try {
    const response = await getOpenAI().chat.completions.create({
      model: getModel(),
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
      temperature: 0.8,
    });
    if (response.choices[0].message.content) {
      title = response.choices[0].message.content.trim().replace(/^"|"$/g, '');
    }
  } catch (e) {
    console.error("Failed to generate recap title", e);
  }

  const recapData = {
    stats: {
      totalPosts,
      totalComments,
      totalJoinedCharacters,
      totalRelationships
    },
    daily: {
      posts: dailyPosts,
      comments: dailyComments,
      joined: dailyJoined,
      relationships: dailyRelationships
    },
    leaderboards: {
      topPosters,
      topCommenters,
      topCommentReceivers,
      topFollowersEarned,
      topRelationshipsFormed,
      topRealUserInteractions
    },
    introduced: {
      universes: introducedUniverses,
      characters: introducedCharacters
    },
    arcs,
    images
  };

  db.prepare("INSERT INTO monthly_recaps (month_year, title, data) VALUES (?, ?, ?)").run(monthYear, title, JSON.stringify(recapData));
  return { monthYear, title, data: recapData };
}

export async function checkAndGenerateMissingRecaps() {
  // Get the current month
  const now = new Date();
  const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Find the earliest post to know how far back to go
  const earliestPost = db.prepare("SELECT MIN(created_at) as min_date FROM posts").get() as any;
  if (!earliestPost || !earliestPost.min_date) return;

  const startDate = new Date(earliestPost.min_date);
  
  let checkDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const currentDate = new Date(now.getFullYear(), now.getMonth(), 1);

  while (checkDate < currentDate) {
    const monthYear = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Check if recap exists
    const existing = db.prepare("SELECT id FROM monthly_recaps WHERE month_year = ?").get(monthYear);
    if (!existing) {
      console.log(`Generating missing recap for ${monthYear}...`);
      await generateMonthlyRecap(monthYear);
    }

    // Move to next month
    checkDate.setMonth(checkDate.getMonth() + 1);
  }
}
