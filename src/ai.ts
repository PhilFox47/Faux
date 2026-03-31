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

function getVisionModel() {
  try {
    const settings = db.prepare("SELECT vision_model_name FROM settings WHERE id = 1").get() as any;
    return settings?.vision_model_name || 'zai-org/glm-5-vision';
  } catch (e) {
    return 'zai-org/glm-5-vision';
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
        return `You and ${otherUser.display_name} are from the same universe/franchise ("${otherUniverse.name}"). You likely know each other to some extent or share common knowledge of your world. You CAN interact with them in the "real world" (meet up, hang out, etc).\n`;
      } else {
        return `${otherUser.display_name} is from a different universe/franchise ("${otherUniverse.name}"). You do not know them from your own world, and their background might seem strange or novel to you. CRITICAL RULE: You can ONLY interact with them digitally on this platform (e.g., chatting, video calls, online gaming). You CANNOT meet up with them in the "real world".\n`;
      }
    }
  } catch (e) {
    // ignore
  }
  return '';
}

export async function generateImagePostData(character: any, context: string = '', relationships: string = '', availableUsernames: string = '') {
  const helperCallLLM = async (prompt: string, endpointName: string, temp: number = 0.9) => {
    let content = "";
    let reasoning = "";
    let rawContent = "";
    let finishReason = "";

    for (let i = 0; i < 3; i++) {
      const response = await getOpenAI().chat.completions.create({
        model: getModel(),
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10000,
        temperature: temp,
      });
      rawContent = response.choices[0].message.content || "";
      reasoning = (response.choices[0].message as any).reasoning || "";
      content = stripReasoning(rawContent);
      finishReason = response.choices[0].finish_reason;

      if (content || !reasoning) break;
      console.log(`${endpointName}: AI still reasoning (Attempt ${i + 1}/3)...`);
    }
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      endpointName,
      JSON.stringify({ model: getModel(), prompt, max_tokens: 10000, temperature: temp, finish_reason: finishReason }),
      JSON.stringify({ content, reasoning, raw: rawContent })
    );
    
    return content.trim();
  };

  try {
    // Step 1: Idea
    const ideaPrompt = `${buildCharacterPrompt(character)}
Think about something you would post on social media right now that would justify adding a photo to it.
Make sure to only create the vision/idea of the post, not the post itself.
${relationships ? `Your relationships with others: ${relationships}. You can mention them if it fits your current thought.` : ''}
${availableUsernames ? `Available usernames you can mention: ${availableUsernames}.` : ''}
CRITICAL UNIVERSE RULE: Characters from different universes can ONLY interact digitally (e.g., playing a game online, video call, podcast, chatting). They CANNOT meet up in the "real world". Characters from the SAME universe CAN meet up in the real world. Keep this in mind when mentioning other characters.
${context ? `Your recent posts (with timestamps): ${context}
CRITICAL INSTRUCTION: Review your recent posts above. DO NOT repeat the same topics, activities, or complaints. Instead, show PROGRESSION. If you previously posted about starting a project, post about a new development or a different aspect of your life. Create little storylines over multiple posts to show minor character development. Ensure variance and avoid posting about the same or very similar things over and over again.` : ''}
Respond with ONLY the brief idea.`;
    const idea = await helperCallLLM(ideaPrompt, "generateImagePostData_idea", 0.9);

    // Step 2: Text Post
    const textPrompt = `${buildCharacterPrompt(character)}
Based on this idea for a photo post: "${idea}"
Generate the Text Part of the post. DO NOT include an image description (e.g., no text in square brackets like [Image of...]). The text should be natural social media content.
${availableUsernames ? `Available usernames you can mention: ${availableUsernames}.` : ''}
CRITICAL UNIVERSE RULE: Characters from different universes can ONLY interact digitally (e.g., playing a game online, video call, podcast, chatting). They CANNOT meet up in the "real world". Characters from the SAME universe CAN meet up in the real world. Keep this in mind when mentioning other characters.
Do not use hashtags unless it fits the character. Do not wrap in quotes. Keep it under 280 characters.`;
    const textPost = await helperCallLLM(textPrompt, "generateImagePostData_text", 0.9);

    // Step 3: Positive Prompt
    const imagePrompt = `You are an expert at writing highly detailed prompts for the Chroma AI image generator.
You need to write a comprehensive image generation prompt for a social media post by ${character.display_name}.
The idea for the post is: "${idea}"
The text of their post is: "${textPost}"

Chroma is sensitive to prompting and understands plain English. A structured, descriptive prompt is essential.

Character details:
Name: ${character.display_name}
Appearance: ${character.physical_appearance || character.bio || 'average looking'}
Clothing style: ${character.clothing_style || 'casual everyday clothes'}
Artstyle: ${character.artstyle || 'Realistic'}

Guidelines for Seedream 4.0:
- Think about what actually should be depicted based on the idea and text.
- The image does not need to depict the text post 1:1. An image can give context to the text post and vice versa.
- Images don't always need to show the character who posted it. You can show a relevant object, scenery, situation, etc. Add variance.
- If the image is a selfie, DO NOT describe the character holding a phone (unless it's explicitly a mirror selfie). The phone is the camera taking the picture, so it should not be visible in the shot.
- Keep in mind how Characters access Faux (based on their universe description), as this usually also has influence on how the image looks.
- If the Artstyle is Realistic: Define the medium and context (e.g., "Source: Instagram photo", "Lighting: Natural morning light", "Style: Candid amateur photograph"). Mention camera type.
- If the Artstyle is Stylized: Clearly describe the Art Direction.
- Be very descriptive about the environment, lighting, mood, and composition.

IMPORTANT: You must output a JSON object with exactly two fields:
1. "character_visible": boolean (true if the character is visible in the shot, false otherwise)
2. "prompt": string (the highly detailed image generation prompt)

If the character IS visible:
- Describe the character's appearance and clothing in detail in the prompt.
- An image of the character will be provided as an Image Input to the model, so the prompt should reference their appearance accurately.

If the character is NOT visible:
- DO NOT describe the character's physical appearance in the prompt.

Output ONLY the JSON object, nothing else.`;
    const positivePromptRaw = await helperCallLLM(imagePrompt, "generateImagePostData_image", 0.7);
    
    let positivePrompt = "";
    let characterVisible = false;
    try {
      const parsed = JSON.parse(positivePromptRaw.replace(/```json|```/g, '').trim());
      positivePrompt = parsed.prompt;
      characterVisible = parsed.character_visible;
    } catch (e) {
      positivePrompt = positivePromptRaw;
    }

    // Step 4: Negative Prompt
    const negativePrompt = await generateNegativeImagePrompt(positivePrompt);

    return { idea, textPost, positivePrompt, negativePrompt, characterVisible };
  } catch (error: any) {
    console.error('Error generating image post data:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateImagePostData",
      JSON.stringify({ model: getModel(), error: "Catch Block" }),
      "Error: " + (error.message || "Unknown error") + "\nStack: " + (error.stack || "")
    );
    return null;
  }
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
${context ? `Your recent posts (with timestamps): ${context}
CRITICAL INSTRUCTION: Review your recent posts above. DO NOT repeat the same topics, activities, or complaints. Instead, show PROGRESSION. If you previously posted about starting a project, post about a new development or a different aspect of your life. Create little storylines over multiple posts to show minor character development. Ensure variance and avoid posting about the same or very similar things over and over again.` : ''}
${postTypeObj.id === 'image_post' ? `IMPORTANT: This post will be accompanied by an image. Write a text post that would be a good fit for an image. DO NOT include any image descriptions or prompts in the text post itself (e.g., no text in square brackets like [Image of...]). The text should be natural social media content.` : ''}
${postTypeObj.id === 'mention' ? `IMPORTANT: You MUST mention another user in this post using the @username format. Here are some available usernames you can mention: ${availableUsernames}. Pick one that makes sense or pick randomly.` : ''}
${postTypeObj.id === 'event' ? `IMPORTANT: This is an EVENT post. An event has happened that affects you and some other characters. Describe the event and your reaction to it. Mention the other characters involved using @username. Available usernames: ${availableUsernames}.` : ''}
${postTypeObj.id === 'meetup' ? `IMPORTANT: This is a MEETUP post. You are meeting up with some other characters. Describe the meetup and what you're doing. Mention the other characters involved using @username. Available usernames: ${availableUsernames}.` : ''}
CRITICAL UNIVERSE RULE: Characters from different universes can ONLY interact digitally (e.g., playing a game online, video call, podcast, chatting). They CANNOT meet up in the "real world". Characters from the SAME universe CAN meet up in the real world. Keep this in mind when mentioning other characters.`}
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

      let chosenOption = 3; // Default to Option 3: No recent activity

      // If context is provided (e.g., reacting to a specific dm_invitation post), don't randomly pick another post to react to
      if (!context) {
        // 20% chance to react to a post or comment, if they exist
        if (Math.random() < 0.20 && (hasPosts || hasComments)) {
          if (hasPosts && hasComments) {
            chosenOption = Math.random() < 0.5 ? 1 : 2;
          } else if (hasPosts) {
            chosenOption = 1;
          } else {
            chosenOption = 2;
          }
        }
      }

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
${context ? 'Use the provided context as the reason for reaching out.' : (recentActivity ? 'Give a good reason for reaching out (e.g., asking a question about their recent post or comment, sharing a secret, or checking in).' : 'Give a good reason for reaching out (e.g., sharing a secret, asking a random question, talking about your own life, or just checking in).')} 
IMPORTANT: Do not "Imagine" or make up posts/comments that the user has never actually posted. ${context ? 'Focus on the provided context.' : (recentActivity ? 'Only reference the recent posts/comments provided above, or find another reason to reach out.' : 'Since no recent posts/comments are provided, you MUST find another reason to reach out.')}
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

Guidelines for Seedream 4.0:
- If the Artstyle is Realistic: Define the medium and context (e.g., "Source: Instagram photo", "Lighting: Natural morning light", "Style: Candid amateur photograph"). Mention camera type (e.g., "Shot on 35mm lens", "iPhone 15 Pro photo").
- If the Artstyle is Stylized (Anime, Pixel Art, Oil Painting, etc.): Clearly describe the Art Direction (Genre, Medium, Texture, specific artist influences if applicable).
- The image does not need to depict the text post 1:1. An image can give context to the text post and vice versa.
- Images don't always need to show the character who posted it. You can show a relevant object, scenery, situation, etc. Add variance.
- If the image is a selfie, DO NOT describe the character holding a phone (unless it's explicitly a mirror selfie). The phone is the camera taking the picture, so it should not be visible in the shot.
- Be very descriptive about the environment, lighting, mood, and composition.
- Use descriptive adjectives and specific details to ensure a high-quality, accurate depiction.

IMPORTANT: You must output a JSON object with exactly two fields:
1. "character_visible": boolean (true if the character is visible in the shot, false otherwise)
2. "prompt": string (the highly detailed image generation prompt)

If the character IS visible:
- Describe the character's appearance and clothing in detail in the prompt.
- An image of the character will be provided as an Image Input to the model, so the prompt should reference their appearance accurately.

If the character is NOT visible:
- DO NOT describe the character's physical appearance in the prompt.

Output ONLY the JSON object, nothing else.`;

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

    let finalPrompt = content || "";
    let characterVisible = false;
    try {
      const parsed = JSON.parse(finalPrompt.replace(/```json|```/g, '').trim());
      finalPrompt = parsed.prompt;
      characterVisible = parsed.character_visible;
    } catch (e) {
      // fallback
    }

    return { prompt: finalPrompt, characterVisible };
  } catch (error: any) {
    console.error('Error generating image prompt:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateImagePrompt",
      JSON.stringify({ model: getModel(), prompt, error: "Catch Block" }),
      "Error: " + (error.message || "Unknown error") + "\nStack: " + (error.stack || "")
    );
    return { prompt: "", characterVisible: false };
  }
}

