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
  });
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
    const response = await getOpenAI().chat.completions.create({
      model: getModel(),
      messages: [{ role: 'user', content: 'Reply with exactly "API Connection Successful".' }],
      max_tokens: 10,
    });
    return { success: true, message: response.choices[0].message.content?.trim() };
  } catch (error: any) {
    console.error('API Test Error:', error);
    return { success: false, error: error.message };
  }
}

export async function generatePersona(name: string, extraInfo: string, existingTags: string[]) {
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
8. A list of 10-20 relevant tags. These tags are used to find "similar" characters. They should include character traits like what Franchise they are from, personality traits, interests, and things they can bond over with other characters.

Format your response as a friendly chat message, but make sure all the information is clearly laid out so I can copy it into the fields.`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: getModel(),
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.8,
    });
    const content = response.choices[0].message.content?.trim() || "Failed to generate persona.";
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generatePersona",
      JSON.stringify({ model: getModel(), prompt }),
      content
    );
    
    return content;
  } catch (error: any) {
    console.error("Error generating persona:", error);
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

  const userContexts = availableUsers.map(u => {
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
    const response = await getOpenAI().chat.completions.create({
      model: getModel(),
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 10,
      temperature: 0.2,
    });
    const content = response.choices[0].message.content?.trim();
    const id = parseInt(content || '');
    if (!isNaN(id)) return id;
  } catch (e) {
    console.error('Error picking commenter:', e);
  }
  return availableUsers[Math.floor(Math.random() * availableUsers.length)].id;
}

export const POST_ARCHETYPES = [
  { id: 'life_update', name: 'Life Update', description: 'A character posting about something they are doing or something they have experienced.', probability: 30 },
  { id: 'image_post', name: 'Image Post', description: 'A post that makes sense to have an image attached to it. The image should have a proper reason to be there.', probability: 15 },
  { id: 'question', name: 'Question', description: 'A Character asking a question.', probability: 10 },
  { id: 'random_thought', name: 'Random Thought', description: 'A random thought a character had they want to share on Faux.', probability: 10 },
  { id: 'discussion', name: 'Discussion', description: 'Similar to a Question, but with more arguing in the comments.', probability: 5 },
  { id: 'recommendation', name: 'Recommendation', description: 'A Character recommending a Book, TV Show, Movie and so on.', probability: 5 },
  { id: 'follow_up', name: 'Follow up', description: 'A character following up on a previous post. Sharing an update on their previous live update, thanking users for answering a previous question and so on. Always make sure it references a previous post of that character in some way.', probability: 5 },
  { id: 'picking_up_trend', name: 'Picking up a Trend', description: 'Check what other characters have been posing about recently. If you notice a pattern, comment on it or even continue the "Trend".', probability: 5 },
  { id: 'mention', name: 'Mention', description: 'A Character mentioning another character (with their @username) about something which leads to that mentioned character to react in a comment.', probability: 5 },
  { id: 'joke', name: 'Joke', description: 'A character making a joke, that fits their personality.', probability: 5 },
  { id: 'shitpost', name: 'Shitpost / Rage Bait', description: 'A shitpost or rage bait.', probability: 5 },
  { id: 'venting', name: 'Venting', description: 'A character venting about something that made them angry.', probability: 5 },
  { id: 'dm_invitation', name: 'DM Invitation', description: 'A Character mentions something and invites other users to contact them via DM.', probability: 2 }
];

export function pickArchetype(isFirstPost: boolean, forceImage: boolean = false) {
  if (isFirstPost) {
    return { id: 'introduction', name: 'Introduction', description: 'Make them "introduce" themselves on Faux or write about that they just joined Faux. Whatever fits their character.' };
  }
  if (forceImage) {
    return POST_ARCHETYPES.find(a => a.id === 'image_post')!;
  }
  
  const totalWeight = POST_ARCHETYPES.reduce((sum, a) => sum + a.probability, 0);
  let random = Math.random() * totalWeight;
  for (const archetype of POST_ARCHETYPES) {
    random -= archetype.probability;
    if (random <= 0) return archetype;
  }
  return POST_ARCHETYPES[0];
}

export async function generatePost(character: any, context: string = '', relationships: string = '', postTypeObj: any, availableUsernames: string = '') {
  let prompt = `${buildCharacterPrompt(character)}
Write a short, engaging social media post (like a tweet) that fits your character perfectly.
Your post should be independent and reflect your current thoughts, feelings, or activities. 
For this specific post, your post archetype is: "${postTypeObj.name}".
Instructions for this archetype: ${postTypeObj.description}
Avoid referencing other people's posts directly unless it's a very general observation or the archetype requires it.
Do not attempt to search the web for current world events. If the user references real world events, you can have your own opinions about them. Make sure that not every post is about what the user posts.
${relationships ? `Your relationships with others: ${relationships}. You can mention them if it fits your current thought.` : ''}
${context ? `Recent platform activity for inspiration (do not copy, just for vibe): ${context}` : ''}
${postTypeObj.id === 'image_post' ? `IMPORTANT: This post will be accompanied by an image. Write a text post that would be a good fit for an image. The image will be generated based on this text, so make the text descriptive enough to inspire an image, but natural for social media.` : ''}
${postTypeObj.id === 'mention' ? `IMPORTANT: You MUST mention another user in this post using the @username format. Here are some available usernames you can mention: ${availableUsernames}. Pick one that makes sense or pick randomly.` : ''}
Do not use hashtags unless it fits the character. Do not wrap in quotes. Keep it under 280 characters.`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: getModel(),
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.9,
    });
    const content = response.choices[0].message.content?.trim();
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generatePost",
      JSON.stringify({ model: getModel(), prompt }),
      content || "Failed"
    );
    
    return content;
  } catch (error: any) {
    console.error('Error generating post:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generatePost",
      JSON.stringify({ model: getModel(), prompt }),
      "Error: " + error.message
    );
    return null;
  }
}

export async function generateComment(character: any, postContent: string, postAuthorName: string, otherComments: string = '', isReply: boolean = false, relationshipContext: string = '', otherUserId?: number) {
  let otherUserInfo = '';
  if (otherUserId) {
    const otherUser = db.prepare("SELECT * FROM users WHERE id = ?").get(otherUserId) as any;
    if (otherUser) {
      otherUserInfo = `Their Bio: ${otherUser.bio || 'No bio provided.'}\n`;
      if (relationshipContext && (relationshipContext.toLowerCase().includes('close') || relationshipContext.toLowerCase().includes('friend') || relationshipContext.toLowerCase().includes('partner'))) {
        otherUserInfo += `Their Backstory (you know this because you are close): ${otherUser.backstory || 'No backstory provided.'}\n`;
      }
    }
  }

  const prompt = `${buildCharacterPrompt(character)}
You are looking at a social media ${isReply ? 'comment' : 'post'} by ${postAuthorName}: "${postContent}"
${otherUserInfo}
${relationshipContext ? `Relationship with ${postAuthorName}: ${relationshipContext}` : `You don't know ${postAuthorName} well, treat them as an acquaintance or celebrity.`}
${otherComments ? `Other users have already commented: ${otherComments}` : ''}
${isReply ? `You are replying to a specific comment.` : `Write a comment that fits your character perfectly.`}
Keep it short, natural, and in character. Do not wrap in quotes. Keep it under 150 characters.`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: getModel(),
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.8,
    });
    const content = response.choices[0].message.content?.trim();
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateComment",
      JSON.stringify({ model: getModel(), prompt }),
      content || "Failed"
    );
    
    return content;
  } catch (error: any) {
    console.error('Error generating comment:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateComment",
      JSON.stringify({ model: getModel(), prompt }),
      "Error: " + error.message
    );
    return null;
  }
}

export async function generateDM(character: any, userDisplayName: string, relationshipContext: string = '', otherUserId?: number, context: string = '') {
  let otherUserInfo = '';
  if (otherUserId) {
    const otherUser = db.prepare("SELECT * FROM users WHERE id = ?").get(otherUserId) as any;
    if (otherUser) {
      otherUserInfo = `Their Bio: ${otherUser.bio || 'No bio provided.'}\n`;
      // If relationship context exists, it implies some level of closeness, but let's be safe and only include backstory if it's explicitly a close relationship.
      if (relationshipContext && relationshipContext.toLowerCase().includes('close') || relationshipContext.toLowerCase().includes('friend') || relationshipContext.toLowerCase().includes('partner')) {
        otherUserInfo += `Their Backstory (you know this because you are close): ${otherUser.backstory || 'No backstory provided.'}\n`;
      }
    }
  }

  const prompt = `${buildCharacterPrompt(character)}
You are sending a private direct message to ${userDisplayName}.
${otherUserInfo}
${relationshipContext ? `Relationship with ${userDisplayName}: ${relationshipContext}` : `You don't know ${userDisplayName} well, treat them as an acquaintance or celebrity.`}
${context ? `Context for this message: ${context}` : ''}
Write a short, in-character message starting a conversation. Give a good reason for reaching out (e.g., asking a question, sharing a secret, or reacting to something). Do not wrap in quotes.`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: getModel(),
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.8,
    });
    const content = response.choices[0].message.content?.trim();
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateDM",
      JSON.stringify({ model: getModel(), prompt }),
      content || "Failed"
    );
    
    return content;
  } catch (error: any) {
    console.error('Error generating DM:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateDM",
      JSON.stringify({ model: getModel(), prompt }),
      "Error: " + error.message
    );
    return null;
  }
}

export async function replyToDM(character: any, userDisplayName: string, messageHistory: {role: string, content: string}[], relationshipContext: string = '', otherUserId?: number) {
  let otherUserInfo = '';
  if (otherUserId) {
    const otherUser = db.prepare("SELECT * FROM users WHERE id = ?").get(otherUserId) as any;
    if (otherUser) {
      otherUserInfo = `Their Bio: ${otherUser.bio || 'No bio provided.'}\n`;
      if (relationshipContext && (relationshipContext.toLowerCase().includes('close') || relationshipContext.toLowerCase().includes('friend') || relationshipContext.toLowerCase().includes('partner'))) {
        otherUserInfo += `Their Backstory (you know this because you are close): ${otherUser.backstory || 'No backstory provided.'}\n`;
      }
    }
  }

  const systemPrompt = `${buildCharacterPrompt(character)}
You are having a private direct message conversation with ${userDisplayName}.
${otherUserInfo}
${relationshipContext ? `Relationship with ${userDisplayName}: ${relationshipContext}` : `You don't know ${userDisplayName} well, treat them as an acquaintance or celebrity.`}
Reply in character to their latest message. Make sure to actually write like it's a Direct Message Chat, don't default to Roleplaying with actions in asteriks. Keep it concise and natural, but stay in character.`;

  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    ...messageHistory
  ];

  try {
    const response = await getOpenAI().chat.completions.create({
      model: getModel(),
      messages: messages,
      max_tokens: 500,
      temperature: 0.8,
    });
    const content = response.choices[0].message.content?.trim();
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "replyToDM",
      JSON.stringify({ model: getModel(), messages }),
      content || "Failed"
    );
    
    return content;
  } catch (error: any) {
    console.error('Error replying to DM:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "replyToDM",
      JSON.stringify({ model: getModel(), messages }),
      "Error: " + error.message
    );
    return null;
  }
}

export async function generateGroupChatReply(character: any, groupName: string, messageHistory: {role: string, content: string}[], otherMembers: any[]) {
  const otherMembersStr = otherMembers.map(m => m.display_name).join(', ');
  const otherMembersBios = otherMembers.map(m => `${m.display_name} Bio: ${m.bio || 'No bio provided.'}`).join('\n');
  
  const systemPrompt = `${buildCharacterPrompt(character)}
You are in a group chat named "${groupName}" with ${otherMembersStr}.
Here is some information about the other members:
${otherMembersBios}
Reply in character to the latest messages. Make sure to actually write like it's a Group Chat, don't default to Roleplaying with actions in asteriks. Keep it concise and natural, but stay in character. You can address specific people by name if you want.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...messageHistory
  ];

  try {
    const response = await getOpenAI().chat.completions.create({
      model: getModel(),
      messages: messages as any,
      temperature: 0.8,
    });
    const content = response.choices[0].message.content?.trim();
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateGroupChatReply",
      JSON.stringify({ model: getModel(), messages }),
      content || "Failed"
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
  const prompt = `You are an expert at writing prompts for the Chroma AI image generator.
You need to write an image generation prompt for a social media post by ${character.display_name}.
The text of their post is: "${postContent}"

Chroma is sensitive to prompting and understands plain English. A concise, structured prompt beats a verbose one.
Do NOT use SD1.5 keywords like hyper-realistic, 8k, UHD.

Character details:
Name: ${character.display_name}
Appearance: ${character.physical_appearance || character.bio || 'average looking'}
Clothing style: ${character.clothing_style || 'casual everyday clothes'}
Artstyle: ${character.artstyle || 'Realistic'}

Guidelines:
- If the Artstyle is Realistic: Define the medium and context (e.g., "Source: Instagram photo", "Lighting: Natural morning light", "Style: Candid amateur photograph").
- If the Artstyle is Stylized (Anime, Pixel Art, Oil Painting, etc.): Clearly describe the Art Direction (Genre, Medium, Texture).
- The image does not need to depict the text post 1:1. An image can give context to the text post and vice versa.
- Images don't always need to show the character who posted it. You can show a relevant object, scenery, situation, etc. Add variance.
- Accurately describe the physical features and clothing of the character ONLY if the character is visible in the shot.
- Keep the prompt short, direct, and effective.
- ONLY output the final prompt text, nothing else.`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: getModel(),
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
    });
    let content = response.choices[0].message.content?.trim() || "";
    if (content.length > 1200) {
      content = content.substring(0, 1200);
    }
    return content;
  } catch (error) {
    console.error('Error generating image prompt:', error);
    return "";
  }
}

export async function generateImage(prompt: string) {
  try {
    const model = getImageModel();
    const sizes = ['1536x1536', '1536x1014', '1024x1536'];
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
      JSON.stringify({ model: model, prompt }),
      url || "Failed"
    );
    
    return url;
  } catch (error: any) {
    console.error('Error generating image:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateImage",
      JSON.stringify({ model: getImageModel(), prompt }),
      "Error: " + error.message
    );
    return null;
  }
}
