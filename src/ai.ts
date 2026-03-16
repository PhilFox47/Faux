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
7. A list of 10-20 relevant tags. These tags are used to find "similar" characters. They should include character traits like what Franchise they are from, personality traits, interests, and things they can bond over with other characters.

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
  const prompt = `You are a social media manager. Given the following post:
"${post.content}" by ${post.author_name}

Which of the following users is most likely to leave a comment based on their bio?
${availableUsers.map(u => `ID: ${u.id}, Name: ${u.display_name}, Bio: ${u.bio}`).join('\n')}

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

export async function generatePost(character: any, context: string = '', relationships: string = '', isImage: boolean = false) {
  const topics = [
    "a random thought you just had",
    "something you are currently doing or working on",
    "a strong opinion about a trivial matter",
    "a question for your followers",
    "a recent memory or experience",
    "a complaint about something minor",
    "an observation about your surroundings",
    "a cryptic or mysterious statement",
    "a joke or humorous observation",
    "a piece of advice you'd give yourself"
  ];
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];

  const prompt = `${buildCharacterPrompt(character)}
Write a short, engaging social media post (like a tweet) that fits your character perfectly.
Your post should be independent and reflect your current thoughts, feelings, or activities. 
For this specific post, focus on: ${randomTopic}.
Avoid referencing other people's posts directly unless it's a very general observation.
Do not attempt to search the web for current world events. If the user references real world events, you can have your own opinions about them. Make sure that not every post is about what the user posts.
${relationships ? `Your relationships with others: ${relationships}. You can mention them if it fits your current thought.` : ''}
${context ? `Recent platform activity for inspiration (do not copy, just for vibe): ${context}` : ''}
${isImage ? `IMPORTANT: This post will be accompanied by an image. Write a text post that would be a good fit for an image. The image will be generated based on this text, so make the text descriptive enough to inspire an image, but natural for social media.` : ''}
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
You are looking at a social media post by ${postAuthorName}: "${postContent}"
${otherUserInfo}
${relationshipContext ? `Relationship with ${postAuthorName}: ${relationshipContext}` : `You don't know ${postAuthorName} well, treat them as an acquaintance or celebrity.`}
${otherComments ? `Other users have already commented: ${otherComments}` : ''}
${isReply ? `You are replying to a specific comment.` : `Write a ${isReply ? 'reply' : 'comment'} that fits your character perfectly.`}
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

export async function generateDM(character: any, userDisplayName: string, relationshipContext: string = '', otherUserId?: number) {
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
  const prompt = `You are an expert at writing prompts for the Z-Image-Turbo AI image generator.
You need to write an image generation prompt for a social media post by ${character.display_name}.
The text of their post is: "${postContent}"

Follow this structure for the prompt:
[Shot & subject] + [Age & appearance] + [Clothing & modesty] + [Environment/background] + [Lighting] + [Mood] + [Style/medium] + [Technical notes] + [Safety/cleanup constraints]

Character details:
Name: ${character.display_name}
Appearance: ${character.physical_appearance || character.bio || 'average looking'}
Clothing style: ${character.clothing_style || 'casual everyday clothes'}

Guidelines:
- The image does not need to depict the text post 1:1. An image can give context to the text post and vice versa.
- Images should look like actual images posted on social media by "normal" people (can have weird angles, be blurry, candid, etc.).
- Accurately describe the physical features and clothing of the character (if the character is visible) to ensure consistency.
- Include safety constraints at the end: "safe for work, non-sexual, fully clothed characters, no nudity, no suggestive poses, no text, no watermark, no logos, plain background, not busy or cluttered, no extra limbs, correct human anatomy, no motion blur, sharp focus, no lens distortion, no fisheye effect"
- Keep the prompt under 1000 characters (absolute maximum 1200 characters).
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
    const response = await getOpenAI().images.generate({
      model: model,
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json'
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
