// main.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const TOKEN = Deno.env.get("BOT_TOKEN")!;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const SECRET_PATH = "/tkmracehelper"; // путь для вебхука

// Хранилище предупреждений (в памяти)
const warnings = new Map<number, number>();

// username → userId (будем сохранять, чтобы потом искать)
const usernames = new Map<string, number>();

// Функция отправки сообщений
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

// Мут пользователя (запретить писать сообщения)
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

// Размут пользователя
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

serve(async (req: Request) => {
  if (new URL(req.url).pathname !== SECRET_PATH) {
    return new Response("Not Found", { status: 404 });
  }

  const update = await req.json();

  // Приветствие нового участника
  if (update.message?.new_chat_member) {
    const user = update.message.new_chat_member;
    const chatId = update.message.chat.id;

    if (user.username) {
      usernames.set(user.username.toLowerCase(), user.id);
    }

    await sendMessage(chatId, `Добро пожаловать, ${user.first_name}! 🎉`);
  }

  // Проверка сообщений
  if (update.message?.text) {
    const chatId = update.message.chat.id;
    const userId = update.message.from.id;
    const userName = update.message.from.first_name;
    const userUsername = update.message.from.username?.toLowerCase();
    const messageId = update.message.message_id;
    const text = update.message.text;

    // Сохраняем username → userId
    if (userUsername) {
      usernames.set(userUsername, userId);
    }

    // Проверка на команду unmute
    if (text.includes("unmute")) {
      const match = text.match(/@([a-zA-Z0-9_]+)/);
      if (match) {
        const targetUsername = match[1].toLowerCase();
        const targetId = usernames.get(targetUsername);

        if (targetId) {
          await unmuteUser(chatId, targetId);
          warnings.delete(targetId);
          await sendMessage(chatId, `✅ Пользователь @${targetUsername} размучен и его предупреждения обнулены.`);
        } else {
          await sendMessage(chatId, `⚠️ Не удалось найти пользователя @${targetUsername}.`);
        }
      }
    }

    // Проверка сообщений на ссылки (спам)
    const linkRegex = /(https?:\/\/[^\s]+)/gi;
    if (linkRegex.test(text)) {
      await deleteMessage(chatId, messageId);

      let count = warnings.get(userId) || 0;
      count++;
      warnings.set(userId, count);

      if (count < 4) {
        await sendMessage(chatId, `⚠️ ${userName}, это спам! У вас ${count}/3 предупреждений.`);
      } else {
        await sendMessage(chatId, `🤐 ${userName} больше не может писать сообщения (мут за спам).`);
        await muteUser(chatId, userId);
        warnings.delete(userId);
      }
    }
  }

  return new Response("ok");
});

