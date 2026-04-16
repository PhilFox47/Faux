import Database from 'better-sqlite3';
const db = new Database('faux.db');
const query = `
  EXPLAIN QUERY PLAN
  SELECT p.*, u.username, u.display_name, u.avatar_url, u.account_type,
  (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
  (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
  l.id IS NOT NULL as is_liked
  FROM posts p INDEXED BY idx_posts_user_visible_created
  JOIN users u ON p.user_id = u.id
  LEFT JOIN likes l ON l.post_id = p.id AND l.user_id = 1
  WHERE p.is_visible = 1
  AND p.user_id IN (SELECT followed_id FROM follows WHERE follower_id = 1 UNION SELECT 1)
  AND p.post_type = 'image_post'
  ORDER BY p.created_at DESC LIMIT 50
`;
console.log(db.prepare(query).all());
