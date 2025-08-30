// main.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const TOKEN = Deno.env.get("BOT_TOKEN")!;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const SECRET_PATH = "/tkmracehelper"; 
const GAME_CHAT_ID = -1001234567890; // <-- ID oýun çat

// --- Avto-tekster ---
const autoTexts = [
  "🏎 TkmRace-a hoş geldiň! Ýaryşa taýarmyň?",
  "🔥 TkmRace-de diňe iň çaltlar çempion bolýar!",
  "⚡ Reaksiýaňy ýokarlandyr — TkmRace-a gatnaş!",
  "🎮 TkmRace seni garaşýar: tizlik, şowhun we adrenalin!",
  "🚀 Raketa ýaly sür, öňe git!",
  "💨 Tozany galdyr, garşydaşyň yzda galsyn!",
  "🏁 Ýaryş başlaýar — taýarmyň?",
  "⚡ Çalt pikir et, çalt hereket et!",
  "🔥 Ýeňiş diňe güýçlülere degişlidir!",
  "🏎 Çaltlyk bilen ýeňşi gazan!",
];

// --- Utylity ---
async function sendMessage(chatId: number, text: string, markdown = false, replyTo?: number) {
  const body: any = { chat_id: chatId, text };
  if (markdown) body.parse_mode = "Markdown";
  if (replyTo) body.reply_to_message_id = replyTo;

  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function sendMuteMessage(chatId: number, text: string, userId: number, userName: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "🔓 Mute aýyrmak", callback_data: `remove_mute_${userId}_${encodeURIComponent(userName)}` }
        ]]
      }
    }),
  });
}

async function deleteMessage(chatId: number, messageId: number) {
  await fetch(`${TELEGRAM_API}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
  });
}

async function muteUser(chatId: number, userId: number, seconds = 24 * 60 * 60) {
  const untilDate = Math.floor(Date.now() / 1000) + seconds;
  await fetch(`${TELEGRAM_API}/restrictChatMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      user_id: userId,
      until_date: untilDate,
      permissions: {
        can_send_messages: false,
        can_send_media_messages: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
      },
    }),
  });
}

async function unmuteUser(chatId: number, userId: number) {
  await fetch(`${TELEGRAM_API}/restrictChatMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      user_id: userId,
      permissions: {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true,
      },
    }),
  });
}

async function isAdmin(chatId: number, userId: number) {
  const res = await fetch(`${TELEGRAM_API}/getChatMember?chat_id=${chatId}&user_id=${userId}`);
  const data = await res.json();
  if (!data.ok) return false;
  const status = data.result.status;
  return status === "administrator" || status === "creator";
}

async function answerCallbackQuery(callbackQueryId: string, text: string, showAlert = false) {
  await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    }),
  });
}

// --- Formatlama ---
function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  let parts: string[] = [];
  if (days > 0) {
    parts.push(`${days} ${days === 1 ? "gün" : "gün"}`);
  }
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? "sagat" : "sagat"}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? "minut" : "minut"}`);
  }
  if (parts.length === 0) parts.push("birnäçe sekunt");
  return parts.join(" ");
}

