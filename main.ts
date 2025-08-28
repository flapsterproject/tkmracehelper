import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const TOKEN = Deno.env.get("BOT_TOKEN");
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const SECRET_PATH = "/tkmracehelper"; // путь для вебхука

// Хранилище предупреждений (в памяти)
const warnings = new Map<number, number>();

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

// Бан пользователя
async function banUser(chatId: number, userId: number) {
  await fetch(`${TELEGRAM_API}/banChatMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, user_id: userId }),
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
    await sendMessage(chatId, `Добро пожаловать, ${user.first_name}! 🎉`);
  }

  // Проверка сообщений на ссылки
  if (update.message?.text) {
    const chatId = update.message.chat.id;
    const userId = update.message.from.id;
    const userName = update.message.from.first_name;
    const messageId = update.message.message_id;
    const text = update.message.text;

    const linkRegex = /(https?:\/\/[^\s]+)/gi;

    if (linkRegex.test(text)) {
      // Удаляем сообщение
      await deleteMessage(chatId, messageId);

      // Считаем предупреждения
      let count = warnings.get(userId) || 0;
      count++;
      warnings.set(userId, count);

      if (count < 4) {
        await sendMessage(chatId, `⚠️ ${userName}, это спам! У вас ${count}/3 предупреждений.`);
      } else {
        await sendMessage(chatId, `🚫 ${userName} заблокирован за спам.`);
        await banUser(chatId, userId);
        warnings.delete(userId); // обнуляем после бана
      }
    }
  }

  return new Response("ok");
});