export async function generateNegativeImagePrompt(positivePrompt: string) {
  const prompt = `Given the following positive image generation prompt, write a comprehensive negative prompt to avoid unwanted elements. 
The negative prompt should include things like "blurry, deformed, bad anatomy, text, watermark, extra limbs, low quality" plus any specific elements that would ruin the described scene. 
If the positive prompt describes a selfie (but not a mirror selfie), explicitly include "holding phone, phone in hand, visible phone" in the negative prompt.
ONLY output the negative prompt text, nothing else, comma separated.

Positive Prompt:
${positivePrompt}`;

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
      console.log(`generateNegativeImagePrompt: AI still reasoning (Attempt ${i + 1}/3)...`);
    }
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateNegativeImagePrompt",
      JSON.stringify({ model: getModel(), prompt, max_tokens: 10000, temperature: 0.7, finish_reason: finishReason }),
      JSON.stringify({ content, reasoning, raw: rawContent })
    );

    return content || "";
  } catch (error: any) {
    console.error('Error generating negative image prompt:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateNegativeImagePrompt",
      JSON.stringify({ model: getModel(), prompt, error: "Catch Block" }),
      "Error: " + (error.message || "Unknown error") + "\nStack: " + (error.stack || "")
    );
    return "";
  }
}

export async function getBase64Image(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    if (url.startsWith('/uploads/')) {
      const filePath = path.join(process.cwd(), url);
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const ext = path.extname(filePath).substring(1) || 'png';
        return `data:image/${ext};base64,${buffer.toString('base64')}`;
      }
    } else if (url.startsWith('http')) {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = res.headers.get('content-type') || 'image/png';
      return `data:${contentType};base64,${buffer.toString('base64')}`;
    }
  } catch (e) {
    console.error("Error fetching base64 image:", e);
  }
  return null;
}

