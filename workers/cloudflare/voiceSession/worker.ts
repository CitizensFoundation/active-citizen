import { D1Database, ExecutionContext, KVNamespace } from '@cloudflare/workers-types';

interface Env {
  HEYGEN_API_KEY: string;
  D1_AVATAR_SESSIONS: D1Database;
  KV_AVATAR_SESSSIONS: KVNamespace;
}

interface SessionConfig {
  language: string;
  avatarId: string;
  knowledgeBase: string;
  knowledgeId: string;
  sessionId: string;
}

interface ConversationMessage {
  type: 'avatar' | 'user';
  message: string;
  timestamp: number;
  taskId?: string;
}

function base64ToWav(base64Audio: string, sampleRate = 16000): ArrayBuffer {
  const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));

  // WAV header
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // "RIFF" chunk descriptor
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + audioData.length, true); // file size
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // "fmt " sub-chunk
  view.setUint32(12, 0x666D7420, false); // "fmt "
  view.setUint32(16, 16, true); // subchunk size
  view.setUint16(20, 3, true); // audio format (3 = IEEE float)
  view.setUint16(22, 1, true); // num channels
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * 4, true); // byte rate
  view.setUint16(32, 4, true); // block align
  view.setUint16(34, 32, true); // bits per sample

  // "data" sub-chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, audioData.length, true); // subchunk size

  // Combine header and audio data
  const wavFile = new Uint8Array(header.byteLength + audioData.length);
  wavFile.set(new Uint8Array(header), 0);
  wavFile.set(audioData, header.byteLength);

  return wavFile.buffer;
}

async function handleGetConfig(request: Request, env: Env): Promise<Response> {
  try {
    const config: SessionConfig = await request.json();

    // Get HeyGen token
    const response = await fetch('https://api.heygen.com/v1/streaming.create_token', {
      method: 'POST',
      headers: {
        'x-api-key': env.HEYGEN_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get HeyGen token: ${response.statusText}`);
    }

    const { token } = await response.json();

    // Initialize session with transaction
    const statements = [
      env.D1_AVATAR_SESSIONS.prepare(`
        INSERT INTO sessions (id, audio_data, chat_data, created_at)
        VALUES (?, '', '', ?)
      `).bind(config.sessionId, Date.now())
    ];

    await env.D1_AVATAR_SESSIONS.batch(statements);

    return new Response(JSON.stringify({
      token,
      knowledgeId: config.knowledgeId,
      knowledgeBase: config.knowledgeBase
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in get config:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleConversationBackup(request: Request, env: Env): Promise<Response> {
  try {
    const { sessionId, messages } = await request.json();
    const messageText = (messages as ConversationMessage[]).map(msg => msg.message).join('\n');

    // Create statements for transaction
    const statements = [
      // First statement locks the row
      env.D1_AVATAR_SESSIONS.prepare('SELECT 1 FROM sessions WHERE id = ? FOR UPDATE').bind(sessionId),
      // Second statement updates the data
      env.D1_AVATAR_SESSIONS.prepare('UPDATE sessions SET chat_data = chat_data || ? WHERE id = ?')
        .bind(messageText + '\n', sessionId)
    ];

    // Execute as transaction
    await env.D1_AVATAR_SESSIONS.batch(statements);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in conversation backup:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleAudioBackup(request: Request, env: Env): Promise<Response> {
  try {
    const { sessionId, audioData } = await request.json();

    // Create statements for transaction
    const statements = [
      // First statement locks the row
      env.D1_AVATAR_SESSIONS.prepare('SELECT 1 FROM sessions WHERE id = ? FOR UPDATE').bind(sessionId),
      // Second statement updates the data
      env.D1_AVATAR_SESSIONS.prepare('UPDATE sessions SET audio_data = audio_data || ? WHERE id = ?')
        .bind(audioData, sessionId)
    ];

    // Execute as transaction
    await env.D1_AVATAR_SESSIONS.batch(statements);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in audio backup:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleEndSession(request: Request, env: Env): Promise<Response> {
  try {
    const { sessionId } = await request.json();

    // First, lock and get the audio data
    const statements = [
      env.D1_AVATAR_SESSIONS.prepare('SELECT audio_data FROM sessions WHERE id = ? FOR UPDATE')
        .bind(sessionId),
      env.D1_AVATAR_SESSIONS.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?')
        .bind(Date.now(), sessionId)
    ];

    const [selectResult] = await env.D1_AVATAR_SESSIONS.batch(statements);
    const session = selectResult.results[0] as { audio_data: string } | undefined;

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Convert and store in KV
    const wavFile = base64ToWav(session.audio_data);
    await env.KV_AVATAR_SESSSIONS.put(`${sessionId}.wav`, wavFile);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in end session:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);

      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };

      // Handle OPTIONS requests
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      // Route requests
      let response: Response;
      switch (url.pathname) {
        case '/api/users/get_hey_gen_config':
          response = await handleGetConfig(request, env);
          break;

        case '/api/users/hey_gen_conversation_backup':
          response = await handleConversationBackup(request, env);
          break;

        case '/api/users/hey_gen_audio_backup':
          response = await handleAudioBackup(request, env);
          break;

        case '/api/users/hey_gen_end_session':
          response = await handleEndSession(request, env);
          break;

        default:
          response = new Response('Not Found', { status: 404 });
      }

      // Add CORS headers to response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};