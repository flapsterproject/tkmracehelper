// main.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const TOKEN = Deno.env.get("BOT_TOKEN")!;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const SECRET_PATH = "/tkmracehelper"; 
const GAME_CHAT_ID = -1001234567890; // <-- вставь ID твоего игрового чата

// --- Утилиты ---
async function sendMessage(chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function sendMuteMessage(chatId: number, text: string, userId: number) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[
          { text: "🔓 Снять мут", callback_data: `remove_mute_${userId}` }
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

// --- Авто-сообщения про игру ---
setInterval(async () => {
  const texts = [
    "🏎 Добро пожаловать в TkmRace! Готов к гонке?",
    "🔥 В TkmRace только самые быстрые становятся чемпионами!",
    "⚡ Улучши свою реакцию — участвуй в TkmRace прямо сейчас!",
    "🎮 TkmRace ждёт тебя: скорость, драйв и адреналин!",
  ];
  const randomText = texts[Math.floor(Math.random() * texts.length)];
  await sendMessage(GAME_CHAT_ID, randomText);
}, 60 * 1000);

// --- Сервер ---
serve(async (req: Request) => {
  if (new URL(req.url).pathname !== SECRET_PATH) {
    return new Response("Not Found", { status: 404 });
  }

  const update = await req.json();

  // Личка
  if (update.message?.chat?.type === "private") {
    const chatId = update.message.chat.id;
    await sendMessage(chatId, "👋 Привет! Я бот группы TkmRace. Работать я могу только в чате игры.");
    return new Response("ok");
  }

  // Приветствие новых
  if (update.message?.new_chat_member) {
    const user = update.message.new_chat_member;
    const chatId = update.message.chat.id;
    await sendMessage(chatId, `Добро пожаловать, ${user.first_name}! 🎉`);
  }

  // Сообщение при выходе
  if (update.message?.left_chat_member) {
    const user = update.message.left_chat_member;
    const chatId = update.message.chat.id;
    await sendMessage(chatId, `👋 ${user.first_name} покинул чат.`);
  }

  // --- Обработка текстовых сообщений ---
  if (update.message?.text) {
    const chatId = update.message.chat.id;
    const userId = update.message.from.id;
    const userName = update.message.from.first_name;
    const messageId = update.message.message_id;
    const text = update.message.text;

    const linkRegex = /(https?:\/\/[^\s]+)/gi;
    
    // --- Команда /mute с указанием времени (только reply от админа) ---
    if (text.startsWith("/mute") && update.message.reply_to_message) {
      if (await isAdmin(chatId, userId)) {
        const targetUser = update.message.reply_to_message.from;

        // Парсим время из команды: /mute 24h, /mute 1h, /mute 30m
        const timeMatch = text.match(/\/mute\s+(\d+)([hm])/i);
        let seconds = 24 * 60 * 60; // по умолчанию 24ч

        if (timeMatch) {
          const value = parseInt(timeMatch[1]);
          const unit = timeMatch[2].toLowerCase();
          if (unit === "h") seconds = value * 60 * 60;
          else if (unit === "m") seconds = value * 60;
        }

        await muteUser(chatId, targetUser.id, seconds);

        await sendMuteMessage(
          chatId,
          `🤐 ${targetUser.first_name} получил мут на ${timeMatch ? timeMatch[1] + timeMatch[2] : "24h"}.`,
          targetUser.id
        );

        return new Response("ok");
      } else {
        return new Response("ok");
      }
    }

    // --- Проверка ссылок ---
    const links = (text.match(linkRegex) || []).map(l => l.trim());

    const whitelist = [
      /^https?:\/\/t\.me\/Happ_VPN_official(\/.*)?(\?.*)?$/i,
      /^https?:\/\/t\.me\/tmstars_chat(\/.*)?(\?.*)?$/i,
    ];

    if (links.length > 0) {
      const hasBadLink = !links.every(link => whitelist.some(rule => rule.test(link)));
      if (hasBadLink && !(await isAdmin(chatId, userId))) {
        await deleteMessage(chatId, messageId);
        await muteUser(chatId, userId);
        await sendMuteMessage(
          chatId,
          `🤐 ${userName} получил мут на 24 часа за спам.`,
          userId
        );
      }
    }
  }

  // --- Обработка кнопки "Снять мут" ---
  if (update.callback_query) {
    const chatId = update.callback_query.message.chat.id;
    const fromId = update.callback_query.from.id;
    const data = update.callback_query.data;

    if (data.startsWith("remove_mute_")) {
      const targetId = parseInt(data.replace("remove_mute_", ""));
      if (await isAdmin(chatId, fromId)) {
        await unmuteUser(chatId, targetId);
        await sendMessage(chatId, `🔓 Мут пользователя снят админом.`);
        await answerCallbackQuery(update.callback_query.id, "✅ Мут снят");
      } else {
        await answerCallbackQuery(update.callback_query.id, "⛔ Только админ может снимать мут", false);
      }
    }
  }

  return new Response("ok");
});