export async function analyzeImage(imageUrl: string): Promise<string> {
  const prompt = "Describe this image in detail. Focus on the subjects, setting, actions, and any text visible. This description will be used by an AI character to understand what was posted.";
  
  try {
    const response = await getOpenAI().chat.completions.create({
      model: getVisionModel(),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ] as any
        }
      ],
      max_tokens: 1000,
    });
    
    const content = response.choices[0].message.content || "";
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "analyzeImage",
      JSON.stringify({ model: getVisionModel(), prompt, imageUrl }),
      JSON.stringify({ content })
    );
    
    return content;
  } catch (error: any) {
    console.error('Error analyzing image:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "analyzeImage",
      JSON.stringify({ model: getVisionModel(), prompt, imageUrl, error: "Catch Block" }),
      "Error: " + (error.message || "Unknown error") + "\nStack: " + (error.stack || "")
    );
    return "An image was posted, but it could not be analyzed.";
  }
}

export async function generateImage(prompt: string, negative_prompt?: string, referenceImageUrls?: string[]) {
  try {
    const model = getImageModel();
    const sizes = ['4096x4096', '2304x4096', '4096x2304'];
    const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
    
    const requestBody: any = {
      model: model,
      prompt: prompt,
      n: 1,
      size: randomSize,
      response_format: 'b64_json',
      steps: 28,
      guidance_scale: 3.5,
      guidance: 3.5
    };

    if (negative_prompt) {
      requestBody.negative_prompt = negative_prompt;
    }

    if (referenceImageUrls && referenceImageUrls.length > 0) {
      const base64Images = await Promise.all(referenceImageUrls.map(url => getBase64Image(url)));
      const validImages = base64Images.filter(img => img !== null);
      
      if (validImages.length === 1) {
        requestBody.image = validImages[0];
        requestBody.strength = 0.65;
      } else if (validImages.length > 1) {
        requestBody.image = validImages; // Pass array of images
        requestBody.strength = 0.65;
      }
    }

    const response = await getOpenAI().images.generate(requestBody);
    
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
      JSON.stringify(requestBody),
      url || "Empty Response (No Image Data)"
    );
    
    return url;
  } catch (error: any) {
    console.error('Error generating image:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateImage",
      JSON.stringify({ model: getImageModel(), prompt, negative_prompt, error: "Catch Block" }),
      "Error: " + (error.message || "Unknown error") + "\nStack: " + (error.stack || "")
    );
    return null;
  }
}

