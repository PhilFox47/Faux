import OpenAI from 'openai';
import db from './db';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function getOpenAI() {
  let apiKey = process.env.NANO_GPT_API_KEY || '';
  try {
    const settings = db.prepare("SELECT api_key FROM settings WHERE id = 1").get() as any;
    if (settings && settings.api_key) {
      apiKey = settings.api_key;
    }
  } catch (e) {
    // ignore
  }

  if (!apiKey) {
    throw new Error("API Key is not set. Please configure it in Settings.");
  }

  return new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://nano-gpt.com/api/v1',
    defaultHeaders: {
      'X-Title': 'Faux Social Media',
      'Referer': process.env.APP_URL || 'http://localhost:3000',
    }
  });
}

function stripReasoning(text: string): string {
  if (!text) return "";
  // Remove <think>...</think> tags and their content
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  // Remove common prefixes if they appear at the start
  cleaned = cleaned.replace(/^(Thought|Reasoning|Thinking):\s*/i, '');
  return cleaned.trim();
}

function getModel() {
  try {
    const settings = db.prepare("SELECT model_name FROM settings WHERE id = 1").get() as any;
    return settings?.model_name || 'zai-org/glm-5';
  } catch (e) {
    return 'zai-org/glm-5';
  }
}

function getImageModel() {
  try {
    const settings = db.prepare("SELECT image_model_name FROM settings WHERE id = 1").get() as any;
    return settings?.image_model_name || 'z-image-turbo';
  } catch (e) {
    return 'z-image-turbo';
  }
}

export async function testConnection() {
  try {
    const model = getModel();
    let content = "";
    let reasoning = "";
    let rawContent = "";
    
    for (let i = 0; i < 3; i++) {
      const response = await getOpenAI().chat.completions.create({
        model: model,
        messages: [{ role: 'user', content: 'Reply with exactly "API Connection Successful".' }],
        max_tokens: 10000,
      });
      rawContent = response.choices[0].message.content || "";
      reasoning = (response.choices[0].message as any).reasoning || "";
      content = stripReasoning(rawContent);
      
      if (content || !reasoning) break;
      console.log(`testConnection: AI still reasoning (Attempt ${i + 1}/3)...`);
    }
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "testConnection",
      JSON.stringify({ model, max_tokens: 10000 }),
      JSON.stringify({ content, reasoning, raw: rawContent })
    );

    return { success: true, message: content || (reasoning ? "Thinking..." : "Empty Response") };
  } catch (error: any) {
    console.error('API Test Error:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "testConnection",
      JSON.stringify({ model: getModel(), error: "Catch Block" }),
      "Error: " + (error.message || "Unknown error") + "\nStack: " + (error.stack || "")
    );
    return { success: false, error: error.message };
  }
}

export async function generatePersona(name: string, extraInfo: string, existingUniverses: string[]) {
  const prompt = `You are an expert character writer. Help me create a detailed persona for a character named "${name}".
${extraInfo ? `Additional context: ${extraInfo}` : ''}
If this is a known fictional character or celebrity, use your knowledge to make it accurate.

Please provide a comprehensive profile including:
1. A unique social media username (without @).
2. A short public bio (max 160 chars). Do not be afraid to use emojis if it fits the character.
3. A detailed general description of their personality, background, and motivations.
4. A description of their writing style, tone, and common catchphrases.
5. Physical appearance details.
6. Clothing style and fashion sense.
7. Artstyle for image generation (e.g., Realistic, Anime, Pixel Art, Oil Painting, Comic Book, 3D Render, etc.).
8. A suggested Universe name. This should be the franchise they are from (e.g., "Marvel Cinematic Universe", "Star Wars", "Real Life"). Try to pick from this list of existing universes if it fits: ${existingUniverses.join(', ')}

Format your response as a friendly chat message, but make sure all the information is clearly laid out so I can copy it into the fields.`;

  try {
    let content = "";
    let reasoning = "";
    let rawContent = "";
    let finishReason = "";

    for (let i = 0; i < 3; i++) {
      const response = await getOpenAI().chat.completions.create({
        model: getModel(),
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10000,
        temperature: 0.8,
      });
      rawContent = response.choices[0].message.content || "";
      reasoning = (response.choices[0].message as any).reasoning || "";
      content = stripReasoning(rawContent);
      finishReason = response.choices[0].finish_reason;

      if (content || !reasoning) break;
      console.log(`generatePersona: AI still reasoning (Attempt ${i + 1}/3)...`);
    }
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generatePersona",
      JSON.stringify({ model: getModel(), prompt, max_tokens: 10000, temperature: 0.8, finish_reason: finishReason }),
      JSON.stringify({ content, reasoning, raw: rawContent })
    );
    
    return content || (reasoning ? "The AI is still thinking. Please try again in a moment." : "Failed to generate persona.");
  } catch (error: any) {
    console.error("Error generating persona:", error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generatePersona",
      JSON.stringify({ model: getModel(), prompt, error: "Catch Block" }),
      "Error: " + (error.message || "Unknown error") + "\nStack: " + (error.stack || "")
    );
    return "Error: " + error.message;
  }
}

