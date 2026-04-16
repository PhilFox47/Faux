import Database from 'better-sqlite3';
const db = new Database('faux.db');
const start = Date.now();
const query = `
  SELECT p.*, u.username, u.display_name, u.avatar_url, u.account_type,
  (SELECT COUNT(id) FROM comments WHERE post_id = p.id) as comment_count,
  (SELECT COUNT(id) FROM likes WHERE post_id = p.id) as like_count,
  (SELECT 1 FROM likes WHERE post_id = p.id AND user_id = 1 LIMIT 1) as is_liked
  FROM posts p
  JOIN users u ON p.user_id = u.id
  WHERE p.is_visible = 1
  AND p.user_id IN (SELECT followed_id FROM follows WHERE follower_id = 1 UNION SELECT 1)
  AND p.post_type = 'image_post'
  ORDER BY p.created_at DESC LIMIT 50
`;
db.prepare(query).all();
console.log('Time:', Date.now() - start, 'ms');
