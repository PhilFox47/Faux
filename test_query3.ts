import Database from 'better-sqlite3';
const db = new Database('faux.db');
const query = `
  EXPLAIN QUERY PLAN
  SELECT c.*, u.username, u.display_name, u.avatar_url, u.account_type,
  (SELECT COUNT(id) FROM comment_likes WHERE comment_id = c.id) as like_count,
  (SELECT 1 FROM comment_likes WHERE comment_id = c.id AND user_id = 1 LIMIT 1) as is_liked
  FROM comments c
  JOIN users u ON c.user_id = u.id
  WHERE c.post_id = 1
  ORDER BY c.created_at ASC
`;
console.log(db.prepare(query).all());