function buildCharacterPrompt(character: any) {
  let prompt = `You are ${character.display_name}. `;
  if (character.ai_persona) prompt += `${character.ai_persona} `;
  if (character.description) prompt += `\nYour personality and background: ${character.description}`;
  if (character.writing_style) prompt += `\nYour writing style: ${character.writing_style}`;
  if (character.physical_appearance) prompt += `\nYour physical appearance: ${character.physical_appearance}`;
  if (character.clothing_style) prompt += `\nYour clothing style: ${character.clothing_style}`;
  
  if (character.universe_id) {
    try {
      const universe = db.prepare("SELECT name, description FROM universes WHERE id = ?").get(character.universe_id) as any;
      if (universe) {
        prompt += `\nYou are from the universe/franchise: "${universe.name}".`;
        if (universe.description) {
          prompt += `\nGeneral information about your universe: ${universe.description}`;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  prompt += `\nYou are currently using "Faux", a multiversal social media platform where characters from various franchises, universes, and backgrounds interact.`;
  
  try {
    const settings = db.prepare("SELECT timezone, allow_nsfw FROM settings WHERE id = 1").get() as any;
    const tz = settings?.timezone || 'UTC';
    const currentTime = new Date().toLocaleString('en-US', { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    prompt += `\nThe current local time for you is ${currentTime}.`;
    if (settings?.allow_nsfw) {
      prompt += `\nNSFW content is ALLOWED. You may use explicit language, adult themes, and mature content if it fits your character.`;
    } else {
      prompt += `\nKeep your responses SFW (Safe for Work). Avoid explicit language and adult themes.`;
    }
  } catch (e) {
    // ignore
  }
  
  return prompt;
}

export async function pickBestCommenter(post: any, availableUsers: any[]) {
  // 20% chance to just pick a random user to allow new characters a chance
  if (Math.random() < 0.2) {
    return availableUsers[Math.floor(Math.random() * availableUsers.length)].id;
  }

  const relationships = db.prepare(`
    SELECT user_id_1, user_id_2, description 
    FROM relationships 
    WHERE user_id_1 = ? OR user_id_2 = ?
  `).all(post.user_id, post.user_id) as any[];

  // 1. ALL Users who the OP has a relationship with (but that have not commented yet - availableUsers already filters out those who commented)
  const relatedUserIds = new Set(
    relationships.flatMap(r => [r.user_id_1, r.user_id_2]).filter(id => id !== post.user_id)
  );
  
  const relatedUsers = availableUsers.filter(u => relatedUserIds.has(u.id));

  // 2. Up to 20 Users who are following OP
  const followers = db.prepare(`
    SELECT follower_id 
    FROM follows 
    WHERE followed_id = ?
  `).all(post.user_id) as any[];
  
  const followerIds = new Set(followers.map(f => f.follower_id));
  const followerUsers = availableUsers
    .filter(u => followerIds.has(u.id) && !relatedUserIds.has(u.id))
    .sort(() => 0.5 - Math.random())
    .slice(0, 20);

  // 3. 20 Additional, random Users
  const alreadySelectedIds = new Set([...relatedUsers.map(u => u.id), ...followerUsers.map(u => u.id)]);
  const randomUsers = availableUsers
    .filter(u => !alreadySelectedIds.has(u.id))
    .sort(() => 0.5 - Math.random())
    .slice(0, 20);

  const candidateUsers = [...relatedUsers, ...followerUsers, ...randomUsers];

  if (candidateUsers.length === 0) {
    return availableUsers[Math.floor(Math.random() * availableUsers.length)].id;
  }

  const userContexts = candidateUsers.map(u => {
    let relDesc = "No established relationship.";
    const rel = relationships.find(r => (r.user_id_1 === u.id && r.user_id_2 === post.user_id) || (r.user_id_2 === u.id && r.user_id_1 === post.user_id));
    if (rel) relDesc = rel.description;
    return `ID: ${u.id}, Name: ${u.display_name}, Bio: ${u.bio}, Relationship to OP: ${relDesc}`;
  }).join('\n');

  const prompt = `You are a social media manager. Given the following post:
"${post.content}" by ${post.author_name}

Which of the following users is most likely to leave a comment based on their bio and relationship to the author?
${userContexts}

Reply with ONLY the ID of the chosen user.`;

  try {
    let content = "";
    let reasoning = "";
    let rawContent = "";
    let finishReason = "";

    for (let i = 0; i < 3; i++) {
      const response = await getOpenAI().chat.completions.create({
        model: getModel(),
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10000,
        temperature: 0.2,
      });
      rawContent = response.choices[0].message.content || "";
      reasoning = (response.choices[0].message as any).reasoning || "";
      content = stripReasoning(rawContent);
      finishReason = response.choices[0].finish_reason;

      if (content || !reasoning) break;
      console.log(`pickBestCommenter: AI still reasoning (Attempt ${i + 1}/3)...`);
    }
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "pickBestCommenter",
      JSON.stringify({ model: getModel(), prompt, max_tokens: 10000, temperature: 0.2, finish_reason: finishReason }),
      JSON.stringify({ content, reasoning, raw: rawContent })
    );

    const id = parseInt(content || '');
    if (!isNaN(id)) return id;
  } catch (error: any) {
    console.error('Error picking commenter:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "pickBestCommenter",
      JSON.stringify({ model: getModel(), prompt, error: "Catch Block" }),
      "Error: " + (error.message || "Unknown error")
    );
  }
  return candidateUsers[Math.floor(Math.random() * candidateUsers.length)].id;
}

export function pickArchetype(isFirstPost: boolean, forceImage: boolean = false) {
  if (isFirstPost) {
    return { id: 'introduction', name: 'Introduction', description: 'Make them "introduce" themselves on Faux or write about that they just joined Faux. Whatever fits their character.' };
  }

  const archetypes = db.prepare("SELECT * FROM post_archetypes").all() as any[];
  
  if (forceImage) {
    return archetypes.find(a => a.id === 'image_post') || { id: 'image_post', name: 'Image Post', description: 'A post that makes sense to have an image attached to it. The image should have a proper reason to be there.', probability: 15 };
  }
  
  const totalWeight = archetypes.reduce((sum, a) => sum + a.probability, 0);
  let random = Math.random() * totalWeight;
  for (const archetype of archetypes) {
    random -= archetype.probability;
    if (random <= 0) return archetype;
  }
  return archetypes[0] || { id: 'life_update', name: 'Life Update', description: 'A character posting about something they are doing or something they have experienced.', probability: 30 };
}

function getOtherUserUniverseContext(character: any, otherUser: any): string {
  if (!otherUser || !otherUser.universe_id) return '';
  
  try {
    const otherUniverse = db.prepare("SELECT name FROM universes WHERE id = ?").get(otherUser.universe_id) as any;
    if (otherUniverse) {
      if (character.universe_id === otherUser.universe_id) {
        return `You and ${otherUser.display_name} are from the same universe/franchise ("${otherUniverse.name}"). You likely know each other to some extent or share common knowledge of your world.\n`;
      } else {
        return `${otherUser.display_name} is from a different universe/franchise ("${otherUniverse.name}"). You do not know them from your own world, and their background might seem strange or novel to you.\n`;
      }
    }
  } catch (e) {
    // ignore
  }
  return '';
}

export async function generatePost(character: any, context: string = '', relationships: string = '', postTypeObj: any, availableUsernames: string = '', isIntroduction: boolean = false) {
  let prompt = `${buildCharacterPrompt(character)}
${isIntroduction ? `Write your very first "Introduction" post on this social media platform. Introduce yourself, your vibe, and what you're doing here. Make it fit your character perfectly.` : `Write a short, engaging social media post (like a tweet) that fits your character perfectly.
Your post should be independent and reflect your current thoughts, feelings, or activities. 
For this specific post, your post archetype is: "${postTypeObj.name}".
Instructions for this archetype: ${postTypeObj.description}
Avoid referencing other people's posts directly unless it's a very general observation or the archetype requires it.
Do not attempt to search the web for current world events. If the user references real world events, you can have your own opinions about them. Make sure that not every post is about what the user posts.
${relationships ? `Your relationships with others: ${relationships}. You can mention them if it fits your current thought.` : ''}
${context ? `Recent platform activity for inspiration (with timestamps, do not copy, just for vibe and temporal context): ${context}` : ''}
${postTypeObj.id === 'image_post' ? `IMPORTANT: This post will be accompanied by an image. Write a text post that would be a good fit for an image. DO NOT include any image descriptions or prompts in the text post itself (e.g., no text in square brackets like [Image of...]). The text should be natural social media content.` : ''}
${postTypeObj.id === 'mention' ? `IMPORTANT: You MUST mention another user in this post using the @username format. Here are some available usernames you can mention: ${availableUsernames}. Pick one that makes sense or pick randomly.` : ''}
${postTypeObj.id === 'event' ? `IMPORTANT: This is an EVENT post. An event has happened that affects you and some other characters. Describe the event and your reaction to it. Mention the other characters involved using @username. Available usernames: ${availableUsernames}.` : ''}
${postTypeObj.id === 'meetup' ? `IMPORTANT: This is a MEETUP post. You are meeting up with some other characters. Describe the meetup and what you're doing. Mention the other characters involved using @username. Available usernames: ${availableUsernames}.` : ''}`}
Do not use hashtags unless it fits the character. Do not wrap in quotes. Keep it under 280 characters.`;

  try {
    let content = "";
    let reasoning = "";
    let rawContent = "";
    let finishReason = "";

    for (let i = 0; i < 3; i++) {
      const response = await getOpenAI().chat.completions.create({
        model: getModel(),
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10000,
        temperature: 0.9,
      });
      rawContent = response.choices[0].message.content || "";
      reasoning = (response.choices[0].message as any).reasoning || "";
      content = stripReasoning(rawContent);
      finishReason = response.choices[0].finish_reason;

      if (content || !reasoning) break;
      console.log(`generatePost: AI still reasoning (Attempt ${i + 1}/3)...`);
    }
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generatePost",
      JSON.stringify({ model: getModel(), prompt, max_tokens: 10000, temperature: 0.9, archetype: postTypeObj.id, finish_reason: finishReason }),
      JSON.stringify({ content, reasoning, raw: rawContent })
    );
    
    return content;
  } catch (error: any) {
    console.error('Error generating post:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generatePost",
      JSON.stringify({ model: getModel(), prompt, archetype: postTypeObj.id, error: "Catch Block" }),
      "Error: " + (error.message || "Unknown error") + "\nStack: " + (error.stack || "")
    );
    return null;
  }
}

export async function generateComment(character: any, postContent: string, postAuthorName: string, otherComments: string = '', isReply: boolean = false, relationshipContext: string = '', otherUserId?: number, imagePrompt?: string, postTimestamp?: string) {
  let otherUserInfo = '';
  if (otherUserId) {
    const otherUser = db.prepare("SELECT * FROM users WHERE id = ?").get(otherUserId) as any;
    if (otherUser) {
      otherUserInfo = `Their Bio (for your understanding only, do not explicitly mention it unless relevant): ${otherUser.bio || 'No bio provided.'}\n`;
      otherUserInfo += getOtherUserUniverseContext(character, otherUser);
      if (relationshipContext && (relationshipContext.toLowerCase().includes('close') || relationshipContext.toLowerCase().includes('friend') || relationshipContext.toLowerCase().includes('partner'))) {
        otherUserInfo += `Their Backstory (you know this because you are close): ${otherUser.backstory || 'No backstory provided.'}\n`;
      }
    }
  }

  const prompt = `${buildCharacterPrompt(character)}
${isReply ? `You are participating in a comment thread. Here is the context of the thread (with timestamps):\n${otherComments}\n\nYou are replying to the last comment in the thread by ${postAuthorName} (sent at ${postTimestamp || 'unknown time'}): "${postContent}"` : `You are looking at a social media post by ${postAuthorName} (posted at ${postTimestamp || 'unknown time'}): "${postContent}"\n${imagePrompt ? `The post has an image attached. Description of the image: ${imagePrompt}\n` : ''}${otherComments ? `Other users have already commented (with timestamps): ${otherComments}` : ''}`}
${otherUserInfo}
${relationshipContext ? `Relationship with ${postAuthorName}: ${relationshipContext}` : `You don't know ${postAuthorName} well, treat them as an acquaintance or celebrity.`}
${isReply ? `Write a reply that fits your character perfectly and continues the conversation naturally. Notice the timestamps to understand the flow of time.` : `Write a comment that fits your character perfectly. Notice the timestamp of the post to understand how recent it is.`}
Keep it short, natural, and in character. Focus on the topic being discussed. Do not wrap in quotes. Keep it under 150 characters.`;

  try {
    let content = "";
    let reasoning = "";
    let rawContent = "";
    let finishReason = "";

    for (let i = 0; i < 3; i++) {
      const response = await getOpenAI().chat.completions.create({
        model: getModel(),
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10000,
        temperature: 0.8,
      });
      rawContent = response.choices[0].message.content || "";
      reasoning = (response.choices[0].message as any).reasoning || "";
      content = stripReasoning(rawContent);
      finishReason = response.choices[0].finish_reason;

      if (content || !reasoning) break;
      console.log(`generateComment: AI still reasoning (Attempt ${i + 1}/3)...`);
    }
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateComment",
      JSON.stringify({ model: getModel(), prompt, max_tokens: 10000, temperature: 0.8, isReply, finish_reason: finishReason }),
      JSON.stringify({ content, reasoning, raw: rawContent })
    );
    
    return content;
  } catch (error: any) {
    console.error('Error generating comment:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateComment",
      JSON.stringify({ model: getModel(), prompt, isReply, error: "Catch Block" }),
      "Error: " + (error.message || "Unknown error") + "\nStack: " + (error.stack || "")
    );
    return null;
  }
}

export async function generateDM(character: any, userDisplayName: string, relationshipContext: string = '', otherUserId?: number, context: string = '', messageHistory: {role: string, content: string, created_at: string}[] = []) {
  let otherUserInfo = '';
  let recentActivity = '';
  if (otherUserId) {
    const otherUser = db.prepare("SELECT * FROM users WHERE id = ?").get(otherUserId) as any;
    if (otherUser) {
      otherUserInfo = `Their Bio (for your understanding only, do not explicitly mention it unless relevant): ${otherUser.bio || 'No bio provided.'}\n`;
      otherUserInfo += getOtherUserUniverseContext(character, otherUser);
      if (relationshipContext && (relationshipContext.toLowerCase().includes('close') || relationshipContext.toLowerCase().includes('friend') || relationshipContext.toLowerCase().includes('partner'))) {
        otherUserInfo += `Their Backstory (you know this because you are close): ${otherUser.backstory || 'No backstory provided.'}\n`;
      }
      
      const recentPosts = db.prepare("SELECT content FROM posts WHERE user_id = ? AND created_at >= datetime('now', '-36 hours') ORDER BY created_at DESC LIMIT 5").all(otherUserId) as any[];
      const recentComments = db.prepare("SELECT content FROM comments WHERE user_id = ? AND created_at >= datetime('now', '-36 hours') ORDER BY created_at DESC LIMIT 5").all(otherUserId) as any[];
      
      const hasPosts = recentPosts.length > 0;
      const hasComments = recentComments.length > 0;

      let options = [3]; // Option 3: No recent activity
      if (hasPosts) options.push(1); // Option 1: Recent post
      if (hasComments) options.push(2); // Option 2: Recent comment

      const chosenOption = options[Math.floor(Math.random() * options.length)];

      if (chosenOption === 1) {
        const randomPost = recentPosts[Math.floor(Math.random() * recentPosts.length)];
        recentActivity += `One of their recent posts:\n- "${randomPost.content}"\n`;
      } else if (chosenOption === 2) {
        const randomComment = recentComments[Math.floor(Math.random() * recentComments.length)];
        recentActivity += `One of their recent comments:\n- "${randomComment.content}"\n`;
      }
    }
  }

  const historyStr = messageHistory.length > 0 
    ? `\nPrevious conversation history (with timestamps):\n${messageHistory.map(m => `[${m.created_at}] ${m.role === 'assistant' ? character.display_name : userDisplayName}: ${m.content}`).join('\n')}\n`
    : '';

  const prompt = `${buildCharacterPrompt(character)}
You are sending a private direct message to ${userDisplayName}.
${otherUserInfo}
${recentActivity}
${relationshipContext ? `Relationship with ${userDisplayName}: ${relationshipContext}` : `You don't know ${userDisplayName} well, treat them as an acquaintance or celebrity.`}
${context ? `Context for this message: ${context}` : ''}
${historyStr}
Write a short, in-character message. 
If there is previous history, you can pick up where you left off or start a new topic. 
Notice the timestamps in the history to understand how much time has passed since the last message.
Give a good reason for reaching out (e.g., asking a question about a recent post or comment, sharing a secret, reacting to something, or just checking in). 
IMPORTANT: Do not "Imagine" or make up posts/comments that the user has never actually posted. Only reference the recent posts/comments provided above, or find another reason to reach out.
IMPORTANT: Always complete your sentences. Do not cut off mid-sentence. Do not wrap in quotes.`;

  try {
    let content = "";
    let reasoning = "";
    let rawContent = "";
    let finishReason = "";

    for (let i = 0; i < 3; i++) {
      const response = await getOpenAI().chat.completions.create({
        model: getModel(),
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10000,
        temperature: 0.8,
      });
      rawContent = response.choices[0].message.content || "";
      reasoning = (response.choices[0].message as any).reasoning || "";
      content = stripReasoning(rawContent);
      finishReason = response.choices[0].finish_reason;

      if (content || !reasoning) break;
      console.log(`generateDM: AI still reasoning (Attempt ${i + 1}/3)...`);
    }
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateDM",
      JSON.stringify({ model: getModel(), prompt, max_tokens: 10000, temperature: 0.8, finish_reason: finishReason }),
      JSON.stringify({ content, reasoning, raw: rawContent })
    );
    
    return content;
  } catch (error: any) {
    console.error('Error generating DM:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateDM",
      JSON.stringify({ model: getModel(), prompt, error: "Catch Block" }),
      "Error: " + (error.message || "Unknown error") + "\nStack: " + (error.stack || "")
    );
    return null;
  }
}

export async function replyToDM(character: any, userDisplayName: string, messageHistory: {role: string, content: string, created_at: string}[], relationshipContext: string = '', otherUserId?: number, isDelayed: boolean = false) {
  let otherUserInfo = '';
  if (otherUserId) {
    const otherUser = db.prepare("SELECT * FROM users WHERE id = ?").get(otherUserId) as any;
    if (otherUser) {
      otherUserInfo = `Their Bio (for your understanding only, do not explicitly mention it unless relevant): ${otherUser.bio || 'No bio provided.'}\n`;
      otherUserInfo += getOtherUserUniverseContext(character, otherUser);
      if (relationshipContext && (relationshipContext.toLowerCase().includes('close') || relationshipContext.toLowerCase().includes('friend') || relationshipContext.toLowerCase().includes('partner'))) {
        otherUserInfo += `Their Backstory (you know this because you are close): ${otherUser.backstory || 'No backstory provided.'}\n`;
      }
    }
  }

  const historyStr = messageHistory.map(m => `[${m.created_at}] ${m.role === 'assistant' ? character.display_name : userDisplayName}: ${m.content}`).join('\n');

  const systemPrompt = `${buildCharacterPrompt(character)}
You are having a private direct message conversation with ${userDisplayName}.
${otherUserInfo}
${relationshipContext ? `Relationship with ${userDisplayName}: ${relationshipContext}` : `You don't know ${userDisplayName} well, treat them as an acquaintance or celebrity.`}
${isDelayed ? `IMPORTANT: You were offline/busy for a while and are just now getting back to this message. You can briefly mention why you took so long if it fits your character (e.g. you were sleeping, busy with something, or just didn't see it).` : ''}

Conversation history (with timestamps):
${historyStr}

Reply in character to their latest message. 
Notice the timestamps to understand the flow of time between messages.
Make sure to actually write like it's a Direct Message Chat, don't default to Roleplaying with actions in asteriks. Keep it concise and natural, but stay in character. Focus on the conversation topic.
IMPORTANT: Always complete your sentences. Do not cut off mid-sentence.`;

  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    ...messageHistory
  ];

  try {
    let content = "";
    let reasoning = "";
    let rawContent = "";
    let finishReason = "";

    for (let i = 0; i < 3; i++) {
      const response = await getOpenAI().chat.completions.create({
        model: getModel(),
        messages: messages,
        max_tokens: 10000,
        temperature: 0.8,
      });
      rawContent = response.choices[0].message.content || "";
      reasoning = (response.choices[0].message as any).reasoning || "";
      content = stripReasoning(rawContent);
      finishReason = response.choices[0].finish_reason;

      if (content || !reasoning) break;
      console.log(`replyToDM: AI still reasoning (Attempt ${i + 1}/3)...`);
    }
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "replyToDM",
      JSON.stringify({ model: getModel(), messages, max_tokens: 10000, temperature: 0.8, finish_reason: finishReason }),
      JSON.stringify({ content, reasoning, raw: rawContent })
    );
    
    return content;
  } catch (error: any) {
    console.error('Error replying to DM:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "replyToDM",
      JSON.stringify({ model: getModel(), messages, error: "Catch Block" }),
      "Error: " + (error.message || "Unknown error") + "\nStack: " + (error.stack || "")
    );
    return null;
  }
}

export async function generateGroupChatReply(character: any, groupName: string, messageHistory: {role: string, content: string, created_at: string}[], otherMembers: any[]) {
  const otherMembersStr = otherMembers.map(m => m.display_name).join(', ');
  const otherMembersBios = otherMembers.map(m => {
    let bioStr = `${m.display_name} Bio: ${m.bio || 'No bio provided.'}`;
    const universeContext = getOtherUserUniverseContext(character, m);
    if (universeContext) {
      bioStr += `\n${universeContext}`;
    }
    return bioStr;
  }).join('\n\n');
  
  const historyStr = messageHistory.map(m => m.content).join('\n');

  const systemPrompt = `${buildCharacterPrompt(character)}
You are in a group chat named "${groupName}" with ${otherMembersStr}.
Here is some information about the other members:
${otherMembersBios}

Conversation history (with timestamps):
${historyStr}

Reply in character to the latest messages. Make sure to actually write like it's a Group Chat, don't default to Roleplaying with actions in asteriks. Keep it concise and natural, but stay in character. You can address specific people by name if you want.
Notice the timestamps to understand the flow of time between messages.`;

  const messages = [
    { role: "system", content: systemPrompt },
    // We don't need to pass the history as separate messages because it's all in the system prompt,
    // but we can pass the last few as user messages to ensure the model focuses on them.
    { role: "user", content: "Please reply to the group chat." }
  ];

  try {
    let content = "";
    let reasoning = "";
    let rawContent = "";

    for (let i = 0; i < 3; i++) {
      const response = await getOpenAI().chat.completions.create({
        model: getModel(),
        messages: messages as any,
        max_tokens: 10000,
        temperature: 0.8,
      });
      rawContent = response.choices[0].message.content || "";
      reasoning = (response.choices[0].message as any).reasoning || "";
      content = stripReasoning(rawContent);

      if (content || !reasoning) break;
      console.log(`generateGroupChatReply: AI still reasoning (Attempt ${i + 1}/3)...`);
    }
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateGroupChatReply",
      JSON.stringify({ model: getModel(), messages, max_tokens: 10000 }),
      JSON.stringify({ content, reasoning, raw: rawContent })
    );
    
    return content;
  } catch (error: any) {
    console.error('Error replying to Group Chat:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateGroupChatReply",
      JSON.stringify({ model: getModel(), messages }),
      "Error: " + error.message
    );
    return null;
  }
}

export async function generateImagePrompt(character: any, postContent: string) {
  const prompt = `You are an expert at writing highly detailed prompts for the Chroma AI image generator.
You need to write a comprehensive image generation prompt for a social media post by ${character.display_name}.
The text of their post is: "${postContent}"

Chroma is sensitive to prompting and understands plain English. A structured, descriptive prompt is essential.

Character details:
Name: ${character.display_name}
Appearance: ${character.physical_appearance || character.bio || 'average looking'}
Clothing style: ${character.clothing_style || 'casual everyday clothes'}
Artstyle: ${character.artstyle || 'Realistic'}

Guidelines:
- If the Artstyle is Realistic: Define the medium and context (e.g., "Source: Instagram photo", "Lighting: Natural morning light", "Style: Candid amateur photograph"). Mention camera type (e.g., "Shot on 35mm lens", "iPhone 15 Pro photo").
- If the Artstyle is Stylized (Anime, Pixel Art, Oil Painting, etc.): Clearly describe the Art Direction (Genre, Medium, Texture, specific artist influences if applicable).
- The image does not need to depict the text post 1:1. An image can give context to the text post and vice versa.
- Images don't always need to show the character who posted it. You can show a relevant object, scenery, situation, etc. Add variance.
- Accurately describe the physical features and clothing of the character ONLY if the character is visible in the shot.
- Be very descriptive about the environment, lighting, mood, and composition.
- Use descriptive adjectives and specific details to ensure a high-quality, accurate depiction.
- ONLY output the final prompt text, nothing else.`;

  try {
    let content = "";
    let reasoning = "";
    let rawContent = "";
    let finishReason = "";

    for (let i = 0; i < 3; i++) {
      const response = await getOpenAI().chat.completions.create({
        model: getModel(),
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10000,
        temperature: 0.7,
      });
      rawContent = response.choices[0].message.content || "";
      reasoning = (response.choices[0].message as any).reasoning || "";
      content = stripReasoning(rawContent);
      finishReason = response.choices[0].finish_reason;

      if (content || !reasoning) break;
      console.log(`generateImagePrompt: AI still reasoning (Attempt ${i + 1}/3)...`);
    }
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateImagePrompt",
      JSON.stringify({ model: getModel(), prompt, max_tokens: 10000, temperature: 0.7, finish_reason: finishReason }),
      JSON.stringify({ content, reasoning, raw: rawContent })
    );

    return content || "";
  } catch (error: any) {
    console.error('Error generating image prompt:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateImagePrompt",
      JSON.stringify({ model: getModel(), prompt, error: "Catch Block" }),
      "Error: " + (error.message || "Unknown error") + "\nStack: " + (error.stack || "")
    );
    return "";
  }
}

export async function generateImage(prompt: string) {
  try {
    const model = getImageModel();
    const sizes = ['1024x1024', '1024x1536', '1024x1536'];
    const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
    
    const response = await getOpenAI().images.generate({
      model: model,
      prompt: prompt,
      n: 1,
      size: randomSize as any,
      response_format: 'b64_json',
      // @ts-ignore - passing extra params for Chroma/Flux
      steps: 28,
      guidance_scale: 3.5,
      guidance: 3.5
    });
    
    const imageData = response.data[0];
    let url = '';
    
    if (imageData.b64_json) {
      const buffer = Buffer.from(imageData.b64_json, 'base64');
      const filename = `${crypto.randomUUID()}.png`;
      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadDir, filename), buffer);
      url = `/uploads/${filename}`;
    } else if (imageData.url) {
      const res = await fetch(imageData.url);
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const filename = `${crypto.randomUUID()}.png`;
      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadDir, filename), buffer);
      url = `/uploads/${filename}`;
    }
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateImage",
      JSON.stringify({ model: model, prompt, steps: 28, guidance: 3.5 }),
      url || "Empty Response (No Image Data)"
    );
    
    return url;
  } catch (error: any) {
    console.error('Error generating image:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateImage",
      JSON.stringify({ model: getImageModel(), prompt, error: "Catch Block" }),
      "Error: " + (error.message || "Unknown error") + "\nStack: " + (error.stack || "")
    );
    return null;
  }
}