function formatUntilDateTM(unixTime: number): string {
  const d = new Date((unixTime + 5*3600) * 1000);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

// --- Avto-habarlar ---
setInterval(async () => {
  const randomText = autoTexts[Math.floor(Math.random() * autoTexts.length)];
  await sendMessage(GAME_CHAT_ID, randomText);
}, 60 * 1000);

// --- Server ---
serve(async (req: Request) => {
  if (new URL(req.url).pathname !== SECRET_PATH) {
    return new Response("Not Found", { status: 404 });
  }

  const update = await req.json();

  // --- Private ---
  if (update.message?.chat?.type === "private") {
    const chatId = update.message.chat.id;
    await sendMessage(chatId, "👋 Salam! Men [TkmRace](https://t.me/TkmRaceChat) toparynyň boty. Men diňe oýunuň çatynda işlemäge ukybym bar.",true);
    return new Response("ok");
  }

  // --- Täze ulanyjy ---
  if (update.message?.new_chat_member) {
    const user = update.message.new_chat_member;
    const chatId = update.message.chat.id;
    await sendMessage(chatId, `Hoş geldiň, [${user.first_name}](tg://user?id=${user.id})! 🎉`, true);
  }

  // --- Ulanyjy çykan ýagdaýynda ---
  if (update.message?.left_chat_member) {
    const user = update.message.left_chat_member;
    const chatId = update.message.chat.id;
    await sendMessage(chatId, `👋 [${user.first_name}](tg://user?id=${user.id}) topardan çykdy.`, true);
  }

  // --- Teskt habarlary ---
  if (update.message?.text) {
    const chatId = update.message.chat.id;
    const userId = update.message.from.id;
    const userName = update.message.from.first_name;
    const messageId = update.message.message_id;
    const text = update.message.text;

    const linkRegex = /(https?:\/\/[^\s]+)/gi;

    // --- Kanaldan habar ---
    if (update.message.sender_chat?.username === "TkmRace") {
      const randomText = autoTexts[Math.floor(Math.random() * autoTexts.length)];
      await sendMessage(chatId, randomText, false, messageId);
      return new Response("ok");
    }

    // --- /mute komandasy (reply we @username) ---
    if (text.startsWith("/mute")) {
      let targetUser: any;

      // --- Парсим время ---
      const timeMatches = [...text.matchAll(/(\d+)([dhm])/gi)];
      let seconds = 0;
      for (const match of timeMatches) {
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        if (unit === "d") seconds += value * 86400;
        if (unit === "h") seconds += value * 3600;
        if (unit === "m") seconds += value * 60;
      }
      if (seconds === 0) seconds = 24 * 3600;

      // --- Если reply ---
      if (update.message.reply_to_message) {
        targetUser = update.message.reply_to_message.from;
      } else {
        // --- По @username ---
        const usernameMatch = text.match(/@(\w+)/);
        if (usernameMatch) {
          const username = usernameMatch[1];
          try {
            const res = await fetch(`${TELEGRAM_API}/getChatMember?chat_id=${chatId}&user_id=@${username}`);
            const data = await res.json();
            if (data.ok) targetUser = data.result.user;
          } catch {
            targetUser = null;
          }
        }
      }

      if (!targetUser) {
        await deleteMessage(chatId, messageId);
        return new Response("ok");
      }

      const reason = text.replace(/\/mute\s+(@\w+\s+)?([\ddhm\s]+)/i, "").trim();
      const untilDate = Math.floor(Date.now() / 1000) + seconds;

      // --- Проверка прав ---
      if (await isAdmin(chatId, userId) && await isAdmin(chatId, targetUser.id)) {
        await deleteMessage(chatId, messageId);
        return new Response("ok");
      }
      if (!(await isAdmin(chatId, userId))) {
        await deleteMessage(chatId, messageId);
        return new Response("ok");
      }

      await muteUser(chatId, targetUser.id, seconds);

      const durationText = formatDuration(seconds);
      const untilText = formatUntilDateTM(untilDate);
      const reasonText = reason ? `Sebäp: ${reason}` : "";

      await sendMuteMessage(
        chatId,
        `🤐 [${targetUser.first_name}](tg://user?id=${targetUser.id}) ${durationText}lygyna sessizlige alyndy.\n⏳ ${untilText}-e çenli\n${reasonText}`,
        targetUser.id,
        targetUser.first_name
      );

      await deleteMessage(chatId, messageId);
      return new Response("ok");
    }

    // --- Linkleri barlamak ---
    const links = (text.match(linkRegex) || []).map(l => l.trim());
    const whitelist = [
      /^https?:\/\/t\.me\/TkmRace(\/.*)?(\?.*)?$/i,
      /^https?:\/\/t\.me\/TkmRace(\/.*)?(\?.*)?$/i,
    ];

    if (links.length > 0) {
      const hasBadLink = !links.every(link => whitelist.some(rule => rule.test(link)));
      if (hasBadLink && !(await isAdmin(chatId, userId))) {
        await deleteMessage(chatId, messageId);
        await muteUser(chatId, userId);
        await sendMuteMessage(
          chatId,
          `🤐 [${userName}](tg://user?id=${userId}) 24 sagat sessize alyndy.\n⏳ ${formatUntilDateTM(Math.floor(Date.now()/1000) + 24*3600)}-e çenli\nSebäp: spam linkler`,
          userId,
          userName
        );
      }
    }
  }

  // --- Inline knopka "Mute aýyrmak" ---
  if (update.callback_query) {
    const chatId = update.callback_query.message.chat.id;
    const fromId = update.callback_query.from.id;
    const data = update.callback_query.data;

    if (data.startsWith("remove_mute_")) {
      const parts = data.split("_");
      const targetId = parseInt(parts[2]);
      const targetName = decodeURIComponent(parts.slice(3).join("_"));

      if (await isAdmin(chatId, fromId)) {
        await unmuteUser(chatId, targetId);
        await sendMessage(chatId, `🔓 [${targetName}](tg://user?id=${targetId}) sessizligiň administrator tarapyndan aýryldy.`, true);
        await answerCallbackQuery(update.callback_query.id, "✅ Sessizlik aýryldy");
      } else {
        await answerCallbackQuery(update.callback_query.id, "⛔ Diňe administrator sessizligi aýyryp biler", false);
      }
    }
  }

  return new Response("ok");
});













