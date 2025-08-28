// main.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const TOKEN = Deno.env.get("BOT_TOKEN")!;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const SECRET_PATH = "/tkmracehelper"; // путь для вебхука

// --- Утилиты ---
// Отправка обычного сообщения
async function sendMessage(chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

// Сообщение с кнопкой "Снять мут"
async function sendMuteMessage(chatId: number, text: string, userId: number) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[
          {
            text: "🔓 Снять мут",
            callback_data: `remove_mute_${userId}`
          }
        ]]
      }
    }),
  });
}

// Удаление сообщений
async function deleteMessage(chatId: number, messageId: number) {
  await fetch(`${TELEGRAM_API}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
  });
}

// Мут на 24 часа
async function muteUser(chatId: number, userId: number) {
  const untilDate = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24ч в секундах
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

// Размут
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

// Проверка — админ ли
async function isAdmin(chatId: number, userId: number) {
  const res = await fetch(`${TELEGRAM_API}/getChatMember?chat_id=${chatId}&user_id=${userId}`);
  const data = await res.json();
  if (!data.ok) return false;
  const status = data.result.status;
  return status === "administrator" || status === "creator";
}

// Всплывающее уведомление (answerCallbackQuery)
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

// --- Сервер ---
serve(async (req: Request) => {
  if (new URL(req.url).pathname !== SECRET_PATH) {
    return new Response("Not Found", { status: 404 });
  }

  const update = await req.json();

  // Приветствие
  if (update.message?.new_chat_member) {
    const user = update.message.new_chat_member;
    const chatId = update.message.chat.id;
    await sendMessage(chatId, `Добро пожаловать, ${user.first_name}! 🎉`);
  }

  // Проверка на текстовые сообщения
  if (update.message?.text) {
    const chatId = update.message.chat.id;
    const userId = update.message.from.id;
    const userName = update.message.from.first_name;
    const messageId = update.message.message_id;
    const text = update.message.text;

    const linkRegex = /(https?:\/\/[^\s]+)/gi;

    if (linkRegex.test(text)) {
      await deleteMessage(chatId, messageId);

      // Сразу мутим на 24 часа
      await muteUser(chatId, userId);
      await sendMuteMessage(
        chatId,
        `🤐 ${userName} получил мут на 24 часа за спам.`,
        userId
      );
    }
  }

  // Обработка кнопки "Снять мут"
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
        // маленькая всплывашка вместо сообщения в чат
        await answerCallbackQuery(update.callback_query.id, "⛔ Только админ может снимать мут", false);
      }
    }
  }

  return new Response("ok");
});
