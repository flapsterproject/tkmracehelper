// main.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const TOKEN = Deno.env.get("BOT_TOKEN")!;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const SECRET_PATH = "/tkmracehelper"; 
const GAME_CHAT_ID = -1001234567890; // <-- вставь ID твоего игрового чата

// --- Утилиты ---
async function sendMessage(chatId: number, text: string, markdown = false) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      chat_id: chatId, 
      text,
      parse_mode: markdown ? "Markdown" : undefined 
    }),
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
          { text: "🔓 Снять мут", callback_data: `remove_mute_${userId}_${encodeURIComponent(userName)}` }
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

// --- Форматирование времени ---
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  let parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? "час" : (hours < 5 ? "часа" : "часов")}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? "минута" : (minutes < 5 ? "минуты" : "минут")}`);
  }

  return parts.length > 0 ? parts.join(" ") : "несколько секунд";
}

// --- Форматируем дату по Туркменистану (UTC+5) ---
function formatUntilDateTM(unixTime: number): string {
  const d = new Date((unixTime + 5*3600) * 1000); // UTC+5
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

// --- Авто-сообщения про игру ---
const autoTexts = [
  "🏎 Добро пожаловать в TkmRace! Готов к гонке?",
  "🔥 В TkmRace только самые быстрые становятся чемпионами!",
  "⚡ Улучши свою реакцию — участвуй в TkmRace прямо сейчас!",
  "🎮 TkmRace ждёт тебя: скорость, драйв и адреналин!",
];

setInterval(async () => {
  const randomText = autoTexts[Math.floor(Math.random() * autoTexts.length)];
  await sendMessage(GAME_CHAT_ID, randomText);
}, 60 * 1000);

// --- Сервер ---
serve(async (req: Request) => {
  if (new URL(req.url).pathname !== SECRET_PATH) {
    return new Response("Not Found", { status: 404 });
  }

  const update = await req.json();

  // --- Личка ---
  if (update.message?.chat?.type === "private") {
    const chatId = update.message.chat.id;
    await sendMessage(chatId, "👋 Привет! Я бот группы TkmRace. Работать я могу только в чате игры.");
    return new Response("ok");
  }

  // --- Приветствие новых ---
  if (update.message?.new_chat_member) {
    const user = update.message.new_chat_member;
    const chatId = update.message.chat.id;
    await sendMessage(chatId, `Добро пожаловать, [${user.first_name}](tg://user?id=${user.id})! 🎉`, true);
  }

  // --- Выход пользователя ---
  if (update.message?.left_chat_member) {
    const user = update.message.left_chat_member;
    const chatId = update.message.chat.id;
    await sendMessage(chatId, `👋 [${user.first_name}](tg://user?id=${user.id}) покинул чат.`, true);
  }

  // --- Текстовые сообщения ---
  if (update.message?.text) {
    const chatId = update.message.chat.id;
    const userId = update.message.from.id;
    const userName = update.message.from.first_name;
    const messageId = update.message.message_id;
    const text = update.message.text;

    const linkRegex = /(https?:\/\/[^\s]+)/gi;

    // --- Ответ на сообщения от канала HedgehogChronicle ---
    if (update.message.sender_chat?.username === "HedgehogChronicle") {
      const randomText = autoTexts[Math.floor(Math.random() * autoTexts.length)];
      await sendMessage(chatId, randomText);
      return new Response("ok");
    }

    // --- /mute ---
    if (text.startsWith("/mute") && update.message.reply_to_message) {
      const targetUser = update.message.reply_to_message.from;

      // Если цель — админ или сообщение не от админа, просто удалить команду
      if (await isAdmin(chatId, targetUser.id) || !(await isAdmin(chatId, userId))) {
        await deleteMessage(chatId, messageId);
        return new Response("ok");
      }

      // Время мьюта
      const timeMatches = [...text.matchAll(/(\d+)([hm])/gi)];
      let seconds = 0;
      for (const match of timeMatches) {
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        if (unit === "h") seconds += value * 3600;
        if (unit === "m") seconds += value * 60;
      }
      if (seconds === 0) seconds = 24 * 3600;

      const reason = text.replace(/\/mute\s+([\dhm\s]+)/i, "").trim();
      const untilDate = Math.floor(Date.now() / 1000) + seconds;

      await muteUser(chatId, targetUser.id, seconds);

      const durationText = formatDuration(seconds);
      const untilText = formatUntilDateTM(untilDate);
      const reasonText = reason ? `Причина: ${reason}` : "";

      await sendMuteMessage(
        chatId,
        `🤐 [${targetUser.first_name}](tg://user?id=${targetUser.id}) получил мут на ${durationText}.\n⏳ До ${untilText}\n${reasonText}`,
        targetUser.id,
        targetUser.first_name
      );

      await deleteMessage(chatId, messageId);
      return new Response("ok");
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
          `🤐 [${userName}](tg://user?id=${userId}) получил мут на 24 часа.\n⏳ До ${formatUntilDateTM(Math.floor(Date.now()/1000) + 24*3600)}\nПричина: спам ссылками`,
          userId,
          userName
        );
      }
    }
  }

  // --- Кнопка "Снять мут" ---
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

        await sendMessage(
          chatId, 
          `🔓 Мут с [${targetName}](tg://user?id=${targetId}) снят админом.`,
          true
        );

        await answerCallbackQuery(update.callback_query.id, "✅ Мут снят");
      } else {
        await answerCallbackQuery(update.callback_query.id, "⛔ Только админ может снимать мут", false);
      }
    }
  }

  return new Response("ok");
});