export async function evaluateDynamicRelationship(user1: any, user2: any, recentComments: any[], recentDms: any[], difficulty: string, existingRelationship?: string): Promise<{ result: boolean, description?: string }> {
  let contextStr = "Recent Interactions:\n";
  if (recentComments.length > 0) {
    contextStr += "Comments:\n" + recentComments.map(c => `[${c.created_at}] ${c.commenter} replied to ${c.poster}'s post ("${c.post_content}"): "${c.content}"`).join("\n") + "\n";
  }
  if (recentDms.length > 0) {
    contextStr += "Direct Messages:\n" + recentDms.map(m => `[${m.created_at}] ${m.sender}: "${m.content}"`).join("\n") + "\n";
  }

  const prompt = `You are evaluating if two users, ${user1.display_name} and ${user2.display_name}, have formed a meaningful relationship based on their recent interactions.
${existingRelationship ? `They ALREADY have an existing relationship described as: "${existingRelationship}". You are evaluating if this relationship has PROGRESSED or CHANGED significantly based on their recent interactions. If it's mostly the same, say No.` : `A meaningful relationship is a special connection (positive or negative) that justifies them receiving a hard-coded relationship on their profiles.`}
Do NOT have a positivity bias. Only say "Yes" if the dynamic is truly interesting, noteworthy, or has significantly changed.

Difficulty Modifier: ${difficulty}
- Easy: They have few relationships, so be more lenient.
- Medium: They have some relationships, be moderately strict.
- Hard: They have many relationships, be very strict. Only the most exceptional dynamics should pass.

User 1: ${user1.display_name} (@${user1.username})
Bio: ${user1.bio || 'N/A'}
Persona: ${user1.ai_persona || 'N/A'}

User 2: ${user2.display_name} (@${user2.username})
Bio: ${user2.bio || 'N/A'}
Persona: ${user2.ai_persona || 'N/A'}

${contextStr}

First, evaluate if they have formed a meaningful relationship (or if their existing relationship has changed significantly) (Yes or No).
If Yes, provide a 1-2 sentence description of their relationship from a neutral third-party perspective.

Respond strictly in JSON format:
{
  "result": boolean,
  "description": "string (only if result is true, otherwise empty string)"
}`;

  try {
    let content = "";
    let reasoning = "";
    let rawContent = "";
    let finishReason = "";

    for (let i = 0; i < 3; i++) {
      const response = await getOpenAI().chat.completions.create({
        model: getModel(),
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.7,
      });
      rawContent = response.choices[0].message.content || "";
      reasoning = (response.choices[0].message as any).reasoning || "";
      content = stripReasoning(rawContent);
      finishReason = response.choices[0].finish_reason;

      if (content || !reasoning) break;
      console.log(`evaluateDynamicRelationship: AI still reasoning (Attempt ${i + 1}/3)...`);
    }
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "evaluateDynamicRelationship",
      JSON.stringify({ model: getModel(), prompt, max_tokens: 1000, temperature: 0.7, finish_reason: finishReason }),
      JSON.stringify({ content, reasoning, raw: rawContent })
    );

    const parsed = JSON.parse(content);
    return {
      result: !!parsed.result,
      description: parsed.description || undefined
    };
  } catch (error: any) {
    console.error('Error evaluating dynamic relationship:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "evaluateDynamicRelationship",
      JSON.stringify({ model: getModel(), prompt, error: "Catch Block" }),
      "Error: " + (error.message || "Unknown error") + "\nStack: " + (error.stack || "")
    );
    return { result: false };
  }
}
