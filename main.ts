// main.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const TOKEN = Deno.env.get("BOT_TOKEN")!;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const SECRET_PATH = "/tkmracehelper"; // путь для вебхука

// Хранилище предупреждений (в памяти)
const warnings = new Map<number, number>();

// Функция отправки сообщений с кнопкой
async function sendWarning(chatId: number, text: string, userId: number) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[
          {
            text: "❌ Убрать предупреждение",
            callback_data: `remove_warning_${userId}`
          }
        ]]
      }
    }),
  });
}

// Простое сообщение
async function sendMessage(chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
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

// Мут пользователя
async function muteUser(chatId: number, userId: number) {
  await fetch(`${TELEGRAM_API}/restrictChatMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      user_id: userId,
      permissions: {
        can_send_messages: false,
        can_send_media_messages: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
      },
    }),
  });
}

// Размут пользователя (восстановление прав)
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

// Проверка — является ли пользователь админом
async function isAdmin(chatId: number, userId: number) {
  const res = await fetch(`${TELEGRAM_API}/getChatMember?chat_id=${chatId}&user_id=${userId}`);
  const data = await res.json();
  if (!data.ok) return false;
  const status = data.result.status;
  return status === "administrator" || status === "creator";
}

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

      let count = warnings.get(userId) || 0;
      count++;
      warnings.set(userId, count);

      if (count < 4) {
        await sendWarning(
          chatId,
          `⚠️ ${userName}, это спам! У вас ${count}/3 предупреждений.`,
          userId
        );
      } else {
        await sendMessage(chatId, `🤐 ${userName} больше не может писать сообщения (мут за спам).`);
        await muteUser(chatId, userId);
        warnings.delete(userId);
      }
    }
  }

  // Обработка нажатия кнопки "Убрать предупреждение"
  if (update.callback_query) {
    const chatId = update.callback_query.message.chat.id;
    const fromId = update.callback_query.from.id;
    const data = update.callback_query.data;

    if (data.startsWith("remove_warning_")) {
      const targetId = parseInt(data.replace("remove_warning_", ""));

      // Проверяем, админ ли тот, кто нажал
      if (await isAdmin(chatId, fromId)) {
        warnings.delete(targetId);
        await unmuteUser(chatId, targetId);
        await sendMessage(chatId, `✅ Предупреждения пользователя сняты админом.`);
      } else {
      // Показываем уведомление (как на скрине)
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackId,
          text: "⛔ Только админ может убирать предупреждения.",
          show_alert: true
        }),
      });
    }
  }
}

  return new Response("ok");
});
