// main.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const TOKEN = Deno.env.get("BOT_TOKEN")!;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const SECRET_PATH = "/tkmracehelper";

// Use usernames instead of IDs
const SOURCE_CHANNEL = "@TkmRace";      // channel to copy from
const TARGET_CHANNEL = "@MasakoffVpn";  // channel to send into

// --- Forward message utility ---
async function forwardMessage(fromChat: string, messageId: number, toChat: string) {
  await fetch(`${TELEGRAM_API}/forwardMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: toChat,
      from_chat_id: fromChat,
      message_id: messageId,
    }),
  });
}

// --- Webhook handler ---
serve(async (req: Request) => {
  if (new URL(req.url).pathname !== SECRET_PATH) {
    return new Response("Not Found", { status: 404 });
  }

  const update = await req.json();

  // If it's a channel post
  if (update.channel_post) {
    const post = update.channel_post;

    // Only forward if it’s from @TkmRace
    if (post.chat?.username?.toLowerCase() === SOURCE_CHANNEL.replace("@", "").toLowerCase()) {
      await forwardMessage(SOURCE_CHANNEL, post.message_id, TARGET_CHANNEL);
    }
  }

  return new Response("ok");
});
