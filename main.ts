// main.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const TOKEN = Deno.env.get("BOT_TOKEN")!;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const SECRET_PATH = "/tkmracehelper";

// List of source channels (add more easily)
const SOURCE_CHANNELS = ["@TkmRace", "@AnotherChannel"]; 
// Target channel where all posts go
const TARGET_CHANNEL = "@MasakoffVpn";

// --- Copy message utility (adds footer) ---
async function copyMessageWithFooter(fromChat: string, messageId: number, toChat: string, footer: string) {
  await fetch(`${TELEGRAM_API}/copyMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: toChat,
      from_chat_id: fromChat,
      message_id: messageId,
      caption: footer,  // footer will be added if original has no caption
      parse_mode: "HTML"
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
    const channelUsername = `@${post.chat?.username}`;

    // If channel is in our source list
    if (SOURCE_CHANNELS.some(c => c.toLowerCase() === channelUsername.toLowerCase())) {
      const footer = `\n\n🔄 Powered by ${channelUsername}`;

      // If post has text or caption → we must re-send with text+footer
      if (post.text || post.caption) {
        const text = (post.text ?? post.caption ?? "") + footer;
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TARGET_CHANNEL,
            text,
            parse_mode: "HTML"
          }),
        });
      } else {
        // If it's pure media (photo/video without caption) → copy with footer
        await copyMessageWithFooter(channelUsername, post.message_id, TARGET_CHANNEL, footer);
      }
    }
  }

  return new Response("ok");
});


