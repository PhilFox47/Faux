import Database from 'better-sqlite3';
const db = new Database('faux.db');
const query = `
  EXPLAIN QUERY PLAN
  SELECT c.*, u.username, u.display_name, u.avatar_url, u.account_type,
  COUNT(cl.id) as like_count,
  MAX(CASE WHEN cl.user_id = 1 THEN 1 ELSE 0 END) as is_liked
  FROM comments c
  JOIN users u ON c.user_id = u.id
  LEFT JOIN comment_likes cl ON cl.comment_id = c.id
  WHERE c.post_id = 1
  GROUP BY c.id
  ORDER BY c.created_at ASC
`;
console.log(db.prepare(query).all());
