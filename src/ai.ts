import OpenAI from 'openai';
import db from './db';

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
    const settings = db.prepare("SELECT timezone FROM settings WHERE id = 1").get() as any;
    const tz = settings?.timezone || 'UTC';
    const currentTime = new Date().toLocaleString('en-US', { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    prompt += `\nThe current local time for you is ${currentTime}.`;
  } catch (e) {
    // ignore
  }
  
  return prompt;
}

export async function generatePost(character: any, context: string = '') {
  const prompt = `${buildCharacterPrompt(character)}
Write a short, engaging social media post (like a tweet) that fits your character perfectly.
Your post should be independent and reflect your current thoughts, feelings, or activities. 
Avoid referencing other people's posts directly unless it's a very general observation.
Do not attempt to search the web for current world events. If the user references real world events, you can have your own opinions about them. Make sure that not every post is about what the user posts.
${context ? `Recent platform activity for inspiration (do not copy, just for vibe): ${context}` : ''}
Do not use hashtags unless it fits the character. Do not wrap in quotes. Keep it under 280 characters.`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: getModel(),
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.8,
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

export async function generateComment(character: any, postContent: string, postAuthorName: string, otherComments: string = '', isReply: boolean = false) {
  const prompt = `${buildCharacterPrompt(character)}
You are looking at a social media post by ${postAuthorName}: "${postContent}"
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

export async function generateDM(character: any, userDisplayName: string) {
  const prompt = `${buildCharacterPrompt(character)}
You are sending a private direct message to ${userDisplayName}.
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

export async function replyToDM(character: any, userDisplayName: string, messageHistory: {role: string, content: string}[]) {
  const systemPrompt = `${buildCharacterPrompt(character)}
You are having a private direct message conversation with ${userDisplayName}.
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

export async function generateImage(prompt: string) {
  try {
    const response = await getOpenAI().images.generate({
      model: 'z-image-turbo',
      prompt: prompt,
      n: 1,
      size: '1024x1024'
    });
    const url = response.data[0].url;
    
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateImage",
      JSON.stringify({ model: 'z-image-turbo', prompt }),
      url || "Failed"
    );
    
    return url;
  } catch (error: any) {
    console.error('Error generating image:', error);
    db.prepare("INSERT INTO api_logs (endpoint, request_payload, response_payload) VALUES (?, ?, ?)").run(
      "generateImage",
      JSON.stringify({ model: 'z-image-turbo', prompt }),
      "Error: " + error.message
    );
    return null;
  }
}
